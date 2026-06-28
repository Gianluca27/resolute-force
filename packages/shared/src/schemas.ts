import { z } from 'zod';
import { SIZES } from './dto';

export const cartLineSchema = z.object({
  productId: z.string().min(1),
  size: z.enum(SIZES),
  qty: z.number().int().min(1),
});

// Lenient phone shape: starts with a digit or +, then only digits/space/()/-/. — rejects free text
// like "abc-no-es-un-telefono!!!" without imposing a length that would reject real short inputs.
const phoneRe = /^[\d+][\d\s().-]*$/;

export const customerSchema = z.object({
  nombre: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(120),
  // Optional, but if provided must look like a phone number (H-07). Empty string stays allowed.
  tel: z.string().trim().max(30).refine((v) => v === '' || phoneRe.test(v), 'Teléfono inválido').optional(),
  dir: z.string().trim().min(1).max(160),
  ciudad: z.string().trim().min(1).max(100),
});

export const checkoutQuoteSchema = z.object({ items: z.array(cartLineSchema).min(1) });

export const variantInputSchema = z.object({ size: z.enum(SIZES), stock: z.number().int().min(0) });
export const productInputSchema = z.object({
  // Upper bounds (H-09): keep strings sane so a 5000-char slug can't break layout or abuse storage.
  slug: z.string().trim().min(1).max(120),
  line: z.string().trim().min(1).max(80),
  color: z.string().trim().min(1).max(80),
  dotColor: z.string().trim().min(1).max(32),
  // Normalize "no tag" to a single representation (H-07): blank/whitespace/omitted all become null.
  tag: z.string().trim().max(40).nullable().optional().transform((v) => (v ? v : null)),
  price: z.number().int().min(0),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  sizes: z.array(variantInputSchema).min(1),
  // Optimistic concurrency token (H-01): when present, the edit is rejected if the row changed.
  expectedUpdatedAt: z.string().datetime().optional(),
});
export type ProductInput = z.infer<typeof productInputSchema>;
