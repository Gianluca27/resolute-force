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
  const products = useProducts();
  const drop = useDrop();
  const content = useContent();
  const { items, open, checkoutOpen, setOpen, add } = useCart();
  const showToast = useToast((s) => s.show);

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
      <Footer />
      {open && <CartDrawer />}
      {checkoutOpen && <CheckoutModal />}
      <Toast />
    </div>
  );
}
