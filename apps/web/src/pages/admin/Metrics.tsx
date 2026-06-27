import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../lib/adminApi';
import { money } from '../../lib/money';

function Card({ label, value }: { label: string; value: string }) {
  return <div className="bg-card border border-line rounded-[4px] p-5"><div className="text-mut text-[12px] font-display tracking-[0.14em] uppercase">{label}</div><div className="font-display font-black text-[28px] mt-1">{value}</div></div>;
}

export default function Metrics() {
  const { data, isLoading } = useQuery({ queryKey: ['metrics'], queryFn: adminApi.metrics });
  if (isLoading || !data) return <div className="text-mut">Cargando métricas…</div>;
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display font-black text-[34px] uppercase">Métricas</h1>
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(200px,1fr))]">
        <Card label="Ingresos" value={money(data.revenue)} />
        <Card label="Unidades vendidas" value={String(data.unitsSold)} />
        <Card label="Ticket promedio" value={money(data.avgOrderValue)} />
        <Card label="Visitas (30d)" value={String(data.visits30)} />
        <Card label="Conversión" value={`${data.conversionRate}%`} />
        <Card label="Pendientes" value={String(data.ordersByStatus.pending ?? 0)} />
        <Card label="Pagados" value={String(data.ordersByStatus.paid ?? 0)} />
        <Card label="Enviados" value={String(data.ordersByStatus.shipped ?? 0)} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-card border border-line rounded-[4px] p-5">
          <div className="font-display font-bold uppercase tracking-[0.1em] mb-3">Top productos</div>
          {data.topProducts.length === 0 ? <div className="text-mut text-sm">Sin ventas aún.</div> : data.topProducts.map((p: { label: string; qty: number }) => (
            <div key={p.label} className="flex justify-between py-1 text-[14px]"><span>{p.label}</span><span className="text-gold font-bold">{p.qty}</span></div>
          ))}
        </div>
        <div className="bg-card border border-line rounded-[4px] p-5">
          <div className="font-display font-bold uppercase tracking-[0.1em] mb-3">Stock bajo (≤5)</div>
          {data.lowStock.length === 0 ? <div className="text-mut text-sm">Todo con stock.</div> : data.lowStock.map((s: { line: string; color: string; size: string; stock: number }, i: number) => (
            <div key={i} className="flex justify-between py-1 text-[14px]"><span>{s.line} · {s.color} · {s.size}</span><span className="text-red font-bold">{s.stock}</span></div>
          ))}
        </div>
      </div>
    </div>
  );
}
