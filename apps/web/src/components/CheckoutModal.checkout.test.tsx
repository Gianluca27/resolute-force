import { beforeEach, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CheckoutModal from './CheckoutModal';
import { useCart, emptyCheckoutForm } from '../store/cart';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({ api: { quote: vi.fn(), transferOrder: vi.fn(), preference: vi.fn(), paymentCard: vi.fn() } }));
vi.mock('./payment/CardBrick', () => ({ default: () => <div /> }));
vi.mock('./payment/WalletButton', () => ({ default: () => <div /> }));

const product = { id: 'p1', slug: 's', line: 'Champion Mentality', color: 'Negro', dotColor: '#101013', tag: null, price: 30000, imageUrl: '/x.png', sizes: [] } as any;
beforeEach(() => {
  vi.mocked(api.quote).mockReset();
  useCart.setState({ items: [], open: false, checkoutOpen: true, checkoutForm: { ...emptyCheckoutForm } });
  useCart.getState().add(product, 'M');
});

it('associates every label with its input (H-03)', () => {
  render(<CheckoutModal />);
  // getByLabelText only succeeds when label[for] points at the input id.
  expect(screen.getByLabelText('Nombre y apellido')).toBeInTheDocument();
  expect(screen.getByLabelText('Email')).toBeInTheDocument();
  expect(screen.getByLabelText('Calle')).toBeInTheDocument();
  expect(screen.getByLabelText('Altura')).toBeInTheDocument();
  expect(screen.getByLabelText('Piso / Depto (opcional)')).toBeInTheDocument();
  expect(screen.getByLabelText('Código postal')).toBeInTheDocument();
  expect(screen.getByLabelText('Provincia')).toBeInTheDocument();
  expect(screen.getByLabelText('Ciudad')).toBeInTheDocument();
});

it('announces validation errors via role=alert and names the field (H-04, H-06)', () => {
  render(<CheckoutModal />);
  fireEvent.click(screen.getByRole('button', { name: /continuar al pago/i }));
  const alert = screen.getByRole('alert');
  expect(alert.textContent).toMatch(/nombre/i);
  expect(alert.textContent).toMatch(/calle/i);
  expect(alert.textContent).toMatch(/código postal/i);
  expect(screen.getByLabelText('Nombre y apellido')).toHaveAttribute('aria-invalid', 'true');
});

it('keeps typed data when the modal is closed and reopened (H-01)', () => {
  const { unmount } = render(<CheckoutModal />);
  fireEvent.change(screen.getByLabelText('Nombre y apellido'), { target: { value: 'Juan' } });
  fireEvent.change(screen.getByLabelText('Calle'), { target: { value: 'Av. Siempreviva' } });
  unmount(); // closing the checkout unmounts the modal
  render(<CheckoutModal />); // reopen
  expect(screen.getByLabelText('Nombre y apellido')).toHaveValue('Juan');
  expect(screen.getByLabelText('Calle')).toHaveValue('Av. Siempreviva');
});

it('submits the structured address to the quote step when valid', async () => {
  vi.mocked(api.quote).mockResolvedValue({ lines: [], subtotal: 30000, transferDiscount: 3000, totalTransfer: 27000, totalCard: 30000 } as any);
  render(<CheckoutModal />);
  fireEvent.change(screen.getByLabelText('Nombre y apellido'), { target: { value: 'Ana' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ana@x.com' } });
  fireEvent.change(screen.getByLabelText('Calle'), { target: { value: 'Calle 1' } });
  fireEvent.change(screen.getByLabelText('Altura'), { target: { value: '742' } });
  fireEvent.change(screen.getByLabelText('Código postal'), { target: { value: 'C1425ABC' } });
  fireEvent.change(screen.getByLabelText('Provincia'), { target: { value: 'C' } });
  fireEvent.change(screen.getByLabelText('Ciudad'), { target: { value: 'CABA' } });
  fireEvent.click(screen.getByRole('button', { name: /continuar al pago/i }));
  await waitFor(() => expect(api.quote).toHaveBeenCalled());
  expect(useCart.getState().checkoutForm.provincia).toBe('C');
});
