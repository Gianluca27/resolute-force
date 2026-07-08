import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { PageDesignDoc, PageSection } from '@resolute/shared';
import { adminApi } from '../../../lib/adminApi';
import { useProducts, useDrop, useContent } from '../../../hooks/useCatalog';
import Nav from '../../../components/Nav';
import Footer from '../../../components/Footer';
import ThemeStyle from '../../../components/ThemeStyle';
import SectionsRenderer, { computeAnchors, navLinks } from '../../../components/sections/SectionsRenderer';
import { BLOCK_LABELS, elementLabel } from './blockDefs';

// Rendered inside the designer's iframe. The editor pushes the draft doc via
// postMessage on every change; the initial fetch covers a direct load. Cart,
// checkout and links are inert here — this is a visual preview, not the store.
// Each section is wrapped in a hit target: hover shows its name, click tells
// the editor to open its form (rf-section-click), and the editor's selection
// comes back as rf-select (outline + scroll into view).
//
// Element canvas: with a section selected, its [data-rf-el] children become
// draggable. Drags update the CSS vars locally for live feedback and commit a
// single rf-el-move/rf-el-resize to the editor on pointerup (one undo step per
// gesture). Arrow keys nudge the selected element; Escape deselects.

const HIT_CSS = `
[data-rf-section]{position:relative;cursor:pointer}
[data-rf-section]:hover{outline:2px dashed rgb(var(--rf-secondary)/.75);outline-offset:-2px}
[data-rf-section]:hover::after{content:attr(data-rf-label);position:absolute;top:10px;left:10px;z-index:40;
  background:rgb(var(--rf-secondary));color:#111;font:700 11px/1 var(--rf-font-display),sans-serif;
  letter-spacing:.12em;text-transform:uppercase;padding:5px 8px;border-radius:2px;pointer-events:none}
[data-rf-section][data-rf-selected]{outline:2px solid rgb(var(--rf-secondary));outline-offset:-2px}
[data-rf-section][data-rf-selected] [data-rf-el]{cursor:grab}
[data-rf-section][data-rf-selected] [data-rf-el]:hover{outline:1px dashed rgb(var(--rf-secondary)/.7);outline-offset:2px}
[data-rf-section][data-rf-dragging]{outline:1px dashed rgb(var(--rf-secondary)/.9);outline-offset:-1px}
[data-rf-section][data-rf-dragging] [data-rf-el]{cursor:grabbing}
body[data-rf-gesture]{user-select:none;-webkit-user-select:none}
`;

interface SelEl { id: string; key: string }

const NUDGE = (e: KeyboardEvent): { x: number; y: number } | null => {
  const step = e.shiftKey ? 10 : 1;
  switch (e.key) {
    case 'ArrowLeft': return { x: -step, y: 0 };
    case 'ArrowRight': return { x: step, y: 0 };
    case 'ArrowUp': return { x: 0, y: -step };
    case 'ArrowDown': return { x: 0, y: step };
    default: return null;
  }
};

function findElNode(sel: SelEl): HTMLElement | null {
  return document.querySelector(`[data-rf-section="${sel.id}"] [data-rf-el="${sel.key}"]`);
}

/** Outline + name chip + width handle over the selected element. */
function ElementOverlay({ sel, onResizeEnd, tick }: {
  sel: SelEl;
  onResizeEnd: (w: number) => void;
  tick: () => void;
}) {
  const node = findElNode(sel);
  if (!node) return null;
  const r = node.getBoundingClientRect();
  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const baseW = r.width;
    document.body.setAttribute('data-rf-gesture', '');
    const onMove = (ev: PointerEvent) => {
      const w = Math.max(40, Math.round(baseW + (ev.clientX - startX)));
      node.classList.add('rf-el-w');
      node.style.setProperty('--el-w', `${w}px`);
      tick();
    };
    const onUp = (ev: PointerEvent) => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.body.removeAttribute('data-rf-gesture');
      onResizeEnd(Math.max(40, Math.round(baseW + (ev.clientX - startX))));
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  };
  return (
    <div style={{ position: 'fixed', top: r.top - 2, left: r.left - 2, width: r.width + 4, height: r.height + 4, zIndex: 50, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', inset: 0, outline: '2px solid rgb(var(--rf-secondary))', borderRadius: 2 }} />
      <div style={{
        position: 'absolute', top: -22, left: 0, background: 'rgb(var(--rf-secondary))', color: '#111',
        font: '700 11px/1 var(--rf-font-display),sans-serif', letterSpacing: '.12em', textTransform: 'uppercase',
        padding: '4px 7px', borderRadius: 2, whiteSpace: 'nowrap',
      }}>{elementLabel(sel.key)}</div>
      <div role="separator" aria-label="Cambiar ancho" onPointerDown={startResize} style={{
        position: 'absolute', right: -5, top: '50%', transform: 'translateY(-50%)', width: 10, height: 28,
        background: 'rgb(var(--rf-secondary))', borderRadius: 3, cursor: 'ew-resize', pointerEvents: 'auto',
      }} />
    </div>
  );
}

export default function DesignPreview() {
  const [doc, setDoc] = useState<PageDesignDoc | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selEl, setSelEl] = useState<SelEl | null>(null);
  const [, setTickState] = useState(0);
  const tick = () => setTickState((t) => t + 1);
  const products = useProducts();
  const drop = useDrop();
  const content = useContent();
  const docRef = useRef(doc);
  docRef.current = doc;

  const post = (msg: unknown) => window.parent.postMessage(msg, window.location.origin);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const data = e.data as { type?: string; doc?: PageDesignDoc; id?: string | null };
      if (data?.type === 'rf-design-doc' && data.doc) setDoc(data.doc);
      if (data?.type === 'rf-select') {
        setSelectedId(data.id ?? null);
        setSelEl((cur) => (cur && cur.id === data.id ? cur : null));
      }
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

  // Nudge/deselect the selected element. Depends on selEl/doc so the base
  // offsets are always read from the current draft.
  useEffect(() => {
    if (!selEl) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setSelEl(null); return; }
      if (e.ctrlKey || e.metaKey) return;
      const d = NUDGE(e);
      if (!d) return;
      e.preventDefault();
      const section = docRef.current?.sections.find((s) => s.id === selEl.id);
      const base = section?.layout?.[selEl.key] ?? { dx: 0, dy: 0 };
      post({ type: 'rf-el-move', id: selEl.id, key: selEl.key, dx: base.dx + d.x, dy: base.dy + d.y });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selEl]);

  // Keep the overlay glued to its element through scroll and viewport changes.
  useEffect(() => {
    if (!selEl) return;
    const onAny = () => tick();
    window.addEventListener('scroll', onAny, true);
    window.addEventListener('resize', onAny);
    return () => { window.removeEventListener('scroll', onAny, true); window.removeEventListener('resize', onAny); };
  }, [selEl]);

  useEffect(() => {
    if (!selectedId) return;
    // 'nearest': no jump when the section is already in view (e.g. it was just clicked).
    document.querySelector(`[data-rf-section="${selectedId}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selectedId]);

  if (!doc || !content.data) return <div className="min-h-screen bg-bg" />;

  const startElDrag = (e: React.PointerEvent, s: PageSection) => {
    if (s.id !== selectedId || e.button !== 0) return;
    const target = (e.target as HTMLElement).closest('[data-rf-el]') as HTMLElement | null;
    if (!target) return;
    const key = target.getAttribute('data-rf-el')!;
    const base = s.layout?.[key] ?? { dx: 0, dy: 0 };
    const wrapEl = e.currentTarget as HTMLElement;
    const startX = e.clientX, startY = e.clientY;
    let moved = false;
    const onMove = (ev: PointerEvent) => {
      const ddx = ev.clientX - startX, ddy = ev.clientY - startY;
      if (!moved && Math.hypot(ddx, ddy) < 4) return;
      moved = true;
      wrapEl.setAttribute('data-rf-dragging', '');
      document.body.setAttribute('data-rf-gesture', '');
      target.style.setProperty('--el-dx', `${base.dx + ddx}px`);
      target.style.setProperty('--el-dy', `${base.dy + ddy}px`);
      tick();
    };
    const onUp = (ev: PointerEvent) => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      wrapEl.removeAttribute('data-rf-dragging');
      document.body.removeAttribute('data-rf-gesture');
      if (moved) post({ type: 'rf-el-move', id: s.id, key, dx: base.dx + (ev.clientX - startX), dy: base.dy + (ev.clientY - startY) });
      setSelEl({ id: s.id, key });
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    e.preventDefault();
  };

  const wrap = (s: PageSection, node: ReactNode) => (
    <div data-rf-section={s.id} data-rf-label={BLOCK_LABELS[s.type]}
      data-rf-selected={s.id === selectedId ? '' : undefined}
      onPointerDown={(e) => startElDrag(e, s)}
      onClickCapture={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const elNode = (e.target as HTMLElement).closest('[data-rf-el]');
        if (s.id === selectedId && elNode) {
          // Element click: select it here; drags are handled at pointerup.
          setSelEl({ id: s.id, key: elNode.getAttribute('data-rf-el')! });
          return;
        }
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
      {selEl && (
        <ElementOverlay key={`${selEl.id}:${selEl.key}`} sel={selEl} tick={tick}
          onResizeEnd={(w) => post({ type: 'rf-el-resize', id: selEl.id, key: selEl.key, w })} />
      )}
    </div>
  );
}
