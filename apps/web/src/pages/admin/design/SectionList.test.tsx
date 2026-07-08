import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { DEFAULT_PAGE_DESIGN, type PageDesignDoc } from '@resolute/shared';

vi.mock('../../../lib/adminApi', () => ({
  adminApi: { putPageDesign: vi.fn().mockResolvedValue({ updatedAt: 'x', dirty: true }) },
}));

import { useDesigner } from '../../../store/designer';
import { emptyHistory } from './history';
import SectionList from './SectionList';

const freshDoc = (): PageDesignDoc => JSON.parse(JSON.stringify(DEFAULT_PAGE_DESIGN));

beforeEach(() => {
  useDesigner.setState({
    doc: freshDoc(), saveState: 'idle', error: '', selectedId: null, dirty: false,
    history: emptyHistory<PageDesignDoc>(),
  });
});

function renderList() {
  render(<SectionList sections={useDesigner.getState().doc!.sections} onOpen={() => {}} />);
}

it('deleting a section asks in an in-app dialog and removes it on confirm', () => {
  const confirmSpy = vi.spyOn(window, 'confirm');
  renderList();
  const count = useDesigner.getState().doc!.sections.length;

  fireEvent.click(screen.getAllByLabelText('Eliminar')[0]!);
  // the native confirm must NOT be used…
  expect(confirmSpy).not.toHaveBeenCalled();
  // …and nothing is deleted until the dialog is confirmed
  expect(useDesigner.getState().doc!.sections).toHaveLength(count);

  fireEvent.click(screen.getByRole('button', { name: 'Eliminar sección' }));
  expect(useDesigner.getState().doc!.sections).toHaveLength(count - 1);
});

it('cancelling the delete dialog keeps the section', () => {
  renderList();
  const count = useDesigner.getState().doc!.sections.length;
  fireEvent.click(screen.getAllByLabelText('Eliminar')[0]!);
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(useDesigner.getState().doc!.sections).toHaveLength(count);
  expect(screen.queryByRole('button', { name: 'Eliminar sección' })).not.toBeInTheDocument();
});
