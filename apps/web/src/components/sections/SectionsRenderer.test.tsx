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

it('renders the sizeTable, testimonials and videoEmbed blocks', () => {
  const d = doc([
    { id: 'st', type: 'sizeTable', visible: true, props: { kicker: '', title: 'Guía de talles', note: 'Medidas en cm', columns: ['Talle', 'Pecho'], rows: [['S', '96']] } },
    { id: 'te', type: 'testimonials', visible: true, props: { kicker: '', title: 'Qué dicen', items: [{ quote: 'Excelente calidad', name: 'Juan P.', detail: 'Rosario' }] } },
    { id: 've', type: 'videoEmbed', visible: true, props: { kicker: '', title: 'Detrás de escena', url: 'https://youtu.be/dQw4w9WgXcQ', caption: 'Drop 2026' } },
  ]);
  render(<SectionsRenderer doc={d} ctx={ctx} />);
  expect(screen.getByText('Guía de talles')).toBeInTheDocument();
  expect(screen.getByRole('table')).toBeInTheDocument();
  expect(screen.getByText(/Excelente calidad/)).toBeInTheDocument();
  expect(screen.getByTitle('Detrás de escena')).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
});

it('align: center adds text-center on content blocks', () => {
  const d = doc([
    {
      id: 'st', type: 'sizeTable', visible: true,
      style: { background: 'default', paddingY: 'default', align: 'center' },
      props: { kicker: '', title: 'Talles', note: '', columns: ['Talle'], rows: [['S']] },
    },
  ]);
  const { container } = render(<SectionsRenderer doc={d} ctx={ctx} />);
  expect(container.querySelector('#st')?.className).toContain('text-center');
});

it('videoEmbed with an unrecognized URL renders no iframe (no injection)', () => {
  const d = doc([
    { id: 've', type: 'videoEmbed', visible: true, props: { kicker: '', title: 'Video', url: 'https://malicioso.com/x', caption: '' } },
  ]);
  const { container } = render(<SectionsRenderer doc={d} ctx={ctx} />);
  expect(container.querySelector('iframe')).toBeNull();
});

it('wrap decorates every visible section (marquee included) without changing order', () => {
  const { container } = render(
    <SectionsRenderer doc={DEFAULT_PAGE_DESIGN} ctx={ctx}
      wrap={(s, node) => <div data-testid={`wrap-${s.id}`} data-rf-section={s.id}>{node}</div>} />,
  );
  const visible = DEFAULT_PAGE_DESIGN.sections.filter((s) => s.visible);
  const wrapped = [...container.querySelectorAll('[data-rf-section]')].map((el) => el.getAttribute('data-rf-section'));
  expect(wrapped).toEqual(visible.map((s) => s.id)); // all wrapped, doc order, marquee first
});
