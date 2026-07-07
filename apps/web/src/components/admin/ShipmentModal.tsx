import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PROVINCES } from '@resolute/shared';
import { adminApi } from '../../lib/adminApi';
import { useToast } from '../../store/toast';

const inputCls = 'bg-bg border border-line2 rounded-[3px] text-tx px-3 py-2 text-[14px] outline-none focus:border-gold w-full';
const labelCls = 'text-mut text-[12px] uppercase font-display';

interface OrderForShipment {
  id: string; orderNo: string; total: number; city: string;
  shippingStreet: string | null; shippingStreetNumber: string | null; shippingFloor: string | null;
  shippingApartment: string | null; shippingZip: string | null; shippingProvince: string | null;
}

/** Modal de alta de envío PAQ.AR: dirección del pedido + defaults del remitente, editable antes de confirmar. */
export default function ShipmentModal({ order, onClose }: { order: OrderForShipment; onClose: () => void }) {
  const qc = useQueryClient();
  const showToast = useToast((s) => s.show);
  const { data: cfg } = useQuery({ queryKey: ['admin-shipping-config'], queryFn: adminApi.getShippingConfig });

  const [form, setForm] = useState({
    deliveryType: 'homeDelivery', agencyId: '',
    street: order.shippingStreet ?? '', streetNumber: order.shippingStreetNumber ?? '',
    floor: order.shippingFloor ?? '', apartment: order.shippingApartment ?? '',
    city: order.city, province: order.shippingProvince ?? '', zip: order.shippingZip ?? '',
    weightGrams: '', heightCm: '', widthCm: '', depthCm: '',
    declaredValue: String(order.total), serviceType: '',
  });
  // Defaults de config aplicados como placeholder-valor inicial la primera vez que llegan.
  const [defaultsApplied, setDefaultsApplied] = useState(false);
  if (cfg && !defaultsApplied) {
    setDefaultsApplied(true);
    setForm((f) => ({
      ...f,
      weightGrams: f.weightGrams || String(cfg.defaultWeightGrams), heightCm: f.heightCm || String(cfg.defaultHeightCm),
      widthCm: f.widthCm || String(cfg.defaultWidthCm), depthCm: f.depthCm || String(cfg.defaultDepthCm),
      serviceType: f.serviceType || cfg.defaultServiceType,
    }));
  }

  const needsAgency = form.deliveryType !== 'homeDelivery';
  const { data: agencies } = useQuery({
    queryKey: ['admin-agencies', form.province],
    queryFn: () => adminApi.agencies({ stateId: form.province || undefined, pickupAvailability: true }),
    enabled: needsAgency,
  });

  const create = useMutation({
    mutationFn: () => adminApi.createShipment(order.id, {
      deliveryType: form.deliveryType,
      agencyId: needsAgency ? form.agencyId : undefined,
      weightGrams: Number(form.weightGrams), heightCm: Number(form.heightCm),
      widthCm: Number(form.widthCm), depthCm: Number(form.depthCm),
      declaredValue: Number(form.declaredValue), serviceType: form.serviceType,
      shipping: {
        street: form.street, streetNumber: form.streetNumber,
        floor: form.floor || undefined, apartment: form.apartment || undefined,
        city: form.city, province: form.province, zip: form.zip,
      },
    }),
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ['admin-orders'] });
      qc.invalidateQueries({ queryKey: ['admin-shipments'] });
      showToast(`Envío creado · ${s.trackingNumber}`);
      onClose();
    },
    onError: (e: Error) => showToast(e.message),
  });

  const set = (patch: Partial<typeof form>) => setForm({ ...form, ...patch });
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div onClick={onClose} className="fixed inset-0 z-[500] bg-black/70 backdrop-blur-[4px] flex items-start justify-center px-4 py-[clamp(16px,5vh,60px)] overflow-y-auto">
      <div onClick={stop} className="w-[min(560px,100%)] bg-bg border border-line2 rounded-[6px] p-6 flex flex-col gap-3">
        <h2 className="m-0 font-display font-black text-[22px] uppercase">Generar envío · {order.orderNo}</h2>
        {!cfg && <div className="text-red text-[13px] uppercase font-display">Configurá el remitente en Correo → Configuración antes de generar envíos.</div>}

        <div className="flex flex-col gap-1">
          <label htmlFor="sm-delivery" className={labelCls}>Tipo de entrega</label>
          <select id="sm-delivery" className={inputCls} value={form.deliveryType} onChange={(e) => set({ deliveryType: e.target.value, agencyId: '' })}>
            <option value="homeDelivery">Domicilio</option>
            <option value="agency">Sucursal</option>
            <option value="locker">Locker</option>
          </select>
        </div>

        {needsAgency && (
          <div className="flex flex-col gap-1">
            <label htmlFor="sm-agency" className={labelCls}>Sucursal / Locker</label>
            <select id="sm-agency" className={inputCls} value={form.agencyId} onChange={(e) => set({ agencyId: e.target.value })}>
              <option value="" disabled>Elegí la sucursal</option>
              {(agencies ?? []).map((a: any) => <option key={a.agency_id} value={a.agency_id}>{a.agency_name} — {a.location?.city_name}</option>)}
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-3">
          <L id="sm-street" label="Calle"><input id="sm-street" className={inputCls} value={form.street} onChange={(e) => set({ street: e.target.value })} /></L>
          <L id="sm-number" label="Altura"><input id="sm-number" className={inputCls} value={form.streetNumber} onChange={(e) => set({ streetNumber: e.target.value })} /></L>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <L id="sm-floor" label="Piso"><input id="sm-floor" className={inputCls} value={form.floor} onChange={(e) => set({ floor: e.target.value })} /></L>
          <L id="sm-apt" label="Depto"><input id="sm-apt" className={inputCls} value={form.apartment} onChange={(e) => set({ apartment: e.target.value })} /></L>
          <L id="sm-zip" label="Código postal"><input id="sm-zip" className={inputCls} value={form.zip} onChange={(e) => set({ zip: e.target.value })} /></L>
          <L id="sm-city" label="Ciudad"><input id="sm-city" className={inputCls} value={form.city} onChange={(e) => set({ city: e.target.value })} /></L>
        </div>
        <L id="sm-prov" label="Provincia">
          <select id="sm-prov" className={inputCls} value={form.province} onChange={(e) => set({ province: e.target.value, agencyId: '' })}>
            <option value="" disabled>Elegí la provincia</option>
            {PROVINCES.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
          </select>
        </L>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <L id="sm-weight" label="Peso (g)"><input id="sm-weight" type="number" min={1} max={99999} className={inputCls} value={form.weightGrams} onChange={(e) => set({ weightGrams: e.target.value })} /></L>
          <L id="sm-h" label="Alto (cm)"><input id="sm-h" type="number" min={1} max={999} className={inputCls} value={form.heightCm} onChange={(e) => set({ heightCm: e.target.value })} /></L>
          <L id="sm-w" label="Ancho (cm)"><input id="sm-w" type="number" min={1} max={999} className={inputCls} value={form.widthCm} onChange={(e) => set({ widthCm: e.target.value })} /></L>
          <L id="sm-d" label="Largo (cm)"><input id="sm-d" type="number" min={1} max={999} className={inputCls} value={form.depthCm} onChange={(e) => set({ depthCm: e.target.value })} /></L>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <L id="sm-value" label="Valor declarado"><input id="sm-value" type="number" min={0} className={inputCls} value={form.declaredValue} onChange={(e) => set({ declaredValue: e.target.value })} /></L>
          <L id="sm-service" label="Tipo de servicio"><input id="sm-service" maxLength={2} className={inputCls} value={form.serviceType} onChange={(e) => set({ serviceType: e.target.value.toUpperCase() })} /></L>
        </div>

        <div className="flex gap-[10px] mt-2">
          <button onClick={onClose} className="shrink-0 bg-transparent text-tx border border-line2 rounded-[2px] px-5 py-3 font-display font-bold text-[14px] tracking-[0.1em] uppercase hover:border-tx">Cancelar</button>
          <button disabled={create.isPending || !cfg} onClick={() => create.mutate()} className="flex-1 bg-red text-white border-0 rounded-[2px] p-3 font-display font-bold text-[15px] tracking-[0.13em] uppercase hover:bg-redd disabled:opacity-60">Confirmar envío</button>
        </div>
      </div>
    </div>
  );
}

function L({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-1"><label htmlFor={id} className={labelCls}>{label}</label>{children}</div>;
}
