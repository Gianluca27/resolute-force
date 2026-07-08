import { DEFAULT_PAGE_DESIGN, type PageSection, type SectionType } from '@resolute/shared';

export const BLOCK_LABELS: Record<SectionType, string> = {
  marquee: 'Cinta (marquee)',
  hero: 'Hero',
  manifiesto: 'Manifiesto',
  products: 'Productos',
  historia: 'Historia',
  countdown: 'Countdown de drop',
  contacto: 'Contacto',
  textImage: 'Texto + Imagen',
  ctaBanner: 'Banner CTA',
  gallery: 'Galería',
  faq: 'FAQ',
  sizeTable: 'Tabla de talles',
  testimonials: 'Testimonios',
  videoEmbed: 'Video',
};

/** One-line summary shown next to the block label in the section list. */
export function blockSummary(s: PageSection): string {
  switch (s.type) {
    case 'marquee': return s.props.items[0] ?? '';
    case 'hero': return `${s.props.title1} ${s.props.title2}`.trim();
    case 'manifiesto': case 'historia': case 'products': case 'contacto': case 'textImage': case 'ctaBanner': case 'faq':
    case 'sizeTable': case 'testimonials': case 'videoEmbed':
      return 'title' in s.props ? s.props.title : '';
    case 'gallery': return `${s.props.images.length} imágenes`;
    case 'countdown': return 'Fecha y textos en Admin → Drop';
    default: return '';
  }
}

function genId(type: string): string {
  return `${type}-${crypto.randomUUID().slice(0, 8)}`;
}

const NEW_BLOCKS: Record<'textImage' | 'ctaBanner' | 'gallery' | 'faq' | 'sizeTable' | 'testimonials' | 'videoEmbed', () => PageSection> = {
  sizeTable: () => ({
    id: genId('sizeTable'), type: 'sizeTable', visible: true,
    props: {
      kicker: 'Encontrá tu medida', title: 'Guía de talles',
      note: 'Medidas de la prenda extendida, en centímetros. Ante la duda, escribinos por WhatsApp.',
      columns: ['Talle', 'Pecho (cm)', 'Largo (cm)'],
      rows: [['S', '96', '68'], ['M', '102', '71'], ['L', '108', '74'], ['XL', '114', '77']],
    },
  }),
  testimonials: () => ({
    id: genId('testimonials'), type: 'testimonials', visible: true,
    props: {
      kicker: 'Comunidad', title: 'Qué dicen los que entrenan con Resolute',
      items: [{ quote: 'La calidad se nota apenas la tenés puesta. Aguanta lavados y entrenamientos.', name: 'Nombre Apellido', detail: 'Ciudad', imageUrl: '' }],
    },
  }),
  videoEmbed: () => ({
    id: genId('videoEmbed'), type: 'videoEmbed', visible: true,
    props: { kicker: '', title: 'Detrás de escena', url: '', caption: '' },
  }),
  textImage: () => ({
    id: genId('textImage'), type: 'textImage', visible: true,
    props: { kicker: 'Sección nueva', title: 'Título de la sección', body: 'Contá algo acá. Cada línea es un párrafo.', imageUrl: '/assets/lifestyle-gym.png', imageSide: 'right', ctaLabel: '', ctaHref: '' },
  }),
  ctaBanner: () => ({
    id: genId('ctaBanner'), type: 'ctaBanner', visible: true,
    props: { title: 'Tu mensaje acá', subtitle: '', ctaLabel: 'Ver colección', ctaHref: '#productos', variant: 'accent' },
  }),
  gallery: () => ({
    id: genId('gallery'), type: 'gallery', visible: true,
    props: { kicker: '', title: 'Galería', columns: 3, images: [] },
  }),
  faq: () => ({
    id: genId('faq'), type: 'faq', visible: true,
    props: { kicker: '', title: 'Preguntas frecuentes', items: [{ q: '¿Cómo elijo mi talle?', a: 'Escribinos por WhatsApp y te ayudamos con la guía de talles.' }] },
  }),
};

/** Fresh section instance of the given type (brand types start from the default doc). */
export function newSection(type: SectionType): PageSection {
  const factory = (NEW_BLOCKS as Partial<Record<SectionType, () => PageSection>>)[type];
  if (factory) return factory();
  const template = DEFAULT_PAGE_DESIGN.sections.find((s) => s.type === type);
  if (!template) throw new Error(`Sin plantilla para el bloque ${type}`);
  return { ...JSON.parse(JSON.stringify(template)) as PageSection, id: genId(type) };
}

/** Order shown in the "Agregar sección" menu. */
export const ADDABLE_TYPES: SectionType[] = [
  'textImage', 'ctaBanner', 'gallery', 'faq', 'sizeTable', 'testimonials', 'videoEmbed',
  'hero', 'marquee', 'manifiesto', 'products', 'historia', 'countdown', 'contacto',
];
