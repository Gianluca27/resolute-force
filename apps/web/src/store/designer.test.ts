import { vi } from 'vitest';
import { DEFAULT_PAGE_DESIGN, type PageDesignDoc } from '@resolute/shared';

vi.mock('../lib/adminApi', () => ({
  adminApi: {
    getPageDesign: vi.fn(),
    putPageDesign: vi.fn().mockResolvedValue({ updatedAt: 'x', dirty: true }),
    publishPageDesign: vi.fn(),
    discardPageDesign: vi.fn(),
  },
}));

import { useDesigner } from './designer';
import { emptyHistory } from '../pages/admin/design/history';

const freshDoc = (): PageDesignDoc => JSON.parse(JSON.stringify(DEFAULT_PAGE_DESIGN));
const accent = () => useDesigner.getState().doc!.theme.colors.accent;
const setAccent = (v: string) => useDesigner.getState().update((d) => ({
  ...d, theme: { ...d.theme, colors: { ...d.theme.colors, accent: v } },
}));

beforeEach(() => {
  useDesigner.setState({
    doc: freshDoc(), saveState: 'idle', error: '', selectedId: null, dirty: false,
    history: emptyHistory<PageDesignDoc>(),
  });
});

it('undo restores the doc before the edit; redo reapplies it', () => {
  vi.spyOn(Date, 'now').mockReturnValue(1000);
  setAccent('#111111');
  expect(accent()).toBe('#111111');

  useDesigner.getState().undo();
  expect(accent()).toBe('#e4322b');

  useDesigner.getState().redo();
  expect(accent()).toBe('#111111');
});

it('undo marks the draft pending so it autosaves', () => {
  vi.spyOn(Date, 'now').mockReturnValue(1000);
  setAccent('#111111');
  useDesigner.setState({ saveState: 'idle' }); // pretend the save landed
  useDesigner.getState().undo();
  expect(useDesigner.getState().saveState).toBe('pending');
});

it('paused edits are separate undo steps', () => {
  const now = vi.spyOn(Date, 'now');
  now.mockReturnValue(1000);
  setAccent('#111111');
  now.mockReturnValue(60000);
  setAccent('#222222');

  useDesigner.getState().undo();
  expect(accent()).toBe('#111111');
  useDesigner.getState().undo();
  expect(accent()).toBe('#e4322b');
  useDesigner.getState().undo(); // nothing left — no-op
  expect(accent()).toBe('#e4322b');
});

it('undo is blocked while in edit conflict', () => {
  vi.spyOn(Date, 'now').mockReturnValue(1000);
  setAccent('#111111');
  useDesigner.setState({ saveState: 'conflict' });
  useDesigner.getState().undo();
  expect(accent()).toBe('#111111');
});
