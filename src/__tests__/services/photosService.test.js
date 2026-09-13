/**
 * Tests for the photo album parser.
 *
 * The fixture is a trimmed capture of the church site's WordPress REST
 * response (the 2026, 2024 and 2017 year pages) — real markup, so the varying
 * shapes across years are exercised rather than an idealised sample.
 */

import { parseAlbums } from '../../services/photosService';
import pages from '../fixtures/wpPhotoPages.json';

describe('parseAlbums', () => {
  const albums = parseAlbums(pages);

  it('finds every album across all year pages', () => {
    expect(albums).toHaveLength(15);
  });

  it('gives every album a title, a year and a share link', () => {
    albums.forEach((album) => {
      expect(album.title).toBeTruthy();
      expect(album.year).toBeTruthy();
      expect(album.shareUrl).toMatch(/^https:\/\/photos\./);
    });
  });

  it('assigns unique ids', () => {
    expect(new Set(albums.map(a => a.id)).size).toBe(albums.length);
  });

  it('decodes named and numeric HTML entities in titles', () => {
    const titles = albums.map(a => a.title);
    expect(titles).toContain('Parish Perunal & Parish Day');
    expect(titles).toContain('2024 Abey Achen’s 40th Birthday & Graduation');
    expect(titles).toContain('2017 FOCUS Trip – St. Tikhons & HTRC');
    titles.forEach((title) => {
      expect(title).not.toMatch(/&(amp|#\d+);/);
    });
  });

  it('rewrites Photon covers to thumbnail width', () => {
    const photon = albums.filter(a => a.coverUrl?.includes('i0.wp.com'));
    expect(photon.length).toBeGreaterThan(0);
    photon.forEach((album) => {
      expect(album.coverUrl).toMatch(/\?w=240&ssl=1$/);
      // The escaped separator from the source markup must not survive
      expect(album.coverUrl).not.toContain('&#038;');
    });
  });

  it('sorts years newest first', () => {
    const years = [...new Set(albums.map(a => a.year))];
    expect(years).toEqual(['2026', '2024', '2017']);
  });

  it('returns an empty list rather than throwing on missing data', () => {
    expect(parseAlbums(undefined)).toEqual([]);
    expect(parseAlbums([{ id: 1 }])).toEqual([]);
    expect(parseAlbums([{ id: 1, content: { rendered: '<p>No albums yet.</p>' } }])).toEqual([]);
  });
});
