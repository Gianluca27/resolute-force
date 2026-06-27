import { render, screen } from '@testing-library/react';
import Proximos from './Proximos';

const drop = { targetAt: '2026-08-15T20:00:00-03:00', visible: true, title: 'Algo se está forjando', teaser: 'Un nuevo drop…' };

it('renders the countdown labels when visible', () => {
  render(<Proximos drop={drop} />);
  expect(screen.getByText('Días')).toBeInTheDocument();
  expect(screen.getByText('Próximo lanzamiento')).toBeInTheDocument();
});

it('renders nothing when not visible', () => {
  const { container } = render(<Proximos drop={{ ...drop, visible: false }} />);
  expect(container).toBeEmptyDOMElement();
});

it('renders the admin-configured drop title', () => {
  render(<Proximos drop={{ ...drop, title: 'Pressure Drop Inminente' }} />);
  expect(screen.getByText(/pressure drop/i)).toBeInTheDocument();
  expect(screen.getByText(/inminente/i)).toBeInTheDocument();
});
