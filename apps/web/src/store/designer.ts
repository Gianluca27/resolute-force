import { create } from 'zustand';
import type { PageDesignDoc } from '@resolute/shared';
import { adminApi } from '../lib/adminApi';

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
  load: () => Promise<void>;
  update: (fn: (doc: PageDesignDoc) => PageDesignDoc) => void;
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

  return {
    doc: null,
    updatedAt: undefined,
    dirty: false,
    saveState: 'idle',
    error: '',
    selectedId: null,

    load: async () => {
      const res = await adminApi.getPageDesign();
      set({ doc: res.draft, updatedAt: res.updatedAt, dirty: res.dirty, saveState: 'idle', error: '', selectedId: null });
    },

    update: (fn) => {
      const doc = get().doc;
      if (!doc || get().saveState === 'conflict') return; // conflict requires a reload first
      set({ doc: fn(doc), saveState: 'pending' });
      schedule();
    },

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
      set({ doc: res.draft, updatedAt: res.updatedAt, dirty: res.dirty, saveState: 'idle', error: '', selectedId: null });
    },

    select: (id) => set({ selectedId: id }),
  };
});
