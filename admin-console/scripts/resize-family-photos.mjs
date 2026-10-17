// One-time (re-runnable) clean-up of the family-photos bucket: caps each photo
// at 2048px on the long edge, writes a `-thumb.jpg` next to it for list views,
// and re-saves everything with a long cache lifetime. Originals are copied to a
// private bucket first so the change can be undone.
//
// Runs locally with Node, against whichever project SUPABASE_URL points at:
//
//   SUPABASE_URL=https://<ref>.supabase.co node scripts/resize-family-photos.mjs preview <out-dir> <path>...
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/resize-family-photos.mjs backup
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/resize-family-photos.mjs dry-run
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/resize-family-photos.mjs apply
//
// preview  Read-only. Downloads the given photos from their public URLs and
//          writes the original, 2048px, 2560px and thumbnail versions to
//          <out-dir> for side-by-side review. Needs no key.
// backup   Copies every photo into the private family-photos-originals bucket
//          (server-side copy, nothing is downloaded). Skips ones already there.
// dry-run  Reports what apply would do, with sizes before and after. No writes.
// apply    Refuses unless every photo has a matching backup, then uploads the
//          resized photos and thumbnails.

import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const BUCKET = 'family-photos';
const BACKUP_BUCKET = 'family-photos-originals';
const MAX_EDGE = 2048;
// Directory cards crop to a square about 550px across on the largest phones,
// so the short edge is what has to be big enough.
const THUMB_SHORT_EDGE = 600;
const PHOTO_QUALITY = 85;
const THUMB_QUALITY = 80;
// Every upload gets a unique timestamped name, so files never change in place.
const CACHE_SECONDS = '31536000';

const thumbPathFor = (p) => p.replace(/\.jpg$/i, '-thumb.jpg');
const isThumb = (p) => /-thumb\.jpg$/i.test(p);

// rotate() applies EXIF orientation before the EXIF is dropped (along with any
// GPS location); the colour profile is kept so iPhone wide-colour photos don't
// shift.
async function resizePhoto(buf, maxEdge = MAX_EDGE) {
  const { width, height } = await sharp(buf).metadata();
  if (Math.max(width, height) <= maxEdge) return { buf, resized: false };
  const out = await sharp(buf)
    .rotate()
    .resize({ width: maxEdge, height: maxEdge, fit: 'inside' })
    .keepIccProfile()
    .jpeg({ quality: PHOTO_QUALITY, mozjpeg: true })
    .toBuffer();
  return out.length < buf.length ? { buf: out, resized: true } : { buf, resized: false };
}

// Small, heavily compressed photos can come out larger when re-encoded; their
// thumbnail is then just the photo itself.
async function makeThumb(buf) {
  const out = await sharp(buf)
    .rotate()
    .resize({ width: THUMB_SHORT_EDGE, height: THUMB_SHORT_EDGE, fit: 'outside', withoutEnlargement: true })
    .keepIccProfile()
    .jpeg({ quality: THUMB_QUALITY, mozjpeg: true })
    .toBuffer();
  return out.length < buf.length ? out : buf;
}

async function dims(buf) {
  const m = await sharp(buf).metadata();
  return m.orientation >= 5 ? `${m.height}x${m.width}` : `${m.width}x${m.height}`;
}

const kb = (n) => `${Math.round(n / 1024)} KB`;

function env(name) {
  const v = process.env[name];
  if (!v) { console.error(`Set ${name} first.`); process.exit(1); }
  return v;
}

function adminClient() {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  });
}

// storage.list() is one folder deep, so walk it. Folders come back with id null.
async function listAll(supabase, bucket, prefix = '') {
  const out = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000, offset });
    if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`);
    for (const item of data) {
      const p = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) out.push(...await listAll(supabase, bucket, p));
      else out.push({ path: p, size: item.metadata?.size ?? 0 });
    }
    if (data.length < 1000) return out;
  }
}

async function download(supabase, p) {
  const { data, error } = await supabase.storage.from(BUCKET).download(p);
  if (error) throw new Error(`download ${p}: ${error.message}`);
  return Buffer.from(await data.arrayBuffer());
}

async function upload(supabase, p, buf) {
  const { error } = await supabase.storage.from(BUCKET).upload(p, buf, {
    upsert: true, contentType: 'image/jpeg', cacheControl: CACHE_SECONDS,
  });
  if (error) throw new Error(`upload ${p}: ${error.message}`);
}

async function preview(outDir, paths) {
  if (!outDir || !paths.length) { console.error('Usage: preview <out-dir> <path>...'); process.exit(1); }
  const base = `${env('SUPABASE_URL')}/storage/v1/object/public/${BUCKET}/`;
  await mkdir(outDir, { recursive: true });
  const manifest = [];
  for (const [i, p] of paths.entries()) {
    const res = await fetch(base + p);
    if (!res.ok) throw new Error(`fetch ${p}: ${res.status}`);
    const original = Buffer.from(await res.arrayBuffer());
    const versions = {
      original,
      '2048': (await resizePhoto(original, 2048)).buf,
      '2560': (await resizePhoto(original, 2560)).buf,
      thumb: await makeThumb(original),
    };
    const entry = { path: p, files: {} };
    for (const [name, buf] of Object.entries(versions)) {
      const file = `${i + 1}-${name}.jpg`;
      await writeFile(path.join(outDir, file), buf);
      entry.files[name] = { file, bytes: buf.length, dims: await dims(buf) };
    }
    manifest.push(entry);
    console.log(`${p}\n  ${Object.entries(entry.files).map(([n, f]) => `${n}: ${f.dims} ${kb(f.bytes)}`).join(' | ')}`);
  }
  await writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
}

async function backup() {
  const supabase = adminClient();
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.some((b) => b.id === BACKUP_BUCKET)) {
    const { error } = await supabase.storage.createBucket(BACKUP_BUCKET, { public: false });
    if (error) throw new Error(`create ${BACKUP_BUCKET}: ${error.message}`);
    console.log(`Created private bucket ${BACKUP_BUCKET}`);
  }
  const photos = (await listAll(supabase, BUCKET)).filter((o) => !isThumb(o.path));
  const existing = new Set((await listAll(supabase, BACKUP_BUCKET)).map((o) => o.path));
  let copied = 0;
  for (const { path: p } of photos) {
    if (existing.has(p)) continue;
    const { error } = await supabase.storage.from(BUCKET).copy(p, p, { destinationBucket: BACKUP_BUCKET });
    if (error) throw new Error(`copy ${p}: ${error.message}`);
    copied++;
  }
  console.log(`Copied ${copied}, already backed up ${photos.length - copied}, total ${photos.length}`);
}

async function resizeAll({ write }) {
  const supabase = adminClient();
  const photos = (await listAll(supabase, BUCKET)).filter((o) => !isThumb(o.path));
  const backups = new Map((await listAll(supabase, BACKUP_BUCKET)).map((o) => [o.path, o.size]));
  const missing = photos.filter((o) => backups.get(o.path) !== o.size);
  if (missing.length) {
    console.error(`${missing.length} photo(s) have no matching backup — run backup first:`);
    missing.forEach((o) => console.error(`  ${o.path}`));
    process.exit(1);
  }

  let before = 0, after = 0, thumbs = 0, resized = 0;
  for (const { path: p } of photos) {
    const original = await download(supabase, p);
    const photo = await resizePhoto(original);
    const thumb = await makeThumb(original);
    before += original.length; after += photo.buf.length; thumbs += thumb.length;
    if (photo.resized) resized++;
    console.log(`${photo.resized ? 'resize' : 'keep  '} ${p}  ${kb(original.length)} -> ${kb(photo.buf.length)}, thumb ${kb(thumb.length)}`);
    if (write) {
      await upload(supabase, p, photo.buf);
      await upload(supabase, thumbPathFor(p), thumb);
    }
  }
  console.log(`\n${photos.length} photos, ${resized} resized: ${kb(before)} -> ${kb(after)}, thumbnails ${kb(thumbs)}`);
  if (!write) console.log('Dry run — nothing was changed.');
}

const [mode, ...args] = process.argv.slice(2);
const modes = {
  preview: () => preview(args[0], args.slice(1)),
  backup,
  'dry-run': () => resizeAll({ write: false }),
  apply: () => resizeAll({ write: true }),
};
if (!modes[mode]) {
  console.error('Usage: resize-family-photos.mjs preview|backup|dry-run|apply');
  process.exit(1);
}
await modes[mode]();
