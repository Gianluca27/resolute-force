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
