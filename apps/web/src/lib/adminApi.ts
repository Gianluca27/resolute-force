import type { AdminProductDTO, ProductInput, DropDTO, ContentDTO } from '@resolute/shared';
import { useAuth } from '../store/auth';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

function auth(): Record<string, string> {
  const t = useAuth.getState().token;
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...auth() },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    useAuth.getState().logout();
    throw new Error('Sesión expirada');
  }
  if (!res.ok) {
    const e = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(e.error ?? `Error ${res.status}`);
  }
  return (await res.json()) as T;
}

export const adminApi = {
  login: (email: string, password: string) =>
    req<{ token: string; email: string }>('POST', '/api/admin/login', { email, password }),
  products: () => req<AdminProductDTO[]>('GET', '/api/admin/products'),
  createProduct: (p: ProductInput) => req<AdminProductDTO>('POST', '/api/admin/products', p),
  updateProduct: (id: string, p: ProductInput) =>
    req<AdminProductDTO>('PUT', `/api/admin/products/${id}`, p),
  deleteProduct: (id: string) => req<{ ok: true }>('DELETE', `/api/admin/products/${id}`),
  uploadImage: async (id: string, file: File) => {
    const fd = new FormData();
    fd.append('image', file);
    const res = await fetch(`${BASE}/api/admin/products/${id}/image`, {
      method: 'POST',
      headers: { ...auth() },
      body: fd,
    });
    if (res.status === 401) { useAuth.getState().logout(); throw new Error('Sesión expirada'); }
    if (!res.ok) throw new Error('No se pudo subir la imagen');
    return (await res.json()) as AdminProductDTO;
  },
  orders: () => req<any[]>('GET', '/api/admin/orders'),
  setOrderStatus: (id: string, status: string) =>
    req<any>('PATCH', `/api/admin/orders/${id}/status`, { status }),
  getDrop: () => req<DropDTO>('GET', '/api/admin/config/drop'),
  putDrop: (d: DropDTO) => req<DropDTO>('PUT', '/api/admin/config/drop', d),
  getContent: () => req<ContentDTO>('GET', '/api/admin/config/content'),
  putContent: (c: ContentDTO) => req<ContentDTO>('PUT', '/api/admin/config/content', c),
  metrics: () => req<any>('GET', '/api/admin/metrics'),
};
