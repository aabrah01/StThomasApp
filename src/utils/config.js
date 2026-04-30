// App configuration

// DEMO_MODE — set to true only for local development/testing.
// NEVER deploy to the App Store or Play Store with DEMO_MODE = true.
// When false, the app connects to your real Supabase backend.
export const DEMO_MODE = false;

// Demo credentials — used only when DEMO_MODE = true.
// These are fake test credentials and do not grant access to any real data.
// They are never sent to Supabase when DEMO_MODE is true.
export const DEMO_CREDENTIALS = {
  email: 'demo@example.com',
  pin: '123456', // demo PIN — only works in DEMO_MODE
};
