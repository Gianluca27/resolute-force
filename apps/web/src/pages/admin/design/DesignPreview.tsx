import { useEffect, useState, type ReactNode } from 'react';
import type { PageDesignDoc, PageSection } from '@resolute/shared';
import { adminApi } from '../../../lib/adminApi';
import { useProducts, useDrop, useContent } from '../../../hooks/useCatalog';
import Nav from '../../../components/Nav';
import Footer from '../../../components/Footer';
import ThemeStyle from '../../../components/ThemeStyle';
import SectionsRenderer, { computeAnchors, navLinks } from '../../../components/sections/SectionsRenderer';
import { BLOCK_LABELS } from './blockDefs';

// Rendered inside the designer's iframe. The editor pushes the draft doc via
// postMessage on every change; the initial fetch covers a direct load. Cart,
// checkout and links are inert here — this is a visual preview, not the store.
// Each section is wrapped in a hit target: hover shows its name, click tells
// the editor to open its form (rf-section-click), and the editor's selection
// comes back as rf-select (outline + scroll into view).

const HIT_CSS = `
[data-rf-section]{position:relative;cursor:pointer}
[data-rf-section]:hover{outline:2px dashed rgb(var(--rf-secondary)/.75);outline-offset:-2px}
[data-rf-section]:hover::after{content:attr(data-rf-label);position:absolute;top:10px;left:10px;z-index:40;
  background:rgb(var(--rf-secondary));color:#111;font:700 11px/1 var(--rf-font-display),sans-serif;
  letter-spacing:.12em;text-transform:uppercase;padding:5px 8px;border-radius:2px;pointer-events:none}
[data-rf-section][data-rf-selected]{outline:2px solid rgb(var(--rf-secondary));outline-offset:-2px}
`;

export default function DesignPreview() {
  const [doc, setDoc] = useState<PageDesignDoc | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const products = useProducts();
  const drop = useDrop();
  const content = useContent();

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const data = e.data as { type?: string; doc?: PageDesignDoc; id?: string | null };
      if (data?.type === 'rf-design-doc' && data.doc) setDoc(data.doc);
      if (data?.type === 'rf-select') setSelectedId(data.id ?? null);
    };
    // The iframe swallows keyboard focus — forward undo/redo to the editor.
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k !== 'z' && k !== 'y') return;
      e.preventDefault();
      const type = k === 'y' || e.shiftKey ? 'rf-redo' : 'rf-undo';
      window.parent.postMessage({ type }, window.location.origin);
    };
    window.addEventListener('message', onMsg);
    window.addEventListener('keydown', onKey);
    window.parent.postMessage({ type: 'rf-preview-ready' }, window.location.origin);
    adminApi.getPageDesign().then((r) => setDoc((d) => d ?? r.draft)).catch(() => {});
    return () => { window.removeEventListener('message', onMsg); window.removeEventListener('keydown', onKey); };
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    // 'nearest': no jump when the section is already in view (e.g. it was just clicked).
    document.querySelector(`[data-rf-section="${selectedId}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selectedId]);

  if (!doc || !content.data) return <div className="min-h-screen bg-bg" />;

  const wrap = (s: PageSection, node: ReactNode) => (
    <div data-rf-section={s.id} data-rf-label={BLOCK_LABELS[s.type]}
      data-rf-selected={s.id === selectedId ? '' : undefined}
      onClickCapture={(e) => {
        e.preventDefault();
        e.stopPropagation();
        window.parent.postMessage({ type: 'rf-section-click', id: s.id }, window.location.origin);
      }}>
      {node}
    </div>
  );

  return (
    <div className="bg-bg text-tx font-body min-h-screen relative overflow-x-hidden">
      <ThemeStyle theme={doc.theme} />
      <style>{HIT_CSS}</style>
      <SectionsRenderer
        doc={doc}
        wrap={wrap}
        nav={<Nav cartCount={0} onOpenCart={() => {}} links={navLinks(doc)} />}
        ctx={{
          products: products.data ?? [],
          drop: drop.data,
          content: content.data,
          onAdd: () => {},
          anchors: computeAnchors(doc),
        }}
      />
      <Footer contactWhatsapp={content.data.contactWhatsapp} contactInstagram={content.data.contactInstagram} />
    </div>
  );
}
