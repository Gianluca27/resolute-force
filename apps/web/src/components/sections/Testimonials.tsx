import type { TestimonialsProps, SectionStyle, SectionLayout } from '@resolute/shared';
import { sectionOverrides, SECTION_PAD, SECTION_PX } from './shell';
import { sectionEl } from './layoutEl';

export default function Testimonials({ id, props, sectionStyle, layout }: { id: string; props: TestimonialsProps; sectionStyle?: SectionStyle; layout?: SectionLayout }) {
  const o = sectionOverrides(sectionStyle, { bg: 'bg-panel border-y border-line', pad: SECTION_PAD });
  const el = sectionEl(layout);
  if (props.items.length === 0) return null;
  return (
    <section id={id} data-screen-label="Testimonios" style={o.css} className={`scroll-mt-20 ${o.bgCls} ${SECTION_PX} ${o.padCls} ${o.alignCls}`}>
      <div className="max-w-[1180px] mx-auto">
        {props.kicker && <div {...el('kicker', 'font-display font-bold text-[13px] tracking-[0.3em] uppercase text-gold mb-[18px]')}>{props.kicker}</div>}
        {props.title && <h2 {...el('title', 'm-0 mb-10 font-display font-black uppercase leading-[0.92] tracking-[-0.01em] text-[clamp(2rem,4.5vw,3.2rem)]')}>{props.title}</h2>}
        <div {...el('cards', 'grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]')}>
          {props.items.map((t, i) => (
            <figure key={i} className="m-0 bg-card border border-line2 rounded-[var(--rf-radius)] p-6 flex flex-col gap-4">
              <blockquote className="m-0 text-tx leading-[1.6] text-[15px] flex-1">
                <span className="text-gold font-display text-[24px] leading-none block mb-2" aria-hidden>“</span>
                {t.quote}
              </blockquote>
              <figcaption className="flex items-center gap-3">
                {t.imageUrl && <img src={t.imageUrl} alt="" className="w-10 h-10 rounded-full object-cover border border-line2" />}
                <div>
                  <div className="font-display font-bold text-[13px] tracking-[0.1em] uppercase text-tx">{t.name}</div>
                  {t.detail && <div className="text-mut text-[12px]">{t.detail}</div>}
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
