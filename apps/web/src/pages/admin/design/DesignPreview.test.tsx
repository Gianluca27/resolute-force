import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { DEFAULT_PAGE_DESIGN } from '@resolute/shared';
import DesignPreview from './DesignPreview';

vi.mock('../../../lib/adminApi', () => ({
  adminApi: { getPageDesign: vi.fn().mockResolvedValue({ draft: DEFAULT_PAGE_DESIGN, dirty: false, updatedAt: '' }) },
}));
vi.mock('../../../hooks/useCatalog', () => ({
  useProducts: () => ({ data: [] }),
  useDrop: () => ({ data: undefined }),
  useContent: () => ({
    data: {
      marquee: [], heroKicker: '', heroTitle1: '', heroTitle2: '', heroSubtitle: '',
      transferDiscountPct: 10, bankAlias: '', bankCbu: '',
      contactWhatsapp: '549', contactInstagram: '@x', contactEmail: 'a@b.com', contactLocation: 'BA',
    },
  }),
}));

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

async function renderPreview() {
  render(<DesignPreview />);
  await waitFor(() => expect(screen.getByText(/La presión no te quiebra/)).toBeInTheDocument());
}

it('wraps sections as hit targets and posts rf-section-click on click', async () => {
  await renderPreview();
  const spy = vi.spyOn(window.parent, 'postMessage');
  const hero = document.querySelector('[data-rf-section="hero"]');
  expect(hero).not.toBeNull();
  fireEvent.click(hero as HTMLElement);
  expect(spy).toHaveBeenCalledWith({ type: 'rf-section-click', id: 'hero' }, window.location.origin);
});

it('clicking a link inside the preview does not navigate (preview is inert)', async () => {
  await renderPreview();
  const link = document.querySelector('[data-rf-section="hero"] a');
  expect(link).not.toBeNull();
  const ev = new MouseEvent('click', { bubbles: true, cancelable: true });
  (link as HTMLElement).dispatchEvent(ev);
  expect(ev.defaultPrevented).toBe(true);
});

describe('element interaction', () => {
  const selectHero = async () => {
    window.dispatchEvent(new MessageEvent('message', {
      data: { type: 'rf-select', id: 'hero' }, origin: window.location.origin,
    }));
    await waitFor(() => expect(document.querySelector('[data-rf-section="hero"]')).toHaveAttribute('data-rf-selected'));
  };

  it('clicking an element in a NON-selected section still posts rf-section-click', async () => {
    await renderPreview();
    const spy = vi.spyOn(window.parent, 'postMessage');
    fireEvent.click(document.querySelector('[data-rf-section="hero"] [data-rf-el="title1"]')!);
    expect(spy).toHaveBeenCalledWith({ type: 'rf-section-click', id: 'hero' }, window.location.origin);
  });

  it('clicking an element in the selected section selects it instead of re-posting section-click', async () => {
    await renderPreview();
    await selectHero();
    const spy = vi.spyOn(window.parent, 'postMessage');
    fireEvent.click(document.querySelector('[data-rf-section="hero"] [data-rf-el="title1"]')!);
    expect(spy).not.toHaveBeenCalledWith({ type: 'rf-section-click', id: 'hero' }, window.location.origin);
    expect(await screen.findByText('Título línea 1')).toBeInTheDocument(); // overlay label
  });

  it('arrow keys nudge the selected element via rf-el-move (Shift = 10px)', async () => {
    await renderPreview();
    await selectHero();
    fireEvent.click(document.querySelector('[data-rf-section="hero"] [data-rf-el="title1"]')!);
    await screen.findByText('Título línea 1');
    const spy = vi.spyOn(window.parent, 'postMessage');
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(spy).toHaveBeenCalledWith({ type: 'rf-el-move', id: 'hero', key: 'title1', dx: 1, dy: 0 }, window.location.origin);
    // The base comes from the doc (unchanged here — the editor is not present),
    // so the second nudge still starts from 0,0.
    fireEvent.keyDown(window, { key: 'ArrowUp', shiftKey: true });
    expect(spy).toHaveBeenCalledWith({ type: 'rf-el-move', id: 'hero', key: 'title1', dx: 0, dy: -10 }, window.location.origin);
  });

  it('Escape deselects the element', async () => {
    await renderPreview();
    await selectHero();
    fireEvent.click(document.querySelector('[data-rf-section="hero"] [data-rf-el="title1"]')!);
    await screen.findByText('Título línea 1');
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByText('Título línea 1')).not.toBeInTheDocument());
  });
});

it('rf-select marks the section selected and scrolls it into view', async () => {
  await renderPreview();
  window.dispatchEvent(new MessageEvent('message', {
    data: { type: 'rf-select', id: 'manifiesto' }, origin: window.location.origin,
  }));
  await waitFor(() => {
    expect(document.querySelector('[data-rf-section="manifiesto"]')).toHaveAttribute('data-rf-selected');
  });
  expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
});
