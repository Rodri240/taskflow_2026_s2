import cors from 'cors';
import express, { Express } from 'express';
import { errorHandler, notFoundHandler } from './middleware/errors';
import authRoutes from './modules/auth/auth.routes';
import commentsRoutes from './modules/comments/comments.routes';
import projectsRoutes from './modules/projects/projects.routes';
import tasksRoutes from './modules/tasks/tasks.routes';

const DEFAULT_FRONTEND_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];

export function allowedOrigins(): string[] {
  const configured = process.env.CORS_ALLOWED_ORIGINS ?? process.env.FRONTEND_ORIGIN;
  if (!configured) return DEFAULT_FRONTEND_ORIGINS;
  return configured
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

export function createApp(): Express {
  const app = express();
  const origins = allowedOrigins();

  app.use(
    cors({
      origin(origin, callback) {
        callback(null, !origin || origins.includes(origin.replace(/\/$/, '')));
      },
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Authorization', 'Content-Type'],
    }),
  );
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/projects', projectsRoutes);
  app.use('/api/tasks', tasksRoutes);
  app.use('/api/comments', commentsRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
