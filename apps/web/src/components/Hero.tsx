import type { HeroProps, SectionStyle } from '@resolute/shared';
import { sectionOverrides, SECTION_PX } from './sections/shell';

const badgeCls = 'flex items-center gap-[9px] text-mut text-[13.5px] font-display font-semibold tracking-[0.13em] uppercase';

export default function Hero({ id = 'hero', props, sectionStyle, anchors }: {
  id?: string;
  props: HeroProps;
  sectionStyle?: SectionStyle;
  anchors?: { products?: string; manifiesto?: string };
}) {
  const o = sectionOverrides(sectionStyle, { bg: '', pad: 'pt-[clamp(48px,9vh,120px)] pb-[clamp(40px,7vh,90px)]' });
  return (
    <section id={id} data-screen-label="Hero" style={o.css} className={`relative scroll-mt-20 min-h-[88vh] flex items-center overflow-hidden ${SECTION_PX} ${o.padCls} ${o.bgCls}`}>
      <div className="pointer-events-none absolute right-[-2%] top-[46%] -translate-y-1/2 w-[min(64vw,760px)] opacity-[0.05]">
        <img src="/assets/logo-r.png" alt="" className="w-full h-auto block grayscale" />
      </div>
      <div className="pointer-events-none absolute right-[4%] top-[34%] w-[min(52vw,620px)] h-[min(52vw,620px)] blur-[14px]" style={{ background: 'radial-gradient(circle,rgb(var(--rf-accent) / .20),transparent 62%)' }} />
      <div className="relative z-[2] max-w-[1180px] mx-auto w-full">
        {props.kicker && (
          <div className="inline-flex items-center gap-3 mb-[26px]">
            <span className="w-[30px] h-[2px] bg-gold inline-block" />
            <span className="font-display font-bold text-[13px] tracking-[0.3em] uppercase text-gold">{props.kicker}</span>
          </div>
        )}
        <h1 className="m-0 font-display font-black uppercase leading-[0.82] tracking-[-0.02em] text-[clamp(3.6rem,11vw,9.5rem)]">
          <span className="block text-tx">{props.title1}</span>
          <span className="block text-red" style={{ textShadow: '0 0 60px rgb(var(--rf-accent) / .35)' }}>{props.title2}</span>
        </h1>
        <p className="max-w-[540px] mt-[30px] text-mut leading-[1.6] text-[clamp(16px,1.3vw,19px)]">{props.subtitle}{props.subtitleHighlight && <> <span className="text-tx font-semibold">{props.subtitleHighlight}</span></>}</p>
        <div className="flex flex-wrap gap-[14px] mt-[38px]">
          {props.ctaPrimary && (
            <a href={`#${anchors?.products ?? 'productos'}`} className="inline-flex items-center gap-[10px] bg-red text-white no-underline font-display font-bold text-[17px] tracking-[0.13em] uppercase px-[34px] py-[17px] rounded-[var(--rf-btn-radius)] transition hover:bg-redd hover:-translate-y-[2px]">{props.ctaPrimary}
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </a>
          )}
          {props.ctaSecondary && (
            <a href={`#${anchors?.manifiesto ?? 'manifiesto'}`} className="inline-flex items-center gap-[10px] bg-transparent text-tx no-underline font-display font-bold text-[17px] tracking-[0.13em] uppercase px-[32px] py-[17px] rounded-[var(--rf-btn-radius)] border border-line2 transition hover:border-gold hover:text-gold">{props.ctaSecondary}</a>
          )}
        </div>
        {props.badges.length > 0 && (
          <div className="flex flex-wrap gap-[26px] mt-[50px] pt-[26px] border-t border-line max-w-[620px]">
            {props.badges.map((b, i) => (
              <div key={i} className={badgeCls}><span className="text-gold">◆</span> {b}</div>
            ))}
          </div>
        )}
      </div>
      <div className="absolute left-1/2 bottom-[22px] -translate-x-1/2 flex flex-col items-center gap-[7px] text-mut animate-float z-[2]">
        <span className="font-display text-[11px] tracking-[0.3em] uppercase">Scroll</span>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M6 13l6 6-6 6" /></svg>
      </div>
    </section>
  );
}
