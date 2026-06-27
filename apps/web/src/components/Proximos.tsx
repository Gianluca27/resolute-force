import type { DropDTO } from '@resolute/shared';
import { useCountdown } from '../hooks/useCountdown';

function Cell({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div className="min-w-[78px] border border-line2 rounded bg-[rgba(14,14,16,0.6)] px-[10px] py-4">
      <div className={`font-display font-black leading-none text-[clamp(34px,5vw,48px)] ${accent ? 'text-gold' : 'text-tx'}`}>{value}</div>
      <div className="font-display text-[12px] tracking-[0.2em] uppercase text-mut mt-1">{label}</div>
    </div>
  );
}

export default function Proximos({ drop }: { drop: DropDTO }) {
  const cd = useCountdown(drop.targetAt);
  if (!drop.visible) return null;
  // Render the admin-configured title, accenting the last word in gold (matches the design).
  const words = drop.title.trim().split(/\s+/);
  const lastWord = words.length > 1 ? words.pop()! : '';
  const leadWords = words.join(' ');
  return (
    <section id="proximos" data-screen-label="Proximos" className="relative overflow-hidden text-center px-[clamp(18px,5vw,64px)] py-[clamp(70px,11vh,130px)] scroll-mt-20">
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(70vw,640px)] h-[min(70vw,640px)] animate-ember"
           style={{ background: 'radial-gradient(circle,rgba(232,181,62,.16),rgba(228,50,43,.08) 45%,transparent 70%)' }} />
      <div className="relative z-[2] max-w-[760px] mx-auto">
        <img src="/assets/logo-r.png" alt="" width={64} height={64} className="w-16 h-16 object-contain opacity-90 mb-6 mx-auto" style={{ filter: 'drop-shadow(0 0 22px rgba(232,181,62,.5))' }} />
        <div className="font-display font-bold text-[13px] tracking-[0.34em] uppercase text-gold mb-[18px]">Próximo lanzamiento</div>
        <h2 className="m-0 font-display font-black uppercase leading-[0.88] tracking-[-0.01em] text-[clamp(2.6rem,7vw,5.6rem)]">
          {leadWords}{leadWords && <br />}<span className="text-gold" style={{ textShadow: '0 0 50px rgba(232,181,62,.45)' }}>{lastWord || leadWords}</span>
        </h2>
        <p className="mx-auto mt-[22px] max-w-[480px] text-mut leading-[1.6] text-[clamp(16px,1.2vw,18px)]">{drop.teaser}</p>
        <div className="flex flex-wrap justify-center gap-[clamp(10px,2vw,20px)] mt-[42px]">
          <Cell value={cd.d} label="Días" />
          <Cell value={cd.h} label="Horas" />
          <Cell value={cd.m} label="Min" />
          <Cell value={cd.s} label="Seg" accent />
        </div>
      </div>
    </section>
  );
}
