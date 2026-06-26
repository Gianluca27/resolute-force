import type { Prisma } from '@prisma/client';
import type { ProductDTO } from '@resolute/shared';
import { SIZES } from '@resolute/shared';
import { prisma } from '../prisma';

type ProductWithVariants = Prisma.ProductGetPayload<{ include: { variants: true } }>;

function toDTO(p: ProductWithVariants): ProductDTO {
  const rank = (s: string) => SIZES.indexOf(s as (typeof SIZES)[number]);
  return {
    id: p.id, slug: p.slug, line: p.line, color: p.color, dotColor: p.dotColor,
    tag: p.tag, price: p.price, imageUrl: p.imageUrl,
    sizes: [...p.variants].sort((a, b) => rank(a.size) - rank(b.size)).map(v => ({ size: v.size, stock: v.stock })),
  };
}

export async function listProducts(): Promise<ProductDTO[]> {
  const products = await prisma.product.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' }, include: { variants: true } });
  return products.map(toDTO);
}

export async function getProductBySlug(slug: string): Promise<ProductDTO | null> {
  const p = await prisma.product.findFirst({ where: { slug, active: true }, include: { variants: true } });
  return p ? toDTO(p) : null;
}
