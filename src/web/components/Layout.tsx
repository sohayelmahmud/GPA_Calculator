import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';

export default function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <Link to="/" className="text-lg font-bold text-indigo-600">
            GPA Calculator
          </Link>
          <nav className="flex gap-4 text-sm font-medium">
            <Link
              to="/"
              className={`hover:text-indigo-600 transition ${
                location.pathname === '/' ? 'text-indigo-600' : 'text-gray-500'
              }`}
            >
              Dashboard
            </Link>
            <Link
              to="/settings"
              className={`hover:text-indigo-600 transition ${
                location.pathname === '/settings' ? 'text-indigo-600' : 'text-gray-500'
              }`}
            >
              Settings
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
