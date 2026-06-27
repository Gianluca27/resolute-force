import { useEffect } from 'react';
import { useProducts, useDrop, useContent } from '../hooks/useCatalog';
import { useCart, cartCount } from '../store/cart';
import { useToast } from '../store/toast';
import Marquee from '../components/Marquee';
import Nav from '../components/Nav';
import Hero from '../components/Hero';
import Manifiesto from '../components/Manifiesto';
import Productos from '../components/Productos';
import Historia from '../components/Historia';
import Proximos from '../components/Proximos';
import Contacto from '../components/Contacto';
import Footer from '../components/Footer';
import CartDrawer from '../components/CartDrawer';
import CheckoutModal from '../components/CheckoutModal';
import Toast from '../components/Toast';

export default function Landing() {
  useEffect(() => {
    const base = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
    fetch(`${base}/api/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/' }),
    }).catch(() => {});
  }, []);

  const products = useProducts();
  const drop = useDrop();
  const content = useContent();
  const { items, open, checkoutOpen, setOpen, add } = useCart();
  const showToast = useToast((s) => s.show);

  // Keep the persisted cart in sync with current catalog prices / availability.
  const productData = products.data;
  useEffect(() => { if (productData) useCart.getState().reconcile(productData); }, [productData]);

  if (content.isError) {
    return (
      <div data-testid="landing" className="min-h-screen bg-bg text-tx font-body flex items-center justify-center px-4 text-center">
        <div className="flex flex-col items-center gap-4 max-w-[420px]">
          <h1 className="font-display font-black text-[28px] uppercase">No pudimos cargar la tienda</h1>
          <p className="text-mut">Revisá tu conexión e intentá de nuevo.</p>
          <button onClick={() => content.refetch()} className="bg-red text-white border-0 rounded-[2px] px-6 py-3 cursor-pointer font-display font-bold tracking-[0.12em] uppercase hover:bg-redd">Reintentar</button>
        </div>
      </div>
    );
  }
  if (!content.data) return <div data-testid="landing" className="min-h-screen bg-bg" />;

  return (
    <div data-testid="landing" className="bg-bg text-tx font-body min-h-screen relative overflow-x-hidden">
      <Marquee items={content.data.marquee} />
      <Nav cartCount={cartCount(items)} onOpenCart={() => setOpen(true)} />
      <Hero content={content.data} />
      <Manifiesto />
      <Productos products={products.data ?? []} onAdd={(p, size) => { add(p, size); showToast(`${p.line} · ${p.color} (${size})`); }} />
      <Historia />
      {drop.data && <Proximos drop={drop.data} />}
      <Contacto content={content.data} />
      <Footer contactWhatsapp={content.data.contactWhatsapp} />
      {open && <CartDrawer />}
      {checkoutOpen && <CheckoutModal />}
      <Toast />
    </div>
  );
}
