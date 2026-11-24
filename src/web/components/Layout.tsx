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
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-[clamp(4px,1.5vw,12px)] px-[clamp(8px,3vw,16px)]">
          <div className="flex min-w-0 items-center gap-[clamp(4px,1.2vw,8px)]">
            <Link
              to="/"
              className="whitespace-nowrap font-bold text-indigo-600 text-[clamp(13px,3.8vw,18px)]"
            >
              GPA Calculator
            </Link>
            {!user && (
              <span className="whitespace-nowrap rounded-full border border-amber-200 bg-amber-50 px-[clamp(5px,1.5vw,8px)] py-0.5 font-medium text-amber-700 text-[clamp(9px,2.4vw,11px)]">
                Guest<span className="hidden min-[380px]:inline"> Mode</span>
              </span>
            )}
          </div>
          <nav className="flex shrink-0 items-center gap-[clamp(6px,2.5vw,16px)] font-medium text-[clamp(11px,3vw,14px)]">
            <Link
              to="/"
              className={`whitespace-nowrap transition hover:text-indigo-600 ${location.pathname === '/' ? 'text-indigo-600' : 'text-gray-500'
                }`}
            >
              Dashboard
            </Link>
            <Link
              to="/profile"
              aria-label={user ? 'Profile' : 'Settings'}
              className={`flex items-center transition hover:text-indigo-600 ${location.pathname === '/profile' ? 'text-indigo-600' : 'text-gray-500'
                }`}
            >
              {user ? (
                'Profile'
              ) : (
                <>
                  <span className="hidden sm:inline">Settings</span>
                  <svg
                    className="h-5 w-5 sm:hidden"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </>
              )}
            </Link>
            {!user && (
              <Link
                to="/auth"
                className="whitespace-nowrap rounded-lg bg-indigo-600 px-[clamp(8px,2.2vw,12px)] py-1.5 font-medium text-white transition hover:bg-indigo-700 text-[clamp(10px,2.8vw,12px)]"
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