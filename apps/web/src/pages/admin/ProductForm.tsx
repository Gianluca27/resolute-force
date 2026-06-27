import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { SIZES } from '@resolute/shared';
import type { ProductInput } from '@resolute/shared';
import { adminApi } from '../../lib/adminApi';

const inputCls = 'bg-card border border-line2 rounded-[3px] text-tx px-[14px] py-[12px] outline-none focus:border-gold';

export default function ProductForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const [form, setForm] = useState<ProductInput>({ slug: '', line: '', color: '', dotColor: '#101013', tag: null, price: 0, active: true, sortOrder: 0, sizes: SIZES.map((size) => ({ size, stock: 0 })) });
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    adminApi.products().then((all) => { const p = all.find((x) => x.id === id); if (p) setForm({ slug: p.slug, line: p.line, color: p.color, dotColor: p.dotColor, tag: p.tag, price: p.price, active: p.active, sortOrder: p.sortOrder, sizes: SIZES.map((size) => ({ size, stock: p.sizes.find((s) => s.size === size)?.stock ?? 0 })) }); }).catch(() => {});
  }, [id]);

  const toInt = (v: string) => Math.max(0, Math.trunc(Number(v) || 0)); // enforce the int-only, non-negative contract
  function setStock(size: string, stock: number) { setForm((f) => ({ ...f, sizes: f.sizes.map((s) => (s.size === size ? { ...s, stock } : s)) })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null); setBusy(true);
    try {
      const saved = id ? await adminApi.updateProduct(id, form) : await adminApi.createProduct(form);
      if (file) await adminApi.uploadImage(saved.id, file);
      nav('/admin/productos');
    } catch (e) { setErr(e instanceof Error ? e.message : 'Error'); } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 max-w-[560px]">
      <h1 className="font-display font-black text-[30px] uppercase">{id ? 'Editar' : 'Nuevo'} producto</h1>
      {err && <div className="text-red text-[13px] uppercase font-display">{err}</div>}
      <input className={inputCls} placeholder="Slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
      <input className={inputCls} placeholder="Línea" value={form.line} onChange={(e) => setForm({ ...form, line: e.target.value })} />
      <input className={inputCls} placeholder="Color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
      <div className="flex gap-3">
        <input className={`${inputCls} flex-1`} placeholder="Tag (opcional)" value={form.tag ?? ''} onChange={(e) => setForm({ ...form, tag: e.target.value || null })} />
        <input className={`${inputCls} w-[120px]`} type="color" value={form.dotColor} onChange={(e) => setForm({ ...form, dotColor: e.target.value })} />
      </div>
      <input className={inputCls} type="number" min={0} step={1} placeholder="Precio (ARS)" value={form.price || ''} onChange={(e) => setForm({ ...form, price: toInt(e.target.value) })} />
      <div className="grid grid-cols-4 gap-2">
        {form.sizes.map((s) => (
          <label key={s.size} className="flex flex-col gap-1 text-mut text-[12px] font-display uppercase">{s.size}
            <input aria-label={`stock-${s.size}`} className={inputCls} type="number" min={0} step={1} value={s.stock} onChange={(e) => setStock(s.size, toInt(e.target.value))} />
          </label>
        ))}
      </div>
      <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Activo</label>
      <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-mut text-[13px]" />
      <button disabled={busy} className="bg-red text-white border-0 rounded-[2px] p-[14px] font-display font-bold tracking-[0.13em] uppercase hover:bg-redd disabled:opacity-60">Guardar</button>
    </form>
  );
}
