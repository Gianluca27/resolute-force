import type { Prisma } from '@prisma/client';
import { DEFAULT_PAGE_DESIGN, type PageDesignDoc, type PageDesignAdminDTO } from '@resolute/shared';
import { prisma } from '../prisma.js';
import { HttpError } from '../lib/httpError.js';

// Reads return the stored JSON as-is: the write path (Zod in the route) is the
// validity guarantee. Re-validating on read would brick the public page after
// a code rollback that no longer knows a section type — the web renderer
// skips unknown types instead.

// Initial doc = defaults + any hero/marquee values the admin already edited in
// SiteContent (pre-builder installs). Shared by the seed and the lazy init below.
export async function buildInitialDesignDoc(): Promise<PageDesignDoc> {
  const content = await prisma.siteContent.findFirst({ orderBy: { id: 'asc' } });
  const doc: PageDesignDoc = JSON.parse(JSON.stringify(DEFAULT_PAGE_DESIGN));
  if (content) {
    for (const s of doc.sections) {
      if (s.type === 'marquee') {
        try { s.props.items = (JSON.parse(content.marquee) as string[]).slice(0, 12); } catch { /* keep defaults */ }
      } else if (s.type === 'hero') {
        s.props.kicker = content.heroKicker;
        s.props.title1 = content.heroTitle1;
        s.props.title2 = content.heroTitle2;
        s.props.subtitle = content.heroSubtitle;
      }
    }
  }
  return doc;
}

async function getRow() {
  // findFirst (not findUnique id:1): tolerant of singleton id drift, same as DropConfig.
  const row = await prisma.pageDesign.findFirst({ orderBy: { id: 'asc' } });
  if (row) return row;
  // Lazy init: deploys run `migrate deploy` but never the seed, so the table can
  // exist without its singleton row. upsert (not create) so a concurrent first
  // request doesn't hit the unique constraint.
  const doc = (await buildInitialDesignDoc()) as unknown as Prisma.InputJsonValue;
  return prisma.pageDesign.upsert({ where: { id: 1 }, update: {}, create: { id: 1, draft: doc, published: doc } });
}

function toAdminDTO(row: { draft: unknown; published: unknown; updatedAt: Date }): PageDesignAdminDTO {
  return {
    draft: row.draft as PageDesignDoc,
    // jsonb normalizes key order, so string equality is a reliable draft-vs-published diff.
    dirty: JSON.stringify(row.draft) !== JSON.stringify(row.published),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getPublishedDesign(): Promise<PageDesignDoc> {
  return (await getRow()).published as PageDesignDoc;
}

export async function getDraftDesign(): Promise<PageDesignAdminDTO> {
  return toAdminDTO(await getRow());
}

// Optimistic concurrency, same convention as drop/content config (H-06).
function assertFresh(expected: string | undefined, actual: Date): void {
  if (expected && expected !== actual.toISOString()) {
    throw new HttpError(409, 'El diseño fue modificado en otra sesión. Recargá la página y reintentá.');
  }
}

export async function updateDraftDesign(doc: PageDesignDoc, expectedUpdatedAt?: string): Promise<PageDesignAdminDTO> {
  const existing = await getRow();
  assertFresh(expectedUpdatedAt, existing.updatedAt);
  const row = await prisma.pageDesign.update({
    where: { id: existing.id },
    data: { draft: doc as unknown as Prisma.InputJsonValue },
  });
  return toAdminDTO(row);
}

const MAX_VERSIONS = 20;

export async function publishDesign(): Promise<PageDesignAdminDTO> {
  const existing = await getRow();
  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.pageDesign.update({
      where: { id: existing.id },
      data: { published: existing.draft as Prisma.InputJsonValue },
    });
    // Snapshot the newly published doc and prune beyond the newest MAX_VERSIONS.
    await tx.pageDesignVersion.create({ data: { doc: existing.draft as Prisma.InputJsonValue } });
    const stale = await tx.pageDesignVersion.findMany({
      orderBy: { id: 'desc' }, skip: MAX_VERSIONS, select: { id: true },
    });
    if (stale.length) await tx.pageDesignVersion.deleteMany({ where: { id: { in: stale.map((v) => v.id) } } });
    return updated;
  });
  return toAdminDTO(row);
}

export async function listDesignVersions(): Promise<Array<{ id: number; publishedAt: string }>> {
  const rows = await prisma.pageDesignVersion.findMany({ orderBy: { id: 'desc' }, select: { id: true, publishedAt: true } });
  return rows.map((r) => ({ id: r.id, publishedAt: r.publishedAt.toISOString() }));
}

/** Copies a snapshot into the draft. Published is untouched — the admin previews and re-publishes. */
export async function restoreDesignVersion(id: number): Promise<PageDesignAdminDTO> {
  const version = await prisma.pageDesignVersion.findUnique({ where: { id } });
  if (!version) throw new HttpError(404, 'Versión no encontrada');
  const existing = await getRow();
  const row = await prisma.pageDesign.update({
    where: { id: existing.id },
    data: { draft: version.doc as Prisma.InputJsonValue },
  });
  return toAdminDTO(row);
}

export async function discardDraftDesign(): Promise<PageDesignAdminDTO> {
  const existing = await getRow();
  const row = await prisma.pageDesign.update({
    where: { id: existing.id },
    data: { draft: existing.published as Prisma.InputJsonValue },
  });
  return toAdminDTO(row);
}
