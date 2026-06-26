import { Router } from 'express';
import { getDrop } from '../services/config.js';

export const dropRouter = Router();

dropRouter.get('/', async (_req, res, next) => {
  try { res.json(await getDrop()); } catch (e) { next(e); }
});
