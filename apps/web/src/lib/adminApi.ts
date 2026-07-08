import type { AdminProductDTO, ProductInput, DropDTO, ContentDTO, PageDesignAdminDTO, PageDesignDoc } from '@resolute/shared';
import type { MetricsDTO, MetricsRange } from './metricsTypes';
import { useAuth } from '../store/auth';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

function auth(): Record<string, string> {
  const t = useAuth.getState().token;
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function req<T>(
  method: string,
  path: string,
  body?: unknown,
  opts?: { authLogout?: boolean },
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...auth() },
    body: body ? JSON.stringify(body) : undefined,
  });
  // A 401 on an authed call = expired session → auto-logout. On /login it just means
  // bad credentials, so let the real API error ({error:'Credenciales inválidas'}) flow through.
  if (res.status === 401 && (opts?.authLogout ?? true)) {
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
    req<{ token: string; email: string }>('POST', '/api/admin/login', { email, password }, { authLogout: false }),
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
    if (!res.ok) {
      // Surface the server's reason (e.g. "supera el límite de 6 MB") instead of a blanket message.
      const e = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(e.error ?? 'No se pudo subir la imagen');
    }
    return (await res.json()) as AdminProductDTO;
  },
  orders: () => req<any[]>('GET', '/api/admin/orders'),
  setOrderStatus: (id: string, status: string) =>
    req<any>('PATCH', `/api/admin/orders/${id}/status`, { status }),
  getDrop: () => req<DropDTO>('GET', '/api/admin/config/drop'),
  putDrop: (d: DropDTO) => req<DropDTO>('PUT', '/api/admin/config/drop', d),
  getContent: () => req<ContentDTO>('GET', '/api/admin/config/content'),
  putContent: (c: ContentDTO) => req<ContentDTO>('PUT', '/api/admin/config/content', c),
  metrics: (range: MetricsRange = '30d') => req<MetricsDTO>('GET', `/api/admin/metrics?range=${range}`),
  getPageDesign: () => req<PageDesignAdminDTO>('GET', '/api/admin/page-design'),
  putPageDesign: (doc: PageDesignDoc, updatedAt?: string) =>
    req<PageDesignAdminDTO>('PUT', '/api/admin/page-design', { doc, updatedAt }),
  publishPageDesign: () => req<PageDesignAdminDTO>('POST', '/api/admin/page-design/publish'),
  discardPageDesign: () => req<PageDesignAdminDTO>('POST', '/api/admin/page-design/discard'),
  listPageDesignVersions: () =>
    req<{ versions: Array<{ id: number; publishedAt: string }> }>('GET', '/api/admin/page-design/versions'),
  restorePageDesignVersion: (id: number) =>
    req<PageDesignAdminDTO>('POST', `/api/admin/page-design/versions/${id}/restore`),
  uploadAsset: async (file: File) => {
    const fd = new FormData();
    fd.append('image', file);
    const res = await fetch(`${BASE}/api/admin/uploads`, { method: 'POST', headers: { ...auth() }, body: fd });
    if (res.status === 401) { useAuth.getState().logout(); throw new Error('Sesión expirada'); }
    if (!res.ok) {
      const e = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(e.error ?? 'No se pudo subir la imagen');
    }
    return (await res.json()) as { url: string; publicId: string };
  },
  // PAQ.AR (Correo Argentino)
  shippingStatus: () => req<{ configured: boolean; valid: boolean | null }>('GET', '/api/admin/shipping/status'),
  getShippingConfig: () => req<any | null>('GET', '/api/admin/shipping/config'),
  putShippingConfig: (c: any) => req<any>('PUT', '/api/admin/shipping/config', c),
  agencies: (f: { stateId?: string; pickupAvailability?: boolean; packageReception?: boolean } = {}) => {
    const qs = new URLSearchParams();
    if (f.stateId) qs.set('stateId', f.stateId);
    if (f.pickupAvailability !== undefined) qs.set('pickupAvailability', String(f.pickupAvailability));
    if (f.packageReception !== undefined) qs.set('packageReception', String(f.packageReception));
    const q = qs.toString();
    return req<any[]>('GET', `/api/admin/shipping/agencies${q ? `?${q}` : ''}`);
  },
  shipments: () => req<any[]>('GET', '/api/admin/shipping/shipments'),
  createShipment: (orderId: string, body: unknown) => req<any>('POST', `/api/admin/orders/${orderId}/shipment`, body),
  cancelShipment: (id: string) => req<any>('POST', `/api/admin/shipping/shipments/${id}/cancel`),
  shipmentLabel: (id: string) => req<{ fileName: string; fileBase64: string }>('GET', `/api/admin/shipping/shipments/${id}/label`),
  shipmentTracking: (id: string) => req<any>('GET', `/api/admin/shipping/shipments/${id}/tracking`),
};
