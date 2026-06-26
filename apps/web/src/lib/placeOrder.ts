import type { CartLineInput, CustomerInput, QuoteResult } from '@resolute/shared';

export type PayMethod = 'transfer' | 'card' | 'wallet';
export interface PlacedOrder { orderNo: string; total: number; count: number; pay: PayMethod; name: string; }
export type PlaceOrder = (args: { items: CartLineInput[]; customer: CustomerInput; method: PayMethod; quote: QuoteResult }) => Promise<PlacedOrder>;

// M3 client-only stub — mirrors the original demo confirmation. Replaced in M4.
export const stubPlaceOrder: PlaceOrder = async ({ customer, method, quote }) => ({
  orderNo: 'RF-' + Math.floor(100000 + Math.random() * 900000),
  total: method === 'transfer' ? quote.totalTransfer : quote.totalCard,
  count: quote.lines.reduce((a, l) => a + l.qty, 0),
  pay: method,
  name: customer.nombre || 'Atleta',
});
