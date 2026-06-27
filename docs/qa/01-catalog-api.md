# Module 1 — Catalog API

> Scope: the **read-only public catalog endpoints** served by the Express/Prisma API on `:4000` — `GET /api/health`, `GET /api/products`, `GET /api/products/:slug`, `GET /api/drop`, `GET /api/content`. Covers response shape (`ProductDTO`/`DropDTO`/`ContentDTO`), field presence **and** field absence (no leak of `active`/`sortOrder`/internal columns), ordering, money typing, unseeded-singleton failure, slug edge cases, routing/method handling, and copy consistency. Mutations (admin writes) are **out of scope** — see Modules 9 & 11. Setup, canonical seed data, money/locale rules and the test-case conventions live in [README.md](README.md); this module does not repeat them.

**Coverage checklist:**
- [ ] `GET /api/health` returns `200 {ok:true}`
- [ ] `GET /api/products` happy path → `200`, 4 active products, JSON content-type
- [ ] `ProductDTO` contains exactly the public fields; **omits** `active`, `sortOrder`, `imagePublicId`, timestamps
- [ ] Products ordered by `sortOrder asc`; variants/`sizes` ordered `S, M, L, XL`
- [ ] `price` is an **integer** ARS, never a string; `tag` is `string | null`
- [ ] Only `active:true` products are listed; inactive ones never appear
- [ ] `GET /api/products/:slug` happy path → `200` single `ProductDTO`, identical shape to list item
- [ ] Unknown slug → `404 {error:"Producto no encontrado"}`
- [ ] **Inactive** product slug → `404` (CD-1 regression — must never expose inactive products)
- [ ] Empty / trailing-slash / malformed / case-shifted / whitespace / oversized / injection slug behave safely
- [ ] `GET /api/drop` happy path → `200 DropDTO`; unseeded → `500 {error:"DropConfig no inicializado — corré el seed"}`
- [ ] `GET /api/content` happy path → `200 ContentDTO` (marquee JSON-parsed); unseeded → `500 {error:"SiteContent no inicializado — corré el seed"}`
- [ ] Unmatched route → `404 {error:"No encontrado"}`; unsupported method on a real path → `404`
- [ ] Query params (pagination/filter/sort) are silently ignored — none implemented
- [ ] Responses are idempotent / repeatable for unchanged data
- [ ] CD-2: product 404 (Spanish) vs global 404 (English) language mismatch documented
- [ ] CD-9 (resuelto): product line y marquee/hero usan `Stop at Nothing` (casing canónico unificado)

---

## 1.1 Health & availability

### TC-CAT-001: Health endpoint returns ok
- **Priority:** P0
- **Type:** Functional
- **Preconditions:** API running on `:4000` (README → Commands).
- **Steps → Expected:**
  1. `curl -i http://localhost:4000/api/health` → **Expected:** HTTP `200`; body exactly `{"ok":true}`; `Content-Type: application/json`.
- **Notes:** Smoke-suite gate. No DB read involved, so it succeeds even on an unseeded database.

---

## 1.2 `GET /api/products` — list

### TC-CAT-002: List active products happy path
- **Priority:** P0
- **Type:** Functional
- **Preconditions:** DB seeded (README → Canonical seed data: 4 products, all `active`, all `price=30000`).
- **Steps → Expected:**
  1. `GET /api/products` → **Expected:** HTTP `200`; body is a JSON **array** of length `4`.
  2. Inspect element `[0]` → **Expected:** `slug="champion-mentality-azul-marino"`, `line="Champion Mentality"`, `color="Azul Marino"`, `price=30000`, `tag="Más vendida"`.

### TC-CAT-003: ProductDTO exposes exactly the public fields
- **Priority:** P1
- **Type:** Functional
- **Preconditions:** Seeded DB.
- **Steps → Expected:**
  1. `GET /api/products`; read the key set of any element → **Expected:** keys are exactly `id, slug, line, color, dotColor, tag, price, imageUrl, sizes` — no more, no less.
  2. Inspect a `sizes[]` entry → **Expected:** each is exactly `{size, stock}` (e.g. `{"size":"S","stock":25}`); no `id`, `productId`, or `sku`.
- **Notes:** Maps to `toDTO` in `apps/api/src/services/catalog.ts`.

### TC-CAT-004: ProductDTO does NOT leak internal columns
- **Priority:** P1
- **Type:** Security
- **Preconditions:** Seeded DB.
- **Steps → Expected:**
  1. `GET /api/products`; assert on every element → **Expected:** keys `active`, `sortOrder`, `imagePublicId`, `createdAt`, `updatedAt` are **absent**.
  2. Search the full raw response text for `"sortOrder"`, `"active"`, `"imagePublicId"` → **Expected:** zero matches.
- **Notes:** `sortOrder` controls ordering but is internal; `imagePublicId` is a Cloudinary handle. Leaking `active` would advertise hidden products. Companion to CD-1 (TC-CAT-016).

### TC-CAT-005: Inactive products are excluded from the list
- **Priority:** P1
- **Type:** Functional
- **Preconditions:** Seeded DB; set one product `active=false` (admin un-publish, or DB update) — e.g. `stop-at-nothing-blanco`.
- **Steps → Expected:**
  1. `GET /api/products` → **Expected:** array length `3`; the de-activated slug is absent.
  2. Re-activate it; `GET /api/products` again → **Expected:** length back to `4`.
- **Notes:** `listProducts` filters `where:{active:true}`. Reset state afterwards.

### TC-CAT-006: Products ordered by sortOrder ascending
- **Priority:** P1
- **Type:** Functional
- **Preconditions:** Seeded DB.
- **Steps → Expected:**
  1. `GET /api/products`; read slugs in array order → **Expected:** `champion-mentality-azul-marino` (0), `champion-mentality-negro` (1), `champion-mentality-verde-militar` (2), `stop-at-nothing-blanco` (3) — matches `sortOrder` 0..3.
- **Notes:** `orderBy:{sortOrder:'asc'}`. Even though `sortOrder` is not in the DTO, its **effect** (order) is observable.

### TC-CAT-007: Variant sizes ordered S, M, L, XL
- **Priority:** P1
- **Type:** Functional
- **Preconditions:** Seeded DB (each product has S/M/L/XL).
- **Steps → Expected:**
  1. `GET /api/products`; for each product read `sizes[].size` in order → **Expected:** exactly `["S","M","L","XL"]` for every product, regardless of DB insert order.
- **Notes:** `toDTO` sorts by `SIZES.indexOf(...)`. A variant with a size **not** in `SIZES` would rank `-1` and sort to the front — worth probing if custom sizes are ever added.

### TC-CAT-008: Price is an integer, not a string or float
- **Priority:** P1
- **Type:** Boundary
- **Preconditions:** Seeded DB.
- **Steps → Expected:**
  1. `GET /api/products`; inspect `[0].price` in the raw JSON → **Expected:** the literal token is `30000` (no quotes, no decimal point) — JSON number, not `"30000"` or `30000.0`.
  2. Assert `typeof price === "number"` and `Number.isInteger(price)` → **Expected:** both true.
- **Notes:** All money is integer ARS (README → Money & locale). The `$30.000` dot formatting is a **client-display** concern, validated in Module 13.

### TC-CAT-009: tag is string when present and null when absent
- **Priority:** P2
- **Type:** Functional
- **Preconditions:** Seeded DB.
- **Steps → Expected:**
  1. `GET /api/products`; read `tag` for `champion-mentality-azul-marino` → **Expected:** `"Más vendida"`.
  2. Read `tag` for `champion-mentality-negro` → **Expected:** JSON `null` (not `""`, not missing).
  3. Read `tag` for `stop-at-nothing-blanco` → **Expected:** `"Nuevo"`.

### TC-CAT-010: Response content-type is JSON
- **Priority:** P2
- **Type:** Functional
- **Preconditions:** Seeded DB.
- **Steps → Expected:**
  1. `curl -i http://localhost:4000/api/products` → **Expected:** header `Content-Type: application/json; charset=utf-8`; body parses as JSON.

### TC-CAT-011: List response is idempotent / repeatable
- **Priority:** P2
- **Type:** Functional
- **Preconditions:** Seeded DB, no concurrent writes.
- **Steps → Expected:**
  1. Call `GET /api/products` twice → **Expected:** both responses byte-for-byte equal (same order, same values).
- **Notes:** Read-only endpoint; ordering is deterministic (`sortOrder`, then size rank). Guards against accidental nondeterministic ordering.

### TC-CAT-012: Empty catalog returns 200 with empty array
- **Priority:** P2
- **Type:** Boundary
- **Preconditions:** All products `active=false` (or products table empty).
- **Steps → Expected:**
  1. `GET /api/products` → **Expected:** HTTP `200`; body `[]` — **not** `404`, not `500`.
- **Notes:** No products is a valid empty state, distinct from a missing singleton. Restore seed afterward.

### TC-CAT-013: Query params are ignored (no pagination/filter/sort)
- **Priority:** P2
- **Type:** Boundary
- **Preconditions:** Seeded DB.
- **Steps → Expected:**
  1. `GET /api/products?page=2&limit=1&sort=price&color=Negro` → **Expected:** identical full 4-element array as TC-CAT-002; params have no effect.
- **Notes:** No pagination/filter/sort is implemented. Documents the contract so callers don't assume server-side filtering.

---

## 1.3 `GET /api/products/:slug` — detail

### TC-CAT-014: Fetch active product by slug
- **Priority:** P0
- **Type:** Functional
- **Preconditions:** Seeded DB.
- **Steps → Expected:**
  1. `GET /api/products/champion-mentality-azul-marino` → **Expected:** HTTP `200`; single `ProductDTO` object (not an array); `price=30000`, `color="Azul Marino"`, `tag="Más vendida"`.
  2. Inspect keys → **Expected:** same field set as TC-CAT-003 (and same omissions as TC-CAT-004).

### TC-CAT-015: Detail DTO matches the corresponding list item
- **Priority:** P2
- **Type:** Integration
- **Preconditions:** Seeded DB.
- **Steps → Expected:**
  1. Fetch the product from `GET /api/products` (filter to one slug) and from `GET /api/products/:slug` → **Expected:** the two objects are deep-equal (same `sizes` order, same values).
- **Notes:** Both paths run the same `toDTO`. Catches divergence if one path is later changed.

### TC-CAT-016: Inactive product slug returns 404 (CD-1 regression)
- **Priority:** P0
- **Type:** Security
- **Preconditions:** Seeded DB; set `stop-at-nothing-blanco` to `active=false`.
- **Steps → Expected:**
  1. `GET /api/products/stop-at-nothing-blanco` → **Expected:** HTTP `404`; body `{"error":"Producto no encontrado"}`.
  2. Confirm the response body contains **no** product data (no `price`, `sizes`, `color`) → **Expected:** none present.
- **Notes:** `getProductBySlug` filters `where:{slug, active:true}`, so an inactive slug is indistinguishable from a missing one — correct/secure, resolves CD-1. **This must stay 404**; a regression to `findUnique({where:{slug}})` would leak unpublished products. Reset to `active=true` afterward.

### TC-CAT-017: Unknown slug returns 404
- **Priority:** P1
- **Type:** Negative
- **Preconditions:** Seeded DB.
- **Steps → Expected:**
  1. `GET /api/products/this-slug-does-not-exist` → **Expected:** HTTP `404`; body `{"error":"Producto no encontrado"}`.

### TC-CAT-018: Trailing-slash / empty slug falls through to the list
- **Priority:** P2
- **Type:** Boundary
- **Preconditions:** Seeded DB.
- **Steps → Expected:**
  1. `GET /api/products/` (trailing slash, no slug) → **Expected:** HTTP `200` with the **full 4-element list** — the request matches the router's `'/'` handler, not `:slug`. It is **not** a `404`.
- **Notes:** Documents a subtle routing reality: there is no "empty slug 404"; `/api/products/` == `/api/products`.

### TC-CAT-019: Slug lookup is case-sensitive
- **Priority:** P2
- **Type:** Negative
- **Preconditions:** Seeded DB.
- **Steps → Expected:**
  1. `GET /api/products/Champion-Mentality-Azul-Marino` (mixed case) → **Expected:** HTTP `404` `{"error":"Producto no encontrado"}` — stored slug is lowercase.
  2. `GET /api/products/CHAMPION-MENTALITY-AZUL-MARINO` → **Expected:** `404`.
- **Notes:** SQLite default collation is case-sensitive for these values; confirms no accidental case-folding. Path routing is also case-sensitive (`case sensitive routing` enabled) — `/API/products` → `404`, not the list.

### TC-CAT-020: Slug with surrounding/encoded whitespace returns 404
- **Priority:** P3
- **Type:** Negative
- **Preconditions:** Seeded DB.
- **Steps → Expected:**
  1. `GET /api/products/champion-mentality-azul-marino%20` (trailing encoded space) → **Expected:** HTTP `404` — server does not trim; `"...marino "` ≠ stored slug.
  2. `GET /api/products/%20champion-mentality-azul-marino` (leading space) → **Expected:** `404`.

### TC-CAT-021: Malformed slug with special characters returns 404 safely
- **Priority:** P2
- **Type:** Negative
- **Preconditions:** Seeded DB.
- **Steps → Expected:**
  1. `GET /api/products/..%2f..%2fetc%2fpasswd` → **Expected:** HTTP `404` `{"error":"Producto no encontrado"}`; no path traversal, no `500`, no file contents.
  2. `GET /api/products/%00` (encoded null) → **Expected:** handled gracefully (`404` or `400`); no crash, no stack leak.
- **Notes:** `:slug` is a single path segment used only as a Prisma string filter; it never touches the filesystem.

### TC-CAT-022: Slug used in a SQL-injection attempt is inert
- **Priority:** P1
- **Type:** Security
- **Preconditions:** Seeded DB.
- **Steps → Expected:**
  1. `GET /api/products/' OR '1'='1` (URL-encoded) → **Expected:** HTTP `404` `{"error":"Producto no encontrado"}` — treated as a literal slug, returns nothing; the catalog is **not** dumped.
  2. `GET /api/products/champion-mentality-azul-marino'; DROP TABLE Product;--` → **Expected:** `404`; products table intact on a follow-up `GET /api/products`.
- **Notes:** Prisma parameterizes queries — no string concatenation. Verifies no ORM-level injection surface.

### TC-CAT-023: Very long slug is rejected without error
- **Priority:** P3
- **Type:** Boundary
- **Preconditions:** Seeded DB.
- **Steps → Expected:**
  1. `GET /api/products/<2000-char string>` → **Expected:** HTTP `404` (or `414 URI Too Long` from the HTTP layer); never `500` with a stack trace.
- **Notes:** Upper-bound input probe for the `:slug` param.

---

## 1.4 `GET /api/drop`

### TC-CAT-024: Drop config happy path
- **Priority:** P1
- **Type:** Functional
- **Preconditions:** Seeded DB (README → DropConfig singleton).
- **Steps → Expected:**
  1. `GET /api/drop` → **Expected:** HTTP `200`; body `{targetAt, visible, title, teaser}` only.
  2. Assert values → **Expected:** `visible === true`; `title` matches `/forjando/i` (`"Algo se está forjando"`); `targetAt` is year `2026`.

### TC-CAT-025: Drop targetAt is an ISO-8601 string
- **Priority:** P2
- **Type:** Functional
- **Preconditions:** Seeded DB.
- **Steps → Expected:**
  1. `GET /api/drop`; read `targetAt` → **Expected:** a string like `2026-08-15T23:00:00.000Z` that `new Date(targetAt)` parses to a valid date; **not** a numeric epoch.
- **Notes:** `getDrop` returns `d.targetAt.toISOString()`. Seed local `-03:00` serializes to UTC `Z`.

### TC-CAT-026: Unseeded drop returns 500 with Spanish hint
- **Priority:** P1
- **Type:** Negative
- **Preconditions:** Fresh DB with **no** `DropConfig` row (migrated but not seeded; or row deleted).
- **Steps → Expected:**
  1. `GET /api/drop` → **Expected:** HTTP `500`; body `{"error":"DropConfig no inicializado — corré el seed"}` (exact em-dash and accent).
- **Notes:** Thrown `Error` surfaces via the global error handler. In `NODE_ENV=production` this message is replaced by the generic envelope — see Module 13. Re-seed afterward.

---

## 1.5 `GET /api/content`

### TC-CAT-027: Site content happy path
- **Priority:** P1
- **Type:** Functional
- **Preconditions:** Seeded DB (README → SiteContent singleton).
- **Steps → Expected:**
  1. `GET /api/content` → **Expected:** HTTP `200`; keys exactly `marquee, heroKicker, heroTitle1, heroTitle2, heroSubtitle, transferDiscountPct, bankAlias, bankCbu, contactWhatsapp, contactInstagram, contactEmail, contactLocation`.
  2. Assert values → **Expected:** `marquee` includes `"Champion Mentality"`; `contactInstagram === "@resoluteforceok"`; `transferDiscountPct === 10`.

### TC-CAT-028: marquee is a JSON-parsed array of strings
- **Priority:** P2
- **Type:** Functional
- **Preconditions:** Seeded DB.
- **Steps → Expected:**
  1. `GET /api/content`; inspect `marquee` → **Expected:** a JSON **array** of strings (length 6 per seed), **not** a single string containing `[...]`.
  2. Assert `transferDiscountPct` is a JSON **number** (`10`), not `"10"` → **Expected:** integer type.
- **Notes:** `getContent` runs `JSON.parse(c.marquee)`. If the stored column ever holds invalid JSON, this endpoint throws → `500` (worth a targeted negative if admin write validation is bypassed).

### TC-CAT-029: Default bank fields are empty strings
- **Priority:** P2
- **Type:** Boundary
- **Preconditions:** Seeded DB, untouched content.
- **Steps → Expected:**
  1. `GET /api/content`; read `bankAlias` and `bankCbu` → **Expected:** both `""` (empty string), not `null`, not missing.
- **Notes:** Ties to CD-11 (transfer path shows no bank data by default) — exercised in Modules 5/7/11. Here we only assert the API contract.

### TC-CAT-030: Unseeded content returns 500 with Spanish hint
- **Priority:** P1
- **Type:** Negative
- **Preconditions:** Fresh DB with **no** `SiteContent` row.
- **Steps → Expected:**
  1. `GET /api/content` → **Expected:** HTTP `500`; body `{"error":"SiteContent no inicializado — corré el seed"}`.
- **Notes:** Parallel to TC-CAT-026; same production-masking caveat. Re-seed afterward.

---

## 1.6 Routing, methods & cross-endpoint consistency

### TC-CAT-031: Unmatched route returns global 404
- **Priority:** P2
- **Type:** Negative
- **Preconditions:** API running.
- **Steps → Expected:**
  1. `GET /api/does-not-exist` → **Expected:** HTTP `404`; body `{"error":"No encontrado"}` (Spanish — global `notFound` handler).
  2. `GET /` (root, outside `/api`) → **Expected:** `404 {"error":"No encontrado"}`.

### TC-CAT-032: Unsupported method on a real path returns 404
- **Priority:** P2
- **Type:** Negative
- **Preconditions:** Seeded DB.
- **Steps → Expected:**
  1. `POST /api/products` (with or without body) → **Expected:** HTTP `404` `{"error":"No encontrado"}` — the products router defines only `GET`, so the request falls through to `notFound`.
  2. `PUT /api/products/champion-mentality-azul-marino` → **Expected:** `404`.
  3. `DELETE /api/drop` → **Expected:** `404`.
- **Notes:** No `405 Method Not Allowed` is emitted (Express has no route-level method guard here); the API answers `404` instead. Cross-reference Module 13 (method handling).

### TC-CAT-033: 404 bodies are consistently Spanish (CD-2 resuelto)
- **Priority:** P3
- **Type:** Functional
- **Preconditions:** Seeded DB.
- **Steps → Expected:**
  1. `GET /api/products/unknown-slug` → **Expected:** `{"error":"Producto no encontrado"}` (Spanish, from the products route).
  2. `GET /api/totally-unknown` → **Expected:** `{"error":"No encontrado"}` (Spanish, from the global handler).
  3. Compare → **Expected:** both 404 bodies are in Spanish (es-AR); no language mismatch.
- **Notes:** CD-2 resuelto — el handler global `notFound` ahora responde en español. Also asserted from the cross-cutting angle in Module 13.

---

## 1.7 Data integrity & copy consistency

### TC-CAT-034: Product line casing matches marquee/hero copy (CD-9 resuelto)
- **Priority:** P3
- **Type:** Functional
- **Preconditions:** Seeded DB.
- **Steps → Expected:**
  1. `GET /api/products`; read `line` of `stop-at-nothing-blanco` → **Expected:** `"Stop at Nothing"` (lowercase **a**).
  2. `GET /api/content`; read the `marquee` entries and hero copy → **Expected:** the slogan appears as `"Stop at Nothing"` (lowercase **a**).
  3. Compare → **Expected:** product line and marketing copy use the same canonical casing.
- **Notes:** CD-9 resuelto — casing canónico `Stop at Nothing` aplicado al seed de producto. Also referenced in Module 2.

### TC-CAT-035: All four products share the seed price and full size grid
- **Priority:** P2
- **Type:** Functional
- **Preconditions:** Seeded DB, stock untouched.
- **Steps → Expected:**
  1. `GET /api/products`; for each element assert `price === 30000` and `sizes.length === 4` → **Expected:** true for all 4 products.
  2. Assert each `sizes[].stock === 25` on a freshly seeded DB → **Expected:** true.
- **Notes:** Baseline integrity check against README seed. Re-seeding refreshes metadata but **not** stock (README), so run on a freshly reset DB if prior tests consumed stock.
