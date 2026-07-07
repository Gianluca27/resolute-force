import { beforeEach, describe, it, expect, vi } from 'vitest';

vi.mock('../src/lib/mailer.js', () => ({ sendMail: vi.fn().mockResolvedValue(undefined) }));

import { sendMail } from '../src/lib/mailer.js';
import { seed } from '../prisma/seed.js';
import { resetDb } from './helpers/db.js';
import { prisma } from '../src/prisma.js';
import { createOrder } from '../src/services/orders.js';
import { notifyOrderPaid } from '../src/services/notify.js';

const customer = { nombre: 'Ana', email: 'ana@x.com', tel: '11', calle: 'Calle 1', altura: '100', cp: '1425', provincia: 'C', ciudad: 'CABA' };
beforeEach(async () => { await resetDb(); await seed(); vi.clearAllMocks(); });

describe('notifyOrderPaid', () => {
  it('emails the admin and the customer with item size + color', async () => {
    const navyId = (await prisma.product.findUniqueOrThrow({ where: { slug: 'champion-mentality-azul-marino' } })).id;
    const { order } = await createOrder({ items: [{ productId: navyId, size: 'L', qty: 2 }], customer, method: 'card' });
    await notifyOrderPaid(order.orderNo);

    const calls = vi.mocked(sendMail).mock.calls.map((c) => c[0]);
    expect(calls).toHaveLength(2);
    const admin = calls.find((c) => c.to === 'admin@test.com')!;
    const cust = calls.find((c) => c.to === 'ana@x.com')!;
    expect(admin.subject).toContain(order.orderNo);
    expect(admin.html).toContain('Azul Marino'); // color
    expect(admin.html).toContain('>L<'); // size cell
    expect(admin.html).toContain('Ana');  // customer name
    expect(cust.subject).toContain(order.orderNo);
  });
});
