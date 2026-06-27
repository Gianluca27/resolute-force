import { beforeEach, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CheckoutModal from './CheckoutModal';
import { useCart } from '../store/cart';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    quote: vi.fn().mockResolvedValue({ lines: [{ productId: 'p1', line: 'Champion Mentality', color: 'Negro', size: 'M', unitPrice: 30000, qty: 1, lineTotal: 30000 }], subtotal: 30000, transferDiscount: 3000, totalTransfer: 27000, totalCard: 30000 }),
    transferOrder: vi.fn().mockResolvedValue({ orderNo: 'RF-555000', total: 27000, count: 1, name: 'Ana', bankAlias: 'resolute.mp', bankCbu: '000' }),
    preference: vi.fn().mockResolvedValue({ preferenceId: 'PREF-1', initPoint: 'https://mp/redirect', orderNo: 'RF-1' }),
    paymentCard: vi.fn().mockResolvedValue({ status: 'approved', orderNo: 'RF-777000', total: 30000, count: 1, name: 'Ana' }),
  },
}));
vi.mock('./payment/CardBrick', () => ({ default: ({ onPay }: { onPay: (d: unknown) => Promise<void> }) => <button onClick={() => onPay({ token: 'tok', installments: 1, payment_method_id: 'visa', payer: { email: 'ana@x.com' } })}>pay-card</button> }));
vi.mock('./payment/WalletButton', () => ({ default: () => <div data-testid="wallet-button" /> }));

const product = { id: 'p1', slug: 's', line: 'Champion Mentality', color: 'Negro', dotColor: '#101013', tag: null, price: 30000, imageUrl: '/assets/tile-black.png', sizes: [] } as any;
beforeEach(() => { useCart.setState({ items: [], open: false, checkoutOpen: true }); useCart.getState().add(product, 'M'); });

async function fillDatosAndContinue() {
  fireEvent.change(screen.getByPlaceholderText('Tu nombre'), { target: { value: 'Ana' } });
  fireEvent.change(screen.getByPlaceholderText('tu@email.com'), { target: { value: 'ana@x.com' } });
  fireEvent.change(screen.getByPlaceholderText('Calle y número'), { target: { value: 'Calle 1' } });
  fireEvent.change(screen.getByPlaceholderText('Ciudad, Provincia'), { target: { value: 'CABA' } });
  fireEvent.click(screen.getByRole('button', { name: /continuar al pago/i }));
  await screen.findByText('Forma de pago');
}

it('transfer → creates a pending order and shows bank details', async () => {
  render(<CheckoutModal />);
  await fillDatosAndContinue();
  fireEvent.click(screen.getByRole('button', { name: /confirmar pedido/i }));
  expect(await screen.findByText(/pedido confirmado/i)).toBeInTheDocument();
  expect(screen.getByText(/RF-555000/)).toBeInTheDocument();
});

it('card → Brick pay approved shows confirmation', async () => {
  render(<CheckoutModal />);
  await fillDatosAndContinue();
  fireEvent.click(screen.getByRole('button', { name: 'Tarjeta' }));
  fireEvent.click(await screen.findByRole('button', { name: 'pay-card' }));
  expect(await screen.findByText(/pedido confirmado/i)).toBeInTheDocument();
  expect(screen.getByText(/RF-777000/)).toBeInTheDocument();
});

it('card → refunded (stock lost mid-payment) shows the refund notice, not a confirmation', async () => {
  vi.mocked(api.paymentCard).mockResolvedValueOnce({ status: 'refunded', orderNo: 'RF-9', detail: 'Se agotó el stock durante el pago; reintegramos el cobro.' });
  render(<CheckoutModal />);
  await fillDatosAndContinue();
  fireEvent.click(screen.getByRole('button', { name: 'Tarjeta' }));
  fireEvent.click(await screen.findByRole('button', { name: 'pay-card' }));
  expect(await screen.findByText(/reintegramos el cobro/i)).toBeInTheDocument();
  expect(screen.queryByText(/pedido confirmado/i)).not.toBeInTheDocument();
});

it('wallet → renders the Wallet button after creating a preference', async () => {
  render(<CheckoutModal />);
  await fillDatosAndContinue();
  fireEvent.click(screen.getByRole('button', { name: 'Mercado Pago' }));
  fireEvent.click(screen.getByRole('button', { name: /pagar con mercadopago/i }));
  await waitFor(() => expect(screen.getByTestId('wallet-button')).toBeInTheDocument());
});
