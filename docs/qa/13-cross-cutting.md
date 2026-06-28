# Module 13 — Cross-cutting: security, rate limiting, CORS, errors, i18n, perf, visit tracking

> Scope: behaviors that apply across the whole API/web surface rather than to one feature — Helmet security headers, CORS policy, request-body limits, the two rate-limit buckets, the global error envelope and production secret-masking, production boot guards (`env.ts`), Spanish (es-AR) i18n and money formatting, public visit tracking (`POST /api/track`), MercadoPago public-key exposure (and the access-token server-only invariant), stored-XSS inertness on the public landing, unsupported-method handling, and singleton read concurrency. Setup, seed data, locale/money rules and the test-case conventions are in [README.md](README.md) and are not repeated here. Feature-specific behavior lives in its own module; this one is the safety net around all of them.

**Coverage checklist:**
- [ ] Helmet sets `X-Content-Type-Options: nosniff` and frame protection on **every** response, including errors/404
- [ ] `X-Powered-By` is never sent
- [ ] CORS echoes `Access-Control-Allow-Origin` only for the configured `PUBLIC_WEB_URL`; credentials allowed
- [ ] Disallowed `Origin` gets **no** ACAO echo; preflight `OPTIONS` is handled
- [ ] Request body `> 1mb` → `413 {error:"Solicitud demasiado grande"}`; malformed JSON → `400 {error:"JSON inválido"}` (error path respects 4xx)
- [ ] `/api` limiter: 300 ok / 301st `429 {error:"Demasiadas solicitudes. Probá de nuevo más tarde."}`; standard headers; window reset
- [ ] `/api/admin/login` limiter: 10 ok / 11th `429 {error:"Demasiados intentos de acceso. Probá de nuevo más tarde."}`
- [ ] Error envelope `{error:...}`; `NODE_ENV=production` → generic `"Error interno del servidor"` (no message/stack leak); non-prod → real message
- [ ] Global 404 `{error:"No encontrado"}` (Spanish); CD-2 resolved — global and product 404s both es-AR
- [ ] Prod boot guards: refuse boot on dev-default `JWT_SECRET`, `<32`-char secret, or placeholder `MP_ACCESS_TOKEN`; boot with real secrets
- [ ] es-AR money formatting (dot thousands) incl. large numbers; `<html lang="es-AR">`
- [ ] Visit tracking: happy / missing-path / oversized (slice 200) / malformed-type / DB-error-swallowed; always `{ok:true}`; public
- [ ] `GET /api/payments/public-key` returns only the public key; access token never client-exposed
- [ ] CD-8: injected HTML in SiteContent renders as inert text on the public landing (React escapes); stored verbatim by the API
- [ ] Unsupported HTTP method → `404`; concurrent reads don't corrupt singletons

---

## 13.1 Security headers (Helmet)

### TC-XC-001: nosniff header on a normal response
- **Priority:** P1
- **Type:** Security
- **Preconditions:** API running (`app.use(helmet())`).
- **Steps → Expected:**
  1. `curl -i http://localhost:4000/api/health` → **Expected:** response includes `X-Content-Type-Options: nosniff`.

### TC-XC-002: X-Powered-By is suppressed
- **Priority:** P2
- **Type:** Security
- **Preconditions:** API running.
- **Steps → Expected:**
  1. `curl -i http://localhost:4000/api/products` and inspect headers → **Expected:** **no** `X-Powered-By: Express` header present.
- **Notes:** Helmet disables it; avoids advertising the framework.

### TC-XC-003: Clickjacking / frame protection header present
- **Priority:** P2
- **Type:** Security
- **Preconditions:** API running.
- **Steps → Expected:**
  1. `curl -i http://localhost:4000/api/health` → **Expected:** Helmet frame protection present — `X-Frame-Options: SAMEORIGIN` (and/or a CSP `frame-ancestors` directive).
- **Notes:** Also expect related Helmet defaults (e.g. `X-DNS-Prefetch-Control`, `Strict-Transport-Security` under HTTPS). Record the full Helmet header set as a baseline.

### TC-XC-004: Security headers also present on error and 404 responses
- **Priority:** P2
- **Type:** Security
- **Preconditions:** API running.
- **Steps → Expected:**
  1. `curl -i http://localhost:4000/api/does-not-exist` (404) → **Expected:** `X-Content-Type-Options: nosniff` and no `X-Powered-By`.
  2. Trigger a `500` (e.g. `GET /api/drop` on an unseeded DB) → **Expected:** same security headers present.
- **Notes:** `helmet()` is the first middleware, so it wraps every code path including `notFound`/`errorHandler`.

---

## 13.2 CORS

### TC-XC-005: Allowed origin is echoed with credentials
- **Priority:** P1
- **Type:** Security
- **Preconditions:** API running; default `PUBLIC_WEB_URL=http://localhost:5173`.
- **Steps → Expected:**
  1. `curl -i -H "Origin: http://localhost:5173" http://localhost:4000/api/products` → **Expected:** `Access-Control-Allow-Origin: http://localhost:5173` and `Access-Control-Allow-Credentials: true`.

### TC-XC-006: Disallowed origin is not echoed
- **Priority:** P0
- **Type:** Security
- **Preconditions:** API running; default config.
- **Steps → Expected:**
  1. `curl -i -H "Origin: https://evil.example.com" http://localhost:4000/api/products` → **Expected:** the response carries **no** `Access-Control-Allow-Origin: https://evil.example.com` echo — the browser would block a cross-site read.
- **Notes:** `cors({origin: env.PUBLIC_WEB_URL})` only allows the single configured origin. (The JSON body may still be returned to a non-browser client like curl — CORS is a browser enforcement; the test is the **absence of the ACAO echo** for the bad origin.)

### TC-XC-007: Preflight OPTIONS is handled
- **Priority:** P2
- **Type:** Integration
- **Preconditions:** API running.
- **Steps → Expected:**
  1. `curl -i -X OPTIONS -H "Origin: http://localhost:5173" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: content-type, authorization" http://localhost:4000/api/checkout` → **Expected:** `2xx` (typically `204`); `Access-Control-Allow-Origin: http://localhost:5173`; `Access-Control-Allow-Methods` and `Access-Control-Allow-Headers` reflect the request.

### TC-XC-008: Same-origin / no-Origin request still works
- **Priority:** P2
- **Type:** Functional
- **Preconditions:** API running.
- **Steps → Expected:**
  1. `curl -i http://localhost:4000/api/products` (no `Origin` header, e.g. server-to-server) → **Expected:** HTTP `200` with the normal payload; request not rejected for missing Origin.

---

## 13.3 Request body & limits

### TC-XC-009: Oversized JSON body is rejected with 413
- **Priority:** P1
- **Type:** Boundary
- **Preconditions:** API running (`express.json({limit:'1mb'})`); a POST endpoint, e.g. `/api/track`.
- **Steps → Expected:**
  1. `POST /api/track` with a JSON body `> 1 MB` (e.g. `{"path":"<1.5 MB string>"}`) → **Expected:** HTTP `413 Payload Too Large`; the handler never runs.
- **Notes:** Body-parser enforces the limit before routing.

### TC-XC-010: Body just under the limit is accepted
- **Priority:** P2
- **Type:** Boundary
- **Preconditions:** API running.
- **Steps → Expected:**
  1. `POST /api/track` with a valid JSON body slightly under 1 MB → **Expected:** HTTP `200 {"ok":true}`; not `413`.
- **Notes:** Lower side of the 1 MB boundary. The stored `path` is still sliced to 200 chars (TC-XC-027).

### TC-XC-011: Malformed JSON is handled by the error path (not a crash)
- **Priority:** P2
- **Type:** Negative
- **Preconditions:** API running, `NODE_ENV` non-production.
- **Steps → Expected:**
  1. `curl -i -X POST -H "Content-Type: application/json" --data '{"path": ' http://localhost:4000/api/track` (truncated/invalid JSON) → **Expected:** HTTP `400`; body `{"error":"JSON inválido"}`; **no** HTML error page, no process crash.
- **Notes:** The body-parser `SyntaxError` reaches the global `errorHandler`, which now respects the body-parser's `4xx` status (`entity.parse.failed` → `400 "JSON inválido"`) instead of masking it as a `500`. 4xx client errors are not masked in prod (only `500`s are — TC-XC-019).

---

## 13.4 Rate limiting

### TC-XC-012: /api limiter allows 300, blocks the 301st
- **Priority:** P1
- **Type:** Security
- **Preconditions:** API running; fresh limiter window (restart API or wait 15 min); single client IP.
- **Steps → Expected:**
  1. Fire 300 requests to any `/api/...` path within 15 min → **Expected:** all succeed (no `429`).
  2. Fire the 301st → **Expected:** HTTP `429`; body `{"error":"Demasiadas solicitudes. Probá de nuevo más tarde."}`.
- **Notes:** `max:300, windowMs:15*60*1000`, applied to the whole `/api` mount. Use a loop/`ab`/`hey`; count carefully since every request (incl. health) consumes budget.

### TC-XC-013: Rate-limit standard headers present, legacy absent
- **Priority:** P2
- **Type:** Functional
- **Preconditions:** API running.
- **Steps → Expected:**
  1. `curl -i http://localhost:4000/api/health` → **Expected:** `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` headers present (standardHeaders); legacy `X-RateLimit-*` **absent** (legacyHeaders:false).

### TC-XC-014: Admin-login limiter allows 10, blocks the 11th
- **Priority:** P1
- **Type:** Security
- **Preconditions:** API running; fresh window; admin user may or may not exist.
- **Steps → Expected:**
  1. `POST /api/admin/login` 10 times (any credentials) within 15 min → **Expected:** each returns its normal auth result (e.g. `401` on wrong password), **not** `429`.
  2. 11th `POST /api/admin/login` → **Expected:** HTTP `429`; body `{"error":"Demasiados intentos de acceso. Probá de nuevo más tarde."}`.
- **Notes:** `max:10` brute-force guard on the login path specifically. Counts failed **and** successful attempts.

### TC-XC-015: Login attempts also consume the global /api budget
- **Priority:** P2
- **Type:** Integration
- **Preconditions:** API running.
- **Steps → Expected:**
  1. Observe that each `/api/admin/login` request decrements both limiter counters → **Expected:** the login bucket (10) trips first; but login calls also count toward the broader 300 `/api` cap.
- **Notes:** Both `app.use('/api', apiLimiter)` and `app.use('/api/admin/login', loginLimiter)` match login requests. Documents the stacked behavior; the 10-cap dominates.

### TC-XC-016: Rate-limit window resets after 15 minutes
- **Priority:** P2
- **Type:** Functional
- **Preconditions:** Limiter tripped (`429` observed).
- **Steps → Expected:**
  1. After a `429`, read `RateLimit-Reset` / `Retry-After`; wait out the 15-minute window → **Expected:** subsequent requests succeed again; counters reset.
- **Notes:** Long-running; can be shortened in a test build by lowering `windowMs`. Default store is in-memory, so an API restart also clears counters.

### TC-XC-017: 429 response includes retry hints
- **Priority:** P3
- **Type:** Functional
- **Preconditions:** Limiter tripped.
- **Steps → Expected:**
  1. Inspect a `429` response → **Expected:** carries `Retry-After` and/or `RateLimit-Reset`; body is the JSON `{error:...}` envelope (not HTML).

---

## 13.5 Error handling & envelope

### TC-XC-018: Thrown error produces the JSON envelope
- **Priority:** P1
- **Type:** Negative
- **Preconditions:** A code path that throws — e.g. unseeded DB so `GET /api/drop` throws; `NODE_ENV` non-production.
- **Steps → Expected:**
  1. `GET /api/drop` (unseeded) → **Expected:** HTTP `500`; body shape `{"error": <string>}`; `Content-Type: application/json`.
- **Notes:** Confirms the single-key `{error}` contract used app-wide.

### TC-XC-019: Production masks the error message (no stack/detail leak)
- **Priority:** P0
- **Type:** Security
- **Preconditions:** API started with `NODE_ENV=production` **and** valid prod secrets (so it boots — see 13.6); a throwing path available (e.g. unseeded singleton, or a forced DB error).
- **Steps → Expected:**
  1. Trigger a `500` → **Expected:** body is exactly `{"error":"Error interno del servidor"}`.
  2. Inspect body/headers → **Expected:** **no** original message (e.g. not `"DropConfig no inicializado..."`), no stack trace, no SQL/Prisma text.
- **Notes:** `errorHandler` sets `expose = NODE_ENV !== 'production'`; in prod it discards `err.message`. Critical anti-leak control.

### TC-XC-020: Non-production exposes the real message
- **Priority:** P2
- **Type:** Functional
- **Preconditions:** `NODE_ENV=development` (or `test`); a throwing path.
- **Steps → Expected:**
  1. `GET /api/drop` (unseeded) → **Expected:** body `{"error":"DropConfig no inicializado — corré el seed"}` — the actual `Error.message`.
- **Notes:** Developer-friendly in dev; masked in prod (TC-XC-019). The two must be tested in their respective `NODE_ENV`s.

### TC-XC-021: Global 404 envelope
- **Priority:** P2
- **Type:** Negative
- **Preconditions:** API running.
- **Steps → Expected:**
  1. `GET /api/nope` → **Expected:** HTTP `404`; body `{"error":"No encontrado"}`; JSON content-type.

### TC-XC-022: 404 bodies are consistently Spanish (CD-2 resolved)
- **Priority:** P3
- **Type:** Functional
- **Preconditions:** Seeded DB.
- **Steps → Expected:**
  1. `GET /api/products/unknown-slug` → **Expected:** `{"error":"Producto no encontrado"}` (Spanish).
  2. `GET /api/unknown` → **Expected:** `{"error":"No encontrado"}` (Spanish).
  3. Compare → **Expected:** both 404 bodies are es-AR — no language inconsistency.
- **Notes:** CD-2 (also in Module 1) is **resolved**: the global 404 is now Spanish (`"No encontrado"`), matching the rest of the es-AR app.

### TC-XC-023: Errors never return an HTML page
- **Priority:** P2
- **Type:** Security
- **Preconditions:** API running.
- **Steps → Expected:**
  1. Force a `500` and a `404` → **Expected:** both bodies are JSON `{error:...}`; no Express default HTML error page, no `<pre>` stack dump, in any `NODE_ENV`.

---

## 13.6 Production boot guards (`env.ts`)

### TC-XC-024: Production refuses to boot on the dev-default JWT secret
- **Priority:** P0
- **Type:** Security
- **Preconditions:** A shell where you can set env and start the API.
- **Steps → Expected:**
  1. Start the API with `NODE_ENV=production` and `JWT_SECRET=dev-secret-change-me-in-production!!` (the public default) → **Expected:** boot **fails**; Zod error mentions `JWT_SECRET must be set to a strong, unique value in production (the dev default is public)`; process exits, server does not listen.
- **Notes:** `superRefine` only fires when `NODE_ENV==='production'`.

### TC-XC-025: Production refuses to boot on the placeholder MP token
- **Priority:** P0
- **Type:** Security
- **Preconditions:** As above; set a valid 32+ char `JWT_SECRET` so only the MP guard can trip.
- **Steps → Expected:**
  1. Start with `NODE_ENV=production`, `JWT_SECRET=<32+ random chars>`, `MP_ACCESS_TOKEN=TEST-ACCESS-TOKEN` (placeholder) → **Expected:** boot **fails** with `MP_ACCESS_TOKEN must be a real MercadoPago token in production`.

### TC-XC-026: Secret shorter than 32 chars fails to boot in any env
- **Priority:** P1
- **Type:** Boundary
- **Preconditions:** Shell access.
- **Steps → Expected:**
  1. Start with `JWT_SECRET=short` (e.g. 5 chars), `NODE_ENV=development` → **Expected:** boot **fails** the base schema `z.string().min(32)` before `superRefine` — this guard is **not** prod-only.
  2. Boundary: `JWT_SECRET` = exactly 32 chars → **Expected:** passes the length rule.
- **Notes:** Distinguishes the always-on `min(32)` rule from the prod-only "equals dev default" rule.

### TC-XC-027: Production boots with real, valid secrets
- **Priority:** P1
- **Type:** Functional
- **Preconditions:** Shell access.
- **Steps → Expected:**
  1. Start with `NODE_ENV=production`, a 32+ char unique `JWT_SECRET`, and a real (non-placeholder) `MP_ACCESS_TOKEN` → **Expected:** server boots and listens; `GET /api/health` → `200 {ok:true}`.
- **Notes:** Confirms the guards aren't false-positive blocking a legitimate prod config.

### TC-XC-028: Dev boots on defaults
- **Priority:** P2
- **Type:** Functional
- **Preconditions:** Default `.env` (or none).
- **Steps → Expected:**
  1. Start with `NODE_ENV=development` and the default `JWT_SECRET`/`MP_ACCESS_TOKEN` → **Expected:** boots normally; guards do not trip in non-prod.

---

## 13.7 i18n & money formatting

### TC-XC-029: HTML document language is es-AR
- **Priority:** P2
- **Type:** Accessibility
- **Preconditions:** Web app running on `:5173`.
- **Steps → Expected:**
  1. Load `http://localhost:5173/`; inspect the root element → **Expected:** `<html lang="es-AR">`.
- **Notes:** Screen-reader pronunciation and browser translation hinting.

### TC-XC-030: Money uses es-AR dot thousands separator
- **Priority:** P1
- **Type:** UI
- **Preconditions:** Web app + seeded catalog (prices `30000`).
- **Steps → Expected:**
  1. View a product price on the landing → **Expected:** rendered `$30.000` (dot grouping, no decimals).
  2. Add 2 of the same product; view subtotal `60000` → **Expected:** `$60.000`.
- **Notes:** `'$' + n.toLocaleString('es-AR')`. API stays integer (Module 1); formatting is client-side.

### TC-XC-031: Large amounts group correctly
- **Priority:** P2
- **Type:** Boundary
- **Preconditions:** A cart/total reaching 7 figures (e.g. many units).
- **Steps → Expected:**
  1. Produce a total of `1234567` → **Expected:** displayed `$1.234.567` (two dot separators).
  2. Produce `100000` → **Expected:** `$100.000`.
- **Notes:** Validates grouping at multiple magnitudes, not just 5-digit prices.

### TC-XC-032: API and UI copy are Spanish es-AR
- **Priority:** P3
- **Type:** UI
- **Preconditions:** App running.
- **Steps → Expected:**
  1. Sample error/UI strings (e.g. product 404 `"Producto no encontrado"`, global 404 `"No encontrado"`, rate-limit `"Demasiadas solicitudes..."`, seed hints `"...corré el seed"`) → **Expected:** Spanish es-AR voseo where applicable (`corré`, `Probá`).
  2. No English exceptions remain — the global 404 is now Spanish too (CD-2 resolved).
- **Notes:** Light i18n sweep; deep copy review is per-feature.

---

## 13.8 Visit tracking (`POST /api/track`)

### TC-XC-033: Track a normal path
- **Priority:** P2
- **Type:** Functional
- **Preconditions:** API + DB; `Visit` table exists.
- **Steps → Expected:**
  1. `POST /api/track` with `{"path":"/"}` → **Expected:** HTTP `200 {"ok":true}`.
  2. Inspect DB → **Expected:** a `Visit` row with `path="/"` created.

### TC-XC-034: Missing path defaults to "/"
- **Priority:** P2
- **Type:** Negative
- **Preconditions:** API + DB.
- **Steps → Expected:**
  1. `POST /api/track` with `{}` (no `path`) → **Expected:** `200 {"ok":true}`; stored `path="/"`.
  2. `POST /api/track` with no body at all → **Expected:** `200 {"ok":true}`; stored `path="/"`.
- **Notes:** `typeof req.body?.path === 'string' ? ... : '/'`.

### TC-XC-035: Oversized path is sliced to 200 chars
- **Priority:** P2
- **Type:** Boundary
- **Preconditions:** API + DB.
- **Steps → Expected:**
  1. `POST /api/track` with `{"path":"<300-char string>"}` (still under the 1 MB body cap) → **Expected:** `200 {"ok":true}`; stored `path` length is exactly `200`.
  2. Boundary: exactly 200 chars → **Expected:** stored unchanged (length 200).
- **Notes:** `req.body.path.slice(0,200)`. A body over 1 MB instead hits TC-XC-009 (`413`).

### TC-XC-036: Malformed path type falls back to "/"
- **Priority:** P2
- **Type:** Negative
- **Preconditions:** API + DB.
- **Steps → Expected:**
  1. `POST /api/track` with `{"path":123}` (number) → **Expected:** `200 {"ok":true}`; stored `path="/"` (typeof check fails).
  2. `{"path":["/a","/b"]}` (array) and `{"path":{"x":1}}` (object) → **Expected:** both `200 {"ok":true}`; stored `path="/"`.
  3. `{"path":null}` → **Expected:** `200`; stored `path="/"`.

### TC-XC-037: DB failure is swallowed — still returns ok
- **Priority:** P1
- **Type:** Negative
- **Preconditions:** Induce a `Visit.create` failure (e.g. drop/rename the `Visit` table, or revoke write perms, in a throwaway DB).
- **Steps → Expected:**
  1. `POST /api/track` with `{"path":"/"}` → **Expected:** HTTP `200 {"ok":true}` despite the DB write throwing — the `try/catch` swallows it; the client is never told tracking failed.
- **Notes:** Intentional: tracking is non-critical and must never break a page load. Verify the failure is logged/observable server-side if monitoring matters, since the API hides it.

### TC-XC-038: Track endpoint is public (no auth, any/no origin)
- **Priority:** P3
- **Type:** Security
- **Preconditions:** API running.
- **Steps → Expected:**
  1. `POST /api/track {"path":"/"}` with **no** auth header → **Expected:** `200 {"ok":true}`.
  2. Same with an arbitrary `Origin` from curl → **Expected:** `200` (CORS is browser-enforced; the endpoint itself is open and unauthenticated by design).
- **Notes:** Because it's open and write-only, confirm it's covered by the 300/15min `/api` limiter (it is) so it can't be used to flood the DB indefinitely.

### TC-XC-039: Landing fires tracking once per mount
- **Priority:** P3
- **Type:** Integration
- **Preconditions:** Web app + API; browser dev tools / network panel.
- **Steps → Expected:**
  1. Load the landing page; watch the Network tab → **Expected:** exactly **one** `POST /api/track` on mount (not on every render, not duplicated).
  2. Navigate away and back / reload → **Expected:** one new call per mount.
- **Notes:** A `useRef` guard in `Landing.tsx` suppresses React StrictMode's dev-only double-invoke, so dev and prod builds both fire exactly once per mount.

---

## 13.9 Secrets exposure

### TC-XC-040: Public-key endpoint returns only the public key
- **Priority:** P1
- **Type:** Security
- **Preconditions:** API running; `MP_PUBLIC_KEY` set.
- **Steps → Expected:**
  1. `GET /api/payments/public-key` → **Expected:** HTTP `200`; body `{"publicKey": <MP_PUBLIC_KEY>}` and nothing else.
  2. Search the body → **Expected:** no `accessToken`, no `MP_ACCESS_TOKEN` value, no secret.

### TC-XC-041: MP access token never appears in any client-facing response
- **Priority:** P0
- **Type:** Security
- **Preconditions:** API running with a real `MP_ACCESS_TOKEN`.
- **Steps → Expected:**
  1. Capture responses from `GET /api/payments/public-key`, `GET /api/content`, `GET /api/products`, the checkout/preference creation response, and any error bodies → **Expected:** the `MP_ACCESS_TOKEN` string appears in **none** of them.
- **Notes:** Server-only invariant: the access token is used to call MercadoPago server-side; only the **public** key is shipped to the browser. Pair with TC-XC-019 (prod error masking) so a thrown MP error can't echo the token.

### TC-XC-042: JWT lifetime and bcrypt cost invariants
- **Priority:** P2
- **Type:** Security
- **Preconditions:** Admin login available (Module 8 setup).
- **Steps → Expected:**
  1. Log in; decode the JWT `exp - iat` → **Expected:** ~`12h` (43200s).
  2. Inspect a stored admin password hash → **Expected:** bcrypt with cost `12` (`$2a$12$...` — `bcryptjs` emits the `$2a$` prefix; functionally equivalent to `$2b$`).
- **Notes:** Cross-references Module 8; included here as the cross-cutting auth-hardening record. The access token / secrets stay server-only.

---

## 13.10 Stored XSS (CD-8)

### TC-XC-043: Injected HTML in site content renders inert on the public landing
- **Priority:** P0
- **Type:** Security
- **Preconditions:** Admin access to edit SiteContent (Module 11); web app running.
- **Steps → Expected:**
  1. Via admin **Contenido**, set a visible field (e.g. `heroKicker` or a `marquee` item) to `<img src=x onerror=alert(1)>` and save → **Expected:** save succeeds (API stores it verbatim — no write-time sanitization).
  2. Load the public landing `http://localhost:5173/` → **Expected:** the string is rendered as **inert visible text**, character-for-character; **no** alert dialog, no image request, no script execution. React auto-escapes the interpolated text.
  3. Try a `<script>alert(1)</script>` payload in another field → **Expected:** also rendered as literal text, not executed.
- **Notes:** CD-8. The control is React's default escaping on the landing. **Regression risk:** any future use of `dangerouslySetInnerHTML` on these fields would turn this into live stored-XSS — re-run on every content-rendering change. Restore clean content afterward.

### TC-XC-044: Content is stored verbatim by the API (no write sanitization)
- **Priority:** P2
- **Type:** Security
- **Preconditions:** Admin access.
- **Steps → Expected:**
  1. Save `heroKicker = "<b>x</b> & 'q' \"q\""` then `GET /api/content` → **Expected:** the value round-trips **exactly** as sent — the API does not strip or encode it on write.
- **Notes:** Confirms defense lives at render time (TC-XC-043) and in email escaping (Module 7), not at the API boundary. Documents the trust boundary so no consumer assumes pre-sanitized content.

---

## 13.11 Method handling & concurrency

### TC-XC-045: Unsupported HTTP method returns 404
- **Priority:** P2
- **Type:** Negative
- **Preconditions:** API running.
- **Steps → Expected:**
  1. `DELETE /api/health` → **Expected:** `404 {"error":"No encontrado"}` (only `GET` is defined).
  2. `PUT /api/products/champion-mentality-azul-marino` → **Expected:** `404`.
  3. `POST /api/content` → **Expected:** `404`.
- **Notes:** No `405` is emitted — unmatched method falls through to `notFound`. Same behavior catalogued in Module 1 (TC-CAT-032).

### TC-XC-046: Concurrent reads don't corrupt the singletons
- **Priority:** P2
- **Type:** Concurrency
- **Preconditions:** Seeded DB.
- **Steps → Expected:**
  1. Fire 50 concurrent `GET /api/content` and 50 concurrent `GET /api/drop` (e.g. `hey -n 100 -c 50`) → **Expected:** every response is `200` and well-formed; no partial/garbled JSON, no `500`.
  2. Compare all `content` bodies → **Expected:** identical (mind the 300/15min limiter — keep total under cap or reset window).
- **Notes:** `getDrop`/`getContent` use `findFirst({orderBy:{id:'asc'}})`, tolerant of singleton id drift; reads are stateless.

### TC-XC-047: Reads during an admin write return a consistent snapshot
- **Priority:** P2
- **Type:** Concurrency
- **Preconditions:** Admin can update content (Module 11); seeded DB.
- **Steps → Expected:**
  1. While repeatedly `GET /api/content`, submit an admin content update changing several fields at once → **Expected:** each read returns either the **old** complete record or the **new** complete record — never a half-updated mix (e.g. new `heroTitle1` with old `marquee`).
- **Notes:** The update is a single `prisma.update`; readers should never observe a torn write. Critical because content fields are interdependent (hero, marquee, bank).

### TC-XC-048: Rate-limit counter is accurate under a concurrent burst
- **Priority:** P3
- **Type:** Concurrency
- **Preconditions:** Fresh limiter window; single client IP.
- **Steps → Expected:**
  1. Fire 320 requests with high concurrency (e.g. `hey -n 320 -c 50 http://localhost:4000/api/health`) → **Expected:** ~300 succeed and ~20 return `429` with the Spanish message; the count blocked is consistent with the 300 cap (no large over/under-count from races).
- **Notes:** In-memory store; minor off-by-a-few under heavy concurrency is acceptable, gross miscounts are not.
