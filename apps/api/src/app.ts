import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './env.js';

export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: env.PUBLIC_WEB_URL, credentials: true }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  return app;
}
