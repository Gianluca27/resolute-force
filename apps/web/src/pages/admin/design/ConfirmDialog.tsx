import { useEffect, type ReactNode } from 'react';
import { btnCls } from './fields';

/**
 * In-app replacement for window.confirm. Renders nothing while `open` is
 * false. Escape cancels; the danger button gets focus-visible styling only —
 * no autofocus, so a stray Enter can't destroy anything.
 */
export default function ConfirmDialog({ open, title, children, confirmLabel, onConfirm, onCancel }: {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div className="relative bg-panel border border-line rounded-[4px] w-full max-w-[420px] p-5 flex flex-col gap-3 shadow-2xl">
        <div className="font-display font-bold text-[15px] tracking-[0.08em] uppercase text-tx">{title}</div>
        {children && <div className="text-mut text-[13px] leading-relaxed">{children}</div>}
        <div className="flex justify-end gap-2 mt-1">
          <button type="button" className={btnCls} onClick={onCancel}>Cancelar</button>
          <button type="button"
            className="bg-red text-white border-0 rounded-[2px] px-4 py-[8px] font-display font-bold text-[12px] tracking-[0.1em] uppercase cursor-pointer hover:bg-redd"
            onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
