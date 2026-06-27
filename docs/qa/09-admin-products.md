# Module 9 — Admin products CRUD + Cloudinary

> Scope: the admin **Productos** list (`/admin/productos`) and the create/edit form (`/admin/productos/nuevo`, `/admin/productos/:id`), plus their API: `GET/POST /api/admin/products`, `PUT/DELETE /api/admin/products/:id`, `POST /api/admin/products/:id/image`. Covers list rendering, full create/edit/delete CRUD, every validation/boundary on price/stock/slug/sizes, Cloudinary image upload (happy, oversize, non-image, missing, service-down, partial-success), Activo/public-visibility, security, a11y and the variant-pruning concurrency defect.

Read the [README](README.md) first: it holds the env setup, the canonical seed (4 products, all `price=30000`, every variant `stock=25`, all `active`), the candidate-defects appendix (CD-1, CD-6, CD-10) and the case-format/priority conventions. This module references that baseline instead of repeating it.

**Reusable facts (do not repeat per case):**
- All `/api/admin/*` routes (except `/login`) require `Authorization: Bearer <jwt>`. Missing/malformed header → `401 {error:'No autorizado'}`; invalid/expired token → `401 {error:'Sesión inválida o expirada'}`. The web client auto-logs-out and redirects to `/admin/login` on any `401`.
- Server validation is `productInputSchema` (in `packages/shared/src/schemas.ts`): `slug/line/color/dotColor` = trimmed string min 1; `tag` = trimmed string, nullable+optional; `price` = int ≥ 0; `active` = bool (default true); `sortOrder` = int (default 0); `sizes` = array of `{size: enum[S,M,L,XL], stock: int ≥0}`, min 1 element.
- `POST` rejects with `400 {error:'Producto inválido', details:<zod flatten>}`. `PUT` rejects with `400 {error:'Producto inválido'}` (**no** details). 500s render `{error:'Error interno del servidor'}` in prod / the real message in dev.
- List row secondary line renders exactly: `money(price) · S:<n>  M:<n>  L:<n>  XL:<n> · activo|inactivo` (two spaces between size pairs). For a seed product: `$30.000 · S:25  M:25  L:25  XL:25 · activo`.
- Form (`ProductForm.tsx`): placeholders `Slug`, `Línea`, `Color`, `Tag (opcional)`, `Precio (ARS)`; a `type=color` picker (default `#101013`); four stock inputs with `aria-label` `stock-S`/`stock-M`/`stock-L`/`stock-XL`; `Activo` checkbox; `<input type=file accept="image/*">`; submit button `Guardar`; heading `Nuevo producto` (create) / `Editar producto` (edit). There is **no** sortOrder field in the UI (always sent as the loaded/default value).
- Client clamps numeric inputs with `toInt = Math.max(0, Math.trunc(Number(v)||0))` — so via the UI, price/stock can never be sent negative or fractional, and all four sizes are always present. Negative/decimal/empty-sizes rejections must be exercised at the **API level** (REST client) to bypass the clamp.
- Submit order in `ProductForm.submit`: **save product first** (`createProduct`/`updateProduct`), **then** upload the image if a file was chosen → partial success is possible. On success it navigates to `/admin/productos`. On error it shows the message in a red uppercase `err` banner.
- New products get `imageUrl='/assets/logo-r.png'` server-side. Edit loads the product via `adminApi.products().find(id)` — there is **no** single-GET endpoint.

**Coverage checklist:**
- [ ] List renders seed products with image, line·color, money, per-size stock, activo/inactivo, Editar, Borrar
- [ ] Create valid product → 201 + appears in list; money shown es-AR
- [ ] Create with each required string field empty (slug/line/color/dotColor) → 400
- [ ] Price: negative clamped client-side / rejected server-side; decimal clamped/rejected; 0 accepted (boundary)
- [ ] Stock: negative clamped/rejected; 0 accepted (boundary)
- [ ] Create with no sizes → 400 (sizes min 1); tag null/empty allowed
- [ ] Create duplicate slug → 500 (CD-6, should be 409/400)
- [ ] Edit persists changes; edit prunes a size absent from payload (CD-10); edit unknown id → 500 / empty form in UI
- [ ] Delete → native confirm + removal; cancel keeps product; delete a product **with orders** nulls `OrderItem.productId` and preserves history
- [ ] Image upload valid jpg/png; >6MB rejected; non-image rejected (fileFilter); missing file → 400; Cloudinary down → 500; partial success (product saved, image fails)
- [ ] Toggle Activo off → hidden from public list but slug still 200 (CD-1 cross-ref)
- [ ] XSS in line/color rendered inert in admin; a11y labels; unauthorized & bad-token on every endpoint → 401
- [ ] Concurrent edits last-write-wins drop sizes (CD-10)

---

## List view

### TC-PROD-001: Products list renders all seed products with full row data
- **Priority:** P1
- **Type:** Functional
- **Preconditions:** Logged into admin; DB freshly seeded.
- **Steps → Expected:**
  1. Navigate to `/admin/productos` (sidebar **Productos**) → **Expected:** Heading `Productos` and a `+ Nuevo` link to `/admin/productos/nuevo` are shown.
  2. Inspect the rows → **Expected:** Exactly 4 rows in `sortOrder` ascending order: `Champion Mentality · Azul Marino`, `Champion Mentality · Negro`, `Champion Mentality · Verde Militar`, `Stop at Nothing · Blanco`.
  3. Inspect one row → **Expected:** Thumbnail `<img>` (seed `imageUrl`), bold `LINE · COLOR`, secondary line `$30.000 · S:25  M:25  L:25  XL:25 · activo`, an `Editar` link → `/admin/productos/<id>`, and a `Borrar` button.
- **Notes:** Data from `GET /api/admin/products` → `AdminProductDTO[]`, sorted server-side by `sortOrder asc`.

### TC-PROD-002: Price renders in es-AR currency format in the list
- **Priority:** P2
- **Type:** UI
- **Preconditions:** Seed data.
- **Steps → Expected:**
  1. View any seed product row → **Expected:** Price shows `$30.000` (dot thousands separator, no centavos), per `money()` = `'$' + Math.round(n).toLocaleString('es-AR')`.
- **Notes:** Cross-check after creating a product priced `1500` → `$1.500`; `1000000` → `$1.000.000`.

### TC-PROD-003: Empty product list renders no rows without crashing
- **Priority:** P3
- **Type:** UI
- **Preconditions:** DB with the products table emptied (delete all 4), logged in.
- **Steps → Expected:**
  1. Open `/admin/productos` → **Expected:** Heading and `+ Nuevo` still render; the rows container is empty; no error/console exception (`data ?? []` guard).

---

## Create product

### TC-PROD-004: Create a valid product → 201 and appears in list
- **Priority:** P0
- **Type:** Functional
- **Preconditions:** Logged in.
- **Steps → Expected:**
  1. Click `+ Nuevo` → **Expected:** Form at `/admin/productos/nuevo`, heading `Nuevo producto`, color picker defaulting to `#101013`, all four stock inputs present.
  2. Fill `Slug=pressure-hoodie-negro`, `Línea=Pressure`, `Color=Negro`, `Tag=Nuevo`, `Precio=52000`, stocks `S=10 M=10 L=4 XL=0`, leave Activo checked, click `Guardar` → **Expected:** `POST /api/admin/products` returns `201` with the `AdminProductDTO`; browser navigates to `/admin/productos`.
  3. Inspect the list → **Expected:** New row `Pressure · Negro` shows `$52.000 · S:10  M:10  L:4  XL:0 · activo`, `imageUrl` defaults to `/assets/logo-r.png`.
- **Notes:** No image was chosen, so no upload call is made.

### TC-PROD-005: Create with empty Slug → 400 Producto inválido
- **Priority:** P1
- **Type:** Negative
- **Preconditions:** Logged in, on the create form.
- **Steps → Expected:**
  1. Leave `Slug` blank, fill `Línea`/`Color`, click `Guardar` → **Expected:** `400 {error:'Producto inválido', details:...}`; no navigation; red uppercase `Producto inválido` banner appears above the form. Product NOT created.
- **Notes:** `slug` is `trim().min(1)`. Whitespace-only slug must also fail (trim then min1).

### TC-PROD-006: Create with empty Línea → 400
- **Priority:** P1
- **Type:** Negative
- **Preconditions:** Logged in, create form.
- **Steps → Expected:**
  1. Fill `Slug` and `Color`, leave `Línea` blank, `Guardar` → **Expected:** `400 Producto inválido`; banner shown; not created.

### TC-PROD-007: Create with empty Color → 400
- **Priority:** P1
- **Type:** Negative
- **Preconditions:** Logged in, create form.
- **Steps → Expected:**
  1. Fill `Slug` and `Línea`, leave `Color` blank, `Guardar` → **Expected:** `400 Producto inválido`; banner shown; not created.

### TC-PROD-008: Create with empty dotColor → 400 (API-level)
- **Priority:** P2
- **Type:** Negative
- **Preconditions:** Valid admin token. The UI color picker cannot be emptied, so use a REST client.
- **Steps → Expected:**
  1. `POST /api/admin/products` with body containing all valid fields but `dotColor:""` → **Expected:** `400 {error:'Producto inválido'}`; `details.fieldErrors.dotColor` present (`trim().min(1)`).
- **Notes:** Documents server enforcement of the field the picker always populates client-side.

### TC-PROD-009: Negative price is clamped to 0 by the client
- **Priority:** P2
- **Type:** Boundary
- **Preconditions:** Logged in, create form.
- **Steps → Expected:**
  1. Type `-500` into `Precio (ARS)` → **Expected:** `toInt` clamps to `0`; the field value becomes `0` (rendered as empty placeholder when `0` via `form.price || ''`).
  2. `Guardar` with otherwise valid data → **Expected:** Product created with `price=0` (`201`).
- **Notes:** Confirms client never transmits a negative price; the rejection path is TC-PROD-010.

### TC-PROD-010: Negative price rejected server-side → 400 (API-level)
- **Priority:** P1
- **Type:** Negative
- **Preconditions:** Valid admin token, REST client.
- **Steps → Expected:**
  1. `POST /api/admin/products` with `price:-1` (all else valid) → **Expected:** `400 {error:'Producto inválido'}`; `details` cites `price` (`int().min(0)`). Not created.
- **Notes:** Guards against a tampered client bypassing the `toInt` clamp.

### TC-PROD-011: Decimal price is truncated client-side / rejected server-side
- **Priority:** P2
- **Type:** Boundary
- **Preconditions:** Logged in (step 1) + REST client (step 2).
- **Steps → Expected:**
  1. UI: type `30000.99` in `Precio` → **Expected:** `Math.trunc` → `30000` sent; product created with `price=30000`.
  2. API: `POST` with `price:30000.5` → **Expected:** `400 Producto inválido` (`int()` rejects non-integers). Not created.

### TC-PROD-012: Negative / decimal stock is clamped client / rejected server
- **Priority:** P2
- **Type:** Boundary
- **Preconditions:** Logged in (step 1) + REST client (step 2).
- **Steps → Expected:**
  1. UI: type `-3` then `5.7` into `stock-M` → **Expected:** clamps to `0` then `5` respectively (`Math.max(0,Math.trunc())`).
  2. API: `POST` with a size `{size:'M', stock:-1}` → **Expected:** `400 Producto inválido` (`stock` `int().min(0)`). With `stock:2.5` → also `400`.

### TC-PROD-013: Price 0 and stock 0 are accepted (boundary)
- **Priority:** P2
- **Type:** Boundary
- **Preconditions:** Logged in.
- **Steps → Expected:**
  1. Create a product with `Precio=0` and all four stocks `0` → **Expected:** `201`; list row shows `$0 · S:0  M:0  L:0  XL:0 · activo`. (`min(0)` is inclusive.)
- **Notes:** `price=0` renders as `$0`. A zero-stock product is created but will be unbuyable on the storefront.

### TC-PROD-014: Create with no sizes → 400 sizes min 1 (API-level)
- **Priority:** P1
- **Type:** Negative
- **Preconditions:** Valid admin token, REST client (the UI always sends all four sizes).
- **Steps → Expected:**
  1. `POST /api/admin/products` with `sizes:[]` (all else valid) → **Expected:** `400 {error:'Producto inválido'}`; `details` cites `sizes` (`array(...).min(1)`). Not created.

### TC-PROD-015: Create with duplicate slug → 500 (CD-6)
- **Priority:** P1
- **Type:** Negative
- **Preconditions:** Logged in; a product with slug `champion-mentality-negro` already exists (seed).
- **Steps → Expected:**
  1. Create a new product reusing `Slug=champion-mentality-negro`, other fields valid, `Guardar` → **Expected (current/defect):** Slug is **not** pre-checked, so the DB `@unique` violation surfaces as `500` — `{error:'Error interno del servidor'}` in prod (real Prisma message in dev). The UI shows that message in the red banner.
  2. **Expected (desired):** A friendly `409`/`400` like "slug ya existe", NOT a 500.
- **Notes:** **CD-6** — file as a bug. Verify no half-written product is left behind.

### TC-PROD-016: Tag null and empty-string both accepted
- **Priority:** P2
- **Type:** Functional
- **Preconditions:** Logged in / REST client.
- **Steps → Expected:**
  1. UI: leave `Tag (opcional)` blank, save → **Expected:** `tag` sent as `null` (the field maps `'' → null`); `201`; row renders with no tag.
  2. API: `POST` with `tag:"Nuevo"` → **Expected:** `201`, `tag:"Nuevo"`. With `tag` omitted entirely → **Expected:** `201` (nullable+optional), stored `null`.

---

## Edit product

### TC-PROD-017: Edit a product and persist changes
- **Priority:** P0
- **Type:** Functional
- **Preconditions:** Logged in; seed product `champion-mentality-negro`.
- **Steps → Expected:**
  1. From the list click `Editar` on `Champion Mentality · Negro` → **Expected:** Form at `/admin/productos/<id>`, heading `Editar producto`, fields prefilled from `adminApi.products().find(id)` (price `30000`, all stocks `25`, color picker `#101013`).
  2. Change `Precio=27000`, set `stock-S=5`, uncheck `Activo`, `Guardar` → **Expected:** `PUT /api/admin/products/<id>` returns the updated DTO; navigate to list; row now shows `$27.000 · S:5  M:25  L:25  XL:25 · inactivo`.
- **Notes:** `updateProduct` runs in a transaction: updates scalar fields, deletes variants not in payload, upserts the rest.

### TC-PROD-018: Editing prunes a size absent from the payload (CD-10)
- **Priority:** P1
- **Type:** Negative
- **Preconditions:** Valid admin token, REST client (the UI always submits all four sizes, so this requires a direct API call). Target a product with S/M/L/XL variants.
- **Steps → Expected:**
  1. `PUT /api/admin/products/<id>` with `sizes:[{size:'M',stock:99}]` only (all scalar fields valid) → **Expected:** Response DTO has **only** the `M` variant; `S`, `L`, `XL` were deleted (`tx.variant.deleteMany({size:{notIn:['M']}})`). `M.stock=99`.
  2. Re-fetch via `GET /api/admin/products` → **Expected:** product shows a single size `M:99`.
- **Notes:** **CD-10**. Destructive: any size omitted from a `PUT` is silently dropped. See TC-PROD-034 for the concurrent last-write-wins variant.

### TC-PROD-019: Edit a non-existent product id → 500 (API-level)
- **Priority:** P2
- **Type:** Negative
- **Preconditions:** Valid admin token, REST client.
- **Steps → Expected:**
  1. `PUT /api/admin/products/does-not-exist` with a valid body → **Expected:** `500` (`prisma.product.update where:{id}` / `findUniqueOrThrow` throw on missing id) → `{error:'Error interno del servidor'}` in prod.
- **Notes:** Ideally a `404`. Note it does NOT 400 (the body is valid).

### TC-PROD-020: Edit URL with unknown id loads an empty form (no single-GET)
- **Priority:** P3
- **Type:** UI
- **Preconditions:** Logged in.
- **Steps → Expected:**
  1. Manually open `/admin/productos/does-not-exist` → **Expected:** `adminApi.products().find(id)` finds nothing, the `.catch(()=>{})` swallows it, the form stays at its blank defaults (heading still `Editar producto`).
  2. Submitting that form → **Expected:** behaves like TC-PROD-019 (PUT to a bad id → 500).
- **Notes:** Edit relies on the full list fetch, not a `GET /:id` (which does not exist for admin).

---

## Delete product

### TC-PROD-021: Delete a product → confirm dialog then removal
- **Priority:** P1
- **Type:** Functional
- **Preconditions:** Logged in; a deletable product (e.g. one with no orders).
- **Steps → Expected:**
  1. Click `Borrar` on a row → **Expected:** Native `confirm('¿Borrar producto?')` dialog appears.
  2. Accept (OK) → **Expected:** `DELETE /api/admin/products/<id>` returns `{ok:true}`; the list query invalidates and the row disappears.
- **Notes:** `deleteImage` is called best-effort first (Cloudinary), then `prisma.product.delete`. Variants cascade-delete.

### TC-PROD-022: Cancel the delete dialog keeps the product
- **Priority:** P2
- **Type:** Functional
- **Preconditions:** Logged in.
- **Steps → Expected:**
  1. Click `Borrar`, then Cancel/dismiss the `¿Borrar producto?` dialog → **Expected:** No API call is made (`confirm() && del.mutate` short-circuits); the row remains.

### TC-PROD-023: Delete a product that has orders → allowed, history preserved
- **Priority:** P0
- **Type:** Integration
- **Preconditions:** Logged in; a product that appears in at least one existing order (create an order for it first, e.g. via storefront checkout or `createOrder`).
- **Steps → Expected:**
  1. Delete that product (confirm OK) → **Expected:** `DELETE` returns `{ok:true}`; product + its variants are removed.
  2. Open `/admin/pedidos` and find the prior order → **Expected:** The order and its line items still exist; the affected `OrderItem.productId` is now `NULL` (`onDelete: SetNull`) while `line/color/size/unitPrice/qty` snapshot fields remain intact for display.
  3. Check metrics/revenue is unaffected for that paid order → **Expected:** Historical totals unchanged.
- **Notes:** Confirms order history survives product deletion. Cross-ref Module 10 (null-product line rendering) and Module 12 (revenue uses item snapshots).

---

## Image upload (Cloudinary)

### TC-PROD-024: Upload a valid JPG/PNG → imageUrl updated
- **Priority:** P1
- **Type:** Functional
- **Preconditions:** Logged in; valid Cloudinary env vars set; an existing product.
- **Steps → Expected:**
  1. Edit a product, choose a real `.png` (or `.jpg`) under 6MB in the file input, `Guardar` → **Expected:** Product saves first (PUT), then `POST /api/admin/products/<id>/image` (multipart field `image`) returns the DTO with the new Cloudinary `imageUrl` (secure_url) and a non-null `imagePublicId`.
  2. Return to list → **Expected:** The row thumbnail now shows the uploaded image.
- **Notes:** If a previous `imagePublicId` existed it is deleted best-effort before the new one is set.

### TC-PROD-025: Upload an image larger than 6MB → rejected
- **Priority:** P2
- **Type:** Boundary
- **Preconditions:** Logged in; an image file > 6MB.
- **Steps → Expected:**
  1. Choose a >6MB image and `Guardar` → **Expected:** Multer's `fileSize` limit (6 MB) trips; the upload request fails; the web client surfaces `No se pudo subir la imagen` (it throws on `!res.ok`). The product's scalar edits from the preceding PUT are already saved (partial success — see TC-PROD-029).
- **Notes:** Boundary: a file at exactly 6 MB should pass; just over should fail. Multer's limit error reaches the route as an error → 500-class response with no `req.file`.

### TC-PROD-026: Upload a non-image file (txt renamed .png) → 400 fileFilter
- **Priority:** P1
- **Type:** Negative
- **Preconditions:** Logged in; a `.txt` file (optionally renamed `.png`) whose MIME type is not `image/*`.
- **Steps → Expected:**
  1. Choose the non-image file, `Guardar` → **Expected:** `fileFilter` (`mimetype.startsWith('image/')`) rejects it → `req.file` is undefined → `400 {error:'Imagen inválida o ausente (solo se aceptan imágenes)'}`. Web shows `No se pudo subir la imagen`.
- **Notes:** Matches the shipped test `rejects a non-image file upload`. Renaming the extension does not bypass the MIME check.

### TC-PROD-027: Image endpoint called with no file → 400
- **Priority:** P2
- **Type:** Negative
- **Preconditions:** Valid admin token, REST client.
- **Steps → Expected:**
  1. `POST /api/admin/products/<id>/image` with no multipart `image` field → **Expected:** `400 {error:'Imagen inválida o ausente (solo se aceptan imágenes)'}`.

### TC-PROD-028: Cloudinary unavailable / bad credentials → 500
- **Priority:** P2
- **Type:** Negative
- **Preconditions:** Logged in; `CLOUDINARY_*` env vars empty or invalid; a valid image file.
- **Steps → Expected:**
  1. Upload a valid image → **Expected:** `uploadImage` rejects (real Cloudinary call returns 401) → route `next(e)` → `500 {error:'Error interno del servidor'}` in prod. Web shows `No se pudo subir la imagen`.
- **Notes:** Empty Cloudinary env is the default dev state — flag if product images appear untestable. `deleteImage` swallows its own errors (best-effort), so a delete failure never 500s.

### TC-PROD-029: Partial success — product saved but image upload fails
- **Priority:** P1
- **Type:** Integration
- **Preconditions:** Logged in; conditions that make the image upload fail (oversize, non-image, or Cloudinary down) while the product save succeeds.
- **Steps → Expected:**
  1. On the create form, fill valid product fields AND attach a failing image, `Guardar` → **Expected:** `createProduct` succeeds (product persisted with default `imageUrl='/assets/logo-r.png'`); the subsequent `uploadImage` throws; `submit` catches it, sets the red banner, and does **not** navigate.
  2. Go to `/admin/productos` → **Expected:** The product **exists** (was saved) but shows the default logo image, NOT the chosen file.
- **Notes:** Documents the save-then-upload ordering hazard: a user seeing the error may not realize the product was already created. Re-submitting the create form would duplicate the slug (→ CD-6 / TC-PROD-015).

---

## Activo toggle & public visibility

### TC-PROD-030: Toggle Activo off hides product from public list but slug still resolves (CD-1)
- **Priority:** P1
- **Type:** Integration
- **Preconditions:** Logged in; note a product's slug (e.g. `stop-at-nothing-blanco`).
- **Steps → Expected:**
  1. Edit that product, uncheck `Activo`, `Guardar` → **Expected:** List row now shows `inactivo`.
  2. `GET /api/products` (public list) → **Expected:** the inactive product is **absent** (`where:{active:true}`).
  3. `GET /api/products/stop-at-nothing-blanco` (public by-slug) → **Expected per code:** `getProductBySlug` also filters `active:true`, so this returns `404 {error:'Producto no encontrado'}`.
- **Notes:** Per README **CD-1** the by-slug route was suspected to ignore `active`; the current `catalog.ts` **does** filter `active:true`, so step 3 should 404. Re-verify against the running build and reconcile with CD-1: if the deployed code returns 200 for an inactive slug, file CD-1; if it 404s, CD-1 is fixed. Either way the inactive product must not appear in the public list.

---

## Security & authorization

### TC-PROD-031: Every admin products endpoint rejects a missing token → 401
- **Priority:** P0
- **Type:** Security
- **Preconditions:** No `Authorization` header.
- **Steps → Expected:**
  1. `GET /api/admin/products` with no token → **Expected:** `401 {error:'No autorizado'}`.
  2. `POST /api/admin/products` (valid body, no token) → **Expected:** `401`; product NOT created.
  3. `PUT /api/admin/products/<id>` (no token) → **Expected:** `401`.
  4. `DELETE /api/admin/products/<id>` (no token) → **Expected:** `401`; product NOT deleted.
  5. `POST /api/admin/products/<id>/image` (no token) → **Expected:** `401`.
- **Notes:** Auth runs before validation, so even an invalid body returns 401, not 400. Confirms no mutation leaks without auth.

### TC-PROD-032: Invalid / expired / tampered token → 401
- **Priority:** P1
- **Type:** Security
- **Preconditions:** A malformed JWT, an expired admin JWT, and one signed with the wrong secret.
- **Steps → Expected:**
  1. `GET /api/admin/products` with `Authorization: Bearer not-a-jwt` → **Expected:** `401 {error:'Sesión inválida o expirada'}`.
  2. Repeat with an expired token and with a wrong-secret token → **Expected:** `401` each.
  3. In the web app, with an expired token in store, trigger any products request → **Expected:** the `req()` helper logs out and redirects to `/admin/login` on the 401 (cross-ref CD-7: `ProtectedRoute` only checks token existence, so the UI renders until the first 401).
- **Notes:** Distinguishes `No autorizado` (no header) from `Sesión inválida o expirada` (bad token).

### TC-PROD-033: XSS payload in line/color is rendered inert in the admin list
- **Priority:** P1
- **Type:** Security
- **Preconditions:** Logged in.
- **Steps → Expected:**
  1. Create a product with `Línea=<img src=x onerror=alert(1)>` and `Color="><script>alert(2)</script>` (slug a valid unique string) → **Expected:** `201` (the schema does not block HTML; fields are stored verbatim).
  2. View `/admin/productos` → **Expected:** React escapes the text; the payload renders as literal characters inside `LINE · COLOR`; **no** alert fires, no script executes, no broken markup.
- **Notes:** Confirms admin rendering is safe by React's default escaping. Cross-ref Module 11 CD-8 (content fields) and Module 10 (these snapshot strings re-appear in order items / metrics labels — verify inert there too).

---

## Accessibility & concurrency

### TC-PROD-034: Form accessibility — labels, color picker, file input
- **Priority:** P2
- **Type:** Accessibility
- **Preconditions:** Logged in, on the create form.
- **Steps → Expected:**
  1. Inspect the four stock inputs → **Expected:** Each has `aria-label` `stock-S`/`stock-M`/`stock-L`/`stock-XL` and a visible size label (`S/M/L/XL`).
  2. Tab through the form → **Expected:** Reachable order Slug → Línea → Color → Tag → color picker → Precio → stock S→XL → Activo checkbox → file input → Guardar; focus ring visible (`focus:border-gold`).
  3. Inspect the text inputs (Slug/Línea/Color/Tag/Precio) → **Expected (gap to flag):** they rely on `placeholder` only, with no `<label>`/`aria-label` — note as an a11y improvement (screen readers announce placeholder, not a persistent name).
  4. Inspect the color picker and file input → **Expected:** color picker is operable (default `#101013`); file input has `accept="image/*"`.
- **Notes:** Stock inputs are the only consistently labelled fields; flag the placeholder-only text inputs.

### TC-PROD-035: Concurrent edits are last-write-wins and can drop sizes (CD-10)
- **Priority:** P1
- **Type:** Concurrency
- **Preconditions:** Logged in; two admin sessions (A and B) editing the same product (S/M/L/XL).
- **Steps → Expected:**
  1. A loads the edit form; B loads the same edit form (both see all four sizes).
  2. A saves after changing only `stock-S` (UI still submits all four sizes) → **Expected:** product retains all sizes with A's values.
  3. B saves a stale form that, via API, omits `XL` from `sizes` (e.g. a tampered/older client) → **Expected:** the `deleteMany size notIn` prunes `XL`; B's write overwrites A's; no conflict detection, no warning.
- **Notes:** **CD-10**. There is no optimistic-locking/version check. Even without the API tamper, two UI saves silently last-write-wins on stock values. File as a data-loss risk.
