import type { Request, Response, NextFunction } from 'express';

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: 'No encontrado' });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (process.env.NODE_ENV !== 'test') console.error('[api error]', err);
  // Never leak internal/DB error details to clients in production.
  const expose = process.env.NODE_ENV !== 'production';
  const message = expose && err instanceof Error ? err.message : 'Error interno del servidor';
  res.status(500).json({ error: message });
}
