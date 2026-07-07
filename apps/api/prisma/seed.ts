import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import type { Prisma } from '@prisma/client';
import { DEFAULT_PAGE_DESIGN, type PageDesignDoc } from '@resolute/shared';
import { prisma } from '../src/prisma';
import bcrypt from 'bcryptjs';
import { env } from '../src/env';

const SIZES = ['S', 'M', 'L', 'XL'] as const;

const products = [
  { slug: 'champion-mentality-azul-marino', line: 'Champion Mentality', color: 'Azul Marino', dotColor: '#1f2a44', tag: 'Más vendida' as string | null, image: '/assets/tile-navy.png', sortOrder: 0 },
  { slug: 'champion-mentality-negro', line: 'Champion Mentality', color: 'Negro', dotColor: '#101013', tag: null, image: '/assets/tile-black.png', sortOrder: 1 },
  { slug: 'champion-mentality-verde-militar', line: 'Champion Mentality', color: 'Verde Militar', dotColor: '#4a5235', tag: null, image: '/assets/tile-olive.png', sortOrder: 2 },
  { slug: 'stop-at-nothing-blanco', line: 'Stop at Nothing', color: 'Blanco', dotColor: '#e9e9ea', tag: 'Nuevo', image: '/assets/tile-white.png', sortOrder: 3 },
];

export async function seed() {
  for (const p of products) {
    await prisma.product.upsert({
      where: { slug: p.slug },
      // Seed is initial data only — never clobber admin edits (price/image/tag/stock/sortOrder) on re-run.
      update: {},
      create: {
        slug: p.slug, line: p.line, color: p.color, dotColor: p.dotColor, tag: p.tag,
        price: 30000, imageUrl: p.image, sortOrder: p.sortOrder, active: true,
        variants: { create: SIZES.map(size => ({ size, stock: 25 })) },
      },
    });
  }

  await prisma.dropConfig.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      targetAt: new Date('2026-08-15T20:00:00-03:00'),
      visible: true,
      title: 'Algo se está forjando',
      teaser: 'Un nuevo drop está entrando al fuego. Hoodies, oversize y la línea Pressure. Preparate.',
    },
  });

  await prisma.siteContent.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      marquee: JSON.stringify(['Envíos a todo el país', 'Champion Mentality', '3 cuotas sin interés', 'Stop at Nothing', 'Calidad premium', 'The Resolute Standard']),
      heroKicker: 'Est. 2024 · Indumentaria de alto rendimiento',
      heroTitle1: 'Champion',
      heroTitle2: 'Mentality',
      heroSubtitle: 'No vendemos remeras. Forjamos una mentalidad. Indumentaria deportiva para los que entrenan bajo presión y no se detienen ante nada.',
      transferDiscountPct: 10,
      // Placeholder transfer data so a fresh install ships a usable default (transfer is the discounted,
      // default method). Replace with the real alias/CBU from Admin (Módulo 11). See QA E-01.
      bankAlias: 'resolute.force',
      bankCbu: '',
      contactWhatsapp: '5493413213723',
      contactInstagram: '@resoluteforceok',
      contactEmail: 'resolutecontacto@gmail.com',
      contactLocation: 'Rosario · Envíos a todo el país',
    },
  });

  // Page design: seed draft & published from the default doc, but carry over any
  // hero/marquee values the admin already edited in SiteContent (pre-builder installs).
  const content = await prisma.siteContent.findFirst({ orderBy: { id: 'asc' } });
  const doc: PageDesignDoc = JSON.parse(JSON.stringify(DEFAULT_PAGE_DESIGN));
  if (content) {
    for (const s of doc.sections) {
      if (s.type === 'marquee') {
        try { s.props.items = (JSON.parse(content.marquee) as string[]).slice(0, 12); } catch { /* keep defaults */ }
      } else if (s.type === 'hero') {
        s.props.kicker = content.heroKicker;
        s.props.title1 = content.heroTitle1;
        s.props.title2 = content.heroTitle2;
        s.props.subtitle = content.heroSubtitle;
      }
    }
  }
  await prisma.pageDesign.upsert({
    where: { id: 1 },
    update: {}, // never clobber admin edits on re-run
    create: { id: 1, draft: doc as unknown as Prisma.InputJsonValue, published: doc as unknown as Prisma.InputJsonValue },
  });

  if (env.ADMIN_PASSWORD) {
    const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 12);
    await prisma.adminUser.upsert({ where: { email: env.ADMIN_EMAIL }, update: { passwordHash }, create: { email: env.ADMIN_EMAIL, passwordHash } });
  }
}

const isMain = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  seed()
    .then(() => { console.log('[seed] done'); return prisma.$disconnect(); })
    .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
}
