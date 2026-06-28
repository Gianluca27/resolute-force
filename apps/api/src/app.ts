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

// Coerce TRUST_PROXY into a value Express accepts: a hop count (number), a boolean,
// or a string preset/IP-list. Default false so a misconfigured deploy can't be tricked
// into trusting X-Forwarded-For from arbitrary clients.
function parseTrustProxy(raw: string): boolean | number | string {
  const v = raw.trim();
  if (v === '' || v === 'false' || v === 'off') return false;
  if (v === 'true') return true;
  if (/^\d+$/.test(v)) return Number(v);
  return v;
}

export function createApp() {
  const app = express();
  // Path routing is case-sensitive (slugs already are) — `/API/products` must not alias `/api/products`.
  app.set('case sensitive routing', true);
  // Behind a reverse proxy/LB, req.ip must come from X-Forwarded-For for per-IP rate
  // limiting to be effective — but only as many hops as we actually trust.
  app.set('trust proxy', parseTrustProxy(env.TRUST_PROXY));
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
