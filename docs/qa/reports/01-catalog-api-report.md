# Reporte de QA — Resolute Force · Módulo 1 (Catalog API) — 2026-06-27

## 1. Resumen ejecutivo

- **Alcance probado:** los 35 casos de [`docs/qa/01-catalog-api.md`](../01-catalog-api.md) (TC-CAT-001..035) contra la API Express/Prisma en `:4000` — endpoints públicos de catálogo: `health`, `products` (lista + detalle), `drop`, `content`, ruteo/métodos y consistencia de copy. Incluye mutaciones controladas de DB (desactivar productos, vaciar catálogo, des-sembrar singletons) **con restauración posterior verificada**, más una pasada exploratoria (HEAD/OPTIONS, CORS, ETag/304, quirks de path, headers de seguridad).
- **Conteo:** **34 PASS · 1 FAIL · 0 BLOQUEADO.**
- **Hallazgos:** 0 Críticos · 0 Altos · **1 Medio** · **3 Bajos**.
- **Veredicto:** API de catálogo **sólida y segura** — shape correcto, sin fugas de columnas internas, inyección SQL inerte, headers de seguridad presentes, CORS bloqueado al origin configurado, 500 sin stack trace. El único FAIL real es un dato (`contactInstagram`) que no coincide con el valor esperado del plan y difiere entre seed/API y los mocks de tests del web. CD-2 y CD-9 confirmados como inconsistencias cosméticas ya documentadas.

> **Resolución (2026-06-27).** Las 4 observaciones corregidas. Handle canónico confirmado por el dueño del producto = `@resoluteforceok` — H-01 era un **error de expectativa** en los mocks de tests del web y el plan QA (no en el seed/API). Tras el fix, TC-CAT-027 pasa → **35 PASS · 0 FAIL**.

### Top hallazgos
- **H-01 (Medio) · RESUELTO:** `contactInstagram` canónico = `@resoluteforceok` (seed/API/Footer ya correctos). Corregidos los mocks del web (`Contacto.test.tsx`, `Landing.test.tsx`) y los docs QA/planes que esperaban `@resolute.force`.
- **H-02 (Bajo) · RESUELTO:** CD-2 — handler global `notFound` ahora responde en español `{"error":"No encontrado"}`.
- **H-03 (Bajo) · RESUELTO:** CD-9 — seed de producto usa `Stop at Nothing` (casing canónico, igual al marquee).
- **H-04 (Bajo) · RESUELTO:** `case sensitive routing` activado en Express → `/API/products` ahora `404`.

---

## 2. Resultados por caso del archivo

| Caso | Resultado | Nota |
|------|-----------|------|
| TC-CAT-001 Health ok | PASS | `200 {"ok":true}`, `Content-Type: application/json; charset=utf-8`. |
| TC-CAT-002 Lista happy path | PASS | Array de 4; `[0]` = `champion-mentality-azul-marino`, `price=30000`, `tag="Más vendida"`. |
| TC-CAT-003 Campos públicos exactos | PASS | Keys = `id,slug,line,color,dotColor,tag,price,imageUrl,sizes`; `sizes[]` = `{size,stock}`. |
| TC-CAT-004 No fuga columnas internas | PASS | `active`/`sortOrder`/`imagePublicId`/`createdAt`/`updatedAt` ausentes; 0 matches en raw. |
| TC-CAT-005 Inactivos excluidos de lista | PASS | Desactivado → len 3; reactivado → len 4. |
| TC-CAT-006 Orden por sortOrder asc | PASS | azul-marino, negro, verde-militar, blanco. |
| TC-CAT-007 Talles S,M,L,XL | PASS | Orden correcto en los 4 productos. |
| TC-CAT-008 Price entero | PASS | Token raw `30000`; `typeof number`, `isInteger`. |
| TC-CAT-009 tag string/null | PASS | azul=`"Más vendida"`, negro=`null`, blanco=`"Nuevo"`. |
| TC-CAT-010 Content-type JSON | PASS | `application/json; charset=utf-8`. |
| TC-CAT-011 Idempotente | PASS | Dos llamadas byte-for-byte iguales. |
| TC-CAT-012 Catálogo vacío | PASS | Todos inactivos → `200 []` (no 404/500); restaurado a 4. |
| TC-CAT-013 Query params ignorados | PASS | `?page=2&limit=1&sort=price&color=Negro` = lista completa idéntica. |
| TC-CAT-014 Detalle por slug | PASS | `200`, objeto único, `price=30000`, `color="Azul Marino"`. |
| TC-CAT-015 Detalle == item de lista | PASS | Deep-equal. |
| TC-CAT-016 Slug inactivo → 404 (CD-1) | PASS | `404 {"error":"Producto no encontrado"}`, sin datos de producto. |
| TC-CAT-017 Slug desconocido → 404 | PASS | `404 {"error":"Producto no encontrado"}`. |
| TC-CAT-018 Trailing slash → lista | PASS | `/api/products/` → `200` con los 4. |
| TC-CAT-019 Slug case-sensitive | PASS | Mixed/UPPER → `404`. |
| TC-CAT-020 Whitespace en slug | PASS | Espacio encoded leading/trailing → `404`. |
| TC-CAT-021 Slug malformado | PASS | `..%2f..%2fetc%2fpasswd` → `404`; `%00` → `404` sin crash. |
| TC-CAT-022 SQL injection inerte | PASS | `' OR '1'='1` y `DROP TABLE` → `404`; tabla intacta (len 4). |
| TC-CAT-023 Slug larguísimo (2000) | PASS | `404`, sin `500`/stack. |
| TC-CAT-024 Drop happy path | PASS | `visible=true`, `title="Algo se está forjando"` (/forjando/i), `targetAt` 2026. |
| TC-CAT-025 targetAt ISO-8601 | PASS | `2026-08-15T23:00:00.000Z`, parseable. |
| TC-CAT-026 Drop sin sembrar → 500 | PASS | `500 {"error":"DropConfig no inicializado — corré el seed"}`; restaurado. |
| TC-CAT-027 Content happy path | PASS (tras fix) | `marquee` incluye `Champion Mentality` ✓, `transferDiscountPct===10` ✓, `contactInstagram === "@resoluteforceok"` ✓ — la expectativa `@resolute.force` era el error (ver H-01). |
| TC-CAT-028 marquee array + pct number | PASS | `marquee` array de 6 strings; `transferDiscountPct` int `10`. |
| TC-CAT-029 Bank fields "" | PASS | `bankAlias===""`, `bankCbu===""`. |
| TC-CAT-030 Content sin sembrar → 500 | PASS | `500 {"error":"SiteContent no inicializado — corré el seed"}`; restaurado. |
| TC-CAT-031 404 global | PASS | `/api/does-not-exist` y `/` → `404 {"error":"Not found"}`. |
| TC-CAT-032 Método no soportado → 404 | PASS | `POST /api/products`, `PUT /api/products/:slug`, `DELETE /api/drop` → `404`. |
| TC-CAT-033 CD-2 mezcla de idiomas | PASS (confirma defecto) | Producto 404 ES vs global 404 EN → ver H-02. |
| TC-CAT-034 CD-9 casing de línea | PASS (confirma defecto) | `Stop At Nothing` vs marquee `Stop at Nothing` → ver H-03. |
| TC-CAT-035 Precio + grilla + stock | PASS | Los 4: `price=30000`, `sizes.length=4`, cada `stock=25`. |

---

## 3. Hallazgos exploratorios

Pruebas fuera del guion del plan. Todo lo positivo se nota; lo accionable se formaliza como hallazgo en la sección 5.

- **HEAD `/api/products`** → `200`, `Content-Type` correcto, `Content-Length: 1245`, sin body. OK.
- **OPTIONS (preflight CORS)** → `204`, `Access-Control-Allow-Origin: http://localhost:5173`, `Access-Control-Allow-Credentials: true`. OK. Observación menor: `Access-Control-Allow-Methods: GET,HEAD,PUT,PATCH,POST,DELETE` anuncia métodos de escritura que la API pública no implementa (default del paquete `cors`); sin impacto real (esos métodos responden `404`).
- **CORS origin no confiable** → con `Origin: http://evil.com` el server devuelve `Access-Control-Allow-Origin: http://localhost:5173` (el origin **configurado fijo**, no refleja `evil.com`). El navegador bloquea evil.com. **Seguro** ✔.
- **ETag / GET condicional** → la lista trae `ETag`; con `If-None-Match` responde `304 Not Modified`. Caching eficiente ✔.
- **Headers de seguridad (Helmet)** → presentes en `/api/health`: `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy`, etc. ✔.
- **Rate limiting** → headers `RateLimit-Limit: 300; w=900` (300 req / 15 min). Presente ✔ (no se saturó para no afectar la corrida).
- **500 sin fuga** → los `500` de singletons devuelven solo `{"error": "..."}`, sin stack trace (en `NODE_ENV` de dev). ✔.
- **`//api/products`** (doble slash) → `404`. OK.
- **`/api/products/:slug/extra`** (segmento extra) → `404 {"error":"Not found"}`. OK.
- **`Accept: text/html`** → sigue devolviendo `200` JSON (sin content-negotiation; aceptable para API JSON).
- **`/API/products`** (path en mayúsculas) → **`200` con la lista completa** → ruteo case-insensitive. Ver **H-04**.

---

## 4. Huecos de cobertura (sugerencias para el set de pruebas)

El plan cubre muy bien el shape y los bordes del slug. Faltan, y convendría agregar:

1. **Case-sensitivity del path** (no solo del slug): `/API/products`, `/Api/Products` resuelven por default de Express → documentar/decidir contrato (relacionado con H-04).
2. **Contrato CORS:** origin permitido fijo, ausencia de reflejo de origins arbitrarios, `credentials: true`. Hoy no hay caso que lo fije.
3. **Headers de seguridad (Helmet):** presencia de CSP/HSTS/`nosniff`/`X-Frame-Options` como contrato verificable.
4. **GET condicional / ETag → 304:** comportamiento de caché no está cubierto.
5. **HEAD y OPTIONS** sobre endpoints reales (métodos seguros) — el plan solo cubre métodos de escritura → 404.
6. **`drop` con `visible:false`:** el seed solo tiene `visible:true`; falta verificar que el DTO se devuelve igual (no se filtra por visibilidad en el server) cuando está oculto.
7. **`marquee` con JSON inválido → 500:** el plan lo menciona en notas (TC-CAT-028) pero no hay caso negativo dedicado (requiere bypass de validación del admin write).
8. **Variant con talle fuera de `SIZES`:** TC-CAT-007 lo nota (rankearía `-1` → al frente) pero no hay caso que lo ejercite.
9. **Rate limiting:** ningún caso valida el `429` al exceder 300/15min ni los headers `RateLimit-*`.
10. **Baseline de performance / tiempo de respuesta** de los endpoints de lista y detalle.

---

## 5. Detalle de hallazgos

### [H-01] `contactInstagram` no coincide con el valor esperado y difiere entre seed/API y tests del web
- **Severidad:** Medio
- **Tipo:** Datos
- **Dónde:** `GET /api/content` → `contactInstagram`; `apps/api/prisma/seed.ts:55`; `apps/api/tests/config.test.ts:25`; `apps/web/src/components/Footer.tsx:6`; `apps/web/src/components/Contacto.test.tsx`; `apps/web/src/pages/Landing.test.tsx`.
- **Pasos para reproducir:**
  1. `curl -s http://localhost:4000/api/content` → leer `contactInstagram`.
  2. Comparar con el esperado de TC-CAT-027 (`@resolute.force`).
- **Esperado (corregido):** `contactInstagram === "@resoluteforceok"` — handle canónico confirmado por el dueño del producto. La expectativa previa `@resolute.force` (plan TC-CAT-027 + mocks `Contacto.test.tsx`/`Landing.test.tsx`) era incorrecta.
- **Actual:** API devuelve `"@resoluteforceok"` (valor del seed). El test de API `config.test.ts:25` también afirma `@resoluteforceok`, y el fallback de `Footer.tsx` es `@resoluteforceok`. Es decir: **seed + API + Footer** dicen `@resoluteforceok`; **plan de QA + mocks de tests del web** dicen `@resolute.force`. Hay dos handles distintos coexistiendo en el repo.
- **Impacto:** El `Footer` arma el link a `instagram.com/<handle>` con este valor → si el handle canónico real no es `resoluteforceok`, el botón de Instagram lleva a una cuenta equivocada/inexistente (tráfico social perdido). Además, los tests del web codifican un valor distinto al del seed/API: documentan el contrato equivocado y no detectarían una regresión del handle real.
- **Recomendación:** handle canónico único = `@resoluteforceok`. seed/`config.test.ts`/`Footer.tsx` ya correctos; alinear los mocks del web y los docs QA.
- **Evidencia:** `curl` → `"contactInstagram":"@resoluteforceok"`; `grep` mostraba ambos valores conviviendo en el repo.
- **Estado:** RESUELTO (2026-06-27) — actualizados a `@resoluteforceok`: `Contacto.test.tsx` (×2), `Landing.test.tsx`, `docs/qa/01-catalog-api.md` (TC-CAT-027), `docs/qa/02-landing-ui.md`, `docs/qa/README.md` y los planes m1/m2/webapp.

### [H-02] CD-2 — 404 de producto en español vs 404 global en inglés
- **Severidad:** Bajo
- **Tipo:** UX (i18n / copy)
- **Dónde:** `GET /api/products/:slug` (handler de producto) vs handler global `notFound`.
- **Pasos para reproducir:**
  1. `curl http://localhost:4000/api/products/unknown-slug` → `{"error":"Producto no encontrado"}` (español).
  2. `curl http://localhost:4000/api/totally-unknown` → `{"error":"Not found"}` (inglés).
- **Esperado:** mensajes de error consistentes en un solo idioma (la app es es-AR).
- **Actual:** dos cuerpos de 404 en dos idiomas distintos.
- **Impacto:** inconsistencia de copy de cara a integradores/clientes de API; un cliente que parsee el `error` para mostrarlo al usuario podría exponer texto en inglés en una app en español. Bajo impacto funcional.
- **Recomendación:** unificar a español (p. ej. `"No encontrado"` en el handler global).
- **Evidencia:** ambos cuerpos capturados arriba.
- **Estado:** RESUELTO (2026-06-27) — `apps/api/src/middleware/error.ts` responde `{"error":"No encontrado"}`; ambos 404 quedan en español.

### [H-03] CD-9 — Casing inconsistente "Stop At Nothing" vs "Stop at Nothing"
- **Severidad:** Bajo
- **Tipo:** Datos (consistencia de marca)
- **Dónde:** `GET /api/products` (`line` de `stop-at-nothing-blanco`) vs `GET /api/content` (`marquee`).
- **Pasos para reproducir:**
  1. `curl .../api/products` → `line` del producto blanco = `"Stop At Nothing"` (A mayúscula).
  2. `curl .../api/content` → `marquee` contiene `"Stop at Nothing"` (a minúscula).
- **Esperado:** una sola forma canónica del eslogan en toda la marca.
- **Actual:** dos casings distintos entre la línea de producto y el copy de marketing.
- **Impacto:** defecto cosmético de consistencia de marca; visible si producto y marquee aparecen juntos en la misma pantalla.
- **Recomendación:** elegir un casing canónico (p. ej. `Stop at Nothing`) y aplicarlo en seed de productos y en el copy.
- **Evidencia:** valores capturados arriba.
- **Estado:** RESUELTO (2026-06-27) — `apps/api/prisma/seed.ts` usa `Stop at Nothing`; `seed.test.ts` actualizado.

### [H-04] Ruteo de path case-insensitive mientras el slug es case-sensitive
- **Severidad:** Bajo
- **Tipo:** Funcional
- **Dónde:** ruteo Express (default `case sensitive routing` desactivado).
- **Pasos para reproducir:**
  1. `curl http://localhost:4000/API/products` → `200` con la lista completa.
  2. Comparar con TC-CAT-019: `/api/products/Champion-Mentality-...` (slug en mayúsculas) → `404`.
- **Esperado:** comportamiento de casing consistente, o documentado, entre path y slug.
- **Actual:** el **path** resuelve sin distinguir mayúsculas (`/API/products` == `/api/products`), pero el **slug** sí distingue. Inconsistencia.
- **Impacto:** bajo. Posibles URLs duplicadas (caché/SEO) y comportamiento sorpresivo para integradores. No hay riesgo de seguridad.
- **Recomendación:** decidir el contrato; si se quiere estricto, activar `case sensitive routing` en Express. Si no, documentarlo.
- **Evidencia:** `/API/products` → `200` con los 4 productos.
- **Estado:** RESUELTO (2026-06-27) — `app.set('case sensitive routing', true)` en `apps/api/src/app.ts`; `/API/products` ahora `404`.

---

### Notas de entorno
- Mutaciones de DB (TC-CAT-005/012/016/026/030) ejecutadas vía Prisma sobre `apps/api/prisma/dev.db` y **restauradas y verificadas**: estado final = 4 productos `active`, `DropConfig` y `SiteContent` re-creados desde snapshot. No quedaron cambios residuales.
- Pruebas corridas con `NODE_ENV` de desarrollo (los `500` muestran el hint en español; en producción se enmascaran — fuera de alcance del módulo).
