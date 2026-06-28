// Domain-level HTTP error: carries a 4xx status and a client-safe message.
// The global error handler honors `.status` and exposes `.message` for these (and only these),
// so services can translate failures (duplicate slug, missing row) into clean responses.
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

// Prisma known-request errors carry a string `code` (e.g. P2002 unique, P2025 not-found).
export function prismaErrorCode(e: unknown): string | undefined {
  return e && typeof e === 'object' && typeof (e as { code?: unknown }).code === 'string'
    ? (e as { code: string }).code
    : undefined;
}
