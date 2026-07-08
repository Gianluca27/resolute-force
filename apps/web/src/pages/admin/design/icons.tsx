import type { SVGProps } from 'react';

// Lucide-style stroke icons inlined (no dependency). All inherit currentColor.

type P = SVGProps<SVGSVGElement> & { size?: number };
const base = (p: P) => {
  const { size = 15, ...rest } = p;
  return {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none' as const,
    stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
    'aria-hidden': true as const, ...rest,
  };
};

export const IconGrip = (p: P) => (
  <svg {...base(p)}><circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/></svg>
);
export const IconEye = (p: P) => (
  <svg {...base(p)}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
);
export const IconEyeOff = (p: P) => (
  <svg {...base(p)}><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 8 10 8a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3.5 8 10 8a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
);
export const IconCopy = (p: P) => (
  <svg {...base(p)}><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
);
export const IconTrash = (p: P) => (
  <svg {...base(p)}><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
);
export const IconMonitor = (p: P) => (
  <svg {...base(p)}><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>
);
export const IconPhone = (p: P) => (
  <svg {...base(p)}><rect width="14" height="20" x="5" y="2" rx="2"/><path d="M12 18h.01"/></svg>
);
export const IconUndo = (p: P) => (
  <svg {...base(p)}><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
);
export const IconRedo = (p: P) => (
  <svg {...base(p)}><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/></svg>
);
export const IconUp = (p: P) => <svg {...base(p)}><path d="m18 15-6-6-6 6"/></svg>;
export const IconDown = (p: P) => <svg {...base(p)}><path d="m6 9 6 6 6-6"/></svg>;
export const IconLeft = (p: P) => <svg {...base(p)}><path d="m15 18-6-6 6-6"/></svg>;
export const IconRight = (p: P) => <svg {...base(p)}><path d="m9 18 6-6-6-6"/></svg>;
export const IconX = (p: P) => <svg {...base(p)}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>;
export const IconPlus = (p: P) => <svg {...base(p)}><path d="M5 12h14"/><path d="M12 5v14"/></svg>;
export const IconHistory = (p: P) => (
  <svg {...base(p)}><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>
);
export const IconAlert = (p: P) => (
  <svg {...base(p)}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
);
export const IconExternal = (p: P) => (
  <svg {...base(p)}><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
);
