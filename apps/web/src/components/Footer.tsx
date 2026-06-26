const head = 'font-display font-bold text-[13px] tracking-[0.2em] uppercase text-mut mb-4';
const fl = 'no-underline text-tx text-[15px] transition-colors hover:text-gold';
const badge = 'text-mut text-[12px] font-display tracking-[0.12em] uppercase border border-line rounded-[2px] px-[11px] py-[6px]';

export default function Footer({ contactWhatsapp }: { contactWhatsapp?: string }) {
  return (
    <footer className="bg-bg border-t border-line px-[clamp(18px,5vw,64px)] pt-[clamp(48px,7vh,72px)] pb-[34px]">
      <div className="max-w-[1180px] mx-auto flex flex-wrap gap-10 justify-between">
        <div className="flex-1 basis-[280px] max-w-[360px]">
          <div className="flex items-center gap-3 mb-4">
            <img src="/assets/logo-r.png" alt="" width={34} height={34} className="w-[34px] h-[34px] object-contain" />
            <span className="font-display font-extrabold text-[21px] tracking-[0.2em] uppercase">Resolute<span className="text-red">·</span>Force</span>
          </div>
          <p className="text-mut text-[15px] leading-[1.6] m-0">Indumentaria deportiva para los que entrenan bajo presión. Champion Mentality.</p>
        </div>
        <div className="flex gap-[clamp(34px,6vw,80px)] flex-wrap">
          <div>
            <div className={head}>Tienda</div>
            <div className="flex flex-col gap-[11px]"><a href="#productos" className={fl}>Productos</a><a href="#proximos" className={fl}>Próximos drops</a><a href="#productos" className={fl}>Guía de talles</a></div>
          </div>
          <div>
            <div className={head}>Marca</div>
            <div className="flex flex-col gap-[11px]"><a href="#manifiesto" className={fl}>Manifiesto</a><a href="#historia" className={fl}>Historia</a><a href="#contacto" className={fl}>Contacto</a></div>
          </div>
          <div>
            <div className={head}>Seguinos</div>
            <div className="flex flex-col gap-[11px]"><a href="https://instagram.com" target="_blank" rel="noopener" className={fl}>Instagram</a><a href={`https://wa.me/${contactWhatsapp ?? '5493413213723'}`} target="_blank" rel="noopener" className={fl}>WhatsApp</a></div>
          </div>
        </div>
      </div>
      <div className="max-w-[1180px] mx-auto mt-[38px] pt-[22px] border-t border-line flex flex-wrap gap-[14px] justify-between items-center">
        <div className="text-mut text-[13px] font-display tracking-[0.1em] uppercase">© 2026 Resolute Force · Hecho en Argentina</div>
        <div className="flex gap-[10px] flex-wrap"><span className={badge}>Transferencia</span><span className={badge}>Tarjeta</span><span className={badge}>Mercado Pago</span></div>
      </div>
    </footer>
  );
}
