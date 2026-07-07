import type { ProductDTO, ProductsProps, SectionStyle } from '@resolute/shared';
import ProductCard from './ProductCard';
import { sectionOverrides, SECTION_PAD } from './sections/shell';

export default function Productos({ id = 'productos', props, sectionStyle, products, onAdd, transferDiscountPct = 10 }: {
  id?: string;
  props: ProductsProps;
  sectionStyle?: SectionStyle;
  products: ProductDTO[];
  onAdd: (p: ProductDTO, size: string) => void;
  transferDiscountPct?: number;
}) {
  const o = sectionOverrides(sectionStyle, { bg: '', pad: SECTION_PAD });
  return (
    <section id={id} data-screen-label="Productos" style={o.css} className={`scroll-mt-20 ${o.bgCls} ${o.padCls}`}>
      <div className="px-[clamp(18px,5vw,64px)] max-w-[1280px] mx-auto">
        <div className="flex flex-wrap items-end justify-between gap-5 mb-[44px]">
          <div>
            {props.kicker && <div className="font-display font-bold text-[13px] tracking-[0.3em] uppercase text-gold mb-[14px]">{props.kicker}</div>}
            <h2 className="m-0 font-display font-black uppercase leading-[0.9] tracking-[-0.01em] text-[clamp(2.4rem,5.6vw,4.6rem)]">{props.title}{props.titleAccent && <><br /><span className="text-mut">{props.titleAccent}</span></>}</h2>
          </div>
          {props.description && <p className="max-w-[340px] text-mut text-[15.5px] leading-[1.6] m-0">{props.description}</p>}
        </div>
        <div className="grid gap-[18px] [grid-template-columns:repeat(auto-fill,minmax(258px,1fr))]">
          {products.map((p) => <ProductCard key={p.id} product={p} onAdd={onAdd} />)}
        </div>
        <p className="text-center text-mut text-[14px] mt-[34px] font-display tracking-[0.1em] uppercase">Precios en pesos · 3 cuotas sin interés{transferDiscountPct > 0 ? ` · ${transferDiscountPct}% OFF pagando por transferencia` : ''}</p>
      </div>
    </section>
  );
}
