import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProductForm from './ProductForm';

const createProduct = vi.fn().mockResolvedValue({ id: 'new1' });
vi.mock('../../lib/adminApi', () => ({ adminApi: { createProduct: (...a: unknown[]) => createProduct(...a), uploadImage: vi.fn() } }));

beforeEach(() => createProduct.mockClear());

it('creates a product with sizes', async () => {
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><ProductForm /></MemoryRouter></QueryClientProvider>);
  fireEvent.change(screen.getByPlaceholderText('Slug'), { target: { value: 'pressure-negro' } });
  fireEvent.change(screen.getByPlaceholderText('Línea'), { target: { value: 'Pressure' } });
  fireEvent.change(screen.getByPlaceholderText('Color'), { target: { value: 'Negro' } });
  fireEvent.change(screen.getByPlaceholderText('Precio (ARS)'), { target: { value: '52000' } });
  fireEvent.change(screen.getByLabelText('stock-M'), { target: { value: '10' } });
  fireEvent.click(screen.getByRole('button', { name: /guardar/i }));
  await waitFor(() => expect(createProduct).toHaveBeenCalled());
  expect(createProduct.mock.calls[0]![0]).toMatchObject({ slug: 'pressure-negro', line: 'Pressure', price: 52000 });
});
