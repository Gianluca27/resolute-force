import { emptyHistory, pushHistory, undoHistory, redoHistory, MAX_UNDO, COALESCE_MS } from './history';

// Snapshots are opaque to the helper — strings stand in for design docs.

it('undo returns the doc as it was before the edit', () => {
  const h = pushHistory(emptyHistory<string>(), 'v1', 1000);
  const u = undoHistory(h, 'v2');
  expect(u?.doc).toBe('v1');
});

it('undo on empty history returns null', () => {
  expect(undoHistory(emptyHistory<string>(), 'v1')).toBeNull();
});

it('redo re-applies the undone doc', () => {
  const h = pushHistory(emptyHistory<string>(), 'v1', 1000);
  const u = undoHistory(h, 'v2')!;
  const r = redoHistory(u.history, u.doc)!;
  expect(r.doc).toBe('v2');
  expect(redoHistory(r.history, r.doc)).toBeNull(); // future exhausted
});

it('a new edit clears the redo stack', () => {
  const h = pushHistory(emptyHistory<string>(), 'v1', 1000);
  const u = undoHistory(h, 'v2')!;
  const h2 = pushHistory(u.history, u.doc, 5000);
  expect(redoHistory(h2, 'v3')).toBeNull();
});

it('rapid edits coalesce into a single undo step', () => {
  let h = pushHistory(emptyHistory<string>(), 'v1', 1000);
  h = pushHistory(h, 'v2', 1000 + COALESCE_MS - 100); // same burst — no new step
  const u = undoHistory(h, 'v3')!;
  expect(u.doc).toBe('v1'); // jumps over v2
  expect(undoHistory(u.history, u.doc)).toBeNull();
});

it('edits separated by a pause create separate steps', () => {
  let h = pushHistory(emptyHistory<string>(), 'v1', 1000);
  h = pushHistory(h, 'v2', 1000 + COALESCE_MS + 100);
  const u1 = undoHistory(h, 'v3')!;
  expect(u1.doc).toBe('v2');
  const u2 = undoHistory(u1.history, u1.doc)!;
  expect(u2.doc).toBe('v1');
});

it('an edit right after undo never coalesces into the restored step', () => {
  let h = pushHistory(emptyHistory<string>(), 'v1', 1000);
  h = pushHistory(h, 'v2', 3000);
  const u = undoHistory(h, 'v3')!; // back to v2
  const h2 = pushHistory(u.history, u.doc, 3001); // immediate new edit
  expect(undoHistory(h2, 'v4')?.doc).toBe('v2');
});

it('history is capped at MAX_UNDO steps', () => {
  let h = emptyHistory<number>();
  for (let i = 0; i < MAX_UNDO + 10; i++) h = pushHistory(h, i, i * (COALESCE_MS + 1));
  expect(h.past.length).toBe(MAX_UNDO);
  expect(h.past[0]).toBe(10); // oldest dropped
});
