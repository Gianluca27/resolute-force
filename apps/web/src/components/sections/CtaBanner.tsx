import type { CtaBannerProps, SectionStyle } from '@resolute/shared';
import { sectionOverrides, SECTION_PX } from './shell';

export default function CtaBanner({ id, props, sectionStyle }: { id: string; props: CtaBannerProps; sectionStyle?: SectionStyle }) {
  const o = sectionOverrides(sectionStyle, { bg: '', pad: 'py-[clamp(56px,9vh,100px)]' });
  const v = props.variant;
  const wrapCls =
    v === 'accent' ? 'bg-red text-white'
    : v === 'secondary' ? 'bg-gold text-black'
    : v === 'dark' ? 'bg-panel border-y border-line text-tx'
    : 'text-white';
  const btnCls =
    v === 'accent' ? 'bg-white text-red hover:opacity-90'
    : v === 'secondary' ? 'bg-black text-gold hover:opacity-90'
    : 'bg-red text-white hover:bg-redd';
  return (
    <section id={id} data-screen-label="Banner CTA" style={o.css}
      className={`relative overflow-hidden scroll-mt-20 ${wrapCls} ${o.bgCls} ${SECTION_PX} ${o.padCls}`}>
      {v === 'image' && props.imageUrl && (
        <>
          <img src={props.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/60" />
        </>
      )}
      <div className="relative z-[2] max-w-[900px] mx-auto text-center">
        <h2 className="m-0 font-display font-black uppercase leading-[0.9] tracking-[-0.01em] text-[clamp(2rem,5vw,3.6rem)]">{props.title}</h2>
        {props.subtitle && <p className="mx-auto mt-4 max-w-[560px] leading-[1.6] text-[clamp(15px,1.2vw,17px)] opacity-85">{props.subtitle}</p>}
        {props.ctaLabel && props.ctaHref && (
          <a href={props.ctaHref} className={`inline-flex items-center gap-[10px] mt-8 no-underline font-display font-bold text-[16px] tracking-[0.13em] uppercase px-[32px] py-[16px] rounded-[var(--rf-btn-radius)] transition hover:-translate-y-[2px] ${btnCls}`}>{props.ctaLabel}</a>
        )}
      </div>
    </section>
  );
}
