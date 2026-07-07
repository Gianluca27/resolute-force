import { Router } from 'express';
import { getPublishedDesign } from '../services/pageDesign.js';

export const pageDesignRouter = Router();

pageDesignRouter.get('/', async (_req, res, next) => {
  try { res.json(await getPublishedDesign()); } catch (e) { next(e); }
});
