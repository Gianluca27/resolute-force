import { render, screen } from '@testing-library/react';
import App from './App';

it('renders the Resolute Force wordmark', () => {
  render(<App />);
  expect(screen.getByText(/resolute/i)).toBeInTheDocument();
});
