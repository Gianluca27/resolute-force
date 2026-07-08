// Undo/redo history over immutable snapshots. Edits arriving within
// COALESCE_MS of the previous one merge into the same undo step (pause-based
// grouping, like Figma/Docs), so typing a sentence is one Ctrl+Z, not thirty.

export const COALESCE_MS = 900;
export const MAX_UNDO = 50;

export interface History<T> {
  past: T[];
  future: T[];
  lastPushAt: number;
}

export function emptyHistory<T>(): History<T> {
  return { past: [], future: [], lastPushAt: -Infinity };
}

/** Record `current` (the doc BEFORE the edit) as an undo step. */
export function pushHistory<T>(h: History<T>, current: T, now: number): History<T> {
  const coalesce = h.past.length > 0 && now - h.lastPushAt < COALESCE_MS;
  return {
    past: coalesce ? h.past : [...h.past.slice(-(MAX_UNDO - 1)), current],
    future: [],
    lastPushAt: now,
  };
}

/** Step back. `current` is the live doc, pushed onto the redo stack. */
export function undoHistory<T>(h: History<T>, current: T): { history: History<T>; doc: T } | null {
  const doc = h.past[h.past.length - 1];
  if (doc === undefined) return null;
  return {
    history: { past: h.past.slice(0, -1), future: [current, ...h.future], lastPushAt: -Infinity },
    doc,
  };
}

/** Step forward after an undo. */
export function redoHistory<T>(h: History<T>, current: T): { history: History<T>; doc: T } | null {
  const doc = h.future[0];
  if (doc === undefined) return null;
  return {
    history: { past: [...h.past, current], future: h.future.slice(1), lastPushAt: -Infinity },
    doc,
  };
}
