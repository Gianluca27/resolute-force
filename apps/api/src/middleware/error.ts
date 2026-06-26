import type { Request, Response, NextFunction } from 'express';

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: 'Not found' });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  const message = err instanceof Error ? err.message : 'Internal error';
  if (process.env.NODE_ENV !== 'test') console.error('[api error]', err);
  res.status(500).json({ error: message });
}
