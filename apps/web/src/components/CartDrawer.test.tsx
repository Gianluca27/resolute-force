import { beforeEach, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CartDrawer from './CartDrawer';
import { useCart } from '../store/cart';

const product = { id: 'p1', slug: 's', line: 'Champion Mentality', color: 'Negro', dotColor: '#101013', tag: null, price: 30000, imageUrl: '/assets/tile-black.png', sizes: [] } as any;
beforeEach(() => useCart.setState({ items: [], open: true, checkoutOpen: false }));

it('lists items and shows the server-independent subtotal', () => {
  useCart.getState().add(product, 'M');
  render(<CartDrawer />);
  expect(screen.getByText(/Champion Mentality/)).toBeInTheDocument();
  // qty 1: the line total and the subtotal both read $30.000.
  expect(screen.getAllByText('$30.000')).toHaveLength(2);
});

it('increments quantity from the drawer', () => {
  useCart.getState().add(product, 'M');
  render(<CartDrawer />);
  fireEvent.click(screen.getByLabelText('Sumar uno'));
  expect(useCart.getState().items[0]!.qty).toBe(2);
});

it('shows the per-line total (qty × unit), not the unit price', () => {
  useCart.getState().add(product, 'M');
  useCart.getState().add(product, 'M'); // qty 2 → line total $60.000
  render(<CartDrawer />);
  // Both the line total and the subtotal render $60.000.
  expect(screen.getAllByText('$60.000')).toHaveLength(2);
  expect(screen.queryByText(/2 ×/)).not.toBeInTheDocument();
});

it('closes the drawer on Escape', () => {
  useCart.getState().add(product, 'M');
  render(<CartDrawer />);
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(useCart.getState().open).toBe(false);
});

it('empties the cart via "Vaciar carrito"', () => {
  useCart.getState().add(product, 'M');
  render(<CartDrawer />);
  fireEvent.click(screen.getByText(/vaciar carrito/i));
  expect(useCart.getState().items).toHaveLength(0);
});

it('shows the empty state when there are no items', () => {
  render(<CartDrawer />);
  expect(screen.getByText(/carrito está vacío/i)).toBeInTheDocument();
});
