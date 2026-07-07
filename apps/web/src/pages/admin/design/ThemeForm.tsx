import { FONT_OPTIONS, type Theme } from '@resolute/shared';
import { useDesigner } from '../../../store/designer';
import { THEME_PRESETS } from '../../../lib/themePresets';
import { contrastWarnings } from '../../../lib/theme';
import { ColorField, SelectField, Segmented } from './fields';

const COLOR_FIELDS: Array<{ key: keyof Theme['colors']; label: string }> = [
  { key: 'bg', label: 'Fondo' },
  { key: 'panel', label: 'Paneles' },
  { key: 'card', label: 'Tarjetas' },
  { key: 'text', label: 'Texto' },
  { key: 'muted', label: 'Texto secundario' },
  { key: 'accent', label: 'Acento' },
  { key: 'accentDark', label: 'Acento (hover)' },
  { key: 'secondary', label: 'Secundario (dorado)' },
];

const fontOptions = FONT_OPTIONS.map((f) => ({ value: f.id, label: f.label }));

export default function ThemeForm({ theme }: { theme: Theme }) {
  const update = useDesigner((s) => s.update);
  const patch = (t: Partial<Theme>) => update((doc) => ({ ...doc, theme: { ...doc.theme, ...t } }));
  const warnings = contrastWarnings(theme);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <span className="text-mut text-[11px] font-display font-semibold tracking-[0.14em] uppercase">Presets</span>
        <div className="flex flex-wrap gap-[6px]">
          {THEME_PRESETS.map((p) => (
            <button key={p.id} type="button" onClick={() => patch({ colors: { ...p.colors } })}
              className="flex items-center gap-2 bg-card border border-line2 rounded-[2px] px-[10px] py-[7px] cursor-pointer hover:border-gold">
              <span className="flex">
                {[p.colors.bg, p.colors.accent, p.colors.secondary].map((c, i) => (
                  <span key={i} className="w-[14px] h-[14px] rounded-full border border-line2 -ml-1 first:ml-0" style={{ background: c }} />
                ))}
              </span>
              <span className="text-tx text-[12px] font-display font-semibold tracking-[0.08em] uppercase">{p.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <span className="text-mut text-[11px] font-display font-semibold tracking-[0.14em] uppercase">Colores</span>
        <div className="grid grid-cols-2 gap-x-3 gap-y-3">
          {COLOR_FIELDS.map(({ key, label }) => (
            <ColorField key={key} label={label} value={theme.colors[key]}
              onChange={(v) => patch({ colors: { ...theme.colors, [key]: v } })} />
          ))}
        </div>
        {warnings.length > 0 && (
          <div className="border border-gold/40 bg-gold/10 rounded-[3px] p-3 flex flex-col gap-1">
            <div className="text-gold text-[12px] font-display font-bold tracking-[0.1em] uppercase">⚠ Contraste bajo</div>
            {warnings.map((w, i) => <div key={i} className="text-mut text-[12px]">{w}</div>)}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <span className="text-mut text-[11px] font-display font-semibold tracking-[0.14em] uppercase">Tipografías</span>
        <SelectField label="Títulos" value={theme.fonts.display}
          onChange={(v) => patch({ fonts: { ...theme.fonts, display: v as Theme['fonts']['display'] } })} options={fontOptions} />
        <SelectField label="Cuerpo" value={theme.fonts.body}
          onChange={(v) => patch({ fonts: { ...theme.fonts, body: v as Theme['fonts']['body'] } })} options={fontOptions} />
      </div>

      <div className="flex flex-col gap-3">
        <span className="text-mut text-[11px] font-display font-semibold tracking-[0.14em] uppercase">Formas</span>
        <div className="flex flex-col gap-[6px]">
          <span className="text-mut text-[11px] font-display font-semibold tracking-[0.1em] uppercase">Bordes redondeados: {theme.shapes.radius}px</span>
          <input type="range" min={0} max={24} step={2} value={theme.shapes.radius} aria-label="Bordes redondeados"
            onChange={(e) => patch({ shapes: { ...theme.shapes, radius: Number(e.target.value) } })}
            className="w-full accent-[rgb(var(--rf-accent))]" />
        </div>
        <Segmented label="Botones" value={theme.shapes.buttonStyle}
          onChange={(v) => patch({ shapes: { ...theme.shapes, buttonStyle: v } })}
          options={[{ value: 'square', label: 'Rectos' }, { value: 'rounded', label: 'Redondeados' }, { value: 'pill', label: 'Pill' }]} />
      </div>
    </div>
  );
}
