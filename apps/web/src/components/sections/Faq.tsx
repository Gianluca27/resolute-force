import type { FaqProps, SectionStyle } from '@resolute/shared';
import { sectionOverrides, SECTION_PAD, SECTION_PX } from './shell';

export default function Faq({ id, props, sectionStyle }: { id: string; props: FaqProps; sectionStyle?: SectionStyle }) {
  const o = sectionOverrides(sectionStyle, { bg: 'bg-panel border-y border-line', pad: SECTION_PAD });
  return (
    <section id={id} data-screen-label="FAQ" style={o.css} className={`scroll-mt-20 ${o.bgCls} ${SECTION_PX} ${o.padCls}`}>
      <div className="max-w-[820px] mx-auto">
        <div className="text-center mb-[40px]">
          {props.kicker && <div className="font-display font-bold text-[13px] tracking-[0.3em] uppercase text-gold mb-[14px]">{props.kicker}</div>}
          <h2 className="m-0 font-display font-black uppercase leading-[0.9] tracking-[-0.01em] text-[clamp(2.2rem,5vw,4rem)]">{props.title}</h2>
        </div>
        <div className="flex flex-col gap-[10px]">
          {props.items.map((it, i) => (
            <details key={i} className="group bg-card border border-line rounded-[var(--rf-radius)] px-[20px] py-[4px] open:border-line2">
              <summary className="cursor-pointer list-none flex items-center justify-between gap-4 py-[14px] font-display font-bold text-[17px] tracking-[0.04em] uppercase">
                {it.q}
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-gold transition-transform group-open:rotate-45"><path d="M12 5v14M5 12h14" /></svg>
              </summary>
              <div className="pb-[18px] text-mut leading-[1.7] text-[15.5px] whitespace-pre-line">{it.a}</div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
