'use client';

import { useState } from 'react';
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
  { href: '/meal-signups',   label: 'Meal Signups',    icon: '🍽️' },
  { href: '/flower-signups', label: 'Flower Signups',  icon: '🌸' },
  { href: '/users',          label: 'Users & Roles',   icon: '🔑' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    const supabase = createBrowserSupabase();
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Backdrop for mobile drawer */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`w-56 bg-[#7E282F] flex flex-col shrink-0 shadow-lg fixed inset-y-0 left-0 z-40 transform transition-transform duration-200 md:static md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-5 py-5 border-b border-white/10 flex flex-col items-center gap-3">
          <Image src="/logo.png" alt="St. Thomas logo" width={56} height={56} className="rounded-xl" />
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
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors border-l-2 ${
                  active
                    ? 'bg-white/15 text-white border-[#A83A42]'
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
      <main className="flex-1 overflow-auto flex flex-col min-w-0">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-3 bg-white border-b border-gray-200 px-4 py-3 shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-2xl leading-none text-[#7E282F]"
            aria-label="Open menu"
          >
            ☰
          </button>
          <span className="font-bold text-sm text-gray-800">St. Thomas Admin Console</span>
        </div>

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
