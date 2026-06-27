import { useEffect, useRef } from 'react';
import { useCart, cartCount, cartSubtotal } from '../store/cart';
import { money } from '../lib/money';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function CartDrawer() {
  const { items, setOpen, inc, dec, remove, clear, startCheckout } = useCart();
  const count = cartCount(items);
  const subtotal = cartSubtotal(items);
  const panelRef = useRef<HTMLElement>(null);

  // Modal dialog keyboard behaviour: Esc closes, Tab is trapped inside the panel,
  // focus enters on open and is restored to the opener on close.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); return; }
      if (e.key !== 'Tab' || !panel) return;
      const f = panel.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (f.length === 0) return;
      const first = f[0]!, last = f[f.length - 1]!;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      opener?.focus?.();
    };
  }, [setOpen]);

  return (
    <>
      <div onClick={() => setOpen(false)} className="fixed inset-0 z-[290] bg-black/60 backdrop-blur-[2px] animate-fade" />
      <aside ref={panelRef} role="dialog" aria-modal="true" aria-label="Tu carrito" className="fixed top-0 right-0 bottom-0 z-[300] w-[min(420px,92vw)] bg-bg border-l border-line2 flex flex-col animate-slidein shadow-[-30px_0_60px_-20px_rgba(0,0,0,0.8)]">
        <div className="flex items-center justify-between px-[22px] py-5 border-b border-line">
          <div className="flex items-center gap-[10px] font-display font-extrabold text-[20px] tracking-[0.08em] uppercase">Tu carrito <span className="text-mut text-[15px]">({count})</span></div>
          <button aria-label="Cerrar" onClick={() => setOpen(false)} className="bg-none border border-line rounded-[2px] text-tx w-9 h-9 flex items-center justify-center cursor-pointer hover:border-red">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-[18px] p-10 text-center">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#97979d" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8h12l-1.2 11.2a1.5 1.5 0 0 1-1.5 1.3H8.7a1.5 1.5 0 0 1-1.5-1.3L6 8Z" /><path d="M9 8a3 3 0 0 1 6 0" /></svg>
            <div className="text-mut text-[16px]">Tu carrito está vacío.</div>
            <button onClick={() => setOpen(false)} className="bg-red text-white font-display font-bold text-[15px] tracking-[0.12em] uppercase px-[26px] py-[13px] rounded-[2px] hover:bg-redd">Ver productos</button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-[18px] py-[14px] flex flex-col gap-3">
              {items.map((it) => (
                <div key={it.key} className="flex gap-[13px] bg-card border border-line rounded-[4px] p-3">
                  <div className="w-[72px] h-[72px] shrink-0 rounded-[3px] overflow-hidden bg-[#d2d2cf]"><img src={it.imageUrl} alt="" className="block w-full h-full object-cover" /></div>
                  <div className="flex-1 min-w-0 flex flex-col gap-[7px]">
                    <div className="flex justify-between gap-2 items-start">
                      <div>
                        <div className="font-display font-bold text-[16px] tracking-[0.04em] uppercase leading-[1.05]">{it.line}</div>
                        <div className="text-mut text-[12.5px] font-display tracking-[0.08em] uppercase mt-[2px]">{it.color} · Talle {it.size}</div>
                      </div>
                      <button aria-label="Quitar" onClick={() => remove(it.key)} className="bg-none border-0 text-mut cursor-pointer p-[2px] hover:text-red shrink-0">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13" /></svg>
                      </button>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-auto">
                      <div className="flex items-center border border-line2 rounded-[2px] overflow-hidden">
                        <button aria-label="Restar uno" onClick={() => dec(it.key)} className="bg-none border-0 text-tx w-[30px] h-[30px] cursor-pointer flex items-center justify-center hover:bg-white/10"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 12h14" /></svg></button>
                        <span aria-live="polite" aria-atomic="true" aria-label={`Cantidad: ${it.qty}`} className="min-w-[28px] text-center font-display font-bold text-[15px]">{it.qty}</span>
                        <button aria-label="Sumar uno" onClick={() => inc(it.key)} className="bg-none border-0 text-tx w-[30px] h-[30px] cursor-pointer flex items-center justify-center hover:bg-white/10"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg></button>
                      </div>
                      <span className="font-display font-extrabold text-[18px]">{money(it.price * it.qty)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-line px-5 pt-[18px] pb-[22px] flex flex-col gap-[14px]">
              <div className="flex justify-between items-baseline"><span className="text-mut font-display tracking-[0.1em] uppercase text-[14px]">Subtotal</span><span className="font-display font-black text-[28px]">{money(subtotal)}</span></div>
              <div className="text-mut text-[13px] flex justify-between"><span>Envío</span><span className="text-gold">Calculado en el checkout</span></div>
              <button onClick={() => startCheckout()} className="w-full bg-red text-white border-0 rounded-[2px] p-4 cursor-pointer font-display font-bold text-[17px] tracking-[0.13em] uppercase hover:bg-redd flex items-center justify-center gap-[10px]">Finalizar compra
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </button>
              <button onClick={() => clear()} className="self-center bg-none border-0 text-mut font-display tracking-[0.1em] uppercase text-[12.5px] cursor-pointer hover:text-red">Vaciar carrito</button>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
