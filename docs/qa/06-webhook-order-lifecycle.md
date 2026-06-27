# Module 6 — Webhook & Order Lifecycle

> The MercadoPago webhook is the source of truth for async payment status. Stock is decremented exactly once, inside a transaction, and is never oversold. Orders move through `pending | paid | shipped | cancelled`; stock is reserved iff status ∈ `{paid, shipped}`. See [README](README.md) for seed data and invariants. Payment UI is Module 5; emails triggered here are Module 7; admin order UI is Module 10.

**Coverage checklist:**
- Webhook signature validation (skipped / missing / bad / valid)
- Webhook processing (payment re-fetch, type/id parsing, query vs body, always-200)
- Idempotency & replay (decrement exactly once)
- Reversal / restock (refunded / charged_back / cancelled)
- Automatic status lifecycle (card/wallet driven)
- Admin status transitions (reserve, restock, 422 revert-guard, 409 oversell)
- Order number format & collision retry
- Concurrency / oversell guards

> **How to drive the webhook in QA:** `POST /api/payments/webhook`. The handler reads `type` and `data.id` from **query OR body** (`type=payment`, `data.id=<mpPaymentId>`). It then calls `mp.getPayment(id)` to re-fetch the authoritative status — so in a sandbox you must point it at a real/mock MP payment whose status you control, or use the API test suite hooks. With `MP_WEBHOOK_SECRET` empty (default) signature checking is skipped, so you can post directly. Baseline order: 1 unit, variant stock 25.

---

## A. Webhook signature validation

### TC-WHK-001: No secret configured → signature check skipped (processed)
- **Priority:** P1
- **Type:** Functional
- **Preconditions:** `MP_WEBHOOK_SECRET = ''` (default).
- **Steps → Expected:**
  1. `POST /api/payments/webhook?type=payment&data.id=<id>` with no `x-signature` header → **Expected:** signature verification returns `true` (skipped); request is processed; HTTP 200.

### TC-WHK-002: Secret set, missing x-signature → 401
- **Priority:** P0
- **Type:** Security
- **Preconditions:** `MP_WEBHOOK_SECRET` set to a real value.
- **Steps → Expected:**
  1. `POST /api/payments/webhook?type=payment&data.id=<id>` with NO `x-signature` header → **Expected:** HTTP 401; order state unchanged.

### TC-WHK-003: Secret set, tampered/invalid signature → 401
- **Priority:** P0
- **Type:** Security
- **Preconditions:** `MP_WEBHOOK_SECRET` set.
- **Steps → Expected:**
  1. POST with an `x-signature` whose `v1` HMAC does not match the manifest `id:{dataId};request-id:{requestId};ts:{ts};` → **Expected:** `timingSafeEqual` fails → HTTP 401; no state change.

### TC-WHK-004: Secret set, valid signature → processed
- **Priority:** P0
- **Type:** Security
- **Preconditions:** `MP_WEBHOOK_SECRET` set; craft a correct `x-signature` (`ts`,`v1`) and `x-request-id`.
- **Steps → Expected:**
  1. POST with the valid signature → **Expected:** signature passes; payment is processed; HTTP 200.

### TC-WHK-005: Signature uses constant-time comparison
- **Priority:** P2
- **Type:** Security
- **Preconditions:** Secret set.
- **Steps → Expected:**
  1. Review/verify comparison path → **Expected:** comparison is `crypto.timingSafeEqual` over the HMAC-SHA256 digest, not a plain string `===` (no early-exit timing leak).

---

## B. Webhook processing

### TC-WHK-006: type ≠ payment is ignored
- **Priority:** P1
- **Type:** Functional
- **Steps → Expected:**
  1. `POST /api/payments/webhook?type=plan&data.id=123` → **Expected:** HTTP 200; no order touched (only `type==='payment'` is acted on).

### TC-WHK-007: Missing data.id is handled gracefully
- **Priority:** P1
- **Type:** Negative
- **Steps → Expected:**
  1. `POST /api/payments/webhook?type=payment` (no `data.id`) → **Expected:** HTTP 200; no `getPayment` call / no crash.

### TC-WHK-008: Reads type & id from query parameters
- **Priority:** P2
- **Type:** Functional
- **Steps → Expected:**
  1. POST with `?type=payment&data.id=<id>` and an empty body → **Expected:** processed using the query values.

### TC-WHK-009: Reads type & id from JSON body
- **Priority:** P2
- **Type:** Functional
- **Steps → Expected:**
  1. POST with no query string but body `{"type":"payment","data":{"id":"<id>"}}` → **Expected:** processed using the body values (`req.query.type ?? req.body.type`, `req.query['data.id'] ?? req.body.data.id`).

### TC-WHK-010: MP getPayment is authoritative (body-claimed status ignored)
- **Priority:** P0
- **Type:** Security
- **Preconditions:** An order is pending; the real MP payment is `rejected`.
- **Steps → Expected:**
  1. POST a webhook body falsely claiming `status: approved` but with a `data.id` whose MP payment is actually `rejected` → **Expected:** handler re-fetches via `mp.getPayment(id)` and acts on the **real** status (no paid transition, no decrement). The body's claimed status is never trusted.

### TC-WHK-011: Approved payment → order paid + stock decremented
- **Priority:** P0
- **Type:** Functional
- **Preconditions:** Pending wallet/card order for 1 unit, variant stock 25.
- **Steps → Expected:**
  1. POST a webhook whose MP payment is `approved` → **Expected:** `confirmOrRefund` runs; order → `paid`; variant stock → 24; paid email fires (Module 7); HTTP 200.

### TC-WHK-012: Internal error still returns HTTP 200
- **Priority:** P1
- **Type:** Negative
- **Preconditions:** Force an exception inside processing (e.g. unknown `external_reference`).
- **Steps → Expected:**
  1. POST → **Expected:** error is caught and logged (`[webhook]`); response is still HTTP 200 so MP stops retrying. (The only non-200 path is 401 for a bad signature.)

---

## C. Idempotency & replay

### TC-WHK-013: Duplicate webhook decrements stock exactly once
- **Priority:** P0
- **Type:** Concurrency
- **Preconditions:** Pending order for 3 units, variant stock 25.
- **Steps → Expected:**
  1. POST the `approved` webhook once → **Expected:** order `paid`; stock 25 → 22.
  2. POST the identical webhook again (replay) → **Expected:** atomic claim `updateMany where status NOT IN [paid,shipped]` matches 0 rows → `transitioned:false`; stock stays **22** (no second decrement); HTTP 200.

### TC-WHK-014: Replay does not send a second paid email
- **Priority:** P1
- **Type:** Functional
- **Steps → Expected:**
  1. Send the approved webhook twice → **Expected:** `notifyOrderPaid` fires only on the real transition (once). (Backed by the notify-wiring test asserting a single call.)

### TC-WHK-015: mpPaymentId is persisted even before the paid transition
- **Priority:** P2
- **Type:** Functional
- **Steps → Expected:**
  1. Trigger an approved webhook → **Expected:** `mpPaymentId` is stored on the order via `updateMany where mpPaymentId:null` up front, keeping the charge traceable even if the stock step later fails.

### TC-WHK-016: Out-of-order delivery (refund arrives before paid) is a no-op
- **Priority:** P1
- **Type:** Negative
- **Preconditions:** Order still `pending` (never paid).
- **Steps → Expected:**
  1. POST a `refunded` webhook for that order → **Expected:** `reverseOrderIfPaid` no-ops (order was never paid/shipped); status stays `pending`; stock unchanged; HTTP 200.

---

## D. Reversal & restock

### TC-WHK-017: refunded on a paid order → restock + cancelled
- **Priority:** P0
- **Type:** Functional
- **Preconditions:** Order `paid` (stock already decremented for 2 units; stock now 23).
- **Steps → Expected:**
  1. POST a webhook whose MP status is `refunded` → **Expected:** `reverseOrderIfPaid` increments stock back (23 → 25) and sets order `cancelled`; HTTP 200.

### TC-WHK-018: charged_back on a paid order → restock + cancelled
- **Priority:** P0
- **Type:** Functional
- **Preconditions:** Order `paid`.
- **Steps → Expected:**
  1. POST `charged_back` webhook → **Expected:** stock restored; order `cancelled`.

### TC-WHK-019: cancelled status on a paid order → restock + cancelled
- **Priority:** P1
- **Type:** Functional
- **Steps → Expected:**
  1. POST `cancelled` webhook for a paid order → **Expected:** stock restored; order `cancelled`.

### TC-WHK-020: Reversal on an already-cancelled order is a no-op
- **Priority:** P1
- **Type:** Negative
- **Preconditions:** Order already `cancelled`.
- **Steps → Expected:**
  1. POST a `refunded` webhook again → **Expected:** no double-restock; stock unchanged; HTTP 200.

---

## E. Automatic status lifecycle (card/wallet driven)

### TC-WHK-021: created order starts as pending
- **Priority:** P2
- **Type:** Functional
- **Steps → Expected:**
  1. Create any order (card pre-approval, wallet preference, transfer, or in_process card) → **Expected:** initial status `pending`; stock NOT held.

### TC-WHK-022: Card rejected leaves stock untouched
- **Priority:** P0
- **Type:** Functional
- **Preconditions:** Card payment that returns `rejected` (Module 5).
- **Steps → Expected:**
  1. Submit rejecting card → **Expected:** order `cancelled`; stock unchanged (never decremented for a non-approved card).

### TC-WHK-023: Card approved but stock gone → MP refund + cancelled
- **Priority:** P0
- **Type:** Concurrency
- **Preconditions:** Stock exhausted between quote and capture.
- **Steps → Expected:**
  1. Approving card captured → **Expected:** `confirmOrRefund` catches `OutOfStockError`, refunds via MP, sets order `cancelled`; client sees `status:'refunded'`; no oversell; no paid email.

---

## F. Admin status transitions

> Endpoint `PATCH /api/admin/orders/:id/status {status}` (auth required). `changeOrderStatus` enforces the rules. STOCK_HELD = `{paid, shipped}`.

### TC-WHK-024: pending → paid decrements stock and fires paid email
- **Priority:** P0
- **Type:** Functional
- **Preconditions:** A pending transfer order for 2 units, stock 25.
- **Steps → Expected:**
  1. PATCH status to `paid` → **Expected:** atomic claim reserves stock (25 → 23); order `paid`; paid email fires; `mpPaymentId='manual'` set (no real MP id). 200 with updated order.

### TC-WHK-025: pending → shipped also decrements stock
- **Priority:** P0
- **Type:** Functional
- **Preconditions:** Pending order, stock available.
- **Steps → Expected:**
  1. PATCH status to `shipped` (from a non-held state) → **Expected:** stock decremented (entering a held state reserves stock) + paid email; order `shipped`.

### TC-WHK-026: paid → shipped does not change stock
- **Priority:** P1
- **Type:** Functional
- **Preconditions:** Order already `paid` (stock already held).
- **Steps → Expected:**
  1. PATCH to `shipped` → **Expected:** plain status update; **no** further decrement (both states are held).

### TC-WHK-027: paid → cancelled restocks
- **Priority:** P0
- **Type:** Functional
- **Preconditions:** Paid order, 2 units (stock 23).
- **Steps → Expected:**
  1. PATCH to `cancelled` → **Expected:** stock incremented back (23 → 25); order `cancelled`.

### TC-WHK-028: paid → pending is blocked (422)
- **Priority:** P0
- **Type:** Negative
- **Preconditions:** Paid order.
- **Steps → Expected:**
  1. PATCH to `pending` → **Expected:** 422 `{error:'No se puede revertir un pedido pagado a pendiente'}`; status unchanged; stock unchanged.

### TC-WHK-029: cancelled → paid re-decrements stock
- **Priority:** P1
- **Type:** Functional
- **Preconditions:** Cancelled order whose stock was restored; variant has stock.
- **Steps → Expected:**
  1. PATCH cancelled order back to `paid` → **Expected:** stock is decremented again (re-reserved). If stock is now insufficient → 409 (see TC-WHK-034).

### TC-WHK-030: Same-status PATCH is a no-op
- **Priority:** P2
- **Type:** Functional
- **Steps → Expected:**
  1. PATCH a `paid` order to `paid` → **Expected:** no-op; returns the order; no extra decrement, no email.

### TC-WHK-031: Invalid status value → 400; unknown order → 404
- **Priority:** P1
- **Type:** Negative
- **Steps → Expected:**
  1. PATCH with `status:'done'` → **Expected:** 400 `{error:'Estado inválido'}`.
  2. PATCH a non-existent order id → **Expected:** 404 `{error:'Orden no encontrada'}`.

### TC-WHK-032: Order line with a deleted product is skipped on mark-paid
- **Priority:** P1
- **Type:** Edge
- **Preconditions:** An order whose product was deleted (its `OrderItem.productId` is now `null`, snapshot fields preserved).
- **Steps → Expected:**
  1. Mark that order `paid` → **Expected:** the null-product line is skipped for stock decrement (`if (!it.productId) continue`); no crash; order transitions; remaining lines decrement normally.

---

## G. Order number & concurrency / oversell

### TC-WHK-033: Order number format
- **Priority:** P2
- **Type:** Functional
- **Steps → Expected:**
  1. Create several orders → **Expected:** every `orderNo` matches `/^RF-\d{6}$/` (e.g. `RF-482913`) and is unique; collisions are retried up to 6 times.

### TC-WHK-034: Oversell guard — decrement requires stock ≥ qty
- **Priority:** P0
- **Type:** Concurrency
- **Preconditions:** Variant stock = 1; an order requests qty 2.
- **Steps → Expected:**
  1. Attempt to mark that order paid → **Expected:** per-line `updateMany where stock >= qty` matches 0 rows → `count !== 1` → throws `OutOfStockError`; for card capture this triggers refund+cancel, for admin PATCH it returns 409. Stock never goes negative.

### TC-WHK-035: Concurrent orders for the last unit — first wins
- **Priority:** P0
- **Type:** Concurrency
- **Preconditions:** Variant stock = 1; two pending orders each for that 1 unit.
- **Steps → Expected:**
  1. Mark both paid concurrently (two webhooks / two PATCHes) → **Expected:** exactly one succeeds (stock → 0); the other hits the `stock >= qty` guard → `OutOfStockError` (refund+cancel for card, 409 for admin). No oversell; stock = 0.

### TC-WHK-036: Concurrent duplicate webhooks for the same order → single decrement
- **Priority:** P0
- **Type:** Concurrency
- **Preconditions:** Pending order, stock 25, 1 unit.
- **Steps → Expected:**
  1. Fire two identical `approved` webhooks simultaneously → **Expected:** the atomic `updateMany` claim lets only one transition succeed; stock decremented once (25 → 24); the other returns `transitioned:false`; both HTTP 200.

### TC-WHK-037: Stock to exactly zero, then next order is rejected
- **Priority:** P1
- **Type:** Boundary
- **Preconditions:** Variant stock = 1.
- **Steps → Expected:**
  1. Complete a paid order for that last unit → **Expected:** stock = 0; variant size button shows "Sin stock" / disabled on the landing (Module 2).
  2. Attempt a new quote/order for the same variant → **Expected:** 409 `QuoteError` (no stock).
