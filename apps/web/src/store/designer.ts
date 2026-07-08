import { create } from 'zustand';
import type { PageDesignDoc } from '@resolute/shared';
import { adminApi } from '../lib/adminApi';
import { emptyHistory, pushHistory, undoHistory, redoHistory, type History } from '../pages/admin/design/history';

// Autosave: edits mark the store 'pending' and (re)arm a short timer; the PUT
// carries the optimistic-lock token. Publishing flushes any pending save first
// so the server never publishes a draft older than what the admin sees.

const SAVE_DELAY = 1200;
let timer: ReturnType<typeof setTimeout> | null = null;

export type SaveState = 'idle' | 'pending' | 'saving' | 'error' | 'conflict';

interface DesignerState {
  doc: PageDesignDoc | null;
  updatedAt?: string;
  dirty: boolean; // draft ≠ published (server-computed)
  saveState: SaveState;
  error: string;
  selectedId: string | null;
  history: History<PageDesignDoc>;
  load: () => Promise<void>;
  update: (fn: (doc: PageDesignDoc) => PageDesignDoc) => void;
  undo: () => void;
  redo: () => void;
  flush: () => Promise<void>;
  publish: () => Promise<void>;
  discard: () => Promise<void>;
  select: (id: string | null) => void;
}

export const useDesigner = create<DesignerState>((set, get) => {
  async function save(): Promise<void> {
    const { doc, updatedAt, saveState } = get();
    if (!doc || saveState === 'saving') return;
    set({ saveState: 'saving' });
    const sent = doc;
    try {
      const res = await adminApi.putPageDesign(doc, updatedAt);
      // More edits may have landed while the PUT was in flight — keep them pending.
      const stillCurrent = get().doc === sent;
      set({ updatedAt: res.updatedAt, dirty: res.dirty, saveState: stillCurrent ? 'idle' : 'pending', error: '' });
      if (!stillCurrent) schedule();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo guardar';
      set({ saveState: /otra sesión/i.test(msg) ? 'conflict' : 'error', error: msg });
    }
  }

  function schedule(): void {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; void save(); }, SAVE_DELAY);
  }

  // Shared by undo/redo: swap the doc for a snapshot and autosave it.
  function restore(result: { history: History<PageDesignDoc>; doc: PageDesignDoc } | null): void {
    if (!result || get().saveState === 'conflict') return;
    set({ doc: result.doc, history: result.history, saveState: 'pending' });
    schedule();
  }

  return {
    doc: null,
    updatedAt: undefined,
    dirty: false,
    saveState: 'idle',
    error: '',
    selectedId: null,
    history: emptyHistory<PageDesignDoc>(),

    load: async () => {
      try {
        const res = await adminApi.getPageDesign();
        set({ doc: res.draft, updatedAt: res.updatedAt, dirty: res.dirty, saveState: 'idle', error: '', selectedId: null, history: emptyHistory() });
      } catch (e) {
        // doc stays null — Design.tsx shows `error` instead of the loading label.
        set({ saveState: 'error', error: e instanceof Error ? e.message : 'No se pudo cargar el diseño' });
      }
    },

    update: (fn) => {
      const doc = get().doc;
      if (!doc || get().saveState === 'conflict') return; // conflict requires a reload first
      set({ doc: fn(doc), saveState: 'pending', history: pushHistory(get().history, doc, Date.now()) });
      schedule();
    },

    undo: () => { const doc = get().doc; if (doc) restore(undoHistory(get().history, doc)); },
    redo: () => { const doc = get().doc; if (doc) restore(redoHistory(get().history, doc)); },

    flush: async () => {
      if (timer) { clearTimeout(timer); timer = null; }
      const { saveState } = get();
      if (saveState === 'pending' || saveState === 'error') await save();
      // If a save was already in flight, wait for it to settle.
      while (get().saveState === 'saving') await new Promise((r) => setTimeout(r, 60));
    },

    publish: async () => {
      await get().flush();
      if (get().saveState === 'conflict' || get().saveState === 'error') return;
      try {
        const res = await adminApi.publishPageDesign();
        set({ updatedAt: res.updatedAt, dirty: res.dirty, error: '' });
      } catch (e) {
        set({ saveState: 'error', error: e instanceof Error ? e.message : 'No se pudo publicar' });
      }
    },

    discard: async () => {
      if (timer) { clearTimeout(timer); timer = null; }
      const res = await adminApi.discardPageDesign();
      set({ doc: res.draft, updatedAt: res.updatedAt, dirty: res.dirty, saveState: 'idle', error: '', selectedId: null, history: emptyHistory() });
    },

    select: (id) => set({ selectedId: id }),
  };
});
