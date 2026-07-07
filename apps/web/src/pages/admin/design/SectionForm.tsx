import { useRef, useState } from 'react';
import type {
  PageSection, SectionStyle, HeroProps, MarqueeProps, ManifiestoProps, ProductsProps,
  HistoriaProps, ContactoProps, TextImageProps, CtaBannerProps, GalleryProps, FaqProps,
} from '@resolute/shared';
import { Link } from 'react-router-dom';
import { adminApi } from '../../../lib/adminApi';
import { useDesigner } from '../../../store/designer';
import { TextField, TextAreaField, ColorField, Segmented, ImageField, ItemRow, moveItem, btnCls, inputCls } from './fields';

// Every form edits its section through the designer store; `patch` merges into
// the section's props and triggers the debounced autosave.

type Patch<P> = (u: Partial<P>) => void;

function linesEditor(value: string[], max: number, onChange: (v: string[]) => void) {
  return (
    <textarea
      className={inputCls}
      rows={Math.min(6, Math.max(3, value.length + 1))}
      value={value.join('\n')}
      onChange={(e) => onChange(e.target.value.split('\n').slice(0, max))}
    />
  );
}

function MarqueeForm({ p, patch }: { p: MarqueeProps; patch: Patch<MarqueeProps> }) {
  return (
    <div className="flex flex-col gap-[6px]">
      <span className="text-mut text-[11px] font-display font-semibold tracking-[0.14em] uppercase">Frases (una por línea)</span>
      {linesEditor(p.items, 12, (items) => patch({ items: items.filter(Boolean).length ? items : p.items }))}
    </div>
  );
}

function HeroForm({ p, patch }: { p: HeroProps; patch: Patch<HeroProps> }) {
  return (<>
    <TextField label="Kicker" value={p.kicker} onChange={(v) => patch({ kicker: v })} />
    <TextField label="Título línea 1" value={p.title1} onChange={(v) => patch({ title1: v })} />
    <TextField label="Título línea 2 (color de acento)" value={p.title2} onChange={(v) => patch({ title2: v })} />
    <TextAreaField label="Subtítulo" value={p.subtitle} onChange={(v) => patch({ subtitle: v })} />
    <TextField label="Remate del subtítulo (resaltado)" value={p.subtitleHighlight} onChange={(v) => patch({ subtitleHighlight: v })} />
    <TextField label="Botón principal (vacío = oculto)" value={p.ctaPrimary} onChange={(v) => patch({ ctaPrimary: v })} />
    <TextField label="Botón secundario (vacío = oculto)" value={p.ctaSecondary} onChange={(v) => patch({ ctaSecondary: v })} />
    <div className="flex flex-col gap-[6px]">
      <span className="text-mut text-[11px] font-display font-semibold tracking-[0.14em] uppercase">Badges (una por línea, máx. 4)</span>
      {linesEditor(p.badges, 4, (badges) => patch({ badges }))}
    </div>
  </>);
}

function ManifiestoForm({ p, patch }: { p: ManifiestoProps; patch: Patch<ManifiestoProps> }) {
  return (<>
    <TextField label="Kicker" value={p.kicker} onChange={(v) => patch({ kicker: v })} />
    <TextField label="Título" value={p.title} onChange={(v) => patch({ title: v })} />
    <TextField label="Título (parte acentuada)" value={p.titleAccent} onChange={(v) => patch({ titleAccent: v })} />
    <TextAreaField label="Texto" value={p.body} onChange={(v) => patch({ body: v })} />
    <TextField label="Remate del texto (resaltado)" value={p.bodyHighlight} onChange={(v) => patch({ bodyHighlight: v })} />
    <ImageField label="Imagen" value={p.imageUrl} onChange={(url, publicId) => patch({ imageUrl: url, imagePublicId: publicId })} />
    <TextField label="Etiqueta sobre la imagen" value={p.imageBadge} onChange={(v) => patch({ imageBadge: v })} />
    <div className="flex flex-col gap-2">
      <span className="text-mut text-[11px] font-display font-semibold tracking-[0.14em] uppercase">Principios (máx. 5)</span>
      {p.principles.map((pr, i) => (
        <ItemRow key={i}
          onRemove={() => patch({ principles: p.principles.filter((_, j) => j !== i) })}
          onUp={() => patch({ principles: moveItem(p.principles, i, i - 1) })}
          onDown={() => patch({ principles: moveItem(p.principles, i, i + 1) })}>
          <TextField label={`Principio ${i + 1}`} value={pr.title} onChange={(v) => patch({ principles: p.principles.map((x, j) => j === i ? { ...x, title: v } : x) })} />
          <TextField label="Bajada" value={pr.sub} onChange={(v) => patch({ principles: p.principles.map((x, j) => j === i ? { ...x, sub: v } : x) })} />
        </ItemRow>
      ))}
      {p.principles.length < 5 && (
        <button type="button" className={btnCls} onClick={() => patch({ principles: [...p.principles, { title: 'Nuevo principio', sub: '' }] })}>+ Agregar principio</button>
      )}
    </div>
  </>);
}

function ProductsForm({ p, patch }: { p: ProductsProps; patch: Patch<ProductsProps> }) {
  return (<>
    <TextField label="Kicker" value={p.kicker} onChange={(v) => patch({ kicker: v })} />
    <TextField label="Título" value={p.title} onChange={(v) => patch({ title: v })} />
    <TextField label="Título (línea atenuada)" value={p.titleAccent} onChange={(v) => patch({ titleAccent: v })} />
    <TextAreaField label="Descripción" value={p.description} onChange={(v) => patch({ description: v })} />
    <p className="text-mut text-[12px] m-0">Los productos del grid se administran en <Link to="/admin/productos" className="text-gold">Admin → Productos</Link>.</p>
  </>);
}

function HistoriaForm({ p, patch }: { p: HistoriaProps; patch: Patch<HistoriaProps> }) {
  return (<>
    <TextField label="Kicker" value={p.kicker} onChange={(v) => patch({ kicker: v })} />
    <TextAreaField label="Título (cada línea = renglón)" rows={2} value={p.title} onChange={(v) => patch({ title: v })} />
    <TextAreaField label="Texto" value={p.body} onChange={(v) => patch({ body: v })} />
    <TextField label="Remate del texto (resaltado)" value={p.bodyHighlight} onChange={(v) => patch({ bodyHighlight: v })} />
    <ImageField label="Imagen" value={p.imageUrl} onChange={(url, publicId) => patch({ imageUrl: url, imagePublicId: publicId })} />
    <TextField label="Título sobre la imagen" value={p.imageTitle} onChange={(v) => patch({ imageTitle: v })} />
    <TextField label="Bajada sobre la imagen" value={p.imageSubtitle} onChange={(v) => patch({ imageSubtitle: v })} />
    <div className="flex flex-col gap-2">
      <span className="text-mut text-[11px] font-display font-semibold tracking-[0.14em] uppercase">Estadísticas (máx. 4)</span>
      {p.stats.map((st, i) => (
        <ItemRow key={i}
          onRemove={() => patch({ stats: p.stats.filter((_, j) => j !== i) })}
          onUp={() => patch({ stats: moveItem(p.stats, i, i - 1) })}
          onDown={() => patch({ stats: moveItem(p.stats, i, i + 1) })}>
          <div className="grid grid-cols-2 gap-2">
            <TextField label="Valor" value={st.value} onChange={(v) => patch({ stats: p.stats.map((x, j) => j === i ? { ...x, value: v } : x) })} />
            <TextField label="Etiqueta" value={st.label} onChange={(v) => patch({ stats: p.stats.map((x, j) => j === i ? { ...x, label: v } : x) })} />
          </div>
        </ItemRow>
      ))}
      {p.stats.length < 4 && (
        <button type="button" className={btnCls} onClick={() => patch({ stats: [...p.stats, { value: '100%', label: 'Nueva stat' }] })}>+ Agregar stat</button>
      )}
    </div>
  </>);
}

function ContactoForm({ p, patch }: { p: ContactoProps; patch: Patch<ContactoProps> }) {
  return (<>
    <TextField label="Kicker" value={p.kicker} onChange={(v) => patch({ kicker: v })} />
    <TextField label="Título" value={p.title} onChange={(v) => patch({ title: v })} />
    <TextAreaField label="Subtítulo" value={p.subtitle} onChange={(v) => patch({ subtitle: v })} />
    <p className="text-mut text-[12px] m-0">WhatsApp, Instagram, email y ubicación se editan en <Link to="/admin/contenido" className="text-gold">Admin → Contenido</Link> (los usan también el checkout y el footer).</p>
  </>);
}

function TextImageForm({ p, patch }: { p: TextImageProps; patch: Patch<TextImageProps> }) {
  return (<>
    <TextField label="Kicker" value={p.kicker} onChange={(v) => patch({ kicker: v })} />
    <TextField label="Título" value={p.title} onChange={(v) => patch({ title: v })} />
    <TextAreaField label="Texto (cada línea = párrafo)" rows={5} value={p.body} onChange={(v) => patch({ body: v })} />
    <ImageField label="Imagen" value={p.imageUrl} onChange={(url, publicId) => patch({ imageUrl: url, imagePublicId: publicId })} />
    <Segmented label="Imagen a la" value={p.imageSide} onChange={(v) => patch({ imageSide: v })}
      options={[{ value: 'left', label: 'Izquierda' }, { value: 'right', label: 'Derecha' }]} />
    <TextField label="Botón (vacío = oculto)" value={p.ctaLabel} onChange={(v) => patch({ ctaLabel: v })} />
    <TextField label="Link del botón" value={p.ctaHref} onChange={(v) => patch({ ctaHref: v })} placeholder="#productos o https://…" />
  </>);
}

function CtaBannerForm({ p, patch }: { p: CtaBannerProps; patch: Patch<CtaBannerProps> }) {
  return (<>
    <TextField label="Título" value={p.title} onChange={(v) => patch({ title: v })} />
    <TextAreaField label="Subtítulo" value={p.subtitle} onChange={(v) => patch({ subtitle: v })} />
    <TextField label="Botón" value={p.ctaLabel} onChange={(v) => patch({ ctaLabel: v })} />
    <TextField label="Link del botón" value={p.ctaHref} onChange={(v) => patch({ ctaHref: v })} placeholder="#productos o https://…" />
    <Segmented label="Estilo" value={p.variant} onChange={(v) => patch({ variant: v })}
      options={[{ value: 'accent', label: 'Acento' }, { value: 'secondary', label: 'Dorado' }, { value: 'dark', label: 'Oscuro' }, { value: 'image', label: 'Imagen' }]} />
    {p.variant === 'image' && (
      <ImageField label="Imagen de fondo" value={p.imageUrl ?? ''} onChange={(url, publicId) => patch({ imageUrl: url, imagePublicId: publicId })} />
    )}
  </>);
}

function GalleryForm({ p, patch }: { p: GalleryProps; patch: Patch<GalleryProps> }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  return (<>
    <TextField label="Kicker" value={p.kicker} onChange={(v) => patch({ kicker: v })} />
    <TextField label="Título" value={p.title} onChange={(v) => patch({ title: v })} />
    <Segmented label="Columnas" value={String(p.columns) as '2' | '3' | '4'} onChange={(v) => patch({ columns: Number(v) as GalleryProps['columns'] })}
      options={[{ value: '2', label: '2' }, { value: '3', label: '3' }, { value: '4', label: '4' }]} />
    <div className="flex flex-col gap-2">
      <span className="text-mut text-[11px] font-display font-semibold tracking-[0.14em] uppercase">Imágenes ({p.images.length}/24)</span>
      <div className="grid grid-cols-3 gap-2">
        {p.images.map((img, i) => (
          <div key={i} className="relative group border border-line rounded-[3px] overflow-hidden">
            <img src={img.url} alt={img.alt} className="w-full aspect-square object-cover" />
            <div className="absolute inset-x-0 bottom-0 hidden group-hover:flex bg-black/70 justify-between p-1">
              <button type="button" className="text-white text-[12px] px-1 cursor-pointer bg-transparent border-0" onClick={() => patch({ images: moveItem(p.images, i, i - 1) })}>←</button>
              <button type="button" className="text-red text-[12px] px-1 cursor-pointer bg-transparent border-0" onClick={() => patch({ images: p.images.filter((_, j) => j !== i) })}>✕</button>
              <button type="button" className="text-white text-[12px] px-1 cursor-pointer bg-transparent border-0" onClick={() => patch({ images: moveItem(p.images, i, i + 1) })}>→</button>
            </div>
          </div>
        ))}
      </div>
      <button type="button" disabled={busy || p.images.length >= 24} className={btnCls} onClick={() => fileRef.current?.click()}>
        {busy ? 'Subiendo…' : '+ Agregar imágenes'}
      </button>
      {err && <div className="text-red text-[12px]">{err}</div>}
      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={async (e) => {
        const files = [...(e.target.files ?? [])];
        e.target.value = '';
        if (!files.length) return;
        setBusy(true); setErr('');
        try {
          const uploaded: GalleryProps['images'] = [];
          for (const f of files.slice(0, 24 - p.images.length)) {
            const { url, publicId } = await adminApi.uploadAsset(f);
            uploaded.push({ url, publicId, alt: '' });
          }
          patch({ images: [...p.images, ...uploaded] });
        } catch (e2) { setErr(e2 instanceof Error ? e2.message : 'No se pudo subir'); }
        finally { setBusy(false); }
      }} />
    </div>
  </>);
}

function FaqForm({ p, patch }: { p: FaqProps; patch: Patch<FaqProps> }) {
  return (<>
    <TextField label="Kicker" value={p.kicker} onChange={(v) => patch({ kicker: v })} />
    <TextField label="Título" value={p.title} onChange={(v) => patch({ title: v })} />
    <div className="flex flex-col gap-2">
      <span className="text-mut text-[11px] font-display font-semibold tracking-[0.14em] uppercase">Preguntas (máx. 20)</span>
      {p.items.map((it, i) => (
        <ItemRow key={i}
          onRemove={() => p.items.length > 1 && patch({ items: p.items.filter((_, j) => j !== i) })}
          onUp={() => patch({ items: moveItem(p.items, i, i - 1) })}
          onDown={() => patch({ items: moveItem(p.items, i, i + 1) })}>
          <TextField label={`Pregunta ${i + 1}`} value={it.q} onChange={(v) => patch({ items: p.items.map((x, j) => j === i ? { ...x, q: v } : x) })} />
          <TextAreaField label="Respuesta" value={it.a} onChange={(v) => patch({ items: p.items.map((x, j) => j === i ? { ...x, a: v } : x) })} />
        </ItemRow>
      ))}
      {p.items.length < 20 && (
        <button type="button" className={btnCls} onClick={() => patch({ items: [...p.items, { q: 'Nueva pregunta', a: '' }] })}>+ Agregar pregunta</button>
      )}
    </div>
  </>);
}

function StyleEditor({ style, onChange }: { style: SectionStyle | undefined; onChange: (s: SectionStyle) => void }) {
  const s: SectionStyle = style ?? { background: 'default', paddingY: 'default' };
  return (
    <details className="border-t border-line pt-3 mt-1">
      <summary className="cursor-pointer text-mut text-[11px] font-display font-semibold tracking-[0.14em] uppercase">Estilo de la sección</summary>
      <div className="flex flex-col gap-3 mt-3">
        <Segmented label="Fondo" value={s.background} onChange={(v) => onChange({ ...s, background: v })}
          options={[{ value: 'default', label: 'Original' }, { value: 'bg', label: 'Base' }, { value: 'panel', label: 'Panel' }, { value: 'custom', label: 'Custom' }]} />
        {s.background === 'custom' && (
          <ColorField label="Color de fondo" value={s.customBg ?? '#0e0e10'} onChange={(v) => onChange({ ...s, customBg: v })} />
        )}
        <Segmented label="Espaciado vertical" value={s.paddingY} onChange={(v) => onChange({ ...s, paddingY: v })}
          options={[{ value: 'default', label: 'Original' }, { value: 'sm', label: 'Chico' }, { value: 'md', label: 'Medio' }, { value: 'lg', label: 'Grande' }]} />
      </div>
    </details>
  );
}

export default function SectionForm({ section }: { section: PageSection }) {
  const update = useDesigner((st) => st.update);

  const patchProps = (u: Record<string, unknown>) => update((doc) => ({
    ...doc,
    sections: doc.sections.map((s) => s.id === section.id ? { ...s, props: { ...s.props, ...u } } as PageSection : s),
  }));
  const patchStyle = (style: SectionStyle) => update((doc) => ({
    ...doc,
    sections: doc.sections.map((s) => s.id === section.id ? { ...s, style } : s),
  }));

  const form = (() => {
    switch (section.type) {
      case 'marquee': return <MarqueeForm p={section.props} patch={patchProps} />;
      case 'hero': return <HeroForm p={section.props} patch={patchProps} />;
      case 'manifiesto': return <ManifiestoForm p={section.props} patch={patchProps} />;
      case 'products': return <ProductsForm p={section.props} patch={patchProps} />;
      case 'historia': return <HistoriaForm p={section.props} patch={patchProps} />;
      case 'countdown': return <p className="text-mut text-[13px] m-0">La fecha, el título y el teaser del countdown se editan en <Link to="/admin/drop" className="text-gold">Admin → Drop</Link>. Acá podés moverlo, ocultarlo o cambiarle el estilo.</p>;
      case 'contacto': return <ContactoForm p={section.props} patch={patchProps} />;
      case 'textImage': return <TextImageForm p={section.props} patch={patchProps} />;
      case 'ctaBanner': return <CtaBannerForm p={section.props} patch={patchProps} />;
      case 'gallery': return <GalleryForm p={section.props} patch={patchProps} />;
      case 'faq': return <FaqForm p={section.props} patch={patchProps} />;
      default: return null;
    }
  })();

  return (
    <div className="flex flex-col gap-3">
      {form}
      {section.type !== 'marquee' && <StyleEditor style={section.style} onChange={patchStyle} />}
    </div>
  );
}
