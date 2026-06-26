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
});
