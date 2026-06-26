import { render, screen } from '@testing-library/react';
import App from './App';

it('renders the landing shell', () => {
  render(<App />);
  expect(screen.getByTestId('landing')).toBeInTheDocument();
});
