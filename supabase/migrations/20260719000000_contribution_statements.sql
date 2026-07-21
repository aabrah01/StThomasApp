-- Contribution statement PDFs: admin-editable intro/closing paragraphs
-- and a per-category "requested amount" (e.g. pledge targets).

alter table contribution_settings
  add column intro_paragraph   text,
  add column closing_paragraph text;

create table contribution_category_amounts (
  category         text primary key,
  requested_amount decimal(10,2) not null,
  updated_at       timestamptz default now()
);

alter table contribution_category_amounts enable row level security;

create policy "admins manage contribution_category_amounts"
  on contribution_category_amounts for all
  using (
    exists (select 1 from user_roles where user_id = auth.uid() and role = 'admin')
  );

create policy "authenticated users read contribution_category_amounts"
  on contribution_category_amounts for select
  using (auth.role() = 'authenticated');
