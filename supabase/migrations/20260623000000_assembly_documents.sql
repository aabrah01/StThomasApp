-- Assembly documents feature.
-- PDFs live in a link-shared Google Drive folder (not stored in Supabase).
-- These settings tell the mobile app which folder to list and whether the
-- feature is visible to members. The Drive folder id is read by the app
-- alongside the existing google_api_key.

alter table app_settings
  add column if not exists enable_documents boolean default false;

alter table app_settings
  add column if not exists assembly_docs_folder_id text;
