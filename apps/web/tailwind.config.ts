import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0a0a0b', panel: '#0e0e10', card: '#161619',
        tx: '#f4f4f3', mut: '#97979d',
        red: '#e4322b', redd: '#bb211c', gold: '#e8b53e',
        line: 'rgba(255,255,255,0.08)', line2: 'rgba(255,255,255,0.16)',
      },
      fontFamily: {
        display: ['"Saira Condensed"', 'system-ui', 'sans-serif'],
        body: ['"Barlow"', 'system-ui', 'sans-serif'],
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
