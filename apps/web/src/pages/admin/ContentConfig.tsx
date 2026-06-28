import { useEffect, useState } from 'react';
import { adminApi } from '../../lib/adminApi';
import type { ContentDTO } from '@resolute/shared';

const inputCls = 'bg-card border border-line2 rounded-[3px] text-tx px-[14px] py-[12px] outline-none focus:border-gold';

export default function ContentConfig() {
  const [c, setC] = useState<ContentDTO | null>(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => { adminApi.getContent().then(setC).catch(() => setErr('No se pudo cargar el contenido')); }, []);
  if (!c) return <div className="text-mut">{err || 'Cargando…'}</div>;
  const f = (k: keyof ContentDTO) => (e: React.ChangeEvent<HTMLInputElement>) => setC({ ...c, [k]: e.target.value } as ContentDTO);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault(); setErr(''); setMsg('');
        try { setC(await adminApi.putContent(c)); setMsg('Guardado ✓'); } // adopt fresh updatedAt so the next save isn't a false conflict (H-06)
        catch (e2) { setErr(e2 instanceof Error ? e2.message : 'No se pudo guardar'); }
      }}
      className="flex flex-col gap-3 max-w-[560px]"
    >
      <h1 className="font-display font-black text-[30px] uppercase">Contenido del sitio</h1>
      {msg && <div className="text-gold text-[13px] uppercase font-display">{msg}</div>}
      {err && <div className="text-red text-[13px] uppercase font-display">{err}</div>}
      <label className="text-mut text-[12px] uppercase font-display">Marquee (una frase por línea)</label>
      <textarea aria-label="Marquee" className={inputCls} rows={4} value={c.marquee.join('\n')} onChange={(e) => setC({ ...c, marquee: e.target.value.split('\n').filter(Boolean) })} />
      <input aria-label="Hero kicker" className={inputCls} value={c.heroKicker} onChange={f('heroKicker')} placeholder="Hero kicker (Est. 2024 · …)" />
      <input aria-label="Hero línea 1" className={inputCls} value={c.heroTitle1} onChange={f('heroTitle1')} placeholder="Hero línea 1" />
      <input aria-label="Hero línea 2" className={inputCls} value={c.heroTitle2} onChange={f('heroTitle2')} placeholder="Hero línea 2" />
      <input aria-label="Hero subtítulo" className={inputCls} value={c.heroSubtitle} onChange={f('heroSubtitle')} placeholder="Hero subtítulo" />
      <label className="text-mut text-[12px] uppercase font-display">Descuento transferencia (%)</label>
      <input aria-label="Descuento transferencia (%)" className={inputCls} type="number" min={0} max={90} step={1} value={c.transferDiscountPct} onChange={(e) => setC({ ...c, transferDiscountPct: Number(e.target.value) })} />
      <input aria-label="Alias bancario" className={inputCls} value={c.bankAlias} onChange={f('bankAlias')} placeholder="Alias bancario" />
      <input aria-label="CBU" className={inputCls} value={c.bankCbu} onChange={f('bankCbu')} placeholder="CBU" />
      <input aria-label="WhatsApp" className={inputCls} value={c.contactWhatsapp} onChange={f('contactWhatsapp')} placeholder="WhatsApp (54911…)" />
      <input aria-label="Instagram" className={inputCls} value={c.contactInstagram} onChange={f('contactInstagram')} placeholder="Instagram" />
      <input aria-label="Email" className={inputCls} type="email" value={c.contactEmail} onChange={f('contactEmail')} placeholder="Email" />
      <input aria-label="Ubicación" className={inputCls} value={c.contactLocation} onChange={f('contactLocation')} placeholder="Ubicación" />
      <button className="bg-red text-white border-0 rounded-[2px] p-[14px] font-display font-bold tracking-[0.13em] uppercase hover:bg-redd">Guardar</button>
    </form>
  );
}
