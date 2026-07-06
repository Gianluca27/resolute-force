import { Router } from 'express';
import { z } from 'zod';
import { PROVINCE_CODES } from '@resolute/shared';
import { prisma } from '../../prisma.js';
import { changeOrderStatus, InvalidStatusTransition, OutOfStockError } from '../../services/orders.js';
import { createShipmentForOrder, ShipmentExistsError, ConfigMissingError } from '../../services/shipping.js';
import { handlePaqarError, requirePaqar } from './shipping.js';

export const adminOrdersRouter = Router();

// DTO: expose only what the admin card needs. Strips internal payment/pricing fields
// (mpPaymentId, mpPreferenceId, subtotal, discount) that the UI never renders (H-05).
adminOrdersRouter.get('/', async (_req, res, next) => {
  try {
    res.json(await prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, orderNo: true, customerName: true, customerEmail: true, customerPhone: true,
        address: true, city: true, paymentMethod: true, status: true, total: true, createdAt: true,
        shippingStreet: true, shippingStreetNumber: true, shippingFloor: true, shippingApartment: true,
        shippingZip: true, shippingProvince: true,
        shipment: { select: { id: true, trackingNumber: true, status: true } },
        items: { select: { productId: true, line: true, color: true, size: true, unitPrice: true, qty: true } },
      },
    }));
  } catch (e) { next(e); }
});

const shipmentInputSchema = z.object({
  deliveryType: z.enum(['homeDelivery', 'agency', 'locker']),
  agencyId: z.string().trim().max(20).optional(),
  weightGrams: z.number().int().min(1).max(99999),
  heightCm: z.number().int().min(1).max(999),
  widthCm: z.number().int().min(1).max(999),
  depthCm: z.number().int().min(1).max(999),
  declaredValue: z.number().int().min(0),
  serviceType: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/),
  shipping: z.object({
    street: z.string().trim().min(1).max(120),
    streetNumber: z.string().trim().min(1).max(10),
    floor: z.string().trim().max(40).optional(),
    apartment: z.string().trim().max(40).optional(),
    city: z.string().trim().min(1).max(100),
    province: z.enum(PROVINCE_CODES),
    zip: z.string().trim().regex(/^[A-Za-z]?\d{4}[A-Za-z]{0,3}$/),
  }),
}).refine((d) => d.deliveryType === 'homeDelivery' || Boolean(d.agencyId), { message: 'Elegí la sucursal de retiro', path: ['agencyId'] });

adminOrdersRouter.post('/:id/shipment', requirePaqar, async (req, res, next) => {
  const p = shipmentInputSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Datos de envío inválidos', details: p.error.flatten() });
  try {
    const shipment = await createShipmentForOrder(req.params.id!, p.data);
    if (!shipment) return res.status(404).json({ error: 'Orden no encontrada' });
    res.status(201).json(shipment);
  } catch (e) {
    if (e instanceof ShipmentExistsError) return res.status(409).json({ error: e.message });
    if (e instanceof ConfigMissingError) return res.status(400).json({ error: e.message });
    handlePaqarError(e, res, next);
  }
});

const statusSchema = z.object({ status: z.enum(['pending', 'paid', 'shipped', 'cancelled']) });
adminOrdersRouter.patch('/:id/status', async (req, res, next) => {
  const p = statusSchema.safeParse(req.body); if (!p.success) return res.status(400).json({ error: 'Estado inválido' });
  try {
    const order = await changeOrderStatus(req.params.id!, p.data.status);
    if (!order) return res.status(404).json({ error: 'Orden no encontrada' });
    res.json(order);
  } catch (e) {
    if (e instanceof InvalidStatusTransition) return res.status(422).json({ error: e.message });
    if (e instanceof OutOfStockError) return res.status(409).json({ error: e.message });
    next(e);
  }
});
