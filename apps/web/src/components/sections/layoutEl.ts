import type { CSSProperties } from 'react';
import type { SectionLayout } from '@resolute/shared';

// Movable-element instrumentation. Every candidate element gets data-rf-el
// (drag target for the design editor) + the rf-el class; offsets/width land
// as CSS vars consumed by a ≥1024px media query in index.css, so mobile keeps
// the responsive layout untouched.

export interface ElProps {
  'data-rf-el': string;
  className: string;
  style?: CSSProperties;
}

export function sectionEl(layout: SectionLayout | undefined) {
  return (key: string, className = '', style?: CSSProperties): ElProps => {
    const l = layout?.[key];
    const cls = ['rf-el', l?.w != null ? 'rf-el-w' : '', className].filter(Boolean).join(' ');
    if (!l && !style) return { 'data-rf-el': key, className: cls };
    const s: Record<string, string | number | undefined> = { ...(style as Record<string, string | number | undefined>) };
    if (l) {
      if (l.dx !== 0 || l.dy !== 0) { s['--el-dx'] = `${l.dx}px`; s['--el-dy'] = `${l.dy}px`; }
      if (l.w != null) s['--el-w'] = `${l.w}px`;
    }
    return { 'data-rf-el': key, className: cls, style: s as CSSProperties };
  };
}
