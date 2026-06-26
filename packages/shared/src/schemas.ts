import { z } from 'zod';
import { SIZES } from './dto';

export const cartLineSchema = z.object({
  productId: z.string().min(1),
  size: z.enum(SIZES),
  qty: z.number().int().min(1),
});

export const customerSchema = z.object({
  nombre: z.string().trim().min(1),
  email: z.string().trim().email(),
  tel: z.string().trim().optional(),
  dir: z.string().trim().min(1),
  ciudad: z.string().trim().min(1),
});

export const checkoutQuoteSchema = z.object({ items: z.array(cartLineSchema).min(1) });

export const variantInputSchema = z.object({ size: z.enum(SIZES), stock: z.number().int().min(0) });
export const productInputSchema = z.object({
  slug: z.string().trim().min(1),
  line: z.string().trim().min(1),
  color: z.string().trim().min(1),
  dotColor: z.string().trim().min(1),
  tag: z.string().trim().nullable().optional(),
  price: z.number().int().min(0),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  sizes: z.array(variantInputSchema).min(1),
});
export type ProductInput = z.infer<typeof productInputSchema>;
