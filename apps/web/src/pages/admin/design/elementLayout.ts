import type { PageDesignDoc, PageSection, SectionLayout } from '@resolute/shared';

// Pure doc operations behind element drag/resize/reset. Offsets and widths are
// rounded and clamped to the shared-schema bounds so a wild drag can never
// produce a doc the API would reject.

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(v)));

function patchSection(doc: PageDesignDoc, sectionId: string, fn: (s: PageSection) => PageSection): PageDesignDoc {
  if (!doc.sections.some((s) => s.id === sectionId)) return doc;
  return { ...doc, sections: doc.sections.map((s) => (s.id === sectionId ? fn(s) : s)) };
}

/** Drop empty entries; return undefined when nothing is left. */
function cleaned(layout: SectionLayout): SectionLayout | undefined {
  const entries = Object.entries(layout).filter(([, l]) => l.dx !== 0 || l.dy !== 0 || l.w != null);
  return entries.length ? Object.fromEntries(entries) : undefined;
}

export function moveElement(doc: PageDesignDoc, sectionId: string, key: string, dx: number, dy: number): PageDesignDoc {
  return patchSection(doc, sectionId, (s) => {
    const prev = s.layout?.[key];
    const layout = cleaned({
      ...s.layout,
      [key]: { dx: clamp(dx, -2000, 2000), dy: clamp(dy, -2000, 2000), ...(prev?.w != null ? { w: prev.w } : {}) },
    });
    return { ...s, layout };
  });
}

export function resizeElement(doc: PageDesignDoc, sectionId: string, key: string, w: number): PageDesignDoc {
  return patchSection(doc, sectionId, (s) => {
    const prev = s.layout?.[key];
    return { ...s, layout: { ...s.layout, [key]: { dx: prev?.dx ?? 0, dy: prev?.dy ?? 0, w: clamp(w, 40, 2000) } } };
  });
}

export function resetElement(doc: PageDesignDoc, sectionId: string, key: string): PageDesignDoc {
  return patchSection(doc, sectionId, (s) => {
    if (!s.layout?.[key]) return s;
    const { [key]: _drop, ...rest } = s.layout;
    return { ...s, layout: Object.keys(rest).length ? rest : undefined };
  });
}

export function resetSectionLayout(doc: PageDesignDoc, sectionId: string): PageDesignDoc {
  return patchSection(doc, sectionId, (s) => ({ ...s, layout: undefined }));
}
