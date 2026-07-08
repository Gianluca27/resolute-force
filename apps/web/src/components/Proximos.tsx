import type { DropDTO, SectionLayout } from '@resolute/shared';
import { useCountdown } from '../hooks/useCountdown';
import { sectionOverrides } from './sections/shell';
import { sectionEl } from './sections/layoutEl';

function Cell({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div className="min-w-[78px] border border-line2 rounded bg-[rgba(14,14,16,0.6)] px-[10px] py-4">
      <div className={`font-display font-black leading-none text-[clamp(34px,5vw,48px)] ${accent ? 'text-gold' : 'text-tx'}`}>{value}</div>
      <div className="font-display text-[12px] tracking-[0.2em] uppercase text-mut mt-1">{label}</div>
    </div>
  );
}

export default function Proximos({ id = 'proximos', drop, sectionStyle, layout }: { id?: string; drop: DropDTO; sectionStyle?: import('@resolute/shared').SectionStyle; layout?: SectionLayout }) {
  const cd = useCountdown(drop.targetAt);
  const o = sectionOverrides(sectionStyle, { bg: '', pad: 'py-[clamp(70px,11vh,130px)]' });
  const el = sectionEl(layout);
  if (!drop.visible) return null;
  // Render the admin-configured title, accenting the last word in gold (matches the design).
  const words = drop.title.trim().split(/\s+/);
  const lastWord = words.length > 1 ? words.pop()! : '';
  const leadWords = words.join(' ');
  return (
    <section id={id} data-screen-label="Proximos" style={o.css} className={`relative overflow-hidden text-center px-[clamp(18px,5vw,64px)] scroll-mt-20 ${o.padCls} ${o.bgCls}`}>
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(70vw,640px)] h-[min(70vw,640px)] animate-ember"
           style={{ background: 'radial-gradient(circle,rgb(var(--rf-secondary) / .16),rgb(var(--rf-accent) / .08) 45%,transparent 70%)' }} />
      <div className="relative z-[2] max-w-[760px] mx-auto">
        <img src="/assets/logo-r.png" alt="" width={64} height={64} className="w-16 h-16 object-contain opacity-90 mb-6 mx-auto" style={{ filter: 'drop-shadow(0 0 22px rgb(var(--rf-secondary) / .5))' }} />
        <div {...el('kicker', 'font-display font-bold text-[13px] tracking-[0.34em] uppercase text-gold mb-[18px]')}>Próximo lanzamiento</div>
        <h2 {...el('title', 'm-0 font-display font-black uppercase leading-[0.88] tracking-[-0.01em] text-[clamp(2.6rem,7vw,5.6rem)]')}>
          {leadWords}{leadWords && <br />}<span className="text-gold" style={{ textShadow: '0 0 50px rgb(var(--rf-secondary) / .45)' }}>{lastWord || leadWords}</span>
        </h2>
        <p {...el('teaser', 'mx-auto mt-[22px] max-w-[480px] text-mut leading-[1.6] text-[clamp(16px,1.2vw,18px)]')}>{drop.teaser}</p>
        <div {...el('timer', 'flex flex-wrap justify-center gap-[clamp(10px,2vw,20px)] mt-[42px]')}>
          <Cell value={cd.d} label="Días" />
          <Cell value={cd.h} label="Horas" />
          <Cell value={cd.m} label="Min" />
          <Cell value={cd.s} label="Seg" accent />
        </div>
      </div>
    </section>
  );
}
