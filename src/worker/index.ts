import { Hono } from 'hono';
import type { AppContext } from './types';
import { requireAuth } from './middleware/auth';
import { authRoutes } from './routes/auth';
import { academicRoutes } from './routes/academic';
import { presetCourseRoutes } from './routes/presetCourses';

const app = new Hono<AppContext>();

// Auth middleware for protected /api/* routes
app.use('/api/*', requireAuth);

// Mount modular routes
app.route('/', authRoutes);
app.route('/', academicRoutes);
app.route('/', presetCourseRoutes);

// Serve Vite SPA Static Assets for everything else
app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;