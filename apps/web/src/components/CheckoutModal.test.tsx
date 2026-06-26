import { beforeEach, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CheckoutModal from './CheckoutModal';
import { useCart } from '../store/cart';

vi.mock('../lib/api', () => ({
  api: { quote: vi.fn().mockResolvedValue({ lines: [{ productId: 'p1', line: 'Champion Mentality', color: 'Negro', size: 'M', unitPrice: 30000, qty: 1, lineTotal: 30000 }], subtotal: 30000, transferDiscount: 3000, totalTransfer: 27000, totalCard: 30000 }) },
}));

const product = { id: 'p1', slug: 's', line: 'Champion Mentality', color: 'Negro', dotColor: '#101013', tag: null, price: 30000, imageUrl: '/assets/tile-black.png', sizes: [] } as any;
beforeEach(() => { useCart.setState({ items: [], open: false, checkoutOpen: true }); useCart.getState().add(product, 'M'); });

it('walks datos → pago (server totals) → confirmado', async () => {
  render(<CheckoutModal />);
  fireEvent.change(screen.getByPlaceholderText('Tu nombre'), { target: { value: 'Ana' } });
  fireEvent.change(screen.getByPlaceholderText('tu@email.com'), { target: { value: 'ana@x.com' } });
  fireEvent.change(screen.getByPlaceholderText('Calle y número'), { target: { value: 'Calle 1' } });
  fireEvent.change(screen.getByPlaceholderText('Ciudad, Provincia'), { target: { value: 'CABA' } });
  fireEvent.click(screen.getByRole('button', { name: /continuar al pago/i }));

  expect(await screen.findByText('Forma de pago')).toBeInTheDocument();
  expect(screen.getByText('$27.000')).toBeInTheDocument(); // transfer total from server

  fireEvent.click(screen.getByRole('button', { name: /confirmar pedido/i }));
  expect(await screen.findByText(/pedido confirmado/i)).toBeInTheDocument();
  expect(screen.getAllByText(/RF-/)[0]).toBeInTheDocument();
});

it('blocks step 1 until required fields are filled', () => {
  render(<CheckoutModal />);
  fireEvent.click(screen.getByRole('button', { name: /continuar al pago/i }));
  expect(screen.queryByText('Forma de pago')).toBeNull();
});
