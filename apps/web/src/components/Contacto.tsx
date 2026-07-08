import type { ContactoProps, ContentDTO, SectionStyle, SectionLayout } from '@resolute/shared';
import { sectionOverrides, SECTION_PAD, SECTION_PX } from './sections/shell';
import { sectionEl } from './sections/layoutEl';

const card = 'no-underline text-tx bg-card border border-line rounded-[var(--rf-radius)] px-[22px] py-[26px] flex flex-col gap-[14px] transition hover:-translate-y-1';

// Section heading/copy comes from the design doc; the actual channels (whatsapp,
// instagram, email, location) stay in SiteContent — single source shared with
// checkout and footer.
export default function Contacto({ id = 'contacto', props, sectionStyle, layout, content }: {
  id?: string;
  props: ContactoProps;
  sectionStyle?: SectionStyle;
  layout?: SectionLayout;
  content: ContentDTO;
}) {
  const o = sectionOverrides(sectionStyle, { bg: 'bg-panel border-t border-line', pad: SECTION_PAD });
  const el = sectionEl(layout);
  const wa = `https://wa.me/${content.contactWhatsapp}?text=Hola%20Resolute%20Force%2C%20quiero%20hacer%20un%20pedido`;
  return (
    <section id={id} data-screen-label="Contacto" style={o.css} className={`scroll-mt-20 ${o.bgCls} ${SECTION_PX} ${o.padCls}`}>
      <div className="max-w-[1180px] mx-auto">
        <div className="text-center mb-[44px]">
          {props.kicker && <div {...el('kicker', 'font-display font-bold text-[13px] tracking-[0.3em] uppercase text-gold mb-[14px]')}>{props.kicker}</div>}
          <h2 {...el('title', 'm-0 font-display font-black uppercase leading-[0.9] tracking-[-0.01em] text-[clamp(2.4rem,5.6vw,4.4rem)]')}>{props.title}</h2>
          {props.subtitle && <p {...el('subtitle', 'mx-auto mt-4 max-w-[440px] text-mut text-[16px] leading-[1.6]')}>{props.subtitle}</p>}
        </div>
        <div {...el('cards', 'grid gap-[16px] [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]')}>
          <a href={wa} target="_blank" rel="noopener" className={`${card} hover:border-gold`}>
            <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" className="text-gold"><path d="M12 2a10 10 0 0 0-8.5 15.2L2 22l4.9-1.5A10 10 0 1 0 12 2Zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-2.9.9.9-2.8-.2-.3A8 8 0 1 1 12 20Zm4.5-5.9c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1a6.6 6.6 0 0 1-3.2-2.8c-.2-.4.2-.4.6-1.2.1-.1 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5a1 1 0 0 0-.7.3c-.3.3-.9.9-.9 2.1s.9 2.5 1 2.6c.1.2 1.8 2.8 4.4 3.9 1.6.7 2.3.7 3 .6.5 0 1.4-.6 1.6-1.1.2-.6.2-1 .1-1.1l-.5-.2Z" /></svg>
            <div><div className="font-display font-bold text-[19px] tracking-[0.06em] uppercase">WhatsApp</div><div className="text-mut text-[14px] mt-[3px]">+54 341 321-3723</div></div>
          </a>
          <a href={`https://www.instagram.com/${content.contactInstagram.replace('@', '')}/`} target="_blank" rel="noopener" className={`${card} hover:border-red`}>
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-red"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none" /></svg>
            <div><div className="font-display font-bold text-[19px] tracking-[0.06em] uppercase">Instagram</div><div className="text-mut text-[14px] mt-[3px]">{content.contactInstagram}</div></div>
          </a>
          <a href={`mailto:${content.contactEmail}`} className={`${card} hover:border-line2`}>
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-tx"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
            <div><div className="font-display font-bold text-[19px] tracking-[0.06em] uppercase">Email</div><div className="text-mut text-[14px] mt-[3px]">{content.contactEmail}</div></div>
          </a>
          <div className="bg-card border border-line rounded-[var(--rf-radius)] px-[22px] py-[26px] flex flex-col gap-[14px]">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-gold"><path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" /><circle cx="12" cy="10" r="2.5" /></svg>
            <div><div className="font-display font-bold text-[19px] tracking-[0.06em] uppercase">Ubicación</div><div className="text-mut text-[14px] mt-[3px]">{content.contactLocation}</div></div>
          </div>
        </div>
      </div>
    </section>
  );
}
