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
  {
    id: 'arena', label: 'Arena',
    colors: { bg: '#f4efe6', panel: '#ece4d4', card: '#fffdf7', text: '#201a12', muted: '#655c4d', accent: '#a34a08', accentDark: '#7f3a06', secondary: '#7a5a10' },
  },
  {
    id: 'violeta', label: 'Violeta',
    colors: { bg: '#0d0a1a', panel: '#131022', card: '#1b1730', text: '#f2f0fa', muted: '#9a93b8', accent: '#7c3aed', accentDark: '#6d28d9', secondary: '#22d3ee' },
  },
  {
    id: 'vino', label: 'Vino',
    colors: { bg: '#140a0d', panel: '#1a0d11', card: '#241318', text: '#f6f1f2', muted: '#a08e93', accent: '#b0223f', accentDark: '#8e1b33', secondary: '#d9a441' },
  },
];
