import { createMiddleware } from 'hono/factory';
import { getCookie, deleteCookie } from 'hono/cookie';
import type { AppContext, UserRow } from '../types';

const PUBLIC_API_PREFIXES = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/logout',
    '/api/auth/send-otp',
    '/api/auth/reset-password',
    '/api/contact',
    '/api/preset-courses',
];

export const requireAuth = createMiddleware<AppContext>(async (c, next) => {
    if (PUBLIC_API_PREFIXES.some((p) => c.req.path === p || c.req.path.startsWith(`${p}/`))) {
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