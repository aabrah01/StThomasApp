'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { createBrowserSupabase } from '@/lib/supabase';

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

// Google "G" logo SVG — used in the Sign in with Google button
const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
    <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
    <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
    <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
    <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"/>
  </svg>
);

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const unauthorized = searchParams.get('error') === 'unauthorized';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    const supabase = createBrowserSupabase();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });
    if (oauthError) {
      setError('Google sign-in failed. Please try again.');
      setLoading(false);
    }
    // On success: browser is redirected to Google → then back to /api/auth/callback
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const supabase = createBrowserSupabase();
    const { data: { user }, error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError('Invalid email or password.');
      setLoading(false);
      return;
    }

    // Verify admin role before allowing access
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user!.id)
      .single();

    if (!roleData || roleData.role !== 'admin') {
      await supabase.auth.signOut();
      setError('Access denied. Admin role required.');
      setLoading(false);
      return;
    }

    router.push('/');
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-md p-8">
        <div className="text-center mb-8">
          <Image src="/logo.png" alt="St. Thomas logo" width={72} height={72} loading="eager" className="mx-auto mb-4 rounded-2xl" />
          <h1 className="text-2xl font-bold text-gray-900">Admin Console</h1>
          <p className="text-gray-500 text-sm mt-1">St. Thomas Malankara Orthodox Church</p>
        </div>

        {DEMO_MODE && (
          <div className="mb-6">
            <button
              onClick={() => router.push('/')}
              className="w-full bg-emerald-600 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-emerald-700 transition-colors"
            >
              Enter Demo Mode
            </button>
            <p className="text-center text-xs text-gray-400 mt-2">No login required — uses sample data</p>
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400">or sign in with Supabase</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
          </div>
        )}

        {unauthorized && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-4">
            Access denied. Admin role required.
          </div>
        )}

        {/* Google OAuth — for admins with Google Workspace accounts */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 border border-gray-300 rounded-lg py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-60 mb-4"
        >
          <GoogleIcon />
          Sign in with Google
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400">or sign in with password</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7E282F] focus:border-transparent"
              placeholder="admin@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7E282F] focus:border-transparent pr-10"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-red-600 text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#7E282F] text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-[#6B2228] transition-colors disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
