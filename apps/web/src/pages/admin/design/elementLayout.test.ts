import { describe, it, expect } from 'vitest';
import type { PageDesignDoc, PageSection } from '@resolute/shared';
import { DEFAULT_PAGE_DESIGN } from '@resolute/shared';
import { moveElement, resizeElement, resetElement, resetSectionLayout } from './elementLayout';

const section: PageSection = {
  id: 'ti', type: 'textImage', visible: true,
  props: { kicker: '', title: 'T', body: 'b', imageUrl: '', imageSide: 'left', ctaLabel: '', ctaHref: '' },
};
const doc: PageDesignDoc = { ...DEFAULT_PAGE_DESIGN, sections: [section] };

const layoutOf = (d: PageDesignDoc) => d.sections[0]!.layout;

describe('moveElement', () => {
  it('sets rounded, clamped offsets for the element', () => {
    const d = moveElement(doc, 'ti', 'title', 40.6, -2500.2);
    expect(layoutOf(d)).toEqual({ title: { dx: 41, dy: -2000 } });
  });

  it('preserves other entries and the width of the moved one', () => {
    const base = moveElement(resizeElement(doc, 'ti', 'image', 700), 'ti', 'title', 10, 10);
    const d = moveElement(base, 'ti', 'image', 5, 5);
    expect(layoutOf(d)).toEqual({ title: { dx: 10, dy: 10 }, image: { dx: 5, dy: 5, w: 700 } });
  });

  it('moving back to 0,0 without width removes the entry (clean doc)', () => {
    const d = moveElement(moveElement(doc, 'ti', 'title', 30, 0), 'ti', 'title', 0, 0);
    expect(layoutOf(d)).toBeUndefined();
  });

  it('does not touch other sections or the original doc', () => {
    const d = moveElement(doc, 'ti', 'title', 10, 10);
    expect(doc.sections[0]!.layout).toBeUndefined();
    expect(d).not.toBe(doc);
  });

  it('unknown section id is a no-op', () => {
    expect(moveElement(doc, 'nope', 'title', 10, 10)).toBe(doc);
  });
});

describe('resizeElement', () => {
  it('sets a clamped width and keeps offsets', () => {
    const d = resizeElement(moveElement(doc, 'ti', 'image', 12, 34), 'ti', 'image', 20);
    expect(layoutOf(d)).toEqual({ image: { dx: 12, dy: 34, w: 40 } });
  });

  it('creates the entry with zero offsets when the element had none', () => {
    const d = resizeElement(doc, 'ti', 'image', 700.4);
    expect(layoutOf(d)).toEqual({ image: { dx: 0, dy: 0, w: 700 } });
  });
});

describe('reset', () => {
  it('resetElement removes one entry and drops layout when empty', () => {
    const base = moveElement(moveElement(doc, 'ti', 'title', 10, 10), 'ti', 'image', 5, 5);
    const d1 = resetElement(base, 'ti', 'image');
    expect(layoutOf(d1)).toEqual({ title: { dx: 10, dy: 10 } });
    expect(layoutOf(resetElement(d1, 'ti', 'title'))).toBeUndefined();
  });

  it('resetSectionLayout drops the whole layout', () => {
    const base = moveElement(moveElement(doc, 'ti', 'title', 10, 10), 'ti', 'image', 5, 5);
    expect(layoutOf(resetSectionLayout(base, 'ti'))).toBeUndefined();
  });
});
