import { beforeEach, describe, it, expect } from 'vitest';
import { useCart, cartCount, cartSubtotal } from './cart';

const product = { id: 'p1', slug: 's', line: 'Champion Mentality', color: 'Negro', dotColor: '#101013', tag: null, price: 30000, imageUrl: '/assets/tile-black.png', sizes: [] } as any;

beforeEach(() => useCart.setState({ items: [], open: false, checkoutOpen: false }));

describe('cart store', () => {
  it('adds and merges by product+size, opening the drawer', () => {
    useCart.getState().add(product, 'M');
    useCart.getState().add(product, 'M');
    useCart.getState().add(product, 'L');
    const { items, open } = useCart.getState();
    expect(open).toBe(true);
    expect(items).toHaveLength(2);
    expect(items.find((i) => i.key === 'p1-M')!.qty).toBe(2);
    expect(cartCount(items)).toBe(3);
    expect(cartSubtotal(items)).toBe(90000);
  });

  it('dec removes the line at qty 0', () => {
    useCart.getState().add(product, 'M');
    useCart.getState().dec('p1-M');
    expect(useCart.getState().items).toHaveLength(0);
  });

  it('startCheckout is a no-op on an empty cart', () => {
    expect(useCart.getState().startCheckout()).toBe(false);
    expect(useCart.getState().checkoutOpen).toBe(false);
  });

  it('reconciles persisted prices against the latest catalog and drops vanished products', () => {
    useCart.setState({
      items: [
        { key: 'p1-M', productId: 'p1', slug: 's', line: 'L', color: 'C', size: 'M', price: 20000, imageUrl: '', qty: 2 },
        { key: 'gone-M', productId: 'gone', slug: 'g', line: 'G', color: 'X', size: 'M', price: 9000, imageUrl: '', qty: 1 },
      ],
    });
    useCart.getState().reconcile([
      { id: 'p1', slug: 's2', line: 'Nueva', color: 'Negro', dotColor: '#000', tag: null, price: 35000, imageUrl: '/new.png', sizes: [{ size: 'M', stock: 5 }] },
    ]);
    const items = useCart.getState().items;
    expect(items).toHaveLength(1); // 'gone' is no longer in the catalog
    expect(items[0]!.price).toBe(35000); // price refreshed from the server
    expect(items[0]!.qty).toBe(2); // quantity preserved
  });

  it('clamps tampered (negative/non-integer) quantities to a positive integer on reconcile', () => {
    useCart.setState({
      items: [
        { key: 'p1-M', productId: 'p1', slug: 's', line: 'L', color: 'C', size: 'M', price: 30000, imageUrl: '', qty: -5 },
        { key: 'p1-L', productId: 'p1', slug: 's', line: 'L', color: 'C', size: 'L', price: 30000, imageUrl: '', qty: 1.5 },
      ],
    });
    useCart.getState().reconcile([
      { id: 'p1', slug: 's', line: 'L', color: 'C', dotColor: '#000', tag: null, price: 30000, imageUrl: '', sizes: [{ size: 'M', stock: 5 }] },
    ]);
    const items = useCart.getState().items;
    expect(items.find((i) => i.key === 'p1-M')!.qty).toBe(1); // -5 clamped up to 1
    expect(items.find((i) => i.key === 'p1-L')!.qty).toBe(1); // 1.5 floored to 1
    expect(cartSubtotal(items)).toBe(60000); // no negative subtotal
  });
});
