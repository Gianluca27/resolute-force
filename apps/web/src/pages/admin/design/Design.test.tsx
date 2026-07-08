import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { DEFAULT_PAGE_DESIGN } from '@resolute/shared';

vi.mock('../../../lib/adminApi', () => ({
  adminApi: {
    getPageDesign: vi.fn().mockResolvedValue({ draft: DEFAULT_PAGE_DESIGN, dirty: false, updatedAt: 't0' }),
    putPageDesign: vi.fn().mockResolvedValue({ updatedAt: 't1', dirty: true }),
    listPageDesignVersions: vi.fn().mockResolvedValue([]),
  },
}));

import { useDesigner } from '../../../store/designer';
import Design from './Design';

async function renderDesign() {
  render(<MemoryRouter><Design /></MemoryRouter>);
  await waitFor(() => expect(screen.getByText('Diseño de la página')).toBeInTheDocument());
  await waitFor(() => expect(useDesigner.getState().doc).not.toBeNull());
}

const layoutOfHero = () => useDesigner.getState().doc!.sections.find((s) => s.id === 'hero')!.layout;

it('rf-el-move from the preview lands in the draft (clamped) and is undoable', async () => {
  await renderDesign();
  window.dispatchEvent(new MessageEvent('message', {
    data: { type: 'rf-el-move', id: 'hero', key: 'title1', dx: 120.7, dy: -3000 }, origin: window.location.origin,
  }));
  await waitFor(() => expect(layoutOfHero()).toEqual({ title1: { dx: 121, dy: -2000 } }));
  useDesigner.getState().undo();
  expect(layoutOfHero()).toBeUndefined();
});

it('rf-el-resize sets the width override', async () => {
  await renderDesign();
  window.dispatchEvent(new MessageEvent('message', {
    data: { type: 'rf-el-resize', id: 'hero', key: 'subtitle', w: 720.4 }, origin: window.location.origin,
  }));
  await waitFor(() => expect(layoutOfHero()).toEqual({ subtitle: { dx: 0, dy: 0, w: 720 } }));
});
