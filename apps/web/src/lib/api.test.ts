import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => vi.unstubAllGlobals());

it('products() fetches /api/products and returns JSON', async () => {
  const payload = [{ id: '1', line: 'Champion Mentality' }];
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(payload) });
  vi.stubGlobal('fetch', fetchMock);
  const { api } = await import('./api');
  await expect(api.products()).resolves.toEqual(payload);
  expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/products'));
});

it('throws on non-ok responses', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, json: () => Promise.resolve({}) }));
  const { api } = await import('./api');
  await expect(api.drop()).rejects.toThrow(/500/);
});
