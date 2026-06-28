import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../lib/adminApi';
import { money } from '../../lib/money';

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div role="listitem" className="bg-card border border-line rounded-[4px] p-5">
      <dl>
        <dt className="text-mut text-[12px] font-display tracking-[0.14em] uppercase">{label}</dt>
        <dd className="font-display font-black text-[28px] mt-1">{value}</dd>
      </dl>
    </div>
  );
}

export default function Metrics() {
  const { data, isLoading } = useQuery({ queryKey: ['metrics'], queryFn: adminApi.metrics });
  if (isLoading || !data) return <div className="text-mut">Cargando métricas…</div>;
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display font-black text-[34px] uppercase">Métricas</h1>
      <div role="list" aria-label="Indicadores clave" className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(200px,1fr))]">
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
        <section aria-labelledby="top-productos-h" className="bg-card border border-line rounded-[4px] p-5">
          <h2 id="top-productos-h" className="font-display font-bold uppercase tracking-[0.1em] mb-3 text-base">Top productos</h2>
          {data.topProducts.length === 0 ? <div className="text-mut text-sm">Sin ventas aún.</div> : (
            <ul className="list-none m-0 p-0">
              {data.topProducts.map((p: { label: string; qty: number }) => (
                <li key={p.label} className="flex justify-between py-1 text-[14px]"><span>{p.label}</span><span className="text-gold font-bold" aria-label={`${p.qty} unidades vendidas`}>{p.qty}</span></li>
              ))}
            </ul>
          )}
        </section>
        <section aria-labelledby="stock-bajo-h" className="bg-card border border-line rounded-[4px] p-5">
          <h2 id="stock-bajo-h" className="font-display font-bold uppercase tracking-[0.1em] mb-3 text-base">Stock bajo (≤5)</h2>
          {data.lowStock.length === 0 ? <div className="text-mut text-sm">Todo con stock.</div> : (
            <ul className="list-none m-0 p-0">
              {data.lowStock.map((s: { line: string; color: string; size: string; stock: number }, i: number) => (
                <li key={i} className="flex justify-between py-1 text-[14px]"><span>{s.line} · {s.color} · {s.size}</span><span className="text-red font-bold" aria-label={`stock bajo: ${s.stock} unidades`}>{s.stock}</span></li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
