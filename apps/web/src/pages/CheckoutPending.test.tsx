import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CheckoutPending from './CheckoutPending';
import { useCart } from '../store/cart';

it('shows a pending (not confirmed) message and keeps the cart intact', () => {
  useCart.setState({ items: [{ key: 'p1-M', productId: 'p1', slug: 's', line: 'L', color: 'C', size: 'M', price: 30000, imageUrl: '', qty: 1 }] });
  render(
    <MemoryRouter initialEntries={['/checkout/pending?external_reference=RF-77']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <CheckoutPending />
    </MemoryRouter>,
  );
  expect(screen.getByText(/en proceso/i)).toBeInTheDocument();
  expect(screen.queryByText(/pedido confirmado/i)).not.toBeInTheDocument();
  expect(useCart.getState().items).toHaveLength(1); // not cleared — payment unconfirmed
});
