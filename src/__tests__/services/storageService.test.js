/**
 * Tests for StorageService family photo upload/delete against a mocked
 * Supabase bucket and image manipulator.
 */

jest.mock('../../utils/config', () => ({ isDemoSession: () => false }));
jest.mock('../../services/errorLogger', () => ({ logClientError: jest.fn() }));
jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { JPEG: 'jpeg' },
}));

const ImageManipulator = require('expo-image-manipulator');
const { supabase } = require('../../../__mocks__/supabase.config');
const { default: storage, thumbUrlFor } = require('../../services/storageService');

const BASE = 'https://abc.supabase.co/storage/v1/object/public/family-photos/';

// Fake file system: uri -> byte size, read back through fetch().
let files;
let bucket;

beforeEach(() => {
  files = {};
  global.fetch = jest.fn(async (uri) => ({ arrayBuffer: async () => new ArrayBuffer(files[uri]) }));
  ImageManipulator.manipulateAsync.mockReset();
  bucket = {
    upload: jest.fn().mockResolvedValue({ error: null }),
    remove: jest.fn().mockResolvedValue({ data: [], error: null }),
    getPublicUrl: jest.fn((path) => ({ data: { publicUrl: BASE + path } })),
  };
  supabase.storage.from = jest.fn(() => bucket);
});

// A picked photo of the given size; each resize writes a new file of
// `resizedBytes(width)` bytes.
function pickPhoto({ width, height, bytes, resizedBytes }) {
  files['file://picked.jpg'] = bytes;
  let n = 0;
  ImageManipulator.manipulateAsync.mockImplementation(async (uri, actions) => {
    if (!actions.length) return { uri, width, height };
    const w = actions[0].resize.width;
    const out = `file://resized-${n++}.jpg`;
    files[out] = resizedBytes(w);
    return { uri: out, width: w };
  });
}

const uploaded = () => Object.fromEntries(bucket.upload.mock.calls.map(([path, body, opts]) => [path, { bytes: body.byteLength, opts }]));

describe('thumbUrlFor', () => {
  it('points a bucket photo at its thumbnail', () => {
    expect(thumbUrlFor(`${BASE}families/f1/family-1.jpg`)).toBe(`${BASE}families/f1/family-1-thumb.jpg`);
  });

  it('leaves demo and empty URLs alone', () => {
    expect(thumbUrlFor('https://images.unsplash.com/x?w=600')).toBe('https://images.unsplash.com/x?w=600');
    expect(thumbUrlFor(null)).toBeNull();
  });
});

describe('uploadFamilyPhoto', () => {
  it('stores a capped photo and a thumbnail with a long cache lifetime', async () => {
    pickPhoto({ width: 3024, height: 4032, bytes: 5_000_000, resizedBytes: (w) => w * 300 });

    const { url, error } = await storage.uploadFamilyPhoto('f1', 'file://picked.jpg');

    expect(error).toBeNull();
    const resizes = ImageManipulator.manipulateAsync.mock.calls.filter(([, a]) => a.length).map(([, a]) => a[0].resize.width);
    expect(resizes).toEqual([1536, 600]); // 4032 long edge -> 2048; 3024 short edge -> 600
    const stored = uploaded();
    const [photoPath, thumbPath] = Object.keys(stored);
    expect(photoPath).toMatch(/^families\/f1\/family-\d+\.jpg$/);
    expect(thumbPath).toBe(photoPath.replace('.jpg', '-thumb.jpg'));
    expect(stored[photoPath].bytes).toBe(1536 * 300);
    expect(stored[thumbPath].bytes).toBe(600 * 300);
    for (const f of Object.values(stored)) {
      expect(f.opts).toMatchObject({ contentType: 'image/jpeg', cacheControl: '31536000' });
    }
    expect(url).toBe(BASE + photoPath);
  });

  it('keeps an already-small photo as it is and never enlarges the thumbnail', async () => {
    pickPhoto({ width: 500, height: 400, bytes: 40_000, resizedBytes: () => 99_999 });

    await storage.uploadFamilyPhoto('f1', 'file://picked.jpg');

    expect(ImageManipulator.manipulateAsync.mock.calls.filter(([, a]) => a.length)).toHaveLength(0);
    expect(Object.values(uploaded()).map(f => f.bytes)).toEqual([40_000, 40_000]);
  });

  it('uses the original when a re-encode comes out bigger', async () => {
    pickPhoto({ width: 1200, height: 1200, bytes: 100_000, resizedBytes: () => 150_000 });

    await storage.uploadFamilyPhoto('f1', 'file://picked.jpg');

    expect(Object.values(uploaded()).map(f => f.bytes)).toEqual([100_000, 100_000]);
  });

  it('removes the photo and reports an error if the thumbnail upload fails', async () => {
    pickPhoto({ width: 3024, height: 4032, bytes: 5_000_000, resizedBytes: (w) => w * 300 });
    bucket.upload
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: 'thumb failed' } });

    const { url, error } = await storage.uploadFamilyPhoto('f1', 'file://picked.jpg');

    expect(url).toBeNull();
    expect(error).toBe('thumb failed');
    expect(bucket.remove).toHaveBeenCalledWith([bucket.upload.mock.calls[0][0]]);
  });
});

describe('deleteFamilyPhoto', () => {
  it('removes the photo and its thumbnail', async () => {
    await storage.deleteFamilyPhoto(`${BASE}families/f1/family-1.jpg`);
    expect(bucket.remove).toHaveBeenCalledWith(['families/f1/family-1.jpg', 'families/f1/family-1-thumb.jpg']);
  });
});
