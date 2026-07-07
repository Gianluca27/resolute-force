import type { ProductDTO, DropDTO, ContentDTO, CartLineInput, QuoteResult, CustomerInput, PageDesignDoc } from '@resolute/shared';

export interface CardResult { status: string; orderNo: string; total?: number; count?: number; name?: string; detail?: string; }
export interface PrefResult { preferenceId: string; initPoint: string; orderNo: string; }
export interface TransferResult { orderNo: string; total: number; count: number; name: string; bankAlias: string; bankCbu: string; }

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API ${res.status} on ${path}`);
  return (await res.json()) as T;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `API ${res.status} on ${path}`);
  }
  return (await res.json()) as T;
}

export const api = {
  products: () => get<ProductDTO[]>('/api/products'),
  drop: () => get<DropDTO>('/api/drop'),
  content: () => get<ContentDTO>('/api/content'),
  pageDesign: () => get<PageDesignDoc>('/api/page-design'),
  quote: (items: CartLineInput[]) => post<QuoteResult>('/api/checkout/quote', { items }),
  paymentCard: (body: { items: CartLineInput[]; customer: CustomerInput; token: string; installments: number; paymentMethodId: string; issuerId?: string; payer: { email: string; identification?: { type: string; number: string } } }) => post<CardResult>('/api/payments/card', body),
  preference: (body: { items: CartLineInput[]; customer: CustomerInput }) => post<PrefResult>('/api/payments/preference', body),
  transferOrder: (body: { items: CartLineInput[]; customer: CustomerInput }) => post<TransferResult>('/api/orders/transfer', body),
};
