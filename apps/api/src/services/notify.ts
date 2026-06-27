import type { Order, OrderItem } from '@prisma/client';
import { prisma } from '../prisma.js';
import { sendMail } from '../lib/mailer.js';
import { env } from '../env.js';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

type OrderWithItems = Order & { items: OrderItem[] };
const fmt = (n: number) => '$' + n.toLocaleString('es-AR');

function itemsTable(o: OrderWithItems): string {
  const rows = o.items
    .map((i) => `<tr><td>${escapeHtml(i.line)}</td><td>${escapeHtml(i.color)}</td><td>${escapeHtml(i.size)}</td><td>${escapeHtml(String(i.qty))}</td><td>${fmt(i.unitPrice * i.qty)}</td></tr>`)
    .join('');
  return `<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse"><thead><tr><th>Producto</th><th>Color</th><th>Talle</th><th>Cant.</th><th>Subtotal</th></tr></thead><tbody>${rows}</tbody></table>`;
}

async function notifyAdmin(o: OrderWithItems): Promise<void> {
  if (!env.ADMIN_NOTIFY_EMAIL) return;
  const html = `
    <h2>🔥 Nuevo pedido ${escapeHtml(o.orderNo)} <small>(${escapeHtml(o.status)})</small></h2>
    <p><b>Cliente:</b> ${escapeHtml(o.customerName)} · ${escapeHtml(o.customerEmail)} · ${escapeHtml(o.customerPhone ?? '—')}</p>
    <p><b>Envío:</b> ${escapeHtml(o.address)}, ${escapeHtml(o.city)}</p>
    <p><b>Pago:</b> ${escapeHtml(o.paymentMethod)} · <b>Total:</b> ${escapeHtml(fmt(o.total))}</p>
    ${itemsTable(o)}`;
  await sendMail({ to: env.ADMIN_NOTIFY_EMAIL, subject: `Pedido ${o.orderNo} — ${o.customerName} (${fmt(o.total)})`, html });
}

async function notifyCustomer(o: OrderWithItems, bank?: { bankAlias: string; bankCbu: string }): Promise<void> {
  const bankBlock = bank?.bankAlias
    ? `<p>Para confirmar, transferí <b>${escapeHtml(fmt(o.total))}</b> a — alias <b>${escapeHtml(bank.bankAlias)}</b>${bank.bankCbu ? ` · CBU <b>${escapeHtml(bank.bankCbu)}</b>` : ''} — y respondé este email con el comprobante.</p>`
    : '';
  const html = `
    <h2>¡Gracias por tu pedido, ${escapeHtml(o.customerName)}!</h2>
    <p>Orden <b>${escapeHtml(o.orderNo)}</b> · Total <b>${escapeHtml(fmt(o.total))}</b> · Pago: ${escapeHtml(o.paymentMethod)}</p>
    ${bankBlock}
    ${itemsTable(o)}
    <p style="font-weight:700;text-transform:uppercase">Champion Mentality. Stop at Nothing 🔥</p>`;
  await sendMail({ to: o.customerEmail, subject: `Resolute Force — Pedido ${o.orderNo}`, html });
}

async function load(orderNo: string): Promise<OrderWithItems | null> {
  return prisma.order.findUnique({ where: { orderNo }, include: { items: true } });
}

export async function notifyOrderPaid(orderNo: string): Promise<void> {
  const o = await load(orderNo);
  if (!o) return;
  await Promise.allSettled([notifyAdmin(o), notifyCustomer(o)]);
}

export async function notifyTransferOrder(orderNo: string, bank: { bankAlias: string; bankCbu: string }): Promise<void> {
  const o = await load(orderNo);
  if (!o) return;
  await Promise.allSettled([notifyAdmin(o), notifyCustomer(o, bank)]);
}
