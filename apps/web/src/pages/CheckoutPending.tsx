import { Link, useSearchParams } from 'react-router-dom';

export default function CheckoutPending() {
  const [params] = useSearchParams();
  const orderNo = params.get('external_reference') ?? '';
  // Payment is NOT confirmed yet — do not clear the cart, do not claim the order is done.
  return (
    <main className="min-h-screen bg-bg text-tx font-body flex items-center justify-center px-4">
      <div className="max-w-[440px] text-center flex flex-col items-center gap-4">
        <div className="w-[74px] h-[74px] rounded-full flex items-center justify-center border-2 border-gold" style={{ background: 'radial-gradient(circle,rgba(232,181,62,.25),transparent 70%)' }}>
          <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="#e8b53e" strokeWidth="2.4" strokeLinecap="round"><path d="M12 7v5l3 3" /><circle cx="12" cy="12" r="9" /></svg>
        </div>
        <h1 className="m-0 font-display font-black text-[32px] uppercase">Pago en proceso</h1>
        <p className="text-mut leading-[1.6]">Tu pago {orderNo && <span className="text-gold font-semibold">{orderNo}</span>} se está procesando. Te avisamos por email apenas se confirme.</p>
        <Link to="/" className="bg-tx text-bg no-underline font-display font-bold text-[15px] tracking-[0.12em] uppercase px-[26px] py-[13px] rounded-[2px] hover:bg-gold">Volver al inicio</Link>
      </div>
    </main>
  );
}
