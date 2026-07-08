import { z } from 'zod';

// ---------------------------------------------------------------------------
// Page design document: theme + ordered section list, stored as JSON (draft &
// published copies) in the PageDesign singleton. Both API (validation/seed)
// and web (renderer/editor/fallback) consume these schemas.
// ---------------------------------------------------------------------------

import { FONT_OPTIONS, type FontId } from './pageDesignData';

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color hex inválido');

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

// Header defines the width; every row must match it so the table renders square.
export const sizeTablePropsSchema = z.object({
  kicker: str(60),
  title: str(160),
  note: str(240), // e.g. "Medidas en cm, prenda extendida"
  columns: z.array(str(24)).min(1).max(6),
  rows: z.array(z.array(str(24))).max(12),
}).refine((p) => p.rows.every((r) => r.length === p.columns.length), 'Cada fila debe tener tantas celdas como columnas');

export const testimonialsPropsSchema = z.object({
  kicker: str(60),
  title: str(160),
  items: z.array(z.object({
    quote: str(400).refine((v) => v.length > 0, 'La cita no puede estar vacía'),
    name: str(80).refine((v) => v.length > 0, 'El nombre no puede estar vacío'),
    detail: str(80), // e.g. "CrossFit · Rosario"
    imageUrl: img.optional(),
    imagePublicId: str(200).optional(),
  })).min(1).max(9),
});

export const videoEmbedPropsSchema = z.object({
  kicker: str(60),
  title: str(160),
  url: str(300), // YouTube/Vimeo page URL; the renderer derives the embed URL
  caption: str(240),
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
  z.object({ ...base, type: z.literal('sizeTable'), props: sizeTablePropsSchema }),
  z.object({ ...base, type: z.literal('testimonials'), props: testimonialsPropsSchema }),
  z.object({ ...base, type: z.literal('videoEmbed'), props: videoEmbedPropsSchema }),
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
export type SizeTableProps = z.infer<typeof sizeTablePropsSchema>;
export type TestimonialsProps = z.infer<typeof testimonialsPropsSchema>;
export type VideoEmbedProps = z.infer<typeof videoEmbedPropsSchema>;

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
