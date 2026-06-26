import type { Request, Response, NextFunction } from 'express';
import { verifyAdmin, type AdminClaims } from '../lib/jwt.js';

export interface AuthedRequest extends Request { admin?: AdminClaims; }

export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ error: 'No autorizado' });
  try { req.admin = verifyAdmin(h.slice(7)); next(); }
  catch { return res.status(401).json({ error: 'Sesión inválida o expirada' }); }
}
