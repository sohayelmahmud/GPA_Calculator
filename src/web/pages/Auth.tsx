import { useState, type FormEvent } from 'react';
import { formatRollInput, isValidRoll, normalizeRoll, ROLL_ERROR_MSG } from '../../shared/rollValidation';
import { clearGuestData, hasGuestData, loadGuestData } from '@/hooks/useData';

export interface AuthUser {
  id: string;
  name: string;
  roll: string;
}

interface Props {
  onAuthenticated: (user: AuthUser) => void;
}

export default function Auth({ onAuthenticated }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [roll, setRoll] = useState('');
  const [password, setPassword] = useState('');
  const [syncGuest, setSyncGuest] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const guestHasData = hasGuestData();

  const switchMode = (nextMode: 'login' | 'register') => {
    setMode(nextMode);
    setError('');
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    const cleanRoll = normalizeRoll(roll);
    if (!cleanRoll || !password) {
      setError('Please complete all required fields.');
      return;
    }
    if (mode === 'register') {
      if (!name.trim()) {
        setError('Please enter your full name.');
        return;
      }
      if (!isValidRoll(cleanRoll)) {
        setError(ROLL_ERROR_MSG);
        return;
      }
      if (password.length < 4) {
        setError('Password must be at least 4 characters.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const body =
        mode === 'register'
          ? { name: name.trim(), roll: cleanRoll, password }
          : { roll: cleanRoll, password };
      const response = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = (await response.json().catch(() => null)) as {
        user?: AuthUser;
        error?: string;
      } | null;
      if (!response.ok || !result?.user) {
        throw new Error(result?.error || 'Authentication failed');
      }

      // Sync local guest data only if creating a new account and user opted in
      if (mode === 'register' && hasGuestData()) {
        if (syncGuest) {
          const guest = loadGuestData();
          await fetch('/api/sync-guest', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              semesters: guest.semesters,
              courses: guest.courses,
              marks: guest.marks,
              previousSemesters: guest.previousSemesters,
              gradeScale: guest.gradeScale.map(({ min_percent, grade_point, letter }) => ({
                min_percent,
                grade_point,
                letter,
              })),
            }),
          }).catch(() => undefined);
        }
        clearGuestData();
      }

      onAuthenticated(result.user);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Authentication failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center py-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <h1 className="text-xl font-bold text-gray-900">
          {mode === 'login' ? 'Welcome back' : 'Save your progress'}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {mode === 'login'
            ? 'Sign in to load your saved cloud data'
            : 'Create an account to sync and access your GPA across devices'}
        </p>

        {guestHasData && (
          <div className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
            {mode === 'register' ? (
              <label className="flex cursor-pointer items-start gap-2">
                <input
                  type="checkbox"
                  checked={syncGuest}
                  onChange={(e) => setSyncGuest(e.target.checked)}
                  className="mt-0.5 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>
                  Sync my current guest semesters & courses to this new account (uncheck to start fresh)
                </span>
              </label>
            ) : (
              'Logging in will load your cloud account data. Want to keep your current guest data? Switch to Create Account.'
            )}
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 rounded-lg bg-gray-100 p-1 text-sm">
          <button
            type="button"
            onClick={() => switchMode('login')}
            className={`rounded-md px-3 py-2 font-medium transition ${mode === 'login' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'
              }`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => switchMode('register')}
            className={`rounded-md px-3 py-2 font-medium transition ${mode === 'register' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'
              }`}
          >
            Create Account
          </button>
        </div>

        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          {mode === 'register' && (
            <label className="block text-sm text-gray-700">
              <span>Full Name</span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                autoComplete="name"
              />
            </label>
          )}
          <label className="block text-sm text-gray-700">
            <span>Roll Number</span>
            <input
              type="text"
              value={roll}
              maxLength={12}
              placeholder="SP26-BCS-114"
              onChange={(event) => setRoll((prev) => formatRollInput(event.target.value, prev))}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 uppercase focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              autoComplete="username"
            />
          </label>
          <label className="block text-sm text-gray-700">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </label>
          {mode === 'register' && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Please remember or save your password securely — password recovery isn't available since we don't store any email or personal contact details.
            </p>
          )}
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting
              ? 'Please wait...'
              : mode === 'login'
                ? 'Login'
                : guestHasData && syncGuest
                  ? 'Create Account & Sync'
                  : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
}