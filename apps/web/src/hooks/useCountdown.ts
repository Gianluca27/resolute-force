import { useEffect, useState } from 'react';

const pad = (n: number) => String(n).padStart(2, '0');

export function diffParts(targetMs: number, nowMs: number) {
  let r = Math.max(0, targetMs - nowMs);
  const d = Math.floor(r / 86400000); r -= d * 86400000;
  const h = Math.floor(r / 3600000); r -= h * 3600000;
  const m = Math.floor(r / 60000); r -= m * 60000;
  const s = Math.floor(r / 1000);
  return { d: pad(d), h: pad(h), m: pad(m), s: pad(s) };
}

export function useCountdown(targetISO: string) {
  const target = Date.parse(targetISO);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return diffParts(target, now);
}
