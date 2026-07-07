import { useEffect } from 'react';
import type { Theme } from '@resolute/shared';
import { themeToCss, fontsHref } from '../lib/theme';

const LINK_ID = 'rf-theme-fonts';

/**
 * Applies a page-design theme: overrides the :root CSS variables and loads any
 * Google Fonts not shipped in index.html. Mounted only on the public landing
 * and the designer preview — the admin UI keeps the default tokens.
 */
export default function ThemeStyle({ theme }: { theme: Theme }) {
  const href = fontsHref(theme);
  useEffect(() => {
    let link = document.getElementById(LINK_ID) as HTMLLinkElement | null;
    if (!href) { link?.remove(); return; }
    if (!link) {
      link = document.createElement('link');
      link.id = LINK_ID;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    if (link.href !== href) link.href = href;
  }, [href]);
  return <style>{themeToCss(theme)}</style>;
}
