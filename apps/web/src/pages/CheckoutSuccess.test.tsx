import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CheckoutSuccess from './CheckoutSuccess';
import { useCart } from '../store/cart';

it('confirms the order from MP return params', () => {
  render(
    <MemoryRouter initialEntries={['/checkout/success?external_reference=RF-123456&status=approved']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <CheckoutSuccess />
    </MemoryRouter>,
  );
  expect(screen.getByText(/pedido confirmado/i)).toBeInTheDocument();
  expect(screen.getByText(/RF-123456/)).toBeInTheDocument();
});

it('clears the cart on the success page (wallet return)', () => {
  useCart.setState({ items: [{ key: 'p1-M', productId: 'p1', slug: 's', line: 'L', color: 'C', size: 'M', price: 30000, imageUrl: '', qty: 1 }] });
  render(
    <MemoryRouter initialEntries={['/checkout/success?external_reference=RF-1']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <CheckoutSuccess />
    </MemoryRouter>,
  );
  expect(useCart.getState().items).toHaveLength(0);
});
