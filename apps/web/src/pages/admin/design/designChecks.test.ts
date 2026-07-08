import { DEFAULT_PAGE_DESIGN, type PageDesignDoc, type PageSection } from '@resolute/shared';
import { checkDesign } from './designChecks';

const doc = (mut?: (d: PageDesignDoc) => void): PageDesignDoc => {
  const d = JSON.parse(JSON.stringify(DEFAULT_PAGE_DESIGN)) as PageDesignDoc;
  mut?.(d);
  return d;
};

it('the default document publishes clean', () => {
  expect(checkDesign(doc())).toEqual([]);
});

it('flags a page with no visible sections as an error', () => {
  const issues = checkDesign(doc((d) => d.sections.forEach((s) => { s.visible = false; })));
  expect(issues.some((i) => i.severity === 'error')).toBe(true);
});

it('ignores problems in hidden sections', () => {
  const d = doc((del) => {
    const m = del.sections.find((s) => s.type === 'manifiesto')!;
    if (m.type === 'manifiesto') m.props.imageUrl = '';
    m.visible = false;
  });
  expect(checkDesign(d)).toEqual([]);
});

it('warns on a visible section missing its image', () => {
  const d = doc((del) => {
    const m = del.sections.find((s) => s.type === 'manifiesto')!;
    if (m.type === 'manifiesto') m.props.imageUrl = '';
  });
  const issues = checkDesign(d);
  expect(issues).toHaveLength(1);
  expect(issues[0]!.sectionId).toBe('manifiesto');
  expect(issues[0]!.message).toMatch(/imagen/i);
});

it('warns on a CTA with label but no link, and on a malformed link', () => {
  const withCta = (ctaLabel: string, ctaHref: string) => doc((d) => {
    const s: PageSection = {
      id: 'ti-1', type: 'textImage', visible: true,
      props: { kicker: '', title: 'T', body: 'b', imageUrl: '/x.png', imageSide: 'right', ctaLabel, ctaHref },
    };
    d.sections.push(s);
  });
  expect(checkDesign(withCta('Ver más', ''))).toHaveLength(1);
  expect(checkDesign(withCta('Ver más', 'javascript:alert(1)'))).toHaveLength(1);
  expect(checkDesign(withCta('Ver más', '#productos'))).toEqual([]);
  expect(checkDesign(withCta('Ver más', 'https://ejemplo.com'))).toEqual([]);
  expect(checkDesign(withCta('', ''))).toEqual([]); // no button at all — fine
});

it('warns on a visible gallery without images', () => {
  const d = doc((del) => {
    del.sections.push({ id: 'gal-1', type: 'gallery', visible: true, props: { kicker: '', title: 'Galería', columns: 3, images: [] } });
  });
  const issues = checkDesign(d);
  expect(issues).toHaveLength(1);
  expect(issues[0]!.sectionId).toBe('gal-1');
});

it('warns on FAQ questions without an answer', () => {
  const d = doc((del) => {
    del.sections.push({ id: 'faq-1', type: 'faq', visible: true, props: { kicker: '', title: 'FAQ', items: [{ q: '¿Talles?', a: '' }] } });
  });
  expect(checkDesign(d)).toHaveLength(1);
});

it('surfaces low-contrast theme combinations as warnings', () => {
  const d = doc((del) => { del.theme.colors.text = '#1a1a1a'; }); // dark text on dark bg
  const issues = checkDesign(d);
  expect(issues.length).toBeGreaterThan(0);
  expect(issues.every((i) => i.severity === 'warn')).toBe(true);
});
