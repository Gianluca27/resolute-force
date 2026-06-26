import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ProductDTO } from '@resolute/shared';

export interface CartItem {
  key: string; productId: string; slug: string; line: string; color: string;
  size: string; price: number; imageUrl: string; qty: number;
}

interface CartStore {
  items: CartItem[];
  open: boolean;
  checkoutOpen: boolean;
  add: (p: ProductDTO, size: string) => void;
  inc: (key: string) => void;
  dec: (key: string) => void;
  remove: (key: string) => void;
  clear: () => void;
  setOpen: (open: boolean) => void;
  setCheckoutOpen: (open: boolean) => void;
  startCheckout: () => boolean;
}

export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [], open: false, checkoutOpen: false,
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
      clear: () => set({ items: [] }),
      setOpen: (open) => set({ open }),
      setCheckoutOpen: (checkoutOpen) => set({ checkoutOpen }),
      startCheckout: () => {
        if (get().items.length === 0) return false;
        set({ open: false, checkoutOpen: true });
        return true;
      },
    }),
    { name: 'rf-cart', partialize: (s) => ({ items: s.items }) },
  ),
);

export const cartCount = (items: CartItem[]) => items.reduce((a, b) => a + b.qty, 0);
export const cartSubtotal = (items: CartItem[]) => items.reduce((a, b) => a + b.price * b.qty, 0);
