import type { AdminProductDTO, ProductInput } from '@resolute/shared';
import { SIZES } from '@resolute/shared';
import type { Prisma } from '@prisma/client';
import { prisma } from '../prisma.js';
import { deleteImage } from '../lib/cloudinary.js';
import { HttpError, prismaErrorCode } from '../lib/httpError.js';

type PWV = Prisma.ProductGetPayload<{ include: { variants: true } }>;
function toDTO(p: PWV): AdminProductDTO {
  const rank = (s: string) => SIZES.indexOf(s as (typeof SIZES)[number]);
  return {
    id: p.id, slug: p.slug, line: p.line, color: p.color, dotColor: p.dotColor, tag: p.tag,
    price: p.price, imageUrl: p.imageUrl, active: p.active, sortOrder: p.sortOrder, imagePublicId: p.imagePublicId,
    updatedAt: p.updatedAt.toISOString(),
    sizes: [...p.variants].sort((a, b) => rank(a.size) - rank(b.size)).map((v) => ({ size: v.size, stock: v.stock })),
  };
}

// Map low-level Prisma failures to clean client responses (H-02 duplicate slug, H-04 missing row).
function translateProductError(e: unknown): never {
  const code = prismaErrorCode(e);
  if (code === 'P2002') throw new HttpError(409, 'Ya existe un producto con ese slug');
  if (code === 'P2025') throw new HttpError(404, 'Producto no encontrado');
  throw e;
}

export async function listAll(): Promise<AdminProductDTO[]> {
  const ps = await prisma.product.findMany({ orderBy: { sortOrder: 'asc' }, include: { variants: true } });
  return ps.map(toDTO);
}

export async function createProduct(input: ProductInput): Promise<AdminProductDTO> {
  try {
    const p = await prisma.product.create({
      data: {
        slug: input.slug, line: input.line, color: input.color, dotColor: input.dotColor, tag: input.tag ?? null,
        price: input.price, active: input.active, sortOrder: input.sortOrder, imageUrl: '/assets/logo-r.png',
        variants: { create: input.sizes.map((s) => ({ size: s.size, stock: s.stock })) },
      },
      include: { variants: true },
    });
    return toDTO(p);
  } catch (e) { translateProductError(e); }
}

export async function updateProduct(id: string, input: ProductInput): Promise<AdminProductDTO> {
  try {
    await prisma.$transaction(async (tx) => {
      const cur = await tx.product.findUnique({ where: { id }, select: { updatedAt: true } });
      if (!cur) throw new HttpError(404, 'Producto no encontrado');
      // Optimistic concurrency (H-01): reject stale edits instead of silently overwriting a
      // newer save (last-write-wins). Only enforced when the client sends the token it loaded.
      if (input.expectedUpdatedAt && cur.updatedAt.toISOString() !== input.expectedUpdatedAt) {
        throw new HttpError(409, 'El producto fue modificado por otra persona. Recargá la página y reintentá.');
      }
      await tx.product.update({ where: { id }, data: { slug: input.slug, line: input.line, color: input.color, dotColor: input.dotColor, tag: input.tag ?? null, price: input.price, active: input.active, sortOrder: input.sortOrder } });
      await tx.variant.deleteMany({ where: { productId: id, size: { notIn: input.sizes.map((s) => s.size) } } });
      for (const s of input.sizes) {
        await tx.variant.upsert({ where: { productId_size: { productId: id, size: s.size } }, update: { stock: s.stock }, create: { productId: id, size: s.size, stock: s.stock } });
      }
    });
  } catch (e) {
    if (e instanceof HttpError) throw e;
    translateProductError(e);
  }
  const p = await prisma.product.findUniqueOrThrow({ where: { id }, include: { variants: true } });
  return toDTO(p);
}

export async function deleteProduct(id: string): Promise<void> {
  const p = await prisma.product.findUnique({ where: { id } });
  if (!p) throw new HttpError(404, 'Producto no encontrado');
  if (p.imagePublicId) await deleteImage(p.imagePublicId);
  await prisma.product.delete({ where: { id } });
}

export async function setProductImage(id: string, url: string, publicId: string): Promise<AdminProductDTO> {
  const prev = await prisma.product.findUnique({ where: { id } });
  if (prev?.imagePublicId) await deleteImage(prev.imagePublicId);
  const p = await prisma.product.update({ where: { id }, data: { imageUrl: url, imagePublicId: publicId }, include: { variants: true } });
  return toDTO(p);
}
