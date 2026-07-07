import type { GalleryProps, SectionStyle } from '@resolute/shared';
import { sectionOverrides, SECTION_PAD, SECTION_PX } from './shell';

const COLS: Record<GalleryProps['columns'], string> = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-2 lg:grid-cols-3',
  4: 'sm:grid-cols-2 lg:grid-cols-4',
};

export default function Gallery({ id, props, sectionStyle }: { id: string; props: GalleryProps; sectionStyle?: SectionStyle }) {
  const o = sectionOverrides(sectionStyle, { bg: '', pad: SECTION_PAD });
  return (
    <section id={id} data-screen-label="Galería" style={o.css} className={`scroll-mt-20 ${o.bgCls} ${SECTION_PX} ${o.padCls}`}>
      <div className="max-w-[1180px] mx-auto">
        {(props.kicker || props.title) && (
          <div className="text-center mb-[44px]">
            {props.kicker && <div className="font-display font-bold text-[13px] tracking-[0.3em] uppercase text-gold mb-[14px]">{props.kicker}</div>}
            {props.title && <h2 className="m-0 font-display font-black uppercase leading-[0.9] tracking-[-0.01em] text-[clamp(2.2rem,5vw,4rem)]">{props.title}</h2>}
          </div>
        )}
        <div className={`grid grid-cols-1 gap-[14px] ${COLS[props.columns]}`}>
          {props.images.map((img, i) => (
            <div key={i} className="border border-line rounded-[var(--rf-radius)] overflow-hidden bg-card">
              <img src={img.url} alt={img.alt} loading="lazy" className="block w-full aspect-square object-cover transition hover:scale-[1.03]" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
