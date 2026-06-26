import type { CartLineInput, QuoteResult, QuoteLine } from '@resolute/shared';
import { prisma } from '../prisma.js';
import { computeTotals } from './pricing.js';

export async function quote(items: CartLineInput[]): Promise<QuoteResult> {
  const ids = [...new Set(items.map((i) => i.productId))];
  const products = await prisma.product.findMany({ where: { id: { in: ids }, active: true }, include: { variants: true } });
  const byId = new Map(products.map((p) => [p.id, p]));

  const lines: QuoteLine[] = [];
  for (const it of items) {
    const p = byId.get(it.productId);
    if (!p) throw new Error(`Producto inexistente o inactivo: ${it.productId}`);
    const variant = p.variants.find((v) => v.size === it.size);
    if (!variant) throw new Error(`Talle ${it.size} no disponible para ${p.line} (${p.color})`);
    if (variant.stock < it.qty) throw new Error(`Sin stock suficiente de ${p.line} (${p.color}) talle ${it.size}`);
    lines.push({ productId: p.id, line: p.line, color: p.color, size: it.size, unitPrice: p.price, qty: it.qty, lineTotal: p.price * it.qty });
  }

  const subtotal = lines.reduce((a, l) => a + l.lineTotal, 0);
  const content = await prisma.siteContent.findUnique({ where: { id: 1 } });
  const t = computeTotals(subtotal, content?.transferDiscountPct ?? 10);
  return { lines, subtotal: t.subtotal, transferDiscount: t.transferDiscount, totalTransfer: t.totalTransfer, totalCard: t.totalCard };
}
