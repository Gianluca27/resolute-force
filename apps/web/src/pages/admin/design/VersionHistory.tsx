import { useEffect, useState } from 'react';
import { adminApi } from '../../../lib/adminApi';
import { useDesigner } from '../../../store/designer';
import ConfirmDialog from './ConfirmDialog';
import { IconX, IconHistory } from './icons';
import { btnCls } from './fields';

interface Version { id: number; publishedAt: string }

const fmt = new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeStyle: 'short' });

/**
 * Modal listing published snapshots. Restoring copies the snapshot into the
 * DRAFT (published stays live), then reloads the designer so the admin can
 * review it in the preview and publish when ready.
 */
export default function VersionHistory({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [error, setError] = useState('');
  const [restoreId, setRestoreId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setVersions(null); setError('');
    adminApi.listPageDesignVersions()
      .then((r) => setVersions(r.versions))
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudo cargar el historial'));
  }, [open]);

  if (!open) return null;

  const restore = async () => {
    if (restoreId == null) return;
    setBusy(true);
    try {
      await adminApi.restorePageDesignVersion(restoreId);
      await useDesigner.getState().load(); // fresh doc + lock token; history resets
      setRestoreId(null);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo restaurar');
      setRestoreId(null);
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Historial de versiones">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-panel border border-line rounded-[4px] w-full max-w-[480px] max-h-[70vh] flex flex-col shadow-2xl">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-line">
          <IconHistory size={16} />
          <div className="font-display font-bold text-[15px] tracking-[0.08em] uppercase">Historial de versiones</div>
          <button type="button" onClick={onClose} aria-label="Cerrar"
            className="ml-auto bg-transparent border-0 cursor-pointer text-mut hover:text-tx p-1"><IconX /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
          {error && <div className="text-red text-[13px] p-2">{error}</div>}
          {!error && versions === null && <div className="text-mut text-[13px] p-2">Cargando…</div>}
          {versions?.length === 0 && (
            <div className="text-mut text-[13px] border border-dashed border-line rounded-[3px] p-4 text-center">
              Todavía no hay versiones publicadas. Cada vez que publiques se guarda una acá.
            </div>
          )}
          {versions?.map((v, i) => (
            <div key={v.id} className="flex items-center gap-3 border border-line rounded-[3px] bg-card px-3 py-2">
              <div className="flex-1 min-w-0">
                <div className="text-tx text-[13px] font-display font-semibold tracking-[0.04em]">{fmt.format(new Date(v.publishedAt))}</div>
                <div className="text-mut text-[11px] font-display tracking-[0.08em] uppercase">{i === 0 ? 'Última publicada' : `Versión #${v.id}`}</div>
              </div>
              <button type="button" className={btnCls} onClick={() => setRestoreId(v.id)}>Restaurar</button>
            </div>
          ))}
        </div>

        <div className="px-4 py-2 border-t border-line text-mut text-[11px]">
          Restaurar copia esa versión al borrador. La página publicada no cambia hasta que vuelvas a publicar.
        </div>
      </div>

      <ConfirmDialog open={restoreId != null} title="Restaurar versión" confirmLabel={busy ? 'Restaurando…' : 'Restaurar versión'}
        onConfirm={restore} onCancel={() => setRestoreId(null)}>
        El borrador actual se reemplaza por esta versión. Los cambios sin publicar que tengas ahora se pierden.
      </ConfirmDialog>
    </div>
  );
}
