import { render, screen } from '@testing-library/react';
import { DEFAULT_PAGE_DESIGN, type PageDesignDoc } from '@resolute/shared';
import SectionsRenderer, { computeAnchors, navLinks, type RenderCtx } from './SectionsRenderer';

const content = {
  marquee: [], heroKicker: '', heroTitle1: '', heroTitle2: '', heroSubtitle: '',
  transferDiscountPct: 10, bankAlias: '', bankCbu: '',
  contactWhatsapp: '549', contactInstagram: '@x', contactEmail: 'a@b.com', contactLocation: 'BA',
} as RenderCtx['content'];

const ctx: RenderCtx = { products: [], content, onAdd: () => {}, anchors: {} };

function doc(sections: PageDesignDoc['sections']): PageDesignDoc {
  return { ...DEFAULT_PAGE_DESIGN, sections };
}

it('renders sections in doc order and skips hidden ones', () => {
  const d = doc(DEFAULT_PAGE_DESIGN.sections.map((s) => s.type === 'historia' ? { ...s, visible: false } : s));
  render(<SectionsRenderer doc={d} ctx={ctx} />);
  expect(screen.getByText(/La presión no te quiebra/)).toBeInTheDocument(); // manifiesto
  expect(screen.queryByText(/Nacida en el gimnasio/)).not.toBeInTheDocument(); // historia oculta
});

it('skips unknown section types instead of crashing (rollback safety)', () => {
  const rogue = { id: 'x', type: 'holograma', visible: true, props: {} } as unknown as PageDesignDoc['sections'][number];
  render(<SectionsRenderer doc={doc([rogue, ...DEFAULT_PAGE_DESIGN.sections])} ctx={ctx} />);
  expect(screen.getByText(/La presión no te quiebra/)).toBeInTheDocument();
});

it('derives nav links from visible sections in page order', () => {
  const d = doc(DEFAULT_PAGE_DESIGN.sections.map((s) => s.type === 'contacto' ? { ...s, visible: false } : s));
  expect(navLinks(d)).toEqual([
    { href: '#manifiesto', label: 'Manifiesto' },
    { href: '#productos', label: 'Productos' },
    { href: '#historia', label: 'Historia' },
  ]);
});

it('computeAnchors points hero CTAs at the first visible instance', () => {
  expect(computeAnchors(DEFAULT_PAGE_DESIGN)).toEqual({ products: 'productos', manifiesto: 'manifiesto' });
});
