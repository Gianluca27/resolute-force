# Module 8 — Admin authentication

> The single-admin login and the JWT guard protecting every `/api/admin/*` route, plus the web session (Zustand `persist`, `ProtectedRoute`, auto-logout). Covers login success/failure, user-enumeration protection (constant-time bcrypt vs a dummy hash), input validation, brute-force rate limiting, token verification (missing / non-Bearer / malformed / expired / tampered / wrong-secret), full route coverage, the no-roles authorization model, the seed gate (`ADMIN_PASSWORD`), session persistence/logout, the client-guard expiry gap **CD-7**, and login-form accessibility. Tests the **shipped code** in `apps/api/src/routes/admin/index.ts`, `middleware/auth.ts`, `lib/jwt.ts`, `app.ts` (rate limiter), and `apps/web/src/store/auth.ts`, `components/admin/ProtectedRoute.tsx`, `pages/admin/Login.tsx`, `lib/adminApi.ts`. See the [README](README.md) for setup, env vars, and test accounts — referenced here, not repeated.

### Key facts (from code)
- **Token:** `jsonwebtoken` HS256, `expiresIn: '12h'`, claims `{ sub, email }`, signed with `JWT_SECRET`.
- **Password:** `bcryptjs.compare` against `AdminUser.passwordHash` (cost 12). Unknown email still runs `bcrypt.compare` against a constant `DUMMY_HASH` → constant-time, no user enumeration.
- **Login** `POST /api/admin/login`: non-string body → `400 {error:'Datos inválidos'}`; unknown email OR bad password → `401 {error:'Credenciales inválidas'}`; success → `{ token, email }`. Rate limit **10 / 15 min** → `429 {error:'Demasiados intentos de acceso. Probá de nuevo más tarde.'}`.
- **Guard** `requireAdmin`: missing/non-`Bearer ` Authorization → `401 {error:'No autorizado'}`; bad/expired token → `401 {error:'Sesión inválida o expirada'}`. Applied via `adminRouter.use(requireAdmin)` **after** `/login`, so every `/api/admin/*` except `/login` is protected.
- **Web:** session in `localStorage["rf-admin"]` = `{token,email}`. `ProtectedRoute` validates token **structure + `exp`** client-side (CD-7 fixed) → redirects to login on a malformed/expired token. `adminApi` on a `401` from an authed call → `logout()` + throws `"Sesión expirada"`; on `/login` it propagates the API error (e.g. `Credenciales inválidas`).

**Coverage checklist:**
- [ ] Login success returns `{token,email}`; token is HS256 with `{sub,email}` and ~12h expiry (AUTH-001, 002)
- [ ] Wrong password / unknown email → 401 same message, constant-time (AUTH-003, 004)
- [ ] Non-string/missing body → 400; empty-string fields → 401 (boundary) (AUTH-005, 006, 007)
- [ ] Brute-force: 10 allowed, 11th → 429 (AUTH-008)
- [ ] Valid Bearer reaches `/me`; missing/non-Bearer → 401 No autorizado (AUTH-009, 010, 011, 017)
- [ ] Empty/malformed/expired/tampered/wrong-secret token → 401 Sesión inválida o expirada (AUTH-012–016)
- [ ] Valid token reaches all `/api/admin/*`; no-token blocked on each; `/login` itself unprotected (AUTH-018, 019, 020)
- [ ] No role tiers — any valid token is full admin; admin not seeded when `ADMIN_PASSWORD` empty (AUTH-021, 022)
- [ ] Web: `rf-admin` persists across reload; redirect when no token; auto-logout on 401; logout clears session; success navigates (AUTH-023, 024, 025, 027, 028)
- [ ] **CD-7 (fixed):** malformed/expired token → ProtectedRoute redirects to login; valid JWT renders the shell (AUTH-026)
- [ ] A11y: form labels, focus, error display; password masked (AUTH-029, 030, 031)

---

## Login endpoint — success & token

### TC-AUTH-001: Login success returns token and email
- **Priority:** P0
- **Type:** Functional
- **Preconditions:** Admin seeded (`ADMIN_EMAIL`/`ADMIN_PASSWORD` set, `npm run seed`). Automated creds: `admin@test.com` / `secret123`.
- **Steps → Expected:**
  1. `POST /api/admin/login` with `{email:<ADMIN_EMAIL>, password:<ADMIN_PASSWORD>}` → **Expected:** HTTP 200, body `{ token: "<jwt>", email: "<ADMIN_EMAIL>" }`.
  2. Confirm `email` echoes the stored admin email (from DB, not the request) → **Expected:** matches `admin.email`.
- **Notes:** `token` is a non-empty three-segment JWT. No password or hash is ever returned.

### TC-AUTH-002: Issued token is HS256 with {sub,email} claims and ~12h expiry
- **Priority:** P1
- **Type:** Security
- **Preconditions:** A token from a successful login.
- **Steps → Expected:**
  1. Decode the JWT header (e.g. at jwt.io or `jwt.decode`) → **Expected:** `alg: HS256`, `typ: JWT`.
  2. Decode the payload → **Expected:** claims `sub` = admin id (cuid), `email` = admin email, plus `iat` and `exp`.
  3. Check `exp − iat` → **Expected:** 43200 seconds (12h).
- **Notes:** `signAdmin` uses `jwt.sign(claims, JWT_SECRET, {expiresIn:'12h'})`. No roles/scopes claim exists (see AUTH-021).

---

## Login endpoint — negative & boundary

### TC-AUTH-003: Wrong password → 401 Credenciales inválidas
- **Priority:** P0
- **Type:** Negative
- **Preconditions:** Admin seeded.
- **Steps → Expected:**
  1. `POST /api/admin/login` with the correct email but a wrong password → **Expected:** HTTP 401, body `{error:'Credenciales inválidas'}`; no token.
- **Notes:** `bcrypt.compare` returns false → `!ok` branch. Generic message (does not reveal whether the email exists).

### TC-AUTH-004: Unknown email → 401 same message, constant-time (no user enumeration)
- **Priority:** P1
- **Type:** Security
- **Preconditions:** Admin seeded.
- **Steps → Expected:**
  1. `POST /api/admin/login` with an email that has no account (e.g. `nobody@x.com`) and any password → **Expected:** HTTP 401, body `{error:'Credenciales inválidas'}` — **identical** to the wrong-password response.
  2. Compare response timing of an unknown email vs a known email + wrong password over several samples → **Expected:** broadly comparable latency (both run a real bcrypt compare; unknown email compares against `DUMMY_HASH`), with no obvious "fast reject" for unknown accounts.
- **Notes:** `bcrypt.compare(password, admin?.passwordHash ?? DUMMY_HASH)` defeats timing-based enumeration. Same status + same body as AUTH-003 is the point.

### TC-AUTH-005: Non-string email or password → 400 Datos inválidos
- **Priority:** P1
- **Type:** Negative
- **Preconditions:** API running.
- **Steps → Expected:**
  1. `POST /api/admin/login` with `{email: 123, password: "x"}` → **Expected:** HTTP 400 `{error:'Datos inválidos'}` (no bcrypt run).
  2. `{email:"a@b.com", password: {}}` → **Expected:** 400 `{error:'Datos inválidos'}`.
  3. `{email:["a"], password:["b"]}` and `{email:null, password:null}` → **Expected:** 400 each.
  4. Empty/missing body `{}` (both `undefined`) → **Expected:** 400 (`typeof undefined !== 'string'`).
- **Notes:** Guard is `typeof email !== 'string' || typeof password !== 'string'`. 400 precedes any DB/bcrypt work.

### TC-AUTH-006: Empty-string credentials → 401, not 400 (boundary)
- **Priority:** P2
- **Type:** Boundary
- **Preconditions:** Admin seeded.
- **Steps → Expected:**
  1. `POST /api/admin/login` with `{email:"", password:""}` → **Expected:** HTTP **401** `{error:'Credenciales inválidas'}` — empty strings pass the `typeof` check (they ARE strings), so the code looks up `email:""` (no match) and bcrypt-compares against `DUMMY_HASH` → 401.
  2. `{email:<valid admin>, password:""}` → **Expected:** 401 (empty password fails bcrypt).
- **Notes:** The empty-string vs missing-field distinction (401 vs 400) is the boundary. No 500.

### TC-AUTH-007: Missing Content-Type / non-JSON body handled gracefully
- **Priority:** P3
- **Type:** Negative
- **Preconditions:** API running.
- **Steps → Expected:**
  1. `POST /api/admin/login` with no body / no `Content-Type: application/json` → **Expected:** `req.body` is `undefined`; `req.body ?? {}` yields `{}`; both fields `undefined` → 400 `{error:'Datos inválidos'}`. No crash.
  2. Send malformed JSON → **Expected:** HTTP **400** `{error:'JSON inválido'}` — the global error middleware respects the body-parser `err.status` (no 500, no stack leak). *(H-01 fixed.)*
- **Notes:** `const { email, password } = req.body ?? {}` defends against a null body. `errorHandler` maps a 4xx `err.status`/`err.type` (e.g. `entity.parse.failed`) to the right status with a safe generic message.

### TC-AUTH-008: Brute-force rate limit — 10 attempts allowed, 11th → 429
- **Priority:** P1
- **Type:** Security
- **Preconditions:** API running (rate limiter active in non-test env). Use a single client IP.
- **Steps → Expected:**
  1. Fire 10 failed `POST /api/admin/login` within 15 min → **Expected:** each returns 401 (or 400), all processed.
  2. Fire the 11th within the same window → **Expected:** HTTP **429** `{error:'Demasiados intentos de acceso. Probá de nuevo más tarde.'}`.
  3. A correct credential as the 11th request → **Expected:** still 429 — the limiter is keyed on the route/IP, not on success.
- **Notes:** `loginLimiter = rateLimit({ windowMs: 15*60*1000, max: 10, ... })` on `/api/admin/login`. Standard rate-limit headers present. The global `/api` limiter (max 300) is looser and won't trigger first. Window resets after 15 min.

---

## Guard `requireAdmin` — token verification

### TC-AUTH-009: Valid Bearer token reaches GET /me
- **Priority:** P0
- **Type:** Functional
- **Preconditions:** Valid token from login.
- **Steps → Expected:**
  1. `GET /api/admin/me` with header `Authorization: Bearer <token>` → **Expected:** HTTP 200 `{email:'<ADMIN_EMAIL>'}` (from `req.admin.email`).
- **Notes:** Confirms the guard sets `req.admin` from the verified claims and the route reads it.

### TC-AUTH-010: Missing Authorization header → 401 No autorizado
- **Priority:** P0
- **Type:** Negative
- **Preconditions:** API running.
- **Steps → Expected:**
  1. `GET /api/admin/me` with **no** `Authorization` header → **Expected:** HTTP 401 `{error:'No autorizado'}`.
- **Notes:** `if (!h?.startsWith('Bearer '))` — undefined header fails the optional-chain check. Distinct message from the token-invalid case.

### TC-AUTH-011: Non-Bearer scheme → 401 No autorizado
- **Priority:** P1
- **Type:** Negative
- **Preconditions:** Valid token available.
- **Steps → Expected:**
  1. `Authorization: Basic dXNlcjpwYXNz` → **Expected:** 401 `{error:'No autorizado'}`.
  2. `Authorization: <token>` (raw token, no scheme) → **Expected:** 401 `{error:'No autorizado'}`.
  3. `Authorization: token <token>` → **Expected:** 401 `{error:'No autorizado'}`.
- **Notes:** Only the literal prefix `Bearer ` (capital B, trailing space) is accepted.

### TC-AUTH-012: Case-sensitive scheme — lowercase "bearer " → 401 No autorizado
- **Priority:** P2
- **Type:** Boundary
- **Preconditions:** Valid token.
- **Steps → Expected:**
  1. `Authorization: bearer <token>` (lowercase b) → **Expected:** 401 `{error:'No autorizado'}` (string match is case-sensitive).
  2. `Authorization: Bearer<token>` (no space) → **Expected:** 401 `{error:'No autorizado'}`.
- **Notes:** `startsWith('Bearer ')` is exact. Documents the strictness; not necessarily a bug.

### TC-AUTH-013: Empty / garbage token after Bearer → 401 Sesión inválida o expirada
- **Priority:** P1
- **Type:** Negative
- **Preconditions:** API running.
- **Steps → Expected:**
  1. `Authorization: Bearer ` (prefix + empty token) → **Expected:** 401 `{error:'No autorizado'}`. *(H-02:* the HTTP layer trims the trailing whitespace → the header arrives as `Bearer`, failing `startsWith('Bearer ')`, so `verifyAdmin('')` is unreachable via a real header. Same 401, different message — no security impact.)*
  2. `Authorization: Bearer not.a.jwt` → **Expected:** 401 `{error:'Sesión inválida o expirada'}`.
- **Notes:** Once the `Bearer ` prefix matches a non-empty token, any verification failure produces the *Sesión inválida* message (not *No autorizado*).

### TC-AUTH-014: Malformed JWT structure → 401 Sesión inválida o expirada
- **Priority:** P1
- **Type:** Negative
- **Preconditions:** API running.
- **Steps → Expected:**
  1. Send a token with a broken segment (e.g. truncate the signature, or two segments only) as `Bearer <bad>` → **Expected:** 401 `{error:'Sesión inválida o expirada'}`; no stack trace leaked to the client.
- **Notes:** `jwt.verify` throws `JsonWebTokenError`; the `catch` maps it to a uniform 401.

### TC-AUTH-015: Expired token (12h) → 401 server-side
- **Priority:** P0
- **Type:** Security
- **Preconditions:** A token whose `exp` is in the past (mint one with a short/negative expiry using the same `JWT_SECRET`, or reuse a >12h-old token).
- **Steps → Expected:**
  1. `GET /api/admin/me` with the expired token → **Expected:** 401 `{error:'Sesión inválida o expirada'}` (`jwt.verify` throws `TokenExpiredError`).
- **Notes:** Expiry is the **server-side backstop**. The web client now also pre-checks `exp` in `ProtectedRoute` (CD-7 fixed, AUTH-026), but this server check is the authoritative one that blocks an expired session.

### TC-AUTH-016: Tampered signature → 401
- **Priority:** P0
- **Type:** Security
- **Preconditions:** A valid token.
- **Steps → Expected:**
  1. Flip a character in the payload segment (e.g. to escalate a claim) while keeping the original signature → **Expected:** signature mismatch → 401 `{error:'Sesión inválida o expirada'}`.
  2. Re-encode the payload and forge a new signature with a guessed/empty key → **Expected:** still 401 (HS256 verify fails without the real `JWT_SECRET`).
- **Notes:** Confirms integrity protection — claims cannot be edited without invalidating the token.

### TC-AUTH-017: Token signed with a different secret → 401
- **Priority:** P1
- **Type:** Security
- **Preconditions:** Ability to mint a JWT with a wrong key.
- **Steps → Expected:**
  1. Sign a well-formed `{sub,email}` token with `WRONG_SECRET` and send it → **Expected:** 401 `{error:'Sesión inválida o expirada'}`.
- **Notes:** Also covers the `alg:none` downgrade attempt — `jwt.verify` with HS256 rejects an unsigned/`none` token. Verify it does NOT authenticate.

---

## Protected-route coverage & authorization model

### TC-AUTH-018: Valid token reaches every /api/admin/* route
- **Priority:** P1
- **Type:** Functional
- **Preconditions:** Valid token. Seeded DB.
- **Steps → Expected:**
  1. With `Authorization: Bearer <token>`, call `GET /api/admin/me`, `GET /api/admin/products`, `GET /api/admin/orders`, `GET /api/admin/config/...`, `GET /api/admin/metrics` → **Expected:** each returns 2xx (not 401); the guard admits all of them.
- **Notes:** `adminRouter.use(requireAdmin)` is mounted once, before the sub-routers, so a single valid token unlocks the whole namespace.

### TC-AUTH-019: No-token request is blocked on each protected route
- **Priority:** P0
- **Type:** Security
- **Preconditions:** API running.
- **Steps → Expected:**
  1. Without any `Authorization` header, call `GET /api/admin/products`, `GET /api/admin/orders`, `GET /api/admin/metrics`, and a `/api/admin/config/*` route → **Expected:** each returns 401 `{error:'No autorizado'}`; no data leaks.
  2. Try a mutating route (e.g. `POST /api/admin/products`) with no token → **Expected:** 401 before any write.
- **Notes:** Spot-check confirms protection is namespace-wide, not per-route. Pair with Modules 9–12 for the body-level behavior once authenticated.

### TC-AUTH-020: /login is reachable WITHOUT a token
- **Priority:** P1
- **Type:** Functional
- **Preconditions:** API running.
- **Steps → Expected:**
  1. `POST /api/admin/login` with no `Authorization` header → **Expected:** processed normally (200/400/401/429 per credentials) — it is registered **before** `adminRouter.use(requireAdmin)`, so the guard does not apply.
- **Notes:** Ordering matters: if `/login` were ever moved after the guard, login would become impossible. This case locks in that ordering.

### TC-AUTH-021: No role tiers — any valid token is full admin
- **Priority:** P1
- **Type:** Security
- **Preconditions:** Valid token.
- **Steps → Expected:**
  1. Use the single admin token to perform a read AND a destructive write (e.g. `DELETE`/`PUT` a product, change an order status, edit config) → **Expected:** all succeed; there is no permission/role check beyond "valid token".
- **Notes:** Claims carry only `{sub,email}` — no role/scope. Single-admin model by design; document that there is no least-privilege separation, so token compromise = full control.

### TC-AUTH-022: Admin not seeded when ADMIN_PASSWORD is empty → login impossible
- **Priority:** P1
- **Type:** Negative
- **Preconditions:** Reset DB. Set `ADMIN_PASSWORD` to empty/unset, then run `npm run seed`.
- **Steps → Expected:**
  1. Inspect the DB / attempt login with any credentials → **Expected:** no `AdminUser` row exists; every login returns 401 `{error:'Credenciales inválidas'}` (the lookup finds nobody, bcrypt vs `DUMMY_HASH` fails).
  2. Set `ADMIN_PASSWORD` non-empty, re-seed → **Expected:** the admin is created and login succeeds.
- **Notes:** The seed gate on `ADMIN_PASSWORD` is also why the README insists you set it before testing the panel.

---

## Web session — persistence, redirect, logout, CD-7

### TC-AUTH-023: Persisted rf-admin session survives a page reload
- **Priority:** P1
- **Type:** Functional
- **Preconditions:** Web app running; logged in via `/admin/login`.
- **Steps → Expected:**
  1. After login, inspect `localStorage["rf-admin"]` → **Expected:** JSON containing `{token, email}` (Zustand `persist`).
  2. Hard-reload `/admin` → **Expected:** still authenticated; no redirect to login; the session rehydrates from storage.
- **Notes:** Security note: the JWT sits in `localStorage` in plaintext, readable by any JS on the origin — relevant to the XSS cases in Module 13 (a content/landing XSS could exfiltrate it).

### TC-AUTH-024: ProtectedRoute redirects to /admin/login when there is no token
- **Priority:** P0
- **Type:** Functional
- **Preconditions:** Web app running. No session (`localStorage["rf-admin"]` absent or `token` null).
- **Steps → Expected:**
  1. Navigate directly to `/admin` (or any admin sub-route) → **Expected:** immediate client-side redirect to `/admin/login` (`<Navigate to="/admin/login" replace>`); the admin UI never renders.
- **Notes:** `ProtectedRoute` renders children only when `token` is truthy. `replace` means no back-button loop to the protected page.

### TC-AUTH-025: Web auto-logout on any API 401
- **Priority:** P0
- **Type:** Integration
- **Preconditions:** Logged into the web admin; an admin page that makes API calls.
- **Steps → Expected:**
  1. Invalidate the session server-side (rotate `JWT_SECRET` and restart the API, or wait past 12h) while keeping the stored token → **Expected:** the next admin API call returns 401; `adminApi.req` calls `useAuth.logout()` (clears `{token,email}`) and throws `"Sesión expirada"`.
  2. Observe the UI → **Expected:** with the token now cleared, `ProtectedRoute` redirects to `/admin/login` on the next render/navigation.
- **Notes:** This is the real expiry enforcement on the client — reactive (on 401), not proactive.

### TC-AUTH-026: CD-7 (fixed) — malformed/expired token redirects to login; valid JWT renders the shell
- **Priority:** P1
- **Type:** Security
- **Preconditions:** Web app running.
- **Steps → Expected:**
  1. Plant a **truthy but invalid** token in `localStorage["rf-admin"]` (e.g. `{token:"garbage", email:"x"}` or an expired JWT) and navigate to `/admin` → **Expected:** `ProtectedRoute` validates structure + `exp` and **redirects to `/admin/login`** — the shell does not render.
  2. Plant a structurally-valid JWT with a future `exp` and navigate to `/admin` → **Expected:** the admin shell renders.
- **Notes:** **CD-7 fixed.** `ProtectedRoute` now decodes the JWT payload (no signature check) and rejects a non-3-segment token, a missing/non-numeric `exp`, or an expired one. The server remains authoritative (every API call is verified server-side); this just removes the brief shell flash for an invalid session.

### TC-AUTH-027: Logout ("Salir") clears the session and returns to login
- **Priority:** P1
- **Type:** Functional
- **Preconditions:** Logged into the web admin.
- **Steps → Expected:**
  1. Click the sidebar **Salir** action → **Expected:** `useAuth.logout()` sets `{token:null, email:null}`; `localStorage["rf-admin"]` token cleared; redirect to `/admin/login`.
  2. Press Back / re-open `/admin` → **Expected:** redirected to login again (no stale session).
- **Notes:** Logout is purely client-side (token discard); the JWT remains technically valid server-side until `exp`. Acceptable for a stateless JWT design — note if "server-side revocation" is a requirement.

### TC-AUTH-028: Successful login sets session and navigates to /admin
- **Priority:** P0
- **Type:** Functional
- **Preconditions:** Web app at `/admin/login`. Valid admin creds.
- **Steps → Expected:**
  1. Enter email + password, click **Ingresar** → **Expected:** `adminApi.login` succeeds; `setSession(token,email)` persists `rf-admin`; `nav('/admin')` lands on the dashboard.
  2. During the request → **Expected:** the **Ingresar** button is disabled (`busy`), preventing double-submit.
- **Notes:** On error the button re-enables (`finally setBusy(false)`).

---

## Accessibility & UI — login form

### TC-AUTH-029: Login form accessibility — labels, focus, and error display
- **Priority:** P2
- **Type:** Accessibility
- **Preconditions:** Web app at `/admin/login`.
- **Steps → Expected:**
  1. Inspect the inputs → **Expected:** email input has `aria-label="Email"` (`type="email"`, `autoComplete="username"`); password input has `aria-label="Contraseña"` (`type="password"`, `autoComplete="current-password"`); submit button text is **Ingresar**.
  2. Submit invalid credentials → **Expected:** an error message renders above the inputs (uppercase, red) carrying the real API message **`Credenciales inválidas`** (H-03 fixed — login no longer rewrites its 401 to `Sesión expirada`).
  3. Keyboard-only: Tab through Email → Contraseña → Ingresar and submit with Enter → **Expected:** logical focus order; form submits on Enter (it's a real `<form onSubmit>`).
- **Notes:** Inputs rely on `aria-label` (no visible `<label>` element) — acceptable for screen readers; placeholders duplicate the labels. Verify focus is visible (`focus:border-gold`).

### TC-AUTH-030: Password field is masked
- **Priority:** P2
- **Type:** Security
- **Preconditions:** Web app at `/admin/login`.
- **Steps → Expected:**
  1. Type into the password field → **Expected:** characters are masked (`type="password"`); value is not shown in plaintext or in the DOM as text.
- **Notes:** Prevents shoulder-surfing. No "show password" toggle exists.

### TC-AUTH-031: Login error is shown on failure and cleared on retry
- **Priority:** P3
- **Type:** UI
- **Preconditions:** Web app at `/admin/login`.
- **Steps → Expected:**
  1. Submit wrong credentials → **Expected:** error block appears with `Credenciales inválidas` (the real API error); the user stays on `/admin/login`.
  2. Submit again → **Expected:** `setErr(null)` clears the previous error at the start of each submit (no stale stacking); on the new failure the fresh message shows.
- **Notes:** `submit` resets `err` to null before each attempt and only sets it in the `catch`.
