import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
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
