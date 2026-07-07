import type { DropDTO, ContentDTO } from '@resolute/shared';
import { prisma } from '../prisma.js';
import { HttpError } from '../lib/httpError.js';

export async function getDrop(): Promise<DropDTO> {
  // findFirst (not findUnique id:1): tolerant of singleton id drift from the AUTOINCREMENT migration.
  const d = await prisma.dropConfig.findFirst({ orderBy: { id: 'asc' } });
  if (!d) throw new Error('DropConfig no inicializado — corré el seed');
  return { targetAt: d.targetAt.toISOString(), visible: d.visible, title: d.title, teaser: d.teaser, updatedAt: d.updatedAt.toISOString() };
}

export async function getContent(): Promise<ContentDTO> {
  const c = await prisma.siteContent.findFirst({ orderBy: { id: 'asc' } });
  if (!c) throw new Error('SiteContent no inicializado — corré el seed');
  return {
    marquee: JSON.parse(c.marquee) as string[],
    heroKicker: c.heroKicker, heroTitle1: c.heroTitle1, heroTitle2: c.heroTitle2, heroSubtitle: c.heroSubtitle,
    transferDiscountPct: c.transferDiscountPct, lowStockThreshold: c.lowStockThreshold, bankAlias: c.bankAlias, bankCbu: c.bankCbu,
    contactWhatsapp: c.contactWhatsapp, contactInstagram: c.contactInstagram,
    contactEmail: c.contactEmail, contactLocation: c.contactLocation, updatedAt: c.updatedAt.toISOString(),
  };
}

// Optimistic concurrency (H-06): if the client sends the updatedAt it loaded and the row has
// since changed, reject with 409 instead of silently clobbering another admin's edit.
function assertFresh(expected: string | undefined, actual: Date): void {
  if (expected && expected !== actual.toISOString()) {
    throw new HttpError(409, 'La configuración fue modificada por otro usuario. Recargá la página y reintentá.');
  }
}

export async function updateDrop(input: { targetAt: string; visible: boolean; title: string; teaser: string; updatedAt?: string }): Promise<DropDTO> {
  const existing = await prisma.dropConfig.findFirstOrThrow({ orderBy: { id: 'asc' } });
  assertFresh(input.updatedAt, existing.updatedAt);
  const d = await prisma.dropConfig.update({ where: { id: existing.id }, data: { targetAt: new Date(input.targetAt), visible: input.visible, title: input.title, teaser: input.teaser } });
  return { targetAt: d.targetAt.toISOString(), visible: d.visible, title: d.title, teaser: d.teaser, updatedAt: d.updatedAt.toISOString() };
}

export async function updateContent(input: ContentDTO): Promise<ContentDTO> {
  const existing = await prisma.siteContent.findFirstOrThrow({ orderBy: { id: 'asc' } });
  assertFresh(input.updatedAt, existing.updatedAt);
  await prisma.siteContent.update({
    where: { id: existing.id },
    data: {
      marquee: JSON.stringify(input.marquee), heroKicker: input.heroKicker, heroTitle1: input.heroTitle1, heroTitle2: input.heroTitle2, heroSubtitle: input.heroSubtitle,
      transferDiscountPct: input.transferDiscountPct, lowStockThreshold: input.lowStockThreshold ?? existing.lowStockThreshold, bankAlias: input.bankAlias, bankCbu: input.bankCbu,
      contactWhatsapp: input.contactWhatsapp, contactInstagram: input.contactInstagram, contactEmail: input.contactEmail, contactLocation: input.contactLocation,
    },
  });
  return getContent();
}
