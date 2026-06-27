import { beforeAll, describe, it, expect } from 'vitest';
import { seed } from '../prisma/seed';
import { resetDb } from './helpers/db';
import { prisma } from '../src/prisma';

beforeAll(async () => { await resetDb(); await seed(); });

describe('seed', () => {
  it('creates 4 active products, each with S/M/L/XL variants', async () => {
    const products = await prisma.product.findMany({ include: { variants: true }, orderBy: { sortOrder: 'asc' } });
    expect(products).toHaveLength(4);
    expect(products.every(p => p.active)).toBe(true);
    for (const p of products) expect(p.variants).toHaveLength(4);
    expect(products[0]!.color).toBe('Azul Marino');
    expect(products[0]!.tag).toBe('Más vendida');
    expect(products[3]!.line).toBe('Stop At Nothing');
  });

  it('creates singleton drop + content (6-item marquee, 10% transfer)', async () => {
    const drop = await prisma.dropConfig.findUnique({ where: { id: 1 } });
    expect(drop?.visible).toBe(true);
    const content = await prisma.siteContent.findUnique({ where: { id: 1 } });
    expect(JSON.parse(content!.marquee)).toHaveLength(6);
    expect(content!.transferDiscountPct).toBe(10);
  });

  it('is idempotent (running twice keeps 4 products)', async () => {
    await seed();
    expect(await prisma.product.count()).toBe(4);
  });

  it('hashes the admin password with bcrypt cost 12', async () => {
    const a = await prisma.adminUser.findUniqueOrThrow({ where: { email: 'admin@test.com' } });
    expect(a.passwordHash).toMatch(/^\$2[aby]\$12\$/);
  });

  it('does not clobber admin-edited product fields when re-run', async () => {
    const before = await prisma.product.findUniqueOrThrow({ where: { slug: 'champion-mentality-negro' } });
    await prisma.product.update({ where: { id: before.id }, data: { price: 99999, imageUrl: 'https://cdn.test/custom.png', tag: 'EDITADO', sortOrder: 42 } });
    await prisma.variant.updateMany({ where: { productId: before.id, size: 'M' }, data: { stock: 3 } });
    await seed();
    const after = await prisma.product.findUniqueOrThrow({ where: { slug: 'champion-mentality-negro' }, include: { variants: true } });
    expect(after.price).toBe(99999);
    expect(after.imageUrl).toBe('https://cdn.test/custom.png');
    expect(after.tag).toBe('EDITADO');
    expect(after.sortOrder).toBe(42);
    expect(after.variants.find((v) => v.size === 'M')!.stock).toBe(3);
  });
});
