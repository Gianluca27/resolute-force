# Module 10 — Admin orders

> Scope: the admin **Pedidos** page (`/admin/pedidos`) and its API: `GET /api/admin/orders` and `PATCH /api/admin/orders/:id/status`. Covers the order list rendering, every status-transition rule (stock reserve/restock, the 422 revert guard, the 409 oversell guard, idempotent no-op), the manual transfer-confirmation flow, deleted-product line handling, error surfacing, security, a11y and large-list rendering. There is **no** filter/search UI, no admin order-creation path, and no per-field edit — the only mutation is the status `<select>`.

Read the [README](README.md) first for env, the canonical seed, the order-status lifecycle (`pending | paid | shipped | cancelled`, stock held iff status ∈ `{paid, shipped}`), the candidate-defects appendix (CD-11) and the case/priority conventions.

**Reusable facts (do not repeat per case):**
- All endpoints require `Authorization: Bearer <jwt>`. Missing header → `401 {error:'No autorizado'}`; bad token → `401 {error:'Sesión inválida o expirada'}`.
- `GET /api/admin/orders` returns **all** orders, `createdAt` **descending**, each with its `items` (raw Prisma rows, so the response also exposes `subtotal`, `discount`, `mpPaymentId`, `mpPreferenceId`). No pagination, no filtering.
- Order card (`Orders.tsx`): header line `<orderNo> · <customerName>` + `money(total)`; secondary line `<email> · <phone | —> · <address>, <city> · <paymentMethod>`; items line joins `"<line> <color> <size> x<qty>"` with `"  ·  "`; a `<select>` with options `pending / paid / shipped / cancelled` bound to `o.status`.
- `PATCH /api/admin/orders/:id/status` body `{status: enum[pending,paid,shipped,cancelled]}`. Responses: `200` updated order w/ items; `400 {error:'Estado inválido'}`; `404 {error:'Orden no encontrada'}`; `422 {error:'No se puede revertir un pedido pagado a pendiente'}`; `409 {error:'Sin stock al confirmar <line> talle <size>'}` (OutOfStock).
- Transition rules in `changeOrderStatus`: `from===to` → no-op (returns current). `pending|cancelled → paid|shipped` → reserves stock via the atomic oversell-guarded claim (`markPaidByOrderNo`), then lands on the target; firing the "paid" email on transition. `paid|shipped → cancelled` → restocks. `paid|shipped → pending` → **422** (never reverts). `paid → shipped` → plain status change (no stock change). Manual mark-paid uses `mpPaymentId = order.mpPaymentId ?? 'manual'`.
- `STOCK_HELD = {paid, shipped}`. Stock decrements only when entering a held state from a non-held one; restock only when leaving a held state to `cancelled`.
- The web client (`Orders.tsx`) shows **no** error UI on a failed PATCH (the mutation has only `onSuccess`); because the `<select value={o.status}>` is fully controlled by server data, a rejected change visually snaps back to the previous status after the failed request, with no message to the admin.

**Coverage checklist:**
- [ ] List all orders, newest first, with every card field; phone `—` when null; empty-list state
- [ ] pending→paid (decrement + email); pending→shipped (decrement + email); paid→shipped (no change); paid→cancelled (restock); shipped→cancelled (restock)
- [ ] paid→pending → 422; same-status no-op; cancelled→paid re-decrement; cancelled→paid when stock gone → 409
- [ ] mark-paid when stock insufficient → 409 (oversell guard); invalid status value → 400; unknown order id → 404
- [ ] manual transfer confirmation (pending→paid, mpPaymentId='manual'); order with deleted product (null productId) — snapshot displays + markPaid skips that line
- [ ] transfer order shows discount in subtotal/total; failed-PATCH error not surfaced in UI
- [ ] unauthorized → 401; a11y of status select; large list rendering/perf

---

## Orders list

### TC-ORD-001: List renders all orders newest-first with full card data
- **Priority:** P1
- **Type:** Functional
- **Preconditions:** Logged in; at least two orders exist created at different times (e.g. one transfer + one card via storefront checkout).
- **Steps → Expected:**
  1. Open `/admin/pedidos` → **Expected:** Heading `Pedidos`; one card per order.
  2. Inspect ordering → **Expected:** Cards are sorted `createdAt` descending (most recent at top).
  3. Inspect a card → **Expected:** `RF-###### · <Name>`, `money(total)` on the right; secondary line `<email> · <phone> · <address>, <city> · <method>`; items line e.g. `Champion Mentality Azul Marino M x2`; a status `<select>` showing the current status.
- **Notes:** No search/filter exists — a large store must scan visually (see TC-ORD-022).

### TC-ORD-002: All card fields map to the correct order data
- **Priority:** P2
- **Type:** UI
- **Preconditions:** Logged in; an order with known field values.
- **Steps → Expected:**
  1. Compare each rendered field to the DB/order DTO → **Expected:** `orderNo`, `customerName`, `total` (es-AR money), `customerEmail`, `customerPhone`, `address`, `city`, `paymentMethod`, and each item's `line color size xqty` all match exactly.
- **Notes:** `total` reflects method (transfer = discounted, card/wallet = full subtotal).

### TC-ORD-003: Phone renders em-dash when null
- **Priority:** P3
- **Type:** UI
- **Preconditions:** An order placed without a phone (`tel` omitted → stored `null`).
- **Steps → Expected:**
  1. View that order's card → **Expected:** The phone position shows `—` (`o.customerPhone ?? '—'`), not `null`/blank.

### TC-ORD-004: Empty orders list renders cleanly
- **Priority:** P3
- **Type:** UI
- **Preconditions:** No orders in DB.
- **Steps → Expected:**
  1. Open `/admin/pedidos` → **Expected:** Heading renders; no cards; no crash (`data ?? []`).

---

## Status transitions

### TC-ORD-005: pending → paid decrements stock and fires paid email
- **Priority:** P0
- **Type:** Functional
- **Preconditions:** Logged in; a `pending` order for `Azul Marino` size `M` qty `2`; that variant has `stock=25`; mailer configured (or stubbed) to observe the email.
- **Steps → Expected:**
  1. On the order card, change the `<select>` from `pending` to `paid` → **Expected:** `PATCH .../status {status:'paid'}` returns `200` with `status:'paid'`.
  2. Check the variant stock → **Expected:** `Azul Marino / M` is now `23` (25 − 2), via the atomic oversell-guarded claim.
  3. Check email side-effects → **Expected:** `notifyOrderPaid` fires (customer paid email; admin email if `ADMIN_NOTIFY_EMAIL` set). Cross-ref Module 7.
- **Notes:** `mpPaymentId` becomes `'manual'` when the order had none. Matches shipped test (stock 25→23).

### TC-ORD-006: pending → shipped decrements stock and fires email
- **Priority:** P1
- **Type:** Functional
- **Preconditions:** A `pending` order, qty 2 of a size with ≥2 stock.
- **Steps → Expected:**
  1. Change status directly to `shipped` → **Expected:** `200 status:'shipped'`; stock decremented by 2 (entering a held state reserves stock via `markPaidByOrderNo`, then lands on `shipped`).
  2. **Expected:** the paid-email side effect still fires (the reserve path runs `markPaidByOrderNo`, which notifies on transition).
- **Notes:** Jumping straight to shipped is a valid first-touch held state.

### TC-ORD-007: paid → shipped does not change stock
- **Priority:** P1
- **Type:** Functional
- **Preconditions:** A `paid` order (stock already decremented).
- **Steps → Expected:**
  1. Change `paid` → `shipped` → **Expected:** `200 status:'shipped'`; stock **unchanged** (both are held states; plain status update, no decrement, no email re-send).

### TC-ORD-008: paid → cancelled restocks inventory
- **Priority:** P0
- **Type:** Functional
- **Preconditions:** A `paid` order for `Azul Marino / M` qty 2 (variant currently `23`).
- **Steps → Expected:**
  1. Change `paid` → `cancelled` → **Expected:** `200 status:'cancelled'`; variant restocked to `25` (23 + 2) via `restockOrder`.
- **Notes:** Matches shipped test (25 − 2 + 2 = 25).

### TC-ORD-009: shipped → cancelled restocks inventory
- **Priority:** P1
- **Type:** Functional
- **Preconditions:** A `shipped` order, qty 2, stock previously decremented.
- **Steps → Expected:**
  1. Change `shipped` → `cancelled` → **Expected:** `200 status:'cancelled'`; the 2 units are returned to stock.

### TC-ORD-010: paid → pending is rejected with 422
- **Priority:** P1
- **Type:** Negative
- **Preconditions:** A `paid` order.
- **Steps → Expected:**
  1. Change `paid` → `pending` → **Expected:** `422 {error:'No se puede revertir un pedido pagado a pendiente'}`. Status stays `paid`; stock unchanged.
  2. Repeat from `shipped` → `pending` → **Expected:** also `422`.
- **Notes:** In the UI the select snaps back to `paid`/`shipped` and **no** error message is shown (see TC-ORD-020). Matches shipped test asserting 422.

### TC-ORD-011: Setting the same status is a no-op
- **Priority:** P2
- **Type:** Functional
- **Preconditions:** Any order.
- **Steps → Expected:**
  1. Re-select the status the order already has (e.g. `pending`→`pending`) → **Expected:** `200`, order returned unchanged; `from===to` short-circuits before any stock logic; no double decrement, no email.

### TC-ORD-012: cancelled → paid re-decrements stock
- **Priority:** P1
- **Type:** Functional
- **Preconditions:** A previously `cancelled` order (its stock was restocked) for a size that still has enough stock.
- **Steps → Expected:**
  1. Change `cancelled` → `paid` → **Expected:** `200 status:'paid'`; stock decrements again (re-entering a held state from a non-held one). `mpPaymentId` set to `manual` if still null.
- **Notes:** Confirms cancellation is reversible when inventory allows.

### TC-ORD-013: cancelled → paid when stock is gone → 409
- **Priority:** P0
- **Type:** Negative
- **Preconditions:** A `cancelled` order whose item's stock has since been sold out (variant stock `0`).
- **Steps → Expected:**
  1. Change `cancelled` → `paid` → **Expected:** `409 {error:'Sin stock al confirmar <line> talle <size>'}`; status stays `cancelled`; the conditional decrement (`stock: {gte: qty}`) fails the atomic claim, so no oversell occurs.
- **Notes:** Oversell guard. UI shows no error banner; select reverts to `cancelled`.

### TC-ORD-014: Mark paid when stock is insufficient → 409 (oversell guard)
- **Priority:** P0
- **Type:** Negative
- **Preconditions:** A `pending` order for qty greater than the current variant stock (e.g. order qty 3 but stock 1).
- **Steps → Expected:**
  1. Change `pending` → `paid` → **Expected:** `409 {error:'Sin stock al confirmar <line> talle <size>'}`; status stays `pending`; **no** partial decrement (the per-line guard rolls back the transaction).
- **Notes:** P0 — the core oversell protection. Verify stock is exactly as before (no negative, no partial).

### TC-ORD-015: Invalid status value → 400
- **Priority:** P1
- **Type:** Negative
- **Preconditions:** Valid admin token, REST client (the UI `<select>` cannot emit invalid values).
- **Steps → Expected:**
  1. `PATCH .../status {status:'refunded'}` → **Expected:** `400 {error:'Estado inválido'}` (zod enum rejects).
  2. `PATCH` with `{}` (no status), with `{status:''}`, and with `{status:123}` → **Expected:** `400 Estado inválido` for each.

### TC-ORD-016: Non-existent order id → 404
- **Priority:** P1
- **Type:** Negative
- **Preconditions:** Valid admin token.
- **Steps → Expected:**
  1. `PATCH /api/admin/orders/does-not-exist/status {status:'paid'}` → **Expected:** `404 {error:'Orden no encontrada'}` (`changeOrderStatus` returns null → route 404).
- **Notes:** The status body is valid, so this is a 404 not a 400. Matches shipped test.

---

## Edge cases & flows

### TC-ORD-017: Manual transfer confirmation (pending → paid)
- **Priority:** P1
- **Type:** Integration
- **Preconditions:** Logged in; a transfer order in `pending` (the storefront leaves transfer orders pending until the bank deposit is confirmed manually). Bank details set via Contenido (else CD-11).
- **Steps → Expected:**
  1. After confirming the customer's bank transfer out-of-band, set the order `pending` → `paid` → **Expected:** `200 status:'paid'`; stock decremented; paid email fired; the order's `mpPaymentId` is set to `'manual'` (it had no MP payment).
  2. Re-open `/admin/pedidos` → **Expected:** the order shows `paid`; totals reflect the transfer discount (see TC-ORD-019).
- **Notes:** This is the only "create revenue" admin action — there is no admin order-creation form. Cross-ref Module 5/7 (transfer + emails) and CD-11.

### TC-ORD-018: Order with a deleted product (null productId) displays snapshot and skips that line on mark-paid
- **Priority:** P1
- **Type:** Integration
- **Preconditions:** A `pending` order whose product was later deleted (so that `OrderItem.productId` is `NULL`; the snapshot `line/color/size/unitPrice/qty` remain). See Module 9 TC-PROD-023.
- **Steps → Expected:**
  1. View the order card → **Expected:** the item line still renders from the snapshot (`<line> <color> <size> x<qty>`), unaffected by the null `productId`.
  2. Change `pending` → `paid` → **Expected:** `200 status:'paid'`; the stock-decrement loop **skips** the null-product line (`if (!it.productId) continue;`) — no error, no decrement for that line; other valid lines decrement normally.
- **Notes:** Confirms deleting a product never breaks confirming its historical orders (no crash, no false 409). `total` is unchanged (snapshot price preserved).

### TC-ORD-019: Transfer order totals show the discount
- **Priority:** P2
- **Type:** UI
- **Preconditions:** A transfer order for subtotal `30000` with default `transferDiscountPct=10`.
- **Steps → Expected:**
  1. View the card `money(total)` → **Expected:** `$27.000` (30000 − 3000), i.e. the discounted transfer total; the raw response also carries `subtotal:30000` and `discount:3000`.
  2. Compare to a card order of the same items → **Expected:** card order total is `$30.000` (no discount).
- **Notes:** The card UI only shows `total`; `subtotal/discount` are present in the API response but not rendered.

### TC-ORD-020: Failed status change is not surfaced in the UI
- **Priority:** P2
- **Type:** UI
- **Preconditions:** A `paid` order (to force a 422 via paid→pending) or an oversell case (409).
- **Steps → Expected:**
  1. Attempt `paid` → `pending` from the `<select>` → **Expected:** The request returns `422`; because the mutation has only `onSuccess` (no `onError` handler/toast) and the select is controlled by `o.status`, the dropdown visually reverts to `paid` and **no** error message is shown to the admin.
  2. Repeat with an oversell `409` case → **Expected:** same silent revert.
- **Notes:** Flag as a UX gap (P2): admins get no feedback on why a status change "didn't take." Recommend surfacing the API `error` message.

---

## Security, a11y & performance

### TC-ORD-021: Orders endpoints reject unauthorized access → 401
- **Priority:** P0
- **Type:** Security
- **Preconditions:** No / bad token.
- **Steps → Expected:**
  1. `GET /api/admin/orders` with no `Authorization` → **Expected:** `401 {error:'No autorizado'}`.
  2. `PATCH /api/admin/orders/<id>/status {status:'paid'}` with no token → **Expected:** `401`; status NOT changed; stock untouched.
  3. Repeat both with `Authorization: Bearer garbage` → **Expected:** `401 {error:'Sesión inválida o expirada'}`.
- **Notes:** Auth precedes validation — an invalid body still returns 401 without a token.

### TC-ORD-022: Large order list renders within acceptable time
- **Priority:** P3
- **Type:** Performance
- **Preconditions:** Seed/generate a large number of orders (e.g. 500+), each with several items.
- **Steps → Expected:**
  1. Open `/admin/pedidos` → **Expected:** All orders render (no pagination); page remains responsive; the single `GET` returns the full set. Record load/scroll time.
- **Notes:** No pagination or filtering exists — note any noticeable lag as a scalability concern (the endpoint also returns every item per order).

### TC-ORD-023: Status select is keyboard- and screen-reader operable
- **Priority:** P2
- **Type:** Accessibility
- **Preconditions:** Logged in; at least one order.
- **Steps → Expected:**
  1. Tab to the status `<select>` and change it with the keyboard → **Expected:** focusable, operable via keyboard, options announced as `pending/paid/shipped/cancelled`.
  2. Inspect labelling → **Expected (gap to flag):** the `<select>` has no associated `<label>`/`aria-label` and the card has no accessible order heading — screen-reader users get little context about which order the control belongs to. Note as an a11y improvement.
- **Notes:** Status option text is the raw English enum (`pending`…), not localized — minor i18n inconsistency given the rest of the UI is es-AR.
