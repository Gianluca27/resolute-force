import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCart } from '../store/cart';

export default function CheckoutSuccess() {
  const [params] = useSearchParams();
  const orderNo = params.get('external_reference') ?? '';
  // Wallet (MercadoPago) returns here via full-page redirect — clear the cart the user just paid for.
  useEffect(() => { useCart.getState().clear(); }, []);
  return (
    <main className="min-h-screen bg-bg text-tx font-body flex items-center justify-center px-4">
      <div className="max-w-[440px] text-center flex flex-col items-center gap-4">
        <div className="w-[74px] h-[74px] rounded-full flex items-center justify-center border-2 border-gold" style={{ background: 'radial-gradient(circle,rgba(232,181,62,.25),transparent 70%)' }}>
          <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#e8b53e" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4 10-11" /></svg>
        </div>
        <h1 className="m-0 font-display font-black text-[34px] uppercase">¡Pedido confirmado!</h1>
        <p className="text-mut leading-[1.6]">Tu orden <span className="text-gold font-semibold">{orderNo}</span> está en marcha. Te enviamos los detalles por email.</p>
        <p className="font-display font-bold text-[18px] tracking-[0.08em] uppercase text-red">Stop at nothing 🔥</p>
        <Link to="/" className="bg-tx text-bg no-underline font-display font-bold text-[15px] tracking-[0.12em] uppercase px-[26px] py-[13px] rounded-[2px] hover:bg-gold">Volver al inicio</Link>
      </div>
    </main>
  );
}
