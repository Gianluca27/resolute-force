import type { ManifiestoProps, SectionStyle } from '@resolute/shared';
import { sectionOverrides, SECTION_PAD, SECTION_PX } from './sections/shell';

// Principle accents rotate through the theme trio, like the original design.
const PRINCIPLE_COLORS = ['rgb(var(--rf-accent))', 'rgb(var(--rf-secondary))', 'rgb(var(--rf-tx))'];

function Principle({ n, title, sub, color }: { n: string; title: string; sub: string; color: string }) {
  return (
    <div className="flex items-baseline gap-[18px] py-[18px] border-t border-line">
      <span className="font-display font-extrabold text-[15px] tracking-[0.1em] w-[34px] shrink-0" style={{ color }}>{n}</span>
      <div>
        <div className="font-display font-bold text-[22px] tracking-[0.04em] uppercase">{title}</div>
        <div className="text-mut text-[15px] mt-[2px]">{sub}</div>
      </div>
    </div>
  );
}

export default function Manifiesto({ id = 'manifiesto', props, sectionStyle }: { id?: string; props: ManifiestoProps; sectionStyle?: SectionStyle }) {
  const o = sectionOverrides(sectionStyle, { bg: 'bg-panel border-y border-line', pad: SECTION_PAD });
  return (
    <section id={id} data-screen-label="Manifiesto" style={o.css} className={`scroll-mt-20 ${o.bgCls} ${SECTION_PX} ${o.padCls}`}>
      <div className="max-w-[1180px] mx-auto flex flex-wrap gap-[clamp(36px,5vw,72px)] items-center">
        <div className="flex-1 basis-[360px] min-w-[300px] relative">
          <div className="pointer-events-none absolute -inset-[10px] blur-[8px]" style={{ background: 'radial-gradient(circle at 50% 40%,rgb(var(--rf-accent) / .18),transparent 70%)' }} />
          <div className="relative border border-line2 rounded-[var(--rf-radius)] overflow-hidden bg-black">
            <img src={props.imageUrl} alt="" className="block w-full h-auto" />
            {props.imageBadge && (
              <div className="absolute left-4 top-4 bg-[rgb(var(--rf-bg)/0.7)] backdrop-blur-[6px] border border-line2 text-gold font-display font-bold text-[12px] tracking-[0.2em] uppercase px-3 py-[7px] rounded-[var(--rf-btn-radius)]">{props.imageBadge}</div>
            )}
          </div>
        </div>
        <div className="flex-1 basis-[420px] min-w-[300px]">
          {props.kicker && <div className="font-display font-bold text-[13px] tracking-[0.3em] uppercase text-gold mb-[18px]">{props.kicker}</div>}
          <h2 className="m-0 font-display font-black uppercase leading-[0.92] tracking-[-0.01em] text-[clamp(2.4rem,5.4vw,4.4rem)]">{props.title}{props.titleAccent && <><br /><span className="text-red">{props.titleAccent}</span></>}</h2>
          <p className="mt-6 text-mut leading-[1.7] max-w-[520px] text-[clamp(16px,1.2vw,18px)]">{props.body}{props.bodyHighlight && <> <span className="text-tx font-semibold">{props.bodyHighlight}</span></>}</p>
          {props.principles.length > 0 && (
            <div className="flex flex-col mt-9 border-b border-line">
              {props.principles.map((p, i) => (
                <Principle key={i} n={String(i + 1).padStart(2, '0')} title={p.title} sub={p.sub} color={PRINCIPLE_COLORS[i % PRINCIPLE_COLORS.length]!} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
