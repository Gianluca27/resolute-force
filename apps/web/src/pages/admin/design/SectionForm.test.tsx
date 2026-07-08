import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { DEFAULT_PAGE_DESIGN, type PageDesignDoc, type PageSection } from '@resolute/shared';

vi.mock('../../../lib/adminApi', () => ({
  adminApi: { putPageDesign: vi.fn().mockResolvedValue({ updatedAt: 'x', dirty: true }), uploadAsset: vi.fn() },
}));

import { useDesigner } from '../../../store/designer';
import { emptyHistory } from './history';
import SectionForm from './SectionForm';

const gallery: PageSection = {
  id: 'gal-1', type: 'gallery', visible: true,
  props: { kicker: '', title: 'Galería', columns: 3, images: [{ url: '/a.png', alt: '' }, { url: '/b.png', alt: 'ya tiene' }] },
};

beforeEach(() => {
  const doc: PageDesignDoc = { ...JSON.parse(JSON.stringify(DEFAULT_PAGE_DESIGN)) as PageDesignDoc };
  doc.sections = [...doc.sections, JSON.parse(JSON.stringify(gallery)) as PageSection];
  useDesigner.setState({ doc, saveState: 'idle', error: '', selectedId: null, dirty: false, history: emptyHistory<PageDesignDoc>() });
});

describe('element position panel', () => {
  const moved: PageSection = {
    id: 'ti-1', type: 'textImage', visible: true,
    layout: { title: { dx: 40, dy: -12 }, image: { dx: 0, dy: 0, w: 700 } },
    props: { kicker: '', title: 'T', body: 'b', imageUrl: '/a.png', imageSide: 'left', ctaLabel: '', ctaHref: '' },
  };

  beforeEach(() => {
    const doc = useDesigner.getState().doc!;
    useDesigner.setState({ doc: { ...doc, sections: [...doc.sections, JSON.parse(JSON.stringify(moved)) as PageSection] } });
  });

  it('lists moved elements with their offsets and resets one', () => {
    render(<MemoryRouter><SectionForm section={moved} /></MemoryRouter>);
    expect(screen.getByText('Posición de elementos')).toBeInTheDocument();
    expect(screen.getByText('40,-12')).toBeInTheDocument();
    expect(screen.getByText('0,0 · 700px')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restaurar Imagen' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Restaurar Título' }));
    const stored = useDesigner.getState().doc!.sections.find((s) => s.id === 'ti-1');
    expect(stored?.layout).toEqual({ image: { dx: 0, dy: 0, w: 700 } });
  });

  it('restores the whole section layout', () => {
    render(<MemoryRouter><SectionForm section={moved} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar layout original' }));
    const stored = useDesigner.getState().doc!.sections.find((s) => s.id === 'ti-1');
    expect(stored?.layout).toBeUndefined();
  });

  it('hides the panel when nothing was moved', () => {
    const plain = { ...moved, id: 'ti-2', layout: undefined };
    render(<MemoryRouter><SectionForm section={plain} /></MemoryRouter>);
    expect(screen.queryByText('Posición de elementos')).not.toBeInTheDocument();
  });
});

it('gallery images expose an alt text field that patches the doc', () => {
  render(<MemoryRouter><SectionForm section={gallery} /></MemoryRouter>);
  const altInputs = screen.getAllByPlaceholderText('Descripción (texto alternativo)');
  expect(altInputs).toHaveLength(2);

  fireEvent.change(altInputs[0]!, { target: { value: 'Remera negra frente' } });
  const stored = useDesigner.getState().doc!.sections.find((s) => s.id === 'gal-1');
  expect(stored?.type === 'gallery' && stored.props.images[0]?.alt).toBe('Remera negra frente');
});
