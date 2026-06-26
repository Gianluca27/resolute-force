import type { CartLineInput, CustomerInput } from '@resolute/shared';
import { prisma } from '../prisma.js';
import { quote } from './quote.js';

export type PayMethod = 'transfer' | 'card' | 'wallet';

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
  const order = await prisma.order.create({
    data: {
      orderNo,
      customerName: input.customer.nombre, customerEmail: input.customer.email, customerPhone: input.customer.tel ?? null,
      address: input.customer.dir, city: input.customer.ciudad,
      paymentMethod: input.method, status: 'pending', subtotal: q.subtotal, discount, total,
      items: { create: q.lines.map((l) => ({ productId: l.productId, line: l.line, color: l.color, size: l.size, unitPrice: l.unitPrice, qty: l.qty })) },
    },
    include: { items: true },
  });
  return { order, quote: q };
}

export async function markPaidByOrderNo(orderNo: string, mpPaymentId: string) {
  return prisma.$transaction(async (tx) => {
    // Atomic claim: only one concurrent caller can win this update
    const claimed = await tx.order.updateMany({
      where: { orderNo, status: { notIn: ['paid', 'shipped'] } },
      data: { status: 'paid', mpPaymentId },
    });
    if (claimed.count !== 1) {
      // Already paid/shipped — idempotent, return current state
      return tx.order.findUniqueOrThrow({ where: { orderNo }, include: { items: true } });
    }

    // Decrement stock for each line — conditional guard prevents oversell
    const order = await tx.order.findUniqueOrThrow({ where: { orderNo }, include: { items: true } });
    for (const it of order.items) {
      if (!it.productId) continue;
      const r = await tx.variant.updateMany({
        where: { productId: it.productId, size: it.size, stock: { gte: it.qty } },
        data: { stock: { decrement: it.qty } },
      });
      if (r.count !== 1) throw new Error(`Sin stock al confirmar ${it.line} talle ${it.size}`);
    }
    return order;
  });
}
