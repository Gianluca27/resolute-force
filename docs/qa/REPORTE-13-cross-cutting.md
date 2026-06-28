# Reporte de QA — Resolute Force (Módulo 13 · Cross-cutting) — 2026-06-27

## 1. Resumen ejecutivo

- **Alcance probado:** los 48 casos del archivo `docs/qa/13-cross-cutting.md` (TC-XC-001..048) — Helmet, CORS, límites de body, rate limiting, envelope de errores y enmascarado en prod, guards de boot (`env.ts`), i18n/formato de moneda, visit tracking, exposición de secretos, stored-XSS y manejo de métodos/concurrencia. Más testing exploratorio (trust proxy, residuos de tracking, prefijo bcrypt).
- **Entorno:** API en `:4000` (seeded, NODE_ENV=development) + web en `:5173`. Los casos destructivos (caps de rate-limit, path que tira 500, fallo de DB en tracking, boot en prod) se corrieron en **instancias descartables aisladas** (`:4101–:4106`) con copias de la DB, para no contaminar el limiter ni la data del server del usuario. Todo se limpió al terminar.
- **Conteo:** **PASS 47 · FAIL 0 · BLOQUEADO/PARCIAL 1.**
- **Hallazgos por severidad:** 0 Críticos · 0 Altos · 1 Medio · 2 Bajos. (Ningún defecto funcional bloqueante; los hallazgos son riesgos de deploy / ruido en dev.)
- **Veredicto general:** ✅ La capa cross-cutting está **sólida y bien endurecida**. Todos los controles de seguridad (headers, masking, secretos server-only, escape de XSS, guards de boot, brute-force) funcionan como se espera. Varias expectativas del doc quedaron **desactualizadas porque el código mejoró** (404 ahora en español, JSON malformado ahora 400 en vez de 500): hay que actualizar el doc, no el código.

### Top hallazgos
1. **[Medio]** Rate limiting por IP sin `trust proxy` → detrás de un reverse proxy/LB en prod, todos los clientes pueden compartir un único bucket (lockout masivo) o saltearlo vía `X-Forwarded-For`. No reproducible en single-host; riesgo de deploy.
2. **[Bajo]** La landing dispara `POST /api/track` **2 veces** por mount en dev (React StrictMode). Inofensivo en build de prod (1 vez), pero infla analytics en dev.
3. **[Bajo]** Hash de admin es `$2a$12$` (el doc dice `$2b$`); `bcryptjs` emite `$2a$`, cost 12 correcto — solo actualizar el doc.

---

## 2. Resultados por caso del archivo

| Caso | Resultado | Nota |
|------|-----------|------|
| TC-XC-001 nosniff | PASS | `X-Content-Type-Options: nosniff` + HSTS, X-DNS-Prefetch-Control, X-Frame-Options |
| TC-XC-002 X-Powered-By suprimido | PASS | Ausente |
| TC-XC-003 frame protection | PASS | `X-Frame-Options: SAMEORIGIN` + CSP `frame-ancestors 'self'` |
| TC-XC-004 headers en error/404 | PASS | nosniff presente en 404 y en 500; sin X-Powered-By |
| TC-XC-005 CORS origin permitido | PASS | ACAO `http://localhost:5173` + `Allow-Credentials: true` |
| TC-XC-006 CORS origin no permitido | PASS | Nunca eco del origin malicioso; devuelve el origin fijo configurado → browser bloquea |
| TC-XC-007 preflight OPTIONS | PASS | `204` + ACAO + Allow-Methods + Allow-Headers reflejados |
| TC-XC-008 sin Origin | PASS | `200` normal |
| TC-XC-009 body >1mb → 413 | PASS | `413` `{"error":"Solicitud demasiado grande"}` |
| TC-XC-010 body bajo límite | PASS | `200 {"ok":true}` |
| TC-XC-011 JSON malformado | PASS ⚠️ | **`400` `{"error":"JSON inválido"}`** — el doc esperaba 500 (override). El `errorHandler` ahora respeta 4xx: mejora, cierra el gap que el propio doc marcaba |
| TC-XC-012 /api 300 ok / 301 → 429 | PASS | Permitidos exactamente 300; 301° → `429` `"Demasiadas solicitudes. Probá de nuevo más tarde."` |
| TC-XC-013 headers standard / legacy ausente | PASS | `RateLimit-Limit/Remaining/Reset/Policy` presentes; sin `X-RateLimit-*` |
| TC-XC-014 login 10 ok / 11 → 429 | PASS | 10×`401` luego `429` `"Demasiados intentos de acceso. Probá de nuevo más tarde."` |
| TC-XC-015 login consume budget global | PASS | Empírico: 187 restantes = 11 logins + 100 reads + 2 health contabilizados globalmente |
| TC-XC-016 reset de ventana 15min | PARCIAL | No se esperó la ventana completa de 15 min. Mecanismo verificado: `RateLimit-Reset` decrementa, store in-memory, instancias frescas siempre con 300, restart resetea |
| TC-XC-017 429 con retry hints | PASS | `Retry-After: 818` + `RateLimit-Reset: 818` + envelope JSON |
| TC-XC-018 error → envelope JSON | PASS | `500` `application/json` `{"error":...}` |
| TC-XC-019 prod enmascara mensaje | PASS | Exactamente `{"error":"Error interno del servidor"}`; sin fuga de mensaje/stack/Prisma/path |
| TC-XC-020 non-prod expone mensaje | PASS | `{"error":"DropConfig no inicializado — corré el seed"}` |
| TC-XC-021 404 global envelope | PASS ⚠️ | `404` JSON OK, pero body **`"No encontrado"` (español)**, no `"Not found"` (inglés). El código cambió |
| TC-XC-022 404 idiomas mixtos (CD-2) | PASS ⚠️ | **CD-2 RESUELTO:** global 404 = `"No encontrado"`, producto 404 = `"Producto no encontrado"` — ambos en español. La inconsistencia que el doc quería confirmar ya no existe |
| TC-XC-023 errores nunca HTML | PASS | 404 y 500 siempre JSON, `content-type: application/json` |
| TC-XC-024 prod rechaza JWT default | PASS | Throw exacto: `JWT_SECRET must be set to a strong, unique value in production...` |
| TC-XC-025 prod rechaza MP placeholder | PASS | Throw exacto: `MP_ACCESS_TOKEN must be a real MercadoPago token in production` |
| TC-XC-026 secret <32 falla / ==32 pasa | PASS | `<32` falla en dev (no es prod-only); 32 exactos pasa |
| TC-XC-027 prod bootea con secretos reales | PASS | `parseEnv` ok + instancia `:4102` levanta y `GET /api/health` → `200` |
| TC-XC-028 dev bootea con defaults | PASS | Sin throw |
| TC-XC-029 `<html lang="es-AR">` | PASS | Confirmado en DOM renderizado |
| TC-XC-030 moneda con punto de miles | PASS | `$30.000` en landing |
| TC-XC-031 montos grandes agrupan | PASS | Formateador de la app (`toLocaleString('es-AR')`): `$100.000`, `$1.234.567`. No se armó carrito de 7 cifras en UI; verificado con el formateador exacto |
| TC-XC-032 copy es-AR | PASS | Página + strings de error con voseo (`corré`, `Probá`). La excepción del doc (404 inglés) ya está corregida → todo español |
| TC-XC-033 track path normal | PASS | `200` + fila Visit `path="/TEST_QA_normal"` |
| TC-XC-034 path faltante → "/" | PASS | `{}` y sin body → `"/"` |
| TC-XC-035 path largo → slice 200 | PASS | 300 chars → almacenado len=200 |
| TC-XC-036 tipo inválido → "/" | PASS | number / array / object / null → todos `"/"` |
| TC-XC-037 fallo de DB tragado | PASS | Con tabla `Visit` dropeada → `200 {"ok":true}` igual |
| TC-XC-038 track público sin auth | PASS | `200` sin auth y con Origin arbitrario |
| TC-XC-039 track 1 vez por mount | PASS ⚠️ | `useEffect([])` de un solo mount; en dev se observan **2** llamadas por React StrictMode (double-invoke). En build de prod dispara 1. Ver H-02 |
| TC-XC-040 public-key solo pública | PASS | `{"publicKey":"..."}` y nada más |
| TC-XC-041 access token nunca expuesto | PASS | Sin `accessToken`/`MP_ACCESS_TOKEN` en public-key, content, products, drop ni errores |
| TC-XC-042 JWT 12h + bcrypt cost 12 | PASS ⚠️ | `exp-iat=43200s (12h)`; hash `$2a$12$` (doc dice `$2b$`; `bcryptjs` usa `$2a$`, cost 12 OK) |
| TC-XC-043 XSS inerte en landing | PASS | `<img onerror>` y `<script>` renderizados como texto inerte (`&lt;img` en el HTML), sin alert, sin request de imagen, sin error de consola |
| TC-XC-044 contenido guardado verbatim | PASS | Round-trip exacto de `<img...>`, `<b>x</b> & 'q' "q"` y `<script>` — sin sanitización en write |
| TC-XC-045 método no soportado → 404 | PASS | DELETE/PUT/POST → `404 {"error":"No encontrado"}`, sin 405 |
| TC-XC-046 reads concurrentes sin corromper | PASS | 100 reads concurrentes (50 content + 50 drop) todos `200`, content idéntico, JSON válido |
| TC-XC-047 read durante write consistente | PASS | 0 reads "torn" (mezcla viejo/nuevo) sobre 100 reads alrededor de un PUT |
| TC-XC-048 contador exacto bajo ráfaga | PASS | 320 concurrentes → 300 permitidos / 20 `429`, sin miscount por carrera |

⚠️ = desvío respecto del *valor esperado del doc*, pero por **mejora del código**. No es bug: hay que actualizar el doc.

---

## 3. Hallazgos exploratorios

### H-01 Rate limiting por IP sin `trust proxy` configurado
- **Severidad:** Medio
- **Tipo:** Funcional (seguridad/disponibilidad)
- **Dónde:** `apps/api/src/app.ts` (`apiLimiter`/`loginLimiter`), no hay `app.set('trust proxy', ...)`.
- **Pasos para reproducir:** code-level — `express-rate-limit` keyea por `req.ip`. Sin `trust proxy`, detrás de un reverse proxy/LB `req.ip` es la IP del proxy para todos.
- **Esperado:** que el límite por-IP siga siendo efectivo en producción detrás de proxy.
- **Actual:** en single-host (testeado) funciona perfecto. En deploy detrás de proxy: o **todos comparten un bucket** (un solo cliente abusivo bloquea a todos al llegar a 300) o, si se setea mal `trust proxy`, se puede **saltear** falsificando `X-Forwarded-For`. Además el store in-memory hace que el límite sea **por-instancia** (N instancias = N×300) y se resetee en cada deploy.
- **Impacto:** en prod multi-instancia/proxy, el control anti-abuso puede ser inefectivo o causar lockout masivo de usuarios legítimos.
- **Nota:** **No reproducido en este entorno** (single-host); es un riesgo de configuración de deploy, no un defecto confirmado en runtime local. Recomendación: setear `trust proxy` acorde a la topología y considerar un store compartido (Redis) si hay múltiples instancias.

### H-02 La landing dispara `POST /api/track` dos veces por mount en dev
- **Severidad:** Bajo
- **Tipo:** Funcional
- **Dónde:** `apps/web/src/pages/Landing.tsx:19` (`useEffect(..., [])`) + `main.tsx` (`<StrictMode>`).
- **Pasos para reproducir:** cargar `http://localhost:5173/` y mirar Network → 2 `POST /api/track`.
- **Esperado:** 1 llamada por mount (lo que pide TC-XC-039).
- **Actual:** 2 llamadas, por el double-invoke de efectos de React StrictMode en desarrollo.
- **Impacto:** en dev infla las visitas (doble conteo). En **build de producción StrictMode no duplica efectos → 1 llamada**, así que no afecta prod.
- **Nota:** Re-correr TC-XC-039 contra un build de producción para validación final. Evidencia: captura del estado observado (Network con requests #69 y #73).

### H-03 Prefijo de hash bcrypt `$2a$` vs `$2b$` del doc
- **Severidad:** Bajo
- **Tipo:** Datos (discrepancia de documentación)
- **Dónde:** hash de `AdminUser.passwordHash`; doc TC-XC-042.
- **Esperado (doc):** `$2b$12$...`.
- **Actual:** `$2a$12$...` (cost 12 correcto). `bcryptjs` emite `$2a$` por defecto; es funcionalmente equivalente.
- **Impacto:** ninguno real; solo confunde al validar contra el doc.
- **Nota:** actualizar el doc para que espere `$2a$12$` (o `$2[ab]$12$`).

---

## 4. Huecos de cobertura (sugerencias para el set de pruebas)

1. **Doc desactualizado (prioritario):** actualizar valores esperados que el código ya mejoró —
   - TC-XC-011: JSON malformado → **400 `"JSON inválido"`** (no 500).
   - TC-XC-021/022/032: 404 global → **`"No encontrado"` (español)**; **CD-2 quedó resuelto** (ya no hay 404 en inglés). El doc todavía describe la inconsistencia como vigente.
   - TC-XC-042: hash `$2a$` (no `$2b$`).
2. **`trust proxy` / rate limiting en prod (H-01):** agregar un caso que valide el comportamiento del limiter detrás de proxy y con `X-Forwarded-For` (no cubierto hoy).
3. **TC-XC-016 reset real de ventana:** agregar variante con `windowMs` reducido en build de test para validar el reset sin esperar 15 min.
4. **TC-XC-039 en build de prod:** el caso actual solo es confiable contra prod (StrictMode falsea el conteo en dev). Aclararlo en el doc.
5. **413 también en endpoints autenticados:** TC-XC-009 solo prueba `/api/track`. Sumar un POST admin (p.ej. `PUT /api/admin/config/content`) para confirmar que el límite de 1mb aplica antes del auth.
6. **CORS con credenciales + `Vary: Origin`:** validar que no haya caching cruzado de ACAO (no testeado).
7. **Errores 4xx de body-parser en prod:** confirmar que el `"JSON inválido"`/`"Solicitud demasiado grande"` no se enmascaran en prod (son 4xx, se respetan) — distinto del masking de 500.
8. **Tamaño de payload del rate-limit / flood de `Visit`:** el endpoint público `/api/track` escribe sin auth; documentar el límite efectivo de filas por IP/ventana.

---

## 5. Detalle de hallazgos (ordenados por severidad)

> Detalle completo en la sección 3. Resumen ordenado:

| ID | Severidad | Tipo | Título |
|----|-----------|------|--------|
| H-01 | Medio | Funcional | Rate limiting por IP sin `trust proxy` (riesgo en deploy detrás de proxy) |
| H-02 | Bajo | Funcional | `POST /api/track` x2 por mount en dev (React StrictMode) |
| H-03 | Bajo | Datos | Hash bcrypt `$2a$` vs `$2b$` del doc |

**Sin hallazgos Críticos ni Altos.** Los controles de seguridad cross-cutting (masking de errores en prod, secretos server-only, escape de XSS de React, guards de boot, brute-force en login, headers de Helmet) pasaron todos.
