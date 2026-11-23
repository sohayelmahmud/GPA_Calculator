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
    <div className="flex min-h-screen flex-col bg-gray-50 text-gray-900">
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Link to="/" className="text-lg font-bold text-indigo-600">
              GPA Calculator
            </Link>
            {!user && (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                Guest Mode
              </span>
            )}
          </div>
          <nav className="flex items-center gap-4 text-sm font-medium">
            <Link
              to="/"
              className={`transition hover:text-indigo-600 ${location.pathname === '/' ? 'text-indigo-600' : 'text-gray-500'
                }`}
            >
              Dashboard
            </Link>
            <Link
              to="/profile"
              className={`transition hover:text-indigo-600 ${location.pathname === '/profile' ? 'text-indigo-600' : 'text-gray-500'
                }`}
            >
              {user ? 'Profile' : 'Settings'}
            </Link>
            {!user && (
              <Link
                to="/auth"
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-700"
              >
                Login
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>

      <footer className="mt-12 border-t border-gray-200 bg-white text-gray-600">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            {/* Brand & Brief */}
            <div className="space-y-2">
              <Link to="/" className="text-base font-bold text-indigo-600">
                GPA Calculator
              </Link>
              <p className="max-w-xs text-xs leading-relaxed text-gray-500">
                Track your semester marks, calculate SGPA & CGPA accurately, and plan your academic goals with ease.
              </p>
            </div>

            {/* Navigation */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-900">
                Navigation
              </h3>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <Link to="/" className="text-gray-500 transition hover:text-indigo-600">
                    Dashboard
                  </Link>
                </li>
                <li>
                  <Link to="/profile" className="text-gray-500 transition hover:text-indigo-600">
                    {user ? 'Profile & Grade Scale' : 'Settings & Grade Scale'}
                  </Link>
                </li>
                {!user && (
                  <li>
                    <Link to="/auth" className="text-gray-500 transition hover:text-indigo-600">
                      Student Login / Register
                    </Link>
                  </li>
                )}
              </ul>
            </div>

            {/* Legal & Policies */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-900">
                Legal & Support
              </h3>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <Link to="/contact" className="text-gray-500 transition hover:text-indigo-600">
                    Contact Us
                  </Link>
                </li>
                <li>
                  <Link to="/privacy" className="text-gray-500 transition hover:text-indigo-600">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link to="/terms" className="text-gray-500 transition hover:text-indigo-600">
                    Terms & Conditions
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="mt-8 flex flex-col items-center justify-between gap-2 border-t border-gray-100 pt-5 text-center text-xs text-gray-500 sm:flex-row sm:text-left">
            <p>
              © 2026 GPA Calculator. Independent student educational project — not affiliated with official COMSATS administration.
            </p>
            <p className="shrink-0">
              Created by{' '}
              <a
                href="https://sohayel.tech"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-indigo-600 hover:underline"
              >
                Sohayel Mahmud
              </a>
              .
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}