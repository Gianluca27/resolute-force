import { beforeAll, describe, it, expect } from 'vitest';
import { prisma } from '../src/prisma';
import { resetDb } from './helpers/db';

beforeAll(resetDb);

describe('prisma schema', () => {
  it('creates a product with a variant and reads it back', async () => {
    const p = await prisma.product.create({
      data: {
        slug: 't-smoke', line: 'Champion Mentality', color: 'Negro',
        dotColor: '#101013', price: 30000, imageUrl: '/assets/tile-black.png',
        variants: { create: [{ size: 'M', stock: 10 }] },
      },
      include: { variants: true },
    });
    expect(p.variants).toHaveLength(1);
    expect(p.variants[0]!.stock).toBe(10);
  });
});
