# Module 11 — Admin drop timer + site content

> Scope: the admin **Drop** page (`/admin/drop`; `GET/PUT /api/admin/config/drop`) and **Contenido** page (`/admin/contenido`; `GET/PUT /api/admin/config/content`). Covers loading both singletons, the datetime-local↔ISO timezone round-trip, drop visibility/countdown effects on the landing, marquee/hero/contact editing, the `transferDiscountPct` boundary defect (CD-5), the bank-details transfer flow (CD-11), stored-XSS inertness on the public landing (CD-8), security, a11y and concurrency.

Read the [README](README.md) first for env, the canonical `DropConfig` and `SiteContent` seed values, the pricing formula (`computeTotals`, `transferPct = transferDiscountPct ?? 10`), and the candidate-defects appendix (CD-5, CD-8, CD-11).

**Reusable facts (do not repeat per case):**
- Both endpoints require `Authorization: Bearer <jwt>`. Missing header → `401 {error:'No autorizado'}`; bad token → `401 {error:'Sesión inválida o expirada'}`.
- **Drop** (`DropConfig.tsx`): inputs `Fecha objetivo` (`type=datetime-local`, `aria-label="Fecha objetivo"`), `Título` (`aria-label="Título"`), `Teaser` (textarea, `aria-label="Teaser"`), `Mostrar sección` (checkbox → `visible`), `Guardar`. Heading `Drop / countdown`. `toLocalInput` converts the stored UTC ISO to the local wall-clock the input expects; `onChange` converts back via `new Date(value).toISOString()`. Save → gold `Guardado ✓`; failure → red error banner. Server `dropSchema = {targetAt: string min1, visible: bool, title: string, teaser: string}` → `400 {error:'Drop inválido'}`.
- **Content** (`ContentConfig.tsx`): `Marquee` textarea (`aria-label="Marquee"`, one phrase per line; saved as `value.split('\n').filter(Boolean)`); `Hero kicker` (`aria-label="Hero kicker"`); `Hero línea 1` (`aria-label="Hero línea 1"`); `Hero línea 2`, `Hero subtítulo`, `Descuento transferencia (%)` (`type=number`, **no min/max attribute** → CD-5), `Alias bancario`, `CBU`, `WhatsApp`, `Instagram`, `Email`, `Ubicación` — these last seven are placeholder-only (no `aria-label`). `Guardar`; save → `Guardado ✓`. Heading `Contenido del sitio`.
- Server `contentSchema`: `marquee = array(string).min(1)`; `hero* = string`; `transferDiscountPct = int().min(0).max(90)`; `bank* = string`; `contact* = string` (**`contactEmail` is NOT email-validated** — plain string). Failure → `400 {error:'Contenido inválido'}`.
- Both singletons are read with `findFirst orderBy id asc` and updated in place; updates are full-document last-write-wins (no merge, no version check).
- Effects: drop `targetAt`/`visible` drive the landing countdown + whether the drop section shows. Content drives the landing marquee/hero/contact, and `transferDiscountPct` drives the checkout transfer discount math (`transferDiscount = round(subtotal*pct/100)`). `bankAlias`/`bankCbu` enable the transfer instructions block in the confirmation UI and the email bank block.

**Coverage checklist:**
- [ ] Load drop config; targetAt future → countdown updates; targetAt past → zero-state; toggle visible off/on; empty targetAt → 400; UI empty-date caveat; timezone round-trip; `Guardado ✓`; title/teaser empty allowed
- [ ] Load content; marquee multi-line → landing updates; empty marquee (all blank) → 400 min1; hero copy → landing updates
- [ ] transferDiscountPct default 10; set 0 (no discount, badge hidden); set 90 (max ok); set 95 via UI (CD-5, server 400); set −5 → 400; set decimal → 400
- [ ] bankAlias/bankCbu set → transfer flow + email bank block (CD-11); contactEmail invalid accepted (not validated) → flag
- [ ] stored-XSS in marquee/hero/contact rendered inert on landing (CD-8); unauthorized → 401; a11y labels; concurrent content edits last-write-wins

---

## Drop config

### TC-CFG-001: Load drop config into the form
- **Priority:** P1
- **Type:** Functional
- **Preconditions:** Logged in; seeded `DropConfig`.
- **Steps → Expected:**
  1. Open `/admin/drop` → **Expected:** `GET /api/admin/config/drop` returns the singleton; the form shows `Título=Algo se está forjando`, the teaser text, `Mostrar sección` checked (`visible=true`), and `Fecha objetivo` showing the seed target (`2026-08-15T20:00` rendered in the browser's local wall-clock via `toLocalInput`).
- **Notes:** Heading `Drop / countdown`. While loading or on error it shows `Cargando…` / `No se pudo cargar la configuración`.

### TC-CFG-002: Set a future targetAt → landing countdown updates
- **Priority:** P1
- **Type:** Integration
- **Preconditions:** Logged in; drop section `visible=true`.
- **Steps → Expected:**
  1. Set `Fecha objetivo` to a clearly future date/time (e.g. a year ahead), `Guardar` → **Expected:** `200`; gold `Guardado ✓`.
  2. Open the public landing → **Expected:** the countdown reflects the new target (days/hours counting down toward it).
- **Notes:** The stored value is ISO UTC; the landing computes remaining time from it.

### TC-CFG-003: Set a past targetAt → landing countdown shows zero-state
- **Priority:** P1
- **Type:** Integration
- **Preconditions:** Logged in; drop visible.
- **Steps → Expected:**
  1. Set `Fecha objetivo` to a past date/time, `Guardar` → **Expected:** `200`, `Guardado ✓`.
  2. Open the landing → **Expected:** the countdown shows its expired/zero state (no negative numbers). Cross-ref Module 2 for the exact zero-state rendering.

### TC-CFG-004: Toggle visible off → landing hides the drop section
- **Priority:** P1
- **Type:** Integration
- **Preconditions:** Logged in; drop currently visible.
- **Steps → Expected:**
  1. Uncheck `Mostrar sección`, `Guardar` → **Expected:** `200 visible:false`, `Guardado ✓`.
  2. Reload the landing → **Expected:** the drop/countdown section is **not** rendered.

### TC-CFG-005: Toggle visible on → landing shows the drop section
- **Priority:** P2
- **Type:** Integration
- **Preconditions:** Drop currently hidden (`visible=false`).
- **Steps → Expected:**
  1. Check `Mostrar sección`, `Guardar` → **Expected:** `200 visible:true`.
  2. Reload the landing → **Expected:** the drop section + countdown render again.

### TC-CFG-006: Empty targetAt → 400 Drop inválido (API-level)
- **Priority:** P1
- **Type:** Negative
- **Preconditions:** Valid admin token, REST client.
- **Steps → Expected:**
  1. `PUT /api/admin/config/drop` with `targetAt:""` (other fields valid) → **Expected:** `400 {error:'Drop inválido'}` (`targetAt` is `string().min(1)`).
- **Notes:** Server guards only non-empty string, not validity — see TC-CFG-007 for what a malformed but non-empty date does.

### TC-CFG-007: Clearing the date in the UI throws before reaching the server
- **Priority:** P2
- **Type:** Negative
- **Preconditions:** Logged in, on the drop form.
- **Steps → Expected:**
  1. Clear the `Fecha objetivo` datetime-local input → **Expected (defect to confirm):** `onChange` runs `new Date('').toISOString()`, which throws `RangeError: Invalid time value`; the change handler errors (the field cannot be emptied cleanly / a console error appears). The empty value never reaches the API.
  2. Likewise, the server would accept a non-empty but bogus `targetAt` (e.g. `"not-a-date"` passes `min(1)`) → `updateDrop` does `new Date('not-a-date')` → Invalid Date stored → `500` on toISOString. Verify via API.
- **Notes:** Flag both: the UI date-clear crash (P2) and the lack of real date-format validation server-side (`min(1)` only).

### TC-CFG-008: Timezone round-trip (datetime-local ↔ ISO) is correct
- **Priority:** P1
- **Type:** Functional
- **Preconditions:** Logged in; note your browser timezone (e.g. AR `-03:00`).
- **Steps → Expected:**
  1. Set `Fecha objetivo` to a specific local time (e.g. `2027-01-01 17:00`), `Guardar`, then reload `/admin/drop` → **Expected:** the field shows exactly `2027-01-01 17:00` again (no drift). Internally stored as the equivalent UTC ISO (`2027-01-01T20:00:00.000Z` for `-03:00`).
  2. Verify on the landing the countdown targets that same local instant → **Expected:** consistent.
- **Notes:** `toLocalInput` offsets by `getTimezoneOffset()` so the input shows local wall-clock; `onChange` converts back to UTC ISO. Test in at least one non-UTC timezone to catch off-by-offset bugs.

### TC-CFG-009: Successful save shows Guardado ✓
- **Priority:** P2
- **Type:** UI
- **Preconditions:** Logged in.
- **Steps → Expected:**
  1. Make any valid change and `Guardar` → **Expected:** gold `Guardado ✓` banner appears; any prior error banner is cleared.
- **Notes:** On failure, instead a red error banner shows the thrown message (e.g. `Drop inválido`).

### TC-CFG-010: Drop title and teaser may be empty
- **Priority:** P3
- **Type:** Boundary
- **Preconditions:** Logged in.
- **Steps → Expected:**
  1. Clear `Título` and `Teaser`, set a valid future date, `Guardar` → **Expected:** `200` (schema `title`/`teaser` are plain `string`, no min). Landing renders the section with empty title/teaser.
- **Notes:** Only `targetAt` has a `min(1)`; title/teaser emptiness is allowed by design.

---

## Content config — marquee & hero

### TC-CFG-011: Load content config into the form
- **Priority:** P1
- **Type:** Functional
- **Preconditions:** Logged in; seeded `SiteContent`.
- **Steps → Expected:**
  1. Open `/admin/contenido` → **Expected:** `GET /api/admin/config/content` returns the singleton; the marquee textarea shows the 6 seed phrases (one per line), hero fields, `Descuento transferencia (%)` = `10`, `bankAlias`/`bankCbu` blank, and the four contact fields populated with seed values.
- **Notes:** Heading `Contenido del sitio`.

### TC-CFG-012: Edit marquee (multi-line) → landing marquee updates
- **Priority:** P1
- **Type:** Integration
- **Preconditions:** Logged in.
- **Steps → Expected:**
  1. In the `Marquee` textarea, replace with three lines `Uno` / `Dos` / `Tres` (plus a trailing blank line), `Guardar` → **Expected:** `200`; `marquee` saved as `['Uno','Dos','Tres']` (blank line dropped by `.filter(Boolean)`).
  2. Reload the landing → **Expected:** the marquee cycles `Uno · Dos · Tres`.
- **Notes:** Blank lines are stripped on save; leading/trailing whitespace lines vanish.

### TC-CFG-013: Empty marquee (all blank lines) → 400 min1
- **Priority:** P1
- **Type:** Negative
- **Preconditions:** Logged in.
- **Steps → Expected:**
  1. Clear the marquee textarea entirely (or leave only blank lines), `Guardar` → **Expected:** the client sends `marquee:[]` (everything filtered out); server `array(string).min(1)` rejects → `400 {error:'Contenido inválido'}`; red error banner shows the message. Content NOT changed.
- **Notes:** At least one non-empty phrase is required.

### TC-CFG-014: Edit hero copy → landing hero updates
- **Priority:** P1
- **Type:** Integration
- **Preconditions:** Logged in.
- **Steps → Expected:**
  1. Change `Hero kicker`, `Hero línea 1`, `Hero línea 2`, `Hero subtítulo` to new strings, `Guardar` → **Expected:** `200`, `Guardado ✓`.
  2. Reload the landing → **Expected:** the hero section reflects the new kicker/title1/title2/subtitle.
- **Notes:** Hero fields are plain strings (no min) — empty hero values are accepted and render empty.

---

## Content config — transfer discount (CD-5 boundary)

### TC-CFG-015: Default transferDiscountPct=10 reflects in checkout
- **Priority:** P2
- **Type:** Functional
- **Preconditions:** Seed default `transferDiscountPct=10`.
- **Steps → Expected:**
  1. With the default, run a storefront transfer checkout for subtotal `30000` → **Expected:** transfer discount `$3.000`, transfer total `$27.000`; the transfer option badge shows `10% OFF`.
- **Notes:** Cross-ref Module 4/5. Also note CD-4: the Productos-section footer hardcodes "10% OFF" and can desync if pct changes.

### TC-CFG-016: Set transferDiscountPct=0 → no discount, badge hidden
- **Priority:** P1
- **Type:** Boundary
- **Preconditions:** Logged in.
- **Steps → Expected:**
  1. Set `Descuento transferencia (%)` to `0`, `Guardar` → **Expected:** `200` (min 0 inclusive).
  2. Run a transfer checkout → **Expected:** transfer discount `$0`; transfer total equals subtotal; the `% OFF` badge is **hidden** (badge only shows when `transferDiscount > 0`).
- **Notes:** Lower boundary.

### TC-CFG-017: Set transferDiscountPct=90 (max) → accepted
- **Priority:** P1
- **Type:** Boundary
- **Preconditions:** Logged in.
- **Steps → Expected:**
  1. Set the field to `90`, `Guardar` → **Expected:** `200` (max 90 inclusive). Transfer checkout for `30000` → discount `$27.000`, total `$3.000`.
- **Notes:** Upper boundary inclusive.

### TC-CFG-018: Set transferDiscountPct=95 via UI → server 400 (CD-5)
- **Priority:** P1
- **Type:** Negative
- **Preconditions:** Logged in. The web input has **no** `min`/`max` attribute, so the UI lets you type 95.
- **Steps → Expected:**
  1. Type `95` into `Descuento transferencia (%)`, `Guardar` → **Expected:** the value is sent unclamped; server `max(90)` rejects → `400 {error:'Contenido inválido'}`; red error banner shows `Contenido inválido`; value NOT applied.
- **Notes:** **CD-5** — the client should constrain `0–90`; today only the server blocks it. File as a UX/validation gap. Verify no partial write occurred.

### TC-CFG-019: Set transferDiscountPct=−5 → 400
- **Priority:** P1
- **Type:** Negative
- **Preconditions:** Logged in.
- **Steps → Expected:**
  1. Type `-5`, `Guardar` → **Expected:** `400 {error:'Contenido inválido'}` (`min(0)`); not applied.

### TC-CFG-020: Non-integer transferDiscountPct → 400
- **Priority:** P2
- **Type:** Negative
- **Preconditions:** Logged in.
- **Steps → Expected:**
  1. Type `10.5`, `Guardar` → **Expected:** `400 Contenido inválido` (`int()` rejects).
  2. Type a non-numeric string (e.g. `abc`) → **Expected:** `Number('abc')=NaN` → serialized as `null` → fails `int()` → `400`.
- **Notes:** Confirms the number coercion path rejects fractional and NaN inputs.

---

## Content config — bank & contact

### TC-CFG-021: Set bankAlias/bankCbu → transfer flow + email bank block appear (CD-11)
- **Priority:** P1
- **Type:** Integration
- **Preconditions:** Logged in; default seed has both bank fields empty (so transfer orders currently show no bank data — CD-11).
- **Steps → Expected:**
  1. Set `Alias bancario` and `CBU` to valid values, `Guardar` → **Expected:** `200`; `GET /api/content` now returns them.
  2. Run a storefront transfer checkout to confirmation → **Expected:** the confirmation block now renders the `Alias`/`CBU` (it was hidden when `bankAlias` was empty).
  3. Trigger the transfer email → **Expected:** the email's bank-details block is populated. Cross-ref Module 5/7.
- **Notes:** **CD-11**: with the empty default a transfer order succeeds but shows no way to pay. Setting these fields is the fix-path to verify.

### TC-CFG-022: Invalid contactEmail is accepted (not validated) → flag
- **Priority:** P2
- **Type:** Negative
- **Preconditions:** Logged in.
- **Steps → Expected:**
  1. Set `Email` (contact) to `not-an-email`, `Guardar` → **Expected:** `200` (the schema types `contactEmail` as plain `string`, **not** `.email()`); the value persists.
  2. Open the landing contacto section → **Expected:** it renders `mailto:not-an-email` — a broken mailto link.
- **Notes:** Flag as a validation gap (the customer `email` field IS `.email()`-validated, but admin `contactEmail` is not). Inconsistent. P2.

---

## Security, XSS, a11y & concurrency

### TC-CFG-023: Stored-XSS in marquee/hero/contact is rendered inert on the landing (CD-8)
- **Priority:** P1
- **Type:** Security
- **Preconditions:** Logged in.
- **Steps → Expected:**
  1. Set marquee line, `Hero línea 1`, and `Email` to payloads like `<img src=x onerror=alert(1)>`, `"><script>alert(2)</script>`, `<svg/onload=alert(3)>`, `Guardar` → **Expected:** `200` — the API stores them **verbatim** (no server sanitization).
  2. Open the public landing → **Expected:** React escapes all of them; they render as literal text in the marquee/hero/contacto; **no** alert fires, no script runs, no element injection (`Marquee`/`Hero`/`Contacto` use `{text}`, not `dangerouslySetInnerHTML`).
  3. Check the contacto `mailto:` href with a payload email → **Expected:** the payload is URL-encoded/escaped inside the `href`, not executable.
- **Notes:** **CD-8** — confirms the public landing is safe by React's default escaping even though storage is unsanitized. Also verify the same strings are inert in any email that includes them (emails are separately escaped). If any surface renders the payload as live HTML, file Critical.

### TC-CFG-024: Config endpoints reject unauthorized access → 401
- **Priority:** P0
- **Type:** Security
- **Preconditions:** No / bad token.
- **Steps → Expected:**
  1. `GET /api/admin/config/drop` and `GET /api/admin/config/content` with no token → **Expected:** `401 {error:'No autorizado'}` each.
  2. `PUT /api/admin/config/drop` and `PUT /api/admin/config/content` with valid bodies but no token → **Expected:** `401`; nothing changed.
  3. Repeat the PUTs with `Authorization: Bearer garbage` → **Expected:** `401 {error:'Sesión inválida o expirada'}`.
- **Notes:** The public `GET /api/drop` and `GET /api/content` are separate unauthenticated read endpoints — those are NOT under `/api/admin` and should stay public (cross-ref Module 1).

### TC-CFG-025: Content/drop form accessibility — labels
- **Priority:** P2
- **Type:** Accessibility
- **Preconditions:** Logged in.
- **Steps → Expected:**
  1. Inspect the drop form → **Expected:** `Fecha objetivo`, `Título`, `Teaser` have `aria-label`s; the visible-section checkbox has an adjacent text label.
  2. Inspect the content form → **Expected:** `Marquee`, `Hero kicker`, `Hero línea 1` have `aria-label`s, BUT `Hero línea 2`, `Hero subtítulo`, `Descuento transferencia (%)` (only a preceding loose `<label>` text, not associated), `Alias bancario`, `CBU`, `WhatsApp`, `Instagram`, `Email`, `Ubicación` rely on `placeholder` only → **Expected (gap to flag):** screen readers announce no persistent accessible name for those fields.
  3. Tab order → **Expected:** logical top-to-bottom; visible focus ring (`focus:border-gold`).
- **Notes:** File the placeholder-only fields as an a11y improvement; the loose `<label>` texts (e.g. "Descuento transferencia (%)") are not programmatically associated with their inputs (no `htmlFor`/wrapping).

### TC-CFG-026: Concurrent content edits are last-write-wins
- **Priority:** P2
- **Type:** Concurrency
- **Preconditions:** Logged in; two admin sessions A and B on `/admin/contenido`.
- **Steps → Expected:**
  1. A and B both load content. A changes the marquee and saves; B (stale) changes the hero and saves a few seconds later → **Expected:** B's full-document PUT overwrites everything including A's marquee change — A's edit is lost, no conflict warning (the update writes all fields from B's stale snapshot).
- **Notes:** No merge or optimistic-locking. Same applies to drop config. Note as a multi-admin data-loss risk (P2).
