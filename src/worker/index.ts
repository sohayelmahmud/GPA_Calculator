import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { z } from 'zod';
import { DEFAULT_GRADE_SCALE } from '../shared/types';
import { isValidRoll, normalizeRoll } from '../shared/rollValidation';

type Env = {
  gpa_db: D1Database;
  ASSETS: Fetcher;
  BREVO_API_KEY: string;
  BREVO_SENDER_EMAIL: string;
  FORMSPREE_URL?: string;
  TURNSTILE_SECRET_KEY?: string;
};

type UserRow = {
  id: string;
  name: string;
  roll: string;
  email: string | null;
};

type Variables = {
  user: UserRow;
};

const STUDENT_EMAIL_DOMAIN = '@isbstudent.comsats.edu.pk';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// ─── Crypto & OTP Helpers ───

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

async function hashPassword(password: string, saltHex?: string): Promise<{ hash: string; salt: string }> {
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

async function hashOtp(email: string, otp: string): Promise<string> {
  const data = new TextEncoder().encode(`${email.toLowerCase()}:${otp}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return toHex(digest);
}

function generateOtp(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return String(100000 + (array[0] % 900000));
}

function extractRollFromEmail(email: string): string | null {
  const lower = email.trim().toLowerCase();
  if (!lower.endsWith(STUDENT_EMAIL_DOMAIN)) return null;
  const prefix = lower.slice(0, -STUDENT_EMAIL_DOMAIN.length);
  const roll = normalizeRoll(prefix);
  return isValidRoll(roll) ? roll : null;
}

async function sendBrevoOtpEmail(env: Env, toEmail: string, otp: string, purpose: 'register' | 'reset'): Promise<boolean> {
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

async function verifyTurnstile(secret: string | undefined, token: string | undefined, ip?: string): Promise<boolean> {
  if (!secret) return true; // Skip check if secret is not configured
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

// ─── Auth Routes ───

const sendOtpSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  purpose: z.enum(['register', 'reset']).default('register'),
  turnstileToken: z.string().optional(),
  company_url: z.string().optional(),
});

app.post('/api/auth/send-otp', async (c) => {
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

  // Rate limit: prevent resending within 60 seconds (15 min expiry - 1 min = 14 min)
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
  const expiresAt = now + 1000 * 60 * 15; // 15 minutes

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

app.post('/api/auth/register', async (c) => {
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
  const expiresAt = now + 1000 * 60 * 60 * 24 * 30; // 30 days

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

app.post('/api/auth/login', async (c) => {
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

app.post('/api/auth/reset-password', async (c) => {
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

app.post('/api/auth/logout', async (c) => {
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

app.post('/api/contact', async (c) => {
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

  // 1. Store permanently in D1 database
  await c.env.gpa_db
    .prepare('INSERT INTO messages (id, user_id, name, email, message, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(crypto.randomUUID(), userId, name, email, message, Date.now())
    .run();

  // 2. Forward to Formspree only (preserves Brevo daily quota strictly for OTPs)
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

// ─── Auth Middleware for Protected /api/* Routes ───

app.use('/api/*', async (c, next) => {
  const publicAuthPaths = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/logout',
    '/api/auth/send-otp',
    '/api/auth/reset-password',
    '/api/contact',
  ];
  if (publicAuthPaths.some((p) => c.req.path.startsWith(p))) {
    return next();
  }

  const sessionId = getCookie(c, 'session_id');
  if (!sessionId) return c.json({ error: 'Unauthorized' }, 401);

  const row = await c.env.gpa_db
    .prepare(
      `SELECT u.id, u.name, u.roll, u.email, s.expires_at
       FROM sessions s JOIN users u ON s.user_id = u.id
       WHERE s.id = ?`,
    )
    .bind(sessionId)
    .first<UserRow & { expires_at: number }>();

  if (!row || row.expires_at < Date.now()) {
    if (row) await c.env.gpa_db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
    deleteCookie(c, 'session_id', { path: '/' });
    return c.json({ error: 'Session expired' }, 401);
  }

  c.set('user', { id: row.id, name: row.name, roll: row.roll, email: row.email });
  return next();
});

app.get('/api/auth/me', (c) => {
  return c.json({ user: c.get('user') });
});

app.put('/api/auth/profile', async (c) => {
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

app.put('/api/auth/password', async (c) => {
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

// ─── GET /api/data (Full User Bundle) ───

app.get('/api/data', async (c) => {
  const user = c.get('user');
  const [semestersRes, coursesRes, marksRes, gradeScaleRes, prevSemRes] = await c.env.gpa_db.batch([
    c.env.gpa_db.prepare('SELECT * FROM semesters WHERE user_id = ? ORDER BY sort_order ASC').bind(user.id),
    c.env.gpa_db.prepare('SELECT * FROM courses WHERE user_id = ?').bind(user.id),
    c.env.gpa_db.prepare('SELECT * FROM marks WHERE user_id = ? ORDER BY sort_order ASC').bind(user.id),
    c.env.gpa_db.prepare('SELECT * FROM grade_scale WHERE user_id = ? ORDER BY min_percent DESC').bind(user.id),
    c.env.gpa_db.prepare('SELECT id, name, credits, sgpa FROM previous_semesters WHERE user_id = ?').bind(user.id),
  ]);

  const courses = (coursesRes.results as any[]).map((row) => ({
    ...row,
    has_lab: Boolean(row.has_lab),
    scheme: typeof row.scheme === 'string' ? JSON.parse(row.scheme) : row.scheme,
  }));

  const gradeScale =
    gradeScaleRes.results.length > 0
      ? gradeScaleRes.results
      : DEFAULT_GRADE_SCALE.map((entry, idx) => ({
        id: `default-${idx}`,
        user_id: user.id,
        min_percent: entry.min_percent,
        grade_point: entry.grade_point,
        letter: entry.letter,
      }));

  return c.json({
    semesters: semestersRes.results,
    courses,
    marks: marksRes.results,
    gradeScale,
    previousSemesters: prevSemRes.results,
  });
});

// ─── Semesters CRUD ───

app.post('/api/semesters', async (c) => {
  const user = c.get('user');
  const parsed = z.object({ name: z.string().trim().min(1).max(100), id: z.string().optional() }).safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Invalid input' }, 400);

  const countRow = await c.env.gpa_db
    .prepare('SELECT COUNT(*) as cnt FROM semesters WHERE user_id = ?')
    .bind(user.id)
    .first<{ cnt: number }>();
  const sortOrder = countRow?.cnt ?? 0;
  const id = parsed.data.id || crypto.randomUUID();

  await c.env.gpa_db
    .prepare('INSERT INTO semesters (id, user_id, name, sort_order) VALUES (?, ?, ?, ?)')
    .bind(id, user.id, parsed.data.name, sortOrder)
    .run();

  return c.json({ id, user_id: user.id, name: parsed.data.name, sort_order: sortOrder }, 201);
});

app.put('/api/semesters/:id', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const parsed = z.object({ name: z.string().trim().min(1).max(100) }).safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Invalid input' }, 400);

  const res = await c.env.gpa_db
    .prepare('UPDATE semesters SET name = ? WHERE id = ? AND user_id = ?')
    .bind(parsed.data.name, id, user.id)
    .run();
  if (!res.meta.changes) return c.json({ error: 'Not found' }, 404);
  return c.json({ ok: true });
});

app.delete('/api/semesters/:id', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const res = await c.env.gpa_db
    .prepare('DELETE FROM semesters WHERE id = ? AND user_id = ?')
    .bind(id, user.id)
    .run();
  if (!res.meta.changes) return c.json({ error: 'Not found' }, 404);
  return c.json({ ok: true });
});

// ─── Courses CRUD ───

const schemePartSchema = z.object({
  assignment: z.number().min(0).max(100),
  quiz: z.number().min(0).max(100),
  mid: z.number().min(0).max(100),
  final: z.number().min(0).max(100),
});

const courseCreateSchema = z.object({
  id: z.string().optional(),
  semester_id: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  credits: z.number().min(0),
  has_lab: z.boolean(),
  theory_credits: z.number().min(0).nullable(),
  lab_credits: z.number().min(0).nullable(),
  scheme: z.object({
    theory: schemePartSchema,
    lab: schemePartSchema.optional(),
  }),
});

app.post('/api/courses', async (c) => {
  const user = c.get('user');
  const parsed = courseCreateSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Invalid input' }, 400);

  const sem = await c.env.gpa_db
    .prepare('SELECT id FROM semesters WHERE id = ? AND user_id = ?')
    .bind(parsed.data.semester_id, user.id)
    .first();
  if (!sem) return c.json({ error: 'Semester not found' }, 404);

  const id = parsed.data.id || crypto.randomUUID();
  await c.env.gpa_db
    .prepare(
      `INSERT INTO courses (id, user_id, semester_id, name, credits, has_lab, theory_credits, lab_credits, scheme)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      user.id,
      parsed.data.semester_id,
      parsed.data.name,
      parsed.data.credits,
      parsed.data.has_lab ? 1 : 0,
      parsed.data.theory_credits,
      parsed.data.lab_credits,
      JSON.stringify(parsed.data.scheme),
    )
    .run();

  return c.json({ id }, 201);
});

app.put('/api/courses/:id', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const parsed = courseCreateSchema.partial().safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Invalid input' }, 400);

  const existing = await c.env.gpa_db
    .prepare('SELECT * FROM courses WHERE id = ? AND user_id = ?')
    .bind(id, user.id)
    .first<any>();
  if (!existing) return c.json({ error: 'Not found' }, 404);

  const d = parsed.data;
  await c.env.gpa_db
    .prepare(
      `UPDATE courses
       SET name = ?, credits = ?, has_lab = ?, theory_credits = ?, lab_credits = ?, scheme = ?
       WHERE id = ? AND user_id = ?`,
    )
    .bind(
      d.name ?? existing.name,
      d.credits ?? existing.credits,
      d.has_lab !== undefined ? (d.has_lab ? 1 : 0) : existing.has_lab,
      d.theory_credits !== undefined ? d.theory_credits : existing.theory_credits,
      d.lab_credits !== undefined ? d.lab_credits : existing.lab_credits,
      d.scheme !== undefined ? JSON.stringify(d.scheme) : existing.scheme,
      id,
      user.id,
    )
    .run();

  return c.json({ ok: true });
});

app.delete('/api/courses/:id', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const res = await c.env.gpa_db
    .prepare('DELETE FROM courses WHERE id = ? AND user_id = ?')
    .bind(id, user.id)
    .run();
  if (!res.meta.changes) return c.json({ error: 'Not found' }, 404);
  return c.json({ ok: true });
});

// ─── Marks CRUD ───

const markCreateSchema = z.object({
  id: z.string().optional(),
  course_id: z.string().min(1),
  part: z.enum(['theory', 'lab']),
  kind: z.enum(['assignment', 'quiz', 'mid', 'final']),
  label: z.string().nullable(),
  obtained: z.number().min(0).nullable().optional(),
  max: z.number().positive(),
});

app.post('/api/marks', async (c) => {
  const user = c.get('user');
  const parsed = markCreateSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Invalid input' }, 400);

  if (parsed.data.obtained != null && parsed.data.obtained > parsed.data.max) {
    return c.json({ error: 'Obtained marks cannot exceed maximum marks' }, 400);
  }

  const course = await c.env.gpa_db
    .prepare('SELECT id FROM courses WHERE id = ? AND user_id = ?')
    .bind(parsed.data.course_id, user.id)
    .first();
  if (!course) return c.json({ error: 'Course not found' }, 404);

  const countRow = await c.env.gpa_db
    .prepare('SELECT COUNT(*) as cnt FROM marks WHERE course_id = ? AND user_id = ?')
    .bind(parsed.data.course_id, user.id)
    .first<{ cnt: number }>();

  const id = parsed.data.id || crypto.randomUUID();
  const sortOrder = countRow?.cnt ?? 0;

  await c.env.gpa_db
    .prepare(
      `INSERT INTO marks (id, user_id, course_id, part, kind, label, obtained, max, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      user.id,
      parsed.data.course_id,
      parsed.data.part,
      parsed.data.kind,
      parsed.data.label,
      parsed.data.obtained ?? null,
      parsed.data.max,
      sortOrder,
    )
    .run();

  return c.json({ id, sort_order: sortOrder }, 201);
});

app.put('/api/marks/:id', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const parsed = z
    .object({
      label: z.string().nullable().optional(),
      obtained: z.number().min(0).nullable().optional(),
      max: z.number().positive().optional(),
    })
    .safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Invalid input' }, 400);

  const existing = await c.env.gpa_db
    .prepare('SELECT * FROM marks WHERE id = ? AND user_id = ?')
    .bind(id, user.id)
    .first<any>();
  if (!existing) return c.json({ error: 'Not found' }, 404);

  const d = parsed.data;
  const nextMax = d.max !== undefined ? d.max : existing.max;
  const nextObtained = d.obtained !== undefined ? d.obtained : existing.obtained;
  if (nextObtained != null && nextObtained > nextMax) {
    return c.json({ error: 'Obtained marks cannot exceed maximum marks' }, 400);
  }

  await c.env.gpa_db
    .prepare('UPDATE marks SET label = ?, obtained = ?, max = ? WHERE id = ? AND user_id = ?')
    .bind(
      d.label !== undefined ? d.label : existing.label,
      nextObtained,
      nextMax,
      id,
      user.id,
    )
    .run();

  return c.json({ ok: true });
});

app.delete('/api/marks/:id', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const res = await c.env.gpa_db
    .prepare('DELETE FROM marks WHERE id = ? AND user_id = ?')
    .bind(id, user.id)
    .run();
  if (!res.meta.changes) return c.json({ error: 'Not found' }, 404);
  return c.json({ ok: true });
});

// ─── Grade Scale & Previous Semesters Replace ───

app.put('/api/grade-scale', async (c) => {
  const user = c.get('user');
  const parsed = z
    .array(
      z.object({
        min_percent: z.number().min(0).max(100),
        grade_point: z.number().min(0).max(5),
        letter: z.string().trim().min(1).max(10),
      }),
    )
    .min(1)
    .safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Invalid input' }, 400);

  await c.env.gpa_db.batch([
    c.env.gpa_db.prepare('DELETE FROM grade_scale WHERE user_id = ?').bind(user.id),
    ...parsed.data.map((entry) =>
      c.env.gpa_db
        .prepare('INSERT INTO grade_scale (id, user_id, min_percent, grade_point, letter) VALUES (?, ?, ?, ?, ?)')
        .bind(crypto.randomUUID(), user.id, entry.min_percent, entry.grade_point, entry.letter),
    ),
  ]);

  return c.json({ ok: true });
});

app.delete('/api/grade-scale', async (c) => {
  const user = c.get('user');
  await c.env.gpa_db.prepare('DELETE FROM grade_scale WHERE user_id = ?').bind(user.id).run();
  return c.json({
    gradeScale: DEFAULT_GRADE_SCALE.map((entry, idx) => ({
      id: `default-${idx}`,
      user_id: user.id,
      min_percent: entry.min_percent,
      grade_point: entry.grade_point,
      letter: entry.letter,
    })),
  });
});

app.put('/api/previous-semesters', async (c) => {
  const user = c.get('user');
  const parsed = z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string().trim().min(1).max(100),
        credits: z.number().positive(),
        sgpa: z.number().min(0).max(5),
      }),
    )
    .safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Invalid input' }, 400);

  await c.env.gpa_db.batch([
    c.env.gpa_db.prepare('DELETE FROM previous_semesters WHERE user_id = ?').bind(user.id),
    ...parsed.data.map((sem) =>
      c.env.gpa_db
        .prepare('INSERT INTO previous_semesters (id, user_id, name, credits, sgpa) VALUES (?, ?, ?, ?, ?)')
        .bind(sem.id || crypto.randomUUID(), user.id, sem.name, sem.credits, sem.sgpa),
    ),
  ]);

  return c.json({ ok: true });
});

app.post('/api/sync-guest', async (c) => {
  const user = c.get('user');
  const guestSchema = z.object({
    semesters: z.array(z.object({
      id: z.string(),
      name: z.string().trim().min(1).max(100),
      sort_order: z.number().int().min(0),
    })),
    courses: z.array(z.object({
      id: z.string(),
      semester_id: z.string(),
      name: z.string().trim().min(1).max(120),
      credits: z.number().min(0),
      has_lab: z.boolean(),
      theory_credits: z.number().min(0).nullable(),
      lab_credits: z.number().min(0).nullable(),
      scheme: z.object({
        theory: schemePartSchema,
        lab: schemePartSchema.optional(),
      }),
    })),
    marks: z.array(z.object({
      id: z.string(),
      course_id: z.string(),
      part: z.enum(['theory', 'lab']),
      kind: z.enum(['assignment', 'quiz', 'mid', 'final']),
      label: z.string().nullable(),
      obtained: z.number().min(0).nullable(),
      max: z.number().positive(),
      sort_order: z.number().int().min(0),
    })),
    previousSemesters: z.array(z.object({
      id: z.string(),
      name: z.string().trim().min(1).max(100),
      credits: z.number().positive(),
      sgpa: z.number().min(0).max(5),
    })),
    gradeScale: z.array(z.object({
      min_percent: z.number().min(0).max(100),
      grade_point: z.number().min(0).max(5),
      letter: z.string().trim().min(1).max(10),
    })).optional(),
  });

  const parsed = guestSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Invalid guest payload' }, 400);

  const g = parsed.data;
  const stmts: D1PreparedStatement[] = [];

  for (const s of g.semesters) {
    stmts.push(
      c.env.gpa_db
        .prepare('INSERT OR IGNORE INTO semesters (id, user_id, name, sort_order) VALUES (?, ?, ?, ?)')
        .bind(s.id, user.id, s.name, s.sort_order),
    );
  }
  for (const crs of g.courses) {
    stmts.push(
      c.env.gpa_db
        .prepare(
          `INSERT OR IGNORE INTO courses (id, user_id, semester_id, name, credits, has_lab, theory_credits, lab_credits, scheme)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          crs.id,
          user.id,
          crs.semester_id,
          crs.name,
          crs.credits,
          crs.has_lab ? 1 : 0,
          crs.theory_credits,
          crs.lab_credits,
          JSON.stringify(crs.scheme),
        ),
    );
  }
  for (const m of g.marks) {
    stmts.push(
      c.env.gpa_db
        .prepare(
          `INSERT OR IGNORE INTO marks (id, user_id, course_id, part, kind, label, obtained, max, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(m.id, user.id, m.course_id, m.part, m.kind, m.label, m.obtained, m.max, m.sort_order),
    );
  }
  for (const ps of g.previousSemesters) {
    stmts.push(
      c.env.gpa_db
        .prepare('INSERT OR IGNORE INTO previous_semesters (id, user_id, name, credits, sgpa) VALUES (?, ?, ?, ?, ?)')
        .bind(ps.id, user.id, ps.name, ps.credits, ps.sgpa),
    );
  }

  if (g.gradeScale && g.gradeScale.length > 0) {
    const isCustom =
      g.gradeScale.length !== DEFAULT_GRADE_SCALE.length ||
      g.gradeScale.some(
        (entry, i) =>
          entry.min_percent !== DEFAULT_GRADE_SCALE[i].min_percent ||
          entry.grade_point !== DEFAULT_GRADE_SCALE[i].grade_point ||
          entry.letter !== DEFAULT_GRADE_SCALE[i].letter,
      );
    if (isCustom) {
      for (const entry of g.gradeScale) {
        stmts.push(
          c.env.gpa_db
            .prepare('INSERT INTO grade_scale (id, user_id, min_percent, grade_point, letter) VALUES (?, ?, ?, ?, ?)')
            .bind(crypto.randomUUID(), user.id, entry.min_percent, entry.grade_point, entry.letter),
        );
      }
    }
  }

  if (stmts.length > 0) {
    await c.env.gpa_db.batch(stmts);
  }

  return c.json({ ok: true });
});

// ─── Export & Delete Account ───

app.get('/api/export', async (c) => {
  const user = c.get('user');
  const [semestersRes, coursesRes, marksRes, gradeScaleRes, prevSemRes] = await c.env.gpa_db.batch([
    c.env.gpa_db.prepare('SELECT * FROM semesters WHERE user_id = ?').bind(user.id),
    c.env.gpa_db.prepare('SELECT * FROM courses WHERE user_id = ?').bind(user.id),
    c.env.gpa_db.prepare('SELECT * FROM marks WHERE user_id = ?').bind(user.id),
    c.env.gpa_db.prepare('SELECT * FROM grade_scale WHERE user_id = ?').bind(user.id),
    c.env.gpa_db.prepare('SELECT * FROM previous_semesters WHERE user_id = ?').bind(user.id),
  ]);

  return c.json({
    exportedAt: new Date().toISOString(),
    user,
    semesters: semestersRes.results,
    courses: coursesRes.results,
    marks: marksRes.results,
    gradeScale: gradeScaleRes.results,
    previousSemesters: prevSemRes.results,
  });
});

app.delete('/api/account', async (c) => {
  const user = c.get('user');
  await c.env.gpa_db.prepare('DELETE FROM users WHERE id = ?').bind(user.id).run();
  deleteCookie(c, 'session_id', { path: '/' });
  return c.json({ ok: true });
});

// ─── Serve Vite SPA Static Assets for Everything Else ───

app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;