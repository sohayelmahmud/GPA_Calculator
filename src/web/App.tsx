import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useData, clearGuestData, clearUserOfflineData } from '@/hooks/useData';
import Layout from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import Profile from '@/pages/Profile';
import Auth, { type AuthUser } from '@/pages/Auth';

const CACHED_USER_KEY = 'gpa_calc_auth_user_v1';

function loadCachedUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(CACHED_USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(() => loadCachedUser());
  const [authLoading, setAuthLoading] = useState(() => !loadCachedUser());
  const dataHook = useData(user?.id ?? null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/me', { credentials: 'include' })
      .then(async (response) => {
        if (response.status === 401) return null;
        if (!response.ok) throw new Error('Unable to check session');
        const result = (await response.json()) as { user: AuthUser };
        return result.user;
      })
      .then((authenticatedUser) => {
        if (cancelled) return;
        setUser(authenticatedUser);
        if (authenticatedUser) {
          localStorage.setItem(CACHED_USER_KEY, JSON.stringify(authenticatedUser));
        } else {
          localStorage.removeItem(CACHED_USER_KEY);
        }
      })
      .catch(() => {
        // Offline or network error: keep cached user session if available
        if (!cancelled) {
          setUser((prev) => prev ?? loadCachedUser());
        }
      })
      .finally(() => {
        if (!cancelled) setAuthLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleAuthenticated = (authenticatedUser: AuthUser) => {
    localStorage.setItem(CACHED_USER_KEY, JSON.stringify(authenticatedUser));
    setUser(authenticatedUser);
    navigate('/', { replace: true });
  };

  const handleLogout = () => {
    if (user?.id) clearUserOfflineData(user.id);
    localStorage.removeItem(CACHED_USER_KEY);
    clearGuestData();
    setUser(null);
    navigate('/', { replace: true });
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"
          aria-label="Loading"
        />
      </div>
    );
  }

  return (
    <Layout user={user}>
      <Routes>
        <Route path="/" element={<Dashboard {...dataHook} />} />
        <Route
          path="/profile"
          element={<Profile {...dataHook} user={user} onLogout={handleLogout} />}
        />
        <Route
          path="/auth"
          element={
            user ? (
              <Navigate to="/" replace />
            ) : (
              <Auth onAuthenticated={handleAuthenticated} />
            )
          }
        />
        <Route path="/settings" element={<Navigate to="/profile" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}