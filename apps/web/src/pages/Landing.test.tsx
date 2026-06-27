import { render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { vi } from 'vitest';
import Landing from './Landing';

vi.mock('../lib/api', () => ({
  api: {
    products: () => Promise.resolve([{ id: 'p1', slug: 's', line: 'Champion Mentality', color: 'Negro', dotColor: '#101013', tag: null, price: 30000, imageUrl: '/assets/tile-black.png', sizes: [{ size: 'M', stock: 5 }] }]),
    drop: () => Promise.resolve({ targetAt: '2026-08-15T20:00:00-03:00', visible: true, title: 'Algo se está forjando', teaser: 'x' }),
    content: () => Promise.resolve({ marquee: ['Champion Mentality'], heroKicker: 'Est. 2024', heroTitle1: 'Champion', heroTitle2: 'Mentality', heroSubtitle: 'Sub', transferDiscountPct: 10, bankAlias: '', bankCbu: '', contactWhatsapp: '549', contactInstagram: '@resoluteforceok', contactEmail: 'a@b.com', contactLocation: 'BA' }),
  },
}));

function renderLanding() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><Landing /></QueryClientProvider>);
}

it('renders hero + product + countdown once data loads', async () => {
  renderLanding();
  expect(await screen.findByRole('heading', { level: 1, name: /champion/i })).toBeInTheDocument();
  await waitFor(() => expect(screen.getByText('Días')).toBeInTheDocument());
  expect(screen.getByText('$30.000')).toBeInTheDocument();
});
