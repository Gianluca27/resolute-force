import { Fragment, type ReactNode } from 'react';
import type { ContentDTO, DropDTO, PageDesignDoc, PageSection, ProductDTO } from '@resolute/shared';
import Marquee from '../Marquee';
import Hero from '../Hero';
import Manifiesto from '../Manifiesto';
import Productos from '../Productos';
import Historia from '../Historia';
import Proximos from '../Proximos';
import Contacto from '../Contacto';
import TextImage from './TextImage';
import CtaBanner from './CtaBanner';
import Gallery from './Gallery';
import Faq from './Faq';

export interface RenderCtx {
  products: ProductDTO[];
  drop?: DropDTO;
  content: ContentDTO;
  onAdd: (p: ProductDTO, size: string) => void;
  anchors: Partial<Record<'products' | 'manifiesto', string>>;
}

/** First visible instance of the types other sections link to. */
export function computeAnchors(doc: PageDesignDoc): RenderCtx['anchors'] {
  const anchors: RenderCtx['anchors'] = {};
  for (const s of doc.sections) {
    if (!s.visible) continue;
    if (s.type === 'products' && !anchors.products) anchors.products = s.id;
    if (s.type === 'manifiesto' && !anchors.manifiesto) anchors.manifiesto = s.id;
  }
  return anchors;
}

const NAV_LABELS: Partial<Record<PageSection['type'], string>> = {
  products: 'Productos', manifiesto: 'Manifiesto', historia: 'Historia', contacto: 'Contacto',
};

/** Nav links derived from the doc: first visible instance of each labeled type, in page order. */
export function navLinks(doc: PageDesignDoc): Array<{ href: string; label: string }> {
  const seen = new Set<string>();
  const links: Array<{ href: string; label: string }> = [];
  for (const s of doc.sections) {
    const label = NAV_LABELS[s.type];
    if (!s.visible || !label || seen.has(s.type)) continue;
    seen.add(s.type);
    links.push({ href: `#${s.id}`, label });
  }
  return links;
}

function renderSection(s: PageSection, ctx: RenderCtx): ReactNode {
  switch (s.type) {
    case 'marquee': return <Marquee items={s.props.items} />;
    case 'hero': return <Hero id={s.id} props={s.props} sectionStyle={s.style} anchors={ctx.anchors} />;
    case 'manifiesto': return <Manifiesto id={s.id} props={s.props} sectionStyle={s.style} />;
    case 'products': return <Productos id={s.id} props={s.props} sectionStyle={s.style} products={ctx.products} onAdd={ctx.onAdd} transferDiscountPct={ctx.content.transferDiscountPct} />;
    case 'historia': return <Historia id={s.id} props={s.props} sectionStyle={s.style} />;
    case 'countdown': return ctx.drop ? <Proximos id={s.id} drop={ctx.drop} sectionStyle={s.style} /> : null;
    case 'contacto': return <Contacto id={s.id} props={s.props} sectionStyle={s.style} content={ctx.content} />;
    case 'textImage': return <TextImage id={s.id} props={s.props} sectionStyle={s.style} />;
    case 'ctaBanner': return <CtaBanner id={s.id} props={s.props} sectionStyle={s.style} />;
    case 'gallery': return <Gallery id={s.id} props={s.props} sectionStyle={s.style} />;
    case 'faq': return <Faq id={s.id} props={s.props} sectionStyle={s.style} />;
    default: return null; // unknown type from a newer/older doc version — skip, never crash
  }
}

/**
 * Renders the page from a design doc. `nav` is injected by the caller (cart
 * wiring differs between landing and preview). A marquee in first position
 * renders above the nav, matching the classic layout. `wrap` lets the design
 * preview decorate each section (hit-target + highlight) without touching the
 * public landing markup.
 */
export default function SectionsRenderer({ doc, ctx, nav, wrap }: {
  doc: PageDesignDoc;
  ctx: RenderCtx;
  nav?: ReactNode;
  wrap?: (section: PageSection, node: ReactNode) => ReactNode;
}) {
  const sections = doc.sections.filter((s) => s.visible);
  const marqueeFirst = sections[0]?.type === 'marquee' ? sections[0] : null;
  const rest = marqueeFirst ? sections.slice(1) : sections;
  const render = (s: PageSection): ReactNode => wrap ? wrap(s, renderSection(s, ctx)) : renderSection(s, ctx);
  return (
    <>
      {marqueeFirst && <Fragment key={marqueeFirst.id}>{render(marqueeFirst)}</Fragment>}
      {nav}
      {rest.map((s) => <Fragment key={s.id}>{render(s)}</Fragment>)}
    </>
  );
}
