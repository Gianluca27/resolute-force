import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ProductDTO, CustomerInput } from '@resolute/shared';

export interface CartItem {
  key: string; productId: string; slug: string; line: string; color: string;
  size: string; price: number; imageUrl: string; qty: number;
}

export const emptyCheckoutForm: CustomerInput = { nombre: '', email: '', tel: '', calle: '', altura: '', pisoDepto: '', cp: '', provincia: '', ciudad: '' };

// Clamp a (possibly tampered/persisted) qty to a positive integer.
const clampQty = (q: unknown): number => {
  const n = Math.floor(Number(q));
  return Number.isFinite(n) && n >= 1 ? n : 1;
};

interface CartStore {
  items: CartItem[];
  open: boolean;
  checkoutOpen: boolean;
  // Lives in the store (not in CheckoutModal) so typed data survives the modal unmounting on close (H-01).
  checkoutForm: CustomerInput;
  add: (p: ProductDTO, size: string) => void;
  inc: (key: string) => void;
  dec: (key: string) => void;
  remove: (key: string) => void;
  clear: () => void;
  reconcile: (products: ProductDTO[]) => void;
  setOpen: (open: boolean) => void;
  setCheckoutOpen: (open: boolean) => void;
  setCheckoutForm: (form: CustomerInput) => void;
  startCheckout: () => boolean;
}

export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [], open: false, checkoutOpen: false, checkoutForm: emptyCheckoutForm,
      add: (p, size) =>
        set((s) => {
          const key = `${p.id}-${size}`;
          const items = [...s.items];
          const i = items.findIndex((x) => x.key === key);
          if (i >= 0) items[i] = { ...items[i]!, qty: items[i]!.qty + 1 };
          else items.push({ key, productId: p.id, slug: p.slug, line: p.line, color: p.color, size, price: p.price, imageUrl: p.imageUrl, qty: 1 });
          return { items, open: true };
        }),
      inc: (key) => set((s) => ({ items: s.items.map((x) => (x.key === key ? { ...x, qty: x.qty + 1 } : x)) })),
      dec: (key) => set((s) => ({ items: s.items.flatMap((x) => (x.key === key ? (x.qty > 1 ? [{ ...x, qty: x.qty - 1 }] : []) : [x])) })),
      remove: (key) => set((s) => ({ items: s.items.filter((x) => x.key !== key) })),
      // Clears the cart and the checkout form (e.g. after a completed order) so the next purchase starts fresh.
      clear: () => set({ items: [], checkoutForm: emptyCheckoutForm }),
      // Refresh persisted line prices/labels from the latest catalog; drop products that no longer exist.
      reconcile: (products) =>
        set((s) => {
          const byId = new Map(products.map((p) => [p.id, p]));
          const items = s.items.flatMap((it) => {
            const p = byId.get(it.productId);
            return p ? [{ ...it, slug: p.slug, line: p.line, color: p.color, price: p.price, imageUrl: p.imageUrl, qty: clampQty(it.qty) }] : [];
          });
          return { items };
        }),
      setOpen: (open) => set({ open }),
      setCheckoutOpen: (checkoutOpen) => set({ checkoutOpen }),
      setCheckoutForm: (checkoutForm) => set({ checkoutForm }),
      startCheckout: () => {
        if (get().items.length === 0) return false;
        set({ open: false, checkoutOpen: true });
        return true;
      },
    }),
    {
      name: 'rf-cart',
      partialize: (s) => ({ items: s.items }),
      // Sanitize tampered/corrupt persisted state on hydration (qty -> positive integer).
      merge: (persisted, current) => {
        const raw = (persisted as { items?: unknown })?.items;
        const items = Array.isArray(raw)
          ? (raw as CartItem[]).filter((it) => it && typeof it.key === 'string').map((it) => ({ ...it, qty: clampQty(it.qty) }))
          : [];
        return { ...current, ...(persisted as object), items };
      },
    },
  ),
);

export const cartCount = (items: CartItem[]) => items.reduce((a, b) => a + b.qty, 0);
export const cartSubtotal = (items: CartItem[]) => items.reduce((a, b) => a + b.price * b.qty, 0);
