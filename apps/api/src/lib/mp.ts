import { MercadoPagoConfig, Payment, Preference } from 'mercadopago';
import type { QuoteLine, CustomerInput } from '@resolute/shared';
import { env } from '../env.js';

const client = new MercadoPagoConfig({ accessToken: env.MP_ACCESS_TOKEN });
const payment = new Payment(client);
const preference = new Preference(client);

export async function createCardPayment(i: {
  amount: number; token: string; installments: number; paymentMethodId: string; issuerId?: string;
  payerEmail: string; identification?: { type: string; number: string }; orderNo: string;
}) {
  const res = await payment.create({
    body: {
      transaction_amount: i.amount, token: i.token, installments: i.installments,
      payment_method_id: i.paymentMethodId, issuer_id: i.issuerId ? Number(i.issuerId) : undefined,
      payer: { email: i.payerEmail, identification: i.identification },
      external_reference: i.orderNo, description: `Resolute Force ${i.orderNo}`,
      notification_url: `${env.PUBLIC_API_URL}/api/payments/webhook`,
    },
  });
  return { id: res.id, status: res.status, statusDetail: res.status_detail };
}

export async function createPreference(i: { orderNo: string; customer: CustomerInput; lines: QuoteLine[] }) {
  const res = await preference.create({
    body: {
      items: i.lines.map((l) => ({ id: l.productId, title: `${l.line} · ${l.color} (${l.size})`, quantity: l.qty, unit_price: l.unitPrice, currency_id: 'ARS' })),
      payer: { name: i.customer.nombre, email: i.customer.email },
      external_reference: i.orderNo,
      back_urls: { success: `${env.PUBLIC_WEB_URL}/checkout/success`, failure: `${env.PUBLIC_WEB_URL}/checkout/failure`, pending: `${env.PUBLIC_WEB_URL}/checkout/pending` },
      auto_return: 'approved',
      notification_url: `${env.PUBLIC_API_URL}/api/payments/webhook`,
    },
  });
  return { id: String(res.id), initPoint: String(res.init_point) };
}

export async function getPayment(id: string) {
  const res = await payment.get({ id });
  return { id: res.id, status: res.status, externalReference: res.external_reference };
}
