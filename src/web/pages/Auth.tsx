import { useEffect, useState, useCallback, type FormEvent } from 'react';
import { formatRollInput, isValidRoll, normalizeRoll } from '../../shared/rollValidation';
import { clearGuestData, hasGuestData, loadGuestData } from '@/hooks/useData';
import TurnstileWidget from '@/components/TurnstileWidget';

export interface AuthUser {
  id: string;
  name: string;
  roll: string;
  email?: string | null;
}

interface Props {
  onAuthenticated: (user: AuthUser) => void;
}

const STUDENT_EMAIL_DOMAIN = '@isbstudent.comsats.edu.pk';

function extractPreviewRoll(email: string): string | null {
  const lower = email.trim().toLowerCase();
  if (!lower.endsWith(STUDENT_EMAIL_DOMAIN)) return null;
  const prefix = lower.slice(0, -STUDENT_EMAIL_DOMAIN.length);
  const roll = normalizeRoll(prefix);
  return isValidRoll(roll) ? roll : null;
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  ) : (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

export default function Auth({ onAuthenticated }: Props) {
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
  const [identifier, setIdentifier] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [syncGuest, setSyncGuest] = useState(true);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [widgetKey, setWidgetKey] = useState(0);
  const [honeypot, setHoneypot] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const guestHasData = hasGuestData();
  const detectedRoll = extractPreviewRoll(email);
  const hasSiteKey = Boolean(import.meta.env.VITE_TURNSTILE_SITE_KEY);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleVerify = useCallback((token: string) => {
    setTurnstileToken(token);
  }, []);

  const handleExpire = useCallback(() => {
    setTurnstileToken('');
  }, []);

  const resetTurnstile = () => {
    setTurnstileToken('');
    setWidgetKey((prev) => prev + 1);
  };

  const switchMode = (nextMode: 'login' | 'register' | 'reset') => {
    setMode(nextMode);
    setError('');
    setInfo('');
    setOtp('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setOtpSent(false);
    resetTurnstile();
  };

  const handleIdentifierChange = (val: string) => {
    if (val.includes('@')) {
      setIdentifier(val.trim());
    } else {
      setIdentifier((prev) => formatRollInput(val, prev));
    }
  };

  const handleSendOtp = async () => {
    setError('');
    setInfo('');

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError('Please enter your official CUI student email first.');
      return;
    }
    if (!extractPreviewRoll(cleanEmail)) {
      setError(`Please enter a valid student email ending with ${STUDENT_EMAIL_DOMAIN}`);
      return;
    }
    if (hasSiteKey && !turnstileToken) {
      setError('Please wait for the security check to complete.');
      return;
    }

    setSendingOtp(true);
    try {
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          purpose: mode === 'reset' ? 'reset' : 'register',
          turnstileToken,
          company_url: honeypot,
        }),
      });
      const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || 'Failed to send verification code');
      }

      setOtpSent(true);
      setCooldown(60);
      setInfo(`Verification code sent to ${cleanEmail}. University servers may take 1–2 minutes to deliver — check Inbox & Junk/Spam.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send verification code');
    } finally {
      setSendingOtp(false);
      if (hasSiteKey) resetTurnstile();
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setInfo('');

    if (mode === 'login') {
      const cleanId = identifier.trim();
      if (!cleanId || !password) {
        setError('Please enter your student email or roll number and password.');
        return;
      }

      setSubmitting(true);
      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: cleanId, password }),
        });
        const result = (await response.json().catch(() => null)) as {
          user?: AuthUser;
          error?: string;
        } | null;
        if (!response.ok || !result?.user) {
          throw new Error(result?.error || 'Login failed');
        }
        onAuthenticated(result.user);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Login failed');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!extractPreviewRoll(cleanEmail)) {
      setError(`Please use your official CUI student email (${STUDENT_EMAIL_DOMAIN}).`);
      return;
    }
    if (otp.trim().length !== 6) {
      setError('Please enter the 6-digit verification code sent to your email.');
      return;
    }
    if (password.length < 4) {
      setError('Password must be at least 4 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (mode === 'register') {
      if (!name.trim()) {
        setError('Please enter your full name.');
        return;
      }

      setSubmitting(true);
      try {
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            email: cleanEmail,
            otp: otp.trim(),
            password,
          }),
        });
        const result = (await response.json().catch(() => null)) as {
          user?: AuthUser;
          error?: string;
        } | null;
        if (!response.ok || !result?.user) {
          throw new Error(result?.error || 'Registration failed');
        }

        if (hasGuestData()) {
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
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Registration failed');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Password reset mode
    setSubmitting(true);
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          otp: otp.trim(),
          newPassword: password,
        }),
      });
      const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || 'Password reset failed');
      }

      setPassword('');
      setConfirmPassword('');
      setOtp('');
      setOtpSent(false);
      setMode('login');
      setIdentifier(cleanEmail);
      setInfo('Password updated successfully! Please sign in with your new password.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password reset failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center py-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <h1 className="text-xl font-bold text-gray-900">
          {mode === 'login'
            ? 'Welcome back'
            : mode === 'register'
              ? 'Save your progress'
              : 'Reset password'}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {mode === 'login'
            ? 'Sign in with your student email or roll number'
            : mode === 'register'
              ? 'Verify your CUI student email to create an account'
              : 'Verify your student email to set a new password'}
        </p>

        {guestHasData && mode !== 'reset' && (
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

        {mode !== 'reset' && (
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
        )}

        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <input
            type="text"
            name="company_url"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            tabIndex={-1}
            autoComplete="new-password"
            aria-hidden="true"
            className="pointer-events-none fixed -left-[9999px] h-0 w-0 opacity-0"
          />
          {mode === 'login' ? (
            <>
              <label className="block text-sm text-gray-700">
                <span>Student Email or Roll Number</span>
                <input
                  type="text"
                  value={identifier}
                  placeholder="SP26-BCS-114 or sp26-bcs-114@isbstudent.comsats.edu.pk"
                  onChange={(event) => handleIdentifierChange(event.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  autoComplete="username"
                />
              </label>
              <div>
                <div className="flex items-center justify-between text-sm text-gray-700">
                  <label htmlFor="login-password">Password</label>
                  <button
                    type="button"
                    onClick={() => switchMode('reset')}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative mt-1">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
                  >
                    <EyeIcon open={showPassword} />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
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

              <div>
                <label className="block text-sm text-gray-700">
                  <span>Official CUI Student Email</span>
                  <div className="mt-1 flex gap-2">
                    <input
                      type="email"
                      value={email}
                      placeholder="sp26-bcs-114@isbstudent.comsats.edu.pk"
                      onChange={(event) => setEmail(event.target.value)}
                      className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      autoComplete="email"
                    />
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={sendingOtp || cooldown > 0 || !detectedRoll || (hasSiteKey && !turnstileToken)}
                      className="shrink-0 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {sendingOtp
                        ? 'Sending...'
                        : cooldown > 0
                          ? `${cooldown}s`
                          : otpSent
                            ? 'Resend'
                            : 'Send OTP'}
                    </button>
                  </div>
                </label>
                {detectedRoll && (
                  <p className="mt-1 text-xs text-emerald-700">
                    Detected Roll Number: <span className="font-semibold">{detectedRoll}</span>
                  </p>
                )}
              </div>

              <TurnstileWidget key={widgetKey} onVerify={handleVerify} onExpire={handleExpire} />

              <label className="block text-sm text-gray-700">
                <span>6-Digit Verification Code</span>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  placeholder="123456"
                  onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 tracking-widest focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  autoComplete="one-time-code"
                />
              </label>

              <div>
                <label htmlFor="auth-password" className="block text-sm text-gray-700">
                  {mode === 'reset' ? 'New Password' : 'Password'}
                </label>
                <div className="relative mt-1">
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
                  >
                    <EyeIcon open={showPassword} />
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="auth-confirm-password" className="block text-sm text-gray-700">
                  {mode === 'reset' ? 'Confirm New Password' : 'Confirm Password'}
                </label>
                <div className="relative mt-1">
                  <input
                    id="auth-confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
                  >
                    <EyeIcon open={showConfirmPassword} />
                  </button>
                </div>
              </div>
            </>
          )}

          {info && (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              {info}
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
                : mode === 'reset'
                  ? 'Reset Password'
                  : guestHasData && syncGuest
                    ? 'Create Account & Sync'
                    : 'Create Account'}
          </button>

          {mode === 'reset' && (
            <button
              type="button"
              onClick={() => switchMode('login')}
              className="w-full text-center text-xs font-medium text-gray-500 hover:text-gray-700"
            >
              Back to Login
            </button>
          )}
        </form>
      </div>
    </div>
  );
}