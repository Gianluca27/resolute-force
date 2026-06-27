# Module 5 — Payments (Card / Wallet / Transfer)

> Checkout step 1 (payment): MercadoPago Card Payment Brick (embedded), MercadoPago Wallet (redirect), and manual bank Transfer (10% off). Server is the source of truth for every amount; the browser only ever sends `{productId,size,qty}` + customer data. See [README](README.md) for seed data, money format, and the pricing formulas.

**Coverage checklist:**
- Method selection & order summary (Subtotal / Envío / discount / total per method)
- Card Brick: render, approved, rejected, in_process, stock-race auto-refund, double-submit, network error, validation, security
- Wallet: preference creation, redirect, success/pending/failure return pages
- Transfer: pending order creation, exact 10% discount math, dynamic badge, bank-details gating (CD-11)
- Amount integrity (server total, never client price)
- Security (no raw PAN to server, tamper resistance)
- Accessibility & responsive

> **Test fixtures:** Use MercadoPago **TEST** credentials (`MP_ACCESS_TOKEN`/`MP_PUBLIC_KEY`/`VITE_MP_PUBLIC_KEY` = sandbox). Use the MP sandbox test cards that deterministically produce `approved` / `rejected` / `in_process` outcomes (cardholder name `APRO`, `OTHE`, `CONT` etc. per current MP docs). Baseline order for math: **2 × Champion Mentality Azul Marino, size M** → subtotal `60000`, transferDiscount `6000`, totalTransfer `54000`, totalCard `60000`.

---

## A. Method selection & order summary

### TC-PAY-001: Default payment method is Transferencia
- **Priority:** P2
- **Type:** Functional
- **Preconditions:** Reached checkout step 1 ("Forma de pago") with a valid cart and customer data.
- **Steps → Expected:**
  1. Observe the payment step on first render → **Expected:** "Transferencia" is the pre-selected method; its panel (transfer confirmation) is shown by default.
  2. Observe the summary → **Expected:** `total` reflects the transfer total (`totalTransfer`), not card total.

### TC-PAY-002: Three method buttons present with correct labels
- **Priority:** P2
- **Type:** UI / Accessibility
- **Preconditions:** Checkout step 1.
- **Steps → Expected:**
  1. Inspect the method selector → **Expected:** exactly three buttons with `aria-label`/text "Transferencia", "Tarjeta", "Mercado Pago".

### TC-PAY-003: Summary shows Subtotal and free shipping
- **Priority:** P2
- **Type:** UI
- **Preconditions:** Step 1, baseline cart.
- **Steps → Expected:**
  1. Read the summary block → **Expected:** `Subtotal` = `$60.000`; `Envío` = `Gratis` (styled gold).

### TC-PAY-004: Transfer method shows the discount line; card/wallet do not
- **Priority:** P1
- **Type:** Functional
- **Preconditions:** Step 1, baseline cart (subtotal 60000).
- **Steps → Expected:**
  1. Select "Transferencia" → **Expected:** summary shows `Descuento transferencia − $6.000` (gold) and `total` = `$54.000`.
  2. Select "Tarjeta" → **Expected:** discount line disappears; `total` = `$60.000`.
  3. Select "Mercado Pago" → **Expected:** discount line absent; `total` = `$60.000`.

### TC-PAY-005: Switching method recomputes the displayed total live
- **Priority:** P1
- **Type:** Functional
- **Preconditions:** Step 1.
- **Steps → Expected:**
  1. Toggle Transferencia → Tarjeta → Transferencia repeatedly → **Expected:** total flips `$54.000` ↔ `$60.000` consistently each time; no stale value.

---

## B. Card Payment Brick (embedded)

### TC-PAY-006: Card Brick renders with the server amount
- **Priority:** P0
- **Type:** Integration
- **Preconditions:** Step 1, `VITE_MP_PUBLIC_KEY` set (or falls back to `TEST-PUBLIC-KEY`), method = Tarjeta.
- **Steps → Expected:**
  1. Select "Tarjeta" → **Expected:** the `<CardPayment>` brick renders (`data-testid="card-brick"`), dark theme, with `initialization.amount` equal to the card total (`60000`).
  2. Observe copy → **Expected:** "Hasta 3 cuotas sin interés" is shown.

### TC-PAY-007: Successful card payment (approved) → confirmation + cart cleared
- **Priority:** P0
- **Type:** Functional
- **Preconditions:** Step 1, Tarjeta, sandbox card that returns `approved`, stock available.
- **Steps → Expected:**
  1. Fill the brick with an APRO card and submit → **Expected:** `POST /api/payments/card` returns 200 `{status:'approved', orderNo, total, count, name}`.
  2. UI → **Expected:** advances to step 2 ("Listo") confirmation; cart is emptied (`clear()`); cart badge disappears.
  3. Check DB/admin → **Expected:** order status `paid`; stock for the purchased variant decremented by qty.

### TC-PAY-008: Rejected card → order cancelled, stock untouched, error message
- **Priority:** P0
- **Type:** Negative
- **Preconditions:** Step 1, Tarjeta, sandbox card that returns `rejected`.
- **Steps → Expected:**
  1. Submit the rejecting card → **Expected:** 200 `{status:'rejected', orderNo, detail}`.
  2. UI → **Expected:** inline error "Pago rechazado. Probá otra tarjeta o medio de pago." (or the pending variant wording); user stays on the payment step; cart NOT cleared.
  3. Check DB → **Expected:** order status `cancelled`; **stock unchanged** (no decrement).

### TC-PAY-009: Card in_process → order stays pending
- **Priority:** P1
- **Type:** Functional
- **Preconditions:** Step 1, Tarjeta, sandbox card that returns `in_process`.
- **Steps → Expected:**
  1. Submit → **Expected:** 200 `{status:'in_process', orderNo, detail}`.
  2. UI → **Expected:** pending message shown ("Pago … pendiente. Probá otra tarjeta o medio de pago." style); cart not cleared.
  3. Check DB → **Expected:** order status `pending`, stock NOT yet decremented (finalized later by webhook).

### TC-PAY-010: Stock vanishes between quote and capture → auto-refund
- **Priority:** P0
- **Type:** Concurrency
- **Preconditions:** Step 1, Tarjeta, approving card. Reduce the variant's stock to 0 (via admin or a concurrent paid order) AFTER the quote but BEFORE submitting the card.
- **Steps → Expected:**
  1. Submit the approving card → **Expected:** 200 `{status:'refunded', orderNo, detail:'Se agotó el stock durante el pago; reintegramos el cobro.'}`.
  2. UI → **Expected:** inline error showing the refund detail; cart not cleared.
  3. Check DB → **Expected:** order `cancelled`; stock unchanged (no oversell); MP shows the charge refunded.
- **Notes:** Core money-safety invariant — a charge is never kept for an unfulfillable order.

### TC-PAY-011: Double-submit is guarded
- **Priority:** P1
- **Type:** Concurrency
- **Preconditions:** Step 1, Tarjeta.
- **Steps → Expected:**
  1. Submit the brick and immediately attempt a second submit while the first is in flight → **Expected:** the `busy` flag blocks the second submit; only one `POST /api/payments/card` is sent; only one order is created.

### TC-PAY-012: Network failure during card submit surfaces an error
- **Priority:** P1
- **Type:** Negative
- **Preconditions:** Step 1, Tarjeta. Simulate API unreachable (offline / kill API) at submit time.
- **Steps → Expected:**
  1. Submit → **Expected:** the `try/catch/finally` surfaces "Error al procesar el pago"; `busy` resets so the user can retry; no crash.

### TC-PAY-013: Card endpoint rejects invalid payment payload (400)
- **Priority:** P1
- **Type:** Negative
- **Preconditions:** API reachable.
- **Steps → Expected:**
  1. `POST /api/payments/card` with missing `token` (empty) / `installments` < 1 / missing `paymentMethodId` / invalid `payer.email` → **Expected:** 400 `{error:'Datos de pago inválidos'}`; no order created.

### TC-PAY-014: Card endpoint rejects out-of-stock at order creation (409)
- **Priority:** P0
- **Type:** Negative
- **Preconditions:** Variant stock = 0 for a requested line.
- **Steps → Expected:**
  1. `POST /api/payments/card` with that line → **Expected:** 409 `QuoteError` body `{error:<stock message>}`; no charge attempted.

### TC-PAY-015: Installments boundary values
- **Priority:** P2
- **Type:** Boundary
- **Preconditions:** Step 1, Tarjeta, approving card.
- **Steps → Expected:**
  1. Pay with `installments = 1` → **Expected:** accepted (int ≥ 1).
  2. Pay with `installments = 3` → **Expected:** accepted ("hasta 3 cuotas").
  3. Submit `installments = 0` or negative directly to the API → **Expected:** 400 `Datos de pago inválidos`.

---

## C. Wallet (MercadoPago redirect)

### TC-PAY-016: Wallet creates a preference and renders the wallet button
- **Priority:** P0
- **Type:** Integration
- **Preconditions:** Step 1, method = "Mercado Pago".
- **Steps → Expected:**
  1. Click "Pagar con MercadoPago" → **Expected:** `POST /api/payments/preference` returns 200 `{preferenceId, initPoint, orderNo}`; a pending `wallet` order is created (no stock decrement yet).
  2. UI → **Expected:** the `<Wallet>` brick renders (`data-testid="wallet-button"`) initialized with the returned `preferenceId`.

### TC-PAY-017: Wallet preference rejects invalid customer data (400)
- **Priority:** P1
- **Type:** Negative
- **Steps → Expected:**
  1. `POST /api/payments/preference` with an invalid `customer` (bad email / empty required field) → **Expected:** 400 `{error:'Datos inválidos'}`.

### TC-PAY-018: Wallet preference rejects out-of-stock (409)
- **Priority:** P0
- **Type:** Negative
- **Preconditions:** Requested variant stock = 0.
- **Steps → Expected:**
  1. `POST /api/payments/preference` → **Expected:** 409 `QuoteError`; no preference created.

### TC-PAY-019: Wallet success return clears the cart
- **Priority:** P1
- **Type:** Functional
- **Preconditions:** A wallet order exists; simulate MP redirect to the success URL.
- **Steps → Expected:**
  1. Navigate to `${PUBLIC_WEB_URL}/checkout/success?external_reference=<orderNo>` → **Expected:** page reads `external_reference`, shows "¡Pedido confirmado!", and **clears the cart on mount**.
- **Notes:** Final payment confirmation is by webhook (Module 6), not this redirect — the page does not itself mark the order paid.

### TC-PAY-020: Wallet pending return keeps the cart
- **Priority:** P1
- **Type:** Functional
- **Steps → Expected:**
  1. Navigate to `/checkout/pending` → **Expected:** shows "Pago en proceso"; **cart is NOT cleared**; does not claim the order is done.

### TC-PAY-021: Wallet failure return shows no-charge message
- **Priority:** P1
- **Type:** Functional
- **Steps → Expected:**
  1. Navigate to `/checkout/failure` → **Expected:** shows "Pago no completado. No se realizó ningún cargo." Cart preserved so the user can retry.

### TC-PAY-022: Unknown checkout route redirects home
- **Priority:** P3
- **Type:** Negative
- **Steps → Expected:**
  1. Navigate to `/checkout/anything-else` → **Expected:** redirect to `/`.

---

## D. Transfer (manual bank, 10% off)

### TC-PAY-023: Transfer creates a pending order with the discounted total
- **Priority:** P0
- **Type:** Functional
- **Preconditions:** Step 1, method = Transferencia, baseline cart (subtotal 60000).
- **Steps → Expected:**
  1. Click confirm (confirmTransfer) → **Expected:** `POST /api/orders/transfer` returns 200 `{orderNo, total:54000, count, name, bankAlias, bankCbu}`.
  2. UI → **Expected:** advances to step 2 confirmation.
  3. Check DB → **Expected:** order status `pending`, `total = 54000`, `discount = 6000`, `paymentMethod = 'transfer'`; **stock NOT decremented** (stock only drops when an admin later marks it paid).

### TC-PAY-024: Transfer discount math — 1 unit
- **Priority:** P0
- **Type:** Boundary
- **Preconditions:** Cart = 1 unit (subtotal 30000), transferDiscountPct = 10.
- **Steps → Expected:**
  1. Confirm transfer → **Expected:** `discount = 3000`, `total = 27000`. Summary showed `Descuento transferencia − $3.000`, total `$27.000`.

### TC-PAY-025: Transfer discount rounding on odd subtotal
- **Priority:** P1
- **Type:** Boundary
- **Preconditions:** Construct a cart whose subtotal is odd vs 10% (e.g. price producing subtotal `29999`).
- **Steps → Expected:**
  1. Quote/confirm → **Expected:** `discount = Math.round(29999 * 0.10) = 3000`; `total = 26999`. No floats; integer ARS only.

### TC-PAY-026: Transfer badge percentage is dynamic
- **Priority:** P2
- **Type:** UI
- **Preconditions:** Step 1, subtotal 60000, discount 6000.
- **Steps → Expected:**
  1. Inspect the Transferencia option badge → **Expected:** shows `${Math.round(6000/60000*100)}% OFF` = "10% OFF" (rendered only when discount > 0).
- **Notes:** CD-4 — this badge is computed, but the **Productos** landing section hardcodes "10% OFF". Change `transferDiscountPct` (Module 11) and confirm the badge follows while the Productos text does not (desync defect).

### TC-PAY-027: Transfer with empty bank details (default seed) shows NO bank data
- **Priority:** P0
- **Type:** Negative
- **Preconditions:** Default seed — `SiteContent.bankAlias = ''`, `bankCbu = ''`.
- **Steps → Expected:**
  1. Complete a transfer order → **Expected:** confirmation step renders **without** the "Datos para transferir" (Alias / CBU / Importe) block (gated on `confirmation.pay==='transfer' && bankAlias` non-empty).
  2. Check the customer email (Module 7) → **Expected:** no bank block either.
- **Notes:** CD-11 — customer literally cannot complete the transfer; high-impact. Admin must set bank details first.

### TC-PAY-028: Transfer with bank details set shows Alias / CBU / Importe
- **Priority:** P1
- **Type:** Functional
- **Preconditions:** Admin set `bankAlias` and `bankCbu` in Contenido (Module 11).
- **Steps → Expected:**
  1. Complete a transfer order → **Expected:** confirmation shows the "Datos para transferir" block with Alias, CBU, and Importe = `$54.000`.

### TC-PAY-029: Transfer endpoint validation & errors
- **Priority:** P1
- **Type:** Negative
- **Steps → Expected:**
  1. `POST /api/orders/transfer` with invalid customer → **Expected:** 400 `{error:'Datos inválidos'}`.
  2. With an out-of-stock line → **Expected:** 409 `QuoteError`.
  3. Force a server error → **Expected:** 500 `{error:'No se pudo crear el pedido'}`.

---

## E. Amount integrity & security

### TC-PAY-030: Amount charged equals the SERVER total, not a tampered client value
- **Priority:** P0
- **Type:** Security
- **Preconditions:** Intercept the request (devtools / proxy).
- **Steps → Expected:**
  1. Tamper the outgoing payload to inject a fake `price`/`total`/lower `amount` → **Expected:** server ignores client money entirely; it recomputes from DB `product.price` via `computeTotals`. The MP charge amount = `order.total` derived server-side. The tampered value has no effect.

### TC-PAY-031: Raw card number never reaches our server
- **Priority:** P0
- **Type:** Security
- **Preconditions:** Tarjeta, network capture on.
- **Steps → Expected:**
  1. Submit a card and inspect `POST /api/payments/card` body → **Expected:** body contains only `token`, `installments`, `paymentMethodId`, `issuerId?`, `payer{email, identification?}` — **no PAN/CVV/expiry**. Tokenization happened client-side in the MP brick.

### TC-PAY-032: MP access token is never exposed to the browser
- **Priority:** P0
- **Type:** Security
- **Steps → Expected:**
  1. Inspect all network responses and the JS bundle → **Expected:** only `MP_PUBLIC_KEY` is present (e.g. via `GET /api/payments/public-key`); the secret `MP_ACCESS_TOKEN` never appears client-side.

### TC-PAY-033: XSS via customer name does not execute on the confirmation
- **Priority:** P1
- **Type:** Security
- **Preconditions:** Customer `nombre` = `<img src=x onerror=alert(1)>`.
- **Steps → Expected:**
  1. Complete an order and view the confirmation (and later the emails, Module 7) → **Expected:** the value is rendered as inert text (React escapes in UI; `escapeHtml` in email), no script executes.

---

## F. Accessibility & responsive

### TC-PAY-034: Payment method buttons are keyboard operable and labelled
- **Priority:** P2
- **Type:** Accessibility
- **Steps → Expected:**
  1. Tab to the method buttons and activate with Enter/Space → **Expected:** each is focusable, has an accessible name (aria-label = "Transferencia"/"Tarjeta"/"Mercado Pago"), and selection updates the panel.

### TC-PAY-035: Card brick and summary are usable on mobile
- **Priority:** P2
- **Type:** Responsive
- **Preconditions:** Viewport 375×812.
- **Steps → Expected:**
  1. Open the payment step on mobile → **Expected:** the brick, summary, and confirm button fit without horizontal scroll; the brick iframe is fully interactive; totals legible.

### TC-PAY-036: Back navigation from payment to data step preserves the in-modal state
- **Priority:** P2
- **Type:** Functional
- **Preconditions:** Modal still mounted (use the in-modal "Volver", not the close button).
- **Steps → Expected:**
  1. From step 1 use the in-modal back control → **Expected:** returns to step 0 with the previously entered customer data still present.
- **Notes:** Distinct from closing the modal entirely — see CD-17 (closing unmounts and discards data).
