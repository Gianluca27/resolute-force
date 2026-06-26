import { render, screen, fireEvent } from '@testing-library/react';
import Nav from './Nav';

it('shows the cart count badge and fires onOpenCart', () => {
  const onOpenCart = vi.fn();
  render(<Nav cartCount={3} onOpenCart={onOpenCart} />);
  expect(screen.getByText('3')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /carrito/i }));
  expect(onOpenCart).toHaveBeenCalledOnce();
});

it('hides the badge when the cart is empty', () => {
  render(<Nav cartCount={0} onOpenCart={() => {}} />);
  expect(screen.queryByTestId('cart-badge')).toBeNull();
});
