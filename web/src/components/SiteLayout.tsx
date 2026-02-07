import Link from 'next/link';
import { ReactNode } from 'react';

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/app', label: 'App' },
  { href: '/about', label: 'About' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
];

interface SiteLayoutProps {
  children: ReactNode;
  currentUser?: { id: string; handle: string; email?: string } | null;
  onLogout?: () => void;
}

export default function SiteLayout({ children, currentUser, onLogout }: SiteLayoutProps) {
  return (
    <div className="min-h-screen bg-[#050914] text-white">
      <header className="sticky top-0 z-20 backdrop-blur-md bg-black/40 border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            Turf
          </Link>
          <nav className="flex items-center gap-4 text-sm text-slate-200">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-neon transition">
                {link.label}
              </Link>
            ))}
            {currentUser ? (
              <div className="flex items-center gap-3 pl-3 border-l border-white/20">
                <Link
                  href={`/profile/${currentUser.id}`}
                  className="text-sm text-slate-300 hover:text-neon transition font-medium"
                >
                  {currentUser.handle}
                </Link>
                <button
                  onClick={onLogout}
                  className="px-3 py-1 rounded-lg bg-red-500/20 border border-red-500/50 text-red-200 hover:bg-red-500/30 transition text-sm font-semibold"
                >
                  Logout
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="px-3 py-1 rounded-lg border border-neon text-neon hover:bg-neon/10 transition"
              >
                Login
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4">{children}</main>
      <footer className="border-t border-white/10 text-sm text-slate-400 py-6 mt-10">
        <div className="max-w-6xl mx-auto px-4 flex justify-between">
          <span>© {new Date().getFullYear()} Turf. All rights reserved.</span>
          <div className="flex gap-4">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
