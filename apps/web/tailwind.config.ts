import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Colors resolve through CSS variables (RGB channel triplets) so the admin
      // page-designer can re-theme at runtime; defaults in index.css :root keep
      // the site pixel-identical when no custom theme is published.
      colors: {
        bg: 'rgb(var(--rf-bg) / <alpha-value>)',
        panel: 'rgb(var(--rf-panel) / <alpha-value>)',
        card: 'rgb(var(--rf-card) / <alpha-value>)',
        tx: 'rgb(var(--rf-tx) / <alpha-value>)',
        mut: 'rgb(var(--rf-mut) / <alpha-value>)',
        red: 'rgb(var(--rf-accent) / <alpha-value>)',
        redd: 'rgb(var(--rf-accent-dark) / <alpha-value>)',
        gold: 'rgb(var(--rf-secondary) / <alpha-value>)',
        // Hairlines derive from the text color so borders adapt to light themes too.
        line: 'rgb(var(--rf-tx) / 0.08)', line2: 'rgb(var(--rf-tx) / 0.16)',
      },
      fontFamily: {
        display: ['var(--rf-font-display)', 'system-ui', 'sans-serif'],
        body: ['var(--rf-font-body)', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        marquee: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
        fade: { from: { opacity: '0' }, to: { opacity: '1' } },
        slidein: { from: { opacity: '0', transform: 'translateX(36px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        rise: { from: { opacity: '0', transform: 'translateY(24px) scale(.98)' }, to: { opacity: '1', transform: 'translateY(0) scale(1)' } },
        toast: { '0%': { opacity: '0', transform: 'translate(-50%,16px)' }, '12%': { opacity: '1', transform: 'translate(-50%,0)' }, '88%': { opacity: '1', transform: 'translate(-50%,0)' }, '100%': { opacity: '0', transform: 'translate(-50%,16px)' } },
        ember: { '0%,100%': { opacity: '.45', transform: 'scale(1)' }, '50%': { opacity: '.85', transform: 'scale(1.08)' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(8px)' } },
      },
      animation: {
        marquee: 'marquee 32s linear infinite',
        fade: 'fade .25s ease both',
        slidein: 'slidein .3s cubic-bezier(.2,.7,.2,1) both',
        rise: 'rise .3s cubic-bezier(.2,.7,.2,1) both',
        toast: 'toast 2.4s ease both',
        ember: 'ember 4s ease-in-out infinite',
        float: 'float 2.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
