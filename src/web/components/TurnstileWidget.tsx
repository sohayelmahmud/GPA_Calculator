import { useEffect, useRef } from 'react';

interface TurnstileWidgetProps {
    onVerify: (token: string) => void;
    onExpire?: () => void;
}

declare global {
    interface Window {
        turnstile?: {
            render: (
                container: HTMLElement,
                options: {
                    sitekey: string;
                    callback: (token: string) => void;
                    'expired-callback'?: () => void;
                    'error-callback'?: () => void;
                    theme?: 'light' | 'dark' | 'auto';
                },
            ) => string;
            remove: (widgetId: string) => void;
        };
    }
}

export default function TurnstileWidget({ onVerify, onExpire }: TurnstileWidgetProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);
    const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;

    useEffect(() => {
        if (!siteKey || !containerRef.current) return;

        let cancelled = false;

        const renderWidget = () => {
            if (cancelled || !containerRef.current || !window.turnstile) return;
            if (widgetIdRef.current) {
                window.turnstile.remove(widgetIdRef.current);
            }
            widgetIdRef.current = window.turnstile.render(containerRef.current, {
                sitekey: siteKey,
                theme: 'light',
                callback: (token: string) => onVerify(token),
                'expired-callback': () => onExpire?.(),
                'error-callback': () => onExpire?.(),
            });
        };

        if (window.turnstile) {
            renderWidget();
        } else {
            const interval = setInterval(() => {
                if (window.turnstile) {
                    clearInterval(interval);
                    renderWidget();
                }
            }, 150);
            return () => {
                cancelled = true;
                clearInterval(interval);
                if (widgetIdRef.current && window.turnstile) {
                    window.turnstile.remove(widgetIdRef.current);
                    widgetIdRef.current = null;
                }
            };
        }

        return () => {
            cancelled = true;
            if (widgetIdRef.current && window.turnstile) {
                window.turnstile.remove(widgetIdRef.current);
                widgetIdRef.current = null;
            }
        };
    }, [siteKey, onVerify, onExpire]);

    if (!siteKey) return null;

    return <div ref={containerRef} className="my-2 min-h-[65px]" />;
}