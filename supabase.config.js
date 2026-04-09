import { createClient } from '@supabase/supabase-js';

// Credentials are loaded from .env (EXPO_PUBLIC_ prefix makes them available in the app bundle)
// Never hardcode these values here — keep them in .env which is gitignored
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

let supabase = null;

if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

export { supabase };
export default supabase;
