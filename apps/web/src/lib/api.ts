import type { ProductDTO, DropDTO, ContentDTO } from '@resolute/shared';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API ${res.status} on ${path}`);
  return (await res.json()) as T;
}

export const api = {
  products: () => get<ProductDTO[]>('/api/products'),
  drop: () => get<DropDTO>('/api/drop'),
  content: () => get<ContentDTO>('/api/content'),
};
