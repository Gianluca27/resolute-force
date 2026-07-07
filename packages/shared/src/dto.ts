export interface CartLineInput { productId: string; size: string; qty: number; }
export interface CustomerInput {
  nombre: string; email: string; tel?: string;
  calle: string; altura: string; pisoDepto?: string; cp: string; provincia: string; ciudad: string;
}
export interface QuoteLine { productId: string; line: string; color: string; size: string; unitPrice: number; qty: number; lineTotal: number; }
export interface QuoteResult { lines: QuoteLine[]; subtotal: number; transferDiscount: number; totalTransfer: number; totalCard: number; }
export interface ProductVariantDTO { size: string; stock: number; }
export interface ProductDTO { id: string; slug: string; line: string; color: string; dotColor: string; tag: string | null; price: number; imageUrl: string; sizes: ProductVariantDTO[]; }
export const SIZES = ['S', 'M', 'L', 'XL'] as const;
export type Size = (typeof SIZES)[number];

export interface AdminProductDTO extends ProductDTO { active: boolean; sortOrder: number; imagePublicId: string | null; updatedAt: string; }

// updatedAt: optimistic-lock token round-tripped by admin config forms (H-06). Optional: public
// readers ignore it, and writers that omit it just skip the conflict check.
export interface DropDTO { targetAt: string; visible: boolean; title: string; teaser: string; updatedAt?: string; }
export interface ContentDTO {
  marquee: string[]; heroKicker: string; heroTitle1: string; heroTitle2: string; heroSubtitle: string;
  transferDiscountPct: number; lowStockThreshold?: number; bankAlias: string; bankCbu: string;
  contactWhatsapp: string; contactInstagram: string; contactEmail: string; contactLocation: string; updatedAt?: string;
}
