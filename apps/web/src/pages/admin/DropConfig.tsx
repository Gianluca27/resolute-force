import { useEffect, useState } from 'react';
import { adminApi } from '../../lib/adminApi';
import type { DropDTO } from '@resolute/shared';

const inputCls = 'bg-card border border-line2 rounded-[3px] text-tx px-[14px] py-[12px] outline-none focus:border-gold';

// Convert a UTC instant to the local wall-clock string a datetime-local input expects (and back on save).
const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export default function DropConfig() {
  const [d, setD] = useState<DropDTO | null>(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => { adminApi.getDrop().then(setD).catch(() => setErr('No se pudo cargar la configuración')); }, []);
  if (!d) return <div className="text-mut">{err || 'Cargando…'}</div>;
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault(); setErr(''); setMsg('');
        try { await adminApi.putDrop(d); setMsg('Guardado ✓'); }
        catch (e2) { setErr(e2 instanceof Error ? e2.message : 'No se pudo guardar'); }
      }}
      className="flex flex-col gap-4 max-w-[520px]"
    >
      <h1 className="font-display font-black text-[30px] uppercase">Drop / countdown</h1>
      {msg && <div className="text-gold text-[13px] uppercase font-display">{msg}</div>}
      {err && <div className="text-red text-[13px] uppercase font-display">{err}</div>}
      <label className="flex flex-col gap-1 text-mut text-[12px] uppercase font-display">Fecha objetivo
        <input aria-label="Fecha objetivo" className={inputCls} type="datetime-local" value={toLocalInput(d.targetAt)} onChange={(e) => setD({ ...d, targetAt: new Date(e.target.value).toISOString() })} />
      </label>
      <input aria-label="Título" className={inputCls} value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} placeholder="Título" />
      <textarea aria-label="Teaser" className={inputCls} value={d.teaser} onChange={(e) => setD({ ...d, teaser: e.target.value })} placeholder="Teaser" rows={3} />
      <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" checked={d.visible} onChange={(e) => setD({ ...d, visible: e.target.checked })} /> Mostrar sección</label>
      <button className="bg-red text-white border-0 rounded-[2px] p-[14px] font-display font-bold tracking-[0.13em] uppercase hover:bg-redd">Guardar</button>
    </form>
  );
}
