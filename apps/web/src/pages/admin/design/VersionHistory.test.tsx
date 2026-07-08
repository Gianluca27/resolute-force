import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { DEFAULT_PAGE_DESIGN } from '@resolute/shared';

vi.mock('../../../lib/adminApi', () => ({
  adminApi: {
    listPageDesignVersions: vi.fn().mockResolvedValue({
      versions: [
        { id: 7, publishedAt: '2026-07-08T15:30:00.000Z' },
        { id: 3, publishedAt: '2026-07-01T10:00:00.000Z' },
      ],
    }),
    restorePageDesignVersion: vi.fn().mockResolvedValue({ draft: DEFAULT_PAGE_DESIGN, dirty: true, updatedAt: 'y' }),
    getPageDesign: vi.fn().mockResolvedValue({ draft: DEFAULT_PAGE_DESIGN, dirty: true, updatedAt: 'y' }),
  },
}));

import { adminApi } from '../../../lib/adminApi';
import VersionHistory from './VersionHistory';

it('lists published versions and restores one after confirmation', async () => {
  const onClose = vi.fn();
  render(<VersionHistory open onClose={onClose} />);

  const restoreButtons = await screen.findAllByRole('button', { name: 'Restaurar' });
  expect(restoreButtons).toHaveLength(2);

  fireEvent.click(restoreButtons[1]!);
  expect(adminApi.restorePageDesignVersion).not.toHaveBeenCalled(); // needs confirmation first

  fireEvent.click(screen.getByRole('button', { name: 'Restaurar versión' }));
  await waitFor(() => expect(adminApi.restorePageDesignVersion).toHaveBeenCalledWith(3));
  await waitFor(() => expect(onClose).toHaveBeenCalled());
});

it('shows an empty state when nothing was published yet', async () => {
  vi.mocked(adminApi.listPageDesignVersions).mockResolvedValueOnce({ versions: [] });
  render(<VersionHistory open onClose={() => {}} />);
  expect(await screen.findByText(/Todavía no hay versiones publicadas/)).toBeInTheDocument();
});
