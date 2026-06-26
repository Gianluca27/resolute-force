import jwt from 'jsonwebtoken';
import { env } from '../env.js';

export interface AdminClaims { sub: string; email: string; }
export function signAdmin(claims: AdminClaims): string { return jwt.sign(claims, env.JWT_SECRET, { expiresIn: '12h' }); }
export function verifyAdmin(token: string): AdminClaims { return jwt.verify(token, env.JWT_SECRET) as AdminClaims; }
