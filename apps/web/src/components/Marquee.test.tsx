import { render, screen } from '@testing-library/react';
import Marquee from './Marquee';

it('renders each item duplicated for a seamless loop', () => {
  render(<Marquee items={['Envíos a todo el país', 'Champion Mentality']} />);
  expect(screen.getAllByText('Champion Mentality')).toHaveLength(2);
});
