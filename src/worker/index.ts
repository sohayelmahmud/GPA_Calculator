import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { z } from 'zod';
import { DEFAULT_GRADE_SCALE } from '../shared/types';
import { isValidRoll, normalizeRoll, ROLL_ERROR_MSG } from '../shared/rollValidation';

type Env = {
  gpa_db: D1Database;
  ASSETS: Fetcher;
};

type UserRow = {
  id: string;
  name: string;
  roll: string;
};

type Variables = {
  user: UserRow;
};

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// ─── Crypto Helpers (Web Crypto PBKDF2) ───

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

// ─── Auth Routes ───

const registerSchema = z.object({
  name: z.string().trim().min(1).max(100),
  roll: z
    .string()
    .transform(normalizeRoll)
    .refine(isValidRoll, { message: ROLL_ERROR_MSG }),
  password: z.string().min(4).max(128),
});

app.post('/api/auth/register', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    const rollIssue = parsed.error.issues.find((i) => i.path[0] === 'roll');
    return c.json({ error: rollIssue ? rollIssue.message : 'Invalid input' }, 400);
  }

  const roll = parsed.data.roll;
  const existing = await c.env.gpa_db
    .prepare('SELECT id FROM users WHERE roll = ?')
    .bind(roll)
    .first();
  if (existing) return c.json({ error: 'Roll number already registered' }, 409);

  const userId = crypto.randomUUID();
  const sessionId = crypto.randomUUID();
  const { hash, salt } = await hashPassword(parsed.data.password);
  const now = Date.now();
  const expiresAt = now + 1000 * 60 * 60 * 24 * 30; // 30 days

  const stmts: D1PreparedStatement[] = [
    c.env.gpa_db
      .prepare('INSERT INTO users (id, name, roll, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(userId, parsed.data.name, roll, hash, salt, now),
    c.env.gpa_db
      .prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
      .bind(sessionId, userId, expiresAt),
  ];

  await c.env.gpa_db.batch(stmts);

  setCookie(c, 'session_id', sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  return c.json({ user: { id: userId, name: parsed.data.name, roll } }, 201);
});

const loginSchema = z.object({
  roll: z
    .string()
    .transform(normalizeRoll)
    .refine((val) => val.length > 0),
  password: z.string().min(1),
});

app.post('/api/auth/login', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid credentials' }, 400);

  const roll = parsed.data.roll;
  const user = await c.env.gpa_db
    .prepare('SELECT id, name, roll, password_hash, salt FROM users WHERE roll = ?')
    .bind(roll)
    .first<UserRow & { password_hash: string; salt: string }>();

  if (!user) return c.json({ error: 'Invalid roll number or password' }, 401);

  const { hash } = await hashPassword(parsed.data.password, user.salt);
  if (hash !== user.password_hash) return c.json({ error: 'Invalid roll number or password' }, 401);

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

  return c.json({ user: { id: user.id, name: user.name, roll: user.roll } });
});

app.post('/api/auth/logout', async (c) => {
  const sessionId = getCookie(c, 'session_id');
  if (sessionId) {
    await c.env.gpa_db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
    deleteCookie(c, 'session_id', { path: '/' });
  }
  return c.json({ ok: true });
});

// ─── Auth Middleware for Protected /api/* Routes ───

app.use('/api/*', async (c, next) => {
  if (c.req.path.startsWith('/api/auth/login') || c.req.path.startsWith('/api/auth/register') || c.req.path.startsWith('/api/auth/logout')) {
    return next();
  }

  const sessionId = getCookie(c, 'session_id');
  if (!sessionId) return c.json({ error: 'Unauthorized' }, 401);

  const row = await c.env.gpa_db
    .prepare(
      `SELECT u.id, u.name, u.roll, s.expires_at
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

  c.set('user', { id: row.id, name: row.name, roll: row.roll });
  return next();
});

app.get('/api/auth/me', (c) => {
  return c.json({ user: c.get('user') });
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
  await c.env.gpa_db
    .prepare('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?')
    .bind(newHash, newSalt, user.id)
    .run();

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