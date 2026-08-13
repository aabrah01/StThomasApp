import { createSign } from 'crypto';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const SCOPE     = 'https://www.googleapis.com/auth/drive';

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Files smaller than this are sync artifacts, not exports (a ~$ owner file is ~165 bytes). */
const MIN_FILE_BYTES = 5 * 1024;

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size: number;
}

export interface SelectionOptions {
  /** Ignore files modified within this many minutes. 0 disables the check. */
  minAgeMinutes: number;
  /** Defaults to now; injectable for tests. */
  now?: Date;
}

/**
 * Pick the export to import from a folder listing.
 *
 * The folder is a Windows-mapped Drive folder, so it collects more than the
 * treasurer's uploads — see the rejection rules below.
 */
export function selectImportFile(files: DriveFile[], { minAgeMinutes, now = new Date() }: SelectionOptions): DriveFile | null {
  const cutoff = now.getTime() - minAgeMinutes * 60_000;

  const candidates = files.filter(f => {
    // Excel writes a hidden ~$Name.xlsx owner file while the workbook is open, and
    // Drive for Desktop syncs it up. It is newer than the real export, so without
    // this it would win the sort below.
    if (f.name.startsWith('~$')) return false;
    if (f.name.startsWith('.')) return false;
    if (f.mimeType !== XLSX_MIME) return false;
    if (f.size < MIN_FILE_BYTES) return false;
    // Still uploading, or still open in Excel — moving it would error on their machine.
    if (minAgeMinutes > 0 && new Date(f.modifiedTime).getTime() > cutoff) return false;
    return true;
  });

  if (!candidates.length) return null;
  return candidates.reduce((newest, f) =>
    new Date(f.modifiedTime).getTime() > new Date(newest.modifiedTime).getTime() ? f : newest);
}

/**
 * True when a workbook is currently open in Excel somewhere.
 *
 * The lock file we exclude from selection doubles as a signal: the manual
 * trigger skips the freshness gate but refuses while one is present, so it can
 * say "close the file" instead of silently finding nothing.
 */
export function hasOpenWorkbook(files: DriveFile[]): boolean {
  return files.some(f => f.name.startsWith('~$'));
}

/** Base64url without padding, as required by JWT. */
const b64url = (input: Buffer | string) =>
  Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/**
 * Exchange a service-account JWT for an access token.
 *
 * Hand-rolled rather than pulling in google-auth-library: it is one signature
 * and one POST, and the dependency would be the largest in the project.
 */
async function getAccessToken(): Promise<string> {
  const email = process.env.GOOGLE_SA_EMAIL;
  // Vercel env vars store the PEM with literal \n sequences.
  const key   = process.env.GOOGLE_SA_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!email || !key) throw new Error('GOOGLE_SA_EMAIL and GOOGLE_SA_PRIVATE_KEY must be set');

  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };

  const signingInput = `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(JSON.stringify(claims))}`;
  const signature    = createSign('RSA-SHA256').update(signingInput).sign(key);
  const assertion    = `${signingInput}.${b64url(signature)}`;

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  if (!res.ok) throw new Error(`Google token exchange failed (${res.status})`);
  const { access_token } = await res.json();
  if (!access_token) throw new Error('Google token exchange returned no access_token');
  return access_token;
}

const driveFetch = async (token: string, path: string, init?: RequestInit) => {
  const res = await fetch(`${DRIVE_API}${path}`, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Drive API ${init?.method ?? 'GET'} ${path.split('?')[0]} failed (${res.status})`);
  return res;
};

/**
 * List every file directly in a folder.
 *
 * Returns all mime types — selectImportFile does the filtering, and the lock-file
 * check needs to see files Drive may not type as xlsx.
 *
 * supportsAllDrives / includeItemsFromAllDrives are required for Shared Drives.
 * Without them a Shared Drive listing comes back empty with no error.
 */
export async function listFolder(folderId: string): Promise<DriveFile[]> {
  const token = await getAccessToken();
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id,name,mimeType,modifiedTime,size)',
    pageSize: '100',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  });

  const res = await driveFetch(token, `/files?${params}`);
  const { files } = await res.json();
  return (files ?? []).map((f: Record<string, string>) => ({
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    modifiedTime: f.modifiedTime,
    // Google Docs-native files report no size; treat as 0 so the floor rejects them.
    size: Number(f.size ?? 0),
  }));
}

/**
 * Fetch one file's metadata, including which folder it currently sits in.
 *
 * Needed to re-import a file that has already been filed away: it is no longer
 * in the inbox, so a folder listing will not find it, and a later move needs its
 * present parent.
 */
export async function getFile(fileId: string): Promise<DriveFile & { parents: string[] }> {
  const token = await getAccessToken();
  const res = await driveFetch(
    token,
    `/files/${fileId}?fields=id,name,mimeType,modifiedTime,size,parents,trashed&supportsAllDrives=true`,
  );
  const f = await res.json();
  if (f.trashed) throw new Error(`File ${f.name} is in the Drive trash`);
  return {
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    modifiedTime: f.modifiedTime,
    size: Number(f.size ?? 0),
    parents: f.parents ?? [],
  };
}

export async function downloadFile(fileId: string): Promise<Uint8Array> {
  const token = await getAccessToken();
  const res = await driveFetch(token, `/files/${fileId}?alt=media&supportsAllDrives=true`);
  return new Uint8Array(await res.arrayBuffer());
}

/** Find a direct subfolder by name, creating it if absent. */
export async function findOrCreateFolder(parentId: string, name: string): Promise<string> {
  const token = await getAccessToken();
  const params = new URLSearchParams({
    q: `'${parentId}' in parents and name = '${name.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id)',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  });

  const res = await driveFetch(token, `/files?${params}`);
  const { files } = await res.json();
  if (files?.length) return files[0].id;

  const created = await driveFetch(token, '/files?supportsAllDrives=true', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }),
  });
  const { id } = await created.json();
  return id;
}

/**
 * Move a file into another folder, optionally renaming it.
 *
 * Callers must only do this after the database transaction commits — see the
 * move-ordering rules in the plan.
 */
export async function moveFile(
  fileId: string,
  { fromFolderId, toFolderId, newName }: { fromFolderId: string; toFolderId: string; newName?: string },
): Promise<void> {
  const token = await getAccessToken();
  const params = new URLSearchParams({
    addParents: toFolderId,
    removeParents: fromFolderId,
    fields: 'id',
    supportsAllDrives: 'true',
  });

  await driveFetch(token, `/files/${fileId}?${params}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newName ? { name: newName } : {}),
  });
}
