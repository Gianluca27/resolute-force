import type { PageDesignDoc, PageSection } from '@resolute/shared';
import { contrastWarnings } from '../../../lib/theme';
import { videoEmbedUrl } from '../../../lib/videoEmbed';
import { BLOCK_LABELS } from './blockDefs';

// Pre-publish checklist. Everything here is a soft block: the admin sees the
// list and can still publish. Hidden sections are skipped — they don't render.

export interface DesignIssue {
  severity: 'error' | 'warn';
  sectionId?: string;
  label: string;   // where ("Tema", "Hero", …)
  message: string; // what
}

/** Valid link targets: #ancla, ruta interna (/…) o URL http(s). */
function badHref(href: string): boolean {
  return !/^(#|\/|https?:\/\/)/.test(href.trim());
}

function ctaIssues(s: PageSection, ctaLabel: string, ctaHref: string): DesignIssue[] {
  const label = BLOCK_LABELS[s.type];
  if (!ctaLabel.trim()) return []; // no button rendered
  if (!ctaHref.trim()) return [{ severity: 'warn', sectionId: s.id, label, message: 'El botón tiene texto pero no tiene link: no va a llevar a ningún lado.' }];
  if (badHref(ctaHref)) return [{ severity: 'warn', sectionId: s.id, label, message: `El link del botón no parece válido: "${ctaHref}". Usá #seccion, /ruta o https://…` }];
  return [];
}

function sectionIssues(s: PageSection): DesignIssue[] {
  const label = BLOCK_LABELS[s.type];
  const noImage = (url: string): DesignIssue[] => url.trim()
    ? []
    : [{ severity: 'warn', sectionId: s.id, label, message: 'La sección no tiene imagen cargada.' }];

  switch (s.type) {
    case 'manifiesto': return noImage(s.props.imageUrl);
    case 'historia': return noImage(s.props.imageUrl);
    case 'textImage': return [...noImage(s.props.imageUrl), ...ctaIssues(s, s.props.ctaLabel, s.props.ctaHref)];
    case 'ctaBanner': return [
      ...(s.props.variant === 'image' && !s.props.imageUrl?.trim()
        ? [{ severity: 'warn' as const, sectionId: s.id, label, message: 'El estilo "Imagen" necesita una imagen de fondo.' }]
        : []),
      ...ctaIssues(s, s.props.ctaLabel, s.props.ctaHref),
    ];
    case 'gallery': return s.props.images.length === 0
      ? [{ severity: 'warn', sectionId: s.id, label, message: 'La galería está vacía: no se va a mostrar nada.' }]
      : [];
    case 'faq': return s.props.items.some((it) => it.q.trim() && !it.a.trim())
      ? [{ severity: 'warn', sectionId: s.id, label, message: 'Hay preguntas sin respuesta.' }]
      : [];
    case 'hero': return !s.props.title1.trim() && !s.props.title2.trim()
      ? [{ severity: 'warn', sectionId: s.id, label, message: 'El hero no tiene título.' }]
      : [];
    case 'videoEmbed': {
      if (!s.props.url.trim()) return [{ severity: 'warn', sectionId: s.id, label, message: 'No hay video cargado: la sección no se va a mostrar.' }];
      return videoEmbedUrl(s.props.url)
        ? []
        : [{ severity: 'warn', sectionId: s.id, label, message: 'No se reconoce la URL del video. Pegá un link de YouTube o Vimeo.' }];
    }
    case 'sizeTable': return s.props.rows.length === 0
      ? [{ severity: 'warn', sectionId: s.id, label, message: 'La tabla no tiene filas: la sección no se va a mostrar.' }]
      : [];
    default: return [];
  }
}

export function checkDesign(doc: PageDesignDoc): DesignIssue[] {
  const visible = doc.sections.filter((s) => s.visible);
  const issues: DesignIssue[] = [];

  if (visible.length === 0) {
    issues.push({ severity: 'error', label: 'Página', message: 'No hay ninguna sección visible: la página quedaría vacía.' });
  }
  for (const s of visible) issues.push(...sectionIssues(s));
  issues.push(...contrastWarnings(doc.theme).map((w) => ({ severity: 'warn' as const, label: 'Tema', message: w })));

  return issues.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1));
}
