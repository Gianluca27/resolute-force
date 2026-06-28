import type { Order, OrderItem } from '@prisma/client';
import { prisma } from '../prisma.js';
import { sendMail } from '../lib/mailer.js';
import { env } from '../env.js';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Neutralize CR/LF and other control chars before user data enters an email header (subject).
// nodemailer encodes headers, but this is defense-in-depth against CRLF/Bcc injection (H-03).
function headerSafe(s: string): string {
  let out = '';
  for (const ch of s) {
    const code = ch.charCodeAt(0);
    out += code < 0x20 || code === 0x7f ? ' ' : ch;
  }
  return out.trim();
}

type OrderWithItems = Order & { items: OrderItem[] };
const fmt = (n: number) => '$' + n.toLocaleString('es-AR');

function itemsTable(o: OrderWithItems): string {
  const rows = o.items
    .map((i) => `<tr><td>${escapeHtml(i.line)}</td><td>${escapeHtml(i.color)}</td><td>${escapeHtml(i.size)}</td><td>${escapeHtml(String(i.qty))}</td><td>${fmt(i.unitPrice * i.qty)}</td></tr>`)
    .join('');
  return `<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse"><thead><tr><th>Producto</th><th>Color</th><th>Talle</th><th>Cant.</th><th>Subtotal</th></tr></thead><tbody>${rows}</tbody></table>`;
}

// statusOverride makes the admin header deterministic when the order is mid-transition (e.g. the
// pending→shipped path lands on 'paid' then 'shipped'): the caller passes the intended final
// status instead of letting the fire-and-forget notify re-read a racy value from the DB (H-05).
async function notifyAdmin(o: OrderWithItems, statusOverride?: string): Promise<void> {
  if (!env.ADMIN_NOTIFY_EMAIL) return;
  const status = statusOverride ?? o.status;
  const html = `
    <h2>🔥 Nuevo pedido ${escapeHtml(o.orderNo)} <small>(${escapeHtml(status)})</small></h2>
    <p><b>Cliente:</b> ${escapeHtml(o.customerName)} · ${escapeHtml(o.customerEmail)} · ${escapeHtml(o.customerPhone ?? '—')}</p>
    <p><b>Envío:</b> ${escapeHtml(o.address)}, ${escapeHtml(o.city)}</p>
    <p><b>Pago:</b> ${escapeHtml(o.paymentMethod)} · <b>Total:</b> ${escapeHtml(fmt(o.total))}</p>
    ${itemsTable(o)}`;
  await sendMail({ to: env.ADMIN_NOTIFY_EMAIL, subject: `Pedido ${headerSafe(o.orderNo)} — ${headerSafe(o.customerName)} (${fmt(o.total)})`, html });
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
  await sendMail({ to: o.customerEmail, subject: `Resolute Force — Pedido ${headerSafe(o.orderNo)}`, html });
}

// Reversal notices (refund/chargeback/cancellation): the buyer paid and was reimbursed, so they
// (and the admin) must hear about it — otherwise the customer waits for an order that won't ship (H-02).
async function notifyAdminReversed(o: OrderWithItems): Promise<void> {
  if (!env.ADMIN_NOTIFY_EMAIL) return;
  const html = `
    <h2>↩️ Pedido ${escapeHtml(o.orderNo)} revertido <small>(cancelado/reembolsado)</small></h2>
    <p><b>Cliente:</b> ${escapeHtml(o.customerName)} · ${escapeHtml(o.customerEmail)} · ${escapeHtml(o.customerPhone ?? '—')}</p>
    <p><b>Pago:</b> ${escapeHtml(o.paymentMethod)} · <b>Total reintegrado:</b> ${escapeHtml(fmt(o.total))}</p>
    ${itemsTable(o)}`;
  await sendMail({ to: env.ADMIN_NOTIFY_EMAIL, subject: `Pedido ${headerSafe(o.orderNo)} revertido — ${headerSafe(o.customerName)} (${fmt(o.total)})`, html });
}

async function notifyCustomerReversed(o: OrderWithItems): Promise<void> {
  const html = `
    <h2>Tu pedido ${escapeHtml(o.orderNo)} fue cancelado</h2>
    <p>Hola ${escapeHtml(o.customerName)}, cancelamos tu pedido <b>${escapeHtml(o.orderNo)}</b> por <b>${escapeHtml(fmt(o.total))}</b> y reintegramos el pago.</p>
    <p>Según tu medio de pago, el reintegro puede tardar unos días hábiles en verse reflejado. Cualquier duda, respondé este email.</p>
    ${itemsTable(o)}
    <p style="font-weight:700;text-transform:uppercase">Champion Mentality. Stop at Nothing 🔥</p>`;
  await sendMail({ to: o.customerEmail, subject: `Resolute Force — Pedido ${headerSafe(o.orderNo)} cancelado`, html });
}

async function load(orderNo: string): Promise<OrderWithItems | null> {
  return prisma.order.findUnique({ where: { orderNo }, include: { items: true } });
}

export async function notifyOrderPaid(orderNo: string, statusOverride?: string): Promise<void> {
  const o = await load(orderNo);
  if (!o) return;
  await Promise.allSettled([notifyAdmin(o, statusOverride), notifyCustomer(o)]);
}

export async function notifyTransferOrder(orderNo: string, bank: { bankAlias: string; bankCbu: string }): Promise<void> {
  const o = await load(orderNo);
  if (!o) return;
  await Promise.allSettled([notifyAdmin(o), notifyCustomer(o, bank)]);
}

/** Notify customer + admin that a confirmed order was reversed (refund/chargeback/cancellation). */
export async function notifyOrderReversed(orderNo: string): Promise<void> {
  const o = await load(orderNo);
  if (!o) return;
  await Promise.allSettled([notifyAdminReversed(o), notifyCustomerReversed(o)]);
}
