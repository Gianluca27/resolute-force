import { useState, useId, cloneElement, type ReactElement } from 'react';
import { customerSchema } from '@resolute/shared';
import type { CartLineInput, CustomerInput, QuoteResult } from '@resolute/shared';
import { api } from '../lib/api';
import { money } from '../lib/money';
import { useCart, cartCount } from '../store/cart';
import CardBrick, { type CardFormData } from './payment/CardBrick';
import WalletButton from './payment/WalletButton';

type PayMethod = 'transfer' | 'card' | 'wallet';
// es-AR labels for the payment-method key shown on the confirmation screen. H-04.
const PAY_LABELS: Record<PayMethod, string> = { transfer: 'Transferencia', card: 'Tarjeta', wallet: 'Mercado Pago' };
interface Confirmation { orderNo: string; total: number; count: number; pay: PayMethod; name: string; bankAlias?: string; bankCbu?: string; }

const inputCls = 'bg-card border border-line2 rounded-[3px] text-tx px-[14px] py-[13px] text-[15px] outline-none transition focus:border-gold';
const labelCls = 'font-display text-[12.5px] tracking-[0.14em] uppercase text-mut';

export default function CheckoutModal() {
  // Form lives in the cart store so typed data survives close/reopen (the modal unmounts on close). H-01.
  const { items, setCheckoutOpen, clear, checkoutForm: form, setCheckoutForm } = useCart();
  const [step, setStep] = useState(0);
  const [method, setMethod] = useState<PayMethod>('transfer');
  const [q, setQ] = useState<QuoteResult | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [preferenceId, setPreferenceId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [invalid, setInvalid] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const lineItems: CartLineInput[] = items.map((i) => ({ productId: i.productId, size: i.size, qty: i.qty }));
  const set = (patch: Partial<CustomerInput>) => setCheckoutForm({ ...form, ...patch });
  const close = () => setCheckoutOpen(false);
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  const total = method === 'transfer' ? q?.totalTransfer ?? 0 : q?.totalCard ?? 0;

  async function toPago() {
    const parsed = customerSchema.safeParse(form);
    if (!parsed.success) {
      const fields = new Set(parsed.error.issues.map((i) => String(i.path[0])));
      setInvalid(fields); setErr(validationMessage(fields, form)); // H-06: name the bad field(s)
      return;
    }
    setInvalid(new Set()); setErr(null);
    setBusy(true);
    try { setQ(await api.quote(lineItems)); setStep(1); }
    catch (e) { setErr(friendlyError(e, 'No se pudo cotizar. Revisá tu conexión.')); }
    finally { setBusy(false); }
  }

  async function confirmTransfer() {
    setBusy(true); setErr(null);
    try {
      const r = await api.transferOrder({ items: lineItems, customer: form });
      setConfirmation({ orderNo: r.orderNo, total: r.total, count: r.count, pay: 'transfer', name: r.name, bankAlias: r.bankAlias, bankCbu: r.bankCbu });
      setStep(2); clear();
    } catch (e) { setErr(friendlyError(e, 'No se pudo crear el pedido. Revisá tu conexión.')); }
    finally { setBusy(false); }
  }

  async function startWallet() {
    setBusy(true); setErr(null);
    try { const r = await api.preference({ items: lineItems, customer: form }); setPreferenceId(r.preferenceId); }
    catch (e) { setErr(friendlyError(e, 'No se pudo iniciar el pago. Revisá tu conexión.')); }
    finally { setBusy(false); }
  }

  async function payCard(data: CardFormData) {
    setBusy(true); setErr(null);
    try {
      const r = await api.paymentCard({
        items: lineItems, customer: form, token: data.token, installments: data.installments,
        paymentMethodId: data.payment_method_id, issuerId: data.issuer_id, payer: data.payer,
      });
      if (r.status === 'approved') {
        setConfirmation({ orderNo: r.orderNo, total: r.total ?? total, count: r.count ?? cartCount(items), pay: 'card', name: r.name ?? form.nombre });
        setStep(2); clear();
      } else if (r.status === 'refunded') {
        setErr(r.detail ?? 'Se agotó el stock durante el pago; reintegramos el cobro.');
      } else {
        setErr(`Pago ${r.status === 'rejected' ? 'rechazado' : 'pendiente'}. Probá otra tarjeta o medio de pago.`);
      }
    } catch (e) { setErr(friendlyError(e, 'Error al procesar el pago. Revisá tu conexión.')); }
    finally { setBusy(false); }
  }

  const stepTitle = step === 0 ? 'Tus datos' : step === 1 ? 'Forma de pago' : 'Listo';
  const progress = step === 0 ? '33%' : step === 1 ? '66%' : '100%';

  return (
    <div onClick={close} className="fixed inset-0 z-[400] bg-black/70 backdrop-blur-[4px] flex items-start justify-center px-4 py-[clamp(16px,5vh,60px)] overflow-y-auto animate-fade">
      <div onClick={stop} className="w-[min(540px,100%)] bg-bg border border-line2 rounded-[6px] overflow-hidden animate-rise shadow-[0_40px_90px_-30px_rgba(0,0,0,0.9)]">
        <div className="px-6 py-5 border-b border-line flex items-center justify-between gap-[14px]">
          <div className="flex items-center gap-[11px]"><img src="/assets/logo-r.png" alt="" width={26} height={26} className="w-[26px] h-[26px] object-contain" /><span className="font-display font-extrabold text-[18px] tracking-[0.1em] uppercase">{stepTitle}</span></div>
          <button aria-label="Cerrar" onClick={close} className="bg-none border border-line rounded-[2px] text-tx w-[34px] h-[34px] flex items-center justify-center cursor-pointer hover:border-red"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
        </div>
        <div className="h-[3px] bg-line"><div className="h-full bg-red transition-[width] duration-300" style={{ width: progress }} /></div>

        <div className="p-6">
          {err && <div id="checkout-error" role="alert" className="mb-3 text-red text-[14px] font-display tracking-[0.06em] uppercase">{err}</div>}

          {step === 0 && (
            <div className="flex flex-col gap-[14px]">
              <Field label="Nombre y apellido" invalid={invalid.has('nombre')} errorId="checkout-error"><input className={inputCls} maxLength={80} placeholder="Tu nombre" value={form.nombre} onChange={(e) => set({ nombre: e.target.value })} /></Field>
              <div className="flex gap-3 flex-wrap">
                <Field className="flex-1 basis-[180px]" label="Email" invalid={invalid.has('email')} errorId="checkout-error"><input className={inputCls} maxLength={120} placeholder="tu@email.com" value={form.email} onChange={(e) => set({ email: e.target.value })} /></Field>
                <Field className="flex-1 basis-[140px]" label="Teléfono" invalid={invalid.has('tel')} errorId="checkout-error"><input className={inputCls} maxLength={30} placeholder="11 1234-5678" value={form.tel} onChange={(e) => set({ tel: e.target.value })} /></Field>
              </div>
              <Field label="Dirección de envío" invalid={invalid.has('dir')} errorId="checkout-error"><input className={inputCls} maxLength={160} placeholder="Calle y número" value={form.dir} onChange={(e) => set({ dir: e.target.value })} /></Field>
              <Field label="Ciudad / Provincia" invalid={invalid.has('ciudad')} errorId="checkout-error"><input className={inputCls} maxLength={100} placeholder="Ciudad, Provincia" value={form.ciudad} onChange={(e) => set({ ciudad: e.target.value })} /></Field>
              <button disabled={busy} onClick={toPago} className="w-full mt-1 bg-red text-white border-0 rounded-[2px] p-4 cursor-pointer font-display font-bold text-[16px] tracking-[0.13em] uppercase hover:bg-redd disabled:opacity-60">Continuar al pago</button>
            </div>
          )}

          {step === 1 && q && (
            <div className="flex flex-col gap-[14px]">
              <div className="font-display text-[12.5px] tracking-[0.14em] uppercase text-mut">Elegí cómo pagar</div>
              <PayOption active={method === 'transfer'} onClick={() => { setMethod('transfer'); setPreferenceId(null); setErr(null); }} title="Transferencia" sub="Te enviamos los datos por email" badge={q.transferDiscount > 0 ? `${Math.round((q.transferDiscount / q.subtotal) * 100)}% OFF` : undefined} />
              <PayOption active={method === 'card'} onClick={() => { setMethod('card'); setPreferenceId(null); setErr(null); }} title="Tarjeta" sub="Hasta 3 cuotas sin interés" />
              <PayOption active={method === 'wallet'} onClick={() => { setMethod('wallet'); setPreferenceId(null); setErr(null); }} title="Mercado Pago" sub="Pagá con tu cuenta de MercadoPago" />

              <div className="flex flex-col gap-2 mt-[6px] pt-[14px] border-t border-line">
                <Row label="Subtotal" value={money(q.subtotal)} />
                {method === 'transfer' && q.transferDiscount > 0 && <Row label="Descuento transferencia" value={`− ${money(q.transferDiscount)}`} gold />}
                <Row label="Envío" value="Gratis" gold />
                <div className="flex justify-between items-baseline mt-1"><span className="font-display tracking-[0.1em] uppercase text-[15px]">Total</span><span className="font-display font-black text-[28px]">{money(total)}</span></div>
              </div>

              {method === 'card' && <div className="mt-1"><CardBrick amount={total} onPay={payCard} /></div>}

              {method === 'wallet' && (preferenceId
                ? <WalletButton preferenceId={preferenceId} />
                : <button disabled={busy} onClick={startWallet} className="w-full bg-red text-white border-0 rounded-[2px] p-4 cursor-pointer font-display font-bold text-[16px] tracking-[0.13em] uppercase hover:bg-redd disabled:opacity-60">Pagar con MercadoPago</button>)}

              {method === 'transfer' && (
                <div className="flex gap-[10px] mt-1">
                  <button onClick={() => { setStep(0); setErr(null); }} className="shrink-0 bg-transparent text-tx border border-line2 rounded-[2px] px-5 py-4 cursor-pointer font-display font-bold text-[15px] tracking-[0.1em] uppercase hover:border-tx">Volver</button>
                  <button disabled={busy} onClick={confirmTransfer} className="flex-1 bg-red text-white border-0 rounded-[2px] p-4 cursor-pointer font-display font-bold text-[16px] tracking-[0.13em] uppercase hover:bg-redd disabled:opacity-60">Confirmar pedido</button>
                </div>
              )}
            </div>
          )}

          {step === 2 && confirmation && (
            <div className="flex flex-col items-center text-center gap-4 pt-[14px] px-[6px] pb-[6px]">
              <div className="w-[74px] h-[74px] rounded-full flex items-center justify-center border-2 border-gold" style={{ background: 'radial-gradient(circle,rgba(232,181,62,.25),transparent 70%)' }}>
                <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#e8b53e" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4 10-11" /></svg>
              </div>
              <h3 className="m-0 font-display font-black text-[32px] tracking-[0.02em] uppercase">¡Pedido confirmado!</h3>
              <p className="m-0 text-mut text-[15.5px] leading-[1.6] max-w-[380px]">Gracias <span className="text-tx font-semibold">{confirmation.name}</span>. Tu orden está en marcha. Te enviamos los detalles por email.</p>
              {confirmation.pay === 'transfer' && (
                <div className="w-full bg-card border border-gold/40 rounded-[4px] px-[18px] py-4 text-left">
                  <div className="font-display text-[12px] tracking-[0.14em] uppercase text-gold mb-2">Datos para transferir</div>
                  {confirmation.bankAlias && <Row label="Alias" value={confirmation.bankAlias} />}
                  {confirmation.bankCbu && <Row label="CBU" value={confirmation.bankCbu} />}
                  <Row label="Importe" value={money(confirmation.total)} />
                  {!confirmation.bankAlias && !confirmation.bankCbu && (
                    <p className="m-0 mt-2 text-mut text-[13px] leading-[1.5] normal-case">Te enviamos el alias y CBU para transferir por email a la brevedad.</p>
                  )}
                </div>
              )}
              <div className="w-full bg-card border border-line rounded-[4px] px-[18px] py-4 flex flex-col gap-[9px] mt-1">
                <Row label="Orden" value={confirmation.orderNo} />
                <Row label="Artículos" value={String(confirmation.count)} />
                <Row label="Pago" value={PAY_LABELS[confirmation.pay]} />
                <div className="flex justify-between items-baseline pt-[9px] border-t border-line"><span className="text-mut">Total</span><span className="font-display font-black text-[24px]">{money(confirmation.total)}</span></div>
              </div>
              <p className="m-0 font-display font-bold text-[18px] tracking-[0.08em] uppercase text-red">Stop at Nothing 🔥</p>
              <button onClick={close} className="w-full bg-tx text-bg border-0 rounded-[2px] p-[15px] cursor-pointer font-display font-bold text-[16px] tracking-[0.13em] uppercase hover:bg-gold mt-1">Seguí entrenando</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// A failed fetch rejects with a TypeError ("Failed to fetch"); show a friendly fallback rather than leaking
// it. Real API/business errors arrive as Error with a server message worth surfacing verbatim. H-02.
function friendlyError(e: unknown, fallback: string): string {
  if (e instanceof TypeError) return fallback;
  return e instanceof Error ? e.message : fallback;
}

const FIELD_LABELS: Record<string, string> = { nombre: 'nombre', email: 'email', tel: 'teléfono', dir: 'dirección', ciudad: 'ciudad' };
// Name the offending field(s) instead of a single generic message. H-06.
function validationMessage(fields: Set<string>, form: CustomerInput): string {
  if (fields.size === 1 && fields.has('email') && form.email.trim()) return 'El email no parece válido';
  if (fields.size === 1 && fields.has('tel')) return 'El teléfono solo puede tener números';
  const labels = [...fields].map((f) => FIELD_LABELS[f] ?? f);
  return `Completá o corregí: ${labels.join(', ')}`;
}

// Associates the <label> with its <input> via a generated id (H-03) and wires aria-invalid /
// aria-describedby so screen readers announce the validation error (H-04).
function Field({ label, children, className = '', invalid, errorId }: {
  label: string; children: ReactElement<React.InputHTMLAttributes<HTMLInputElement>>; className?: string; invalid?: boolean; errorId?: string;
}) {
  const id = useId();
  return (
    <div className={`flex flex-col gap-[6px] ${className}`}>
      <label htmlFor={id} className={labelCls}>{label}</label>
      {cloneElement(children, {
        id,
        'aria-invalid': invalid || undefined,
        'aria-describedby': invalid && errorId ? errorId : undefined,
        className: `${children.props.className ?? ''}${invalid ? ' ring-1 ring-red' : ''}`,
      })}
    </div>
  );
}
function Row({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  // No `capitalize`: it mangled case-sensitive bank aliases like "TEST.alias.rf" → "TEST.Alias.Rf" (E-01).
  return <div className={`flex justify-between text-[14px] ${gold ? 'text-gold' : 'text-mut'}`}><span>{label}</span><span>{value}</span></div>;
}
function PayOption({ active, onClick, title, sub, badge }: { active: boolean; onClick: () => void; title: string; sub: string; badge?: string }) {
  return (
    <button aria-label={title} onClick={onClick} className={`w-full flex items-center justify-between gap-3 rounded-[4px] p-4 cursor-pointer transition bg-card ${active ? 'border border-gold' : 'border border-line'}`}>
      <div className="flex items-center gap-3">
        <span className={`w-5 h-5 rounded-full shrink-0 inline-block transition ${active ? 'border-[6px] border-gold bg-bg' : 'border-2 border-line2'}`} />
        <div className="text-left"><div className="font-display font-bold text-[17px] tracking-[0.05em] uppercase">{title}</div><div className="text-mut text-[13px]">{sub}</div></div>
      </div>
      {badge && <span className="bg-gold text-bg font-display font-bold text-[12px] tracking-[0.1em] uppercase px-[10px] py-[5px] rounded-[2px]">{badge}</span>}
    </button>
  );
}
