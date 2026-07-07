import { z } from 'zod';

// ---------------------------------------------------------------------------
// Page design document: theme + ordered section list, stored as JSON (draft &
// published copies) in the PageDesign singleton. Both API (validation/seed)
// and web (renderer/editor/fallback) consume these schemas.
// ---------------------------------------------------------------------------

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color hex inválido');

// Curated Google Fonts list. `gf` is the css2 family query param; weights are
// pinned so the editor can't request faces that don't exist.
export const FONT_OPTIONS = [
  { id: 'saira-condensed', label: 'Saira Condensed', family: '"Saira Condensed"', gf: 'Saira+Condensed:wght@500;600;700;800;900' },
  { id: 'barlow', label: 'Barlow', family: '"Barlow"', gf: 'Barlow:wght@400;500;600;700' },
  { id: 'oswald', label: 'Oswald', family: '"Oswald"', gf: 'Oswald:wght@400;500;600;700' },
  { id: 'bebas-neue', label: 'Bebas Neue', family: '"Bebas Neue"', gf: 'Bebas+Neue' },
  { id: 'archivo', label: 'Archivo', family: '"Archivo"', gf: 'Archivo:wght@400;500;600;700;800;900' },
  { id: 'anton', label: 'Anton', family: '"Anton"', gf: 'Anton' },
  { id: 'montserrat', label: 'Montserrat', family: '"Montserrat"', gf: 'Montserrat:wght@400;500;600;700;800;900' },
  { id: 'inter', label: 'Inter', family: '"Inter"', gf: 'Inter:wght@400;500;600;700' },
  { id: 'space-grotesk', label: 'Space Grotesk', family: '"Space Grotesk"', gf: 'Space+Grotesk:wght@400;500;600;700' },
  { id: 'roboto-condensed', label: 'Roboto Condensed', family: '"Roboto Condensed"', gf: 'Roboto+Condensed:wght@400;500;600;700' },
  { id: 'poppins', label: 'Poppins', family: '"Poppins"', gf: 'Poppins:wght@400;500;600;700;800' },
] as const;
export type FontId = (typeof FONT_OPTIONS)[number]['id'];
const fontIds = FONT_OPTIONS.map((f) => f.id) as [FontId, ...FontId[]];

export const themeSchema = z.object({
  colors: z.object({
    bg: hexColor,        // page background
    panel: hexColor,     // alternate section background
    card: hexColor,      // cards / inputs
    text: hexColor,
    muted: hexColor,
    accent: hexColor,    // brand red
    accentDark: hexColor, // accent hover
    secondary: hexColor, // brand gold
  }),
  fonts: z.object({ display: z.enum(fontIds), body: z.enum(fontIds) }),
  shapes: z.object({
    radius: z.number().int().min(0).max(24),
    buttonStyle: z.enum(['square', 'rounded', 'pill']),
  }),
});
export type Theme = z.infer<typeof themeSchema>;

// Per-section style overrides. 'default' keeps each section's designed
// background (hero transparent, manifiesto panel, …).
export const sectionStyleSchema = z.object({
  background: z.enum(['default', 'bg', 'panel', 'custom']).default('default'),
  customBg: hexColor.optional(),
  paddingY: z.enum(['default', 'sm', 'md', 'lg']).default('default'),
});
export type SectionStyle = z.infer<typeof sectionStyleSchema>;

const str = (max: number) => z.string().trim().max(max);
const img = str(500); // Cloudinary URL or /assets path

export const heroPropsSchema = z.object({
  kicker: str(80),
  title1: str(60),
  title2: str(60),
  subtitle: str(400),
  subtitleHighlight: str(160),
  ctaPrimary: str(40),   // empty string hides the button
  ctaSecondary: str(40),
  badges: z.array(str(60)).max(4),
});

export const marqueePropsSchema = z.object({ items: z.array(str(80)).min(1).max(12) });

export const manifiestoPropsSchema = z.object({
  kicker: str(60),
  title: str(120),
  titleAccent: str(120),
  body: str(800),
  bodyHighlight: str(240),
  imageUrl: img,
  imagePublicId: str(200).optional(),
  imageBadge: str(80),
  principles: z.array(z.object({ title: str(80), sub: str(160) })).max(5),
});

export const productsPropsSchema = z.object({
  kicker: str(60),
  title: str(80),
  titleAccent: str(80),
  description: str(400),
});

export const historiaPropsSchema = z.object({
  kicker: str(60),
  title: str(160), // '\n' renders as a line break
  body: str(900),
  bodyHighlight: str(240),
  imageUrl: img,
  imagePublicId: str(200).optional(),
  imageTitle: str(80),
  imageSubtitle: str(140),
  stats: z.array(z.object({ value: str(20), label: str(60) })).max(4),
});

// Countdown content (date/title/teaser) stays in DropConfig — this block only
// controls placement/visibility within the page.
export const countdownPropsSchema = z.object({});

export const contactoPropsSchema = z.object({
  kicker: str(60),
  title: str(80),
  subtitle: str(400),
});

export const textImagePropsSchema = z.object({
  kicker: str(60),
  title: str(160),
  body: str(1200),
  imageUrl: img,
  imagePublicId: str(200).optional(),
  imageSide: z.enum(['left', 'right']),
  ctaLabel: str(40),
  ctaHref: str(300),
});

export const ctaBannerPropsSchema = z.object({
  title: str(160),
  subtitle: str(400),
  ctaLabel: str(40),
  ctaHref: str(300),
  variant: z.enum(['accent', 'secondary', 'dark', 'image']),
  imageUrl: img.optional(),
  imagePublicId: str(200).optional(),
});

export const galleryPropsSchema = z.object({
  kicker: str(60),
  title: str(160),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  images: z.array(z.object({ url: img, publicId: str(200).optional(), alt: str(140) })).max(24),
});

export const faqPropsSchema = z.object({
  kicker: str(60),
  title: str(160),
  items: z.array(z.object({ q: str(240), a: str(1200) })).min(1).max(20),
});

const base = {
  id: z.string().trim().min(1).max(40),
  visible: z.boolean(),
  style: sectionStyleSchema.optional(),
};

export const sectionSchema = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('marquee'), props: marqueePropsSchema }),
  z.object({ ...base, type: z.literal('hero'), props: heroPropsSchema }),
  z.object({ ...base, type: z.literal('manifiesto'), props: manifiestoPropsSchema }),
  z.object({ ...base, type: z.literal('products'), props: productsPropsSchema }),
  z.object({ ...base, type: z.literal('historia'), props: historiaPropsSchema }),
  z.object({ ...base, type: z.literal('countdown'), props: countdownPropsSchema }),
  z.object({ ...base, type: z.literal('contacto'), props: contactoPropsSchema }),
  z.object({ ...base, type: z.literal('textImage'), props: textImagePropsSchema }),
  z.object({ ...base, type: z.literal('ctaBanner'), props: ctaBannerPropsSchema }),
  z.object({ ...base, type: z.literal('gallery'), props: galleryPropsSchema }),
  z.object({ ...base, type: z.literal('faq'), props: faqPropsSchema }),
]);
export type PageSection = z.infer<typeof sectionSchema>;
export type SectionType = PageSection['type'];

export type HeroProps = z.infer<typeof heroPropsSchema>;
export type MarqueeProps = z.infer<typeof marqueePropsSchema>;
export type ManifiestoProps = z.infer<typeof manifiestoPropsSchema>;
export type ProductsProps = z.infer<typeof productsPropsSchema>;
export type HistoriaProps = z.infer<typeof historiaPropsSchema>;
export type ContactoProps = z.infer<typeof contactoPropsSchema>;
export type TextImageProps = z.infer<typeof textImagePropsSchema>;
export type CtaBannerProps = z.infer<typeof ctaBannerPropsSchema>;
export type GalleryProps = z.infer<typeof galleryPropsSchema>;
export type FaqProps = z.infer<typeof faqPropsSchema>;

export const pageDesignDocSchema = z.object({
  version: z.literal(1),
  theme: themeSchema,
  // Section ids must be unique — duplicated ids break reordering and React keys.
  sections: z.array(sectionSchema).max(30).refine(
    (s) => new Set(s.map((x) => x.id)).size === s.length,
    'Ids de sección duplicados',
  ),
});
export type PageDesignDoc = z.infer<typeof pageDesignDocSchema>;

// PUT /api/admin/page-design body. updatedAt: optimistic-lock token (same
// convention as drop/content config).
export const pageDesignUpdateSchema = z.object({
  doc: pageDesignDocSchema,
  updatedAt: z.string().optional(),
});

export interface PageDesignAdminDTO { draft: PageDesignDoc; dirty: boolean; updatedAt: string }

// ---------------------------------------------------------------------------
// Default document — replicates today's page exactly. Used by the API seed
// (with hero/marquee overridden from any existing SiteContent row) and as the
// web fallback when the API is unreachable.
// ---------------------------------------------------------------------------
export const DEFAULT_PAGE_DESIGN: PageDesignDoc = {
  version: 1,
  theme: {
    colors: {
      bg: '#0a0a0b', panel: '#0e0e10', card: '#161619',
      text: '#f4f4f3', muted: '#97979d',
      accent: '#e4322b', accentDark: '#bb211c', secondary: '#e8b53e',
    },
    fonts: { display: 'saira-condensed', body: 'barlow' },
    shapes: { radius: 4, buttonStyle: 'square' },
  },
  sections: [
    {
      id: 'marquee', type: 'marquee', visible: true,
      props: { items: ['Envíos a todo el país', 'Champion Mentality', '3 cuotas sin interés', 'Stop at Nothing', 'Calidad premium', 'The Resolute Standard'] },
    },
    {
      id: 'hero', type: 'hero', visible: true,
      props: {
        kicker: 'Est. 2024 · Indumentaria de alto rendimiento',
        title1: 'Champion', title2: 'Mentality',
        subtitle: 'No vendemos remeras. Forjamos una mentalidad. Indumentaria deportiva para los que entrenan bajo presión y no se detienen ante nada.',
        subtitleHighlight: 'Esta es la norma Resolute.',
        ctaPrimary: 'Ver colección', ctaSecondary: 'El manifiesto',
        badges: ['Envíos a todo el país', '3 cuotas sin interés', 'Algodón premium'],
      },
    },
    {
      id: 'manifiesto', type: 'manifiesto', visible: true,
      props: {
        kicker: 'El Manifiesto',
        title: 'La presión no te quiebra.', titleAccent: 'Te forja.',
        body: 'Cada prenda lleva un recordatorio en la espalda: lo que te define no es el talento, es la mentalidad. Disciplina cuando nadie mira. Constancia cuando todo cuesta.',
        bodyHighlight: 'Ser campeón se decide mucho antes de competir.',
        imageUrl: '/assets/teaser-burst.png',
        imageBadge: 'Champions think under pressure',
        principles: [
          { title: 'Champions think under pressure', sub: 'La mente decide antes que el cuerpo.' },
          { title: 'Discipline is the key', sub: 'La constancia construye lo que la motivación promete.' },
          { title: 'Stop at Nothing', sub: 'No hay plan B para los que van por todo.' },
        ],
      },
    },
    {
      id: 'productos', type: 'products', visible: true,
      props: {
        kicker: 'Nuestros productos',
        title: 'La colección', titleAccent: "Resolute '26",
        description: 'Remeras de algodón premium con estampas de la línea Champion Mentality y Stop at Nothing. Disponibles en todos los talles.',
      },
    },
    {
      id: 'historia', type: 'historia', visible: true,
      props: {
        kicker: 'Sobre la marca',
        title: 'Nacida en el gimnasio,\nforjada en la disciplina',
        body: 'Resolute Force nació en 2024 entre pesas, madrugadas y la convicción de que la ropa con la que entrenás debería recordarte quién querés ser. Empezamos imprimiendo unas pocas remeras para amigos del gym. Hoy somos una comunidad de atletas que comparten una misma norma:',
        bodyHighlight: 'no rendirse nunca.',
        imageUrl: '/assets/lifestyle-gym.png',
        imageTitle: 'The Resolute Standard',
        imageSubtitle: 'Donde la presión se convierte en carácter.',
        stats: [
          { value: '2024', label: 'Año de fundación' },
          { value: '+5.000', label: 'Atletas en el ejército' },
          { value: '100%', label: 'Algodón premium' },
        ],
      },
    },
    { id: 'proximos', type: 'countdown', visible: true, props: {} },
    {
      id: 'contacto', type: 'contacto', visible: true,
      props: {
        kicker: 'Sumate al ejército',
        title: 'Hablemos',
        subtitle: '¿Dudas con un talle, un envío o querés tu remera? Escribinos, te respondemos rápido.',
      },
    },
  ],
};
