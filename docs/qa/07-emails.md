# Module 7 — Emails (admin + customer)

> Transactional email: the admin "new order" notification and the customer confirmation/transfer-instructions email. Covers the Nodemailer transport (enable / no-op), every trigger (card-approved, wallet/MP-webhook-approved, new transfer order, admin mark-paid/shipped), idempotency ("fires exactly once"), failure isolation (`Promise.allSettled`, fire-and-forget), content/format of both emails, the transfer **bank block** (incl. the empty-by-default gotcha **CD-11**), totals per payment method, and HTML-injection escaping. Tests the **shipped code** in `apps/api/src/lib/mailer.ts`, `apps/api/src/services/notify.ts`, and the call sites in `services/orders.ts` / `routes/orders.ts` / `routes/payments.ts`. See the [README](README.md) for setup, seed data, and money/locale rules — referenced here, not repeated.

### How to observe emails in manual QA
The mailer **only delivers** when `SMTP_HOST` **and** `SMTP_USER` are both non-empty (`mailer.ts` line 4). Otherwise every send silently no-ops. Pick an observation method per case:
- **SMTP catcher (read real HTML):** point env at MailHog or Mailtrap, e.g. `SMTP_HOST=localhost`, `SMTP_PORT=1025`, `SMTP_USER=dev`, `SMTP_PASS=dev`, `MAIL_FROM="Resolute Force <no-reply@resolute.test>"`; inbox UI at `http://localhost:8025`. Restart the API after editing `.env`.
- **Skip log (which mail *would* fire + to whom):** leave SMTP unset; the API console prints `[mail:skipped] <subject> -> <to|(no recipient)>` per attempted send (suppressed only under `NODE_ENV=test`).
- **"Fires exactly once" / call-count assertions:** easiest via the automated suite, which mocks `sendMail` and asserts `toHaveBeenCalledTimes(...)`. Manual equivalent: count messages landing in the catcher.
- `ADMIN_NOTIFY_EMAIL` must be non-empty to receive the **admin** copy; the **customer** copy goes to `order.customerEmail`.

**Coverage checklist:**
- [ ] Mailer disabled when SMTP unset → no-op + `[mail:skipped]` log (MAIL-001, 002)
- [ ] Mailer enabled when both vars set → real delivery; `secure` only at port 465; `from` = `MAIL_FROM` (MAIL-003, 004, 005)
- [ ] `sendMail` no-ops on empty recipient; skip log suppressed under `NODE_ENV=test` (MAIL-006, 007)
- [ ] Triggers fire paid emails: card approved, wallet/webhook approved, admin mark-paid, admin mark-shipped (MAIL-008–011)
- [ ] Reversal (refund/chargeback/cancel) sends a customer+admin **cancellation** email (not the paid email), once even under double reversal; out-of-stock card capture → NO email (MAIL-012, 012b, 013)
- [ ] Idempotency: fires exactly once on transition; replay/duplicate → no second email; same-status save → none (MAIL-014, 015, 016)
- [ ] Admin email recipient/subject/body; empty `ADMIN_NOTIFY_EMAIL` skips it; phone `—` when absent (MAIL-017, 018, 019)
- [ ] Customer email recipient/subject/body/footer; totals per method; items table (MAIL-020, 021, 022)
- [ ] Transfer bank block: present by default (seed placeholder alias), absent once alias cleared **CD-11**; present when alias set; CBU conditional; amount = transfer total (MAIL-023, 023b, 024–026)
- [ ] Failure isolation: never blocks payment; `allSettled` isolates admin vs customer; no retry (MAIL-027, 028, 029)
- [ ] Security: `escapeHtml` neutralizes injection; all four chars escaped; invalid customer email blocked upstream (MAIL-030, 031, 032)

---

## Mailer transport — enable / no-op / config

### TC-MAIL-001: Mailer disabled when SMTP_HOST and SMTP_USER are both empty
- **Priority:** P1
- **Type:** Functional
- **Preconditions:** Seeded DB. `apps/api/.env` has `SMTP_HOST` and `SMTP_USER` empty/unset. API restarted. `ADMIN_NOTIFY_EMAIL` set to any address.
- **Steps → Expected:**
  1. Place a transfer order via `POST /api/orders/transfer` with valid seed items + customer → **Expected:** HTTP 200 with order number; order persists.
  2. Watch the API console → **Expected:** two `[mail:skipped] <subject> -> <to>` lines print (one for admin subject `Pedido RF-...`, one for customer subject `Resolute Force — Pedido RF-...`); **no** exception, no SMTP connection attempted.
  3. Confirm no message arrives anywhere → **Expected:** `sendMail` resolved as a no-op (`transporter` is `null`).
- **Notes:** `enabled = Boolean(env.SMTP_HOST && env.SMTP_USER)`. Order creation and the API response must NOT be affected by the mailer being off.

### TC-MAIL-002: Mailer stays disabled when only ONE of SMTP_HOST / SMTP_USER is set
- **Priority:** P2
- **Type:** Boundary
- **Preconditions:** Seeded DB.
- **Steps → Expected:**
  1. Set `SMTP_HOST=localhost` but leave `SMTP_USER` empty; restart; trigger any email (e.g. transfer order) → **Expected:** mailer disabled (`transporter === null`); `[mail:skipped]` logged; no delivery.
  2. Reverse it: `SMTP_USER=dev`, `SMTP_HOST` empty; restart; trigger again → **Expected:** still disabled; `[mail:skipped]` logged; no delivery.
- **Notes:** Both vars must be truthy (`&&`). This is a common misconfiguration — one var set gives a false sense the mailer is on.

### TC-MAIL-003: Mailer enabled and delivers when both SMTP vars are set
- **Priority:** P0
- **Type:** Integration
- **Preconditions:** SMTP catcher running (MailHog/Mailtrap). `SMTP_HOST`, `SMTP_USER` (and `SMTP_PORT`, `SMTP_PASS`, `MAIL_FROM`) set; API restarted. `ADMIN_NOTIFY_EMAIL` set.
- **Steps → Expected:**
  1. Place a transfer order → **Expected:** two real messages land in the catcher inbox: admin copy to `ADMIN_NOTIFY_EMAIL`, customer copy to the order email.
  2. Inspect message source → **Expected:** HTML body renders; no `[mail:skipped]` log for these sends.
- **Notes:** This is the prerequisite environment for all content cases (MAIL-017–032).

### TC-MAIL-004: `secure` transport flag is true only at port 465
- **Priority:** P2
- **Type:** Boundary
- **Preconditions:** SMTP catcher reachable; mailer enabled.
- **Steps → Expected:**
  1. Set `SMTP_PORT=465`, restart, attempt a send → **Expected:** transport created with `secure: true` (implicit TLS). Delivery succeeds only against a 465/TLS endpoint.
  2. Set `SMTP_PORT=587` (or 1025), restart, attempt a send → **Expected:** `secure: false` (STARTTLS/plain). Delivery succeeds against the catcher.
- **Notes:** `secure: env.SMTP_PORT === 465`. Strict equality — a string `"465"` would not match `465`; verify env is parsed to a number.

### TC-MAIL-005: From address equals MAIL_FROM
- **Priority:** P2
- **Type:** Functional
- **Preconditions:** Mailer enabled; `MAIL_FROM="Resolute Force <no-reply@resolute.test>"`.
- **Steps → Expected:**
  1. Trigger any email; open it in the catcher → **Expected:** `From` header equals the configured `MAIL_FROM` verbatim for both admin and customer copies.
- **Notes:** `sendMail` passes `from: env.MAIL_FROM`. If `MAIL_FROM` is empty, the send may be rejected by the SMTP server — note as a config-validation gap if so.

### TC-MAIL-006: sendMail no-ops when recipient is empty even with transport enabled
- **Priority:** P1
- **Type:** Negative
- **Preconditions:** Mailer enabled (both SMTP vars set). `ADMIN_NOTIFY_EMAIL` set to empty string.
- **Steps → Expected:**
  1. Trigger a paid email (e.g. card-approved order) → **Expected:** the **admin** send no-ops because `notifyAdmin` early-returns on empty `ADMIN_NOTIFY_EMAIL` (so `sendMail` is never even called for admin); the **customer** send delivers normally.
  2. Force an empty `to` reaching `sendMail` (e.g. blank `customerEmail` in DB if reproducible) → **Expected:** `sendMail` returns early (`!opts.to`), no SMTP send, no error.
- **Notes:** `sendMail` guards `if (!transporter || !opts.to) return`. Empty recipient is treated as "skip", never an error.

### TC-MAIL-007: Skip log is suppressed under NODE_ENV=test
- **Priority:** P3
- **Type:** Functional
- **Preconditions:** SMTP unset (mailer disabled). Run under `NODE_ENV=test` (e.g. the vitest suite).
- **Steps → Expected:**
  1. Execute a flow that attempts a send → **Expected:** `sendMail` no-ops but does **not** print `[mail:skipped]` (the `console.log` is gated by `env.NODE_ENV !== 'test'`).
  2. Repeat under `NODE_ENV=development` → **Expected:** `[mail:skipped]` IS printed.
- **Notes:** Keeps test output clean. Pure logging behavior; no functional impact.

---

## Email triggers — when paid emails fire

### TC-MAIL-008: Card-approved payment fires both paid emails; customer email has NO bank block
- **Priority:** P0
- **Type:** Integration
- **Preconditions:** Mailer enabled (catcher). `ADMIN_NOTIFY_EMAIL` set. MP TEST credentials. Use an **approved** test card.
- **Steps → Expected:**
  1. Complete a card checkout that returns `status: 'approved'` (`POST /api/payments/card`) → **Expected:** order transitions to `paid`; exactly two messages arrive — admin copy + customer copy.
  2. Inspect the customer email → **Expected:** subject `Resolute Force — Pedido RF-######`; body shows `Pago: card`; **no** bank block (card path passes no `bank` to `notifyCustomer`).
  3. Inspect the admin email → **Expected:** header `🔥 Nuevo pedido RF-###### (paid)`.
- **Notes:** Card flow → `confirmOrRefund` → `markPaidByOrderNo` → `notifyOrderPaid`. The payment HTTP response returns before/independent of email delivery.

### TC-MAIL-009: Wallet / MP webhook approved payment fires both paid emails
- **Priority:** P0
- **Type:** Integration
- **Preconditions:** Mailer enabled. A `wallet` order created via `POST /api/payments/preference` and still `pending`. MP webhook reachable; if `MP_WEBHOOK_SECRET` set, send a valid signature.
- **Steps → Expected:**
  1. Deliver a `type=payment` webhook whose MP payment `status=approved` and `externalReference` = the order number → **Expected:** order → `paid`; two paid emails delivered (admin + customer).
  2. Customer email body → **Expected:** `Pago: wallet`, no bank block, header/footer correct.
- **Notes:** Webhook → `confirmOrRefund` → `markPaidByOrderNo` → `notifyOrderPaid`. Same paid-email path as the card flow; only the trigger differs.

### TC-MAIL-010: Admin marking a pending order as paid fires the paid emails
- **Priority:** P1
- **Type:** Integration
- **Preconditions:** Mailer enabled. A `pending` order exists (e.g. a transfer order). Valid admin token.
- **Steps → Expected:**
  1. `PATCH /api/admin/orders/:id/status` with `{status:'paid'}` → **Expected:** order → `paid`; two paid emails delivered.
  2. Admin email header → **Expected:** `🔥 Nuevo pedido RF-###### (paid)`.
- **Notes:** Admin status change from a non-held state into a held state routes through `markPaidByOrderNo`, which is what emits `notifyOrderPaid`. Confirms the customer gets a confirmation when the shop owner reconciles a transfer.

### TC-MAIL-011: Admin marking a pending order as shipped fires the paid emails
- **Priority:** P1
- **Type:** Integration
- **Preconditions:** Mailer enabled. A `pending` order exists. Valid admin token.
- **Steps → Expected:**
  1. `PATCH /api/admin/orders/:id/status` with `{status:'shipped'}` (jumping straight from `pending`) → **Expected:** order → `shipped`; because the transition crosses into a stock-held state it first calls `markPaidByOrderNo` → paid emails fire (two messages).
- **Notes:** `changeOrderStatus`: `!STOCK_HELD(from) && STOCK_HELD(to)` → `markPaidByOrderNo` then lands on `shipped`. So a pending→shipped jump still sends the "paid" email exactly once. Verify the email content shows the order; the admin header reflects the order status at load time.

### TC-MAIL-012: Webhook reversal (refunded / charged_back / cancelled) sends NO paid email
- **Priority:** P1
- **Type:** Negative
- **Preconditions:** Mailer enabled. A `paid` order exists. Webhook reachable (valid signature if secret set).
- **Steps → Expected:**
  1. Deliver a webhook whose MP payment `status` ∈ `{refunded, charged_back, cancelled}` for that order → **Expected:** order is restocked and set `cancelled` via `reverseOrderIfPaid`; **no** email is sent (the reversal path does not call any notify).
- **Notes:** Only `markPaidByOrderNo`'s transition emits email. Reversals are silent to the customer by design — note as a UX gap if a "cancelled/refunded" notice is expected, but per shipped code no email is correct.

### TC-MAIL-013: Out-of-stock at card capture (refund + cancel) sends NO paid email
- **Priority:** P0
- **Type:** Negative
- **Preconditions:** Mailer enabled. Drive a stock race so the last unit is taken between quote and capture (e.g. set a variant `stock=1`, then two concurrent approved card payments for that variant — see Module 6 for the race recipe).
- **Steps → Expected:**
  1. Let one card payment win and the other hit `OutOfStockError` during `markPaidByOrderNo` → **Expected:** the losing order is refunded and set `cancelled`; response `status:'refunded'`. **No** paid email is sent for that order (the transaction throws before reaching the `if (transitioned)` notify block).
  2. The winning order → **Expected:** exactly one set of paid emails (admin + customer).
- **Notes:** `markPaidByOrderNo` throws inside the `$transaction`, so `transitioned` is never `true` for the loser → `notifyOrderPaid` never runs. Critical: a refunded customer must NOT receive a "thanks for your paid order" email.

---

## Idempotency — fires exactly once

### TC-MAIL-014: Paid email fires exactly once on the paid transition
- **Priority:** P0
- **Type:** Functional
- **Preconditions:** Mailer enabled (or use the mocked suite asserting call counts). One `pending` order.
- **Steps → Expected:**
  1. Trigger the paid transition once (card approve, or webhook approve, or admin mark-paid) → **Expected:** `notifyOrderPaid` runs once → exactly one admin message and one customer message (`toHaveBeenCalledTimes(1)` per recipient in the automated wiring test).
- **Notes:** The atomic claim `updateMany({status: notIn[paid,shipped]})` returns `count===1` exactly once; `transitioned` true → single notify dispatch.

### TC-MAIL-015: Replayed / duplicate approved webhook does NOT send a second email
- **Priority:** P0
- **Type:** Negative
- **Preconditions:** Mailer enabled. An order already `paid`. Webhook reachable.
- **Steps → Expected:**
  1. Re-deliver the same `status=approved` webhook for the already-paid order (MP retries are normal) → **Expected:** atomic claim matches `count===0` (status already in `{paid,shipped}`); `transitioned===false`; `notifyOrderPaid` is NOT called → **no** second email.
  2. Inbox count → **Expected:** still exactly one admin + one customer message from the original transition.
- **Notes:** Idempotency is the guard against MP webhook retries spamming the customer. This is the key "no double email" case.

### TC-MAIL-016: Admin saving the same status again sends no email
- **Priority:** P2
- **Type:** Negative
- **Preconditions:** Mailer enabled. A `paid` order. Valid admin token.
- **Steps → Expected:**
  1. `PATCH /api/admin/orders/:id/status` with `{status:'paid'}` on an already-`paid` order → **Expected:** `changeOrderStatus` short-circuits on `from === to` and returns the order without re-running `markPaidByOrderNo` → no email.
- **Notes:** Also covers `shipped`→`shipped`. No transition, no notify.

---

## Admin email — recipient, subject, body

### TC-MAIL-017: Admin email — recipient, subject format, and body fields
- **Priority:** P1
- **Type:** Functional
- **Preconditions:** Mailer enabled; `ADMIN_NOTIFY_EMAIL` set. Place an order with known data (e.g. customer "Lucía", phone present, 1× Champion Mentality Azul Marino talle M).
- **Steps → Expected:**
  1. Open the admin copy → **Expected:** `To` = `ADMIN_NOTIFY_EMAIL`.
  2. Check the subject → **Expected:** `Pedido RF-###### — <customerName> ($<total>)`, e.g. `Pedido RF-000123 — Lucía ($30.000)` (em-dash separators; total via `fmt`).
  3. Check the body → **Expected:** header `🔥 Nuevo pedido RF-###### (<status>)`; `Cliente: <name> · <email> · <phone>`; `Envío: <address>, <city>`; `Pago: <paymentMethod> · Total: $<total>`; followed by the items table.
- **Notes:** `paymentMethod` is the raw value (`transfer`/`card`/`wallet`), not localized. `(<status>)` reflects DB status at send time — `(paid)` for paid triggers, `(pending)` for a new transfer order.

### TC-MAIL-018: Empty ADMIN_NOTIFY_EMAIL skips the admin email but customer still receives theirs
- **Priority:** P1
- **Type:** Negative
- **Preconditions:** Mailer enabled. `ADMIN_NOTIFY_EMAIL` = empty string.
- **Steps → Expected:**
  1. Trigger any email flow (paid or transfer) → **Expected:** `notifyAdmin` early-returns (no admin message); the customer message is still delivered to `order.customerEmail`.
  2. Inbox → **Expected:** exactly one message (customer), zero admin.
- **Notes:** `notifyAdmin` first line: `if (!env.ADMIN_NOTIFY_EMAIL) return;`. Because the two sends run under `Promise.allSettled`, skipping admin never affects the customer send.

### TC-MAIL-019: Phone shows the em-dash placeholder when customerPhone is absent
- **Priority:** P2
- **Type:** Boundary
- **Preconditions:** Mailer enabled; `ADMIN_NOTIFY_EMAIL` set. Place an order **without** a phone (`tel` omitted → stored `customerPhone = null`).
- **Steps → Expected:**
  1. Open the admin email `Cliente:` line → **Expected:** `<name> · <email> · —` (the `—` placeholder, since `o.customerPhone ?? '—'`).
  2. Place another order **with** a phone → **Expected:** the real phone renders in that slot.
- **Notes:** Provenance: `customerPhone ← tel || null` at order creation. Customer email does not show phone; only the admin email does.

---

## Customer email — recipient, subject, body, totals

### TC-MAIL-020: Customer email — recipient, subject, body, footer
- **Priority:** P1
- **Type:** Functional
- **Preconditions:** Mailer enabled. Place an order with known customer name.
- **Steps → Expected:**
  1. Open the customer copy → **Expected:** `To` = `order.customerEmail`; subject `Resolute Force — Pedido RF-######`.
  2. Body → **Expected:** header `¡Gracias por tu pedido, <name>!`; line `Orden RF-###### · Total $<total> · Pago: <paymentMethod>`; the items table; closing line `Champion Mentality. Stop at Nothing 🔥` (uppercase, bold).
- **Notes:** Email tagline usa el casing canónico `Stop at Nothing` (renderizado en mayúsculas por CSS `text-transform`), alineado con data/marquee/web — CD-9 resuelto.

### TC-MAIL-021: Email totals are correct per payment method
- **Priority:** P0
- **Type:** Functional
- **Preconditions:** Mailer enabled. Seed price 30000/unit, `transferDiscountPct = 10`.
- **Steps → Expected:**
  1. Card or wallet order, 1 unit → **Expected:** email `Total $30.000` (`total = totalCard = subtotal`).
  2. Transfer order, 1 unit → **Expected:** email `Total $27.000` (`total = totalTransfer = subtotal − round(subtotal·10/100)`).
  3. 2 units transfer (`subtotal 60.000`) → **Expected:** `Total $54.000`.
- **Notes:** Both admin and customer emails read `o.total`, which is method-dependent (`createOrder`). Cross-check against README pricing examples.

### TC-MAIL-022: Items table renders every line with color, size, quantity, and per-line subtotal
- **Priority:** P1
- **Type:** Functional
- **Preconditions:** Mailer enabled. Place a multi-line order, e.g. 2× Champion Mentality Negro talle L + 1× Stop at Nothing Blanco talle S.
- **Steps → Expected:**
  1. Inspect the items table (present in BOTH emails) → **Expected:** header columns `Producto | Color | Talle | Cant. | Subtotal`; one `<tr>` per line.
  2. Verify a row → **Expected:** e.g. `Champion Mentality | Negro | L | 2 | $60.000` (Subtotal column = `unitPrice × qty`, formatted `$60.000`).
- **Notes:** For a **transfer** order the per-line subtotals sum to the gross `subtotal` (e.g. $90.000), while the body `Total` shows the discounted transfer total (e.g. $81.000) — they intentionally differ; flag only if a tester expects them to match.

---

## Transfer bank block

### TC-MAIL-023: CD-11 — transfer email has NO bank block when `bankAlias` is empty
- **Priority:** P0
- **Type:** Functional
- **Preconditions:** Mailer enabled. `SiteContent.bankAlias = ""`, `bankCbu = ""` (alias cleared in admin Contenido). **NOTE:** the default seed ships a **placeholder** `bankAlias = "resolute.force"`, `bankCbu = ""` (intentional usable default, decided in REPORTE-07 H-01) — so to exercise the no-block case you must first clear the alias in Contenido. With the untouched seed the block IS present (see TC-MAIL-023b).
- **Steps → Expected:**
  1. Place a transfer order (`POST /api/orders/transfer`) with `bankAlias` empty → **Expected:** customer email delivers, but contains **no** "Para confirmar, transferí…" block (bankBlock is `''` because `bank?.bankAlias` is falsy).
  2. Consequence → **Expected:** customer receives a confirmation with a total but **no alias/CBU to pay to** — they cannot complete the transfer.
- **Notes:** **CD-11** (high value). The transfer route reads `bankAlias`/`bankCbu` from `SiteContent` at creation time and passes them through. The empty default is no longer reachable in seed (placeholder ships), but stays reachable if an admin clears the field. Same gap exists in the confirmation UI (see Module 5/11).

### TC-MAIL-023b: default seed ships a placeholder alias → bank block IS present
- **Priority:** P1
- **Type:** Functional / Data
- **Preconditions:** Mailer enabled. Untouched default seed (`bankAlias = "resolute.force"`, `bankCbu = ""`).
- **Steps → Expected:**
  1. Place a transfer order → **Expected:** customer email **includes** the bank block `…transferí $27.000 a — alias resolute.force —…` with the `· CBU …` segment omitted (`bankCbu` empty).
- **Notes:** REPORTE-07 H-01. `resolute.force` is a placeholder, not a real account — a deploy must replace it in admin Contenido before enabling transfer, or customers get instructions to pay a non-existent alias.

### TC-MAIL-024: Transfer email shows bank block once alias is set in Contenido
- **Priority:** P0
- **Type:** Functional
- **Preconditions:** Mailer enabled. In admin **Contenido**, set `bankAlias` (e.g. `resolute.mp`) and `bankCbu` (e.g. `0000003100010000000001`); save.
- **Steps → Expected:**
  1. Place a new transfer order → **Expected:** customer email contains the bank block: `Para confirmar, transferí $27.000 a — alias resolute.mp · CBU 0000003100010000000001 — y respondé este email con el comprobante.`
- **Notes:** Values are captured at order-creation time from `SiteContent`; changing them after an order won't retroactively alter that order's email. Card/wallet emails never include this block (no `bank` arg passed).

### TC-MAIL-025: CBU segment omitted when only alias is set; included when both set
- **Priority:** P2
- **Type:** Boundary
- **Preconditions:** Mailer enabled.
- **Steps → Expected:**
  1. Set `bankAlias` non-empty, `bankCbu` empty; place a transfer order → **Expected:** bank block present but the `· CBU …` segment is omitted (block ends `…alias <alias> — y respondé…`).
  2. Set both non-empty; place another → **Expected:** block includes `· CBU <cbu>`.
  3. Set `bankAlias` empty but `bankCbu` non-empty → **Expected:** **no** bank block at all (gating is on `bankAlias` only).
- **Notes:** `bank?.bankAlias ? <block with optional CBU> : ''`; CBU sub-segment gated separately on `bank.bankCbu`. A CBU-only configuration produces no instructions — flag as a config gap.

### TC-MAIL-026: Bank block amount equals the transfer total, not the gross subtotal
- **Priority:** P2
- **Type:** Functional
- **Preconditions:** Mailer enabled; `bankAlias` set. Place a transfer order for 1 unit (subtotal 30.000, transfer total 27.000).
- **Steps → Expected:**
  1. Read the bank block amount → **Expected:** `transferí $27.000` (uses `fmt(o.total)` = transfer total), matching the body `Total` line.
- **Notes:** The customer is instructed to pay the **discounted** transfer total. Mismatch between block amount and body Total would be a P0 money bug.

---

## Failure isolation & non-blocking delivery

### TC-MAIL-027: Email failure never blocks or fails the payment / order response
- **Priority:** P0
- **Type:** Integration
- **Preconditions:** Mailer "enabled" but pointed at an unreachable/invalid SMTP host (so sends reject). Valid order flow.
- **Steps → Expected:**
  1. Complete an approved card payment → **Expected:** HTTP response is `status:'approved'` with the order number, returned normally; the order is `paid` in the DB.
  2. Check logs → **Expected:** the email send error is caught and logged via `console.error('[notify:paid]', …)`; the request is unaffected (notify is fire-and-forget `void import(...).then(...).catch(...)`, dispatched after the payment transaction commits).
- **Notes:** Critical separation of concerns: a mail outage must never lose a sale or 500 the buyer. Transfer path logs `[notify:transfer]` instead.

### TC-MAIL-028: allSettled isolates admin-vs-customer failures
- **Priority:** P1
- **Type:** Integration
- **Preconditions:** Mailer enabled. Make exactly one recipient fail — e.g. set `ADMIN_NOTIFY_EMAIL` to an address the SMTP server rejects, while the customer address is valid (or vice versa).
- **Steps → Expected:**
  1. Trigger a paid (or transfer) email → **Expected:** the valid recipient still receives their message; the failing one is rejected independently. One failing send never aborts the other.
- **Notes:** `Promise.allSettled([notifyAdmin(o), notifyCustomer(o)])` — neither rejection short-circuits the array. Verify the surviving email is fully intact.

### TC-MAIL-029: No retry — a failed send is attempted once and only logged
- **Priority:** P2
- **Type:** Negative
- **Preconditions:** Mailer enabled but SMTP transiently failing.
- **Steps → Expected:**
  1. Trigger one email that fails → **Expected:** exactly one send attempt; failure surfaces as a single `[notify:paid]` / `[notify:transfer]` console error; no automatic retry, no queue.
  2. Restore SMTP → **Expected:** the previously-failed message is NOT redelivered (no retry mechanism exists).
- **Notes:** Document as a known limitation: lost emails are not recovered. Manual resend = admin re-saving status only if it crosses a transition (which it won't if already paid).

---

## Security — HTML injection / escaping

### TC-MAIL-030: escapeHtml neutralizes HTML/script injection in customer-supplied fields
- **Priority:** P0
- **Type:** Security
- **Preconditions:** Mailer enabled. Place an order whose name/address/city carry HTML, e.g. name `<script>alert(1)</script>`, address `<img src=x onerror=alert(2)>`, city `A & B "Co"`. (These pass `customerSchema` if non-empty strings.)
- **Steps → Expected:**
  1. Open both emails and view the raw HTML source → **Expected:** injected markup appears **escaped** as text: `&lt;script&gt;alert(1)&lt;/script&gt;`, `&lt;img src=x onerror=alert(2)&gt;`, `A &amp; B &quot;Co&quot;` — it renders as literal text, executes nothing, and does not break the surrounding markup.
- **Notes:** `escapeHtml` is applied to `customerName`, `customerEmail`, `customerPhone`, `address`, `city`, `paymentMethod`, `status`, `orderNo`, and every item field (`line`, `color`, `size`, `qty`). The fmt'd money values are server-generated, not user input.

### TC-MAIL-031: All four special characters are escaped
- **Priority:** P1
- **Type:** Security
- **Preconditions:** Mailer enabled. Use a field containing all of `& < > "` in one string, e.g. name `Tom & "Jerry" <b>`.
- **Steps → Expected:**
  1. Inspect the rendered source → **Expected:** `&` → `&amp;`, `<` → `&lt;`, `>` → `&gt;`, `"` → `&quot;`, in that combination, with `&` replaced first so no double-encoding artifacts (e.g. NOT `&amp;lt;`).
- **Notes:** `escapeHtml` replaces `&` before the others — verify ampersands inside already-entity-looking text aren't mangled. Single quotes (`'`) are NOT escaped; acceptable since values sit in double-quoted/text contexts only.

### TC-MAIL-032: Invalid customer email is blocked at order creation — paid emails never target a bad address
- **Priority:** P1
- **Type:** Security
- **Preconditions:** API running.
- **Steps → Expected:**
  1. Attempt to create any order (transfer/card/wallet) with `email` = `not-an-email` or empty → **Expected:** HTTP 400 `{error:'Datos inválidos'}` (transfer) / `{error:'Datos de pago inválidos'}` (card) from `customerSchema` (`z.string().trim().email()`); no order is created.
  2. Confirm no email is sent → **Expected:** since no order exists, no later paid email can ever target an invalid `customerEmail`.
- **Notes:** There is no admin order-creation path, so every persisted order already has a schema-valid email. Email validity is enforced upstream, not in the mailer.
