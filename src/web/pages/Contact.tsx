import { useState, useEffect, useCallback, type FormEvent } from 'react';
import type { AuthUser } from '@/pages/Auth';
import TurnstileWidget from '@/components/TurnstileWidget';

export default function Contact({ user }: { user: AuthUser | null }) {
    const [name, setName] = useState(user?.name ?? '');
    const [email, setEmail] = useState(user?.email ?? '');
    const [message, setMessage] = useState('');
    const [turnstileToken, setTurnstileToken] = useState('');
    const [widgetKey, setWidgetKey] = useState(0);
    const [honeypot, setHoneypot] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const hasSiteKey = Boolean(import.meta.env.VITE_TURNSTILE_SITE_KEY);

    useEffect(() => {
        if (user) {
            setName((prev) => prev || user.name);
            setEmail((prev) => prev || user.email || '');
        }
    }, [user]);

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

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setStatus(null);

        if (hasSiteKey && !turnstileToken) {
            setStatus({
                type: 'error',
                text: 'Please wait for the security check to complete.',
            });
            return;
        }

        setSubmitting(true);

        try {
            const res = await fetch('/api/contact', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, message, turnstileToken, company_url: honeypot }),
            });
            const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;

            if (!res.ok || !data?.ok) {
                throw new Error(data?.error || 'Failed to send message.');
            }

            setMessage('');
            setStatus({
                type: 'success',
                text: 'Message sent! Thank you for reaching out — I will review it shortly.',
            });
        } catch (err) {
            setStatus({
                type: 'error',
                text: err instanceof Error ? err.message : 'Something went wrong. Please try again.',
            });
        } finally {
            setSubmitting(false);
            if (hasSiteKey) resetTurnstile();
        }
    };

    return (
        <div className="mx-auto max-w-2xl py-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
                <h1 className="text-2xl font-bold text-gray-900">Contact the Developer</h1>
                <p className="mt-1.5 text-sm text-gray-500">
                    Need help, found a calculation bug, want to suggest a feature or want to report an issue? Send a quick note using your student or personal email.
                </p>

                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
                    <label className="block text-sm font-medium text-gray-700">
                        <span>Name</span>
                        <input
                            type="text"
                            required
                            maxLength={100}
                            value={name}
                            placeholder="Your Name"
                            onChange={(e) => setName(e.target.value)}
                            className="mt-1 block w-full rounded-lg border border-gray-300 bg-gray-50/50 px-3.5 py-2.5 text-sm text-gray-900 transition focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                    </label>

                    <label className="block text-sm font-medium text-gray-700">
                        <span>Email</span>
                        <input
                            type="email"
                            required
                            maxLength={150}
                            value={email}
                            placeholder="you@example.com"
                            onChange={(e) => setEmail(e.target.value)}
                            className="mt-1 block w-full rounded-lg border border-gray-300 bg-gray-50/50 px-3.5 py-2.5 text-sm text-gray-900 transition focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                    </label>

                    <label className="block text-sm font-medium text-gray-700">
                        <span>Message</span>
                        <textarea
                            required
                            rows={5}
                            minLength={5}
                            maxLength={2000}
                            value={message}
                            placeholder="How can I help?"
                            onChange={(e) => setMessage(e.target.value)}
                            className="mt-1 block w-full rounded-lg border border-gray-300 bg-gray-50/50 px-3.5 py-2.5 text-sm text-gray-900 transition focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                    </label>

                    <TurnstileWidget key={widgetKey} onVerify={handleVerify} onExpire={handleExpire} />

                    {status && (
                        <p
                            className={`rounded-lg px-3.5 py-2.5 text-xs ${status.type === 'success'
                                    ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
                                    : 'border border-red-200 bg-red-50 text-red-700'
                                }`}
                        >
                            {status.text}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={submitting || (hasSiteKey && !turnstileToken)}
                        className="rounded-full bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {submitting ? 'Sending...' : 'Send Message'}
                    </button>
                </form>
            </div>
        </div>
    );
}