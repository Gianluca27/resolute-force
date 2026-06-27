import { describe, it, expect, vi } from 'vitest';
import { errorHandler } from '../src/middleware/error.js';

function mockRes() {
  const res: { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> } = {} as never;
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

describe('errorHandler', () => {
  it('does not leak internal/DB error messages to clients in production', () => {
    const prev = process.env.NODE_ENV;
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    process.env.NODE_ENV = 'production';
    const res = mockRes();
    errorHandler(new Error('Prisma: column secret_token does not exist'), {} as never, res as never, (() => {}) as never);
    process.env.NODE_ENV = prev;
    spy.mockRestore();
    expect(res.status).toHaveBeenCalledWith(500);
    const body = res.json.mock.calls[0]![0] as { error: string };
    expect(body.error).not.toMatch(/secret_token|Prisma/);
  });
});
