import { render, screen } from '@testing-library/react';
import type { HeroProps } from '@resolute/shared';
import Hero from './Hero';

const props: HeroProps = {
  kicker: 'Est. 2024 · …', title1: 'Champion', title2: 'Mentality',
  subtitle: 'No vendemos remeras…', subtitleHighlight: 'Esta es la norma Resolute.',
  ctaPrimary: 'Ver colección', ctaSecondary: 'El manifiesto',
  badges: ['Envíos a todo el país'],
};

it('renders both hero title lines and the kicker', () => {
  render(<Hero props={props} />);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Champion');
  expect(screen.getByText('Mentality')).toBeInTheDocument();
  expect(screen.getByText(/Est\. 2024/)).toBeInTheDocument();
});

it('hides a CTA when its label is empty', () => {
  render(<Hero props={{ ...props, ctaSecondary: '' }} />);
  expect(screen.getByRole('link', { name: /Ver colección/ })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /manifiesto/i })).not.toBeInTheDocument();
});
