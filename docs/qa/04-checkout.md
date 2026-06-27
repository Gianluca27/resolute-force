# Module 4 — Checkout flow & validation

> The 3-step checkout modal (`apps/web/src/components/CheckoutModal.tsx`) and the quote endpoint that backs step 0→1 (`POST /api/checkout/quote` → `apps/api/src/routes/checkout.ts` + `services/quote.ts`, schema `customerSchema`/`checkoutQuoteSchema` in `packages/shared`). Steps: **0 "Tus datos"** (customer form) → **1 "Forma de pago"** (method + summary) → **2 "Listo"** (confirmation). This module covers opening/closing, step-0 client validation, the quote round-trip (client → server recompute), every quote error, step navigation, and the summary. The actual **payment** on step 1 (card/wallet/transfer) is Module 5; here we only verify navigation into step 1 and the summary. See [README](README.md) for setup, seed data, money formatting, and the pricing formulas; not repeated here.

**Coverage checklist:**
- Open checkout from the cart; cannot open with an empty cart; close via X / backdrop; state retention vs. loss on close+reopen.
- Step 0: all-valid → quote → step 1; each required field empty individually; whitespace-only (trim); the single generic error string.
- Email: invalid formats rejected, valid variants accepted (Zod `z.string().trim().email()`).
- Phone optional; phone accepts free text; very long inputs; XSS in name rendered safe; trimming before send.
- Quote integration: payload is only `{productId,size,qty}`; tampered client price ignored (server recomputes); totals match the server formula.
- Quote errors: 409 out-of-stock, 409 inactive/deleted product, 409 bad size; 400 empty items; 400 bad qty/size (forced); network failure.
- Progress bar widths, step titles, in-modal back, summary totals per method, transfer discount line, dynamic transfer badge vs hardcoded "10% OFF" (CD-4).
- Security: server re-validates `customerSchema` on every order/payment endpoint. Concurrency: stock drops between add and quote.
- Accessibility (labels/focus/error) and responsive (mobile modal).

> **Test data & tooling.** Canonical product = "Champion Mentality / Azul Marino" (slug `champion-mentality-azul-marino`), price 30000, variants S/M/L/XL stock 25 each. The client sends the product **cuid**, not the slug. To get it for direct API calls: `GET http://localhost:4000/api/products/champion-mentality-azul-marino` → copy `.id` (call it `<NAVY_ID>`). A valid customer for the happy path: Nombre `Juan Pérez`, Email `juan@test.com`, Teléfono `11 1234-5678`, Dirección `Calle Falsa 123`, Ciudad `Rosario, Santa Fe`. The step-0 error and any quote error render in a `text-red … uppercase` block — the DOM text keeps its original casing but CSS displays it uppercase.

---

## A. Opening & closing the checkout modal

### TC-CHK-001: Open checkout from the cart
- **Priority:** P0
- **Type:** Functional
- **Preconditions:** Cart has ≥1 item; cart drawer open.
- **Steps → Expected:**
  1. In the cart drawer footer, click "Finalizar compra" → **Expected:** `startCheckout()` returns true; the drawer closes (`open:false`) and the checkout modal opens (`checkoutOpen:true`) on **step 0**, title `Tus datos`, progress bar at 33%.
  2. Confirm the step-0 form is shown → **Expected:** five inputs with placeholders `Tu nombre`, `tu@email.com`, `11 1234-5678`, `Calle y número`, `Ciudad, Provincia`, plus the `Continuar al pago` button.

### TC-CHK-002: Checkout cannot open with an empty cart
- **Priority:** P1
- **Type:** Negative
- **Preconditions:** Cart empty.
- **Steps → Expected:**
  1. Trigger `startCheckout()` with no items (e.g. there is no "Finalizar compra" button on the empty drawer; if reached programmatically) → **Expected:** returns `false`, `checkoutOpen` stays false, the modal never renders (`{checkoutOpen && <CheckoutModal/>}`).
- **Notes:** The empty drawer shows "Ver productos" instead of "Finalizar compra", so the UI cannot reach this state normally — this guards the programmatic path.

### TC-CHK-003: Close the modal with the X button
- **Priority:** P2
- **Type:** Functional
- **Preconditions:** Checkout modal open on step 0 (or any step) with the form partially filled.
- **Steps → Expected:**
  1. Click the X button (aria-label `Cerrar`) → **Expected:** `close()` runs: `checkoutOpen:false`; the modal disappears.
  2. Inspect the cart → **Expected:** cart items are **unchanged** (still persisted in `rf-cart`); the cart is cleared only after a *successful* order, never on close.

### TC-CHK-004: Close the modal by clicking the backdrop
- **Priority:** P2
- **Type:** Functional
- **Preconditions:** Checkout modal open.
- **Steps → Expected:**
  1. Click the dark blurred backdrop outside the modal card → **Expected:** modal closes (same `close()` handler as the X). Clicking *inside* the card does **not** close it (`stopPropagation`).
  2. Confirm cart preserved → **Expected:** items intact.

### TC-CHK-005: Close mid-flow then reopen — typed form data is lost (divergence)
- **Priority:** P2
- **Type:** Functional
- **Preconditions:** Cart has ≥1 item.
- **Steps → Expected:**
  1. Open checkout, fill all step-0 fields (and optionally advance to step 1), then close the modal (X or backdrop) → **Expected:** modal closes.
  2. Reopen checkout via "Finalizar compra" → **Expected (shipped):** the modal reopens on **step 0 with the customer fields EMPTY**; method resets to `transfer`; any prior quote is gone. The **cart items survive** (persisted store), but the typed customer/contact data does **not**.
- **Notes:** **Divergence to flag.** The plan expected typed data to be retained on reopen. Shipped code renders `{checkoutOpen && <CheckoutModal/>}` in `Landing.tsx`, so closing **unmounts** the component and destroys its local React state (`form`, `method`, `q`, `step`); the `setStep(0)` inside `close()` is effectively dead code. Reopen = a fresh, empty modal. File as a candidate defect (data-loss / UX) if "retain on reopen" is the intended behavior. Contrast with TC-CHK-030 (in-modal "Volver" *does* retain data because the modal stays mounted).

---

## B. Step 0 — required-field validation

### TC-CHK-006: All-valid data → quote succeeds → step 1
- **Priority:** P0
- **Type:** Functional
- **Preconditions:** Cart has Azul Marino (M) qty 2; seed stock 25.
- **Steps → Expected:**
  1. Fill the valid customer (Juan Pérez / juan@test.com / 11 1234-5678 / Calle Falsa 123 / Rosario, Santa Fe) and click "Continuar al pago" → **Expected:** `customerSchema` passes; `api.quote` is called; modal advances to **step 1**, title `Forma de pago`, progress 66%.
  2. Read the summary (default method = Transferencia) → **Expected:** `Subtotal $60.000`, `Descuento transferencia − $6.000` (gold), `Envío Gratis` (gold), `Total $54.000`. The transfer option shows a `10% OFF` badge.
  3. Switch method to Tarjeta → **Expected:** discount row disappears; `Total $60.000` (= `totalCard`).
- **Notes:** Server-verified quote for `[{<NAVY_ID>,"M",2}]`: `subtotal 60000, transferDiscount 6000, totalTransfer 54000, totalCard 60000, lines[0].unitPrice 30000`.

### TC-CHK-007: Empty "Nombre y apellido" blocks progression
- **Priority:** P1
- **Type:** Negative
- **Preconditions:** Cart has ≥1 item; checkout step 0.
- **Steps → Expected:**
  1. Fill email/dir/ciudad validly but leave Nombre empty; click "Continuar al pago" → **Expected:** stays on step 0; inline red error `Completá tus datos para continuar`; **no** `/api/checkout/quote` request is sent (validation is client-side first).

### TC-CHK-008: Empty "Email" blocks progression
- **Priority:** P1
- **Type:** Negative
- **Preconditions:** Checkout step 0; all other fields valid.
- **Steps → Expected:**
  1. Leave Email empty; click "Continuar al pago" → **Expected:** stays step 0; error `Completá tus datos para continuar`; no quote request.

### TC-CHK-009: Empty "Dirección de envío" blocks progression
- **Priority:** P1
- **Type:** Negative
- **Preconditions:** Checkout step 0; all other fields valid.
- **Steps → Expected:**
  1. Leave Dirección empty; click "Continuar al pago" → **Expected:** stays step 0; generic error; no quote request.

### TC-CHK-010: Empty "Ciudad / Provincia" blocks progression
- **Priority:** P1
- **Type:** Negative
- **Preconditions:** Checkout step 0; all other fields valid.
- **Steps → Expected:**
  1. Leave Ciudad empty; click "Continuar al pago" → **Expected:** stays step 0; generic error; no quote request.

### TC-CHK-011: Whitespace-only name/dir/ciudad are rejected (trim)
- **Priority:** P1
- **Type:** Boundary
- **Preconditions:** Checkout step 0; valid email.
- **Steps → Expected:**
  1. Set Nombre = `"   "` (only spaces), with valid dir/ciudad; click "Continuar al pago" → **Expected:** rejected; stays step 0; generic error. `z.string().trim().min(1)` trims to empty.
  2. Repeat with Dirección = spaces only → **Expected:** rejected.
  3. Repeat with Ciudad = spaces only (e.g. tabs/spaces) → **Expected:** rejected.

### TC-CHK-012: All fields empty
- **Priority:** P2
- **Type:** Negative
- **Preconditions:** Fresh checkout step 0, nothing typed.
- **Steps → Expected:**
  1. Click "Continuar al pago" immediately → **Expected:** stays step 0; error `Completá tus datos para continuar`; no quote request.
- **Notes:** The error is a single generic message for *any* validation failure — it never names the offending field (minor UX observation; record but low priority).

---

## C. Email validation

### TC-CHK-013: Invalid email formats are rejected
- **Priority:** P1
- **Type:** Negative
- **Preconditions:** Checkout step 0; all non-email fields valid.
- **Steps → Expected:**
  1. For each value below, type it into Email and click "Continuar al pago" → **Expected each:** rejected, stays step 0, generic error, no quote request:
     - `plainaddress` (no @)
     - `no-at.com` (no @)
     - `@no-local.com` (missing local part)
     - `no-domain@` (missing domain)
     - `tu@email` (no TLD)
     - `a@b` (no dot/TLD)
     - `a@b.c` (single-char TLD — Zod requires ≥2)
     - `user name@x.com` (internal space)
     - `a@b .com` (space in domain)
     - `ñoño@correo.com` (non-ASCII local part — Zod's default email regex is ASCII-only)
- **Notes:** Behavior verified against the installed `zod@3.25.76` `z.string().trim().email()` regex.

### TC-CHK-014: Valid email variants are accepted
- **Priority:** P1
- **Type:** Functional
- **Preconditions:** Checkout step 0; all other fields valid; cart in stock.
- **Steps → Expected:**
  1. For each value below, set Email and click "Continuar al pago" → **Expected each:** passes validation, quote is requested, advances to step 1:
     - `juan@test.com`
     - `  juan@test.com  ` (leading/trailing spaces — trimmed first, then valid)
     - `a@b.co` (2-char TLD)
     - `name+tag@gmail.com` (plus addressing)
     - `foo.bar@sub.dominio.com.ar` (dotted local + multi-label domain)
     - `UPPER@CASE.COM` (uppercase accepted)
- **Notes:** Between attempts, return to step 0 (or reset) so each email is tested from a clean state.

---

## D. Phone, long inputs, XSS, trimming

### TC-CHK-015: Phone is optional (empty is accepted)
- **Priority:** P2
- **Type:** Functional
- **Preconditions:** Checkout step 0; nombre/email/dir/ciudad valid; cart in stock.
- **Steps → Expected:**
  1. Leave Teléfono empty; click "Continuar al pago" → **Expected:** passes (`tel` is `.optional()`); advances to step 1.

### TC-CHK-016: Phone accepts arbitrary text (no format check)
- **Priority:** P3
- **Type:** Negative
- **Preconditions:** Checkout step 0; other fields valid.
- **Steps → Expected:**
  1. Set Teléfono = `abc-no-es-un-telefono!!!`; click "Continuar al pago" → **Expected:** accepted and quote proceeds — there is **no phone format validation** (only `.trim().optional()`). Record as a minor validation gap.

### TC-CHK-017: Very long inputs are accepted
- **Priority:** P3
- **Type:** Boundary
- **Preconditions:** Checkout step 0; valid email.
- **Steps → Expected:**
  1. Paste a 1000-character string into Nombre (and Dirección/Ciudad); valid email; click "Continuar al pago" → **Expected:** no client max-length, validation passes, quote proceeds. Note whether the layout handles the overflow gracefully (no broken modal). The string is sent to the server on order; verify the order endpoint stores/handles it without error (cross-ref Module 5/6).

### TC-CHK-018: XSS payload in the name is rendered safely
- **Priority:** P1
- **Type:** Security
- **Preconditions:** Cart in stock; able to complete a transfer order (Module 5).
- **Steps → Expected:**
  1. Set Nombre = `<script>alert('xss')</script>`; complete a transfer order to step 2 → **Expected:** the confirmation line `Gracias <name>.` shows the literal text `<script>alert('xss')</script>` as inert text; **no** alert fires, no DOM injection (React escapes by default).
  2. Also check the admin order view and emails for the same value (cross-ref Modules 7 & 10) → **Expected:** escaped there too.

### TC-CHK-019: Leading/trailing whitespace is trimmed before send
- **Priority:** P2
- **Type:** Functional
- **Preconditions:** Checkout step 0; DevTools Network tab open; cart in stock.
- **Steps → Expected:**
  1. Set Nombre = `  Juan  `, Dirección = `  Calle 1  `, with valid email/ciudad; click "Continuar al pago", then proceed to create an order → **Expected:** the customer values the server receives/stores are trimmed (`Juan`, `Calle 1`) per `customerSchema` `.trim()`. The quote request itself carries only line items (see TC-CHK-020); trimming is applied where the customer object is parsed (order/payment endpoints).

---

## E. Quote integration (client → server recompute)

### TC-CHK-020: Quote payload contains only `{productId,size,qty}`
- **Priority:** P1
- **Type:** Integration
- **Preconditions:** Cart has Azul Marino (M) qty 2; DevTools Network tab open.
- **Steps → Expected:**
  1. On step 0 with valid data, click "Continuar al pago" and inspect the `POST /api/checkout/quote` request body → **Expected:** body = `{"items":[{"productId":"<NAVY_ID>","size":"M","qty":2}]}` — it carries **no** `price`, `line`, `color`, `slug`, or `imageUrl`. The server recomputes everything.

### TC-CHK-021: Tampered client price is ignored — server recomputes
- **Priority:** P0
- **Type:** Security
- **Preconditions:** Cart has Azul Marino (M) qty 1; DevTools access.
- **Steps → Expected:**
  1. In `rf-cart`, change that item's `price` from `30000` to `1` and reload (do **not** reopen the landing if you want to skip `reconcile`; if `reconcile` runs it will reset the price to the real one — either way the tamper cannot persist to the server) → **Expected:** the cart may briefly show `$1`, but the quote payload sends only `productId/size/qty`.
  2. Click "Continuar al pago" → **Expected:** the step-1 summary shows the **real** server price (`Subtotal $30.000`, `Total $27.000` transfer), not `$1`. `lines[0].unitPrice = 30000` from `product.price`.
- **Notes:** Price/line/color are never trusted from the client; this is the core anti-tamper guarantee.

### TC-CHK-022: Multi-line quote totals match the server formula
- **Priority:** P1
- **Type:** Integration
- **Preconditions:** Cart has Azul Marino (M) ×2 and Negro (L) ×1; `transferDiscountPct = 10` (seed).
- **Steps → Expected:**
  1. Quote via "Continuar al pago" and read the summary → **Expected:** `subtotal = 3×30000 = $90.000`; `transferDiscount = round(90000×0.10) = $9.000`; `totalTransfer = $81.000`; `totalCard = $90.000`. Each `lineTotal = unitPrice×qty`.
  2. Optionally compare against a direct `POST /api/checkout/quote` with the same items → **Expected:** identical numbers.

---

## F. Quote errors (409 / 400 / network)

### TC-CHK-023: Quote 409 out-of-stock keeps the user on step 0
- **Priority:** P0
- **Type:** Negative
- **Preconditions:** Cart has Azul Marino (M) with qty **999** (set via stepper or `rf-cart` edit); seed stock 25; valid customer.
- **Steps → Expected:**
  1. Click "Continuar al pago" → **Expected:** server returns `409 {error:"Sin stock suficiente de Champion Mentality (Azul Marino) talle M"}`; the modal **stays on step 0**; the red error block shows that server message (displayed uppercase by CSS); cart unchanged.
- **Notes:** This is the client/server separation in action — the cart never blocked qty 999; the quote does (`variant.stock < qty`).

### TC-CHK-024: Quote 409 for an inactive/deleted product
- **Priority:** P1
- **Type:** Negative
- **Preconditions:** Cart contains a product; admin/DB access.
- **Steps → Expected:**
  1. Add Azul Marino (M) to the cart, then in admin set that product **inactive** (or delete it) — but keep the line in the cart by not reloading the landing (so `reconcile` does not drop it) → **Expected:** line still in cart.
  2. Click "Continuar al pago" → **Expected:** `409 {error:"Producto inexistente o inactivo: <NAVY_ID>"}`; stays step 0; error shown.
- **Notes:** `quote` queries `where:{id:{in},active:true}`; a missing/inactive id throws `QuoteError`. The message includes the product id.

### TC-CHK-025: Quote 409 for a size with no variant
- **Priority:** P1
- **Type:** Negative
- **Preconditions:** A product whose **XL variant has been removed** (delete the XL variant via admin product edit or DB), but the cart holds that product in size XL.
- **Steps → Expected:**
  1. With an XL line for that product in the cart, click "Continuar al pago" → **Expected:** `409 {error:"Talle XL no disponible para Champion Mentality (Azul Marino)"}`; stays step 0.
- **Notes:** `XL` is still a valid enum value (passes the 400 schema check) but has no variant row → `QuoteError`. To get a *400* for a bad size instead, use a non-enum value (TC-CHK-029). Variant removal relates to CD-10.

### TC-CHK-026: Quote 400 for an empty items array (forced)
- **Priority:** P2
- **Type:** Negative
- **Preconditions:** API running; the UI cannot send this (cart guards it), so call the API directly.
- **Steps → Expected:**
  1. `POST http://localhost:4000/api/checkout/quote` with body `{"items":[]}` → **Expected:** `400 {error:"Items inválidos", details:<zod flatten>}` — `checkoutQuoteSchema` requires `items` array `.min(1)`.
  2. Send `{}` (no `items`) → **Expected:** `400 Items inválidos`.

### TC-CHK-027: Network failure on quote keeps user on step 0
- **Priority:** P2
- **Type:** Negative
- **Preconditions:** Checkout step 0 with valid data; ability to kill connectivity (stop the API process, or block the request in DevTools).
- **Steps → Expected:**
  1. With the API unreachable, click "Continuar al pago" → **Expected:** the request fails; the modal **stays on step 0**; a red error appears.
  2. Read the exact error text → **Expected (shipped):** it shows the **browser's raw fetch error** (e.g. `Failed to fetch` in Chrome / `NetworkError when attempting to fetch resource` in Firefox / `Load failed` in Safari), displayed uppercase — **not** the intended friendly `No se pudo cotizar`.
- **Notes:** **Flag.** `toPago` uses `e instanceof Error ? e.message : 'No se pudo cotizar'`; a fetch network failure throws a `TypeError` (which *is* an `Error`), so the friendly fallback is effectively unreachable and the raw browser message leaks into the UI. Minor UX defect — record it.

### TC-CHK-028: Quote 400 for invalid quantity (forced)
- **Priority:** P1
- **Type:** Negative
- **Preconditions:** API running; `<NAVY_ID>` known.
- **Steps → Expected:**
  1. `POST /api/checkout/quote` with `{"items":[{"productId":"<NAVY_ID>","size":"M","qty":0}]}` → **Expected:** `400 Items inválidos` (`qty` must be int ≥ 1).
  2. Repeat with `qty:-1` → **Expected:** `400`.
  3. Repeat with `qty:1.5` → **Expected:** `400` (must be `.int()`).
  4. Repeat with `qty:"2"` (string) → **Expected:** `400` (must be `number`).
- **Notes:** Confirms a tampered persisted qty (TC-CART-028) can never produce an oversell — it dies at the schema boundary.

### TC-CHK-029: Quote 400 for invalid/missing size or productId (forced)
- **Priority:** P2
- **Type:** Negative
- **Preconditions:** API running; `<NAVY_ID>` known.
- **Steps → Expected:**
  1. `POST /api/checkout/quote` with `size:"XXL"` (not in enum) → **Expected:** `400 Items inválidos`.
  2. With `size:"m"` (lowercase) → **Expected:** `400` (enum is case-sensitive `S/M/L/XL`).
  3. With `productId:""` (empty) → **Expected:** `400` (`.min(1)`).
  4. With `productId` omitted → **Expected:** `400`.

---

## G. Step navigation, progress & summary

### TC-CHK-030: In-modal "Volver" returns to step 0 and retains data
- **Priority:** P2
- **Type:** Functional
- **Preconditions:** Reached step 1 with method = Transferencia (the default; "Volver" renders only for transfer).
- **Steps → Expected:**
  1. On step 1 (transfer), click "Volver" → **Expected:** `setStep(0)` runs *without* unmounting the modal; returns to step 0 and the **customer fields are still populated** (the component stays mounted, so local state survives).
  2. Click "Continuar al pago" again → **Expected:** re-quotes and returns to step 1.
- **Notes:** Contrast with TC-CHK-005: in-modal back keeps data; closing+reopening does not. Note that "Volver" is only shown for the transfer method — card and wallet have no back button on step 1.

### TC-CHK-031: Progress bar widths and step titles
- **Priority:** P3
- **Type:** UI
- **Preconditions:** Able to traverse steps (cart in stock, valid data, transfer path).
- **Steps → Expected:**
  1. Step 0 → **Expected:** title `Tus datos`, progress bar width 33%.
  2. After a successful quote, step 1 → **Expected:** title `Forma de pago`, width 66%.
  3. After confirming a transfer order, step 2 → **Expected:** title `Listo`, width 100%, confirmation screen `¡Pedido confirmado!`.

### TC-CHK-032: Summary totals differ correctly per payment method
- **Priority:** P1
- **Type:** Functional
- **Preconditions:** On step 1 with a known quote (Azul Marino M ×2 → subtotal 60000).
- **Steps → Expected:**
  1. Select Transferencia → **Expected:** rows `Subtotal $60.000`, `Descuento transferencia − $6.000` (gold), `Envío Gratis` (gold), `Total $54.000`.
  2. Select Tarjeta → **Expected:** the discount row is **hidden**; `Subtotal $60.000`, `Envío Gratis`, `Total $60.000`.
  3. Select Mercado Pago (wallet) → **Expected:** same as card (no discount), `Total $60.000`.
- **Notes:** `total = method==='transfer' ? totalTransfer : totalCard`. Envío is always "Gratis" here (shipping is free in the summary).

### TC-CHK-033: Transfer badge % is dynamic; Productos copy is hardcoded "10% OFF" (CD-4)
- **Priority:** P2
- **Type:** UI
- **Preconditions:** Admin access to change `transferDiscountPct` (Module 11); cart in stock.
- **Steps → Expected:**
  1. With the seed `transferDiscountPct = 10`, reach step 1 → **Expected:** the Transferencia option shows a `10% OFF` badge (= `round(transferDiscount/subtotal×100)`), matching the Productos-section footer copy "…10% OFF pagando por transferencia".
  2. In admin, change `transferDiscountPct` to `15`, then re-quote → **Expected:** the checkout badge updates to `15% OFF` and the discount row recomputes, **but** the Productos-section landing copy still reads the hardcoded "10% OFF" — the two now disagree.
- **Notes:** **Candidate defect CD-4.** The checkout badge is computed; `Productos.tsx` hardcodes "10% OFF". They desync whenever `transferDiscountPct ≠ 10`. File CD-4 (cross-ref Module 11).

---

## H. Security & concurrency

### TC-CHK-034: Server re-validates the customer even if the client is bypassed
- **Priority:** P0
- **Type:** Security
- **Preconditions:** API running; `<NAVY_ID>` known.
- **Steps → Expected:**
  1. Skip the UI entirely and `POST http://localhost:4000/api/orders/transfer` with a deliberately invalid customer, e.g. `{"items":[{"productId":"<NAVY_ID>","size":"M","qty":1}],"customer":{"nombre":"","email":"not-an-email","dir":"","ciudad":""}}` → **Expected:** `400` — `customerSchema` is re-validated server-side on the order/payment endpoints; an order is **not** created.
  2. Repeat against `/api/payments/card` and `/api/payments/preference` with the same bad customer → **Expected:** `400` (no order, no MercadoPago call).
- **Notes:** Confirms client-side validation is not the only gate; the server independently enforces `customerSchema`. Cross-ref Module 5.

### TC-CHK-035: Concurrency — stock drops between add and quote
- **Priority:** P1
- **Type:** Concurrency
- **Preconditions:** Azul Marino M stock = 25 (seed); admin/DB access; cart holds Azul Marino (M) qty 20.
- **Steps → Expected:**
  1. With 20 units already in the cart, have another actor reduce that variant's stock to 5 (admin edit, or another buyer's paid order reserves stock) → **Expected:** stock now 5.
  2. Click "Continuar al pago" → **Expected:** the quote re-reads live stock and returns `409` (`variant.stock 5 < qty 20`); the user is held on step 0 with the stock error; no oversold order is possible.
- **Notes:** The quote is computed at request time against current DB stock, so a race between add and checkout is caught. Hard stock enforcement at payment is Module 5/6.

---

## I. Accessibility & responsive

### TC-CHK-036: Form labels, focus, and error association
- **Priority:** P1
- **Type:** Accessibility
- **Preconditions:** Checkout step 0; screen reader / a11y inspector.
- **Steps → Expected:**
  1. Inspect each field → **Expected (and flag):** each input has a **visible** `<label>` (`Nombre y apellido`, `Email`, `Teléfono`, `Dirección de envío`, `Ciudad / Provincia`), **but** the `<label>` has no `htmlFor` and the `<input>` has no `id`/`aria-labelledby`/`aria-label` — so they are **not programmatically associated**. A screen reader falls back to the placeholder as the accessible name. Record this as an accessibility defect (labels not linked).
  2. Tab through the form → **Expected:** all five inputs and the "Continuar al pago" button are reachable in order with a visible focus ring.
  3. Trigger the validation error → **Expected:** the red error text appears; note that it is **not** linked to the inputs via `aria-describedby` and is not in an `aria-live` region, so assistive tech may not announce it on submit (flag as an a11y gap).

### TC-CHK-037: Mobile modal layout
- **Priority:** P2
- **Type:** Responsive
- **Preconditions:** Cart in stock.
- **Steps → Expected:**
  1. Resize the viewport to 360 × 640 and open checkout → **Expected:** the modal card is `min(540px,100%)` ≈ full width with side padding; it is vertically scrollable (`overflow-y-auto`) if content exceeds the viewport; the Email/Teléfono row wraps (`flex-wrap`, `basis-[180px]`/`basis-[140px]`); all fields and the button remain usable with no horizontal overflow.
  2. Advance to step 1 and step 2 on mobile → **Expected:** the payment options, summary, and confirmation all fit and scroll cleanly.
