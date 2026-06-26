import { render, screen } from '@testing-library/react';
import Hero from './Hero';

const content = { heroKicker: 'Est. 2024 · …', heroTitle1: 'Champion', heroTitle2: 'Mentality', heroSubtitle: 'No vendemos remeras…' } as any;

it('renders both hero title lines and the kicker', () => {
  render(<Hero content={content} />);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Champion');
  expect(screen.getByText('Mentality')).toBeInTheDocument();
  expect(screen.getByText(/Est\. 2024/)).toBeInTheDocument();
});
