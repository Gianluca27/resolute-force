import { useState } from 'react';
import type { ProductDTO } from '@resolute/shared';
import { money } from '../lib/money';

export default function ProductCard({ product, onAdd }: { product: ProductDTO; onAdd: (p: ProductDTO, size: string) => void }) {
  const [sel, setSel] = useState('M');
  return (
    <div className="relative bg-card border border-line rounded-[4px] overflow-hidden flex flex-col transition hover:-translate-y-[5px] hover:border-line2 hover:shadow-[0_18px_40px_-20px_rgba(0,0,0,0.8)]">
      {product.tag && (
        <span className="absolute top-3 left-3 z-[2] bg-red text-white font-display font-bold text-[11px] tracking-[0.16em] uppercase px-[11px] py-[6px] rounded-[2px]">{product.tag}</span>
      )}
      <div className="aspect-square overflow-hidden bg-[#d2d2cf]">
        <img src={product.imageUrl} alt={`Remera Resolute Force ${product.color}`} className="block w-full h-full object-cover" />
      </div>
      <div className="px-[18px] pt-[18px] pb-5 flex flex-col gap-[14px] flex-1">
        <div>
          <h3 className="m-0 font-display font-bold text-[22px] tracking-[0.03em] uppercase leading-none">{product.line}</h3>
          <div className="flex items-center gap-2 mt-[7px] text-mut text-[13.5px] font-display tracking-[0.1em] uppercase">
            <span className="w-[11px] h-[11px] rounded-full border border-white/25 inline-block" style={{ background: product.dotColor }} />{product.color}
          </div>
        </div>
        <div className="flex gap-[7px]">
          {product.sizes.map(({ size }) => {
            const active = size === sel;
            return (
              <button key={size} onClick={() => setSel(size)}
                className={`flex-1 min-w-0 rounded-[2px] py-[9px] cursor-pointer font-display font-bold text-[14px] tracking-[0.06em] uppercase transition ${active ? 'bg-tx text-bg border border-tx' : 'bg-transparent text-mut border border-line2'}`}>
                {size}
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-between gap-3 mt-auto pt-[6px]">
          <span className="font-display font-extrabold text-[26px] tracking-[0.01em]">{money(product.price)}</span>
          <button onClick={() => onAdd(product, sel)} className="inline-flex items-center gap-2 bg-tx text-bg border-0 rounded-[2px] px-4 py-[11px] cursor-pointer font-display font-bold text-[14px] tracking-[0.12em] uppercase transition hover:bg-red hover:text-white">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            Agregar
          </button>
        </div>
      </div>
    </div>
  );
}
