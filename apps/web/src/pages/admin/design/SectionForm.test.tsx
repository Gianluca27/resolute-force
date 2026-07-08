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

it('gallery images expose an alt text field that patches the doc', () => {
  render(<MemoryRouter><SectionForm section={gallery} /></MemoryRouter>);
  const altInputs = screen.getAllByPlaceholderText('Descripción (texto alternativo)');
  expect(altInputs).toHaveLength(2);

  fireEvent.change(altInputs[0]!, { target: { value: 'Remera negra frente' } });
  const stored = useDesigner.getState().doc!.sections.find((s) => s.id === 'gal-1');
  expect(stored?.type === 'gallery' && stored.props.images[0]?.alt).toBe('Remera negra frente');
});
