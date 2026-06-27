import { useEffect, useState } from 'react';
import { adminApi } from '../../lib/adminApi';
import type { DropDTO } from '@resolute/shared';

const inputCls = 'bg-card border border-line2 rounded-[3px] text-tx px-[14px] py-[12px] outline-none focus:border-gold';

export default function DropConfig() {
  const [d, setD] = useState<DropDTO | null>(null);
  const [msg, setMsg] = useState('');
  useEffect(() => { adminApi.getDrop().then(setD).catch(() => {}); }, []);
  if (!d) return <div className="text-mut">Cargando…</div>;
  return (
    <form onSubmit={async (e) => { e.preventDefault(); await adminApi.putDrop(d); setMsg('Guardado ✓'); }} className="flex flex-col gap-4 max-w-[520px]">
      <h1 className="font-display font-black text-[30px] uppercase">Drop / countdown</h1>
      {msg && <div className="text-gold text-[13px] uppercase font-display">{msg}</div>}
      <label className="flex flex-col gap-1 text-mut text-[12px] uppercase font-display">Fecha objetivo
        <input className={inputCls} type="datetime-local" value={new Date(d.targetAt).toISOString().slice(0, 16)} onChange={(e) => setD({ ...d, targetAt: new Date(e.target.value).toISOString() })} />
      </label>
      <input className={inputCls} value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} placeholder="Título" />
      <textarea className={inputCls} value={d.teaser} onChange={(e) => setD({ ...d, teaser: e.target.value })} placeholder="Teaser" rows={3} />
      <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" checked={d.visible} onChange={(e) => setD({ ...d, visible: e.target.checked })} /> Mostrar sección</label>
      <button className="bg-red text-white border-0 rounded-[2px] p-[14px] font-display font-bold tracking-[0.13em] uppercase hover:bg-redd">Guardar</button>
    </form>
  );
}
