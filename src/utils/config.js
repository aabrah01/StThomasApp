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

// Demo account for App Store / Play Store review.
// This email bypasses OTP in the production build and shows only fake data.
// Provide these credentials in the App Store Connect "Notes for App Review" field.
export const DEMO_EMAIL = 'demo@stthomasli.org';
export const DEMO_PIN = '123456';

// Runtime session flag — set by authService when the demo user logs in/out.
// isDemoSession() returns true for both the compile-time DEMO_MODE and a live demo login.
let _isDemoSession = false;
export const setDemoSession = (active) => { _isDemoSession = active; };
export const isDemoSession = () => _isDemoSession || DEMO_MODE;
