import { useState } from 'react';
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { PageSection } from '@resolute/shared';
import { useDesigner } from '../../../store/designer';
import { BLOCK_LABELS, blockSummary } from './blockDefs';
import { IconGrip, IconEye, IconEyeOff, IconCopy, IconTrash } from './icons';
import ConfirmDialog from './ConfirmDialog';

const rowBtn = 'bg-transparent border-0 cursor-pointer text-mut hover:text-tx px-1 py-1 transition-colors';

function Row({ section, onOpen, onAskRemove }: { section: PageSection; onOpen: () => void; onAskRemove: () => void }) {
  const update = useDesigner((s) => s.update);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });

  const toggle = () => update((doc) => ({
    ...doc,
    sections: doc.sections.map((s) => s.id === section.id ? { ...s, visible: !s.visible } : s),
  }));
  const duplicate = () => update((doc) => {
    const i = doc.sections.findIndex((s) => s.id === section.id);
    const copy: PageSection = { ...JSON.parse(JSON.stringify(section)) as PageSection, id: `${section.type}-${crypto.randomUUID().slice(0, 8)}` };
    const sections = [...doc.sections];
    sections.splice(i + 1, 0, copy);
    return { ...doc, sections };
  });

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-1 border border-line rounded-[3px] bg-card px-2 py-[9px] transition-colors ${isDragging ? 'opacity-60 border-gold z-10 relative' : 'hover:border-line2'} ${section.visible ? '' : 'opacity-50'}`}>
      <button type="button" {...attributes} {...listeners} aria-label="Reordenar"
        className={`${rowBtn} cursor-grab active:cursor-grabbing`}><IconGrip /></button>
      <button type="button" onClick={onOpen} className="flex-1 min-w-0 text-left bg-transparent border-0 cursor-pointer">
        <div className="text-tx font-display font-bold text-[13px] tracking-[0.06em] uppercase truncate">{BLOCK_LABELS[section.type]}</div>
        <div className="text-mut text-[12px] truncate">{blockSummary(section)}</div>
      </button>
      <button type="button" onClick={toggle} title={section.visible ? 'Ocultar' : 'Mostrar'} aria-label={section.visible ? 'Ocultar' : 'Mostrar'}
        className={rowBtn}>{section.visible ? <IconEye /> : <IconEyeOff />}</button>
      <button type="button" onClick={duplicate} title="Duplicar" aria-label="Duplicar" className={rowBtn}><IconCopy /></button>
      <button type="button" onClick={onAskRemove} title="Eliminar" aria-label="Eliminar" className={`${rowBtn} hover:text-red`}><IconTrash /></button>
    </div>
  );
}

export default function SectionList({ sections, onOpen }: { sections: PageSection[]; onOpen: (id: string) => void }) {
  const update = useDesigner((s) => s.update);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    update((doc) => {
      const from = doc.sections.findIndex((s) => s.id === active.id);
      const to = doc.sections.findIndex((s) => s.id === over.id);
      return { ...doc, sections: arrayMove(doc.sections, from, to) };
    });
  };

  const removing = removeId ? sections.find((s) => s.id === removeId) : null;
  const confirmRemove = () => {
    if (removeId) update((doc) => ({ ...doc, sections: doc.sections.filter((s) => s.id !== removeId) }));
    setRemoveId(null);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-[6px]">
          {sections.length === 0 && (
            <div className="text-mut text-[13px] border border-dashed border-line rounded-[3px] p-4 text-center">
              La página está vacía. Agregá tu primera sección abajo.
            </div>
          )}
          {sections.map((s) => <Row key={s.id} section={s} onOpen={() => onOpen(s.id)} onAskRemove={() => setRemoveId(s.id)} />)}
        </div>
      </SortableContext>
      <ConfirmDialog open={removing != null} title="Eliminar sección" confirmLabel="Eliminar sección"
        onConfirm={confirmRemove} onCancel={() => setRemoveId(null)}>
        {removing && <>Se va a eliminar <strong className="text-tx">{BLOCK_LABELS[removing.type]}</strong>. Podés deshacerlo con Ctrl+Z.</>}
      </ConfirmDialog>
    </DndContext>
  );
}
