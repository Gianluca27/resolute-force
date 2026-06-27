import { render, screen } from '@testing-library/react';
import Contacto from './Contacto';

const content = { contactWhatsapp: '5493413213723', contactInstagram: '@resoluteforceok', contactEmail: 'resolutecontacto@gmail.com', contactLocation: 'Buenos Aires · Envíos a todo el país' } as any;

it('builds a wa.me link and shows the contact channels', () => {
  render(<Contacto content={content} />);
  expect(screen.getByText('@resoluteforceok')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /whatsapp/i })).toHaveAttribute('href', expect.stringContaining('wa.me/5493413213723'));
  expect(screen.getByText('resolutecontacto@gmail.com')).toBeInTheDocument();
});
