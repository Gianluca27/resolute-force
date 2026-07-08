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

describe('free positioning (layout)', () => {
  const drop = { visible: true, targetAt: '2027-01-01T00:00:00.000Z', title: 'Drop Uno', teaser: 'Se viene' } as RenderCtx['drop'];

  it('every section type except marquee exposes movable elements (data-rf-el)', () => {
    const d = doc([
      ...DEFAULT_PAGE_DESIGN.sections,
      { id: 'ti', type: 'textImage', visible: true, props: { kicker: 'k', title: 'T', body: 'b', imageUrl: '/a.png', imageSide: 'left', ctaLabel: 'Ver', ctaHref: '#x' } },
      { id: 'cb', type: 'ctaBanner', visible: true, props: { title: 'T', subtitle: 's', ctaLabel: 'Ir', ctaHref: '#x', variant: 'accent' } },
      { id: 'ga', type: 'gallery', visible: true, props: { kicker: '', title: 'G', columns: 3, images: [{ url: '/a.png', alt: '' }] } },
      { id: 'fq', type: 'faq', visible: true, props: { kicker: '', title: 'F', items: [{ q: 'Q', a: 'A' }] } },
      { id: 'st', type: 'sizeTable', visible: true, props: { kicker: '', title: 'S', note: 'n', columns: ['T'], rows: [['S']] } },
      { id: 'te', type: 'testimonials', visible: true, props: { kicker: '', title: 'W', items: [{ quote: 'Q', name: 'N', detail: '' }] } },
      { id: 've', type: 'videoEmbed', visible: true, props: { kicker: '', title: 'V', url: 'https://youtu.be/dQw4w9WgXcQ', caption: 'c' } },
    ]);
    const { container } = render(<SectionsRenderer doc={d} ctx={{ ...ctx, drop }} />);
    for (const s of d.sections.filter((x) => x.visible && x.type !== 'marquee')) {
      const root = container.querySelector(`#${s.id}`);
      expect(root, s.id).not.toBeNull();
      expect(root!.querySelectorAll('[data-rf-el]').length, `${s.type} sin elementos móviles`).toBeGreaterThan(0);
    }
    expect(container.querySelectorAll('[data-screen-label="Marquee"] [data-rf-el]').length).toBe(0);
  });

  it('applies offset CSS vars to the targeted element only', () => {
    const d = doc([{
      id: 'ti', type: 'textImage', visible: true,
      layout: { title: { dx: 40, dy: -12 } },
      props: { kicker: 'k', title: 'Hola', body: 'b', imageUrl: '/a.png', imageSide: 'left', ctaLabel: '', ctaHref: '' },
    }]);
    const { container } = render(<SectionsRenderer doc={d} ctx={ctx} />);
    const title = container.querySelector('#ti [data-rf-el="title"]') as HTMLElement;
    expect(title.style.getPropertyValue('--el-dx')).toBe('40px');
    expect(title.style.getPropertyValue('--el-dy')).toBe('-12px');
    const kicker = container.querySelector('#ti [data-rf-el="kicker"]') as HTMLElement;
    expect(kicker.style.getPropertyValue('--el-dx')).toBe('');
  });

  it('width override adds the rf-el-w class and var', () => {
    const d = doc([{
      id: 'ti', type: 'textImage', visible: true,
      layout: { image: { dx: 0, dy: 0, w: 720 } },
      props: { kicker: '', title: 'T', body: 'b', imageUrl: '/a.png', imageSide: 'left', ctaLabel: '', ctaHref: '' },
    }]);
    const { container } = render(<SectionsRenderer doc={d} ctx={ctx} />);
    const img = container.querySelector('#ti [data-rf-el="image"]') as HTMLElement;
    expect(img.className).toContain('rf-el-w');
    expect(img.style.getPropertyValue('--el-w')).toBe('720px');
  });
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
