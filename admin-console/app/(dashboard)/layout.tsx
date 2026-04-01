'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { createBrowserSupabase } from '@/lib/supabase';

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

const navItems = [
  { href: '/',               label: 'Dashboard',      icon: '⊞' },
  { href: '/families',       label: 'Families',        icon: '🏠' },
  { href: '/members',        label: 'Members',         icon: '👤' },
  { href: '/contributions',  label: 'Contributions',   icon: '💰' },
  { href: '/users',          label: 'Users & Roles',   icon: '🔑' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createBrowserSupabase();
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-56 bg-[#C8102E] flex flex-col shrink-0 shadow-lg">
        <div className="px-5 py-5 border-b border-white/10 flex flex-col items-center gap-3">
          <Image src="/logo.png" alt="St. Thomas logo" width={56} height={55} style={{ height: 'auto' }} className="rounded-xl" />
          <div className="text-center">
            <div className="text-white font-bold text-xs leading-snug">St. Thomas Malankara Orthodox Church</div>
            <div className="text-white/60 text-xs mt-0.5">Admin Console</div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map(item => {
            const active = item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors border-l-2 ${
                  active
                    ? 'bg-white/15 text-[#C9A227] border-[#C9A227]'
                    : 'text-white/70 hover:bg-white/10 hover:text-white border-transparent'
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-white/10">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors w-full"
          >
            <span>↩</span>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto flex flex-col">
        {DEMO_MODE && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-700 font-medium text-center shrink-0">
            Demo Mode — sample data only, changes are not saved
          </div>
        )}
        <div className="flex-1">
          {children}
        </div>
      </main>
    </div>
  );
}
