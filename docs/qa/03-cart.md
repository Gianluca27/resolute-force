# Module 3 — Cart

> Client-side cart for the Resolute Force store: the Zustand store (`apps/web/src/store/cart.ts`, persisted to `localStorage["rf-cart"]`), the slide-in cart drawer (`CartDrawer.tsx`), the add-to-cart entry point on each product card (`ProductCard.tsx`), and the cart badge in the nav. This module tests **the shipped client behavior only** — stock and price are never enforced here; the server is authoritative and only rejects later at quote/order (Module 4 & 5). See [README](README.md) for setup, the canonical seed data, money formatting, and conventions; this file does not repeat them.

**Coverage checklist:**
- Add: single item; same product+size merges qty; same product+different size makes a 2nd line; different products; multiple products in sequence.
- Drawer always opens on add; toast content + auto-clear; badge increments and hides at 0.
- Quantity: `inc` (no upper bound), `dec` from >1, `dec` from 1 removes the line, `remove`, removing the last line shows empty state, `clear` (after order).
- Totals: subtotal math + es-AR formatting; per-line price display (`qty × unit`, candidate defect CD-3); "Envío" copy.
- Persistence across reload (items survive, drawer/checkout closed); `reconcile` drops deleted/inactive products and refreshes price/labels while keeping qty.
- Stock gating at the add entry: sold-out product, sold-out size, default selected size = first in-stock.
- Boundary & resilience: very large qty (999), qty via repeated `inc`, qty above seed stock allowed client-side, corrupt `rf-cart` JSON, tampered persisted values.
- Accessibility (aria-labels, keyboard) and responsive (mobile drawer width, empty-state CTA, overlay/z-index).

> **Inspecting state:** open DevTools → Application → Local Storage → `http://localhost:5173` → key `rf-cart`. The persisted value is `{"state":{"items":[...]},"version":0}` — only `items` is persisted (`partialize`); `open`/`checkoutOpen` are not. The drawer header count and badge both read `cartCount = Σ qty`. The cart line `key` is `` `${productId}-${size}` `` where `productId` is the product **cuid** (not the slug).

---

## A. Adding items to the cart

### TC-CART-001: Add a single product to an empty cart
- **Priority:** P0
- **Type:** Functional
- **Preconditions:** Fresh DB (seeded), web app at `/`, cart empty (`rf-cart` absent or `items:[]`).
- **Steps → Expected:**
  1. Scroll to the "Champion Mentality / Azul Marino" product card; leave the default size selected (M) → **Expected:** size M button is the active (filled) one; "Agregar" button enabled.
  2. Click "Agregar" → **Expected:** the cart drawer slides in from the right; one line item is shown: image, line `CHAMPION MENTALITY` (uppercase), `Azul Marino · Talle M`, qty `1`, per-line price `1 × $30.000`.
  3. Observe the nav badge and the drawer header → **Expected:** badge (`data-testid="cart-badge"`) shows `1`; drawer header reads `Tu carrito (1)`; footer Subtotal `$30.000`.
  4. Observe the toast near the bottom of the screen → **Expected:** toast reads `Champion Mentality · Azul Marino (M)`.
- **Notes:** `add()` always sets `open:true`. Toast text = `` `${line} · ${color} (${size})` ``.

### TC-CART-002: Add the same product + same size twice → quantity merges
- **Priority:** P0
- **Type:** Functional
- **Preconditions:** Cart empty.
- **Steps → Expected:**
  1. On the Azul Marino card with size M, click "Agregar" → **Expected:** drawer shows 1 line, qty `1`.
  2. Click "Agregar" again on the same card/size (drawer may be open; click through or close it first) → **Expected:** still **one** line item, qty now `2`, per-line price `2 × $30.000`, Subtotal `$60.000`, badge `2`.
- **Notes:** Merge identity is product+size (`key = id-M`). Existing line gets `qty+1`, no second line.

### TC-CART-003: Add the same product, different size → two separate lines
- **Priority:** P1
- **Type:** Functional
- **Preconditions:** Cart empty.
- **Steps → Expected:**
  1. On the Azul Marino card, select size M, click "Agregar" → **Expected:** 1 line `Talle M`, qty 1.
  2. On the same card, select size L, click "Agregar" → **Expected:** **two** distinct lines — `Azul Marino · Talle M` (qty 1) and `Azul Marino · Talle L` (qty 1); badge `2`; Subtotal `$60.000`.
- **Notes:** Keys differ (`id-M` vs `id-L`); same product, different size = two lines by design.

### TC-CART-004: Add different products → separate lines
- **Priority:** P1
- **Type:** Functional
- **Preconditions:** Cart empty.
- **Steps → Expected:**
  1. Add Azul Marino (M) → **Expected:** line 1 = `CHAMPION MENTALITY / Azul Marino · Talle M`.
  2. Add Stop at Nothing Blanco (M) → **Expected:** line 2 = `STOP AT NOTHING / Blanco · Talle M`; two lines total; badge `2`; Subtotal `$60.000`.
- **Notes:** Lines are keyed by product id, so different products never merge.

### TC-CART-005: Add from several product cards in sequence
- **Priority:** P2
- **Type:** Functional
- **Preconditions:** Cart empty; all 4 seed products in stock.
- **Steps → Expected:**
  1. Add one of each: Azul Marino (M), Negro (M), Verde Militar (M), Blanco (M) → **Expected:** 4 distinct lines; badge `4`; Subtotal `$120.000`.
  2. Add Azul Marino (M) once more → **Expected:** Azul Marino line qty → 2; still 4 lines; badge `5`; Subtotal `$150.000`.

### TC-CART-006: Drawer opens automatically on every add
- **Priority:** P2
- **Type:** UI
- **Preconditions:** Cart with at least one item; drawer currently **closed**.
- **Steps → Expected:**
  1. Close the drawer (click the overlay or the "Cerrar" button) → **Expected:** drawer hidden, items intact, badge unchanged.
  2. Add any product → **Expected:** drawer re-opens automatically (`add()` forces `open:true`), showing the updated lines.
- **Notes:** There is no "add silently" path; every add opens the drawer.

### TC-CART-007: Add toast content and auto-dismiss
- **Priority:** P3
- **Type:** UI
- **Preconditions:** Cart empty.
- **Steps → Expected:**
  1. Add Verde Militar in size XL → **Expected:** toast reads exactly `Champion Mentality · Verde Militar (XL)`.
  2. Wait ~2.4 s without interacting → **Expected:** toast auto-clears (disappears) after 2400 ms.
  3. Add two products quickly in succession → **Expected:** toast text updates to the latest add; the 2400 ms timer resets on each add (only the most recent message shows).

### TC-CART-008: Cart badge increments with count and hides at zero
- **Priority:** P1
- **Type:** UI
- **Preconditions:** Cart empty.
- **Steps → Expected:**
  1. With an empty cart, inspect the nav → **Expected:** no badge element rendered (`queryByTestId('cart-badge')` returns nothing; badge shows only when `cartCount > 0`).
  2. Add 3 units total (e.g. Azul Marino M ×2 + Negro M ×1) → **Expected:** badge shows `3`.
  3. Remove all items until cart is empty → **Expected:** badge disappears again (not `0` shown — element removed).

---

## B. Quantity controls (stepper, remove, clear)

### TC-CART-009: Increase quantity with the "Sumar uno" stepper
- **Priority:** P1
- **Type:** Functional
- **Preconditions:** Cart has Azul Marino (M) qty 1; drawer open.
- **Steps → Expected:**
  1. Click the `+` button (aria-label "Sumar uno") on that line → **Expected:** qty → 2; per-line price `2 × $30.000`; Subtotal `$60.000`; badge `2`.
  2. Click `+` three more times → **Expected:** qty → 5; Subtotal `$150.000`; badge `5`.
- **Notes:** `inc` has **no client-side upper bound** (see TC-CART-024/026).

### TC-CART-010: Decrease quantity from above 1 with "Restar uno"
- **Priority:** P1
- **Type:** Functional
- **Preconditions:** Cart has Azul Marino (M) qty 3; drawer open.
- **Steps → Expected:**
  1. Click the `−` button (aria-label "Restar uno") once → **Expected:** qty → 2; Subtotal drops by `$30.000`.
  2. Click `−` again → **Expected:** qty → 1; line still present; Subtotal `$30.000`.

### TC-CART-011: Decrement from quantity 1 removes the line
- **Priority:** P1
- **Type:** Boundary
- **Preconditions:** Cart has Azul Marino (M) qty 1 and Negro (M) qty 1; drawer open.
- **Steps → Expected:**
  1. Click "Restar uno" on the Azul Marino line → **Expected:** the Azul Marino line is **removed** entirely (not left at qty 0); Negro line remains; badge `1`; Subtotal `$30.000`.
- **Notes:** `dec` on qty 1 returns `[]` for that line (line dropped), not qty 0.

### TC-CART-012: Remove a line with the "Quitar" button
- **Priority:** P1
- **Type:** Functional
- **Preconditions:** Cart has Azul Marino (M) qty 4 and Blanco (M) qty 1; drawer open.
- **Steps → Expected:**
  1. Click the trash button (aria-label "Quitar") on the Azul Marino line → **Expected:** the whole Azul Marino line disappears regardless of its qty (was 4); only Blanco remains; badge `1`.
- **Notes:** `remove` drops the line in one click independent of quantity.

### TC-CART-013: Removing the last line shows the empty-cart state
- **Priority:** P2
- **Type:** UI
- **Preconditions:** Cart has exactly one line (any product, any qty); drawer open.
- **Steps → Expected:**
  1. Remove that line via "Quitar" (or decrement it to removal) → **Expected:** drawer body switches to the empty state: a bag icon, the text `Tu carrito está vacío.`, and a `Ver productos` button. No subtotal/footer with the checkout button is shown.
  2. Inspect the nav → **Expected:** badge removed.

### TC-CART-014: Cart is emptied after a successful order (`clear`)
- **Priority:** P1
- **Type:** Integration
- **Preconditions:** Cart has ≥1 item; environment able to complete an order (transfer is simplest — Module 4/5).
- **Steps → Expected:**
  1. Complete a transfer order through checkout to the "¡Pedido confirmado!" screen → **Expected:** `clear()` runs; `rf-cart` `items` becomes `[]`; badge disappears.
  2. Reload the page → **Expected:** cart stays empty (empty array persisted).
- **Notes:** There is **no user-facing "vaciar carrito" / clear-all button**; `clear()` is invoked only programmatically on successful order. A `reconcile` that drops every remaining product can also empty the cart (TC-CART-019). Worth noting the absence of a manual clear control as a minor UX gap.

---

## C. Totals & per-line price display

### TC-CART-015: Subtotal math and es-AR formatting
- **Priority:** P1
- **Type:** Functional
- **Preconditions:** Cart empty.
- **Steps → Expected:**
  1. Add Azul Marino (M) ×2 and Negro (L) ×1 → **Expected:** Subtotal = `Σ price×qty` = `3 × 30000` = `$90.000` (dot thousands separator, no centavos).
  2. Increment the Negro line by 1 → **Expected:** Subtotal updates live to `$120.000`.
- **Notes:** `cartSubtotal = Σ price*qty`. Formatting via `money()` = `'$' + Math.round(n).toLocaleString('es-AR')`. This is a **client display only**; server recomputes at quote.

### TC-CART-016: Per-line price renders `qty × unit`, not the line total (CD-3)
- **Priority:** P2
- **Type:** UI
- **Preconditions:** Cart has Azul Marino (M); drawer open.
- **Steps → Expected:**
  1. Increment that line to qty 2 → **Expected:** the per-line price text on the right of the line reads **`2 × $30.000`** (quantity × unit price), **not** the line total `$60.000`.
- **Notes:** **Candidate defect CD-3.** The plan/expectation was a per-line subtotal (`$60.000`); shipped code renders `{qty} × {money(price)}`. Confirm the literal `2 × $30.000` and file CD-3. (The footer Subtotal `$60.000` is still correct — only the per-line label diverges.)

### TC-CART-017: "Envío" footer copy
- **Priority:** P3
- **Type:** UI
- **Preconditions:** Cart has ≥1 item; drawer open.
- **Steps → Expected:**
  1. Inspect the footer between Subtotal and the button → **Expected:** a row labelled `Envío` with the value `Calculado en el checkout` rendered in gold; the primary button reads `Finalizar compra`.
- **Notes:** Shipping is never computed in the cart; it is resolved (as "Gratis") inside checkout.

---

## D. Persistence & reconcile

### TC-CART-018: Cart survives a page reload; drawer/checkout stay closed
- **Priority:** P0
- **Type:** Functional
- **Preconditions:** Cart has 2 lines; drawer **open**.
- **Steps → Expected:**
  1. With the drawer open, reload the page (F5) → **Expected:** items are restored exactly (lines, sizes, quantities, subtotal, badge), but the drawer is **closed** and no checkout modal is open.
  2. Inspect `rf-cart` in localStorage → **Expected:** persisted JSON contains only `items` (no `open`/`checkoutOpen` keys).
- **Notes:** `partialize` persists only `items`; `open`/`checkoutOpen` default to `false` on rehydrate.

### TC-CART-019: `reconcile` drops a line whose product was deleted/deactivated
- **Priority:** P1
- **Type:** Integration
- **Preconditions:** Cart has Azul Marino (M) and Blanco (M); admin access (Module 9) OR DB access.
- **Steps → Expected:**
  1. In admin, **delete** the Stop at Nothing Blanco product (or set it inactive so it leaves the public catalog list) → **Expected:** change saved.
  2. Reload the public landing page → **Expected:** on mount, `reconcile(products)` runs and the Blanco line is **dropped** from the cart (its `productId` is no longer in the live catalog); Azul Marino line remains; badge/subtotal recalculated.
- **Notes:** `reconcile` runs in a `useEffect` on Landing when product data loads. The public list endpoint returns only `active` products, so deactivation removes the line too. Cross-ref Module 1 (catalog) and Module 9 (admin products).

### TC-CART-020: `reconcile` refreshes price/labels after an admin change, keeping qty
- **Priority:** P1
- **Type:** Integration
- **Preconditions:** Cart has Azul Marino (M) qty 2 at the seed price 30000; admin/DB access.
- **Steps → Expected:**
  1. In admin, change the Azul Marino price to `35000` (and/or its color label) → **Expected:** saved.
  2. Reload the public landing page → **Expected:** `reconcile` refreshes the cart line's `price` (and `slug`/`line`/`color`/`imageUrl`) from the live catalog; the **qty stays 2**; per-line shows `2 × $35.000`; Subtotal `$70.000`.
- **Notes:** `reconcile` updates metadata + price but never touches `qty`. This is why a stale persisted price can never reach the server — the server re-prices at quote anyway (Module 4).

---

## E. Stock gating at the add entry point

### TC-CART-021: A sold-out product cannot be added
- **Priority:** P1
- **Type:** Negative
- **Preconditions:** One product with **all four variants at stock 0** (set via admin or DB; e.g. zero out S/M/L/XL of Verde Militar).
- **Steps → Expected:**
  1. Open the landing and locate that product card → **Expected:** every size button is disabled (line-through, `title="Sin stock"`); the add button is disabled and labelled `Sin stock` (not `Agregar`).
  2. Attempt to click the add button → **Expected:** nothing happens; no line added; no toast; badge unchanged (`canAdd` is false because `soldOut` and no selectable size).

### TC-CART-022: A sold-out individual size is disabled
- **Priority:** P2
- **Type:** Negative
- **Preconditions:** Product with **size M at stock 0** but S/L/XL in stock (e.g. zero only M of Azul Marino).
- **Steps → Expected:**
  1. Inspect the size buttons on that card → **Expected:** M is disabled, struck through, with `title="Sin stock"`; S/L/XL are enabled.
  2. Confirm the default selected size → **Expected:** selection defaults to the first in-stock size (S, since M is out), not M.
  3. Try to click M → **Expected:** no selection change (button disabled). Add with S → **Expected:** line `Talle S` added normally.

### TC-CART-023: Default selected size is the first in-stock size
- **Priority:** P2
- **Type:** Boundary
- **Preconditions:** Product where S is out of stock but M is in stock.
- **Steps → Expected:**
  1. Open the card without clicking any size → **Expected:** M is pre-selected (active/filled), because `firstInStock = sizes.find(stock>0)`.
  2. Click "Agregar" without manually choosing a size → **Expected:** the line added uses M.
- **Notes:** If every size is out, `firstInStock = ''` → `canAdd` is false (covered by TC-CART-021).

---

## F. Boundary values & resilience

### TC-CART-024: Very large quantity (999) is allowed in the cart
- **Priority:** P2
- **Type:** Boundary
- **Preconditions:** Cart has Azul Marino (M) qty 1; DevTools access.
- **Steps → Expected:**
  1. In `rf-cart`, set that item's `qty` to `999` (edit the JSON) and reload, OR click "Sumar uno" up to 999 → **Expected:** cart accepts qty 999; per-line `999 × $30.000`; Subtotal `$29.970.000`; badge `999`.
  2. Note that seed stock is only 25 → **Expected:** the cart still shows 999 — there is **no client-side stock or max-quantity check**. Rejection happens only later at "Continuar al pago" (quote `409`, Module 4) or at payment.
- **Notes:** Documents the deliberate absence of any client cap. The risk (overselling) is mitigated server-side only.

### TC-CART-025: Build a large quantity via repeated `inc`
- **Priority:** P3
- **Type:** Boundary
- **Preconditions:** Cart has one line, qty 1.
- **Steps → Expected:**
  1. Click "Sumar uno" 30 times → **Expected:** qty reaches 30 with no cap, no error, no warning, even though it exceeds the seed stock of 25.
- **Notes:** Confirms `inc` is unbounded on the client; complements TC-CART-024.

### TC-CART-026: Quantity above available stock is allowed until quote
- **Priority:** P1
- **Type:** Integration
- **Preconditions:** Azul Marino M stock = 25 (seed); cart has Azul Marino (M).
- **Steps → Expected:**
  1. Increment that line to qty 26 (above stock) → **Expected:** cart accepts 26, Subtotal `$780.000`, no error in the cart.
  2. Proceed to checkout and click "Continuar al pago" → **Expected:** the quote returns `409` and checkout stays on step 0 with a stock error (asserted in Module 4 / TC-CHK-023). The cart itself never blocked it.
- **Notes:** This is the key separation: the cart is optimistic; stock is enforced only at the server boundary.

### TC-CART-027: Corrupt `rf-cart` JSON does not crash the app
- **Priority:** P2
- **Type:** Negative
- **Preconditions:** DevTools access.
- **Steps → Expected:**
  1. Set `localStorage["rf-cart"]` to a non-JSON / truncated string (e.g. `{"state":{"items":[`) and reload → **Expected:** the app loads normally with an **empty** cart (corrupt persisted state is ignored by the persist middleware); no white-screen / uncaught exception; the landing renders.
  2. Add a product → **Expected:** cart works normally and `rf-cart` is rewritten with valid JSON.
- **Notes:** A console warning from the persist layer is acceptable; a crash or blank page is a defect.

### TC-CART-028: Tampered persisted item values (negative / huge / unknown product)
- **Priority:** P2
- **Type:** Security
- **Preconditions:** DevTools access.
- **Steps → Expected:**
  1. Hand-edit `rf-cart` so one item has `qty: -5`, and add a second item with a `productId` that does not exist in the catalog; reload → **Expected:** the page does not crash. The bogus-product line is dropped on the Landing `reconcile`; the negative-qty line is restored verbatim by the store (no rehydrate validation), so the cart may show a negative qty/subtotal until corrected.
  2. Attempt to check out with the tampered values → **Expected:** the server rejects them — quote schema requires `qty` integer ≥ 1, so a forced negative/zero/decimal qty yields `400 Items inválidos` (Module 4 / TC-CHK-028). No oversell or negative charge reaches an order.
- **Notes:** Client trusts persisted state; the server is the only validation gate. Record any user-visible glitch (e.g. `$-150.000`) as a minor UI issue, but the security-relevant outcome is the server rejection.

### TC-CART-029: Empty-cart initial state renders correctly
- **Priority:** P3
- **Type:** UI
- **Preconditions:** Cart empty; open the drawer (e.g. add then remove the only item, or trigger `setOpen(true)`).
- **Steps → Expected:**
  1. View the open drawer with no items → **Expected:** header `Tu carrito (0)`, bag icon, text `Tu carrito está vacío.`, and a `Ver productos` button; no footer/subtotal/checkout button.

---

## G. Accessibility & responsive

### TC-CART-030: Accessible names on all interactive cart controls
- **Priority:** P1
- **Type:** Accessibility
- **Preconditions:** Cart has ≥1 line; drawer open; screen reader or the a11y inspector.
- **Steps → Expected:**
  1. Inspect the drawer controls → **Expected:** the close button exposes aria-label `Cerrar`; the line remove button `Quitar`; the decrement `Restar uno`; the increment `Sumar uno`. Each is a real `<button>` reachable in the accessibility tree.
  2. Inspect the product image inside the line → **Expected:** decorative image has empty `alt=""` (not announced), which is acceptable since the line text carries the product name.
- **Notes:** Quantity is shown as plain text between the two stepper buttons; verify a screen reader can read the current qty after a change (it is not in an `aria-live` region — note if the change is not announced).

### TC-CART-031: Keyboard operation of the drawer
- **Priority:** P2
- **Type:** Accessibility
- **Preconditions:** Cart has a line at qty 2; drawer open; mouse not used.
- **Steps → Expected:**
  1. Press Tab to move focus through the drawer → **Expected:** focus reaches close, remove, "Restar uno", "Sumar uno", and "Finalizar compra" in a sensible order; focus indicator visible.
  2. With focus on "Sumar uno", press Enter/Space → **Expected:** qty increments. On "Restar uno", Enter/Space decrements. On the close button, activates close.
  3. Note any focus-trap behavior → **Expected:** document whether focus is trapped within the drawer and whether `Esc` closes it (the overlay click closes it; record if `Esc` does not — that is an a11y gap to flag).

### TC-CART-032: Mobile drawer width and layout
- **Priority:** P2
- **Type:** Responsive
- **Preconditions:** Cart has 2 lines.
- **Steps → Expected:**
  1. Resize viewport to 360 × 640 (mobile) and open the drawer → **Expected:** panel width = `min(420px, 92vw)` ≈ 331 px on a 360 px viewport, anchored right, full height; lines, stepper, and footer remain readable and tappable; no horizontal overflow.
  2. Resize to ≥ 460 px wide → **Expected:** panel caps at 420 px.

### TC-CART-033: "Ver productos" in the empty state closes the drawer
- **Priority:** P3
- **Type:** UI
- **Preconditions:** Drawer open on the empty-cart state.
- **Steps → Expected:**
  1. Click `Ver productos` → **Expected:** the drawer closes (`setOpen(false)`) and the landing/products are visible behind it. No navigation occurs (it is a single-page landing).

### TC-CART-034: Overlay click closes drawer; z-index layering is correct
- **Priority:** P3
- **Type:** UI
- **Preconditions:** Cart has ≥1 item; drawer open.
- **Steps → Expected:**
  1. Click the dimmed overlay area to the left of the panel → **Expected:** drawer closes; items unchanged.
  2. While open, confirm stacking → **Expected:** overlay sits above the page (z-290) and the panel above the overlay (z-300); the panel is fully interactive and the page behind is not.
