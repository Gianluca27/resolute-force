import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './env.js';
import { productsRouter } from './routes/products.js';
import { notFound, errorHandler } from './middleware/error.js';

export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: env.PUBLIC_WEB_URL, credentials: true }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/products', productsRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
