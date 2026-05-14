alter table app_settings
  add column if not exists enable_meal_signup boolean default false;
