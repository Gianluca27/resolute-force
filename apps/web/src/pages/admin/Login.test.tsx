import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from './Login';
import { useAuth } from '../../store/auth';

vi.mock('../../lib/adminApi', () => ({
  adminApi: {
    login: vi.fn().mockResolvedValue({ token: 'jwt-123', email: 'admin@test.com' }),
  },
}));

beforeEach(() => useAuth.setState({ token: null, email: null }));

it('logs in and stores the session', async () => {
  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Login />
    </MemoryRouter>,
  );
  fireEvent.change(screen.getByPlaceholderText(/email/i), { target: { value: 'admin@test.com' } });
  fireEvent.change(screen.getByPlaceholderText(/contraseña/i), {
    target: { value: 'secret123' },
  });
  fireEvent.click(screen.getByRole('button', { name: /ingresar/i }));
  await waitFor(() => expect(useAuth.getState().token).toBe('jwt-123'));
});
