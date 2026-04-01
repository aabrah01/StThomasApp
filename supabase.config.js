import { createClient } from '@supabase/supabase-js';

// TODO: Replace with your Supabase project credentials
// Get these from: Supabase Dashboard → Project Settings → API
const SUPABASE_URL = 'https://fbiyvvhnvfzsolfejlbz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiaXl2dmhudmZ6c29sZmVqbGJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1OTA3MzMsImV4cCI6MjA5MDE2NjczM30.n3FeKIs7KAf7So1nc4Qg268SI8E0aYP9N5wzzaxy0mo';

let supabase = null;

if (SUPABASE_URL !== 'YOUR_SUPABASE_URL') {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

export { supabase };
export default supabase;
