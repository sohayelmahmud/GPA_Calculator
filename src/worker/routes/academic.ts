import { Hono } from 'hono';
import { deleteCookie } from 'hono/cookie';
import { z } from 'zod';
import { DEFAULT_GRADE_SCALE } from '../../shared/types';
import type { AppContext } from '../types';

export const academicRoutes = new Hono<AppContext>();

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

const markCreateSchema = z.object({
    id: z.string().optional(),
    course_id: z.string().min(1),
    part: z.enum(['theory', 'lab']),
    kind: z.enum(['assignment', 'quiz', 'mid', 'final']),
    label: z.string().nullable(),
    obtained: z.number().min(0).nullable().optional(),
    max: z.number().positive(),
});

// ─── GET /api/data (Full User Bundle) ───

academicRoutes.get('/api/data', async (c) => {
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

academicRoutes.post('/api/semesters', async (c) => {
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

academicRoutes.put('/api/semesters/:id', async (c) => {
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

academicRoutes.delete('/api/semesters/:id', async (c) => {
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

academicRoutes.post('/api/courses', async (c) => {
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

academicRoutes.put('/api/courses/:id', async (c) => {
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

academicRoutes.delete('/api/courses/:id', async (c) => {
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

academicRoutes.post('/api/marks', async (c) => {
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

academicRoutes.put('/api/marks/:id', async (c) => {
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

academicRoutes.delete('/api/marks/:id', async (c) => {
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

academicRoutes.put('/api/grade-scale', async (c) => {
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

academicRoutes.delete('/api/grade-scale', async (c) => {
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

academicRoutes.put('/api/previous-semesters', async (c) => {
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

academicRoutes.post('/api/sync-guest', async (c) => {
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

academicRoutes.get('/api/export', async (c) => {
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

academicRoutes.delete('/api/account', async (c) => {
    const user = c.get('user');
    await c.env.gpa_db.prepare('DELETE FROM users WHERE id = ?').bind(user.id).run();
    deleteCookie(c, 'session_id', { path: '/' });
    return c.json({ ok: true });
});