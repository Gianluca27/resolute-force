import type { Request, Response, NextFunction } from 'express';
import { HttpError } from '../lib/httpError.js';

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: 'No encontrado' });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (process.env.NODE_ENV !== 'test') console.error('[api error]', err);
  const e = err as { status?: number; statusCode?: number; type?: string; code?: string; name?: string };
  const status = e?.status ?? e?.statusCode;
  // Client errors (HttpError thrown by services, malformed JSON / oversized body from body-parser)
  // carry a 4xx status — respect it instead of masking every failure as a 500.
  if (typeof status === 'number' && status >= 400 && status < 500) {
    const message =
      err instanceof HttpError ? err.message
      : e.type === 'entity.parse.failed' ? 'JSON inválido'
      : e.type === 'entity.too.large' ? 'Solicitud demasiado grande'
      : 'Solicitud inválida';
    return res.status(status).json({ error: message });
  }
  // Never leak internal/DB error details to clients in production — and never leak raw DB driver
  // errors (absolute paths, SQL, schema) to ANY client even in dev (H-05). App-level Error messages
  // still surface in dev for DX; Prisma errors (code Pxxxx) are always masked.
  // Mask ALL Prisma driver errors, not just code-bearing ones: PrismaClientValidationError (bad
  // input shape, e.g. Invalid Date) has NO `code`, so it used to leak the raw query + absolute path
  // in dev (H-02). Match by error class name too.
  const isDbError = err instanceof Error
    && ((typeof e.code === 'string' && /^P\d{4}$/.test(e.code)) || /^PrismaClient/.test(err.name));
  const expose = process.env.NODE_ENV !== 'production' && err instanceof Error && !isDbError;
  const message = expose ? err.message : 'Error interno del servidor';
  res.status(500).json({ error: message });
}
