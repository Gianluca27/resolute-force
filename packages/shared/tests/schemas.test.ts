import { describe, it, expect } from 'vitest';
import { cartLineSchema, customerSchema } from '../src/index';

describe('cartLineSchema', () => {
  it('accepts a valid line', () => {
    expect(cartLineSchema.parse({ productId: 'p1', size: 'M', qty: 2 }))
      .toEqual({ productId: 'p1', size: 'M', qty: 2 });
  });
  it('rejects qty < 1', () => {
    expect(cartLineSchema.safeParse({ productId: 'p1', size: 'M', qty: 0 }).success).toBe(false);
  });
  it('rejects an unknown size', () => {
    expect(cartLineSchema.safeParse({ productId: 'p1', size: 'XXL', qty: 1 }).success).toBe(false);
  });
});

describe('customerSchema', () => {
  it('requires a valid email and non-empty address', () => {
    expect(customerSchema.safeParse({ nombre: 'A', email: 'bad', dir: 'x', ciudad: 'y' }).success).toBe(false);
    expect(customerSchema.parse({ nombre: 'Ana', email: 'a@b.com', dir: 'Calle 1', ciudad: 'CABA' }).nombre).toBe('Ana');
  });

  const base = { nombre: 'Ana', email: 'a@b.com', dir: 'Calle 1', ciudad: 'CABA' };

  it('rejects a phone with free text but accepts real-looking and empty phones (H-07)', () => {
    expect(customerSchema.safeParse({ ...base, tel: 'abc-no-es-un-telefono!!!' }).success).toBe(false);
    expect(customerSchema.safeParse({ ...base, tel: '11 1234-5678' }).success).toBe(true);
    expect(customerSchema.safeParse({ ...base, tel: '+54 9 341 555 1234' }).success).toBe(true);
    expect(customerSchema.safeParse({ ...base, tel: '' }).success).toBe(true);
    expect(customerSchema.safeParse({ ...base }).success).toBe(true);
  });

  it('caps text field length (H-08)', () => {
    expect(customerSchema.safeParse({ ...base, nombre: 'x'.repeat(81) }).success).toBe(false);
    expect(customerSchema.safeParse({ ...base, dir: 'x'.repeat(161) }).success).toBe(false);
    expect(customerSchema.safeParse({ ...base, ciudad: 'x'.repeat(101) }).success).toBe(false);
    expect(customerSchema.safeParse({ ...base, nombre: 'x'.repeat(80) }).success).toBe(true);
  });
});
