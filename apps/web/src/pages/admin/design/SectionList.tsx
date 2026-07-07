import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { PageSection } from '@resolute/shared';
import { useDesigner } from '../../../store/designer';
import { BLOCK_LABELS, blockSummary } from './blockDefs';

function Row({ section, onOpen }: { section: PageSection; onOpen: () => void }) {
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
  const remove = () => {
    if (!window.confirm(`¿Eliminar la sección "${BLOCK_LABELS[section.type]}"?`)) return;
    update((doc) => ({ ...doc, sections: doc.sections.filter((s) => s.id !== section.id) }));
  };

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 border border-line rounded-[3px] bg-card px-2 py-[9px] ${isDragging ? 'opacity-60 border-gold z-10 relative' : ''} ${section.visible ? '' : 'opacity-50'}`}>
      <button type="button" {...attributes} {...listeners} aria-label="Reordenar" className="cursor-grab active:cursor-grabbing text-mut hover:text-tx bg-transparent border-0 px-1 text-[15px] leading-none">⠿</button>
      <button type="button" onClick={onOpen} className="flex-1 min-w-0 text-left bg-transparent border-0 cursor-pointer">
        <div className="text-tx font-display font-bold text-[13px] tracking-[0.06em] uppercase truncate">{BLOCK_LABELS[section.type]}</div>
        <div className="text-mut text-[12px] truncate">{blockSummary(section)}</div>
      </button>
      <button type="button" onClick={toggle} title={section.visible ? 'Ocultar' : 'Mostrar'} aria-label={section.visible ? 'Ocultar' : 'Mostrar'}
        className="bg-transparent border-0 cursor-pointer text-[15px] text-mut hover:text-tx px-1">{section.visible ? '👁' : '🚫'}</button>
      <button type="button" onClick={duplicate} title="Duplicar" aria-label="Duplicar" className="bg-transparent border-0 cursor-pointer text-[14px] text-mut hover:text-tx px-1">⧉</button>
      <button type="button" onClick={remove} title="Eliminar" aria-label="Eliminar" className="bg-transparent border-0 cursor-pointer text-[14px] text-mut hover:text-red px-1">✕</button>
    </div>
  );
}

export default function SectionList({ sections, onOpen }: { sections: PageSection[]; onOpen: (id: string) => void }) {
  const update = useDesigner((s) => s.update);
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

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-[6px]">
          {sections.map((s) => <Row key={s.id} section={s} onOpen={() => onOpen(s.id)} />)}
        </div>
      </SortableContext>
    </DndContext>
  );
}
