import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PROVINCES } from '@resolute/shared';
import { adminApi } from '../../lib/adminApi';
import { useToast } from '../../store/toast';
import Toast from '../../components/Toast';

const inputCls = 'bg-card border border-line2 rounded-[3px] text-tx px-[14px] py-[12px] outline-none focus:border-gold';
const btnCls = 'bg-bg border border-line2 rounded-[2px] text-tx px-3 py-2 font-display uppercase text-[12px] tracking-[0.1em] hover:border-tx disabled:opacity-40';
const labelCls = 'text-mut text-[12px] uppercase font-display';

const SHIPMENT_STATUS: Record<string, string> = { created: 'Generado', cancelled: 'Cancelado' };
type Tab = 'envios' | 'config' | 'sucursales';

export default function Shipping() {
  const [tab, setTab] = useState<Tab>('envios');
  const { data: status } = useQuery({ queryKey: ['admin-shipping-status'], queryFn: adminApi.shippingStatus });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-display font-black text-[34px] uppercase m-0">Correo Argentino</h1>
        {status && (
          <span className={`font-display text-[12px] tracking-[0.1em] uppercase px-3 py-[6px] rounded-[2px] border ${status.configured && status.valid ? 'border-gold text-gold' : 'border-red text-red'}`}>
            {!status.configured ? 'PAQ.AR no configurado' : status.valid ? 'Credenciales OK' : 'Credenciales inválidas'}
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <TabBtn active={tab === 'envios'} onClick={() => setTab('envios')}>Envíos</TabBtn>
        <TabBtn active={tab === 'config'} onClick={() => setTab('config')}>Configuración</TabBtn>
        <TabBtn active={tab === 'sucursales'} onClick={() => setTab('sucursales')}>Sucursales</TabBtn>
      </div>
      {tab === 'envios' && <ShipmentsTab />}
      {tab === 'config' && <ConfigTab />}
      {tab === 'sucursales' && <AgenciesTab />}
      <Toast />
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`px-4 py-2 rounded-[2px] font-display font-semibold tracking-[0.1em] uppercase text-[13px] ${active ? 'bg-red text-white' : 'bg-bg border border-line2 text-mut hover:text-tx'}`}>
      {children}
    </button>
  );
}

// ───────────── Envíos ─────────────

function downloadLabelPdf(fileName: string, base64: string) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url; a.download = fileName || 'rotulo.pdf'; a.click();
  URL.revokeObjectURL(url);
}

function ShipmentsTab() {
  const qc = useQueryClient();
  const showToast = useToast((s) => s.show);
  const { data } = useQuery({ queryKey: ['admin-shipments'], queryFn: adminApi.shipments });
  const [trackingOf, setTrackingOf] = useState<{ id: string; tn: string } | null>(null);

  const cancel = useMutation({
    mutationFn: (id: string) => adminApi.cancelShipment(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-shipments'] }); qc.invalidateQueries({ queryKey: ['admin-orders'] }); showToast('Envío cancelado'); },
    onError: (e: Error) => showToast(e.message),
  });
  const label = useMutation({
    mutationFn: (id: string) => adminApi.shipmentLabel(id),
    onSuccess: (l) => downloadLabelPdf(l.fileName, l.fileBase64),
    onError: (e: Error) => showToast(e.message),
  });

  const shipments = (data ?? []) as any[];
  return (
    <div className="flex flex-col gap-2">
      {shipments.map((s) => (
        <div key={s.id} className="bg-card border border-line rounded-[4px] p-4 flex flex-col gap-2">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <h2 className="font-display font-bold text-[15px] m-0">{s.trackingNumber}</h2>
            <span className={`font-display text-[12px] uppercase tracking-[0.1em] ${s.status === 'created' ? 'text-gold' : 'text-red'}`}>{SHIPMENT_STATUS[s.status] ?? s.status}</span>
          </div>
          <div className="text-mut text-[13px]">
            {s.order.orderNo} · {s.order.customerName} · {s.deliveryType === 'homeDelivery' ? 'Domicilio' : s.deliveryType === 'agency' ? 'Sucursal' : 'Locker'} · {s.serviceType} · {new Date(s.createdAt).toLocaleDateString('es-AR')}
          </div>
          <div className="flex gap-2 flex-wrap">
            <button className={btnCls} onClick={() => setTrackingOf({ id: s.id, tn: s.trackingNumber })}>Tracking</button>
            <button className={btnCls} disabled={s.status !== 'created' || label.isPending} onClick={() => label.mutate(s.id)}>Rótulo PDF</button>
            <button
              className={`${btnCls} hover:border-red hover:text-red`}
              disabled={s.status !== 'created' || cancel.isPending}
              onClick={() => { if (window.confirm(`¿Cancelar el envío ${s.trackingNumber} en Correo Argentino?`)) cancel.mutate(s.id); }}
            >
              Cancelar
            </button>
          </div>
        </div>
      ))}
      {shipments.length === 0 && <div className="text-mut text-[14px]">No hay envíos generados.</div>}
      {trackingOf && <TrackingModal shipmentId={trackingOf.id} trackingNumber={trackingOf.tn} onClose={() => setTrackingOf(null)} />}
    </div>
  );
}

function TrackingModal({ shipmentId, trackingNumber, onClose }: { shipmentId: string; trackingNumber: string; onClose: () => void }) {
  const { data, isLoading, error } = useQuery({ queryKey: ['admin-tracking', shipmentId], queryFn: () => adminApi.shipmentTracking(shipmentId) });
  const events = (data?.event ?? []) as any[];
  return (
    <div onClick={onClose} className="fixed inset-0 z-[500] bg-black/70 backdrop-blur-[4px] flex items-start justify-center px-4 py-[clamp(16px,8vh,80px)] overflow-y-auto">
      <div onClick={(e) => e.stopPropagation()} className="w-[min(480px,100%)] bg-bg border border-line2 rounded-[6px] p-6 flex flex-col gap-3">
        <h2 className="m-0 font-display font-black text-[20px] uppercase">Tracking · {trackingNumber}</h2>
        {isLoading && <div className="text-mut text-[14px]">Consultando a Correo Argentino…</div>}
        {error instanceof Error && <div className="text-red text-[13px] uppercase font-display">{error.message}</div>}
        {data && events.length === 0 && !isLoading && <div className="text-mut text-[14px]">Sin movimientos registrados todavía.</div>}
        <div className="flex flex-col gap-2">
          {events.map((ev, i) => (
            <div key={i} className="bg-card border border-line rounded-[4px] px-4 py-3">
              <div className="font-display font-bold text-[14px] uppercase">{ev.status}</div>
              <div className="text-mut text-[13px]">{ev.date} · {ev.facility}{ev.sign ? ` · Firma: ${ev.sign}` : ''}</div>
            </div>
          ))}
        </div>
        <button onClick={onClose} className="bg-tx text-bg border-0 rounded-[2px] p-3 font-display font-bold text-[14px] tracking-[0.13em] uppercase hover:bg-gold">Cerrar</button>
      </div>
    </div>
  );
}

// ───────────── Configuración ─────────────

const EMPTY_CONFIG = {
  senderName: '', senderEmail: '', senderPhone: '',
  senderStreet: '', senderStreetNumber: '', senderFloor: '', senderApartment: '',
  senderCity: '', senderProvince: '', senderZip: '',
  defaultWeightGrams: 500, defaultHeightCm: 10, defaultWidthCm: 30, defaultDepthCm: 40,
  defaultServiceType: 'CP', labelFormat: '10x15',
};

function ConfigTab() {
  const qc = useQueryClient();
  const showToast = useToast((s) => s.show);
  const { data, isLoading } = useQuery({ queryKey: ['admin-shipping-config'], queryFn: adminApi.getShippingConfig });
  const [form, setForm] = useState<typeof EMPTY_CONFIG | null>(null);
  const c = form ?? (data ? { ...EMPTY_CONFIG, ...data } : EMPTY_CONFIG);

  const save = useMutation({
    mutationFn: () => adminApi.putShippingConfig({
      ...c,
      defaultWeightGrams: Number(c.defaultWeightGrams), defaultHeightCm: Number(c.defaultHeightCm),
      defaultWidthCm: Number(c.defaultWidthCm), defaultDepthCm: Number(c.defaultDepthCm),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-shipping-config'] }); showToast('Configuración guardada'); },
    onError: (e: Error) => showToast(e.message),
  });

  if (isLoading) return <div className="text-mut">Cargando…</div>;
  const set = (patch: Partial<typeof EMPTY_CONFIG>) => setForm({ ...c, ...patch });

  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="flex flex-col gap-3 max-w-[560px]">
      <div className={labelCls}>Remitente (aparece en el rótulo del correo)</div>
      <F id="cfg-name" label="Nombre / Razón social"><input id="cfg-name" className={inputCls} value={c.senderName} onChange={(e) => set({ senderName: e.target.value })} /></F>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <F id="cfg-email" label="Email"><input id="cfg-email" className={inputCls} value={c.senderEmail} onChange={(e) => set({ senderEmail: e.target.value })} /></F>
        <F id="cfg-phone" label="Teléfono"><input id="cfg-phone" className={inputCls} value={c.senderPhone} onChange={(e) => set({ senderPhone: e.target.value })} /></F>
      </div>
      <div className="grid grid-cols-[2fr_1fr] gap-3">
        <F id="cfg-street" label="Calle"><input id="cfg-street" className={inputCls} value={c.senderStreet} onChange={(e) => set({ senderStreet: e.target.value })} /></F>
        <F id="cfg-number" label="Altura"><input id="cfg-number" className={inputCls} value={c.senderStreetNumber} onChange={(e) => set({ senderStreetNumber: e.target.value })} /></F>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <F id="cfg-floor" label="Piso"><input id="cfg-floor" className={inputCls} value={c.senderFloor} onChange={(e) => set({ senderFloor: e.target.value })} /></F>
        <F id="cfg-apt" label="Depto"><input id="cfg-apt" className={inputCls} value={c.senderApartment} onChange={(e) => set({ senderApartment: e.target.value })} /></F>
        <F id="cfg-zip" label="Código postal"><input id="cfg-zip" className={inputCls} value={c.senderZip} onChange={(e) => set({ senderZip: e.target.value })} /></F>
        <F id="cfg-city" label="Ciudad"><input id="cfg-city" className={inputCls} value={c.senderCity} onChange={(e) => set({ senderCity: e.target.value })} /></F>
      </div>
      <F id="cfg-prov" label="Provincia">
        <select id="cfg-prov" className={inputCls} value={c.senderProvince} onChange={(e) => set({ senderProvince: e.target.value })}>
          <option value="" disabled>Elegí la provincia</option>
          {PROVINCES.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
        </select>
      </F>

      <div className={`${labelCls} mt-2`}>Defaults del paquete</div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <F id="cfg-weight" label="Peso (g)"><input id="cfg-weight" type="number" min={1} max={99999} className={inputCls} value={c.defaultWeightGrams} onChange={(e) => set({ defaultWeightGrams: Number(e.target.value) })} /></F>
        <F id="cfg-h" label="Alto (cm)"><input id="cfg-h" type="number" min={1} max={999} className={inputCls} value={c.defaultHeightCm} onChange={(e) => set({ defaultHeightCm: Number(e.target.value) })} /></F>
        <F id="cfg-w" label="Ancho (cm)"><input id="cfg-w" type="number" min={1} max={999} className={inputCls} value={c.defaultWidthCm} onChange={(e) => set({ defaultWidthCm: Number(e.target.value) })} /></F>
        <F id="cfg-d" label="Largo (cm)"><input id="cfg-d" type="number" min={1} max={999} className={inputCls} value={c.defaultDepthCm} onChange={(e) => set({ defaultDepthCm: Number(e.target.value) })} /></F>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <F id="cfg-service" label="Tipo de servicio"><input id="cfg-service" maxLength={2} className={inputCls} value={c.defaultServiceType} onChange={(e) => set({ defaultServiceType: e.target.value.toUpperCase() })} /></F>
        <F id="cfg-format" label="Formato de rótulo">
          <select id="cfg-format" className={inputCls} value={c.labelFormat} onChange={(e) => set({ labelFormat: e.target.value })}>
            <option value="10x15">10x15</option>
            <option value="label">Label</option>
          </select>
        </F>
      </div>
      <button disabled={save.isPending} className="bg-red text-white border-0 rounded-[2px] p-[14px] font-display font-bold tracking-[0.13em] uppercase hover:bg-redd disabled:opacity-60">Guardar</button>
    </form>
  );
}

// ───────────── Sucursales ─────────────

function AgenciesTab() {
  const showToast = useToast((s) => s.show);
  const [stateId, setStateId] = useState('');
  const [pickupOnly, setPickupOnly] = useState(true);
  const [results, setResults] = useState<any[] | null>(null);
  const search = useMutation({
    mutationFn: () => adminApi.agencies({ stateId: stateId || undefined, pickupAvailability: pickupOnly ? true : undefined }),
    onSuccess: setResults,
    onError: (e: Error) => showToast(e.message),
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end gap-3 flex-wrap">
        <F id="ag-prov" label="Provincia">
          <select id="ag-prov" className={inputCls} value={stateId} onChange={(e) => setStateId(e.target.value)}>
            <option value="">Todas</option>
            {PROVINCES.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
          </select>
        </F>
        <label className="flex items-center gap-2 text-[13px] text-mut pb-[12px]">
          <input type="checkbox" checked={pickupOnly} onChange={(e) => setPickupOnly(e.target.checked)} /> Solo con entrega al público
        </label>
        <button onClick={() => search.mutate()} disabled={search.isPending} className="bg-red text-white border-0 rounded-[2px] px-6 py-[12px] font-display font-bold tracking-[0.13em] uppercase hover:bg-redd disabled:opacity-60">Buscar</button>
      </div>
      <div className="flex flex-col gap-2">
        {(results ?? []).map((a: any) => (
          <div key={a.agency_id} className="bg-card border border-line rounded-[4px] p-4">
            <div className="font-display font-bold text-[15px]">{a.agency_name} <span className="text-mut font-normal text-[12px]">({a.agency_id})</span></div>
            <div className="text-mut text-[13px]">
              {a.location?.street_name} {a.location?.street_number} · {a.location?.city_name}, {a.location?.state_name}
              {a.schedule ? ` · ${a.schedule}` : ''}
            </div>
          </div>
        ))}
        {results !== null && results.length === 0 && <div className="text-mut text-[14px]">Sin sucursales para ese filtro.</div>}
      </div>
    </div>
  );
}

function F({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-1"><label htmlFor={id} className={labelCls}>{label}</label>{children}</div>;
}
