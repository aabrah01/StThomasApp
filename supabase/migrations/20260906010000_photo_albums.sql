-- Photo albums feature.
-- Albums are Google Photos shared albums, indexed on the church website: the
-- site's Photos page has one child page per year, and each of those lists the
-- year's albums as a cover image, a caption and a link. The mobile app reads
-- that index straight from the site's WordPress REST API, so nothing is stored
-- here beyond where to look and whether members can see the feature.

alter table app_settings
  add column if not exists enable_photos boolean default false;

alter table app_settings
  add column if not exists photos_site_url text;

-- WordPress page id of the parent "Photos" page whose children are the years.
alter table app_settings
  add column if not exists photos_parent_page_id text;
