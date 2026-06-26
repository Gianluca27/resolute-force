import type { DropDTO, ContentDTO } from '@resolute/shared';
import { prisma } from '../prisma.js';

export async function getDrop(): Promise<DropDTO> {
  const d = await prisma.dropConfig.findUnique({ where: { id: 1 } });
  if (!d) throw new Error('DropConfig no inicializado — corré el seed');
  return { targetAt: d.targetAt.toISOString(), visible: d.visible, title: d.title, teaser: d.teaser };
}

export async function getContent(): Promise<ContentDTO> {
  const c = await prisma.siteContent.findUnique({ where: { id: 1 } });
  if (!c) throw new Error('SiteContent no inicializado — corré el seed');
  return {
    marquee: JSON.parse(c.marquee) as string[],
    heroKicker: c.heroKicker, heroTitle1: c.heroTitle1, heroTitle2: c.heroTitle2, heroSubtitle: c.heroSubtitle,
    transferDiscountPct: c.transferDiscountPct, bankAlias: c.bankAlias, bankCbu: c.bankCbu,
    contactWhatsapp: c.contactWhatsapp, contactInstagram: c.contactInstagram,
    contactEmail: c.contactEmail, contactLocation: c.contactLocation,
  };
}
