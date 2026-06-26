import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CheckoutSuccess from './CheckoutSuccess';

it('confirms the order from MP return params', () => {
  render(
    <MemoryRouter initialEntries={['/checkout/success?external_reference=RF-123456&status=approved']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <CheckoutSuccess />
    </MemoryRouter>,
  );
  expect(screen.getByText(/pedido confirmado/i)).toBeInTheDocument();
  expect(screen.getByText(/RF-123456/)).toBeInTheDocument();
});
