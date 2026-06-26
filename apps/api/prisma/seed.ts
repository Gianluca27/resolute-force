import { pathToFileURL } from 'node:url';
import { prisma } from '../src/prisma';

const SIZES = ['S', 'M', 'L', 'XL'] as const;

const products = [
  { slug: 'champion-mentality-azul-marino', line: 'Champion Mentality', color: 'Azul Marino', dotColor: '#1f2a44', tag: 'Más vendida' as string | null, image: '/assets/tile-navy.png', sortOrder: 0 },
  { slug: 'champion-mentality-negro', line: 'Champion Mentality', color: 'Negro', dotColor: '#101013', tag: null, image: '/assets/tile-black.png', sortOrder: 1 },
  { slug: 'champion-mentality-verde-militar', line: 'Champion Mentality', color: 'Verde Militar', dotColor: '#4a5235', tag: null, image: '/assets/tile-olive.png', sortOrder: 2 },
  { slug: 'stop-at-nothing-blanco', line: 'Stop At Nothing', color: 'Blanco', dotColor: '#e9e9ea', tag: 'Nuevo', image: '/assets/tile-white.png', sortOrder: 3 },
];

export async function seed() {
  for (const p of products) {
    await prisma.product.upsert({
      where: { slug: p.slug },
      update: { line: p.line, color: p.color, dotColor: p.dotColor, tag: p.tag, price: 30000, imageUrl: p.image, sortOrder: p.sortOrder, active: true },
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
      bankAlias: '',
      bankCbu: '',
      contactWhatsapp: '5493413213723',
      contactInstagram: '@resolute.force',
      contactEmail: 'resolutecontacto@gmail.com',
      contactLocation: 'Buenos Aires · Envíos a todo el país',
    },
  });
}

const isMain = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  seed()
    .then(() => { console.log('[seed] done'); return prisma.$disconnect(); })
    .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
}
