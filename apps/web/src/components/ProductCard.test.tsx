import { render, screen, fireEvent } from '@testing-library/react';
import ProductCard from './ProductCard';

const product = {
  id: 'p1', slug: 'champion-mentality-negro', line: 'Champion Mentality', color: 'Negro',
  dotColor: '#101013', tag: 'Nuevo', price: 30000, imageUrl: '/assets/tile-black.png',
  sizes: [{ size: 'S', stock: 5 }, { size: 'M', stock: 5 }, { size: 'L', stock: 5 }, { size: 'XL', stock: 5 }],
};

it('defaults to M when M is in stock', () => {
  const onAdd = vi.fn();
  render(<ProductCard product={product as any} onAdd={onAdd} />);
  fireEvent.click(screen.getByRole('button', { name: /agregar/i }));
  expect(onAdd).toHaveBeenCalledWith(product, 'M');
});

it('defaults to the first in-stock size when M is sold out', () => {
  const onAdd = vi.fn();
  const p = { ...product, sizes: [{ size: 'S', stock: 0 }, { size: 'M', stock: 0 }, { size: 'L', stock: 5 }, { size: 'XL', stock: 5 }] };
  render(<ProductCard product={p as any} onAdd={onAdd} />);
  fireEvent.click(screen.getByRole('button', { name: /agregar/i }));
  expect(onAdd).toHaveBeenCalledWith(p, 'L'); // S and M are out of stock, so L is the default
});

it('disables out-of-stock size buttons', () => {
  const p = { ...product, sizes: [{ size: 'S', stock: 0 }, { size: 'M', stock: 5 }] };
  render(<ProductCard product={p as any} onAdd={() => {}} />);
  expect(screen.getByRole('button', { name: 'S' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'M' })).not.toBeDisabled();
});

it('disables the add button when the product is fully sold out', () => {
  const onAdd = vi.fn();
  const p = { ...product, sizes: [{ size: 'S', stock: 0 }, { size: 'M', stock: 0 }] };
  render(<ProductCard product={p as any} onAdd={onAdd} />);
  const addBtn = screen.getByRole('button', { name: /sin stock/i });
  expect(addBtn).toBeDisabled();
  fireEvent.click(addBtn);
  expect(onAdd).not.toHaveBeenCalled();
});

it('shows the price and tag', () => {
  render(<ProductCard product={product as any} onAdd={() => {}} />);
  expect(screen.getByText('$30.000')).toBeInTheDocument();
  expect(screen.getByText('Nuevo')).toBeInTheDocument();
});
