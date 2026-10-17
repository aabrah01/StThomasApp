import {
  storagePathFromUrl,
  thumbUrlFor,
  thumbPathFor,
  photoSize,
  thumbSize,
  fallBackToFullPhoto,
} from '@/lib/familyPhoto';

const BASE = 'https://abc.supabase.co/storage/v1/object/public/family-photos/';

// ── URLs and paths ────────────────────────────────────────────────────────────

describe('thumbUrlFor', () => {
  it('points a bucket photo at its thumbnail', () => {
    expect(thumbUrlFor(`${BASE}fam1/family-123.jpg`)).toBe(`${BASE}fam1/family-123-thumb.jpg`);
  });

  it('handles photos uploaded from the app, under families/', () => {
    expect(thumbUrlFor(`${BASE}families/fam1/family-123.jpg`))
      .toBe(`${BASE}families/fam1/family-123-thumb.jpg`);
  });

  it('leaves URLs outside the bucket alone', () => {
    const demo = 'https://images.unsplash.com/photo-1?auto=format&w=600';
    expect(thumbUrlFor(demo)).toBe(demo);
  });
});

describe('storagePathFromUrl / thumbPathFor', () => {
  it('extracts the bucket path', () => {
    expect(storagePathFromUrl(`${BASE}fam1/family-123.jpg`)).toBe('fam1/family-123.jpg');
  });

  it('returns null for other URLs', () => {
    expect(storagePathFromUrl('https://example.com/a.jpg')).toBeNull();
  });

  it('names the thumbnail beside the photo', () => {
    expect(thumbPathFor('fam1/family-123.jpg')).toBe('fam1/family-123-thumb.jpg');
  });
});

// ── sizes ─────────────────────────────────────────────────────────────────────

describe('photoSize', () => {
  it('caps the long edge at 2048', () => {
    expect(photoSize({ width: 4032, height: 3024 })).toEqual({ width: 2048, height: 1536 });
    expect(photoSize({ width: 3000, height: 4000 })).toEqual({ width: 1536, height: 2048 });
  });

  it('never enlarges', () => {
    expect(photoSize({ width: 1200, height: 625 })).toEqual({ width: 1200, height: 625 });
  });
});

describe('thumbSize', () => {
  it('sizes the short edge to 600', () => {
    expect(thumbSize({ width: 4032, height: 3024 })).toEqual({ width: 800, height: 600 });
    expect(thumbSize({ width: 5712, height: 2967 })).toEqual({ width: 1155, height: 600 });
  });

  it('never enlarges', () => {
    expect(thumbSize({ width: 500, height: 400 })).toEqual({ width: 500, height: 400 });
  });
});

// ── missing thumbnails ────────────────────────────────────────────────────────

describe('fallBackToFullPhoto', () => {
  it('swaps a failed thumbnail for the full photo once', () => {
    const full = `${BASE}fam1/family-123.jpg`;
    const img = { src: thumbUrlFor(full) } as HTMLImageElement;
    fallBackToFullPhoto(full)({ currentTarget: img });
    expect(img.src).toBe(full);
  });
});
