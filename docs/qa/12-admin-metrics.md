# Module 12 — Admin metrics dashboard

> Scope: the admin **Métricas** dashboard (`/admin`, index route; `GET /api/admin/metrics`). Covers the loading/zero-data states, every computed metric (revenue, units, avg order value, top products, 30-day revenue series, low stock, visits, conversion), the `paid|shipped`-only revenue rule, the windowed conversion math, the active-only low-stock filter, es-AR formatting, security, a11y and large-data rendering.

Read the [README](README.md) first for env, the canonical seed (4 products, stock 25, **no** orders, **no** visits on a fresh seed), the order-status lifecycle and the case/priority conventions.

**Reusable facts (do not repeat per case):**
- Endpoint requires `Authorization: Bearer <jwt>`. Missing header → `401 {error:'No autorizado'}`; bad token → `401 {error:'Sesión inválida o expirada'}`.
- `getMetrics` (`services/metrics.ts`). `PAID = ['paid','shipped']`. Computations:
  - `revenue` = Σ `order.total` over PAID orders.
  - `unitsSold` = Σ `item.qty` over PAID orders.
  - `avgOrderValue` = `Math.round(revenue / paidCount)`, or `0` if no paid orders.
  - `ordersByStatus` = count of orders per status (all statuses).
  - `topProducts` = top 5 by summed qty, label `"<line> · <color>"`, sorted desc.
  - `revenueLast30` = exactly **30** entries `[d=29…0]`, each `{date:'YYYY-MM-DD', total}` summing PAID orders whose `createdAt` date matches.
  - `lowStock` = variants with `stock <= 5` **AND** `product.active = true`, mapped to `{line,color,size,stock}`.
  - `visits30` = `Visit` rows in the last 30 days.
  - `conversionRate` = `Math.round((paidLast30 / visits30) * 1000)/10` (1-decimal %), `0` when `visits30 === 0`. `paidLast30` = PAID orders with `createdAt` within the last 30 days (windowed, like-for-like with visits).
- UI (`Metrics.tsx`): cards `Ingresos`=money(revenue), `Unidades vendidas`=unitsSold, `Ticket promedio`=money(avgOrderValue), `Visitas (30d)`=visits30, `Conversión`=`${conversionRate}%`, `Pendientes`=ordersByStatus.pending ?? 0, `Pagados`=ordersByStatus.paid ?? 0, `Enviados`=ordersByStatus.shipped ?? 0. Lists: `Top productos` (empty → `Sin ventas aún.`), `Stock bajo (≤5)` (empty → `Todo con stock.`). While loading → `Cargando métricas…`.
- Visits are recorded via `POST /api/track` (public, body `{path}`); each call inserts one `Visit`.
- Fresh seed → all zeros: revenue 0, unitsSold 0, avgOrderValue 0, visits30 0, conversionRate 0, topProducts `[]`, lowStock `[]` (stock 25 > 5), `revenueLast30` = 30 entries all `total:0`, ordersByStatus `{}`.

**Coverage checklist:**
- [ ] Dashboard loads (loading state); zero-data state (all zeros + empty-list copy)
- [ ] After 1 paid order revenue/units/avg update; avgOrderValue rounding; topProducts ranking + label format; topProducts capped at 5
- [ ] revenueLast30 has exactly 30 dated entries; lowStock lists ≤5 after reduction; lowStock excludes inactive product variants; lowStock excludes >5
- [ ] visits30 increments after /api/track; conversionRate math; conversionRate 0 when visits30 0; conversionRate windowed (old paid excluded)
- [ ] ordersByStatus counts; shipped counts as paid for revenue; cancelled & pending excluded from revenue
- [ ] unauthorized → 401; money es-AR; a11y of cards/lists; large-data rendering

---

## Dashboard load & states

### TC-MET-001: Dashboard loads and shows the loading state first
- **Priority:** P1
- **Type:** Functional
- **Preconditions:** Logged in; API reachable.
- **Steps → Expected:**
  1. Navigate to `/admin` (sidebar **Métricas**) → **Expected:** briefly shows `Cargando métricas…` while `GET /api/admin/metrics` is in flight, then the heading `Métricas` plus the 8 stat cards and the two lists render.
- **Notes:** Loading guard is `isLoading || !data`.

### TC-MET-002: Zero-data state shows all zeros and empty-list copy
- **Priority:** P1
- **Type:** Functional
- **Preconditions:** Logged in; freshly seeded DB (no orders, no visits).
- **Steps → Expected:**
  1. Open `/admin` → **Expected:** `Ingresos $0`, `Unidades vendidas 0`, `Ticket promedio $0`, `Visitas (30d) 0`, `Conversión 0%`, `Pendientes 0`, `Pagados 0`, `Enviados 0`.
  2. Inspect the lists → **Expected:** `Top productos` shows `Sin ventas aún.`; `Stock bajo (≤5)` shows `Todo con stock.` (seed stock 25 > 5).
- **Notes:** Confirms every `?? 0`/empty-array fallback. `revenueLast30` still has 30 zero entries (not surfaced as a card but present in the payload).

---

## Revenue, units & average

### TC-MET-003: After one paid order, revenue/units/avg update
- **Priority:** P0
- **Type:** Functional
- **Preconditions:** Logged in; one PAID order (e.g. `Azul Marino` size M qty 2 at `30000` each → total `60000`, method card).
- **Steps → Expected:**
  1. Confirm the order to `paid` (Module 10), then reload `/admin` → **Expected:** `Ingresos $60.000`, `Unidades vendidas 2`, `Ticket promedio $60.000` (60000/1), `Pagados 1`.
- **Notes:** Matches shipped test (`revenue 60000`, `unitsSold 2`). Card method → total = subtotal (no discount).

### TC-MET-004: avgOrderValue rounds to the nearest integer
- **Priority:** P2
- **Type:** Boundary
- **Preconditions:** Logged in; two PAID orders whose totals don't divide evenly (e.g. totals `27000` and `30000` → sum `57000`, count 2 → `28500`; or craft `revenue/count` with a `.5` to verify rounding, e.g. totals summing to an odd number over 2).
- **Steps → Expected:**
  1. View `Ticket promedio` → **Expected:** `money(Math.round(revenue/paidCount))`. For `57000/2=28500` → `$28.500`. For a case rounding up (e.g. sum `57001/2=28500.5` → `28501`) → `$28.501`.
  2. With zero paid orders → **Expected:** `avgOrderValue=0` → `$0` (no divide-by-zero).
- **Notes:** Confirms `Math.round` and the `paid.length ? … : 0` guard.

---

## Top products

### TC-MET-005: topProducts ranking and label format
- **Priority:** P1
- **Type:** Functional
- **Preconditions:** Logged in; PAID orders such that product A sold more units than product B (e.g. A qty 5, B qty 2 across paid orders).
- **Steps → Expected:**
  1. View `Top productos` → **Expected:** rows sorted by qty descending; A above B; each label is `"<line> · <color>"` (e.g. `Champion Mentality · Azul Marino`) with the qty on the right in gold.
- **Notes:** Aggregation key is `"<line> · <color>"` from the order-item snapshot, so it survives product deletion (null productId). Matches shipped test (`topProducts[0].label` contains `Azul Marino`).

### TC-MET-006: topProducts is capped at 5
- **Priority:** P2
- **Type:** Boundary
- **Preconditions:** Logged in; PAID orders covering 6+ distinct line·color combinations.
- **Steps → Expected:**
  1. View `Top productos` → **Expected:** at most 5 rows (the top 5 by qty); the 6th+ are omitted (`.slice(0,5)`).
- **Notes:** Ties are broken by `sort` stability/order — note if a tie at the boundary excludes an equally-ranked product.

---

## Revenue last 30 & low stock

### TC-MET-007: revenueLast30 has exactly 30 dated entries
- **Priority:** P2
- **Type:** Functional
- **Preconditions:** Logged in.
- **Steps → Expected:**
  1. Inspect the `GET /api/admin/metrics` response `revenueLast30` → **Expected:** exactly 30 elements, ordered oldest→newest (`d=29…0`), each `{date:'YYYY-MM-DD', total:<number>}`; the last entry's date is today (UTC). Days with no paid orders have `total:0`.
  2. Add a PAID order today → **Expected:** today's entry `total` increases by that order's total; other days stay `0`.
- **Notes:** Matches shipped test (`revenueLast30` length 30). Dates are UTC `toISOString().slice(0,10)` — flag any local/UTC boundary mismatch near midnight.

### TC-MET-008: lowStock lists a variant after stock drops to ≤5
- **Priority:** P1
- **Type:** Functional
- **Preconditions:** Logged in; reduce one **active** product's variant to `stock=3` (via edit, or by selling down).
- **Steps → Expected:**
  1. Reload `/admin` → **Expected:** `Stock bajo (≤5)` lists that variant as `<line> · <color> · <size>` with the stock value (`3`) in red.
  2. Set the variant to exactly `5` → **Expected:** still listed (`<= 5` inclusive). Set to `0` → **Expected:** listed with `0`.
- **Notes:** Boundary is inclusive at 5.

### TC-MET-009: lowStock excludes variants of inactive products
- **Priority:** P1
- **Type:** Functional
- **Preconditions:** Logged in; a product variant with `stock<=5` whose product is set `active=false`.
- **Steps → Expected:**
  1. Reduce a variant to `1`, then set its product `inactivo` (Module 9), reload `/admin` → **Expected:** that variant is **NOT** in `Stock bajo` (`where product.active=true`).
  2. Re-activate the product → **Expected:** the low-stock variant re-appears.
- **Notes:** Matches shipped test (`lowStock excludes variants of inactive products`). This is a deliberate filter, but note it as a blind spot: a low/zero-stock inactive product won't surface for restock. Flag for product-owner awareness.

### TC-MET-010: lowStock excludes variants with stock > 5
- **Priority:** P2
- **Type:** Boundary
- **Preconditions:** Logged in; fresh seed (all stock 25) or set a variant to `6`.
- **Steps → Expected:**
  1. With a variant at `6` and all others ≥6, reload → **Expected:** `Stock bajo (≤5)` shows `Todo con stock.` (6 is above the threshold).

---

## Visits & conversion

### TC-MET-011: visits30 increments after /api/track hits
- **Priority:** P1
- **Type:** Integration
- **Preconditions:** Logged in; fresh seed (visits 0).
- **Steps → Expected:**
  1. `POST /api/track {path:'/'}` three times (or load the public landing, which tracks a visit), then reload `/admin` → **Expected:** `Visitas (30d)` shows the number of tracked visits in the last 30 days (e.g. `3`).
- **Notes:** Matches shipped test (`visits30=1` after one track). Visits older than 30 days are excluded.

### TC-MET-012: conversionRate = paidLast30 / visits30 (1-decimal %)
- **Priority:** P1
- **Type:** Functional
- **Preconditions:** Logged in; known counts (e.g. 1 paid order within 30 days, 1 visit within 30 days).
- **Steps → Expected:**
  1. With 1 paid + 1 visit (both recent) → **Expected:** `Conversión 100%` (`round(1/1*1000)/10`).
  2. With 1 paid + 4 visits → **Expected:** `25%`. With 1 paid + 3 visits → **Expected:** `33.3%` (`round(333.33)/10`).
- **Notes:** Verify 1-decimal rounding (`*1000)/10`). `paidLast30` counts orders in `{paid,shipped}` created within the window.

### TC-MET-013: conversionRate is 0 when there are no visits
- **Priority:** P1
- **Type:** Boundary
- **Preconditions:** Logged in; visits30 = 0 but ≥1 paid order exists.
- **Steps → Expected:**
  1. Have a paid order but no visits in the window → **Expected:** `Conversión 0%` (the `visits30 ? … : 0` guard prevents divide-by-zero), NOT `Infinity`/`NaN`.

### TC-MET-014: conversionRate window excludes old paid orders
- **Priority:** P1
- **Type:** Functional
- **Preconditions:** Logged in; one paid order backdated to 60 days ago, one recent visit.
- **Steps → Expected:**
  1. Backdate the only paid order's `createdAt` to 60 days ago, add 1 recent visit, reload metrics → **Expected:** `Visitas (30d) 1`, `Conversión 0%` (the old paid order falls outside the 30-day `paidLast30` window — all-time paid=1 would wrongly give 100%).
- **Notes:** Matches shipped test (`conversionRate counts only paid orders inside the 30-day visit window`). Guards against the like-for-like-window bug.

---

## Orders by status & revenue inclusion

### TC-MET-015: ordersByStatus counts orders per status
- **Priority:** P2
- **Type:** Functional
- **Preconditions:** Logged in; orders across statuses (e.g. 2 pending, 1 paid, 1 shipped, 1 cancelled).
- **Steps → Expected:**
  1. View the cards → **Expected:** `Pendientes 2`, `Pagados 1`, `Enviados 1` (cancelled has no card but is in the `ordersByStatus` payload). Each uses `?? 0` so an absent status shows `0`.
- **Notes:** Only pending/paid/shipped are surfaced as cards; cancelled count is in the API response only.

### TC-MET-016: shipped orders count as paid for revenue
- **Priority:** P1
- **Type:** Functional
- **Preconditions:** Logged in; one `shipped` order total `30000`, no `paid` orders.
- **Steps → Expected:**
  1. View metrics → **Expected:** `Ingresos $30.000`, `Unidades vendidas` includes that order's units (`PAID` includes `shipped`); the order also counts in `paidLast30` for conversion.
- **Notes:** Revenue is the union of paid + shipped.

### TC-MET-017: cancelled orders are excluded from revenue
- **Priority:** P1
- **Type:** Functional
- **Preconditions:** Logged in; one `cancelled` order total `30000`, no paid/shipped.
- **Steps → Expected:**
  1. View metrics → **Expected:** `Ingresos $0`, `Unidades vendidas 0`; the cancelled order is counted only in `ordersByStatus.cancelled`, never in revenue/units/avg/top/conversion.

### TC-MET-018: pending orders are excluded from revenue and units
- **Priority:** P2
- **Type:** Functional
- **Preconditions:** Logged in; one `pending` order total `30000`.
- **Steps → Expected:**
  1. View metrics → **Expected:** `Ingresos $0`, `Unidades vendidas 0`, `Pendientes 1`; revenue/units only count after the order becomes `paid`/`shipped`.

---

## Security, formatting, a11y & performance

### TC-MET-019: Metrics endpoint rejects unauthorized access → 401
- **Priority:** P0
- **Type:** Security
- **Preconditions:** No / bad token.
- **Steps → Expected:**
  1. `GET /api/admin/metrics` with no `Authorization` → **Expected:** `401 {error:'No autorizado'}`.
  2. Repeat with `Authorization: Bearer garbage` → **Expected:** `401 {error:'Sesión inválida o expirada'}`.
- **Notes:** Matches shipped test (`guards metrics behind auth`). No metric data leaks without auth.

### TC-MET-020: Money values render in es-AR format
- **Priority:** P2
- **Type:** UI
- **Preconditions:** Logged in; revenue and avgOrderValue non-zero (e.g. revenue `60000`, avg `30000`).
- **Steps → Expected:**
  1. View `Ingresos` and `Ticket promedio` → **Expected:** `$60.000` and `$30.000` (dot thousands separator, no centavos). `0` renders `$0`. A 7-figure revenue (`1234567`) → `$1.234.567`.
- **Notes:** `conversionRate` renders as `${rate}%` (e.g. `33.3%`); numeric cards (`Unidades vendidas`, `Visitas (30d)`, status counts) render plain integers without `$`.

### TC-MET-021: Cards and lists are accessible
- **Priority:** P3
- **Type:** Accessibility
- **Preconditions:** Logged in.
- **Steps → Expected:**
  1. Inspect the dashboard with a screen reader / a11y tooling → **Expected:** the page heading `Métricas` is an `<h1>`; each card exposes its label text and value as readable content; the two list section titles (`Top productos`, `Stock bajo (≤5)`) are readable.
  2. **Expected (gap to flag):** cards are plain `<div>`s with no list/role semantics or `aria` grouping; values aren't programmatically tied to labels beyond visual proximity. Note as an a11y improvement; verify color is not the only differentiator (low-stock numbers are red, top-product qty gold).
- **Notes:** Check contrast of the muted label text and the gold/red accent values.

### TC-MET-022: Dashboard renders with large data volumes
- **Priority:** P3
- **Type:** Performance
- **Preconditions:** Logged in; large dataset (e.g. thousands of orders + many low-stock variants + many visits).
- **Steps → Expected:**
  1. Open `/admin` → **Expected:** metrics compute and render within an acceptable time; `topProducts` still caps at 5; `revenueLast30` still has 30 entries; `Stock bajo` may be long but renders without breaking layout.
- **Notes:** `getMetrics` loads all orders+items into memory and iterates — record timing as order volume grows; flag if it degrades noticeably (no DB-side aggregation/caching).
