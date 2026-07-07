import { useEffect, useState } from 'react';
import type { PageDesignDoc } from '@resolute/shared';
import { adminApi } from '../../../lib/adminApi';
import { useProducts, useDrop, useContent } from '../../../hooks/useCatalog';
import Nav from '../../../components/Nav';
import Footer from '../../../components/Footer';
import ThemeStyle from '../../../components/ThemeStyle';
import SectionsRenderer, { computeAnchors, navLinks } from '../../../components/sections/SectionsRenderer';

// Rendered inside the designer's iframe. The editor pushes the draft doc via
// postMessage on every change; the initial fetch covers a direct load. Cart and
// checkout are inert here — this is a visual preview, not the store.

export default function DesignPreview() {
  const [doc, setDoc] = useState<PageDesignDoc | null>(null);
  const products = useProducts();
  const drop = useDrop();
  const content = useContent();

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const data = e.data as { type?: string; doc?: PageDesignDoc };
      if (data?.type === 'rf-design-doc' && data.doc) setDoc(data.doc);
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({ type: 'rf-preview-ready' }, window.location.origin);
    adminApi.getPageDesign().then((r) => setDoc((d) => d ?? r.draft)).catch(() => {});
    return () => window.removeEventListener('message', onMsg);
  }, []);

  if (!doc || !content.data) return <div className="min-h-screen bg-bg" />;

  return (
    <div className="bg-bg text-tx font-body min-h-screen relative overflow-x-hidden">
      <ThemeStyle theme={doc.theme} />
      <SectionsRenderer
        doc={doc}
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
