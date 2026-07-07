import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { adminApi } from '../../lib/adminApi';
import { money } from '../../lib/money';
import { METRIC_RANGES, RANGE_LABELS, type MetricsRange, type Kpi } from '../../lib/metricsTypes';

const num = (n: number) => n.toLocaleString('es-AR');

/** Period-over-period change badge. `invert` flips the good/bad colour for metrics where a
 *  rise is undesirable (pending money, cancellations, discounts given). */
function Delta({ kpi, invert = false }: { kpi: Kpi; invert?: boolean }) {
  const d = kpi.deltaPct;
  if (d === null) return <span className="text-mut text-[11px] font-display">— sin período previo</span>;
  const good = d === 0 ? null : invert ? d < 0 : d > 0;
  const color = good === null ? 'text-mut' : good ? 'text-gold' : 'text-red';
  const arrow = d > 0 ? '▲' : d < 0 ? '▼' : '•';
  return (
    <span className={`text-[12px] font-display font-bold ${color}`} aria-label={`variación ${d} por ciento vs período previo`}>
      {arrow} {Math.abs(d)}%
    </span>
  );
}

function KpiCard({ label, value, kpi, invert }: { label: string; value: string; kpi: Kpi; invert?: boolean }) {
  return (
    <div role="listitem" className="bg-card border border-line rounded-[4px] p-5 flex flex-col gap-1">
      <dl className="m-0">
        <dt className="text-mut text-[12px] font-display tracking-[0.14em] uppercase">{label}</dt>
        <dd className="font-display font-black text-[28px] mt-1 leading-none tabular-nums">{value}</dd>
      </dl>
      <Delta kpi={kpi} invert={invert} />
    </div>
  );
}

function RangeSelector({ range, onChange }: { range: MetricsRange; onChange: (r: MetricsRange) => void }) {
  return (
    <div role="group" aria-label="Rango de tiempo" className="inline-flex flex-wrap gap-1 bg-card border border-line rounded-[4px] p-1">
      {METRIC_RANGES.map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => onChange(r)}
          aria-pressed={r === range}
          className={`font-display text-[12px] tracking-[0.1em] uppercase px-3 py-[7px] rounded-[3px] transition-colors ${r === range ? 'bg-red text-white' : 'text-mut hover:text-tx'}`}
        >
          {RANGE_LABELS[r]}
        </button>
      ))}
    </div>
  );
}

function Section({ id, title, children, className = '' }: { id: string; title: string; children: React.ReactNode; className?: string }) {
  return (
    <section aria-labelledby={id} className={`bg-card border border-line rounded-[4px] p-5 ${className}`}>
      <h2 id={id} className="font-display font-bold uppercase tracking-[0.1em] mb-3 text-base">{title}</h2>
      {children}
    </section>
  );
}

function BarList({ items, color = 'bg-gold', empty = 'Sin datos.' }: { items: { label: string; value: number; sub: string }[]; color?: string; empty?: string }) {
  if (!items.length) return <div className="text-mut text-sm">{empty}</div>;
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="list-none m-0 p-0 flex flex-col gap-2">
      {items.map((it, i) => (
        <li key={i} className="flex flex-col gap-1">
          <div className="flex justify-between items-baseline text-[13px] gap-2">
            <span className="truncate">{it.label}</span>
            <span className="font-display font-bold tabular-nums shrink-0">{it.sub}</span>
          </div>
          <div className="h-[6px] bg-line rounded-full overflow-hidden">
            <div className={`h-full ${color} rounded-full`} style={{ width: `${Math.max(2, (it.value / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Minimal hand-rolled area/line chart (no chart lib). Ships an sr-only data table so the
 *  series is accessible and assertable without reading the SVG geometry. */
function AreaChart({ title, series, format }: { title: string; series: { date: string; y: number }[]; format: (n: number) => string }) {
  if (!series.length) return <div className="text-mut text-sm">Sin datos.</div>;
  const w = 600, h = 140, pad = 4;
  const max = Math.max(1, ...series.map((s) => s.y));
  const n = series.length;
  const x = (i: number) => (n <= 1 ? w / 2 : pad + (i / (n - 1)) * (w - 2 * pad));
  const y = (v: number) => h - pad - (v / max) * (h - 2 * pad);
  const line = series.map((s, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(s.y).toFixed(1)}`).join(' ');
  const area = `${line} L${x(n - 1).toFixed(1)},${h} L${x(0).toFixed(1)},${h} Z`;
  const peak = series.reduce((a, b) => (b.y > a.y ? b : a));
  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[140px]" role="img" aria-label={`${title}. Máximo ${format(peak.y)} el ${peak.date}.`} preserveAspectRatio="none">
        <path d={area} className="fill-gold/10" />
        <path d={line} className="fill-none stroke-gold" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </svg>
      <table className="sr-only">
        <caption>{title}</caption>
        <thead><tr><th scope="col">Período</th><th scope="col">Valor</th></tr></thead>
        <tbody>{series.map((s) => (<tr key={s.date}><th scope="row">{s.date}</th><td>{format(s.y)}</td></tr>))}</tbody>
      </table>
    </figure>
  );
}

function Funnel({ steps }: { steps: { label: string; value: number }[] }) {
  const max = Math.max(1, steps[0]?.value ?? 1);
  return (
    <ul className="list-none m-0 p-0 flex flex-col gap-2">
      {steps.map((s, i) => {
        const prev = i > 0 ? steps[i - 1]! : null;
        const conv = prev ? (prev.value ? Math.round((s.value / prev.value) * 100) : 0) : null;
        return (
          <li key={s.label} className="flex flex-col gap-1">
            <div className="flex justify-between items-baseline text-[13px]">
              <span className="uppercase font-display tracking-[0.08em] text-mut">{s.label}</span>
              <span className="font-display font-bold tabular-nums">
                {num(s.value)}
                {conv !== null && <span className="text-mut ml-2 text-[11px] font-normal">{conv}%</span>}
              </span>
            </div>
            <div className="h-[10px] bg-line rounded-[2px] overflow-hidden">
              <div className="h-full bg-red" style={{ width: `${(s.value / max) * 100}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default function Metrics() {
  const [range, setRange] = useState<MetricsRange>('30d');
  const { data: d, isLoading, isFetching } = useQuery({
    queryKey: ['metrics', range],
    queryFn: () => adminApi.metrics(range),
    placeholderData: keepPreviousData, // keep the old numbers on screen while the new range loads
  });

  const statusLabels: Record<string, string> = { pending: 'Pendientes', paid: 'Pagados', shipped: 'Enviados', cancelled: 'Cancelados' };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3 sticky top-0 z-10 bg-bg/95 backdrop-blur py-2">
        <h1 className="font-display font-black text-[34px] uppercase">Métricas</h1>
        <RangeSelector range={range} onChange={setRange} />
      </header>

      {isLoading || !d ? (
        <div className="text-mut">Cargando métricas…</div>
      ) : (
      <>
      <div role="list" aria-label="Indicadores clave" className={`grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(180px,1fr))] transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
        <KpiCard label="Ingresos" value={money(d.revenue.value)} kpi={d.revenue} />
        <KpiCard label="Órdenes" value={num(d.orders.value)} kpi={d.orders} />
        <KpiCard label="Pagadas" value={num(d.paidOrders.value)} kpi={d.paidOrders} />
        <KpiCard label="Ticket promedio" value={money(d.avgOrderValue.value)} kpi={d.avgOrderValue} />
        <KpiCard label="Unidades" value={num(d.unitsSold.value)} kpi={d.unitsSold} />
        <KpiCard label="Uds/orden" value={num(d.unitsPerOrder.value)} kpi={d.unitsPerOrder} />
        <KpiCard label="Visitas" value={num(d.visits.value)} kpi={d.visits} />
        <KpiCard label="Conversión" value={`${d.conversionRate.value}%`} kpi={d.conversionRate} />
        <KpiCard label="En pendientes" value={money(d.pendingValue.value)} kpi={d.pendingValue} invert />
        <KpiCard label="Cancelación" value={`${d.cancellationRate.value}%`} kpi={d.cancellationRate} invert />
        <KpiCard label="Descuentos" value={money(d.discountTotal.value)} kpi={d.discountTotal} invert />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Section id="rev-trend-h" title="Ingresos por período">
          <AreaChart title="Ingresos por período" series={d.revenueSeries.map((p) => ({ date: p.date, y: p.total }))} format={money} />
        </Section>
        <Section id="vis-trend-h" title="Visitas por período">
          <AreaChart title="Visitas por período" series={d.visitsSeries.map((p) => ({ date: p.date, y: p.count }))} format={num} />
        </Section>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Section id="method-h" title="Ingresos por método">
          <BarList items={d.revenueByMethod.map((m) => ({ label: m.method, value: m.revenue, sub: money(m.revenue) }))} />
        </Section>
        <Section id="funnel-h" title="Embudo de conversión">
          <Funnel steps={[
            { label: 'Visitas', value: d.funnel.visits },
            { label: 'Órdenes', value: d.funnel.orders },
            { label: 'Pagadas', value: d.funnel.paid },
            { label: 'Enviadas', value: d.funnel.shipped },
          ]} />
        </Section>
        <Section id="status-h" title="Órdenes por estado">
          <BarList color="bg-red" items={Object.entries(d.ordersByStatus).map(([s, c]) => ({ label: statusLabels[s] ?? s, value: c, sub: num(c) }))} empty="Sin órdenes." />
        </Section>
        <Section id="line-h" title="Ingresos por línea">
          <BarList items={d.revenueByLine.map((l) => ({ label: l.line, value: l.revenue, sub: money(l.revenue) }))} />
        </Section>
        <Section id="size-h" title="Talles vendidos">
          <BarList color="bg-red" items={d.sizeDistribution.map((s) => ({ label: s.size, value: s.qty, sub: num(s.qty) }))} empty="Sin ventas." />
        </Section>
        <Section id="pages-h" title="Páginas más vistas">
          <BarList items={d.topPages.map((p) => ({ label: p.path, value: p.views, sub: num(p.views) }))} empty="Sin visitas." />
        </Section>
        <Section id="newret-h" title="Nuevos vs recurrentes">
          <dl className="grid grid-cols-2 gap-3 m-0">
            <div><dt className="text-mut text-[12px] uppercase font-display tracking-[0.1em]">Nuevos</dt><dd className="font-display font-black text-[24px] mt-1">{num(d.newVsReturning.newCustomers)}</dd><div className="text-mut text-[12px]">{money(d.newVsReturning.newRevenue)}</div></div>
            <div><dt className="text-mut text-[12px] uppercase font-display tracking-[0.1em]">Recurrentes</dt><dd className="font-display font-black text-[24px] mt-1 text-gold">{num(d.newVsReturning.returning)}</dd><div className="text-mut text-[12px]">{money(d.newVsReturning.returningRevenue)}</div></div>
          </dl>
        </Section>
        <Section id="ship-h" title="Envíos">
          <BarList items={d.shipping.byType.map((t) => ({ label: t.type, value: t.count, sub: num(t.count) }))} empty="Sin envíos." />
          <div className="text-mut text-[12px] mt-3 flex flex-wrap gap-x-4 gap-y-1">
            <span>Cancelados: <b className="text-tx">{num(d.shipping.cancelled)}</b></span>
            <span>Peso prom.: <b className="text-tx">{num(d.shipping.avgWeightGrams)} g</b></span>
            <span>Valor decl.: <b className="text-tx">{money(d.shipping.avgDeclaredValue)}</b></span>
          </div>
        </Section>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Section id="top-prod-h" title="Top productos">
          {d.topProductsByRevenue.length === 0 ? <div className="text-mut text-sm">Sin ventas aún.</div> : (
            <ul className="list-none m-0 p-0 flex flex-col gap-1">
              {d.topProductsByRevenue.map((p) => (
                <li key={p.label} className="flex justify-between gap-2 py-1 text-[14px]">
                  <span className="truncate">{p.label}</span>
                  <span className="shrink-0"><span className="text-gold font-bold">{money(p.revenue)}</span> <span className="text-mut text-[12px]">· {num(p.qty)} u</span></span>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section id="top-cust-h" title="Top clientes">
          {d.topCustomers.length === 0 ? <div className="text-mut text-sm">Sin clientes aún.</div> : (
            <ul className="list-none m-0 p-0 flex flex-col gap-1">
              {d.topCustomers.map((c) => (
                <li key={c.email} className="flex justify-between gap-2 py-1 text-[14px]">
                  <span className="truncate" title={c.email}>{c.name || c.email}</span>
                  <span className="shrink-0"><span className="text-gold font-bold">{money(c.spent)}</span> <span className="text-mut text-[12px]">· {num(c.orders)}</span></span>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section id="low-stock-h" title={`Stock bajo (≤${d.lowStockThreshold})`}>
          {d.lowStock.length === 0 ? <div className="text-mut text-sm">Todo con stock.</div> : (
            <ul className="list-none m-0 p-0 flex flex-col gap-1">
              {d.lowStock.map((s, i) => (
                <li key={i} className="flex justify-between gap-2 py-1 text-[14px]">
                  <span className="truncate">{s.line} · {s.color} · {s.size}</span>
                  <span className="text-red font-bold shrink-0" aria-label={`stock bajo: ${s.stock} unidades`}>{s.stock}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
      </>
      )}
    </div>
  );
}
