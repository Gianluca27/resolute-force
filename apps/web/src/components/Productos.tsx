import type { ProductDTO } from '@resolute/shared';
import ProductCard from './ProductCard';

export default function Productos({ products, onAdd, transferDiscountPct = 10 }: { products: ProductDTO[]; onAdd: (p: ProductDTO, size: string) => void; transferDiscountPct?: number }) {
  return (
    <section id="productos" data-screen-label="Productos" className="scroll-mt-20 px-[clamp(18px,5vw,64px)] py-[clamp(64px,10vh,120px)] max-w-[1280px] mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-5 mb-[44px]">
        <div>
          <div className="font-display font-bold text-[13px] tracking-[0.3em] uppercase text-gold mb-[14px]">Nuestros productos</div>
          <h2 className="m-0 font-display font-black uppercase leading-[0.9] tracking-[-0.01em] text-[clamp(2.4rem,5.6vw,4.6rem)]">La colección<br /><span className="text-mut">Resolute '26</span></h2>
        </div>
        <p className="max-w-[340px] text-mut text-[15.5px] leading-[1.6] m-0">Remeras de algodón premium con estampas de la línea Champion Mentality y Stop at Nothing. Disponibles en todos los talles.</p>
      </div>
      <div className="grid gap-[18px] [grid-template-columns:repeat(auto-fill,minmax(258px,1fr))]">
        {products.map((p) => <ProductCard key={p.id} product={p} onAdd={onAdd} />)}
      </div>
      <p className="text-center text-mut text-[14px] mt-[34px] font-display tracking-[0.1em] uppercase">Precios en pesos · 3 cuotas sin interés{transferDiscountPct > 0 ? ` · ${transferDiscountPct}% OFF pagando por transferencia` : ''}</p>
    </section>
  );
}
