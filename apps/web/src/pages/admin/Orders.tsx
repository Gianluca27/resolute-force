import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../lib/adminApi';
import { money } from '../../lib/money';

const STATUSES = ['pending', 'paid', 'shipped', 'cancelled'];

export default function Orders() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['admin-orders'], queryFn: adminApi.orders });
  const setStatus = useMutation({ mutationFn: ({ id, status }: { id: string; status: string }) => adminApi.setOrderStatus(id, status), onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-orders'] }) });

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display font-black text-[34px] uppercase">Pedidos</h1>
      <div className="flex flex-col gap-2">
        {(data ?? []).map((o: any) => (
          <div key={o.id} className="bg-card border border-line rounded-[4px] p-4 flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <div className="font-display font-bold">{o.orderNo} · {o.customerName}</div>
              <div className="font-display font-black">{money(o.total)}</div>
            </div>
            <div className="text-mut text-[13px]">{o.customerEmail} · {o.customerPhone ?? '—'} · {o.address}, {o.city} · {o.paymentMethod}</div>
            <div className="text-[13px]">{o.items.map((i: any) => `${i.line} ${i.color} ${i.size} x${i.qty}`).join('  ·  ')}</div>
            <select value={o.status} onChange={(e) => setStatus.mutate({ id: o.id, status: e.target.value })} className="bg-bg border border-line2 rounded-[2px] text-tx px-3 py-2 w-[160px]">
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
