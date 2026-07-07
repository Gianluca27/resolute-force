import { render, screen } from '@testing-library/react';
import App from './App';

afterEach(() => {
  window.history.pushState({}, '', '/');
});

it('renders the landing shell', () => {
  render(<App />);
  expect(screen.getByTestId('landing')).toBeInTheDocument();
});

it('resolves /admin/correo instead of falling through to the landing redirect', async () => {
  window.history.pushState({}, '', '/admin/correo');
  render(<App />);
  // Unauthenticated: ProtectedRoute sends us to the login page. If the route is
  // missing, the catch-all redirects to "/" and the landing renders instead.
  expect(await screen.findByRole('button', { name: /ingresar/i })).toBeInTheDocument();
  expect(screen.queryByTestId('landing')).not.toBeInTheDocument();
});
