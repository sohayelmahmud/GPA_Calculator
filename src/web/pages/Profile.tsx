import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { AppData, GradeScaleEntry } from '@shared/types';
import type { AuthUser } from '@/pages/Auth';

interface Props {
  data: AppData;
  updateGradeScale: (scale: Omit<GradeScaleEntry, 'id' | 'user_id'>[]) => void;
  resetGradeScale: () => void;
  resetData: () => void;
  user: AuthUser | null;
  onLogout: () => void;
}

export default function Profile({
  data,
  updateGradeScale,
  resetGradeScale,
  resetData,
  user,
  onLogout,
}: Props) {
  const [scale, setScale] = useState(data.gradeScale);
  const [scaleSaved, setScaleSaved] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

  useEffect(() => {
    setScale(data.gradeScale);
  }, [data.gradeScale]);

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordSaved(false);
    setPasswordError('');

    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordError('Please complete all password fields.');
      return;
    }
    if (passwordForm.newPassword.length < 4) {
      setPasswordError('New password must be at least 4 characters.');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    setPasswordSubmitting(true);
    try {
      const response = await fetch('/api/auth/password', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error || 'Unable to update password');

      setPasswordSaved(true);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (requestError) {
      setPasswordError(requestError instanceof Error ? requestError.message : 'Unable to update password');
    } finally {
      setPasswordSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
    } finally {
      onLogout();
    }
  };

  const handleExport = async () => {
    try {
      let exportedData: unknown;
      if (user) {
        const response = await fetch('/api/export', { credentials: 'include' });
        if (!response.ok) throw new Error('Unable to export data');
        exportedData = await response.json();
      } else {
        exportedData = {
          exportedAt: new Date().toISOString(),
          mode: 'guest',
          ...data,
        };
      }
      const blob = new Blob([JSON.stringify(exportedData, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'gpa-data.json';
      link.click();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      setPasswordError(requestError instanceof Error ? requestError.message : 'Unable to export data');
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirm('Delete your account and all saved data? This cannot be undone.')) return;
    try {
      const response = await fetch('/api/account', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Unable to delete account');
      resetData();
      onLogout();
    } catch (requestError) {
      setPasswordError(requestError instanceof Error ? requestError.message : 'Unable to delete account');
    }
  };

  const handleClearGuestData = () => {
    if (!confirm('Clear all local guest data on this browser? This cannot be undone.')) return;
    resetData();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{user ? 'Profile' : 'Settings'}</h1>
        {user ? (
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-1.5 text-sm font-medium text-red-600 hover:bg-red-100"
          >
            Logout
          </button>
        ) : (
          <Link
            to="/auth"
            className="rounded-lg bg-indigo-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Login / Create Account
          </Link>
        )}
      </div>

      {user ? (
        <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
          <h2 className="font-semibold text-gray-900">Profile information</h2>
          <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg bg-gray-50 px-4 py-3">
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Name</dt>
              <dd className="mt-1 font-medium text-gray-900">{user.name}</dd>
            </div>
            <div className="rounded-lg bg-gray-50 px-4 py-3">
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Roll Number</dt>
              <dd className="mt-1 font-medium text-gray-900">{user.roll}</dd>
            </div>
          </dl>

          <form className="mt-6 space-y-4" onSubmit={handlePasswordSubmit} noValidate>
            <h3 className="font-semibold text-gray-900">Change Password</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="space-y-1 text-sm text-gray-700">
                <span>Current Password</span>
                <input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(event) => {
                    setPasswordForm((form) => ({ ...form, currentPassword: event.target.value }));
                    setPasswordSaved(false);
                  }}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  autoComplete="current-password"
                />
              </label>
              <label className="space-y-1 text-sm text-gray-700">
                <span>New Password</span>
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(event) => {
                    setPasswordForm((form) => ({ ...form, newPassword: event.target.value }));
                    setPasswordSaved(false);
                  }}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  autoComplete="new-password"
                />
              </label>
              <label className="space-y-1 text-sm text-gray-700">
                <span>Confirm New Password</span>
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(event) => {
                    setPasswordForm((form) => ({ ...form, confirmPassword: event.target.value }));
                    setPasswordSaved(false);
                  }}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  autoComplete="new-password"
                />
              </label>
            </div>
            {passwordError && (
              <p className="text-sm text-red-600" role="alert">
                {passwordError}
              </p>
            )}
            {passwordSaved && (
              <p className="text-sm text-green-600" role="status">
                Password updated successfully.
              </p>
            )}
            <button
              type="submit"
              disabled={passwordSubmitting}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {passwordSubmitting ? 'Saving...' : 'Save'}
            </button>
          </form>
        </section>
      ) : (
        <section className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 sm:p-5">
          <h2 className="font-semibold text-amber-900">You are using Guest Mode</h2>
          <p className="mt-1 text-sm text-amber-800">
            Your semesters and marks are currently saved only in this browser. Create an account to
            back them up to the cloud and access them from any device.
          </p>
        </section>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-gray-900">Grading Scale</h2>
          <button
            type="button"
            onClick={() => {
              resetGradeScale();
              setScaleSaved(false);
            }}
            className="text-xs font-medium text-gray-500 hover:text-indigo-600"
          >
            Reset to Default
          </button>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-1.5 text-[10px] font-medium uppercase tracking-wide text-gray-500 sm:gap-2 sm:text-xs">
          <span className="min-w-0">Minimum %</span>
          <span className="min-w-0">Grade point</span>
          <span className="min-w-0">Letter grade</span>
        </div>
        <div className="mt-2 space-y-1.5 sm:space-y-2">
          {scale.map((entry, index) => (
            <div className="grid w-full grid-cols-3 gap-1.5 sm:gap-2" key={entry.id}>
              <input
                id={`min-${entry.id}`}
                className="min-w-0 w-full rounded-lg border border-gray-300 px-1.5 py-2 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:px-3 sm:text-sm"
                type="number"
                value={entry.min_percent}
                onChange={(event) => {
                  setScaleSaved(false);
                  setScale((items) =>
                    items.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, min_percent: Number(event.target.value) }
                        : item,
                    ),
                  );
                }}
              />
              <input
                id={`point-${entry.id}`}
                className="min-w-0 w-full rounded-lg border border-gray-300 px-1.5 py-2 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:px-3 sm:text-sm"
                type="number"
                step="0.01"
                value={entry.grade_point}
                onChange={(event) => {
                  setScaleSaved(false);
                  setScale((items) =>
                    items.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, grade_point: Number(event.target.value) }
                        : item,
                    ),
                  );
                }}
              />
              <input
                id={`letter-${entry.id}`}
                className="min-w-0 w-full rounded-lg border border-gray-300 px-1.5 py-2 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:px-3 sm:text-sm"
                value={entry.letter}
                onChange={(event) => {
                  setScaleSaved(false);
                  setScale((items) =>
                    items.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, letter: event.target.value } : item,
                    ),
                  );
                }}
              />
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            onClick={() => {
              updateGradeScale(
                scale.map(({ min_percent, grade_point, letter }) => ({
                  min_percent,
                  grade_point,
                  letter,
                })),
              );
              setScaleSaved(true);
            }}
          >
            Save scale
          </button>
          {scaleSaved && <span className="text-sm text-green-600">Saved!</span>}
        </div>
      </section>

      <section className="flex flex-wrap gap-4 pt-1">
        <button
          type="button"
          className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
          onClick={handleExport}
        >
          Export data
        </button>
        {user ? (
          <button
            type="button"
            className="text-sm font-medium text-red-600 hover:text-red-700"
            onClick={handleDeleteAccount}
          >
            Delete account
          </button>
        ) : (
          <button
            type="button"
            className="text-sm font-medium text-red-600 hover:text-red-700"
            onClick={handleClearGuestData}
          >
            Clear local guest data
          </button>
        )}
      </section>
    </div>
  );
}