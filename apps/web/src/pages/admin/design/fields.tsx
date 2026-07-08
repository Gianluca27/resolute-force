import { useRef, useState, type ReactNode } from 'react';
import { adminApi } from '../../../lib/adminApi';
import { IconUp, IconDown } from './icons';

export const inputCls = 'w-full bg-card border border-line2 rounded-[3px] text-tx px-3 py-[9px] text-[14px] outline-none focus:border-gold';
export const btnCls = 'bg-card border border-line2 rounded-[2px] text-tx px-3 py-[7px] text-[12px] font-display font-semibold tracking-[0.08em] uppercase cursor-pointer hover:border-gold disabled:opacity-40 disabled:cursor-not-allowed';

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-[6px]">
      <span className="text-mut text-[11px] font-display font-semibold tracking-[0.14em] uppercase">{label}</span>
      {children}
    </label>
  );
}

export function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <Field label={label}>
      <input className={inputCls} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

export function TextAreaField({ label, value, onChange, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <Field label={label}>
      <textarea className={inputCls} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

export function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <Field label={label}>
      <select className={inputCls} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </Field>
  );
}

export function Segmented<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: Array<{ value: T; label: string }> }) {
  return (
    <div className="flex flex-col gap-[6px]">
      <span className="text-mut text-[11px] font-display font-semibold tracking-[0.14em] uppercase">{label}</span>
      <div className="flex gap-[4px]">
        {options.map((o) => (
          <button key={o.value} type="button" onClick={() => onChange(o.value)}
            className={`flex-1 px-2 py-[7px] text-[12px] font-display font-semibold tracking-[0.06em] uppercase rounded-[2px] border cursor-pointer ${o.value === value ? 'bg-red text-white border-red' : 'bg-card text-mut border-line2 hover:text-tx'}`}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [text, setText] = useState<string | null>(null); // local text while typing an incomplete hex
  return (
    <div className="flex items-center gap-2">
      <input type="color" aria-label={label} value={value} onChange={(e) => { onChange(e.target.value); setText(null); }}
        className="w-8 h-8 shrink-0 rounded-[3px] border border-line2 bg-transparent cursor-pointer p-0" />
      <div className="flex-1 min-w-0">
        <div className="text-mut text-[11px] font-display font-semibold tracking-[0.1em] uppercase truncate">{label}</div>
        <input className="w-full bg-transparent border-0 outline-none text-tx text-[13px] font-mono" value={text ?? value}
          onChange={(e) => {
            const v = e.target.value.trim();
            setText(v);
            if (/^#[0-9a-fA-F]{6}$/.test(v)) { onChange(v); setText(null); }
          }}
          onBlur={() => setText(null)} />
      </div>
    </div>
  );
}

export function ImageField({ label, value, onChange }: { label: string; value: string; onChange: (url: string, publicId?: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col gap-[6px]">
      <span className="text-mut text-[11px] font-display font-semibold tracking-[0.14em] uppercase">{label}</span>
      <div className="flex items-center gap-2">
        <div className="w-14 h-14 shrink-0 rounded-[3px] border border-line2 bg-card overflow-hidden">
          {value && <img src={value} alt="" className="w-full h-full object-cover" />}
        </div>
        <div className="flex-1 flex flex-col gap-[6px] min-w-0">
          <input className={inputCls} value={value} placeholder="URL de imagen" onChange={(e) => onChange(e.target.value)} />
          <button type="button" disabled={busy} className={btnCls} onClick={() => fileRef.current?.click()}>
            {busy ? 'Subiendo…' : 'Subir imagen'}
          </button>
        </div>
      </div>
      {err && <div className="text-red text-[12px]">{err}</div>}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setBusy(true); setErr('');
        try {
          const { url, publicId } = await adminApi.uploadAsset(file);
          onChange(url, publicId);
        } catch (e2) { setErr(e2 instanceof Error ? e2.message : 'No se pudo subir'); }
        finally { setBusy(false); }
      }} />
    </div>
  );
}

/** Frame for one item of an editable list (remove + reorder controls). */
export function ItemRow({ children, onRemove, onUp, onDown }: { children: ReactNode; onRemove: () => void; onUp?: () => void; onDown?: () => void }) {
  return (
    <div className="border border-line rounded-[3px] p-2 flex flex-col gap-2 bg-panel">
      {children}
      <div className="flex gap-1 justify-end">
        {onUp && <button type="button" className={btnCls} onClick={onUp} aria-label="Subir"><IconUp size={13} /></button>}
        {onDown && <button type="button" className={btnCls} onClick={onDown} aria-label="Bajar"><IconDown size={13} /></button>}
        <button type="button" className={`${btnCls} hover:border-red hover:text-red`} onClick={onRemove}>Quitar</button>
      </div>
    </div>
  );
}

export function moveItem<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length) return arr;
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}
