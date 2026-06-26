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
});
