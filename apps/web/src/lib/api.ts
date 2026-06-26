import type { ProductDTO, DropDTO, ContentDTO, CartLineInput, QuoteResult } from '@resolute/shared';

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
  quote: (items: CartLineInput[]) => post<QuoteResult>('/api/checkout/quote', { items }),
};
