import { useState } from 'react';
import { customerSchema } from '@resolute/shared';
import type { CartLineInput, CustomerInput } from '@resolute/shared';
import { api } from '../lib/api';
import { money } from '../lib/money';
import { useCart, cartCount } from '../store/cart';
import { stubPlaceOrder, type PayMethod, type PlaceOrder, type PlacedOrder } from '../lib/placeOrder';

const inputCls = 'bg-card border border-line2 rounded-[3px] text-tx px-[14px] py-[13px] text-[15px] outline-none transition focus:border-gold';
const labelCls = 'font-display text-[12.5px] tracking-[0.14em] uppercase text-mut';

export default function CheckoutModal({ placeOrder = stubPlaceOrder }: { placeOrder?: PlaceOrder }) {
  const { items, setCheckoutOpen, clear } = useCart();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<CustomerInput>({ nombre: '', email: '', tel: '', dir: '', ciudad: '' });
  const [method, setMethod] = useState<PayMethod>('transfer');
  const [q, setQ] = useState<Awaited<ReturnType<typeof api.quote>> | null>(null);
  const [order, setOrder] = useState<PlacedOrder | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const lineItems: CartLineInput[] = items.map((i) => ({ productId: i.productId, size: i.size, qty: i.qty }));
  const close = () => { setCheckoutOpen(false); setStep(0); };
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  async function toPago() {
    setErr(null);
    if (!customerSchema.safeParse(form).success) { setErr('Completá tus datos para continuar'); return; }
    setBusy(true);
    try { setQ(await api.quote(lineItems)); setStep(1); }
    catch (e) { setErr(e instanceof Error ? e.message : 'No se pudo cotizar'); }
    finally { setBusy(false); }
  }

  async function confirm() {
    if (!q) return;
    setBusy(true); setErr(null);
    try {
      const placed = await placeOrder({ items: lineItems, customer: form, method, quote: q });
      setOrder(placed); setStep(2); clear();
    } catch (e) { setErr(e instanceof Error ? e.message : 'No se pudo confirmar el pedido'); }
    finally { setBusy(false); }
  }

  const stepTitle = step === 0 ? 'Tus datos' : step === 1 ? 'Forma de pago' : 'Listo';
  const progress = step === 0 ? '33%' : step === 1 ? '66%' : '100%';
  const total = method === 'transfer' ? q?.totalTransfer ?? 0 : q?.totalCard ?? 0;

  return (
    <div onClick={close} className="fixed inset-0 z-[400] bg-black/70 backdrop-blur-[4px] flex items-start justify-center px-4 py-[clamp(16px,5vh,60px)] overflow-y-auto animate-fade">
      <div onClick={stop} className="w-[min(540px,100%)] bg-bg border border-line2 rounded-[6px] overflow-hidden animate-rise shadow-[0_40px_90px_-30px_rgba(0,0,0,0.9)]">
        <div className="px-6 py-5 border-b border-line flex items-center justify-between gap-[14px]">
          <div className="flex items-center gap-[11px]"><img src="/assets/logo-r.png" alt="" width={26} height={26} className="w-[26px] h-[26px] object-contain" /><span className="font-display font-extrabold text-[18px] tracking-[0.1em] uppercase">{stepTitle}</span></div>
          <button aria-label="Cerrar" onClick={close} className="bg-none border border-line rounded-[2px] text-tx w-[34px] h-[34px] flex items-center justify-center cursor-pointer hover:border-red"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
        </div>
        <div className="h-[3px] bg-line"><div className="h-full bg-red transition-[width] duration-300" style={{ width: progress }} /></div>

        <div className="p-6">
          {err && <div className="mb-3 text-red text-[14px] font-display tracking-[0.06em] uppercase">{err}</div>}

          {step === 0 && (
            <div className="flex flex-col gap-[14px]">
              <Field label="Nombre y apellido"><input className={inputCls} placeholder="Tu nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></Field>
              <div className="flex gap-3 flex-wrap">
                <Field className="flex-1 basis-[180px]" label="Email"><input className={inputCls} placeholder="tu@email.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
                <Field className="flex-1 basis-[140px]" label="Teléfono"><input className={inputCls} placeholder="11 1234-5678" value={form.tel} onChange={(e) => setForm({ ...form, tel: e.target.value })} /></Field>
              </div>
              <Field label="Dirección de envío"><input className={inputCls} placeholder="Calle y número" value={form.dir} onChange={(e) => setForm({ ...form, dir: e.target.value })} /></Field>
              <Field label="Ciudad / Provincia"><input className={inputCls} placeholder="Ciudad, Provincia" value={form.ciudad} onChange={(e) => setForm({ ...form, ciudad: e.target.value })} /></Field>
              <div className="flex justify-between items-baseline mt-[6px] pt-[14px] border-t border-line"><span className="text-mut font-display tracking-[0.1em] uppercase text-[14px]">Total ({cartCount(items)})</span></div>
              <button disabled={busy} onClick={toPago} className="w-full mt-1 bg-red text-white border-0 rounded-[2px] p-4 cursor-pointer font-display font-bold text-[16px] tracking-[0.13em] uppercase hover:bg-redd disabled:opacity-60">Continuar al pago</button>
            </div>
          )}

          {step === 1 && q && (
            <div className="flex flex-col gap-[14px]">
              <div className="font-display text-[12.5px] tracking-[0.14em] uppercase text-mut">Elegí cómo pagar</div>
              <PayOption active={method === 'transfer'} onClick={() => setMethod('transfer')} title="Transferencia" sub="Te enviamos los datos por email" badge="10% OFF" />
              <PayOption active={method === 'card'} onClick={() => setMethod('card')} title="Tarjeta" sub="Hasta 3 cuotas sin interés" />
              <PayOption active={method === 'wallet'} onClick={() => setMethod('wallet')} title="Mercado Pago" sub="Pagá con tu cuenta de MercadoPago" />
              <div className="flex flex-col gap-2 mt-[6px] pt-[14px] border-t border-line">
                <Row label="Subtotal" value={money(q.subtotal)} />
                {method === 'transfer' && <Row label="Descuento transferencia" value={`− ${money(q.transferDiscount)}`} gold />}
                <Row label="Envío" value="Gratis" gold />
                <div className="flex justify-between items-baseline mt-1"><span className="font-display tracking-[0.1em] uppercase text-[15px]">Total</span><span className="font-display font-black text-[28px]">{money(total)}</span></div>
              </div>
              <div className="flex gap-[10px] mt-1">
                <button onClick={() => setStep(0)} className="shrink-0 bg-transparent text-tx border border-line2 rounded-[2px] px-5 py-4 cursor-pointer font-display font-bold text-[15px] tracking-[0.1em] uppercase hover:border-tx">Volver</button>
                <button disabled={busy} onClick={confirm} className="flex-1 bg-red text-white border-0 rounded-[2px] p-4 cursor-pointer font-display font-bold text-[16px] tracking-[0.13em] uppercase hover:bg-redd disabled:opacity-60">Confirmar pedido</button>
              </div>
            </div>
          )}

          {step === 2 && order && (
            <div className="flex flex-col items-center text-center gap-4 pt-[14px] px-[6px] pb-[6px]">
              <div className="w-[74px] h-[74px] rounded-full flex items-center justify-center border-2 border-gold" style={{ background: 'radial-gradient(circle,rgba(232,181,62,.25),transparent 70%)' }}>
                <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#e8b53e" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4 10-11" /></svg>
              </div>
              <h3 className="m-0 font-display font-black text-[32px] tracking-[0.02em] uppercase">¡Pedido confirmado!</h3>
              <p className="m-0 text-mut text-[15.5px] leading-[1.6] max-w-[380px]">Gracias <span className="text-tx font-semibold">{order.name}</span>. Tu orden <span className="text-gold font-semibold">{order.orderNo}</span> está en marcha. Te enviamos los detalles por email.</p>
              <div className="w-full bg-card border border-line rounded-[4px] px-[18px] py-4 flex flex-col gap-[9px] mt-1">
                <Row label="Orden" value={order.orderNo} />
                <Row label="Artículos" value={String(order.count)} />
                <Row label="Pago" value={order.pay} />
                <div className="flex justify-between items-baseline pt-[9px] border-t border-line"><span className="text-mut">Total</span><span className="font-display font-black text-[24px]">{money(order.total)}</span></div>
              </div>
              <p className="m-0 font-display font-bold text-[18px] tracking-[0.08em] uppercase text-red">Stop at nothing 🔥</p>
              <button onClick={close} className="w-full bg-tx text-bg border-0 rounded-[2px] p-[15px] cursor-pointer font-display font-bold text-[16px] tracking-[0.13em] uppercase hover:bg-gold mt-1">Seguí entrenando</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={`flex flex-col gap-[6px] ${className}`}><label className={labelCls}>{label}</label>{children}</div>;
}
function Row({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return <div className={`flex justify-between text-[14px] ${gold ? 'text-gold' : 'text-mut'}`}><span>{label}</span><span className="capitalize">{value}</span></div>;
}
function PayOption({ active, onClick, title, sub, badge }: { active: boolean; onClick: () => void; title: string; sub: string; badge?: string }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center justify-between gap-3 rounded-[4px] p-4 cursor-pointer transition bg-card ${active ? 'border border-gold' : 'border border-line'}`}>
      <div className="flex items-center gap-3">
        <span className={`w-5 h-5 rounded-full shrink-0 inline-block transition ${active ? 'border-[6px] border-gold bg-bg' : 'border-2 border-line2'}`} />
        <div className="text-left"><div className="font-display font-bold text-[17px] tracking-[0.05em] uppercase">{title}</div><div className="text-mut text-[13px]">{sub}</div></div>
      </div>
      {badge && <span className="bg-gold text-bg font-display font-bold text-[12px] tracking-[0.1em] uppercase px-[10px] py-[5px] rounded-[2px]">{badge}</span>}
    </button>
  );
}
