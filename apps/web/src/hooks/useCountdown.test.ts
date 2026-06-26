import { describe, it, expect } from 'vitest';
import { diffParts } from './useCountdown';

describe('diffParts', () => {
  it('breaks a span into zero-padded d/h/m/s', () => {
    const now = Date.parse('2026-08-13T20:00:00-03:00');
    const target = Date.parse('2026-08-15T20:00:00-03:00');
    expect(diffParts(target, now)).toEqual({ d: '02', h: '00', m: '00', s: '00' });
  });
  it('clamps to zero in the past', () => {
    expect(diffParts(1000, 9999)).toEqual({ d: '00', h: '00', m: '00', s: '00' });
  });
});
