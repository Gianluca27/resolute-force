import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../lib/adminApi';
import { money } from '../../lib/money';
import { useToast } from '../../store/toast';
import Toast from '../../components/Toast';
import ShipmentModal from '../../components/admin/ShipmentModal';

// es-AR labels for the raw status enum (H-03). Keys stay the API values sent on change.
const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  paid: 'Pagado',
  shipped: 'Enviado',
  cancelled: 'Cancelado',
};
const STATUSES = Object.keys(STATUS_LABELS);
const PAGE_SIZE = 20;

export default function Orders() {
  const qc = useQueryClient();
  const showToast = useToast((s) => s.show);
  const { data } = useQuery({ queryKey: ['admin-orders'], queryFn: adminApi.orders });
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => adminApi.setOrderStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-orders'] }),
    // Surface the server reason (422 revert / 409 oversell) instead of a silent snap-back (H-01).
    onError: (e: Error) => showToast(e.message),
  });

  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const [shipmentFor, setShipmentFor] = useState<any | null>(null);

  const orders = (data ?? []) as any[];
  const term = q.trim().toLowerCase();
  const filtered = term
    ? orders.filter((o) => `${o.orderNo} ${o.customerName} ${o.customerEmail}`.toLowerCase().includes(term))
    : orders;
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const shown = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display font-black text-[34px] uppercase">Pedidos</h1>
      <input
        type="search"
        value={q}
        onChange={(e) => { setQ(e.target.value); setPage(0); }}
        placeholder="Buscar por N° de pedido, cliente o email"
        aria-label="Buscar pedidos"
        className="bg-bg border border-line2 rounded-[2px] text-tx px-3 py-2 w-full max-w-[420px]"
      />
      <div className="flex flex-col gap-2">
        {shown.map((o: any) => (
          <div key={o.id} className="bg-card border border-line rounded-[4px] p-4 flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <h2 className="font-display font-bold text-[15px] m-0">{o.orderNo} · {o.customerName}</h2>
              <div className="font-display font-black">{money(o.total)}</div>
            </div>
            <div className="text-mut text-[13px]">{o.customerEmail} · {o.customerPhone ?? '—'} · {o.address}, {o.city} · {o.paymentMethod}</div>
            <div className="text-[13px]">{o.items.map((i: any) => `${i.line} ${i.color} ${i.size} x${i.qty}`).join('  ·  ')}</div>
            <div className="flex items-center gap-3 flex-wrap">
              <select
                value={o.status}
                onChange={(e) => setStatus.mutate({ id: o.id, status: e.target.value })}
                aria-label={`Estado del pedido ${o.orderNo}`}
                className="bg-bg border border-line2 rounded-[2px] text-tx px-3 py-2 w-[160px]"
              >
                {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
              {o.shipment && o.shipment.status !== 'cancelled' ? (
                <span className="text-gold text-[13px] font-display tracking-[0.08em] uppercase">Correo: {o.shipment.trackingNumber}</span>
              ) : (o.status === 'paid' || o.status === 'shipped') && (
                <button
                  onClick={() => setShipmentFor(o)}
                  className="bg-bg border border-line2 rounded-[2px] text-tx px-3 py-2 font-display uppercase text-[12px] tracking-[0.1em] hover:border-gold hover:text-gold"
                >
                  Generar envío
                </button>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="text-mut text-[14px]">No hay pedidos.</div>}
      </div>
      {pageCount > 1 && (
        <div className="flex items-center gap-3">
          <button
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
            className="bg-bg border border-line2 rounded-[2px] text-tx px-3 py-2 font-display uppercase text-[13px] tracking-[0.1em] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Anterior
          </button>
          <span className="text-mut text-[13px]">Página {current + 1} de {pageCount}</span>
          <button
            disabled={current >= pageCount - 1}
            onClick={() => setPage(current + 1)}
            className="bg-bg border border-line2 rounded-[2px] text-tx px-3 py-2 font-display uppercase text-[13px] tracking-[0.1em] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Siguiente
          </button>
        </div>
      )}
      {shipmentFor && <ShipmentModal order={shipmentFor} onClose={() => setShipmentFor(null)} />}
      <Toast />
    </div>
  );
}
