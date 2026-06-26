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
});
