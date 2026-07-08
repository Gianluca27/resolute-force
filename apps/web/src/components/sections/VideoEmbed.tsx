import type { VideoEmbedProps, SectionStyle, SectionLayout } from '@resolute/shared';
import { videoEmbedUrl } from '../../lib/videoEmbed';
import { sectionOverrides, SECTION_PAD, SECTION_PX } from './shell';
import { sectionEl } from './layoutEl';

export default function VideoEmbed({ id, props, sectionStyle, layout }: { id: string; props: VideoEmbedProps; sectionStyle?: SectionStyle; layout?: SectionLayout }) {
  const o = sectionOverrides(sectionStyle, { bg: '', pad: SECTION_PAD });
  const el = sectionEl(layout);
  const src = videoEmbedUrl(props.url);
  if (!src) return null; // unrecognized URL — render nothing rather than a broken frame
  return (
    <section id={id} data-screen-label="Video" style={o.css} className={`scroll-mt-20 ${o.bgCls} ${SECTION_PX} ${o.padCls} ${o.alignCls}`}>
      <div className="max-w-[960px] mx-auto">
        {props.kicker && <div {...el('kicker', 'font-display font-bold text-[13px] tracking-[0.3em] uppercase text-gold mb-[18px]')}>{props.kicker}</div>}
        {props.title && <h2 {...el('title', 'm-0 mb-8 font-display font-black uppercase leading-[0.92] tracking-[-0.01em] text-[clamp(2rem,4.5vw,3.2rem)]')}>{props.title}</h2>}
        <div {...el('video', 'relative w-full aspect-video border border-line2 rounded-[var(--rf-radius)] overflow-hidden bg-black')}>
          <iframe
            src={src}
            title={props.title || 'Video'}
            loading="lazy"
            className="absolute inset-0 w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
        {props.caption && <p {...el('caption', 'mt-4 text-mut text-[13px]')}>{props.caption}</p>}
      </div>
    </section>
  );
}
