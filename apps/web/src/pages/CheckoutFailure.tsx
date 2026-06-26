import { Link } from 'react-router-dom';

export default function CheckoutFailure() {
  return (
    <main className="min-h-screen bg-bg text-tx font-body flex items-center justify-center px-4">
      <div className="max-w-[440px] text-center flex flex-col items-center gap-4">
        <h1 className="m-0 font-display font-black text-[34px] uppercase text-red">Pago no completado</h1>
        <p className="text-mut leading-[1.6]">No pudimos procesar el pago. No se realizó ningún cargo. Probá de nuevo o escribinos por WhatsApp.</p>
        <Link to="/" className="bg-red text-white no-underline font-display font-bold text-[15px] tracking-[0.12em] uppercase px-[26px] py-[13px] rounded-[2px] hover:bg-redd">Volver a la tienda</Link>
      </div>
    </main>
  );
}
