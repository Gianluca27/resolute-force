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
  expect(screen.getByText('$30.000')).toBeInTheDocument();
});

it('increments quantity from the drawer', () => {
  useCart.getState().add(product, 'M');
  render(<CartDrawer />);
  fireEvent.click(screen.getByLabelText('Sumar uno'));
  expect(useCart.getState().items[0]!.qty).toBe(2);
});

it('shows the empty state when there are no items', () => {
  render(<CartDrawer />);
  expect(screen.getByText(/carrito está vacío/i)).toBeInTheDocument();
});
