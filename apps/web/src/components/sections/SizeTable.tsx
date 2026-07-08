import type { SizeTableProps, SectionStyle, SectionLayout } from '@resolute/shared';
import { sectionOverrides, SECTION_PAD, SECTION_PX } from './shell';
import { sectionEl } from './layoutEl';

export default function SizeTable({ id, props, sectionStyle, layout }: { id: string; props: SizeTableProps; sectionStyle?: SectionStyle; layout?: SectionLayout }) {
  const o = sectionOverrides(sectionStyle, { bg: '', pad: SECTION_PAD });
  const el = sectionEl(layout);
  if (props.rows.length === 0) return null;
  return (
    <section id={id} data-screen-label="Tabla de talles" style={o.css} className={`scroll-mt-20 ${o.bgCls} ${SECTION_PX} ${o.padCls} ${o.alignCls}`}>
      <div className="max-w-[860px] mx-auto">
        {props.kicker && <div {...el('kicker', 'font-display font-bold text-[13px] tracking-[0.3em] uppercase text-gold mb-[18px]')}>{props.kicker}</div>}
        {props.title && <h2 {...el('title', 'm-0 mb-8 font-display font-black uppercase leading-[0.92] tracking-[-0.01em] text-[clamp(2rem,4.5vw,3.2rem)]')}>{props.title}</h2>}
        <div {...el('table', 'overflow-x-auto border border-line2 rounded-[var(--rf-radius)]')}>
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-panel">
                {props.columns.map((c, i) => (
                  <th key={i} className="px-4 py-3 font-display font-bold text-[13px] tracking-[0.12em] uppercase text-gold border-b border-line2 whitespace-nowrap">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {props.rows.map((row, i) => (
                <tr key={i} className={i % 2 ? 'bg-panel/50' : ''}>
                  {row.map((cell, j) => (
                    <td key={j} className={`px-4 py-3 text-[15px] border-b border-line whitespace-nowrap ${j === 0 ? 'font-display font-bold uppercase tracking-[0.08em] text-tx' : 'text-mut'}`}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {props.note && <p {...el('note', 'mt-4 text-mut text-[13px]')}>{props.note}</p>}
      </div>
    </section>
  );
}
