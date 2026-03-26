import { createClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Browser client — used in Client Components
export const createBrowserSupabase = () =>
  createBrowserClient(supabaseUrl, supabaseAnonKey);

// Service-role client — ONLY used in Server Actions / Route Handlers (never sent to browser)
export const createAdminSupabase = () =>
  createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
