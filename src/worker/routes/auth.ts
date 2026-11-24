import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { z } from 'zod';
import { normalizeRoll } from '../../shared/rollValidation';
import type { AppContext, UserRow } from '../types';
import {
    STUDENT_EMAIL_DOMAIN,
    extractRollFromEmail,
    generateOtp,
    hashOtp,
    hashPassword,
    sendBrevoOtpEmail,
    verifyTurnstile,
} from '../utils/crypto';

export const authRoutes = new Hono<AppContext>();

type RollRuleCourse = {
    code?: string;
    name: string;
    credits: number;
    has_lab: boolean;
    theory_credits?: number | null;
    lab_credits?: number | null;
    scheme?: {
        theory: Record<string, number>;
        lab?: Record<string, number>;
    };
};

async function ensureRollCourseRulesTable(db: D1Database): Promise<void> {
    await db
        .prepare(
            `CREATE TABLE IF NOT EXISTS roll_course_rules (
                id TEXT PRIMARY KEY,
                roll_prefix TEXT NOT NULL,
                semester_name TEXT NOT NULL,
                courses_json TEXT NOT NULL,
                created_at INTEGER NOT NULL
            )`,
        )
        .run();
}

async function applyRollCourseRules(db: D1Database, user: { id: string; roll: string }): Promise<void> {
    await ensureRollCourseRulesTable(db);
    const rules = await db
        .prepare(
            `SELECT roll_prefix, semester_name, courses_json
             FROM roll_course_rules`,
        )
        .all<{ roll_prefix: string; semester_name: string; courses_json: string }>();

    const statements: D1PreparedStatement[] = [];
    const pendingSemesterNames = new Set<string>();
    const normalizedRoll = user.roll.trim().toUpperCase();

    for (const rule of rules.results) {
        const prefixes = rule.roll_prefix
            .split(',')
            .map((prefix) => prefix.trim().toUpperCase())
            .filter((prefix, index, values) =>
                prefix.length > 0 &&
                values.findIndex((item) => item.toUpperCase() === prefix.toUpperCase()) === index,
            );
        if (!prefixes.some((prefix) => normalizedRoll.startsWith(prefix))) continue;

        const semesterKey = rule.semester_name.trim().toLowerCase();
        const existingSemester = await db
            .prepare(
                'SELECT id FROM semesters WHERE user_id = ? AND LOWER(name) = LOWER(?)',
            )
            .bind(user.id, rule.semester_name)
            .first<{ id: string }>();
        if (existingSemester || pendingSemesterNames.has(semesterKey)) continue;
        pendingSemesterNames.add(semesterKey);

        const semesterId = crypto.randomUUID();
        const countRow = await db
            .prepare('SELECT COUNT(*) AS cnt FROM semesters WHERE user_id = ?')
            .bind(user.id)
            .first<{ cnt: number }>();
        const sortOrder = countRow?.cnt ?? 0;
        statements.push(
            db
                .prepare(
                    'INSERT INTO semesters (id, user_id, name, sort_order) VALUES (?, ?, ?, ?)',
                )
                .bind(semesterId, user.id, rule.semester_name, sortOrder),
        );

        let courses: RollRuleCourse[] = [];
        try {
            courses = JSON.parse(rule.courses_json);
        } catch {
            courses = [];
        }

        for (const course of courses) {
            const courseId = crypto.randomUUID();
            const scheme = course.scheme || {
                theory: { assignment: 10, quiz: 15, mid: 25, final: 50 },
                ...(course.has_lab
                    ? { lab: { assignment: 25, quiz: 0, mid: 25, final: 50 } }
                    : {}),
            };
            const theoryCredits =
                course.theory_credits ?? (course.has_lab ? Math.max(Number(course.credits) - 1, 0) : Number(course.credits));
            const labCredits =
                course.lab_credits ?? (course.has_lab ? 1 : 0);

            statements.push(
                db
                    .prepare(
                        `INSERT INTO courses
                         (id, user_id, semester_id, name, credits, has_lab, theory_credits, lab_credits, scheme)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    )
                    .bind(
                        courseId,
                        user.id,
                        semesterId,
                        course.name,
                        course.credits,
                        course.has_lab ? 1 : 0,
                        theoryCredits,
                        labCredits,
                        JSON.stringify(scheme),
                    ),
            );

            const kinds = ['assignment', 'quiz', 'mid', 'final'] as const;
            const addMarks = (part: 'theory' | 'lab', weights: Record<string, number> | undefined) => {
                if (!weights) return;
                let sortOrder = 0;
                for (const kind of kinds) {
                    const max = Number(weights[kind] ?? 0);
                    if (max <= 0) continue;
                    statements.push(
                        db
                            .prepare(
                                `INSERT INTO marks
                                 (id, user_id, course_id, part, kind, label, obtained, max, sort_order)
                                 VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
                            )
                            .bind(
                                crypto.randomUUID(),
                                user.id,
                                courseId,
                                part,
                                kind,
                                null,
                                max,
                                sortOrder++,
                            ),
                    );
                }
            };
            addMarks('theory', scheme.theory);
            if (course.has_lab) addMarks('lab', scheme.lab);
        }
    }

    if (statements.length) {
        await db.batch(statements);
    }
}

const sendOtpSchema = z.object({
    email: z.string().trim().toLowerCase().email(),
    purpose: z.enum(['register', 'reset']).default('register'),
    turnstileToken: z.string().optional(),
    company_url: z.string().optional(),
});

authRoutes.post('/api/auth/send-otp', async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = sendOtpSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: 'Please enter a valid email address' }, 400);
    if (parsed.data.company_url?.trim()) return c.json({ ok: true });

    const isHuman = await verifyTurnstile(
        c.env.TURNSTILE_SECRET_KEY,
        parsed.data.turnstileToken,
        c.req.header('CF-Connecting-IP'),
    );
    if (!isHuman) {
        return c.json({ error: 'Security verification failed. Please refresh and try again.' }, 400);
    }

    const { email, purpose } = parsed.data;
    const roll = extractRollFromEmail(email);
    if (!roll) {
        return c.json({ error: `Please use your official CUI student email (${STUDENT_EMAIL_DOMAIN})` }, 400);
    }

    const existing = await c.env.gpa_db
        .prepare('SELECT id FROM users WHERE email = ? OR roll = ?')
        .bind(email, roll)
        .first();

    if (purpose === 'register' && existing) {
        return c.json({ error: 'This student account is already registered. Please sign in.' }, 409);
    }
    if (purpose === 'reset' && !existing) {
        return c.json({ error: 'No account found with this student email.' }, 404);
    }

    const existingOtp = await c.env.gpa_db
        .prepare('SELECT expires_at FROM otp_codes WHERE email = ?')
        .bind(email)
        .first<{ expires_at: number }>();
    const now = Date.now();
    if (existingOtp && existingOtp.expires_at - now > 1000 * 60 * 14) {
        return c.json({ error: 'Please wait 1 minute before requesting another code.' }, 429);
    }

    const otp = generateOtp();
    const otpHash = await hashOtp(email, otp);
    const expiresAt = now + 1000 * 60 * 15;

    const sent = await sendBrevoOtpEmail(c.env, email, otp, purpose);
    if (!sent) {
        return c.json({ error: 'Failed to send verification email. Please try again.' }, 502);
    }

    await c.env.gpa_db
        .prepare('INSERT OR REPLACE INTO otp_codes (email, otp_hash, expires_at) VALUES (?, ?, ?)')
        .bind(email, otpHash, expiresAt)
        .run();

    return c.json({ ok: true, roll });
});

const registerSchema = z.object({
    name: z.string().trim().min(1).max(100),
    email: z.string().trim().toLowerCase().email(),
    otp: z.string().trim().length(6),
    password: z.string().min(4).max(128),
});

authRoutes.post('/api/auth/register', async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
        return c.json({ error: 'Please fill all fields correctly (including 6-digit OTP).' }, 400);
    }

    const { name, email, otp, password } = parsed.data;
    const roll = extractRollFromEmail(email);
    if (!roll) {
        return c.json({ error: `Invalid student email. Must end with ${STUDENT_EMAIL_DOMAIN}` }, 400);
    }

    const otpRow = await c.env.gpa_db
        .prepare('SELECT otp_hash, expires_at FROM otp_codes WHERE email = ?')
        .bind(email)
        .first<{ otp_hash: string; expires_at: number }>();

    const now = Date.now();
    if (!otpRow || otpRow.expires_at < now) {
        return c.json({ error: 'Verification code expired or not found. Please request a new code.' }, 400);
    }

    const expectedHash = await hashOtp(email, otp);
    if (expectedHash !== otpRow.otp_hash) {
        return c.json({ error: 'Invalid verification code.' }, 400);
    }

    const existing = await c.env.gpa_db
        .prepare('SELECT id FROM users WHERE roll = ? OR email = ?')
        .bind(roll, email)
        .first();
    if (existing) return c.json({ error: 'Account already registered' }, 409);

    const userId = crypto.randomUUID();
    const sessionId = crypto.randomUUID();
    const { hash, salt } = await hashPassword(password);
    const expiresAt = now + 1000 * 60 * 60 * 24 * 30;

    await c.env.gpa_db.batch([
        c.env.gpa_db
            .prepare('INSERT INTO users (id, name, roll, email, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
            .bind(userId, name, roll, email, hash, salt, now),
        c.env.gpa_db
            .prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
            .bind(sessionId, userId, expiresAt),
        c.env.gpa_db
            .prepare('DELETE FROM otp_codes WHERE email = ?')
            .bind(email),
    ]);
    await applyRollCourseRules(c.env.gpa_db, { id: userId, roll });

    setCookie(c, 'session_id', sessionId, {
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
    });

    return c.json({ user: { id: userId, name, roll, email } }, 201);
});

const loginSchema = z.object({
    identifier: z.string().trim().min(1),
    password: z.string().min(1),
});

authRoutes.post('/api/auth/login', async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: 'Invalid credentials' }, 400);

    const rawId = parsed.data.identifier.trim();
    const isEmail = rawId.includes('@');

    const user = isEmail
        ? await c.env.gpa_db
            .prepare('SELECT id, name, roll, email, password_hash, salt FROM users WHERE LOWER(email) = ?')
            .bind(rawId.toLowerCase())
            .first<UserRow & { password_hash: string; salt: string }>()
        : await c.env.gpa_db
            .prepare('SELECT id, name, roll, email, password_hash, salt FROM users WHERE roll = ?')
            .bind(normalizeRoll(rawId))
            .first<UserRow & { password_hash: string; salt: string }>();

    if (!user) return c.json({ error: 'Invalid email/roll number or password' }, 401);

    const { hash } = await hashPassword(parsed.data.password, user.salt);
    if (hash !== user.password_hash) return c.json({ error: 'Invalid email/roll number or password' }, 401);

    const sessionId = crypto.randomUUID();
    const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 30;
    await c.env.gpa_db
        .prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
        .bind(sessionId, user.id, expiresAt)
        .run();

    setCookie(c, 'session_id', sessionId, {
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
    });

    return c.json({ user: { id: user.id, name: user.name, roll: user.roll, email: user.email } });
});

const resetPasswordSchema = z.object({
    email: z.string().trim().toLowerCase().email(),
    otp: z.string().trim().length(6),
    newPassword: z.string().min(4).max(128),
});

authRoutes.post('/api/auth/reset-password', async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: 'Please fill all fields correctly.' }, 400);

    const { email, otp, newPassword } = parsed.data;
    const otpRow = await c.env.gpa_db
        .prepare('SELECT otp_hash, expires_at FROM otp_codes WHERE email = ?')
        .bind(email)
        .first<{ otp_hash: string; expires_at: number }>();

    if (!otpRow || otpRow.expires_at < Date.now()) {
        return c.json({ error: 'Verification code expired or invalid.' }, 400);
    }

    const expectedHash = await hashOtp(email, otp);
    if (expectedHash !== otpRow.otp_hash) {
        await c.env.gpa_db.prepare('DELETE FROM otp_codes WHERE email = ?').bind(email).run();
        return c.json({ error: 'Invalid verification code.' }, 400);
    }

    const user = await c.env.gpa_db
        .prepare('SELECT id FROM users WHERE LOWER(email) = ?')
        .bind(email)
        .first<{ id: string }>();
    if (!user) return c.json({ error: 'Account not found.' }, 404);

    const { hash, salt } = await hashPassword(newPassword);
    await c.env.gpa_db.batch([
        c.env.gpa_db
            .prepare('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?')
            .bind(hash, salt, user.id),
        c.env.gpa_db
            .prepare('DELETE FROM otp_codes WHERE email = ?')
            .bind(email),
        c.env.gpa_db
            .prepare('DELETE FROM sessions WHERE user_id = ?')
            .bind(user.id),
    ]);

    return c.json({ ok: true });
});

authRoutes.post('/api/auth/logout', async (c) => {
    const sessionId = getCookie(c, 'session_id');
    if (sessionId) {
        await c.env.gpa_db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
        deleteCookie(c, 'session_id', { path: '/' });
    }
    return c.json({ ok: true });
});

const contactSchema = z.object({
    name: z.string().trim().min(1).max(100),
    email: z.string().trim().email().max(150),
    message: z.string().trim().min(5).max(2000),
    turnstileToken: z.string().optional(),
    company_url: z.string().optional(),
});

authRoutes.post('/api/contact', async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = contactSchema.safeParse(body);
    if (!parsed.success) {
        return c.json({ error: 'Please fill out all fields properly (message at least 5 characters).' }, 400);
    }
    if (parsed.data.company_url?.trim()) return c.json({ ok: true }, 201);

    const isHuman = await verifyTurnstile(
        c.env.TURNSTILE_SECRET_KEY,
        parsed.data.turnstileToken,
        c.req.header('CF-Connecting-IP'),
    );
    if (!isHuman) {
        return c.json({ error: 'Security verification failed. Please complete the check and try again.' }, 400);
    }

    let userId: string | null = null;
    const sessionId = getCookie(c, 'session_id');
    if (sessionId) {
        const session = await c.env.gpa_db
            .prepare('SELECT user_id FROM sessions WHERE id = ? AND expires_at > ?')
            .bind(sessionId, Date.now())
            .first<{ user_id: string }>();
        if (session) userId = session.user_id;
    }

    const { name, email, message } = parsed.data;

    await c.env.gpa_db
        .prepare('INSERT INTO messages (id, user_id, name, email, message, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(crypto.randomUUID(), userId, name, email, message, Date.now())
        .run();

    if (c.env.FORMSPREE_URL) {
        await fetch(c.env.FORMSPREE_URL, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'User-Agent': c.req.header('User-Agent') || 'Mozilla/5.0',
                Referer: c.req.header('Origin') || 'https://sohayel.tech',
            },
            body: JSON.stringify({
                name,
                email,
                userId: userId || 'Guest',
                message,
                _subject: `[GPA Calculator] New message from ${name}`,
            }),
        }).catch(() => undefined);
    }

    return c.json({ ok: true }, 201);
});

authRoutes.get('/api/auth/me', (c) => {
    return c.json({ user: c.get('user') });
});

authRoutes.put('/api/auth/profile', async (c) => {
    const user = c.get('user');
    const body = await c.req.json().catch(() => null);
    const parsed = z.object({ name: z.string().trim().min(1).max(100) }).safeParse(body);
    if (!parsed.success) return c.json({ error: 'Name must be between 1 and 100 characters' }, 400);

    await c.env.gpa_db
        .prepare('UPDATE users SET name = ? WHERE id = ?')
        .bind(parsed.data.name, user.id)
        .run();

    return c.json({ user: { ...user, name: parsed.data.name } });
});

authRoutes.put('/api/auth/password', async (c) => {
    const user = c.get('user');
    const body = await c.req.json().catch(() => null);
    const schema = z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(4).max(128),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) return c.json({ error: 'Invalid input' }, 400);

    const dbUser = await c.env.gpa_db
        .prepare('SELECT password_hash, salt FROM users WHERE id = ?')
        .bind(user.id)
        .first<{ password_hash: string; salt: string }>();
    if (!dbUser) return c.json({ error: 'User not found' }, 404);

    const { hash: currentHash } = await hashPassword(parsed.data.currentPassword, dbUser.salt);
    if (currentHash !== dbUser.password_hash) return c.json({ error: 'Current password is incorrect' }, 400);

    const { hash: newHash, salt: newSalt } = await hashPassword(parsed.data.newPassword);
    const currentSessionId = getCookie(c, 'session_id');
    await c.env.gpa_db.batch([
        c.env.gpa_db
            .prepare('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?')
            .bind(newHash, newSalt, user.id),
        c.env.gpa_db
            .prepare('DELETE FROM sessions WHERE user_id = ? AND id <> ?')
            .bind(user.id, currentSessionId || ''),
    ]);

    return c.json({ ok: true });
});