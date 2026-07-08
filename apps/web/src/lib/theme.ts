import { FONT_OPTIONS, type FontId, type Theme } from '@resolute/shared';

/** '#e4322b' → '228 50 43' (RGB channel triplet for rgb(var() / alpha)). */
export function hexToChannels(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

const BTN_RADIUS: Record<Theme['shapes']['buttonStyle'], string> = {
  square: '2px', rounded: '10px', pill: '999px',
};

export function fontById(id: FontId) {
  return FONT_OPTIONS.find((f) => f.id === id) ?? FONT_OPTIONS[0];
}

/** CSS overriding the :root token defaults from index.css. */
export function themeToCss(theme: Theme): string {
  const c = theme.colors;
  return `:root{--rf-bg:${hexToChannels(c.bg)};--rf-panel:${hexToChannels(c.panel)};--rf-card:${hexToChannels(c.card)};--rf-tx:${hexToChannels(c.text)};--rf-mut:${hexToChannels(c.muted)};--rf-accent:${hexToChannels(c.accent)};--rf-accent-dark:${hexToChannels(c.accentDark)};--rf-secondary:${hexToChannels(c.secondary)};--rf-font-display:${fontById(theme.fonts.display).family};--rf-font-body:${fontById(theme.fonts.body).family};--rf-radius:${theme.shapes.radius}px;--rf-btn-radius:${BTN_RADIUS[theme.shapes.buttonStyle]};}`;
}

/** Google Fonts css2 URL for the theme's fonts, or null if both ship in index.html. */
export function fontsHref(theme: Theme): string | null {
  const ids = [...new Set([theme.fonts.display, theme.fonts.body])]
    .filter((id) => id !== 'saira-condensed' && id !== 'barlow');
  if (!ids.length) return null;
  const q = ids.map((id) => `family=${fontById(id).gf}`).join('&');
  return `https://fonts.googleapis.com/css2?${q}&display=swap`;
}

// ---- WCAG contrast (editor warning) ----
function luminance(hex: string): number {
  const [r, g, b] = hexToChannels(hex).split(' ').map((v) => {
    const s = Number(v) / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/**
 * Pairs the theme editor checks; below the threshold we warn (never block).
 * Body-text pairs use WCAG AA 4.5:1; button labels are large bold display
 * text, where AA asks 3:1 — 4.5 there would flag the default brand red.
 */
export function contrastWarnings(theme: Theme): string[] {
  const c = theme.colors;
  const checks: Array<[string, string, string, number]> = [
    ['Texto sobre fondo', c.text, c.bg, 4.5],
    ['Texto sobre paneles', c.text, c.panel, 4.5],
    ['Texto sobre tarjetas', c.text, c.card, 4.5],
    ['Texto secundario sobre fondo', c.muted, c.bg, 4.5],
    ['Blanco sobre acento (botones)', '#ffffff', c.accent, 3],
  ];
  return checks
    .filter(([, fg, bg, min]) => contrastRatio(fg, bg) < min)
    .map(([label, fg, bg, min]) => `${label}: contraste ${contrastRatio(fg, bg).toFixed(1)}:1 (mínimo legible ${min}:1)`);
}
