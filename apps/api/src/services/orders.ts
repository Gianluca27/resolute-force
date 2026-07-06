import type { CartLineInput, CustomerInput } from '@resolute/shared';
import { prisma } from '../prisma.js';
import { quote } from './quote.js';

export type PayMethod = 'transfer' | 'card' | 'wallet';

/** Thrown when stock cannot be reserved at payment-confirmation time (after funds may already be captured). */
export class OutOfStockError extends Error {
  constructor(msg: string) { super(msg); this.name = 'OutOfStockError'; }
}

async function uniqueOrderNo(): Promise<string> {
  for (let i = 0; i < 6; i++) {
    const no = 'RF-' + Math.floor(100000 + Math.random() * 900000);
    if (!(await prisma.order.findUnique({ where: { orderNo: no } }))) return no;
  }
  throw new Error('No se pudo generar número de orden');
}

export async function createOrder(input: { items: CartLineInput[]; customer: CustomerInput; method: PayMethod }) {
  const q = await quote(input.items); // re-price + stock check, server-side
  const discount = input.method === 'transfer' ? q.transferDiscount : 0;
  const total = input.method === 'transfer' ? q.totalTransfer : q.totalCard;
  const orderNo = await uniqueOrderNo();
  const c = input.customer;
  const order = await prisma.order.create({
    data: {
      orderNo,
      customerName: c.nombre, customerEmail: c.email, customerPhone: c.tel || null,
      // address/city: representación legible usada en emails y listados; los campos
      // shipping* estructurados son los que consume el alta de envío PAQ.AR.
      address: `${c.calle} ${c.altura}${c.pisoDepto ? `, ${c.pisoDepto}` : ''}`, city: c.ciudad,
      shippingStreet: c.calle, shippingStreetNumber: c.altura, shippingFloor: c.pisoDepto || null,
      shippingZip: c.cp, shippingProvince: c.provincia,
      paymentMethod: input.method, status: 'pending', subtotal: q.subtotal, discount, total,
      items: { create: q.lines.map((l) => ({ productId: l.productId, line: l.line, color: l.color, size: l.size, unitPrice: l.unitPrice, qty: l.qty })) },
    },
    include: { items: true },
  });
  return { order, quote: q };
}

export async function markPaidByOrderNo(orderNo: string, mpPaymentId: string, notifyStatus: OrderStatus = 'paid') {
  // Persist the payment id up front (outside the tx) so a stock-failure rollback can never lose it —
  // the charge must stay traceable/refundable even when the order can't be fulfilled.
  await prisma.order.updateMany({ where: { orderNo, mpPaymentId: null }, data: { mpPaymentId } });

  const { order, transitioned } = await prisma.$transaction(async (tx) => {
    // Atomic claim: only one concurrent caller can win this update
    const claimed = await tx.order.updateMany({
      where: { orderNo, status: { notIn: ['paid', 'shipped'] } },
      data: { status: 'paid', mpPaymentId },
    });
    if (claimed.count !== 1) {
      // Already paid/shipped — idempotent, return current state
      return { order: await tx.order.findUniqueOrThrow({ where: { orderNo }, include: { items: true } }), transitioned: false };
    }

    // Decrement stock for each line — conditional guard prevents oversell
    const order = await tx.order.findUniqueOrThrow({ where: { orderNo }, include: { items: true } });
    for (const it of order.items) {
      if (!it.productId) continue;
      const r = await tx.variant.updateMany({
        where: { productId: it.productId, size: it.size, stock: { gte: it.qty } },
        data: { stock: { decrement: it.qty } },
      });
      if (r.count !== 1) throw new OutOfStockError(`Sin stock al confirmar ${it.line} talle ${it.size}`);
    }
    return { order, transitioned: true };
  });

  if (transitioned) {
    void import('./notify.js').then((m) => m.notifyOrderPaid(orderNo, notifyStatus)).catch((e) => console.error('[notify:paid]', e));
  }
  return order;
}

export type OrderStatus = 'pending' | 'paid' | 'shipped' | 'cancelled';
const STOCK_HELD = new Set<OrderStatus>(['paid', 'shipped']);

export class InvalidStatusTransition extends Error {
  constructor(msg: string) { super(msg); this.name = 'InvalidStatusTransition'; }
}

/** Reverse a previously-confirmed order (MP refund/chargeback/cancellation): restock + cancel. No-op if not stock-held. */
export async function reverseOrderIfPaid(orderNo: string): Promise<void> {
  const reversed = await prisma.$transaction(async (tx) => {
    // Atomic claim: flip stock-held → cancelled exactly once. Mirrors the decrement guard in
    // markPaidByOrderNo so concurrent reversals (e.g. refunded + charged_back for the same payment)
    // see count===0 and skip the restock — never double-restock and inflate inventory.
    const claimed = await tx.order.updateMany({
      where: { orderNo, status: { in: ['paid', 'shipped'] } },
      data: { status: 'cancelled' },
    });
    if (claimed.count !== 1) return false;
    const order = await tx.order.findUniqueOrThrow({ where: { orderNo }, include: { items: true } });
    for (const it of order.items) {
      if (!it.productId) continue;
      await tx.variant.updateMany({ where: { productId: it.productId, size: it.size }, data: { stock: { increment: it.qty } } });
    }
    return true;
  });

  // Only the winning reversal notifies — the count!==1 losers already returned false, so the buyer
  // gets exactly one "pedido cancelado" email even under concurrent refund+chargeback (H-02).
  if (reversed) {
    void import('./notify.js').then((m) => m.notifyOrderReversed(orderNo)).catch((e) => console.error('[notify:reversed]', e));
  }
}

/** Return decremented stock to inventory for every line of an order. */
async function restockOrder(orderNo: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { orderNo }, include: { items: true } });
    for (const it of order.items) {
      if (!it.productId) continue;
      await tx.variant.updateMany({ where: { productId: it.productId, size: it.size }, data: { stock: { increment: it.qty } } });
    }
  });
}

/**
 * Admin status change with a single invariant: stock is held iff status ∈ {paid, shipped}.
 * Entering a held state reserves stock (oversell-safe); leaving it to 'cancelled' restocks.
 * Returns null if the order doesn't exist (route → 404).
 */
export async function changeOrderStatus(orderId: string, to: OrderStatus) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return null;
  const from = order.status as OrderStatus;
  if (from === to) return prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });

  if (STOCK_HELD.has(from) && to === 'pending') {
    throw new InvalidStatusTransition('No se puede revertir un pedido pagado a pendiente');
  }

  if (!STOCK_HELD.has(from) && STOCK_HELD.has(to)) {
    // Reserve stock via the atomic, oversell-guarded claim, then land on the requested state.
    // Pass `to` so the admin email header shows the final status, not the transient 'paid' (H-05).
    await markPaidByOrderNo(order.orderNo, order.mpPaymentId ?? 'manual', to);
    if (to !== 'paid') await prisma.order.update({ where: { id: orderId }, data: { status: to } });
  } else if (STOCK_HELD.has(from) && to === 'cancelled') {
    await restockOrder(order.orderNo);
    await prisma.order.update({ where: { id: orderId }, data: { status: 'cancelled' } });
  } else {
    await prisma.order.update({ where: { id: orderId }, data: { status: to } });
  }
  return prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
}
