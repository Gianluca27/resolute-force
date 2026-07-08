import { useRef, useState } from 'react';
import type {
  PageSection, SectionStyle, HeroProps, MarqueeProps, ManifiestoProps, ProductsProps,
  HistoriaProps, ContactoProps, TextImageProps, CtaBannerProps, GalleryProps, FaqProps,
  SizeTableProps, TestimonialsProps, VideoEmbedProps,
} from '@resolute/shared';
import { videoEmbedUrl } from '../../../lib/videoEmbed';
import { Link } from 'react-router-dom';
import { adminApi } from '../../../lib/adminApi';
import { useDesigner } from '../../../store/designer';
import { TextField, TextAreaField, ColorField, Segmented, ImageField, ItemRow, moveItem, btnCls, inputCls } from './fields';
import { IconUp, IconDown, IconTrash } from './icons';

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
      {p.images.length === 0 && (
        <div className="text-mut text-[12px] border border-dashed border-line rounded-[3px] p-3 text-center">
          Sin imágenes todavía. La sección no se muestra hasta que subas al menos una.
        </div>
      )}
      {p.images.map((img, i) => (
        <div key={i} className="flex items-center gap-2 border border-line rounded-[3px] bg-panel p-2">
          <img src={img.url} alt={img.alt} className="w-12 h-12 shrink-0 rounded-[2px] object-cover border border-line2" />
          <input className={inputCls} value={img.alt} placeholder="Descripción (texto alternativo)"
            onChange={(e) => patch({ images: p.images.map((x, j) => j === i ? { ...x, alt: e.target.value } : x) })} />
          <div className="flex flex-col">
            <button type="button" aria-label="Subir imagen en el orden" disabled={i === 0}
              className="bg-transparent border-0 cursor-pointer text-mut hover:text-tx p-[2px] disabled:opacity-30"
              onClick={() => patch({ images: moveItem(p.images, i, i - 1) })}><IconUp size={13} /></button>
            <button type="button" aria-label="Bajar imagen en el orden" disabled={i === p.images.length - 1}
              className="bg-transparent border-0 cursor-pointer text-mut hover:text-tx p-[2px] disabled:opacity-30"
              onClick={() => patch({ images: moveItem(p.images, i, i + 1) })}><IconDown size={13} /></button>
          </div>
          <button type="button" aria-label="Quitar imagen" className="bg-transparent border-0 cursor-pointer text-mut hover:text-red p-1"
            onClick={() => patch({ images: p.images.filter((_, j) => j !== i) })}><IconTrash size={14} /></button>
        </div>
      ))}
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

function SizeTableForm({ p, patch }: { p: SizeTableProps; patch: Patch<SizeTableProps> }) {
  const setCell = (r: number, c: number, v: string) =>
    patch({ rows: p.rows.map((row, i) => i === r ? row.map((cell, j) => j === c ? v : cell) : row) });
  const setCol = (c: number, v: string) => patch({ columns: p.columns.map((col, j) => j === c ? v : col) });
  const cellCls = `${inputCls} px-2 py-[6px] text-[13px]`;
  return (<>
    <TextField label="Kicker" value={p.kicker} onChange={(v) => patch({ kicker: v })} />
    <TextField label="Título" value={p.title} onChange={(v) => patch({ title: v })} />
    <div className="flex flex-col gap-2">
      <span className="text-mut text-[11px] font-display font-semibold tracking-[0.14em] uppercase">Tabla ({p.rows.length}/12 filas)</span>
      <div className="overflow-x-auto">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex gap-1">
            {p.columns.map((col, c) => (
              <div key={c} className="flex-1 min-w-[72px] flex items-center gap-1">
                <input className={`${cellCls} font-display font-bold uppercase`} value={col} aria-label={`Columna ${c + 1}`}
                  onChange={(e) => setCol(c, e.target.value)} />
                {p.columns.length > 1 && (
                  <button type="button" aria-label={`Quitar columna ${c + 1}`} className="bg-transparent border-0 cursor-pointer text-mut hover:text-red p-0 shrink-0"
                    onClick={() => patch({ columns: p.columns.filter((_, j) => j !== c), rows: p.rows.map((r) => r.filter((_, j) => j !== c)) })}>
                    <IconTrash size={12} />
                  </button>
                )}
              </div>
            ))}
            <div className="w-[22px] shrink-0" />
          </div>
          {p.rows.map((row, r) => (
            <div key={r} className="flex gap-1">
              {row.map((cell, c) => (
                <div key={c} className="flex-1 min-w-[72px]">
                  <input className={cellCls} value={cell} aria-label={`Fila ${r + 1}, columna ${c + 1}`} onChange={(e) => setCell(r, c, e.target.value)} />
                </div>
              ))}
              <button type="button" aria-label={`Quitar fila ${r + 1}`} className="w-[22px] shrink-0 bg-transparent border-0 cursor-pointer text-mut hover:text-red p-0"
                onClick={() => patch({ rows: p.rows.filter((_, j) => j !== r) })}><IconTrash size={13} /></button>
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        {p.rows.length < 12 && (
          <button type="button" className={btnCls} onClick={() => patch({ rows: [...p.rows, p.columns.map(() => '')] })}>+ Fila</button>
        )}
        {p.columns.length < 6 && (
          <button type="button" className={btnCls}
            onClick={() => patch({ columns: [...p.columns, ''], rows: p.rows.map((r) => [...r, '']) })}>+ Columna</button>
        )}
      </div>
    </div>
    <TextAreaField label="Nota al pie" rows={2} value={p.note} onChange={(v) => patch({ note: v })} />
  </>);
}

function TestimonialsForm({ p, patch }: { p: TestimonialsProps; patch: Patch<TestimonialsProps> }) {
  return (<>
    <TextField label="Kicker" value={p.kicker} onChange={(v) => patch({ kicker: v })} />
    <TextField label="Título" value={p.title} onChange={(v) => patch({ title: v })} />
    <div className="flex flex-col gap-2">
      <span className="text-mut text-[11px] font-display font-semibold tracking-[0.14em] uppercase">Testimonios ({p.items.length}/9)</span>
      {p.items.map((t, i) => (
        <ItemRow key={i}
          onRemove={() => p.items.length > 1 && patch({ items: p.items.filter((_, j) => j !== i) })}
          onUp={() => patch({ items: moveItem(p.items, i, i - 1) })}
          onDown={() => patch({ items: moveItem(p.items, i, i + 1) })}>
          <TextAreaField label={`Cita ${i + 1}`} rows={2} value={t.quote} onChange={(v) => patch({ items: p.items.map((x, j) => j === i ? { ...x, quote: v } : x) })} />
          <div className="grid grid-cols-2 gap-2">
            <TextField label="Nombre" value={t.name} onChange={(v) => patch({ items: p.items.map((x, j) => j === i ? { ...x, name: v } : x) })} />
            <TextField label="Detalle (ciudad, deporte…)" value={t.detail} onChange={(v) => patch({ items: p.items.map((x, j) => j === i ? { ...x, detail: v } : x) })} />
          </div>
          <ImageField label="Foto (opcional)" value={t.imageUrl ?? ''}
            onChange={(url, publicId) => patch({ items: p.items.map((x, j) => j === i ? { ...x, imageUrl: url, imagePublicId: publicId } : x) })} />
        </ItemRow>
      ))}
      {p.items.length < 9 && (
        <button type="button" className={btnCls} onClick={() => patch({ items: [...p.items, { quote: 'Nuevo testimonio', name: 'Nombre', detail: '' }] })}>+ Agregar testimonio</button>
      )}
    </div>
  </>);
}

function VideoEmbedForm({ p, patch }: { p: VideoEmbedProps; patch: Patch<VideoEmbedProps> }) {
  const unrecognized = p.url.trim() !== '' && !videoEmbedUrl(p.url);
  return (<>
    <TextField label="Kicker" value={p.kicker} onChange={(v) => patch({ kicker: v })} />
    <TextField label="Título" value={p.title} onChange={(v) => patch({ title: v })} />
    <TextField label="Link del video (YouTube o Vimeo)" value={p.url} onChange={(v) => patch({ url: v })}
      placeholder="https://www.youtube.com/watch?v=…" />
    {unrecognized && (
      <p className="text-red text-[12px] m-0">No se reconoce ese link. Pegá la URL del video en YouTube (watch, shorts o youtu.be) o Vimeo.</p>
    )}
    {!p.url.trim() && (
      <p className="text-mut text-[12px] m-0">Sin link, la sección no se muestra en la página.</p>
    )}
    <TextAreaField label="Epígrafe (opcional)" rows={2} value={p.caption} onChange={(v) => patch({ caption: v })} />
  </>);
}

// Blocks whose markup honors style.align (see shell.sectionOverrides).
const ALIGNABLE = new Set<PageSection['type']>(['gallery', 'faq', 'sizeTable', 'testimonials', 'videoEmbed']);

function StyleEditor({ type, style, onChange }: { type: PageSection['type']; style: SectionStyle | undefined; onChange: (s: SectionStyle) => void }) {
  const s: SectionStyle = style ?? { background: 'default', paddingY: 'default', align: 'default' };
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
        {ALIGNABLE.has(type) && (
          <Segmented label="Alineación del texto" value={s.align ?? 'default'} onChange={(v) => onChange({ ...s, align: v })}
            options={[{ value: 'default', label: 'Original' }, { value: 'center', label: 'Centrado' }]} />
        )}
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
      case 'sizeTable': return <SizeTableForm p={section.props} patch={patchProps} />;
      case 'testimonials': return <TestimonialsForm p={section.props} patch={patchProps} />;
      case 'videoEmbed': return <VideoEmbedForm p={section.props} patch={patchProps} />;
      default: return null;
    }
  })();

  return (
    <div className="flex flex-col gap-3">
      {form}
      {section.type !== 'marquee' && <StyleEditor type={section.type} style={section.style} onChange={patchStyle} />}
    </div>
  );
}
