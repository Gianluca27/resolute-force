import { Router } from 'express';
import { getContent } from '../services/config.js';

export const contentRouter = Router();

contentRouter.get('/', async (_req, res, next) => {
  try { res.json(await getContent()); } catch (e) { next(e); }
});
