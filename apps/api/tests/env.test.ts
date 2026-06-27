import { describe, it, expect } from 'vitest';
import { parseEnv } from '../src/env.js';

describe('env validation', () => {
  it('rejects the insecure default JWT_SECRET in production', () => {
    expect(() => parseEnv({ NODE_ENV: 'production', JWT_SECRET: 'dev-secret-change-me-in-production!!' })).toThrow(/JWT_SECRET/);
  });

  it('rejects a missing JWT_SECRET in production (falls back to insecure default)', () => {
    expect(() => parseEnv({ NODE_ENV: 'production' })).toThrow(/JWT_SECRET/);
  });

  it('rejects the placeholder MP_ACCESS_TOKEN in production', () => {
    expect(() => parseEnv({ NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(40), MP_ACCESS_TOKEN: 'TEST-ACCESS-TOKEN' })).toThrow(/MP_ACCESS_TOKEN/);
  });

  it('accepts a strong, real configuration in production', () => {
    expect(() =>
      parseEnv({ NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(40), MP_ACCESS_TOKEN: 'APP-USR-real-token' }),
    ).not.toThrow();
  });

  it('keeps permissive dev defaults outside production', () => {
    const e = parseEnv({});
    expect(e.JWT_SECRET.length).toBeGreaterThanOrEqual(32);
    expect(e.NODE_ENV).toBe('development');
  });
});
