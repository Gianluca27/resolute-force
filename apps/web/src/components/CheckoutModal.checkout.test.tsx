import { beforeEach, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CheckoutModal from './CheckoutModal';
import { useCart } from '../store/cart';

vi.mock('../lib/api', () => ({ api: { quote: vi.fn(), transferOrder: vi.fn(), preference: vi.fn(), paymentCard: vi.fn() } }));
vi.mock('./payment/CardBrick', () => ({ default: () => <div /> }));
vi.mock('./payment/WalletButton', () => ({ default: () => <div /> }));

const product = { id: 'p1', slug: 's', line: 'Champion Mentality', color: 'Negro', dotColor: '#101013', tag: null, price: 30000, imageUrl: '/x.png', sizes: [] } as any;
beforeEach(() => {
  useCart.setState({ items: [], open: false, checkoutOpen: true, checkoutForm: { nombre: '', email: '', tel: '', dir: '', ciudad: '' } });
  useCart.getState().add(product, 'M');
});

it('associates every label with its input (H-03)', () => {
  render(<CheckoutModal />);
  // getByLabelText only succeeds when label[for] points at the input id.
  expect(screen.getByLabelText('Nombre y apellido')).toBeInTheDocument();
  expect(screen.getByLabelText('Email')).toBeInTheDocument();
  expect(screen.getByLabelText('Dirección de envío')).toBeInTheDocument();
  expect(screen.getByLabelText('Ciudad / Provincia')).toBeInTheDocument();
});

it('announces validation errors via role=alert and names the field (H-04, H-06)', () => {
  render(<CheckoutModal />);
  fireEvent.click(screen.getByRole('button', { name: /continuar al pago/i }));
  const alert = screen.getByRole('alert');
  expect(alert.textContent).toMatch(/nombre/i);
  expect(screen.getByLabelText('Nombre y apellido')).toHaveAttribute('aria-invalid', 'true');
});

it('keeps typed data when the modal is closed and reopened (H-01)', () => {
  const { unmount } = render(<CheckoutModal />);
  fireEvent.change(screen.getByLabelText('Nombre y apellido'), { target: { value: 'Juan' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'juan@test.com' } });
  unmount(); // closing the checkout unmounts the modal
  render(<CheckoutModal />); // reopen
  expect(screen.getByLabelText('Nombre y apellido')).toHaveValue('Juan');
  expect(screen.getByLabelText('Email')).toHaveValue('juan@test.com');
});
