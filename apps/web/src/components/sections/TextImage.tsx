import type { TextImageProps, SectionStyle } from '@resolute/shared';
import { sectionOverrides, SECTION_PAD, SECTION_PX } from './shell';

export default function TextImage({ id, props, sectionStyle }: { id: string; props: TextImageProps; sectionStyle?: SectionStyle }) {
  const o = sectionOverrides(sectionStyle, { bg: '', pad: SECTION_PAD });
  const paragraphs = props.body.split('\n').filter(Boolean);
  return (
    <section id={id} data-screen-label="Texto + Imagen" style={o.css} className={`scroll-mt-20 ${o.bgCls} ${SECTION_PX} ${o.padCls}`}>
      <div className="max-w-[1180px] mx-auto flex flex-wrap gap-[clamp(36px,5vw,72px)] items-center">
        <div className={`flex-1 basis-[360px] min-w-[300px] ${props.imageSide === 'left' ? 'order-1' : 'order-2'}`}>
          {props.imageUrl && (
            <div className="border border-line2 rounded-[var(--rf-radius)] overflow-hidden">
              <img src={props.imageUrl} alt="" className="block w-full h-auto" />
            </div>
          )}
        </div>
        <div className={`flex-1 basis-[420px] min-w-[300px] ${props.imageSide === 'left' ? 'order-2' : 'order-1'}`}>
          {props.kicker && <div className="font-display font-bold text-[13px] tracking-[0.3em] uppercase text-gold mb-[18px]">{props.kicker}</div>}
          <h2 className="m-0 font-display font-black uppercase leading-[0.92] tracking-[-0.01em] text-[clamp(2.2rem,5vw,3.8rem)]">{props.title}</h2>
          {paragraphs.map((p, i) => (
            <p key={i} className="mt-6 text-mut leading-[1.7] max-w-[520px] text-[clamp(16px,1.2vw,18px)]">{p}</p>
          ))}
          {props.ctaLabel && props.ctaHref && (
            <a href={props.ctaHref} className="inline-flex items-center gap-[10px] mt-8 bg-red text-white no-underline font-display font-bold text-[16px] tracking-[0.13em] uppercase px-[30px] py-[15px] rounded-[var(--rf-btn-radius)] transition hover:bg-redd hover:-translate-y-[2px]">{props.ctaLabel}</a>
          )}
        </div>
      </div>
    </section>
  );
}
