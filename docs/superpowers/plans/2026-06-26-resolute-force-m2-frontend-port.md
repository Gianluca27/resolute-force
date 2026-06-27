# M2 — Frontend: Faithful React + Tailwind Landing

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use `- [ ]`. Read the master file first (owns design tokens, copy strings, asset map, DTOs). Requires M1 complete (`git tag m1-catalog-api`) — the API must serve `/api/products`, `/api/drop`, `/api/content`.

**Goal:** Reproduce the source landing pixel-faithfully in React + Tailwind, data-driven from the API: marquee, nav (cart button stub), hero, manifiesto, productos grid, historia, próximos countdown, contacto, footer.

**Architecture:** `App` wraps `QueryClientProvider` + `BrowserRouter`. `Landing` fetches products/drop/content via TanStack Query hooks and composes presentational components. Cart wiring is stubbed here (`onAdd`, `onOpenCart`, `cartCount` props) and connected in M3. Components carry the source's exact tokens/classes.

**Tech Stack:** React 18, React Router 6, TanStack Query 5, Tailwind 3.4 (tokens from M0).

**Deliverable:** `npm run dev:web` renders a page visually identical to the source, populated from the DB; all web tests green.

---

### Task 1: Data layer — API client, query hooks, providers, router

**Files:**
- Modify: `apps/web/package.json`, `apps/web/src/App.tsx`, `apps/web/src/main.tsx`
- Create: `apps/web/src/vite-env.d.ts`, `apps/web/src/lib/api.ts`, `apps/web/src/lib/money.ts`, `apps/web/src/lib/queryClient.ts`, `apps/web/src/hooks/useCatalog.ts`, `apps/web/src/pages/Landing.tsx`
- Test: `apps/web/src/lib/money.test.ts`, `apps/web/src/lib/api.test.ts`

**Interfaces:**
- Produces: `api.{products,drop,content}()`, `money(n)`, `useProducts()`, `useDrop()`, `useContent()`, `<Landing/>`. M3–M6 consume `api` and `money`.

- [ ] **Step 1: Add web dependencies**

```bash
npm install --workspace @resolute/web @tanstack/react-query@^5.59.0 react-router-dom@^6.27.0
```

- [ ] **Step 2: Write `apps/web/src/vite-env.d.ts`**

```ts
/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_MP_PUBLIC_KEY?: string;
}
interface ImportMeta { readonly env: ImportMetaEnv; }
```

- [ ] **Step 3: Write the failing test `apps/web/src/lib/money.test.ts`**

```ts
import { money } from './money';
it('formats integer ARS with es-AR thousands separators', () => {
  expect(money(30000)).toBe('$30.000');
  expect(money(27000)).toBe('$27.000');
  expect(money(0)).toBe('$0');
});
```

- [ ] **Step 4: Run it (fail), then write `apps/web/src/lib/money.ts`**

Run: `npm test --workspace @resolute/web -- money` → FAIL (no module).

```ts
export const money = (n: number): string => '$' + Math.round(n).toLocaleString('es-AR');
```

Re-run → PASS.

- [ ] **Step 5: Write the failing test `apps/web/src/lib/api.test.ts`**

```ts
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
```

- [ ] **Step 6: Run it (fail), then write `apps/web/src/lib/api.ts`**

```ts
import type { ProductDTO, DropDTO, ContentDTO } from '@resolute/shared';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API ${res.status} on ${path}`);
  return (await res.json()) as T;
}

export const api = {
  products: () => get<ProductDTO[]>('/api/products'),
  drop: () => get<DropDTO>('/api/drop'),
  content: () => get<ContentDTO>('/api/content'),
};
```

Re-run → both PASS.

- [ ] **Step 7: Write `apps/web/src/lib/queryClient.ts`**

```ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false } },
});
```

- [ ] **Step 8: Write `apps/web/src/hooks/useCatalog.ts`**

```ts
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export const useProducts = () => useQuery({ queryKey: ['products'], queryFn: api.products });
export const useDrop = () => useQuery({ queryKey: ['drop'], queryFn: api.drop });
export const useContent = () => useQuery({ queryKey: ['content'], queryFn: api.content });
```

- [ ] **Step 9: Write `apps/web/src/pages/Landing.tsx`** (temporary shell; components are added in later tasks)

```tsx
export default function Landing() {
  return <div data-testid="landing" className="min-h-screen bg-bg text-tx font-body" />;
}
```

- [ ] **Step 10: Rewrite `apps/web/src/App.tsx`** (providers + router)

```tsx
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { queryClient } from './lib/queryClient';
import Landing from './pages/Landing';

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 11: Fix the M0 smoke test** (`App` no longer renders the wordmark directly)

Replace `apps/web/src/App.test.tsx` with:

```tsx
import { render, screen } from '@testing-library/react';
import App from './App';

it('renders the landing shell', () => {
  render(<App />);
  expect(screen.getByTestId('landing')).toBeInTheDocument();
});
```

- [ ] **Step 12: Run the full web suite + commit**

Run: `npm test --workspace @resolute/web` → all PASS.

```bash
git add -A && git commit -m "feat(web): api client, query hooks, router + providers, money util"
```

---

### Task 2: Countdown hook + Próximos + Marquee

**Files:**
- Create: `apps/web/src/hooks/useCountdown.ts`, `apps/web/src/components/Proximos.tsx`, `apps/web/src/components/Marquee.tsx`
- Test: `apps/web/src/hooks/useCountdown.test.ts`, `apps/web/src/components/Proximos.test.tsx`, `apps/web/src/components/Marquee.test.tsx`

**Interfaces:**
- Produces: `useCountdown(targetISO)` + pure `diffParts(targetMs, nowMs)` → `{ d,h,m,s }` (zero-padded strings); `<Proximos drop={DropDTO}/>` (renders `null` when `!visible`); `<Marquee items={string[]}/>`.

- [ ] **Step 1: Write the failing test `apps/web/src/hooks/useCountdown.test.ts`**

```ts
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
```

- [ ] **Step 2: Run (fail), then write `apps/web/src/hooks/useCountdown.ts`**

```ts
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
```

Re-run → PASS.

- [ ] **Step 3: Write the failing test `apps/web/src/components/Proximos.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import Proximos from './Proximos';

const drop = { targetAt: '2026-08-15T20:00:00-03:00', visible: true, title: 'Algo se está forjando', teaser: 'Un nuevo drop…' };

it('renders the countdown labels when visible', () => {
  render(<Proximos drop={drop} />);
  expect(screen.getByText('Días')).toBeInTheDocument();
  expect(screen.getByText('Próximo lanzamiento')).toBeInTheDocument();
});

it('renders nothing when not visible', () => {
  const { container } = render(<Proximos drop={{ ...drop, visible: false }} />);
  expect(container).toBeEmptyDOMElement();
});
```

- [ ] **Step 4: Run (fail), then write `apps/web/src/components/Proximos.tsx`**

```tsx
import type { DropDTO } from '@resolute/shared';
import { useCountdown } from '../hooks/useCountdown';

function Cell({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div className="min-w-[78px] border border-line2 rounded bg-[rgba(14,14,16,0.6)] px-[10px] py-4">
      <div className={`font-display font-black leading-none text-[clamp(34px,5vw,48px)] ${accent ? 'text-gold' : 'text-tx'}`}>{value}</div>
      <div className="font-display text-[12px] tracking-[0.2em] uppercase text-mut mt-1">{label}</div>
    </div>
  );
}

export default function Proximos({ drop }: { drop: DropDTO }) {
  const cd = useCountdown(drop.targetAt);
  if (!drop.visible) return null;
  return (
    <section id="proximos" data-screen-label="Proximos" className="relative overflow-hidden text-center px-[clamp(18px,5vw,64px)] py-[clamp(70px,11vh,130px)] scroll-mt-20">
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(70vw,640px)] h-[min(70vw,640px)] animate-ember"
           style={{ background: 'radial-gradient(circle,rgba(232,181,62,.16),rgba(228,50,43,.08) 45%,transparent 70%)' }} />
      <div className="relative z-[2] max-w-[760px] mx-auto">
        <img src="/assets/logo-r.png" alt="" width={64} height={64} className="w-16 h-16 object-contain opacity-90 mb-6 mx-auto" style={{ filter: 'drop-shadow(0 0 22px rgba(232,181,62,.5))' }} />
        <div className="font-display font-bold text-[13px] tracking-[0.34em] uppercase text-gold mb-[18px]">Próximo lanzamiento</div>
        <h2 className="m-0 font-display font-black uppercase leading-[0.88] tracking-[-0.01em] text-[clamp(2.6rem,7vw,5.6rem)]">
          Algo se está<br /><span className="text-gold" style={{ textShadow: '0 0 50px rgba(232,181,62,.45)' }}>forjando</span>
        </h2>
        <p className="mx-auto mt-[22px] max-w-[480px] text-mut leading-[1.6] text-[clamp(16px,1.2vw,18px)]">{drop.teaser}</p>
        <div className="flex flex-wrap justify-center gap-[clamp(10px,2vw,20px)] mt-[42px]">
          <Cell value={cd.d} label="Días" />
          <Cell value={cd.h} label="Horas" />
          <Cell value={cd.m} label="Min" />
          <Cell value={cd.s} label="Seg" accent />
        </div>
      </div>
    </section>
  );
}
```

Re-run → both PASS.

- [ ] **Step 5: Write the failing test `apps/web/src/components/Marquee.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import Marquee from './Marquee';

it('renders each item duplicated for a seamless loop', () => {
  render(<Marquee items={['Envíos a todo el país', 'Champion Mentality']} />);
  expect(screen.getAllByText('Champion Mentality')).toHaveLength(2);
});
```

- [ ] **Step 6: Run (fail), then write `apps/web/src/components/Marquee.tsx`**

```tsx
export default function Marquee({ items }: { items: string[] }) {
  const loop = [...items, ...items];
  return (
    <div className="bg-red text-white overflow-hidden whitespace-nowrap border-b border-black/25 relative z-40">
      <div className="inline-flex items-center animate-marquee will-change-transform py-[9px] font-display font-bold text-[13px] tracking-[0.22em] uppercase">
        {loop.map((t, i) => (
          <span key={i} className="inline-flex items-center">
            <span className="px-[26px]">{t}</span>
            <span className="opacity-[0.55]">◆</span>
          </span>
        ))}
      </div>
    </div>
  );
}
```

Re-run → PASS.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(web): countdown hook, Proximos drop section, Marquee"
```

---

### Task 3: Nav, Hero, Footer

**Files:**
- Create: `apps/web/src/components/Nav.tsx`, `apps/web/src/components/Hero.tsx`, `apps/web/src/components/Footer.tsx`
- Test: `apps/web/src/components/Nav.test.tsx`, `apps/web/src/components/Hero.test.tsx`

**Interfaces:**
- Consumes: `ContentDTO`.
- Produces: `<Nav cartCount onOpenCart/>`, `<Hero content/>`, `<Footer/>`. M3 passes the real cart count + open handler into `Nav`.

- [ ] **Step 1: Write the failing test `apps/web/src/components/Nav.test.tsx`**

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import Nav from './Nav';

it('shows the cart count badge and fires onOpenCart', () => {
  const onOpenCart = vi.fn();
  render(<Nav cartCount={3} onOpenCart={onOpenCart} />);
  expect(screen.getByText('3')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /carrito/i }));
  expect(onOpenCart).toHaveBeenCalledOnce();
});

it('hides the badge when the cart is empty', () => {
  render(<Nav cartCount={0} onOpenCart={() => {}} />);
  expect(screen.queryByTestId('cart-badge')).toBeNull();
});
```

- [ ] **Step 2: Run (fail), then write `apps/web/src/components/Nav.tsx`**

```tsx
const linkCls = 'no-underline text-mut font-display font-semibold text-[15px] tracking-[0.16em] uppercase transition-colors hover:text-tx';

export default function Nav({ cartCount, onOpenCart }: { cartCount: number; onOpenCart: () => void }) {
  return (
    <nav className="sticky top-0 z-50 flex items-center justify-between gap-6 flex-wrap px-[clamp(18px,5vw,64px)] py-[14px] bg-[rgba(10,10,11,0.78)] backdrop-blur-[14px] border-b border-line">
      <a href="#inicio" className="flex items-center gap-3 no-underline text-tx">
        <img src="/assets/logo-r.png" alt="Resolute Force" width={34} height={34} className="block w-[34px] h-[34px] object-contain" />
        <span className="font-display font-extrabold text-[21px] tracking-[0.2em] uppercase leading-none">Resolute<span className="text-red">·</span>Force</span>
      </a>
      <div className="flex items-center gap-[clamp(14px,2.4vw,34px)] flex-wrap">
        <a href="#productos" className={linkCls}>Productos</a>
        <a href="#manifiesto" className={linkCls}>Manifiesto</a>
        <a href="#historia" className={linkCls}>Historia</a>
        <a href="#contacto" className={linkCls}>Contacto</a>
        <button onClick={onOpenCart} className="relative flex items-center gap-[9px] bg-tx text-bg border-0 rounded-[2px] py-[10px] pl-[14px] pr-4 cursor-pointer font-display font-bold text-[14px] tracking-[0.14em] uppercase transition-transform hover:-translate-y-px">
          <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8h12l-1.2 11.2a1.5 1.5 0 0 1-1.5 1.3H8.7a1.5 1.5 0 0 1-1.5-1.3L6 8Z" /><path d="M9 8a3 3 0 0 1 6 0" /></svg>
          Carrito
          {cartCount > 0 && (
            <span data-testid="cart-badge" className="absolute -top-[7px] -right-[7px] min-w-[21px] h-[21px] px-[5px] flex items-center justify-center bg-red text-white rounded-[11px] text-[12px] font-bold font-display border-2 border-bg">{cartCount}</span>
          )}
        </button>
      </div>
    </nav>
  );
}
```

Re-run → both PASS.

- [ ] **Step 3: Write the failing test `apps/web/src/components/Hero.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import Hero from './Hero';

const content = { heroKicker: 'Est. 2024 · …', heroTitle1: 'Champion', heroTitle2: 'Mentality', heroSubtitle: 'No vendemos remeras…' } as any;

it('renders both hero title lines and the kicker', () => {
  render(<Hero content={content} />);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Champion');
  expect(screen.getByText('Mentality')).toBeInTheDocument();
  expect(screen.getByText(/Est\. 2024/)).toBeInTheDocument();
});
```

- [ ] **Step 4: Run (fail), then write `apps/web/src/components/Hero.tsx`**

```tsx
import type { ContentDTO } from '@resolute/shared';

const badgeCls = 'flex items-center gap-[9px] text-mut text-[13.5px] font-display font-semibold tracking-[0.13em] uppercase';

export default function Hero({ content }: { content: ContentDTO }) {
  return (
    <section id="inicio" data-screen-label="Hero" className="relative scroll-mt-20 min-h-[88vh] flex items-center overflow-hidden px-[clamp(18px,5vw,64px)] pt-[clamp(48px,9vh,120px)] pb-[clamp(40px,7vh,90px)]">
      <div className="pointer-events-none absolute right-[-2%] top-[46%] -translate-y-1/2 w-[min(64vw,760px)] opacity-[0.05]">
        <img src="/assets/logo-r.png" alt="" className="w-full h-auto block grayscale" />
      </div>
      <div className="pointer-events-none absolute right-[4%] top-[34%] w-[min(52vw,620px)] h-[min(52vw,620px)] blur-[14px]" style={{ background: 'radial-gradient(circle,rgba(228,50,43,.20),transparent 62%)' }} />
      <div className="relative z-[2] max-w-[1180px] mx-auto w-full">
        <div className="inline-flex items-center gap-3 mb-[26px]">
          <span className="w-[30px] h-[2px] bg-gold inline-block" />
          <span className="font-display font-bold text-[13px] tracking-[0.3em] uppercase text-gold">{content.heroKicker}</span>
        </div>
        <h1 className="m-0 font-display font-black uppercase leading-[0.82] tracking-[-0.02em] text-[clamp(3.6rem,11vw,9.5rem)]">
          <span className="block text-tx">{content.heroTitle1}</span>
          <span className="block text-red" style={{ textShadow: '0 0 60px rgba(228,50,43,.35)' }}>{content.heroTitle2}</span>
        </h1>
        <p className="max-w-[540px] mt-[30px] text-mut leading-[1.6] text-[clamp(16px,1.3vw,19px)]">{content.heroSubtitle} <span className="text-tx font-semibold">Esta es la norma Resolute.</span></p>
        <div className="flex flex-wrap gap-[14px] mt-[38px]">
          <a href="#productos" className="inline-flex items-center gap-[10px] bg-red text-white no-underline font-display font-bold text-[17px] tracking-[0.13em] uppercase px-[34px] py-[17px] rounded-[2px] transition hover:bg-redd hover:-translate-y-[2px]">Ver colección
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </a>
          <a href="#manifiesto" className="inline-flex items-center gap-[10px] bg-transparent text-tx no-underline font-display font-bold text-[17px] tracking-[0.13em] uppercase px-[32px] py-[17px] rounded-[2px] border border-line2 transition hover:border-gold hover:text-gold">El manifiesto</a>
        </div>
        <div className="flex flex-wrap gap-[26px] mt-[50px] pt-[26px] border-t border-line max-w-[620px]">
          <div className={badgeCls}><span className="text-gold">◆</span> Envíos a todo el país</div>
          <div className={badgeCls}><span className="text-gold">◆</span> 3 cuotas sin interés</div>
          <div className={badgeCls}><span className="text-gold">◆</span> Algodón premium</div>
        </div>
      </div>
      <div className="absolute left-1/2 bottom-[22px] -translate-x-1/2 flex flex-col items-center gap-[7px] text-mut animate-float z-[2]">
        <span className="font-display text-[11px] tracking-[0.3em] uppercase">Scroll</span>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M6 13l6 6 6-6" /></svg>
      </div>
    </section>
  );
}
```

Re-run → PASS.

- [ ] **Step 5: Write `apps/web/src/components/Footer.tsx`** (static; no test needed — pure markup)

```tsx
const head = 'font-display font-bold text-[13px] tracking-[0.2em] uppercase text-mut mb-4';
const fl = 'no-underline text-tx text-[15px] transition-colors hover:text-gold';
const badge = 'text-mut text-[12px] font-display tracking-[0.12em] uppercase border border-line rounded-[2px] px-[11px] py-[6px]';

export default function Footer() {
  return (
    <footer className="bg-bg border-t border-line px-[clamp(18px,5vw,64px)] pt-[clamp(48px,7vh,72px)] pb-[34px]">
      <div className="max-w-[1180px] mx-auto flex flex-wrap gap-10 justify-between">
        <div className="flex-1 basis-[280px] max-w-[360px]">
          <div className="flex items-center gap-3 mb-4">
            <img src="/assets/logo-r.png" alt="" width={34} height={34} className="w-[34px] h-[34px] object-contain" />
            <span className="font-display font-extrabold text-[21px] tracking-[0.2em] uppercase">Resolute<span className="text-red">·</span>Force</span>
          </div>
          <p className="text-mut text-[15px] leading-[1.6] m-0">Indumentaria deportiva para los que entrenan bajo presión. Champion Mentality.</p>
        </div>
        <div className="flex gap-[clamp(34px,6vw,80px)] flex-wrap">
          <div>
            <div className={head}>Tienda</div>
            <div className="flex flex-col gap-[11px]"><a href="#productos" className={fl}>Productos</a><a href="#proximos" className={fl}>Próximos drops</a><a href="#productos" className={fl}>Guía de talles</a></div>
          </div>
          <div>
            <div className={head}>Marca</div>
            <div className="flex flex-col gap-[11px]"><a href="#manifiesto" className={fl}>Manifiesto</a><a href="#historia" className={fl}>Historia</a><a href="#contacto" className={fl}>Contacto</a></div>
          </div>
          <div>
            <div className={head}>Seguinos</div>
            <div className="flex flex-col gap-[11px]"><a href="https://instagram.com" target="_blank" rel="noopener" className={fl}>Instagram</a><a href="https://wa.me/5493413213723" target="_blank" rel="noopener" className={fl}>WhatsApp</a></div>
          </div>
        </div>
      </div>
      <div className="max-w-[1180px] mx-auto mt-[38px] pt-[22px] border-t border-line flex flex-wrap gap-[14px] justify-between items-center">
        <div className="text-mut text-[13px] font-display tracking-[0.1em] uppercase">© 2026 Resolute Force · Hecho en Argentina</div>
        <div className="flex gap-[10px] flex-wrap"><span className={badge}>Transferencia</span><span className={badge}>Tarjeta</span><span className={badge}>Mercado Pago</span></div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(web): Nav (cart stub), Hero, Footer"
```

---

### Task 4: Manifiesto, Historia, Contacto

**Files:**
- Create: `apps/web/src/components/Manifiesto.tsx`, `apps/web/src/components/Historia.tsx`, `apps/web/src/components/Contacto.tsx`
- Test: `apps/web/src/components/Contacto.test.tsx`

**Interfaces:**
- Consumes: `ContentDTO` (Contacto).
- Produces: `<Manifiesto/>`, `<Historia/>`, `<Contacto content/>`.

- [ ] **Step 1: Write the failing test `apps/web/src/components/Contacto.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import Contacto from './Contacto';

const content = { contactWhatsapp: '5493413213723', contactInstagram: '@resoluteforceok', contactEmail: 'resolutecontacto@gmail.com', contactLocation: 'Buenos Aires · Envíos a todo el país' } as any;

it('builds a wa.me link and shows the contact channels', () => {
  render(<Contacto content={content} />);
  expect(screen.getByText('@resoluteforceok')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /whatsapp/i })).toHaveAttribute('href', expect.stringContaining('wa.me/5493413213723'));
  expect(screen.getByText('resolutecontacto@gmail.com')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run (fail), then write `apps/web/src/components/Contacto.tsx`**

```tsx
import type { ContentDTO } from '@resolute/shared';

const card = 'no-underline text-tx bg-card border border-line rounded-[4px] px-[22px] py-[26px] flex flex-col gap-[14px] transition hover:-translate-y-1';

export default function Contacto({ content }: { content: ContentDTO }) {
  const wa = `https://wa.me/${content.contactWhatsapp}?text=Hola%20Resolute%20Force%2C%20quiero%20hacer%20un%20pedido`;
  return (
    <section id="contacto" data-screen-label="Contacto" className="scroll-mt-20 bg-panel border-t border-line px-[clamp(18px,5vw,64px)] py-[clamp(64px,10vh,120px)]">
      <div className="max-w-[1180px] mx-auto">
        <div className="text-center mb-[44px]">
          <div className="font-display font-bold text-[13px] tracking-[0.3em] uppercase text-gold mb-[14px]">Sumate al ejército</div>
          <h2 className="m-0 font-display font-black uppercase leading-[0.9] tracking-[-0.01em] text-[clamp(2.4rem,5.6vw,4.4rem)]">Hablemos</h2>
          <p className="mx-auto mt-4 max-w-[440px] text-mut text-[16px] leading-[1.6]">¿Dudas con un talle, un envío o querés tu remera? Escribinos, te respondemos rápido.</p>
        </div>
        <div className="grid gap-[16px] [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
          <a href={wa} target="_blank" rel="noopener" className={`${card} hover:border-gold`}>
            <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" className="text-gold"><path d="M12 2a10 10 0 0 0-8.5 15.2L2 22l4.9-1.5A10 10 0 1 0 12 2Zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-2.9.9.9-2.8-.2-.3A8 8 0 1 1 12 20Zm4.5-5.9c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1a6.6 6.6 0 0 1-3.2-2.8c-.2-.4.2-.4.6-1.2.1-.1 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5a1 1 0 0 0-.7.3c-.3.3-.9.9-.9 2.1s.9 2.5 1 2.6c.1.2 1.8 2.8 4.4 3.9 1.6.7 2.3.7 3 .6.5 0 1.4-.6 1.6-1.1.2-.6.2-1 .1-1.1l-.5-.2Z" /></svg>
            <div><div className="font-display font-bold text-[19px] tracking-[0.06em] uppercase">WhatsApp</div><div className="text-mut text-[14px] mt-[3px]">+54 341 321-3723</div></div>
          </a>
          <a href="https://instagram.com" target="_blank" rel="noopener" className={`${card} hover:border-red`}>
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-red"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none" /></svg>
            <div><div className="font-display font-bold text-[19px] tracking-[0.06em] uppercase">Instagram</div><div className="text-mut text-[14px] mt-[3px]">{content.contactInstagram}</div></div>
          </a>
          <a href={`mailto:${content.contactEmail}`} className={`${card} hover:border-line2`}>
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-tx"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
            <div><div className="font-display font-bold text-[19px] tracking-[0.06em] uppercase">Email</div><div className="text-mut text-[14px] mt-[3px]">{content.contactEmail}</div></div>
          </a>
          <div className="bg-card border border-line rounded-[4px] px-[22px] py-[26px] flex flex-col gap-[14px]">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-gold"><path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" /><circle cx="12" cy="10" r="2.5" /></svg>
            <div><div className="font-display font-bold text-[19px] tracking-[0.06em] uppercase">Ubicación</div><div className="text-mut text-[14px] mt-[3px]">{content.contactLocation}</div></div>
          </div>
        </div>
      </div>
    </section>
  );
}
```

Re-run → PASS.

- [ ] **Step 3: Write `apps/web/src/components/Manifiesto.tsx`** (static copy; image = teaser-burst)

```tsx
function Principle({ n, title, sub, color }: { n: string; title: string; sub: string; color: string }) {
  return (
    <div className="flex items-baseline gap-[18px] py-[18px] border-t border-line">
      <span className="font-display font-extrabold text-[15px] tracking-[0.1em] w-[34px] shrink-0" style={{ color }}>{n}</span>
      <div>
        <div className="font-display font-bold text-[22px] tracking-[0.04em] uppercase">{title}</div>
        <div className="text-mut text-[15px] mt-[2px]">{sub}</div>
      </div>
    </div>
  );
}

export default function Manifiesto() {
  return (
    <section id="manifiesto" data-screen-label="Manifiesto" className="scroll-mt-20 bg-panel border-y border-line px-[clamp(18px,5vw,64px)] py-[clamp(64px,10vh,120px)]">
      <div className="max-w-[1180px] mx-auto flex flex-wrap gap-[clamp(36px,5vw,72px)] items-center">
        <div className="flex-1 basis-[360px] min-w-[300px] relative">
          <div className="pointer-events-none absolute -inset-[10px] blur-[8px]" style={{ background: 'radial-gradient(circle at 50% 40%,rgba(228,50,43,.18),transparent 70%)' }} />
          <div className="relative border border-line2 rounded-[3px] overflow-hidden bg-black">
            <img src="/assets/teaser-burst.png" alt="Atleta Resolute Force rompiendo el papel" className="block w-full h-auto" />
            <div className="absolute left-4 top-4 bg-[rgba(10,10,11,0.7)] backdrop-blur-[6px] border border-line2 text-gold font-display font-bold text-[12px] tracking-[0.2em] uppercase px-3 py-[7px] rounded-[2px]">Champions think under pressure</div>
          </div>
        </div>
        <div className="flex-1 basis-[420px] min-w-[300px]">
          <div className="font-display font-bold text-[13px] tracking-[0.3em] uppercase text-gold mb-[18px]">El Manifiesto</div>
          <h2 className="m-0 font-display font-black uppercase leading-[0.92] tracking-[-0.01em] text-[clamp(2.4rem,5.4vw,4.4rem)]">La presión no te quiebra.<br /><span className="text-red">Te forja.</span></h2>
          <p className="mt-6 text-mut leading-[1.7] max-w-[520px] text-[clamp(16px,1.2vw,18px)]">Cada prenda lleva un recordatorio en la espalda: lo que te define no es el talento, es la mentalidad. Disciplina cuando nadie mira. Constancia cuando todo cuesta. <span className="text-tx font-semibold">Ser campeón se decide mucho antes de competir.</span></p>
          <div className="flex flex-col mt-9">
            <Principle n="01" title="Champions think under pressure" sub="La mente decide antes que el cuerpo." color="#e4322b" />
            <Principle n="02" title="Discipline is the key" sub="La constancia construye lo que la motivación promete." color="#e8b53e" />
            <div className="border-b border-line"><Principle n="03" title="Stop at nothing" sub="No hay plan B para los que van por todo." color="#f4f4f3" /></div>
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Write `apps/web/src/components/Historia.tsx`** (static; image = lifestyle-gym)

```tsx
function Stat({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div className="flex-1 basis-[120px] border border-line rounded-[3px] px-5 py-[18px] bg-bg">
      <div className="font-display font-black text-[34px] leading-none" style={{ color }}>{value}</div>
      <div className="text-mut text-[13px] font-display tracking-[0.14em] uppercase mt-[6px]">{label}</div>
    </div>
  );
}

export default function Historia() {
  return (
    <section id="historia" data-screen-label="Historia" className="scroll-mt-20 bg-panel border-y border-line px-[clamp(18px,5vw,64px)] py-[clamp(64px,10vh,120px)]">
      <div className="max-w-[1180px] mx-auto flex flex-wrap gap-[clamp(36px,5vw,72px)] items-center">
        <div className="flex-1 basis-[400px] min-w-[300px] order-2">
          <div className="font-display font-bold text-[13px] tracking-[0.3em] uppercase text-gold mb-[18px]">Sobre la marca</div>
          <h2 className="m-0 font-display font-black uppercase leading-[0.92] tracking-[-0.01em] text-[clamp(2.3rem,5vw,4rem)]">Nacida en el gimnasio,<br />forjada en la disciplina</h2>
          <p className="mt-6 text-mut leading-[1.7] max-w-[520px] text-[clamp(16px,1.2vw,18px)]">Resolute Force nació en 2024 entre pesas, madrugadas y la convicción de que la ropa con la que entrenás debería recordarte quién querés ser. Empezamos imprimiendo unas pocas remeras para amigos del gym. Hoy somos una comunidad de atletas que comparten una misma norma: <span className="text-tx font-semibold">no rendirse nunca.</span></p>
          <div className="flex flex-wrap gap-[14px] mt-[34px]">
            <Stat value="2024" label="Año de fundación" color="#e4322b" />
            <Stat value="+5.000" label="Atletas en el ejército" color="#e8b53e" />
            <Stat value="100%" label="Algodón premium" color="#f4f4f3" />
          </div>
        </div>
        <div className="flex-1 basis-[360px] min-w-[300px] order-1">
          <div className="border border-line2 rounded-[3px] overflow-hidden relative">
            <img src="/assets/lifestyle-gym.png" alt="Colección Resolute Force en el gimnasio" className="block w-full h-auto" />
            <div className="absolute inset-x-0 bottom-0 px-5 pt-[34px] pb-[18px]" style={{ background: 'linear-gradient(transparent,rgba(10,10,11,.92))' }}>
              <div className="font-display font-extrabold text-[20px] tracking-[0.06em] uppercase text-white">The Resolute Standard</div>
              <div className="text-mut text-[14px]">Donde la presión se convierte en carácter.</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(web): Manifiesto, Historia, Contacto sections"
```

---

### Task 5: ProductCard + Productos grid

**Files:**
- Create: `apps/web/src/components/ProductCard.tsx`, `apps/web/src/components/Productos.tsx`
- Test: `apps/web/src/components/ProductCard.test.tsx`

**Interfaces:**
- Consumes: `ProductDTO`.
- Produces: `<ProductCard product onAdd/>` where `onAdd(product: ProductDTO, size: string)`; `<Productos products onAdd/>`. M3 passes the cart's `addToCart` as `onAdd`.

- [ ] **Step 1: Write the failing test `apps/web/src/components/ProductCard.test.tsx`**

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import ProductCard from './ProductCard';

const product = {
  id: 'p1', slug: 'champion-mentality-negro', line: 'Champion Mentality', color: 'Negro',
  dotColor: '#101013', tag: 'Nuevo', price: 30000, imageUrl: '/assets/tile-black.png',
  sizes: [{ size: 'S', stock: 5 }, { size: 'M', stock: 5 }, { size: 'L', stock: 5 }, { size: 'XL', stock: 5 }],
};

it('defaults to size M and adds with the selected size', () => {
  const onAdd = vi.fn();
  render(<ProductCard product={product as any} onAdd={onAdd} />);
  fireEvent.click(screen.getByRole('button', { name: 'L' }));
  fireEvent.click(screen.getByRole('button', { name: /agregar/i }));
  expect(onAdd).toHaveBeenCalledWith(product, 'L');
});

it('shows the price and tag', () => {
  render(<ProductCard product={product as any} onAdd={() => {}} />);
  expect(screen.getByText('$30.000')).toBeInTheDocument();
  expect(screen.getByText('Nuevo')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run (fail), then write `apps/web/src/components/ProductCard.tsx`**

```tsx
import { useState } from 'react';
import type { ProductDTO } from '@resolute/shared';
import { money } from '../lib/money';

export default function ProductCard({ product, onAdd }: { product: ProductDTO; onAdd: (p: ProductDTO, size: string) => void }) {
  const [sel, setSel] = useState('M');
  return (
    <div className="relative bg-card border border-line rounded-[4px] overflow-hidden flex flex-col transition hover:-translate-y-[5px] hover:border-line2 hover:shadow-[0_18px_40px_-20px_rgba(0,0,0,0.8)]">
      {product.tag && (
        <span className="absolute top-3 left-3 z-[2] bg-red text-white font-display font-bold text-[11px] tracking-[0.16em] uppercase px-[11px] py-[6px] rounded-[2px]">{product.tag}</span>
      )}
      <div className="aspect-square overflow-hidden bg-[#d2d2cf]">
        <img src={product.imageUrl} alt={`Remera Resolute Force ${product.color}`} className="block w-full h-full object-cover" />
      </div>
      <div className="px-[18px] pt-[18px] pb-5 flex flex-col gap-[14px] flex-1">
        <div>
          <h3 className="m-0 font-display font-bold text-[22px] tracking-[0.03em] uppercase leading-none">{product.line}</h3>
          <div className="flex items-center gap-2 mt-[7px] text-mut text-[13.5px] font-display tracking-[0.1em] uppercase">
            <span className="w-[11px] h-[11px] rounded-full border border-white/25 inline-block" style={{ background: product.dotColor }} />{product.color}
          </div>
        </div>
        <div className="flex gap-[7px]">
          {product.sizes.map(({ size }) => {
            const active = size === sel;
            return (
              <button key={size} onClick={() => setSel(size)}
                className={`flex-1 min-w-0 rounded-[2px] py-[9px] cursor-pointer font-display font-bold text-[14px] tracking-[0.06em] uppercase transition ${active ? 'bg-tx text-bg border border-tx' : 'bg-transparent text-mut border border-line2'}`}>
                {size}
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-between gap-3 mt-auto pt-[6px]">
          <span className="font-display font-extrabold text-[26px] tracking-[0.01em]">{money(product.price)}</span>
          <button onClick={() => onAdd(product, sel)} className="inline-flex items-center gap-2 bg-tx text-bg border-0 rounded-[2px] px-4 py-[11px] cursor-pointer font-display font-bold text-[14px] tracking-[0.12em] uppercase transition hover:bg-red hover:text-white">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            Agregar
          </button>
        </div>
      </div>
    </div>
  );
}
```

Re-run → both PASS.

- [ ] **Step 3: Write `apps/web/src/components/Productos.tsx`**

```tsx
import type { ProductDTO } from '@resolute/shared';
import ProductCard from './ProductCard';

export default function Productos({ products, onAdd }: { products: ProductDTO[]; onAdd: (p: ProductDTO, size: string) => void }) {
  return (
    <section id="productos" data-screen-label="Productos" className="scroll-mt-20 px-[clamp(18px,5vw,64px)] py-[clamp(64px,10vh,120px)] max-w-[1280px] mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-5 mb-[44px]">
        <div>
          <div className="font-display font-bold text-[13px] tracking-[0.3em] uppercase text-gold mb-[14px]">Nuestros productos</div>
          <h2 className="m-0 font-display font-black uppercase leading-[0.9] tracking-[-0.01em] text-[clamp(2.4rem,5.6vw,4.6rem)]">La colección<br /><span className="text-mut">Resolute '26</span></h2>
        </div>
        <p className="max-w-[340px] text-mut text-[15.5px] leading-[1.6] m-0">Remeras de algodón premium con estampas de la línea Champion Mentality y Stop at Nothing. Disponibles en todos los talles.</p>
      </div>
      <div className="grid gap-[18px] [grid-template-columns:repeat(auto-fill,minmax(258px,1fr))]">
        {products.map((p) => <ProductCard key={p.id} product={p} onAdd={onAdd} />)}
      </div>
      <p className="text-center text-mut text-[14px] mt-[34px] font-display tracking-[0.1em] uppercase">Precios en pesos · 3 cuotas sin interés · 10% OFF pagando por transferencia</p>
    </section>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(web): ProductCard with size selector + Productos grid"
```

---

### Task 6: Assets, Landing assembly, full-page integration test

**Files:**
- Create: `apps/web/public/assets/*` (from the source zip)
- Modify: `apps/web/src/pages/Landing.tsx`
- Test: `apps/web/src/pages/Landing.test.tsx`

**Interfaces:**
- Consumes: `useProducts`, `useDrop`, `useContent`, all components.
- Produces: full landing. Cart props are still stubbed (`cartCount={0}`, `onOpenCart`/`onAdd` no-ops) — M3 replaces them.

- [ ] **Step 1: Extract the bundled images into `public/assets`**

```bash
cd apps/web && mkdir -p public/assets
unzip -j "../../_source/Sitio web Resolute Force.zip" 'assets/*' -d public/assets
ls public/assets   # expect: logo-r.png tile-*.png prod-*.png lifestyle-gym.png teaser-burst.png
```

- [ ] **Step 2: Write the failing test `apps/web/src/pages/Landing.test.tsx`**

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { QueryClient } from '@tanstack/react-query';
import { vi } from 'vitest';
import Landing from './Landing';

vi.mock('../lib/api', () => ({
  api: {
    products: () => Promise.resolve([{ id: 'p1', slug: 's', line: 'Champion Mentality', color: 'Negro', dotColor: '#101013', tag: null, price: 30000, imageUrl: '/assets/tile-black.png', sizes: [{ size: 'M', stock: 5 }] }]),
    drop: () => Promise.resolve({ targetAt: '2026-08-15T20:00:00-03:00', visible: true, title: 'Algo se está forjando', teaser: 'x' }),
    content: () => Promise.resolve({ marquee: ['Champion Mentality'], heroKicker: 'Est. 2024', heroTitle1: 'Champion', heroTitle2: 'Mentality', heroSubtitle: 'Sub', transferDiscountPct: 10, bankAlias: '', bankCbu: '', contactWhatsapp: '549', contactInstagram: '@resoluteforceok', contactEmail: 'a@b.com', contactLocation: 'BA' }),
  },
}));

function renderLanding() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><Landing /></QueryClientProvider>);
}

it('renders hero + product + countdown once data loads', async () => {
  renderLanding();
  expect(await screen.findByRole('heading', { level: 1, name: /champion/i })).toBeInTheDocument();
  await waitFor(() => expect(screen.getByText('Días')).toBeInTheDocument());
  expect(screen.getByText('$30.000')).toBeInTheDocument();
});
```

- [ ] **Step 3: Run (fail), then write `apps/web/src/pages/Landing.tsx`**

```tsx
import { useProducts, useDrop, useContent } from '../hooks/useCatalog';
import Marquee from '../components/Marquee';
import Nav from '../components/Nav';
import Hero from '../components/Hero';
import Manifiesto from '../components/Manifiesto';
import Productos from '../components/Productos';
import Historia from '../components/Historia';
import Proximos from '../components/Proximos';
import Contacto from '../components/Contacto';
import Footer from '../components/Footer';

export default function Landing() {
  const products = useProducts();
  const drop = useDrop();
  const content = useContent();

  if (!content.data) {
    return <div data-testid="landing" className="min-h-screen bg-bg" />;
  }

  return (
    <div data-testid="landing" className="bg-bg text-tx font-body min-h-screen relative overflow-x-hidden">
      <Marquee items={content.data.marquee} />
      <Nav cartCount={0} onOpenCart={() => {}} />
      <Hero content={content.data} />
      <Manifiesto />
      <Productos products={products.data ?? []} onAdd={() => {}} />
      <Historia />
      {drop.data && <Proximos drop={drop.data} />}
      <Contacto content={content.data} />
      <Footer />
    </div>
  );
}
```

Re-run → PASS.

- [ ] **Step 4: Manual visual check against the source**

Run the API (`npm run dev:api`) and web (`npm run dev:web`), open `http://localhost:5173`. Verify against `_source/Resolute Force(1).html`: marquee scroll, hero clamp sizing, 4 product cards with size pills, countdown ticking, contacto cards, footer payment badges.

- [ ] **Step 5: Build + full suite + commit + tag**

```bash
npm run build --workspace @resolute/web
npm test --workspace @resolute/web
git add -A && git commit -m "feat(web): assets + full landing assembly (M2)"
git tag m2-frontend-port
```

---

## M2 done when

- The landing is visually faithful to `_source/Resolute Force(1).html` and data-driven from the API.
- All web component + integration tests are green; `vite build` succeeds.
- `git tag m2-frontend-port` exists. Proceed to `…-m3-cart-checkout.md`.
