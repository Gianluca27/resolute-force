import { describe, it, expect } from 'vitest';
import { computeTotals } from '../src/services/pricing.js';

describe('computeTotals', () => {
  it('applies the transfer discount; card stays at subtotal', () => {
    expect(computeTotals(30000, 10)).toEqual({ subtotal: 30000, transferDiscount: 3000, totalTransfer: 27000, totalCard: 30000 });
  });
  it('rounds the discount to integer pesos', () => {
    expect(computeTotals(29999, 10).transferDiscount).toBe(3000);
  });
  it('handles 0% discount', () => {
    expect(computeTotals(50000, 0)).toEqual({ subtotal: 50000, transferDiscount: 0, totalTransfer: 50000, totalCard: 50000 });
  });
});
