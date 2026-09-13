import axios from 'axios';
import { isDemoSession } from '../utils/config';
import { demoPhotoAlbums } from '../utils/demoData';

// Lists the parish photo albums indexed on the church website.
//
// The site's Photos page has one child page per year, and each of those pages
// is a list of Google Photos shared albums — a cover image, a caption, and a
// link. One WordPress REST call returns every year page with its content, so
// the whole index arrives in a single request and is parsed here. Nothing is
// cached in Supabase; at ~50 albums the response is a few KB gzipped.

// Photon (Jetpack's image CDN) serves the covers and resizes on demand, so the
// grid can ask for thumbnails instead of downloading full-width originals.
const THUMB_WIDTH = 240;

const ALBUM_LINK = /href="(https:\/\/photos\.(?:app\.goo\.gl|google\.com)\/[^"]+)"/;
const IMG_SRC = /<img[^>]*?\ssrc="([^"]+)"/;
const CAPTION = /<figcaption[^>]*>([\s\S]*?)<\/figcaption>/;

// Captions and even URLs come back HTML-escaped — `&amp;` in titles, and
// `&#038;` separating query params in image srcs. `&amp;` is decoded last so
// an escaped entity like `&amp;lt;` doesn't collapse two steps at once.
const decodeEntities = (value) =>
  value
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

const stripTags = (value) => value.replace(/<[^>]+>/g, '');

const clean = (value) => decodeEntities(stripTags(value)).replace(/\s+/g, ' ').trim();

const toThumbnail = (url) => {
  if (!/^https:\/\/i\d\.wp\.com\//.test(url)) return url;
  return `${url.split('?')[0]}?w=${THUMB_WIDTH}&ssl=1`;
};

// Year pages are titled by year; "St. Thomas LI" is an undated collection and
// sorts to the end.
const yearRank = (year) => {
  const parsed = Number.parseInt(year, 10);
  return Number.isNaN(parsed) ? -Infinity : parsed;
};

/**
 * Turn the WordPress page listing into a flat, newest-first album list.
 *
 * Each album is one `<figure>`, so the content is split on that rather than
 * matched with a single expression across the whole page — the markup varies
 * enough between years (some figures are wrapped in a block div, some carry a
 * srcset, some have no link at all) that one regex silently misses pages.
 * A figure without an album link is decoration, not an album, and is dropped.
 */
export const parseAlbums = (pages) => {
  const albums = (pages ?? []).flatMap((page) => {
    const year = clean(page?.title?.rendered ?? '');
    const html = page?.content?.rendered ?? '';

    return html
      .split('<figure')
      .slice(1)
      .flatMap((chunk, index) => {
        const link = chunk.match(ALBUM_LINK);
        if (!link) return [];

        const src = chunk.match(IMG_SRC);
        const caption = chunk.match(CAPTION);
        const title = caption ? clean(caption[1]) : '';

        return [{
          id: `${page.id}-${index}`,
          year,
          // An untitled album still needs a label to tap on
          title: title || year,
          coverUrl: src ? toThumbnail(decodeEntities(src[1])) : null,
          shareUrl: decodeEntities(link[1]),
        }];
      });
  });

  return albums.sort((a, b) => yearRank(b.year) - yearRank(a.year));
};

class PhotosService {
  constructor() {
    this.siteUrl = null;
    this.parentPageId = null;
  }

  setConfig(siteUrl, parentPageId) {
    this.siteUrl = siteUrl;
    this.parentPageId = parentPageId;
  }

  async listAlbums() {
    if (isDemoSession()) {
      await new Promise(resolve => setTimeout(resolve, 300)); // Simulate network delay
      return { data: demoPhotoAlbums, error: null };
    }

    try {
      if (!this.siteUrl || !this.parentPageId) {
        throw new Error('Photos not configured. Add photosSiteUrl and photosParentPageId to Supabase app_settings.');
      }

      const base = this.siteUrl.replace(/\/+$/, '');
      const response = await axios.get(`${base}/wp-json/wp/v2/pages`, {
        params: {
          parent: this.parentPageId,
          per_page: 100,
          // Content is the album list itself, so it has to come along
          _fields: 'id,title,content',
        },
      });

      return { data: parseAlbums(response.data), error: null };
    } catch {
      return { data: null, error: 'Failed to load photo albums. Please try again.' };
    }
  }
}

export default new PhotosService();
