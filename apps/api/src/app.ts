import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './env.js';
import { productsRouter } from './routes/products.js';
import { dropRouter } from './routes/drop.js';
import { contentRouter } from './routes/content.js';
import { notFound, errorHandler } from './middleware/error.js';
import { checkoutRouter } from './routes/checkout.js';
import { paymentsRouter } from './routes/payments.js';
import { ordersRouter } from './routes/orders.js';
import { adminRouter } from './routes/admin/index.js';
import { trackRouter } from './routes/track.js';

export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: env.PUBLIC_WEB_URL, credentials: true }));
  app.use(express.json({ limit: '1mb' }));

  // Broad abuse cap on the whole API, plus a strict bucket on admin login (brute-force).
  const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false, message: { error: 'Demasiadas solicitudes. Probá de nuevo más tarde.' } });
  const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false, message: { error: 'Demasiados intentos de acceso. Probá de nuevo más tarde.' } });
  app.use('/api', apiLimiter);
  app.use('/api/admin/login', loginLimiter);

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/products', productsRouter);
  app.use('/api/drop', dropRouter);
  app.use('/api/content', contentRouter);
  app.use('/api/checkout', checkoutRouter);
  app.use('/api/payments', paymentsRouter);
  app.use('/api/orders', ordersRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/track', trackRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
