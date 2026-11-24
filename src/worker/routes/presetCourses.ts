import { Hono } from 'hono';
import { CUI_BCS_COURSES } from '../../shared/cuiCourses';
import type { AppContext } from '../types';

export const presetCourseRoutes = new Hono<AppContext>();

// Public + Edge Cached (1 hour) — instant client-side filtering after 1 fetch
presetCourseRoutes.get('/api/preset-courses', async (c) => {
    const rows = await c.env.gpa_db
        .prepare(
            `SELECT code, name, credits, has_lab, theory_credits, lab_credits, aliases
       FROM preset_courses
       WHERE approved = 1
       ORDER BY code ASC`,
        )
        .all<any>()
        .catch(() => null);

    const courses =
        rows && rows.results.length > 0
            ? rows.results.map((r) => ({
                code: r.code,
                name: r.name,
                credits: r.credits,
                hasLab: Boolean(r.has_lab),
                theoryCredits: r.theory_credits,
                labCredits: r.lab_credits,
                aliases: r.aliases ? JSON.parse(r.aliases) : [],
            }))
            : CUI_BCS_COURSES;

    c.header('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    return c.json({ courses });
});