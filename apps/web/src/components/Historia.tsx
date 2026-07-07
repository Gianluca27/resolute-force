import type { HistoriaProps, SectionStyle } from '@resolute/shared';
import { sectionOverrides, SECTION_PAD, SECTION_PX } from './sections/shell';

const STAT_COLORS = ['rgb(var(--rf-accent))', 'rgb(var(--rf-secondary))', 'rgb(var(--rf-tx))'];

function Stat({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div className="flex-1 basis-[120px] border border-line rounded-[var(--rf-radius)] px-5 py-[18px] bg-bg">
      <div className="font-display font-black text-[34px] leading-none" style={{ color }}>{value}</div>
      <div className="text-mut text-[13px] font-display tracking-[0.14em] uppercase mt-[6px]">{label}</div>
    </div>
  );
}

export default function Historia({ id = 'historia', props, sectionStyle }: { id?: string; props: HistoriaProps; sectionStyle?: SectionStyle }) {
  const o = sectionOverrides(sectionStyle, { bg: 'bg-panel border-y border-line', pad: SECTION_PAD });
  const titleLines = props.title.split('\n');
  return (
    <section id={id} data-screen-label="Historia" style={o.css} className={`scroll-mt-20 ${o.bgCls} ${SECTION_PX} ${o.padCls}`}>
      <div className="max-w-[1180px] mx-auto flex flex-wrap gap-[clamp(36px,5vw,72px)] items-center">
        <div className="flex-1 basis-[400px] min-w-[300px] order-2">
          {props.kicker && <div className="font-display font-bold text-[13px] tracking-[0.3em] uppercase text-gold mb-[18px]">{props.kicker}</div>}
          <h2 className="m-0 font-display font-black uppercase leading-[0.92] tracking-[-0.01em] text-[clamp(2.3rem,5vw,4rem)]">
            {titleLines.map((l, i) => <span key={i}>{i > 0 && <br />}{l}</span>)}
          </h2>
          <p className="mt-6 text-mut leading-[1.7] max-w-[520px] text-[clamp(16px,1.2vw,18px)]">{props.body}{props.bodyHighlight && <> <span className="text-tx font-semibold">{props.bodyHighlight}</span></>}</p>
          {props.stats.length > 0 && (
            <div className="flex flex-wrap gap-[14px] mt-[34px]">
              {props.stats.map((s, i) => <Stat key={i} value={s.value} label={s.label} color={STAT_COLORS[i % STAT_COLORS.length]!} />)}
            </div>
          )}
        </div>
        <div className="flex-1 basis-[360px] min-w-[300px] order-1">
          <div className="border border-line2 rounded-[var(--rf-radius)] overflow-hidden relative">
            <img src={props.imageUrl} alt="" className="block w-full h-auto" />
            {(props.imageTitle || props.imageSubtitle) && (
              <div className="absolute inset-x-0 bottom-0 px-5 pt-[34px] pb-[18px]" style={{ background: 'linear-gradient(transparent,rgb(var(--rf-bg) / .92))' }}>
                <div className="font-display font-extrabold text-[20px] tracking-[0.06em] uppercase text-white">{props.imageTitle}</div>
                <div className="text-mut text-[14px]">{props.imageSubtitle}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
