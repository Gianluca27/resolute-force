import type { CSSProperties } from 'react';
import type { SectionStyle } from '@resolute/shared';

// Per-section style overrides. 'default' keeps the classes each section was
// designed with (passed as `designed`); anything else replaces them.

const PAD: Record<Exclude<SectionStyle['paddingY'], 'default'>, string> = {
  sm: 'py-[clamp(28px,4vh,44px)]',
  md: 'py-[clamp(48px,7vh,84px)]',
  lg: 'py-[clamp(80px,12vh,150px)]',
};

const BG: Record<Exclude<SectionStyle['background'], 'default' | 'custom'>, string> = {
  bg: 'bg-bg',
  panel: 'bg-panel border-y border-line',
};

export function sectionOverrides(
  style: SectionStyle | undefined,
  designed: { bg: string; pad: string },
): { bgCls: string; padCls: string; css?: CSSProperties } {
  const bg = style?.background ?? 'default';
  const pad = style?.paddingY ?? 'default';
  return {
    bgCls: bg === 'default' ? designed.bg : bg === 'custom' ? '' : BG[bg],
    padCls: pad === 'default' ? designed.pad : PAD[pad],
    css: bg === 'custom' && style?.customBg ? { backgroundColor: style.customBg } : undefined,
  };
}

/** Standard section paddings shared by most designed sections. */
export const SECTION_PAD = 'py-[clamp(64px,10vh,120px)]';
export const SECTION_PX = 'px-[clamp(18px,5vw,64px)]';
