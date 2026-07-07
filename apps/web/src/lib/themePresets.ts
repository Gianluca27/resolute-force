import type { Theme } from '@resolute/shared';

// Color-only presets: applying one keeps the current fonts and shapes.
export const THEME_PRESETS: Array<{ id: string; label: string; colors: Theme['colors'] }> = [
  {
    id: 'resolute', label: 'Resolute',
    colors: { bg: '#0a0a0b', panel: '#0e0e10', card: '#161619', text: '#f4f4f3', muted: '#97979d', accent: '#e4322b', accentDark: '#bb211c', secondary: '#e8b53e' },
  },
  {
    id: 'claro', label: 'Claro',
    colors: { bg: '#f6f6f4', panel: '#ececea', card: '#ffffff', text: '#17171a', muted: '#63636a', accent: '#d02a24', accentDark: '#a81f1a', secondary: '#8a6510' },
  },
  {
    id: 'medianoche', label: 'Medianoche',
    colors: { bg: '#0b1020', panel: '#0e1428', card: '#141b33', text: '#eef0f6', muted: '#8f96ab', accent: '#3b82f6', accentDark: '#2563eb', secondary: '#f59e0b' },
  },
  {
    id: 'bosque', label: 'Bosque',
    colors: { bg: '#0c120d', panel: '#0f1710', card: '#16211a', text: '#eef3ee', muted: '#93a096', accent: '#16a34a', accentDark: '#15803d', secondary: '#eab308' },
  },
  {
    id: 'acero', label: 'Acero',
    colors: { bg: '#0b0d10', panel: '#0f1216', card: '#171b21', text: '#f1f3f5', muted: '#8b939d', accent: '#64748b', accentDark: '#475569', secondary: '#cbd5e1' },
  },
];
