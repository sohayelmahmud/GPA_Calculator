import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { AuthUser } from '@/pages/Auth';

export default function Layout({
  children,
  user,
}: {
  children: ReactNode;
  user: AuthUser | null;
}) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Link to="/" className="text-lg font-bold text-indigo-600">
              GPA Calculator
            </Link>
            {!user && (
              <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                Guest Mode
              </span>
            )}
          </div>
          <nav className="flex items-center gap-4 text-sm font-medium">
            <Link
              to="/"
              className={`hover:text-indigo-600 transition ${location.pathname === '/' ? 'text-indigo-600' : 'text-gray-500'
                }`}
            >
              Dashboard
            </Link>
            <Link
              to="/profile"
              className={`hover:text-indigo-600 transition ${location.pathname === '/profile' ? 'text-indigo-600' : 'text-gray-500'
                }`}
            >
              {user ? 'Profile' : 'Settings'}
            </Link>
            {!user && (
              <Link
                to="/auth"
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 transition"
              >
                Login
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}