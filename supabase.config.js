import { createClient } from '@supabase/supabase-js';

// TODO: Replace with your Supabase project credentials
// Get these from: Supabase Dashboard → Project Settings → API
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

let supabase = null;

if (SUPABASE_URL !== 'YOUR_SUPABASE_URL') {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

export { supabase };
export default supabase;
