import { DEFAULT_PAGE_DESIGN } from '@resolute/shared';
import { THEME_PRESETS } from './themePresets';
import { contrastWarnings } from './theme';

// A preset that ships with contrast warnings trains the merchant to ignore
// the pre-publish checklist. Every curated preset must be clean.
it('every theme preset passes the contrast checks', () => {
  for (const p of THEME_PRESETS) {
    const theme = { ...DEFAULT_PAGE_DESIGN.theme, colors: p.colors };
    expect(contrastWarnings(theme), p.id).toEqual([]);
  }
});

it('there are at least 8 presets to choose from', () => {
  expect(THEME_PRESETS.length).toBeGreaterThanOrEqual(8);
});
