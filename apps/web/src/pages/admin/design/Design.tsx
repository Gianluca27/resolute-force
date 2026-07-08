import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { SectionType } from '@resolute/shared';
import { useDesigner } from '../../../store/designer';
import { BLOCK_LABELS, ADDABLE_TYPES, newSection } from './blockDefs';
import SectionList from './SectionList';
import SectionForm from './SectionForm';
import ThemeForm from './ThemeForm';
import ConfirmDialog from './ConfirmDialog';
import VersionHistory from './VersionHistory';
import { IconUndo, IconRedo, IconMonitor, IconPhone, IconExternal, IconHistory } from './icons';
import { btnCls, inputCls } from './fields';

// Full-screen designer: left panel (sections/theme forms) + live preview iframe.
// The iframe renders /admin/design/preview with the draft doc sent by postMessage,
// so the preview uses the real landing components without another fetch cycle.

export default function Design() {
  const { doc, dirty, saveState, error, selectedId, history, load, update, publish, discard, select, undo, redo } = useDesigner();
  const [tab, setTab] = useState<'secciones' | 'tema'>('secciones');
  const [addType, setAddType] = useState<SectionType>('textImage');
  const [mobile, setMobile] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [askDiscard, setAskDiscard] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => { void load(); }, [load]);

  // Push the draft to the preview on every change, and when the preview announces it's ready.
  useEffect(() => {
    if (!doc) return;
    iframeRef.current?.contentWindow?.postMessage({ type: 'rf-design-doc', doc }, window.location.origin);
  }, [doc]);
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const data = e.data as { type?: string; id?: string };
      if (data?.type === 'rf-preview-ready') {
        const d = useDesigner.getState().doc;
        if (d) iframeRef.current?.contentWindow?.postMessage({ type: 'rf-design-doc', doc: d }, window.location.origin);
      } else if (data?.type === 'rf-section-click' && data.id) {
        setTab('secciones');
        useDesigner.getState().select(data.id);
      } else if (data?.type === 'rf-undo') {
        useDesigner.getState().undo();
      } else if (data?.type === 'rf-redo') {
        useDesigner.getState().redo();
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  // Ctrl/Cmd+Z deshace, +Shift (o Ctrl+Y) rehace. Global on purpose: fields are
  // controlled by the store, so store-level undo is the only sane undo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'z') { e.preventDefault(); if (e.shiftKey) useDesigner.getState().redo(); else useDesigner.getState().undo(); }
      else if (k === 'y') { e.preventDefault(); useDesigner.getState().redo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Mirror the panel selection into the preview (outline + scroll into view).
  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage({ type: 'rf-select', id: selectedId }, window.location.origin);
  }, [selectedId]);

  if (!doc) {
    return <div className="min-h-screen bg-bg text-mut font-body flex items-center justify-center">{error || 'Cargando diseño…'}</div>;
  }

  const selected = selectedId ? doc.sections.find((s) => s.id === selectedId) : null;
  const saveLabel =
    saveState === 'saving' || saveState === 'pending' ? 'Guardando…'
    : saveState === 'error' ? 'Error al guardar'
    : saveState === 'conflict' ? 'Conflicto de edición'
    : 'Guardado';

  return (
    <div className="h-screen bg-bg text-tx font-body flex flex-col overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center gap-4 px-4 py-[10px] border-b border-line bg-panel shrink-0 flex-wrap">
        <Link to="/admin" className="text-mut hover:text-tx no-underline font-display font-semibold text-[13px] tracking-[0.1em] uppercase">← Admin</Link>
        <div className="font-display font-extrabold text-[16px] tracking-[0.16em] uppercase">Diseño de la página</div>
        <span className={`text-[12px] font-display tracking-[0.08em] uppercase ${saveState === 'error' || saveState === 'conflict' ? 'text-red' : 'text-mut'}`}>{saveLabel}</span>
        <div className="flex items-center gap-1">
          <button type="button" onClick={undo} disabled={history.past.length === 0} title="Deshacer (Ctrl+Z)" aria-label="Deshacer"
            className="bg-transparent border border-line2 rounded-[2px] text-mut hover:text-tx px-2 py-[6px] leading-none cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed"><IconUndo /></button>
          <button type="button" onClick={redo} disabled={history.future.length === 0} title="Rehacer (Ctrl+Shift+Z)" aria-label="Rehacer"
            className="bg-transparent border border-line2 rounded-[2px] text-mut hover:text-tx px-2 py-[6px] leading-none cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed"><IconRedo /></button>
        </div>
        <div className="ml-auto flex items-center gap-3 flex-wrap">
          {dirty && <span className="text-gold text-[12px] font-display font-semibold tracking-[0.08em] uppercase">● Cambios sin publicar</span>}
          <button type="button" onClick={() => setShowHistory(true)}
            className="inline-flex items-center gap-1 bg-transparent border-0 cursor-pointer text-mut hover:text-tx text-[12px] font-display tracking-[0.08em] uppercase transition-colors p-0">
            <IconHistory size={13} /> Historial
          </button>
          <a href="/" target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-mut hover:text-tx no-underline text-[12px] font-display tracking-[0.08em] uppercase transition-colors">Ver publicada <IconExternal size={12} /></a>
          <button type="button" className={btnCls} disabled={!dirty} onClick={() => setAskDiscard(true)}>
            Descartar
          </button>
          <button type="button" disabled={!dirty || publishing || saveState === 'conflict'}
            onClick={async () => { setPublishing(true); try { await publish(); } finally { setPublishing(false); } }}
            className="bg-red text-white border-0 rounded-[2px] px-5 py-[9px] font-display font-bold text-[13px] tracking-[0.12em] uppercase cursor-pointer hover:bg-redd disabled:opacity-40 disabled:cursor-not-allowed">
            {publishing ? 'Publicando…' : 'Publicar'}
          </button>
        </div>
      </header>

      {(saveState === 'conflict' || saveState === 'error') && (
        <div className="bg-red/15 border-b border-red/40 text-red px-4 py-2 text-[13px] flex items-center gap-3 shrink-0">
          {error}
          {saveState === 'conflict' && (
            <button type="button" className="underline cursor-pointer bg-transparent border-0 text-red" onClick={() => void load()}>Recargar</button>
          )}
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        {/* Left panel */}
        <aside className="w-[360px] shrink-0 border-r border-line bg-panel flex flex-col min-h-0">
          <div className="flex border-b border-line shrink-0">
            {(['secciones', 'tema'] as const).map((t) => (
              <button key={t} type="button" onClick={() => { setTab(t); select(null); }}
                className={`flex-1 py-[10px] font-display font-bold text-[13px] tracking-[0.12em] uppercase cursor-pointer border-0 ${tab === t ? 'bg-bg text-tx' : 'bg-transparent text-mut hover:text-tx'}`}>
                {t === 'secciones' ? 'Secciones' : 'Tema'}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {tab === 'tema' ? (
              <ThemeForm theme={doc.theme} />
            ) : selected ? (
              <div className="flex flex-col gap-3">
                <button type="button" onClick={() => select(null)} className="self-start bg-transparent border-0 cursor-pointer text-mut hover:text-tx font-display font-semibold text-[12px] tracking-[0.1em] uppercase p-0">← Secciones</button>
                <div className="font-display font-bold text-[15px] tracking-[0.08em] uppercase">{BLOCK_LABELS[selected.type]}</div>
                <SectionForm key={selected.id} section={selected} />
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <SectionList sections={doc.sections} onOpen={(id) => select(id)} />
                <div className="flex gap-2 items-end border-t border-line pt-3">
                  <div className="flex-1">
                    <label className="flex flex-col gap-[6px]">
                      <span className="text-mut text-[11px] font-display font-semibold tracking-[0.14em] uppercase">Agregar sección</span>
                      <select className={inputCls} value={addType} onChange={(e) => setAddType(e.target.value as SectionType)}>
                        {ADDABLE_TYPES.map((t) => <option key={t} value={t}>{BLOCK_LABELS[t]}</option>)}
                      </select>
                    </label>
                  </div>
                  <button type="button" className={btnCls} onClick={() => {
                    const s = newSection(addType);
                    update((d) => ({ ...d, sections: [...d.sections, s] }));
                    select(s.id);
                  }}>+ Agregar</button>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Preview */}
        <main className="flex-1 min-w-0 bg-bg flex flex-col">
          <div className="flex items-center justify-center gap-2 py-2 border-b border-line shrink-0">
            <button type="button" onClick={() => setMobile(false)} aria-label="Vista escritorio"
              className={`${btnCls} inline-flex items-center gap-[6px] ${!mobile ? 'border-gold text-gold' : ''}`}><IconMonitor size={13} /> Escritorio</button>
            <button type="button" onClick={() => setMobile(true)} aria-label="Vista móvil"
              className={`${btnCls} inline-flex items-center gap-[6px] ${mobile ? 'border-gold text-gold' : ''}`}><IconPhone size={13} /> Móvil</button>
          </div>
          <div className="flex-1 min-h-0 flex justify-center overflow-hidden p-3">
            <iframe
              ref={iframeRef}
              title="Vista previa"
              src="/admin/design/preview"
              className={`h-full border border-line rounded-[4px] bg-white transition-all ${mobile ? 'w-[390px]' : 'w-full'}`}
            />
          </div>
        </main>
      </div>

      <VersionHistory open={showHistory} onClose={() => setShowHistory(false)} />
      <ConfirmDialog open={askDiscard} title="Descartar cambios" confirmLabel="Descartar todo"
        onConfirm={async () => { setAskDiscard(false); await discard(); }} onCancel={() => setAskDiscard(false)}>
        Se pierden todos los cambios sin publicar y el borrador vuelve a la última versión publicada. Esto no se puede deshacer.
      </ConfirmDialog>
    </div>
  );
}
