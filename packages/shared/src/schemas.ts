import { z } from 'zod';
import { SIZES } from './dto';

export const cartLineSchema = z.object({
  productId: z.string().min(1),
  size: z.enum(SIZES),
  qty: z.number().int().min(1).max(20),
});

export const customerSchema = z.object({
  nombre: z.string().trim().min(1),
  email: z.string().trim().email(),
  tel: z.string().trim().optional(),
  dir: z.string().trim().min(1),
  ciudad: z.string().trim().min(1),
});

export const checkoutQuoteSchema = z.object({ items: z.array(cartLineSchema).min(1) });
