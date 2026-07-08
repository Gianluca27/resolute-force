import { describe, it, expect } from 'vitest';
import { sectionEl } from './layoutEl';

describe('sectionEl', () => {
  it('marks the element and keeps caller classes/styles when there is no layout', () => {
    const el = sectionEl(undefined);
    const p = el('title', 'm-0 font-display', { color: 'red' });
    expect(p['data-rf-el']).toBe('title');
    expect(p.className).toBe('rf-el m-0 font-display');
    expect(p.style).toEqual({ color: 'red' });
  });

  it('emits CSS vars for offsets', () => {
    const el = sectionEl({ title: { dx: 40, dy: -12 } });
    const p = el('title');
    expect(p.style).toMatchObject({ '--el-dx': '40px', '--el-dy': '-12px' });
    expect(p.className).toBe('rf-el');
  });

  it('adds the width class and var only when w is set', () => {
    const el = sectionEl({ image: { dx: 0, dy: 0, w: 720 } });
    const p = el('image');
    expect(p.className).toBe('rf-el rf-el-w');
    expect(p.style).toMatchObject({ '--el-w': '720px' });
    expect(el('title').className).toBe('rf-el');
  });

  it('ignores layout entries for other elements', () => {
    const el = sectionEl({ ghost: { dx: 99, dy: 99 } });
    const p = el('title', 'x');
    expect(p.style).toBeUndefined();
    expect(p.className).toBe('rf-el x');
  });
});
