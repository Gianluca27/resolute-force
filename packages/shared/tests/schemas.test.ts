import { describe, it, expect } from 'vitest';
import { cartLineSchema, customerSchema, PROVINCES, PROVINCE_CODES } from '../src/index';

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

describe('PROVINCES', () => {
  it('lists the 24 PAQ.AR single-letter codes (no I/O/Ñ)', () => {
    expect(PROVINCES).toHaveLength(24);
    expect(PROVINCE_CODES).toHaveLength(24);
    expect(PROVINCE_CODES).not.toContain('I');
    expect(PROVINCE_CODES).not.toContain('O');
    expect(PROVINCES.find((p) => p.code === 'C')?.name).toMatch(/CABA/);
  });
});

describe('customerSchema', () => {
  const base = {
    nombre: 'Ana', email: 'a@b.com',
    calle: 'Av. Siempreviva', altura: '742', cp: 'C1425ABC', provincia: 'C', ciudad: 'CABA',
  };

  it('requires a valid email and accepts a full structured address', () => {
    expect(customerSchema.safeParse({ ...base, email: 'bad' }).success).toBe(false);
    expect(customerSchema.parse(base).nombre).toBe('Ana');
  });

  it('rejects unknown province codes and bogus postal codes', () => {
    expect(customerSchema.safeParse({ ...base, provincia: 'I' }).success).toBe(false);
    expect(customerSchema.safeParse({ ...base, provincia: 'CABA' }).success).toBe(false);
    expect(customerSchema.safeParse({ ...base, cp: 'abc' }).success).toBe(false);
    expect(customerSchema.safeParse({ ...base, cp: '1425' }).success).toBe(true);
    expect(customerSchema.safeParse({ ...base, cp: 'S2146ZAA' }).success).toBe(true);
  });

  it('requires calle, altura and ciudad but keeps pisoDepto optional', () => {
    expect(customerSchema.safeParse({ ...base, calle: '' }).success).toBe(false);
    expect(customerSchema.safeParse({ ...base, altura: '' }).success).toBe(false);
    expect(customerSchema.safeParse({ ...base, ciudad: '' }).success).toBe(false);
    expect(customerSchema.safeParse({ ...base, pisoDepto: '3° B' }).success).toBe(true);
    expect(customerSchema.safeParse(base).success).toBe(true);
  });

  it('rejects a phone with free text but accepts real-looking and empty phones (H-07)', () => {
    expect(customerSchema.safeParse({ ...base, tel: 'abc-no-es-un-telefono!!!' }).success).toBe(false);
    expect(customerSchema.safeParse({ ...base, tel: '11 1234-5678' }).success).toBe(true);
    expect(customerSchema.safeParse({ ...base, tel: '+54 9 341 555 1234' }).success).toBe(true);
    expect(customerSchema.safeParse({ ...base, tel: '' }).success).toBe(true);
  });

  it('caps text field length (H-08)', () => {
    expect(customerSchema.safeParse({ ...base, nombre: 'x'.repeat(81) }).success).toBe(false);
    expect(customerSchema.safeParse({ ...base, calle: 'x'.repeat(121) }).success).toBe(false);
    expect(customerSchema.safeParse({ ...base, ciudad: 'x'.repeat(101) }).success).toBe(false);
    expect(customerSchema.safeParse({ ...base, nombre: 'x'.repeat(80) }).success).toBe(true);
  });
});
