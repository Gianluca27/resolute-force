import { useProducts, useDrop, useContent } from '../hooks/useCatalog';
import Marquee from '../components/Marquee';
import Nav from '../components/Nav';
import Hero from '../components/Hero';
import Manifiesto from '../components/Manifiesto';
import Productos from '../components/Productos';
import Historia from '../components/Historia';
import Proximos from '../components/Proximos';
import Contacto from '../components/Contacto';
import Footer from '../components/Footer';

export default function Landing() {
  const products = useProducts();
  const drop = useDrop();
  const content = useContent();

  if (!content.data) {
    return <div data-testid="landing" className="min-h-screen bg-bg" />;
  }

  return (
    <div data-testid="landing" className="bg-bg text-tx font-body min-h-screen relative overflow-x-hidden">
      <Marquee items={content.data.marquee} />
      <Nav cartCount={0} onOpenCart={() => {}} />
      <Hero content={content.data} />
      <Manifiesto />
      <Productos products={products.data ?? []} onAdd={() => {}} />
      <Historia />
      {drop.data && <Proximos drop={drop.data} />}
      <Contacto content={content.data} />
      <Footer contactWhatsapp={content.data.contactWhatsapp} />
    </div>
  );
}
