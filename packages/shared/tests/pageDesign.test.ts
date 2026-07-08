import { describe, it, expect } from 'vitest';
import { pageDesignDocSchema, sectionSchema, themeSchema, DEFAULT_PAGE_DESIGN, FONT_OPTIONS } from '../src/index';

describe('pageDesignDocSchema', () => {
  it('accepts the default document (seed & web fallback depend on this)', () => {
    expect(pageDesignDocSchema.parse(DEFAULT_PAGE_DESIGN)).toBeTruthy();
  });

  it('rejects duplicated section ids', () => {
    const doc = {
      ...DEFAULT_PAGE_DESIGN,
      sections: [DEFAULT_PAGE_DESIGN.sections[0], DEFAULT_PAGE_DESIGN.sections[0]],
    };
    expect(pageDesignDocSchema.safeParse(doc).success).toBe(false);
  });

  it('rejects an unknown section type', () => {
    const doc = {
      ...DEFAULT_PAGE_DESIGN,
      sections: [{ id: 'x', type: 'carousel3d', visible: true, props: {} }],
    };
    expect(pageDesignDocSchema.safeParse(doc).success).toBe(false);
  });

  it('rejects props that do not match the section type', () => {
    const doc = {
      ...DEFAULT_PAGE_DESIGN,
      sections: [{ id: 'x', type: 'faq', visible: true, props: { kicker: '', title: '', items: [] } }],
    };
    // faq requires at least one item
    expect(pageDesignDocSchema.safeParse(doc).success).toBe(false);
  });
});

describe('new blocks: sizeTable / testimonials / videoEmbed', () => {
  it('accepts a valid size table', () => {
    const s = sectionSchema.parse({
      id: 'st1', type: 'sizeTable', visible: true,
      props: {
        kicker: '', title: 'Guía de talles', note: 'Medidas en cm',
        columns: ['Talle', 'Pecho', 'Largo'],
        rows: [['S', '96', '68'], ['M', '102', '71']],
      },
    });
    expect(s.type).toBe('sizeTable');
  });

  it('rejects a size-table row wider than its header', () => {
    expect(sectionSchema.safeParse({
      id: 'st1', type: 'sizeTable', visible: true,
      props: { kicker: '', title: 'Talles', note: '', columns: ['Talle'], rows: [['S', '96']] },
    }).success).toBe(false);
  });

  it('accepts testimonials with optional photo', () => {
    const s = sectionSchema.parse({
      id: 'te1', type: 'testimonials', visible: true,
      props: {
        kicker: '', title: 'Qué dicen',
        items: [
          { quote: 'La mejor calidad.', name: 'Juan P.', detail: 'CrossFit', imageUrl: '/x.png' },
          { quote: 'Volvería a comprar.', name: 'Sofi', detail: '' },
        ],
      },
    });
    expect(s.type).toBe('testimonials');
  });

  it('rejects a testimonial without quote or name', () => {
    expect(sectionSchema.safeParse({
      id: 'te1', type: 'testimonials', visible: true,
      props: { kicker: '', title: '', items: [{ quote: '', name: '', detail: '' }] },
    }).success).toBe(false);
  });

  it('accepts a video embed', () => {
    const s = sectionSchema.parse({
      id: 'v1', type: 'videoEmbed', visible: true,
      props: { kicker: '', title: 'Detrás de escena', url: 'https://www.youtube.com/watch?v=abc123', caption: '' },
    });
    expect(s.type).toBe('videoEmbed');
  });
});

describe('sectionSchema', () => {
  it('accepts a valid textImage block', () => {
    const s = sectionSchema.parse({
      id: 'ti1', type: 'textImage', visible: true,
      props: { kicker: '', title: 'Hola', body: 'Texto', imageUrl: '/a.png', imageSide: 'left', ctaLabel: '', ctaHref: '' },
    });
    expect(s.type).toBe('textImage');
  });

  it('applies style defaults', () => {
    const s = sectionSchema.parse({
      id: 'g1', type: 'gallery', visible: true, style: {},
      props: { kicker: '', title: '', columns: 3, images: [] },
    });
    expect(s.style).toEqual({ background: 'default', paddingY: 'default', align: 'default' });
  });

  it('accepts centered alignment and keeps old docs (no align) valid', () => {
    const s = sectionSchema.parse({
      id: 'g1', type: 'gallery', visible: true, style: { background: 'bg', paddingY: 'md', align: 'center' },
      props: { kicker: '', title: '', columns: 3, images: [] },
    });
    expect(s.style?.align).toBe('center');
    // docs saved before the field existed still parse
    const legacy = sectionSchema.parse({
      id: 'g2', type: 'gallery', visible: true, style: { background: 'panel', paddingY: 'sm' },
      props: { kicker: '', title: '', columns: 3, images: [] },
    });
    expect(legacy.style?.align).toBe('default');
  });
});

describe('section layout (free positioning)', () => {
  const gallery = { id: 'g1', type: 'gallery', visible: true, props: { kicker: '', title: '', columns: 3, images: [] } } as const;

  it('accepts per-element offsets and keeps them in the parsed doc', () => {
    const s = sectionSchema.parse({ ...gallery, layout: { title: { dx: 40, dy: -12 }, grid: { dx: 0, dy: 30, w: 720 } } });
    expect(s.layout).toEqual({ title: { dx: 40, dy: -12 }, grid: { dx: 0, dy: 30, w: 720 } });
  });

  it('keeps docs without layout valid (legacy) and layout undefined', () => {
    const s = sectionSchema.parse({ ...gallery });
    expect(s.layout).toBeUndefined();
  });

  it('rejects offsets out of bounds', () => {
    expect(sectionSchema.safeParse({ ...gallery, layout: { title: { dx: 5000, dy: 0 } } }).success).toBe(false);
    expect(sectionSchema.safeParse({ ...gallery, layout: { title: { dx: 0, dy: -5000 } } }).success).toBe(false);
  });

  it('rejects width overrides out of bounds', () => {
    expect(sectionSchema.safeParse({ ...gallery, layout: { image: { dx: 0, dy: 0, w: 10 } } }).success).toBe(false);
    expect(sectionSchema.safeParse({ ...gallery, layout: { image: { dx: 0, dy: 0, w: 4000 } } }).success).toBe(false);
  });

  it('rejects non-integer offsets and oversized element keys', () => {
    expect(sectionSchema.safeParse({ ...gallery, layout: { title: { dx: 1.5, dy: 0 } } }).success).toBe(false);
    expect(sectionSchema.safeParse({ ...gallery, layout: { ['x'.repeat(50)]: { dx: 0, dy: 0 } } }).success).toBe(false);
  });
});

describe('theme fonts', () => {
  it('every curated font id is accepted by the schema', () => {
    for (const f of FONT_OPTIONS) {
      const t = { ...DEFAULT_PAGE_DESIGN.theme, fonts: { display: f.id, body: f.id } };
      expect(themeSchema.safeParse(t).success, f.id).toBe(true);
    }
  });
});

describe('themeSchema', () => {
  it('rejects malformed hex colors and unknown fonts', () => {
    const t = JSON.parse(JSON.stringify(DEFAULT_PAGE_DESIGN.theme));
    t.colors.accent = 'red';
    expect(themeSchema.safeParse(t).success).toBe(false);
    const t2 = JSON.parse(JSON.stringify(DEFAULT_PAGE_DESIGN.theme));
    t2.fonts.display = 'comic-sans';
    expect(themeSchema.safeParse(t2).success).toBe(false);
  });

  it('bounds radius to 0–24', () => {
    const t = JSON.parse(JSON.stringify(DEFAULT_PAGE_DESIGN.theme));
    t.shapes.radius = 60;
    expect(themeSchema.safeParse(t).success).toBe(false);
  });
});
