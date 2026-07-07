import { lazy, Suspense, useEffect } from 'react';
import { DEFAULT_PAGE_DESIGN } from '@resolute/shared';
import { useProducts, useDrop, useContent, usePageDesign } from '../hooks/useCatalog';
import { useCart, cartCount } from '../store/cart';
import { useToast } from '../store/toast';
import Nav from '../components/Nav';
import Footer from '../components/Footer';
import CartDrawer from '../components/CartDrawer';
import Toast from '../components/Toast';

// Lazy: pulls in the MercadoPago SDK — only downloaded when the checkout opens.
const CheckoutModal = lazy(() => import('../components/CheckoutModal'));
import ThemeStyle from '../components/ThemeStyle';
import SectionsRenderer, { computeAnchors, navLinks } from '../components/sections/SectionsRenderer';

export default function Landing() {
  const products = useProducts();
  const drop = useDrop();
  const content = useContent();
  const design = usePageDesign();
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
          <button onClick={() => content.refetch()} className="bg-red text-white border-0 rounded-[var(--rf-btn-radius)] px-6 py-3 cursor-pointer font-display font-bold tracking-[0.12em] uppercase hover:bg-redd">Reintentar</button>
        </div>
      </div>
    );
  }
  // If only the design fetch fails, fall back to the bundled default so the
  // store never goes blank because of the page builder.
  const doc = design.data ?? (design.isError ? DEFAULT_PAGE_DESIGN : undefined);
  if (!content.data || !doc) return <div data-testid="landing" className="min-h-screen bg-bg" />;

  return (
    <div id="inicio" data-testid="landing" className="bg-bg text-tx font-body min-h-screen relative overflow-x-hidden">
      <ThemeStyle theme={doc.theme} />
      <SectionsRenderer
        doc={doc}
        nav={<Nav cartCount={cartCount(items)} onOpenCart={() => setOpen(true)} links={navLinks(doc)} />}
        ctx={{
          products: products.data ?? [],
          drop: drop.data,
          content: content.data,
          onAdd: (p, size) => { add(p, size); showToast(`${p.line} · ${p.color} (${size})`); },
          anchors: computeAnchors(doc),
        }}
      />
      <Footer contactWhatsapp={content.data.contactWhatsapp} contactInstagram={content.data.contactInstagram} />
      {open && <CartDrawer />}
      {checkoutOpen && <Suspense fallback={null}><CheckoutModal /></Suspense>}
      <Toast />
    </div>
  );
}
