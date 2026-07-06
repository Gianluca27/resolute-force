import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PROVINCE_CODES } from '@resolute/shared';
import { paqarEnabled, validateAuth, getAgencies, PaqarError, PaqarDisabledError } from '../../lib/paqar.js';
import {
  getShippingConfig, updateShippingConfig, listShipments, cancelShipment,
  getShipmentLabel, getShipmentTracking, InvalidShipmentStateError, LabelError,
} from '../../services/shipping.js';

export const adminShippingRouter = Router();

/** Traduce fallas PAQ.AR a HTTP: sin credenciales 503, error del correo 502 con su mensaje. */
export function handlePaqarError(e: unknown, res: Response, next: NextFunction) {
  if (e instanceof PaqarDisabledError) return res.status(503).json({ error: e.message });
  if (e instanceof PaqarError) return res.status(502).json({ error: e.message });
  if (e instanceof LabelError) return res.status(502).json({ error: e.message });
  next(e);
}

/** Guard para endpoints que pegan al correo: sin credenciales, 503 antes de intentar nada. */
export function requirePaqar(_req: Request, res: Response, next: NextFunction) {
  if (!paqarEnabled()) return res.status(503).json({ error: 'PAQ.AR no configurado' });
  next();
}

const configSchema = z.object({
  senderName: z.string().trim().min(1).max(120),
  senderEmail: z.string().trim().email().max(120).or(z.literal('')),
  senderPhone: z.string().trim().max(30),
  senderStreet: z.string().trim().min(1).max(120),
  senderStreetNumber: z.string().trim().min(1).max(10),
  senderFloor: z.string().trim().max(10),
  senderApartment: z.string().trim().max(10),
  senderCity: z.string().trim().min(1).max(100),
  senderProvince: z.enum(PROVINCE_CODES),
  senderZip: z.string().trim().regex(/^[A-Za-z]?\d{4}[A-Za-z]{0,3}$/, 'Código postal inválido'),
  defaultWeightGrams: z.number().int().min(1).max(99999),
  defaultHeightCm: z.number().int().min(1).max(999),
  defaultWidthCm: z.number().int().min(1).max(999),
  defaultDepthCm: z.number().int().min(1).max(999),
  defaultServiceType: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, 'serviceType de 2 letras'),
  labelFormat: z.enum(['10x15', 'label']),
});

adminShippingRouter.get('/status', async (_req, res, next) => {
  try {
    if (!paqarEnabled()) return res.json({ configured: false, valid: null });
    let valid = false;
    try { valid = await validateAuth(); } catch { /* red caída ≠ credenciales inválidas, pero el admin solo necesita el booleano */ }
    res.json({ configured: true, valid });
  } catch (e) { next(e); }
});

adminShippingRouter.get('/config', async (_req, res, next) => {
  try { res.json(await getShippingConfig()); } catch (e) { next(e); }
});

adminShippingRouter.put('/config', async (req, res, next) => {
  const p = configSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Configuración inválida', details: p.error.flatten() });
  try { res.json(await updateShippingConfig(p.data)); } catch (e) { next(e); }
});

adminShippingRouter.get('/agencies', requirePaqar, async (req: Request, res, next) => {
  const parseBool = (v: unknown) => (v === 'true' ? true : v === 'false' ? false : undefined);
  try {
    res.json(await getAgencies({
      stateId: typeof req.query.stateId === 'string' && req.query.stateId ? req.query.stateId : undefined,
      pickupAvailability: parseBool(req.query.pickupAvailability),
      packageReception: parseBool(req.query.packageReception),
    }));
  } catch (e) { handlePaqarError(e, res, next); }
});

adminShippingRouter.get('/shipments', async (_req, res, next) => {
  try { res.json(await listShipments()); } catch (e) { next(e); }
});

adminShippingRouter.post('/shipments/:id/cancel', requirePaqar, async (req, res, next) => {
  try {
    const s = await cancelShipment(req.params.id!);
    if (!s) return res.status(404).json({ error: 'Envío no encontrado' });
    res.json(s);
  } catch (e) {
    if (e instanceof InvalidShipmentStateError) return res.status(422).json({ error: e.message });
    handlePaqarError(e, res, next);
  }
});

adminShippingRouter.get('/shipments/:id/label', requirePaqar, async (req, res, next) => {
  try {
    const label = await getShipmentLabel(req.params.id!, typeof req.query.format === 'string' ? req.query.format : undefined);
    if (!label) return res.status(404).json({ error: 'Envío no encontrado' });
    res.json(label);
  } catch (e) { handlePaqarError(e, res, next); }
});

adminShippingRouter.get('/shipments/:id/tracking', requirePaqar, async (req, res, next) => {
  try {
    const t = await getShipmentTracking(req.params.id!);
    if (!t) return res.status(404).json({ error: 'Envío no encontrado' });
    res.json(t);
  } catch (e) { handlePaqarError(e, res, next); }
});
