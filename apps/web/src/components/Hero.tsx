import type { ContentDTO } from '@resolute/shared';

const badgeCls = 'flex items-center gap-[9px] text-mut text-[13.5px] font-display font-semibold tracking-[0.13em] uppercase';

export default function Hero({ content }: { content: ContentDTO }) {
  return (
    <section id="inicio" data-screen-label="Hero" className="relative scroll-mt-20 min-h-[88vh] flex items-center overflow-hidden px-[clamp(18px,5vw,64px)] pt-[clamp(48px,9vh,120px)] pb-[clamp(40px,7vh,90px)]">
      <div className="pointer-events-none absolute right-[-2%] top-[46%] -translate-y-1/2 w-[min(64vw,760px)] opacity-[0.05]">
        <img src="/assets/logo-r.png" alt="" className="w-full h-auto block grayscale" />
      </div>
      <div className="pointer-events-none absolute right-[4%] top-[34%] w-[min(52vw,620px)] h-[min(52vw,620px)] blur-[14px]" style={{ background: 'radial-gradient(circle,rgba(228,50,43,.20),transparent 62%)' }} />
      <div className="relative z-[2] max-w-[1180px] mx-auto w-full">
        <div className="inline-flex items-center gap-3 mb-[26px]">
          <span className="w-[30px] h-[2px] bg-gold inline-block" />
          <span className="font-display font-bold text-[13px] tracking-[0.3em] uppercase text-gold">{content.heroKicker}</span>
        </div>
        <h1 className="m-0 font-display font-black uppercase leading-[0.82] tracking-[-0.02em] text-[clamp(3.6rem,11vw,9.5rem)]">
          <span className="block text-tx">{content.heroTitle1}</span>
          <span className="block text-red" style={{ textShadow: '0 0 60px rgba(228,50,43,.35)' }}>{content.heroTitle2}</span>
        </h1>
        <p className="max-w-[540px] mt-[30px] text-mut leading-[1.6] text-[clamp(16px,1.3vw,19px)]">{content.heroSubtitle} <span className="text-tx font-semibold">Esta es la norma Resolute.</span></p>
        <div className="flex flex-wrap gap-[14px] mt-[38px]">
          <a href="#productos" className="inline-flex items-center gap-[10px] bg-red text-white no-underline font-display font-bold text-[17px] tracking-[0.13em] uppercase px-[34px] py-[17px] rounded-[2px] transition hover:bg-redd hover:-translate-y-[2px]">Ver colección
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </a>
          <a href="#manifiesto" className="inline-flex items-center gap-[10px] bg-transparent text-tx no-underline font-display font-bold text-[17px] tracking-[0.13em] uppercase px-[32px] py-[17px] rounded-[2px] border border-line2 transition hover:border-gold hover:text-gold">El manifiesto</a>
        </div>
        <div className="flex flex-wrap gap-[26px] mt-[50px] pt-[26px] border-t border-line max-w-[620px]">
          <div className={badgeCls}><span className="text-gold">◆</span> Envíos a todo el país</div>
          <div className={badgeCls}><span className="text-gold">◆</span> 3 cuotas sin interés</div>
          <div className={badgeCls}><span className="text-gold">◆</span> Algodón premium</div>
        </div>
      </div>
      <div className="absolute left-1/2 bottom-[22px] -translate-x-1/2 flex flex-col items-center gap-[7px] text-mut animate-float z-[2]">
        <span className="font-display text-[11px] tracking-[0.3em] uppercase">Scroll</span>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M6 13l6 6 6-6" /></svg>
      </div>
    </section>
  );
}
