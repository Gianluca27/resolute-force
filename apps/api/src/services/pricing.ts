export interface Totals {
  subtotal: number;
  transferDiscount: number;
  totalTransfer: number;
  totalCard: number;
}

export function computeTotals(subtotal: number, transferPct: number): Totals {
  const transferDiscount = Math.round(subtotal * (transferPct / 100));
  return {
    subtotal,
    transferDiscount,
    totalTransfer: subtotal - transferDiscount,
    totalCard: subtotal,
  };
}
