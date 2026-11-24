import { isValidRoll, normalizeRoll } from '../../shared/rollValidation';
import type { Env } from '../types';

export const STUDENT_EMAIL_DOMAIN = '@isbstudent.comsats.edu.pk';

function toHex(buf: ArrayBuffer | Uint8Array): string {
    const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

function fromHex(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
    }
    return bytes;
}

export async function hashPassword(password: string, saltHex?: string): Promise<{ hash: string; salt: string }> {
    const saltBytes = saltHex ? fromHex(saltHex) : crypto.getRandomValues(new Uint8Array(16));
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(password),
        'PBKDF2',
        false,
        ['deriveBits'],
    );
    const derived = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: saltBytes as BufferSource, iterations: 100_000, hash: 'SHA-256' },
        keyMaterial,
        256,
    );
    return { hash: toHex(derived), salt: toHex(saltBytes) };
}

export async function hashOtp(email: string, otp: string): Promise<string> {
    const data = new TextEncoder().encode(`${email.toLowerCase()}:${otp}`);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return toHex(digest);
}

export function generateOtp(): string {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return String(100000 + (array[0] % 900000));
}

export function extractRollFromEmail(email: string): string | null {
    const lower = email.trim().toLowerCase();
    if (!lower.endsWith(STUDENT_EMAIL_DOMAIN)) return null;
    const prefix = lower.slice(0, -STUDENT_EMAIL_DOMAIN.length);
    const roll = normalizeRoll(prefix);
    return isValidRoll(roll) ? roll : null;
}

export async function sendBrevoOtpEmail(env: Env, toEmail: string, otp: string, purpose: 'register' | 'reset'): Promise<boolean> {
    const subject =
        purpose === 'register'
            ? `${otp} is your COMSATS GPA Calculator verification code`
            : `${otp} is your COMSATS GPA Calculator password reset code`;

    const title = purpose === 'register' ? 'Verify your Student Email' : 'Reset your Password';
    const desc =
        purpose === 'register'
            ? 'Use the verification code below to complete your COMSATS GPA Calculator registration.'
            : 'Use the verification code below to reset your COMSATS GPA Calculator account password.';

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
            accept: 'application/json',
            'api-key': env.BREVO_API_KEY,
            'content-type': 'application/json',
        },
        body: JSON.stringify({
            sender: {
                name: 'COMSATS GPA Calculator',
                email: env.BREVO_SENDER_EMAIL,
            },
            to: [{ email: toEmail }],
            subject,
            htmlContent: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="margin: 0 0 12px; color: #0f172a; font-size: 20px;">${title}</h2>
          <p style="margin: 0 0 20px; color: #475569; font-size: 14px; line-height: 1.5;">${desc}</p>
          <div style="background: #f1f5f9; padding: 16px; border-radius: 8px; text-align: center; letter-spacing: 6px; font-size: 28px; font-weight: 700; color: #0f172a;">
            ${otp}
          </div>
          <p style="margin: 20px 0 0; color: #64748b; font-size: 12px;">This code will expire in 15 minutes. If you did not request this, please ignore this email.</p>
        </div>
      `,
        }),
    });

    return res.ok;
}

export async function verifyTurnstile(secret: string | undefined, token: string | undefined, ip?: string): Promise<boolean> {
    if (!secret) return true;
    if (!token) return false;

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            secret,
            response: token,
            remoteip: ip,
        }),
    }).catch(() => null);

    if (!res || !res.ok) return false;
    const data = (await res.json().catch(() => null)) as { success?: boolean } | null;
    return Boolean(data?.success);
}