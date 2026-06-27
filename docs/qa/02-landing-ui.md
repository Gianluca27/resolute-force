# Module 2 — Landing Page & UI

> **Scope:** The public landing page (`/`) of the Resolute Force store and every section it renders — page load/SEO, `Nav`, `Marquee`, `Hero`, `Manifiesto`, `Productos`/`ProductCard`, `Historia`, `Proximos` (drop countdown), `Contacto`, `Footer`, `Toast`, plus responsive layout, accessibility, design-token fidelity, and the error/loading/edge states. Cart **drawer** mechanics (qty +/-, line totals, checkout entry) live in Module 3; this module only covers the cart **button/badge** and the "add → toast + drawer opens" trigger. Checkout/payments are Modules 4–5. Tests the **shipped code** under `apps/web/src` (Vite dev server `:5173`, API `:4000`). Read the [README](README.md) first for setup, canonical seed data, locale/money rules, and conventions — not repeated here.

**Coverage checklist:**
- [ ] Page load: `<html lang="es-AR">`, `<title>`, favicon, fonts, blank-then-hydrate, visit tracking on mount
- [ ] Nav/header: logo, anchor links, `Carrito` button (aria-label), `cart-badge` visibility, sticky-on-scroll, flex-wrap (no hamburger)
- [ ] Marquee: 6 phrases, ◆ separators, duplicated loop, 32s animation, reduced-motion
- [ ] Hero: kicker/titles/subtitle copy, the two CTAs scroll to `#productos`/`#manifiesto`, badges, scroll cue
- [ ] Manifiesto: copy, image alt, three principles
- [ ] Productos grid: 4 cards, line/color/price/tag/dot swatch, S–XL selector, default = first in-stock, sold-out size (disabled, `Sin stock`, line-through), fully sold-out → `Sin stock` button, add → toast `${line} · ${color} (${size})` + drawer opens
- [ ] CD-4: hardcoded "10% OFF" footer vs dynamic checkout badge
- [ ] Historia: copy, stats, image alt, order reflow
- [ ] Drop countdown: live tick, zero behaviour, `visible:false` hides, `drop.data` missing hides, gold last-word title
- [ ] Contacto: WhatsApp/Instagram/email/location, no form
- [ ] Footer: copy, links, year, payment badges
- [ ] Toast: single, auto-dismiss ~2400 ms, checkmark colour
- [ ] Responsive: 360/375/390/428 mobile, ~768 tablet, ≥1024 desktop; grid reflow; tap targets
- [ ] Accessibility: alt text, aria-labels, keyboard nav/focus order, focus-visible, contrast, heading hierarchy, reduced-motion
- [ ] Design tokens: `#e4322b`, `#e8b53e`, Saira Condensed headings, Barlow body
- [ ] Edge/error: catalog fetch fail, content error fallback, image 404, slow network loading, reload keeps cart, drawer closed on reload
- [ ] CD-9 (resuelto): slogan canónico `Stop at Nothing` en todo el código (data, marquee, Manifiesto, checkout)

---

## A. Page load, SEO, locale & visit tracking

### TC-LAND-001: Landing renders all sections in order once content loads
- **Priority:** P0
- **Type:** Functional
- **Preconditions:** API up and seeded; `:5173` reachable.
- **Steps → Expected:**
  1. Navigate to `http://localhost:5173/` → **Expected:** root `div[data-testid="landing"]` mounts; after `GET /api/content` resolves, sections render top-to-bottom: Marquee, `Nav`, `Hero (#inicio)`, `Manifiesto (#manifiesto)`, `Productos (#productos)`, `Historia (#historia)`, `Proximos (#proximos)`, `Contacto (#contacto)`, `Footer`.
  2. Inspect DOM order → **Expected:** matches the JSX order in `Landing.tsx`; no console errors.
- **Notes:** `CartDrawer`/`CheckoutModal` are NOT in the DOM until opened (`{open && …}` / `{checkoutOpen && …}`). `Proximos` only appears when `drop.data` is truthy AND `drop.visible`.

### TC-LAND-002: HTML lang attribute is es-AR
- **Priority:** P2
- **Type:** Accessibility
- **Preconditions:** Page loaded.
- **Steps → Expected:**
  1. Inspect `<html>` → **Expected:** `lang="es-AR"` (from `index.html`).
- **Notes:** Drives screen-reader pronunciation and `toLocaleString('es-AR')` expectations (dot thousands separator).

### TC-LAND-003: Document title and favicon
- **Priority:** P3
- **Type:** UI
- **Preconditions:** Page loaded.
- **Steps → Expected:**
  1. Read `document.title` → **Expected:** exactly `Resolute Force · Champion Mentality`.
  2. Inspect `<link rel="icon">` → **Expected:** `href="/assets/logo-r.png"`; tab favicon shows the R logo.
- **Notes:** Title is static (no per-route `<title>`); SPA routes do not update it.

### TC-LAND-004: Web fonts load (Saira Condensed + Barlow)
- **Priority:** P2
- **Type:** UI
- **Preconditions:** Internet access to Google Fonts; page loaded.
- **Steps → Expected:**
  1. Open Network panel, filter `fonts.g*` → **Expected:** `Saira+Condensed` (weights 500–900) and `Barlow` (400–700) requested via the `googleapis.com/css2` link with `display=swap`; `preconnect` hints to `fonts.googleapis.com` and `fonts.gstatic.com` present.
  2. Inspect a heading vs a paragraph → **Expected:** headings resolve to `"Saira Condensed"` (`font-display`), body text to `"Barlow"` (`font-body`); fallback `system-ui, sans-serif` only if the CDN is blocked.
- **Notes:** Fonts are CDN-hosted, not self-hosted — offline/blocked CDN falls back to system-ui (covered in TC-LAND-072).

### TC-LAND-005: Blank dark placeholder before content resolves
- **Priority:** P2
- **Type:** UI
- **Preconditions:** Throttle network so `GET /api/content` is slow (e.g. DevTools "Slow 3G").
- **Steps → Expected:**
  1. Load `/` and observe before content arrives → **Expected:** only `<div data-testid="landing" class="min-h-screen bg-bg">` (full-height `#0a0a0b` blank) — no spinner, no skeleton, no flash of unstyled sections.
  2. When content resolves → **Expected:** the full landing replaces the placeholder.
- **Notes:** `Landing.tsx` returns the blank div while `!content.data`. Only **content** gates the page; products/drop load independently.

### TC-LAND-006: Visit is tracked once on mount
- **Priority:** P2
- **Type:** Integration
- **Preconditions:** Network panel open; API up.
- **Steps → Expected:**
  1. Load `/` → **Expected:** exactly one `POST /api/track` with header `Content-Type: application/json` and body `{"path":"/"}`.
  2. Scroll / interact without reloading → **Expected:** no further `/api/track` calls (fires once per mount via `useEffect([])`).
- **Notes:** React `StrictMode` may double-invoke effects in **dev** → two calls are acceptable in dev only; production build fires once.

### TC-LAND-007: Tracking failure never breaks the page
- **Priority:** P2
- **Type:** Negative
- **Preconditions:** Block or 500 `POST /api/track` (e.g. DevTools request blocking).
- **Steps → Expected:**
  1. Load `/` with `/api/track` failing → **Expected:** page renders fully; no unhandled rejection, no visible error.
- **Notes:** Call is fire-and-forget with `.catch(() => {})` in `Landing.tsx`.

---

## B. Nav / header

### TC-LAND-008: Header logo and brand wordmark
- **Priority:** P3
- **Type:** UI
- **Preconditions:** Page loaded.
- **Steps → Expected:**
  1. Inspect the left of the nav → **Expected:** `<img src="/assets/logo-r.png" alt="Resolute Force" width=34 height=34>` followed by wordmark `Resolute·Force` where the middle dot `·` is `text-red` (#e4322b).
  2. Click the logo link → **Expected:** navigates to `#inicio` (Hero), smooth-scrolling to top.
- **Notes:** `scroll-behavior: smooth` is set globally in `index.css`.

### TC-LAND-009: Nav anchor links scroll to their sections
- **Priority:** P1
- **Type:** Functional
- **Preconditions:** Page loaded, all sections rendered.
- **Steps → Expected:**
  1. Click `Productos` → **Expected:** smooth-scrolls to `#productos`; section top respects `scroll-mt-20` offset (not hidden under the sticky nav).
  2. Click `Manifiesto` → **Expected:** scrolls to `#manifiesto`.
  3. Click `Historia` → **Expected:** scrolls to `#historia`.
  4. Click `Contacto` → **Expected:** scrolls to `#contacto`.
- **Notes:** Four links in `Nav.tsx`. There is **no** `Próximos` link in the nav (only Hero CTAs/Footer reach `#proximos`).

### TC-LAND-010: Cart button label and aria-label
- **Priority:** P1
- **Type:** Accessibility
- **Preconditions:** Page loaded.
- **Steps → Expected:**
  1. Inspect the cart button → **Expected:** `<button aria-label="Carrito">` with visible text `Carrito` and a cart SVG icon.
  2. Query by accessible name "Carrito" → **Expected:** exactly one match.
- **Notes:** Both `aria-label` and visible text say "Carrito" — fine; the icon is decorative (no separate label).

### TC-LAND-011: Cart badge hidden at zero, shows count when > 0
- **Priority:** P1
- **Type:** Functional
- **Preconditions:** Empty cart (clear `rf-cart` in localStorage; reload).
- **Steps → Expected:**
  1. With empty cart, look for `[data-testid="cart-badge"]` → **Expected:** NOT in the DOM (`cartCount > 0` gate).
  2. Add a product (any size) → **Expected:** `cart-badge` appears showing `1`, red circle (`bg-red`, white text) bordered by `bg` colour, pinned top-right of the button.
  3. Add the same product+size again → **Expected:** badge shows `2` (sum of `qty`, via `cartCount`).
  4. Add a different size of the same/another product → **Expected:** badge increments by 1 per add (counts total quantity across lines).
- **Notes:** Badge value = `cartCount(items)` = Σ `qty`, not number of distinct lines.

### TC-LAND-012: Header is sticky on scroll with blur backdrop
- **Priority:** P2
- **Type:** UI
- **Preconditions:** Page loaded, viewport tall enough to scroll.
- **Steps → Expected:**
  1. Scroll down past the Hero → **Expected:** nav stays pinned at top (`sticky top-0 z-50`), semi-transparent dark background `rgba(10,10,11,0.78)` with `backdrop-blur`, bottom hairline border.
  2. Confirm `z-50` keeps it above content but the Marquee (`z-40`) scrolls away above it → **Expected:** Marquee is NOT sticky; only the nav sticks.
- **Notes:** Marquee sits above the nav in DOM and is not sticky, so it scrolls out of view.

### TC-LAND-013: No hamburger menu — nav wraps on narrow viewports
- **Priority:** P2
- **Type:** Responsive
- **Preconditions:** Page loaded.
- **Steps → Expected:**
  1. Resize to 360px wide → **Expected:** no hamburger/menu toggle exists; the nav uses `flex-wrap`, so logo + the four links + Carrito button reflow onto multiple rows; all remain visible and tappable.
- **Notes:** **Divergence vs. assumption:** there is NO mobile hamburger in `Nav.tsx`. Verify the wrapped layout is usable and the Carrito button is not clipped.

### TC-LAND-014: Cart button opens the drawer
- **Priority:** P1
- **Type:** Functional
- **Preconditions:** Page loaded (cart may be empty or not).
- **Steps → Expected:**
  1. Click `Carrito` → **Expected:** `setOpen(true)` → `CartDrawer` mounts/opens (even with an empty cart; empty-state content is a Module 3 concern).
- **Notes:** Drawer internals are tested in Module 3; here only verify the button is wired to open it.

---

## C. Marquee

### TC-LAND-015: Marquee shows the 6 seed phrases with separators
- **Priority:** P2
- **Type:** UI
- **Preconditions:** Default seed content.
- **Steps → Expected:**
  1. Read the red top bar → **Expected:** the six phrases `Envíos a todo el país`, `Champion Mentality`, `3 cuotas sin interés`, `Stop at Nothing`, `Calidad premium`, `The Resolute Standard`, each followed by a `◆` diamond at ~0.55 opacity.
  2. Count rendered spans → **Expected:** the list is duplicated (`[...items, ...items]`), so 12 phrase-spans total for a seamless loop.
- **Notes:** Bar styling: `bg-red` (#e4322b), white uppercase Saira, letter-spacing `0.22em`.

### TC-LAND-016: Marquee animates and loops seamlessly
- **Priority:** P3
- **Type:** UI
- **Preconditions:** Reduced-motion OFF.
- **Steps → Expected:**
  1. Observe the bar → **Expected:** content scrolls right→left continuously via `animate-marquee` (`translateX(0)` → `translateX(-50%)`, 32s linear infinite); because the list is duplicated, the wrap is invisible (no gap/jump).
- **Notes:** Duration 32s — slow; allow a few seconds to confirm motion.

### TC-LAND-017: Empty marquee renders without crashing
- **Priority:** P2
- **Type:** Negative
- **Preconditions:** Set `SiteContent.marquee` to `[]` (admin Contenido or DB) and reload.
- **Steps → Expected:**
  1. Load `/` → **Expected:** the red bar still renders but contains no phrases (`[...[], ...[]]` → empty); page does not crash; rest of the landing is unaffected.
- **Notes:** `Marquee` maps over the (empty) doubled array — no runtime error.

### TC-LAND-018: Marquee keeps animating under reduced-motion (gap)
- **Priority:** P2
- **Type:** Accessibility
- **Preconditions:** OS/browser "Reduce motion" enabled.
- **Steps → Expected:**
  1. Load `/` with reduce-motion on → **Expected (current code):** the marquee, `ember` glow, `float` scroll cue and toast still animate — there is **no** `prefers-reduced-motion` handling anywhere in `index.css`/Tailwind config.
- **Notes:** **Accessibility defect candidate.** Expected best practice is to pause/disable these animations under reduced-motion; file if confirmed. Same gap also affects TC-LAND-062.

---

## D. Hero

### TC-LAND-019: Hero kicker, titles and subtitle copy
- **Priority:** P1
- **Type:** UI
- **Preconditions:** Default seed content.
- **Steps → Expected:**
  1. Read the kicker → **Expected:** gold 30px bar then gold uppercase text `Est. 2024 · Indumentaria de alto rendimiento` (`heroKicker`).
  2. Read the `<h1>` (level 1) → **Expected:** line 1 `Champion` in white (`text-tx`), line 2 `Mentality` in red (`text-red` #e4322b) with red glow shadow.
  3. Read the subtitle paragraph → **Expected:** `heroSubtitle` text followed by a hardcoded white/semibold `Esta es la norma Resolute.`
- **Notes:** **Divergence:** `Esta es la norma Resolute.` is hardcoded in `Hero.tsx` and appended to the dynamic `heroSubtitle`; it is not part of the stored content. Title text comes from `heroTitle1`/`heroTitle2`.

### TC-LAND-020: Hero primary CTA scrolls to Productos
- **Priority:** P1
- **Type:** Functional
- **Preconditions:** Page loaded.
- **Steps → Expected:**
  1. Click `Ver colección` (red button with arrow) → **Expected:** smooth-scrolls to `#productos`.
- **Notes:** `href="#productos"`.

### TC-LAND-021: Hero secondary CTA scrolls to Manifiesto
- **Priority:** P2
- **Type:** Functional
- **Preconditions:** Page loaded.
- **Steps → Expected:**
  1. Click `El manifiesto` (outline button) → **Expected:** smooth-scrolls to `#manifiesto`; hover turns border/text gold.
- **Notes:** `href="#manifiesto"`.

### TC-LAND-022: Hero feature badges and scroll cue
- **Priority:** P3
- **Type:** UI
- **Preconditions:** Page loaded.
- **Steps → Expected:**
  1. Read the three badges under the CTAs → **Expected:** `Envíos a todo el país`, `3 cuotas sin interés`, `Algodón premium`, each prefixed by a gold `◆`.
  2. Look at the bottom-centre of the Hero → **Expected:** a `Scroll` label + down-chevron with a gentle `float` bob animation.
- **Notes:** Badges are hardcoded in `Hero.tsx` (not content-driven). The two decorative background logo/glow layers are `pointer-events-none` and `alt=""`.

---

## E. Manifiesto

### TC-LAND-023: Manifiesto headline, copy and image
- **Priority:** P3
- **Type:** UI
- **Preconditions:** Page loaded.
- **Steps → Expected:**
  1. Read the section → **Expected:** kicker `El Manifiesto` (gold); `<h2>` `La presión no te quiebra.` + `Te forja.` (second line red); body paragraph ending with white `Ser campeón se decide mucho antes de competir.`
  2. Inspect the image → **Expected:** `alt="Atleta Resolute Force rompiendo el papel"`, overlaid gold badge `Champions think under pressure`.
- **Notes:** Section is fully static content (no API data).

### TC-LAND-024: Manifiesto three principles
- **Priority:** P3
- **Type:** UI
- **Preconditions:** Page loaded.
- **Steps → Expected:**
  1. Read the numbered list → **Expected:** `01 Champions think under pressure` (red number), `02 Discipline is the key` (gold number), `03 Stop at Nothing` (white number), each with its subtitle.
- **Notes:** **CD-9 resuelto:** principle 03 usa el casing canónico `Stop at Nothing` (renderizado en mayúsculas por CSS `uppercase`), alineado con data/marquee/checkout. See TC-LAND-073.

---

## F. Productos grid & ProductCard

### TC-LAND-025: Grid renders all active products
- **Priority:** P0
- **Type:** Functional
- **Preconditions:** Default seed (4 active products).
- **Steps → Expected:**
  1. Scroll to `#productos` → **Expected:** kicker `Nuestros productos`, `<h2>` `La colección` / `Resolute '26`, intro paragraph mentioning `Champion Mentality y Stop at Nothing`.
  2. Count cards → **Expected:** 4 `ProductCard`s in a CSS grid `repeat(auto-fill, minmax(258px, 1fr))`, ordered by `sortOrder` (Azul Marino, Negro, Verde Militar, Blanco) as returned by the API.
- **Notes:** Grid is driven by `products.data ?? []`; order follows API response.

### TC-LAND-026: Product card content (line, color, dot swatch, price)
- **Priority:** P1
- **Type:** UI
- **Preconditions:** Default seed.
- **Steps → Expected:**
  1. Inspect the "Azul Marino" card → **Expected:** `<h3>` `Champion Mentality`; a `11px` round swatch filled with `dotColor` `#1f2a44` next to the text `Azul Marino`; price `$30.000` (Saira extrabold).
  2. Inspect the product image → **Expected:** `alt="Remera Resolute Force Azul Marino"` (alt = `Remera Resolute Force ${color}`), square aspect ratio.
- **Notes:** Money via `money()` → `'$' + toLocaleString('es-AR')` → dot thousands. Each card's alt encodes only the colour, not the line.

### TC-LAND-027: Tag badge shows only when a product has a tag
- **Priority:** P2
- **Type:** UI
- **Preconditions:** Default seed.
- **Steps → Expected:**
  1. Look at "Azul Marino" → **Expected:** red badge `Más vendida` top-left.
  2. Look at "Blanco" → **Expected:** red badge `Nuevo`.
  3. Look at "Negro" and "Verde Militar" → **Expected:** no badge (`tag` is null → not rendered).
- **Notes:** Badge is `absolute top-3 left-3`, `bg-red` white uppercase.

### TC-LAND-028: Size selector defaults to the first in-stock size
- **Priority:** P1
- **Type:** Functional
- **Preconditions:** A product with S out of stock but M+ in stock (e.g. set S `stock=0` via admin).
- **Steps → Expected:**
  1. Open that card → **Expected:** four size buttons `S M L XL`; the first in-stock size is pre-selected (`bg-tx` filled). If S=0 and M>0, `M` is selected by default; S is disabled.
  2. With all four in stock (default seed, 25 each) → **Expected:** `S` is selected by default (`product.sizes.find(stock>0)` → first).
- **Notes:** `firstInStock = sizes.find(s => s.stock > 0)?.size ?? ''`; confirmed by `ProductCard.test.tsx` (S+M=0 → defaults to L).

### TC-LAND-029: Selecting a size highlights it
- **Priority:** P2
- **Type:** UI
- **Preconditions:** A product with multiple in-stock sizes.
- **Steps → Expected:**
  1. Click `L` → **Expected:** `L` becomes active (`bg-tx text-bg`), previously selected size returns to outline (`border-line2`, muted text).
  2. Add to cart → **Expected:** `onAdd(product, 'L')` fires with the selected size (see TC-LAND-031).
- **Notes:** Selection is local `useState`; not persisted across re-render from reconcile.

### TC-LAND-030: Out-of-stock size button is disabled and struck through
- **Priority:** P1
- **Type:** Boundary
- **Preconditions:** A product with one size at `stock=0` (e.g. M=0), others > 0.
- **Steps → Expected:**
  1. Inspect the `M` button → **Expected:** `disabled`, `title="Sin stock"` (native tooltip on hover), `line-through`, `opacity-40`, `cursor-not-allowed`.
  2. Click `M` → **Expected:** no selection change (disabled).
- **Notes:** Confirmed by `ProductCard.test.tsx` ("disables out-of-stock size buttons"). In-stock buttons have no `title`.

### TC-LAND-031: Add to cart fires toast and opens the drawer
- **Priority:** P0
- **Type:** Functional
- **Preconditions:** Default seed; cart empty.
- **Steps → Expected:**
  1. On the "Negro" card with `M` selected, click `Agregar` → **Expected:** (a) item added to cart, (b) cart badge increments, (c) a toast appears reading exactly `Champion Mentality · Negro (M)` (template `${line} · ${color} (${size})`), (d) the cart **drawer opens** (`add()` sets `open: true`).
  2. Confirm the toast text matches the selected size, not the default → **Expected:** if `L` was selected, toast reads `… (L)`.
- **Notes:** Both effects come from `Landing.tsx` `onAdd` (`add(p,size)` + `showToast(...)`); `add()` itself flips the drawer open.

### TC-LAND-032: Fully sold-out product disables Agregar → shows "Sin stock"
- **Priority:** P1
- **Type:** Boundary
- **Preconditions:** A product with **all** sizes `stock=0`.
- **Steps → Expected:**
  1. Open that card → **Expected:** every size button disabled/struck; the add button reads `Sin stock` and is `disabled` (`opacity-50`, `cursor-not-allowed`).
  2. Click the disabled add button → **Expected:** nothing happens; no toast; no cart change.
- **Notes:** `soldOut = sizes.every(stock<=0)`; `canAdd = !soldOut && !!sel`. Confirmed by `ProductCard.test.tsx` ("fully sold out"). With an empty `sizes` array, `every` is vacuously true → also `Sin stock`.

### TC-LAND-033: Empty product grid when catalog returns none / fails
- **Priority:** P2
- **Type:** Negative
- **Preconditions:** `GET /api/products` returns `[]`, OR fails (force 500) while `GET /api/content` still succeeds.
- **Steps → Expected:**
  1. Load `/` with products empty/failed → **Expected:** the Productos **section still renders** (header, intro, footer line) but the grid is empty (`products.data ?? []`); no cards; no error banner; rest of the page works.
- **Notes:** Unlike content, a products fetch failure degrades **silently** to an empty grid (retry=1 then settle). This is a UX gap worth filing if you expect an empty/error state for the catalog.

### TC-LAND-034: Productos footer hardcodes "10% OFF" (CD-4)
- **Priority:** P2
- **Type:** UI
- **Preconditions:** Default seed (`transferDiscountPct = 10`).
- **Steps → Expected:**
  1. Read the line under the grid → **Expected:** `Precios en pesos · 3 cuotas sin interés · 10% OFF pagando por transferencia`.
  2. In admin, change `transferDiscountPct` to e.g. `15`, reload landing → **Expected (defect):** this footer still says `10% OFF` (string is hardcoded in `Productos.tsx`), while the checkout transfer badge is computed from `transferDiscount/subtotal` → the two desync.
- **Notes:** Candidate defect **CD-4**. The "10%" here is literal, not derived from content.

---

## G. Historia

### TC-LAND-035: Historia copy, stats and image
- **Priority:** P3
- **Type:** UI
- **Preconditions:** Page loaded.
- **Steps → Expected:**
  1. Read the section → **Expected:** kicker `Sobre la marca`; `<h2>` `Nacida en el gimnasio, forjada en la disciplina`; body ending with white `no rendirse nunca.`
  2. Read the three stats → **Expected:** `2024` (red) `Año de fundación`, `+5.000` (gold) `Atletas en el ejército`, `100%` (white) `Algodón premium`.
  3. Inspect the image → **Expected:** `alt="Colección Resolute Force en el gimnasio"` with overlay `The Resolute Standard` + `Donde la presión se convierte en carácter.`
- **Notes:** Static content. Uses `order-1`/`order-2` so image and text swap order vs DOM — verify visual order in TC-LAND-058.

---

## H. Drop countdown (Proximos)

### TC-LAND-036: Countdown renders with seed drop and ticks live
- **Priority:** P1
- **Type:** Functional
- **Preconditions:** Default seed drop (`targetAt = 2026-08-15T20:00:00-03:00`, `visible = true`); today is 2026-06-27 (target in the future).
- **Steps → Expected:**
  1. Scroll to `#proximos` → **Expected:** kicker `Próximo lanzamiento`; four cells `Días`, `Horas`, `Min`, `Seg` showing remaining time (≈ 49+ days out), each value zero-padded to 2 digits.
  2. Wait ~3 seconds → **Expected:** the `Seg` value decrements every second (interval ticks `now` each 1000 ms); `Seg` cell value is gold (`accent`), others white.
- **Notes:** `useCountdown` recomputes `diffParts(target, now)` on each tick. Values are strings via `pad()`.

### TC-LAND-037: Drop title accents the last word in gold
- **Priority:** P3
- **Type:** UI
- **Preconditions:** Seed title `Algo se está forjando`.
- **Steps → Expected:**
  1. Read the `<h2>` → **Expected:** `Algo se está` on one line then `forjando` (last word) on the next line in gold with glow.
- **Notes:** `Proximos.tsx` splits on whitespace, pops the last word as the gold accent, and `<br/>`s before it.

### TC-LAND-038: Single-word drop title double-renders (edge bug)
- **Priority:** P3
- **Type:** Negative
- **Preconditions:** Set drop `title` to a single word, e.g. `Pressure` (admin Drop).
- **Steps → Expected:**
  1. Reload landing, read the `<h2>` → **Expected (current code):** the word renders **twice** — once as lead text, a `<br/>`, then again in gold — i.e. `Pressure` / `Pressure`.
- **Notes:** **Defect candidate.** With one word, `words.length > 1` is false so `lastWord=''`, `leadWords='Pressure'`, and `{lastWord || leadWords}` falls back to `leadWords`, duplicating it. File if confirmed; multi-word titles are unaffected (TC-LAND-037).

### TC-LAND-039: Countdown clamps to all-zeros once the target passes
- **Priority:** P2
- **Type:** Boundary
- **Preconditions:** Set drop `targetAt` to a **past** instant (e.g. yesterday) while `visible=true`; reload.
- **Steps → Expected:**
  1. Read the cells → **Expected:** `00` / `00` / `00` / `00` and they **stay** at zero (no negative values, no rollover); `diffParts` uses `Math.max(0, target-now)`.
  2. Observe → **Expected:** there is **no** "launched"/"live"/"¡Ya salió!" state and the section does **not** auto-hide; it simply shows `00:00:00:00` indefinitely.
- **Notes:** Confirmed by `useCountdown.test.ts` ("clamps to zero in the past"). The only way to hide the section is `visible=false` (TC-LAND-040). Showing a stale zeroed countdown is a UX gap worth noting.

### TC-LAND-040: drop.visible = false hides the whole section
- **Priority:** P1
- **Type:** Functional
- **Preconditions:** Set `DropConfig.visible = false` (admin Drop); reload.
- **Steps → Expected:**
  1. Load `/` → **Expected:** the `#proximos` section is absent from the DOM (`Proximos` returns `null` when `!drop.visible`); the Footer `Próximos drops` link still points to `#proximos` but now resolves to nothing.
- **Notes:** Confirmed by `Proximos.test.tsx` ("renders nothing when not visible"). Compare TC-LAND-041 (drop fetch failure also hides it, but for a different reason).

### TC-LAND-041: Drop fetch failure hides the section gracefully
- **Priority:** P2
- **Type:** Negative
- **Preconditions:** Force `GET /api/drop` to 500/timeout while content + products succeed.
- **Steps → Expected:**
  1. Load `/` → **Expected:** `drop.data` is undefined → `{drop.data && <Proximos/>}` short-circuits → no `#proximos` section; no error banner; rest of the page renders normally.
- **Notes:** Landing gates `Proximos` on `drop.data` truthiness, so a failed drop fetch is indistinguishable from `visible=false` to the user.

---

## I. Contacto

### TC-LAND-042: WhatsApp card link and number
- **Priority:** P1
- **Type:** Functional
- **Preconditions:** Default seed (`contactWhatsapp = "5493413213723"`).
- **Steps → Expected:**
  1. Inspect the WhatsApp card → **Expected:** `<a target="_blank" rel="noopener">` with `href="https://wa.me/5493413213723?text=Hola%20Resolute%20Force%2C%20quiero%20hacer%20un%20pedido"`; title `WhatsApp`; displayed number `+54 341 321-3723`.
  2. Click it → **Expected:** opens WhatsApp (web/app) in a new tab with the prefilled message.
- **Notes:** **Divergence:** the displayed `+54 341 321-3723` is **hardcoded** text; only the `href` uses `content.contactWhatsapp`. If admin changes the number, the visible label will not update (desync, CD-4-style). File if confirmed.

### TC-LAND-043: Instagram and Email cards
- **Priority:** P2
- **Type:** Functional
- **Preconditions:** Default seed (`contactInstagram="@resoluteforceok"`, `contactEmail="resolutecontacto@gmail.com"`).
- **Steps → Expected:**
  1. Inspect the Instagram card → **Expected:** `href="https://www.instagram.com/resoluteforceok/"` (the `@` is stripped via `.replace('@','')`), `target="_blank" rel="noopener"`; visible handle `@resoluteforceok`.
  2. Inspect the Email card → **Expected:** `href="mailto:resolutecontacto@gmail.com"`; visible text `resolutecontacto@gmail.com`; clicking opens the mail client.
- **Notes:** External anchors use `rel="noopener"` but **not** `noreferrer` — minor; note for the cross-cutting security pass (Module 13).

### TC-LAND-044: Location card is informational (not a link)
- **Priority:** P3
- **Type:** UI
- **Preconditions:** Default seed (`contactLocation="Buenos Aires · Envíos a todo el país"`).
- **Steps → Expected:**
  1. Inspect the fourth card → **Expected:** a `<div>` (not an `<a>`) titled `Ubicación` with text `Buenos Aires · Envíos a todo el país`; not clickable; no map link.
- **Notes:** Section header is `Sumate al ejército` / `<h2>` `Hablemos`.

### TC-LAND-045: No contact form exists
- **Priority:** P2
- **Type:** Functional
- **Preconditions:** Page loaded.
- **Steps → Expected:**
  1. Inspect the Contacto section → **Expected:** there is **no** `<form>`, no name/email/message inputs, no submit button — contact is only via the WhatsApp/Instagram/Email/Location cards.
- **Notes:** **Divergence vs. assumption:** `Contacto.tsx` ships no form, so there is nothing to validate/submit here. If a form is expected by spec, that is a missing-feature finding, not a bug in existing code.

---

## J. Footer

### TC-LAND-046: Footer brand, tagline and link columns
- **Priority:** P3
- **Type:** UI
- **Preconditions:** Default seed.
- **Steps → Expected:**
  1. Read the footer → **Expected:** logo + `Resolute·Force` wordmark, tagline `Indumentaria deportiva para los que entrenan bajo presión. Champion Mentality.`
  2. Inspect columns → **Expected:** `Tienda` (`Productos`→#productos, `Próximos drops`→#proximos, `Guía de talles`→#productos), `Marca` (`Manifiesto`/`Historia`/`Contacto`), `Seguinos` (`Instagram`, `WhatsApp`).
- **Notes:** **Note:** `Guía de talles` points to `#productos` — there is no real size-guide page/anchor. File as a content/UX gap if a size guide is expected.

### TC-LAND-047: Footer social links use content values
- **Priority:** P2
- **Type:** Functional
- **Preconditions:** Default seed.
- **Steps → Expected:**
  1. Inspect Footer `Instagram` → **Expected:** `href="https://www.instagram.com/resoluteforceok/"` from `contactInstagram` (falls back to `@resoluteforceok` if undefined).
  2. Inspect Footer `WhatsApp` → **Expected:** `href="https://wa.me/5493413213723"` from `contactWhatsapp` (falls back to `5493413213723` if undefined).
- **Notes:** Both are passed from `Landing.tsx` as `content.data.contactWhatsapp` / `contactInstagram`.

### TC-LAND-048: Footer legal line, year and payment badges
- **Priority:** P3
- **Type:** UI
- **Preconditions:** Page loaded.
- **Steps → Expected:**
  1. Read the bottom row → **Expected:** `© 2026 Resolute Force · Hecho en Argentina`.
  2. Read the payment badges → **Expected:** `Transferencia`, `Tarjeta`, `Mercado Pago` chips.
- **Notes:** **Note:** the year `2026` is **hardcoded** in `Footer.tsx` (not `new Date().getFullYear()`). It matches the current year now but will silently go stale next year — file as a low-priority maintenance bug.

---

## K. Toast

### TC-LAND-049: Toast is single-instance and replaced by the latest message
- **Priority:** P2
- **Type:** Functional
- **Preconditions:** Default seed; cart empty.
- **Steps → Expected:**
  1. Add product A, then quickly add product B before A's toast dismisses → **Expected:** only **one** toast is visible at a time; the second message replaces the first (store holds a single `message`; the timer is reset on each `show`).
  2. Confirm position/style → **Expected:** toast is `fixed` bottom-centre, near-white background (`bg-tx`), dark uppercase Saira text, with a check-mark icon.
- **Notes:** `useToast` store keeps one `message`; re-`show` clears the prior timeout and restarts it.

### TC-LAND-050: Toast auto-dismisses after ~2400 ms
- **Priority:** P2
- **Type:** Boundary
- **Preconditions:** Cart empty.
- **Steps → Expected:**
  1. Add a product, start a timer → **Expected:** toast appears immediately, plays the `toast` keyframe (fade-up in, hold, fade-down out over 2.4s), and is removed from the DOM at ~2400 ms when the store sets `message = null`.
- **Notes:** Both the store timeout (`setTimeout(... , 2400)`) and the CSS `animation: toast 2.4s` are 2.4s, so the fade-out aligns with removal.

### TC-LAND-051: Toast checkmark colour is red, not green
- **Priority:** P3
- **Type:** UI
- **Preconditions:** Trigger a toast.
- **Steps → Expected:**
  1. Inspect the check SVG inside the toast → **Expected (current code):** `stroke="#e4322b"` — the checkmark is **red** (brand red), on a near-white pill.
- **Notes:** **Divergence vs. assumption:** the spec described a "green check"; the shipped icon is red `#e4322b`. Treat as a known divergence (cosmetic). Verify the red-on-white check is still legible (it is, high contrast).

---

## L. Responsive

### TC-LAND-052: Mobile portrait layout — 360 / 375 / 390 / 428 px
- **Priority:** P1
- **Type:** Responsive
- **Preconditions:** Page loaded; emulate each width (360, 375, 390, 428).
- **Steps → Expected:**
  1. At each width → **Expected:** no horizontal scrollbar (`overflow-x: hidden` on body + landing wrapper); fluid `clamp()` paddings shrink; Hero `<h1>` scales down via `clamp(3.6rem, 11vw, 9.5rem)`; nav wraps (TC-LAND-013).
  2. Product grid → **Expected:** `minmax(258px, 1fr)` collapses to a single column (since 258px ≥ available content width); cards stack full-width.
- **Notes:** Check the 258px min specifically at 360px: with side paddings, one column is expected; verify cards are not clipped.

### TC-LAND-053: Tablet layout — ~768 px
- **Priority:** P2
- **Type:** Responsive
- **Preconditions:** Emulate 768px wide.
- **Steps → Expected:**
  1. Product grid → **Expected:** `auto-fill minmax(258px,1fr)` yields ~2 columns; cards evenly sized.
  2. Manifiesto/Historia/Contacto → **Expected:** their flex/grid blocks reflow to 1–2 columns gracefully; no overlap.
- **Notes:** Layout is breakpoint-light (mostly `clamp()` + `flex-wrap` + `auto-fill`), so transitions are continuous rather than at fixed Tailwind breakpoints.

### TC-LAND-054: Desktop layout — ≥1024 px
- **Priority:** P2
- **Type:** Responsive
- **Preconditions:** Emulate ≥1024px (e.g. 1280, 1440).
- **Steps → Expected:**
  1. Product grid → **Expected:** 3–4 columns within the `max-w-[1280px]` container; the 4 seed cards fit on one or two rows.
  2. Hero/sections → **Expected:** centred within their `max-w` containers; large type renders at the upper `clamp` bound.
- **Notes:** Containers cap at `1280px` (Productos) / `1180px` (most sections).

### TC-LAND-055: Grid reflow is smooth across the range
- **Priority:** P3
- **Type:** Responsive
- **Preconditions:** Page loaded.
- **Steps → Expected:**
  1. Slowly drag the viewport from 1440 → 360 px → **Expected:** product columns drop 4→3→2→1 without overlap, clipping, or layout jumps; gaps stay at `18px`.
- **Notes:** Driven purely by `auto-fill`/`minmax`; no JS resize logic.

### TC-LAND-056: Tap-target size on mobile
- **Priority:** P2
- **Type:** Accessibility
- **Preconditions:** Emulate 390px touch viewport.
- **Steps → Expected:**
  1. Measure interactive controls (Carrito button, size buttons, `Agregar`, nav links, contact cards) → **Expected:** comfortably tappable; size buttons (`py-[9px]`, flex-1) and add button (`py-[11px]`) are reasonable.
  2. Flag any control whose effective height is < ~40px → **Expected:** note nav anchor links (text-only, `text-[15px]`, no extra vertical padding) as borderline-small touch targets.
- **Notes:** Nav links have no explicit min tap height — verify they meet ~44px guidance; file as P3 if short.

---

## M. Accessibility

### TC-LAND-057: Heading hierarchy
- **Priority:** P2
- **Type:** Accessibility
- **Preconditions:** Page loaded.
- **Steps → Expected:**
  1. Extract the heading outline → **Expected:** exactly one `<h1>` (Hero `Champion`/`Mentality`); section titles are `<h2>` (Manifiesto, Productos, Historia, Proximos, Contacto); product titles are `<h3>`.
  2. Check for skipped levels → **Expected:** no `<h3>` without an enclosing `<h2>`; logical, non-skipping order.
- **Notes:** Kickers (e.g. `Nuestros productos`) are styled `<div>`s, not headings — correct.

### TC-LAND-058: Image alt text quality
- **Priority:** P2
- **Type:** Accessibility
- **Preconditions:** Page loaded.
- **Steps → Expected:**
  1. Audit `<img>` alts → **Expected:** meaningful alts where content-bearing: Nav logo `Resolute Force`; product images `Remera Resolute Force {color}`; Manifiesto `Atleta Resolute Force rompiendo el papel`; Historia `Colección Resolute Force en el gimnasio`.
  2. Check decorative images → **Expected:** Hero background logo, Proximos logo, and Footer logo use `alt=""` (correctly hidden from AT).
- **Notes:** Good baseline. Verify the Historia `order-1/order-2` visual swap doesn't desync from reading order for screen-reader users.

### TC-LAND-059: Keyboard navigation and focus order
- **Priority:** P1
- **Type:** Accessibility
- **Preconditions:** Page loaded; use Tab only.
- **Steps → Expected:**
  1. Tab from the top → **Expected:** focus reaches, in DOM order: logo link → 4 nav links → Carrito button → Hero CTAs → product size buttons + Agregar (disabled OOS buttons are skipped) → contact links → footer links.
  2. Activate the Carrito button with Enter/Space → **Expected:** drawer opens; focus management into the drawer is a Module 3 check.
  3. Tab to a size button and press Enter → **Expected:** selects that size; press Enter on `Agregar` → adds + toast.
- **Notes:** Disabled buttons (OOS sizes, sold-out Agregar) are correctly removed from the tab order.

### TC-LAND-060: Focus-visible indicators
- **Priority:** P2
- **Type:** Accessibility
- **Preconditions:** Keyboard navigation.
- **Steps → Expected:**
  1. Tab through interactive elements → **Expected:** a visible focus ring on links/buttons (browser default `:focus-visible`, since no global outline reset is present in `index.css`).
- **Notes:** `index.css` does not remove outlines (only `box-sizing`, `scroll-behavior`, `::selection`, placeholder colour), so default focus rings should remain — verify none are suppressed by Tailwind utility resets.

### TC-LAND-061: Colour contrast of red/gold on dark
- **Priority:** P2
- **Type:** Accessibility
- **Preconditions:** Page loaded.
- **Steps → Expected:**
  1. Measure `red #e4322b` text on `bg #0a0a0b` (e.g. Hero `Mentality`, marquee is white-on-red) → **Expected:** large display text passes AA-large; verify any small red text meets ≥3:1 (large) / 4.5:1 (normal).
  2. Measure `gold #e8b53e` kickers on dark and `mut #97979d` muted body on `#0a0a0b` → **Expected:** gold on dark passes comfortably; flag `mut` muted text (`#97979d`) at small sizes if it dips below 4.5:1.
- **Notes:** Marquee text is white on red `#e4322b` — check that combination too. Record exact ratios per element.

### TC-LAND-062: Reduced-motion preference is ignored (gap)
- **Priority:** P2
- **Type:** Accessibility
- **Preconditions:** Enable OS "Reduce motion".
- **Steps → Expected:**
  1. Load `/` → **Expected (current code):** marquee scroll, Proximos `ember` pulse, Hero `float` cue, and the toast animation all still run; `scroll-behavior: smooth` is also unconditional.
- **Notes:** **Accessibility defect candidate** (same root cause as TC-LAND-018): no `prefers-reduced-motion` media query anywhere. File once, reference both cases.

### TC-LAND-063: Carrito button is reachable and announced by name
- **Priority:** P2
- **Type:** Accessibility
- **Preconditions:** Screen reader (VoiceOver/NVDA) on.
- **Steps → Expected:**
  1. Navigate to the cart button → **Expected:** announced as "Carrito, button" (via `aria-label`); when the badge shows, the count is plain text inside the button and is read after the label (e.g. "Carrito 2").
- **Notes:** Badge has no `aria-live`; a count change is not announced dynamically — note as a minor enhancement.

---

## N. Design-token fidelity

### TC-LAND-064: Brand colours match the tokens
- **Priority:** P2
- **Type:** UI
- **Preconditions:** Page loaded; use the colour picker / computed styles.
- **Steps → Expected:**
  1. Sample the red elements (marquee bar, Hero `Mentality`, tag badges, CTA) → **Expected:** `#e4322b` (`red`); hover/darker red is `#bb211c` (`redd`).
  2. Sample the gold accents (kickers, gold `◆`, Seg cell, drop title) → **Expected:** `#e8b53e` (`gold`).
  3. Sample base surfaces → **Expected:** page `bg #0a0a0b`, panels `#0e0e10`, cards `#161619`, primary text `#f4f4f3`, muted `#97979d`.
- **Notes:** Tokens defined in `tailwind.config.ts`. The Hero `Mentality` glow and Proximos title use inline `rgba(228,50,43,…)`/`rgba(232,181,62,…)` which equal `#e4322b`/`#e8b53e`.

### TC-LAND-065: Typography roles — Saira Condensed vs Barlow
- **Priority:** P3
- **Type:** UI
- **Preconditions:** Fonts loaded.
- **Steps → Expected:**
  1. Inspect headings, kickers, nav, buttons, badges → **Expected:** `font-family: "Saira Condensed"` (`font-display`).
  2. Inspect body paragraphs (Hero subtitle, Manifiesto/Historia copy, contact sub-text) → **Expected:** `font-family: "Barlow"` (`font-body`).
- **Notes:** `font-body` is applied at the landing root; `font-display` is applied per element. Confirm no element accidentally falls back to `system-ui` while fonts are available.

### TC-LAND-066: Selection highlight uses brand red
- **Priority:** P3
- **Type:** UI
- **Preconditions:** Page loaded.
- **Steps → Expected:**
  1. Select some body text with the cursor → **Expected:** selection background is `#e4322b` with white text (`::selection` rule in `index.css`).
- **Notes:** Purely cosmetic brand detail.

---

## O. Edge & error states

### TC-LAND-067: Content fetch error shows the full-page fallback
- **Priority:** P1
- **Type:** Negative
- **Preconditions:** Force `GET /api/content` to fail (stop API, or 500) so the query errors after its single retry.
- **Steps → Expected:**
  1. Load `/` → **Expected:** the entire landing is replaced by a centred fallback: `<h1>` `No pudimos cargar la tienda`, paragraph `Revisá tu conexión e intentá de nuevo.`, and a red `Reintentar` button — still inside `div[data-testid="landing"]`.
  2. Confirm no marquee/nav/sections render → **Expected:** only the fallback (because content gates everything).
- **Notes:** `content.isError` branch in `Landing.tsx`. With `retry: 1` (queryClient) the error appears after 2 total attempts.

### TC-LAND-068: Reintentar refetches and recovers
- **Priority:** P1
- **Type:** Functional
- **Preconditions:** Be on the content-error fallback (TC-LAND-067); then restore the API.
- **Steps → Expected:**
  1. Bring the API back up, click `Reintentar` → **Expected:** `content.refetch()` runs; on success the real landing renders in place (no full page reload).
  2. While refetch is in flight → **Expected:** transient blank/`bg-bg` placeholder is acceptable until data arrives.
- **Notes:** Recovery path for the catalog-down scenario.

### TC-LAND-069: Slow network shows blank placeholder, then hydrates
- **Priority:** P2
- **Type:** UI
- **Preconditions:** DevTools throttle "Slow 3G"; cold cache.
- **Steps → Expected:**
  1. Load `/` → **Expected:** blank `bg-bg` placeholder while `/api/content` is pending (no spinner); when it resolves the page renders; products/drop may pop in slightly later (independent queries), so the grid/countdown can hydrate after the rest.
  2. Confirm no layout error if products arrive after content → **Expected:** Productos starts empty then fills; no crash.
- **Notes:** `staleTime: 60_000` means a quick reload within 60s serves cached data instantly (TC-LAND-071).

### TC-LAND-070: Broken product image (404) keeps the card usable
- **Priority:** P2
- **Type:** Negative
- **Preconditions:** Point a product `imageUrl` at a non-existent asset (e.g. `/assets/missing.png`).
- **Steps → Expected:**
  1. Load `/` → **Expected:** the image area shows the browser's broken-image placeholder (background `#d2d2cf` shows through; no `onError` fallback exists), but the alt text `Remera Resolute Force {color}` is exposed; the rest of the card (size buttons, price, `Agregar`) still works.
- **Notes:** No image error handling in `ProductCard.tsx`. The same applies to logo/lifestyle/teaser images. File as a P3 polish item if a placeholder image is desired.

### TC-LAND-071: Reload restores the cart but keeps the drawer closed
- **Priority:** P1
- **Type:** Functional
- **Preconditions:** Add 2 items, then reload the page.
- **Steps → Expected:**
  1. After adding items, hard-reload `/` → **Expected:** cart badge still shows the persisted total (items restored from `localStorage` key `rf-cart`), but the **drawer is closed** and the **checkout modal is closed**.
  2. Inspect persisted state → **Expected:** only `items` is persisted (`partialize: (s) => ({ items })`); `open`/`checkoutOpen` are NOT persisted, so both default to `false` on load.
- **Notes:** Confirms `add()` opening the drawer does not survive reload. Reconcile runs on load to refresh persisted line prices/labels against the live catalog (Module 3 covers reconcile edge cases).

### TC-LAND-072: Blocked font CDN falls back to system fonts
- **Priority:** P3
- **Type:** Negative
- **Preconditions:** Block `fonts.googleapis.com`/`fonts.gstatic.com` (offline or request blocking).
- **Steps → Expected:**
  1. Load `/` → **Expected:** headings/body fall back to `system-ui, sans-serif`; layout still holds (clamps/letter-spacing unchanged); no blank text (no FOIT beyond `display=swap`).
- **Notes:** Fonts are CDN-only; verify the brand still reads acceptably degraded.

### TC-LAND-073: "Stop at Nothing" canonical casing (CD-9 resuelto)
- **Priority:** P3
- **Type:** UI
- **Preconditions:** Default seed; page loaded.
- **Steps → Expected:**
  1. Compare the phrase across the page → **Expected:** a single canonical casing `Stop at Nothing` in source everywhere — product line/card, marquee, Productos intro, Manifiesto principle 03 and the checkout tagline (the last three are CSS-uppercased on screen).
- **Notes:** **CD-9 resuelto** — seed product line, Manifiesto y taglines de checkout normalizados a `Stop at Nothing`. The earlier three-casing inconsistency no longer exists.

---

## Cross-references
- Cart drawer, qty controls, line totals (CD-3), reconcile, `startCheckout` → **Module 3**.
- Checkout entry, transfer/quote, dynamic transfer badge vs CD-4 → **Module 4**.
- Content XSS escaping on the public landing (CD-8), CORS, i18n 404 bodies → **Module 13**.
- Drop/content admin edits that feed this page (`visible`, `title`, `marquee`, contact fields) → **Module 11**.
