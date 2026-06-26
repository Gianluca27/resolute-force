const linkCls = 'no-underline text-mut font-display font-semibold text-[15px] tracking-[0.16em] uppercase transition-colors hover:text-tx';

export default function Nav({ cartCount, onOpenCart }: { cartCount: number; onOpenCart: () => void }) {
  return (
    <nav className="sticky top-0 z-50 flex items-center justify-between gap-6 flex-wrap px-[clamp(18px,5vw,64px)] py-[14px] bg-[rgba(10,10,11,0.78)] backdrop-blur-[14px] border-b border-line">
      <a href="#inicio" className="flex items-center gap-3 no-underline text-tx">
        <img src="/assets/logo-r.png" alt="Resolute Force" width={34} height={34} className="block w-[34px] h-[34px] object-contain" />
        <span className="font-display font-extrabold text-[21px] tracking-[0.2em] uppercase leading-none">Resolute<span className="text-red">·</span>Force</span>
      </a>
      <div className="flex items-center gap-[clamp(14px,2.4vw,34px)] flex-wrap">
        <a href="#productos" className={linkCls}>Productos</a>
        <a href="#manifiesto" className={linkCls}>Manifiesto</a>
        <a href="#historia" className={linkCls}>Historia</a>
        <a href="#contacto" className={linkCls}>Contacto</a>
        <button onClick={onOpenCart} aria-label="Carrito" className="relative flex items-center gap-[9px] bg-tx text-bg border-0 rounded-[2px] py-[10px] pl-[14px] pr-4 cursor-pointer font-display font-bold text-[14px] tracking-[0.14em] uppercase transition-transform hover:-translate-y-px">
          <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8h12l-1.2 11.2a1.5 1.5 0 0 1-1.5 1.3H8.7a1.5 1.5 0 0 1-1.5-1.3L6 8Z" /><path d="M9 8a3 3 0 0 1 6 0" /></svg>
          Carrito
          {cartCount > 0 && (
            <span data-testid="cart-badge" className="absolute -top-[7px] -right-[7px] min-w-[21px] h-[21px] px-[5px] flex items-center justify-center bg-red text-white rounded-[11px] text-[12px] font-bold font-display border-2 border-bg">{cartCount}</span>
          )}
        </button>
      </div>
    </nav>
  );
}
