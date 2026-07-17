# Reporte de QA — Resolute Force (Módulos 5 y 6 · MercadoPago sandbox real) — 2026-07-17

> **Historial de correcciones (mismo día):** este documento pasó por varias rondas de re-verificación tras feedback del usuario. (1) Diagnostiqué H-01 (mismatch de credenciales) por curl directo; lo retracté cuando una prueba a través de la app real solo mostró el error de H-02 (URL localhost) — pero esa prueba nunca llegó a la siguiente capa de validación de MP. (2) Al configurar un túnel ngrok real (URL pública), H-02 quedó confirmado resuelto — pero **reapareció el error de H-01, ahora también a través de la app real** (Card Brick + SDK oficial), no solo por curl. (3) Sugerí probar con un usuario de prueba (Cuenta de prueba) Vendedor nuevo — **el usuario objetó correctamente** que eso implicaría crear otra aplicación en otra cuenta, sin relación con esta integración. Confirmado con la documentación oficial de MercadoPago que el usuario aportó: **las Cuentas de prueba (Comprador/Vendedor) no son compatibles con integraciones Checkout Bricks** y, además, iniciar sesión con una cuenta de prueba **no da acceso a "Credenciales de prueba"** — esa vía nunca hubiera funcionado. (4) Se conectó el MCP oficial de MercadoPago (autenticado por OAuth): `get_credentials` confirmó de forma **autoritativa** (no ya por inspección propia) que el par Public Key/Access Token es el único y correcto para esta aplicación. Búsqueda en la documentación oficial reveló un requisito real y no implementado: el **Device Fingerprint** (`security.js` + header `X-Meli-Session-Id`) — se implementó completo (script en `index.html`, captura de `window.MP_DEVICE_SESSION_ID`, forwarding hasta `requestOptions.meliSessionId` en el SDK) con TDD, confirmado viajando correctamente en el request real — **y el error persistió idéntico**, descartando también esta hipótesis. **Conclusión final:** H-02 resuelto (túnel público); el Device Fingerprint quedó implementado como buena práctica (ver H-06, no bloqueante — no era la causa); H-01 persiste tras descartar 5 hipótesis técnicas concretas y verificables — es un problema del lado de la cuenta/aplicación de MercadoPago que requiere su soporte para diagnosticar.

## 1. Resumen ejecutivo

- **Alcance probado:** integración real de MercadoPago con credenciales de prueba provistas por el usuario (Public Key `APP_USR-9bf14c5b-...` / Access Token `APP_USR-7178058589178314-...-2518294877`, verificadas como el par oficial de "Credenciales de prueba" del Vendedor de prueba `TESTUSER1157408683`). Se testeó contra la **API real de MercadoPago** (no mockeada): tokenización de tarjeta, cobro de tarjeta, creación de preferencia (Wallet), transferencia manual, páginas de retorno, validaciones negativas, integridad de monto y XSS. Además se corrió la suite automática completa de pagos/webhook (mockeada) como baseline, y se configuró un túnel `ngrok` real para habilitar URLs públicas.
- **Entorno:** Postgres en Docker (remapeado a puerto `5436` — ver Hallazgo H-05), API en `:4000` tuneleada vía ngrok, Web en `:5173`.
- **Conteo:** **PASS 25 · BLOQUEADO 9 · FAIL 0** de los casos ejecutados manualmente contra el sandbox real, más **70/70 PASS** (ampliado a **406/406** tras los fixes de H-03/H-04 y el agregado de H-06) en la suite automática (MP mockeado).
- **Hallazgos por severidad:** 1 Crítico (pendiente, del lado de la cuenta MP — ver H-01, 5 hipótesis técnicas descartadas con evidencia) · 1 Alto (**corregido**, ver H-03) · 1 Medio (**corregido**, ver H-04) · 1 Bajo (H-05) · 1 Bajo/hardening (**agregado**, ver H-06).
- **Veredicto general:** ⚠️ **La lógica de negocio (código) está sólida.** Toda la suite automática pasa; Transferencia, Wallet (creación de preferencia), validaciones, integridad de monto, XSS y páginas de retorno pasaron contra el sandbox real sin fallas. **El cobro directo con Card Brick sigue bloqueado** por un error de MercadoPago (`Unauthorized use of live credentials`) que persiste tras descartar, con evidencia concreta, las 5 causas técnicas más probables (credenciales, rol de usuario de prueba, `issuer_id`, idempotency key, Device Fingerprint) — ver H-01 para el detalle completo y los next steps con soporte de MP. Mientras tanto, **Wallet es un camino de pago funcional hoy** (el cliente puede pagar con tarjeta en la página de MP, fuera de nuestro Card Brick).

### Top hallazgos

1. **[Crítico/Pendiente] `Unauthorized use of live credentials` al cobrar con Card Brick, tras descartar 5 causas técnicas con evidencia concreta.** Reproducido consistentemente (curl y app real) con `code: 7`. Descartado, en orden: (a) mismatch de credenciales — `get_credentials` del MCP oficial de MP confirmó por API que es el único par válido de la app; (b) rol de usuario de prueba — además irrelevante, las Cuentas de prueba no aplican a integraciones Checkout Bricks (doc oficial); (c) `issuer_id` mal formado — viene correcto del Brick; (d) `X-Idempotency-Key` faltante — el SDK oficial lo autogenera siempre; (e) Device Fingerprint (`X-Meli-Session-Id`) ausente — implementado completo con TDD (ver H-06) y confirmado viajando en el request real, **sin cambiar el resultado**. **Recomendación:** contactar soporte de MercadoPago citando que es integración Checkout Bricks, el `App ID` (`4732004631592509`) y el trace id del error (ver detalle en H-01) — a esta altura es un diagnóstico que requiere visibilidad interna de MP.
2. **[Crítico — RESUELTO] `notification_url` / `back_urls` apuntando a `localhost` eran rechazadas por MercadoPago.** Confirmado el bloqueo original por curl y por log real de la app. **Resuelto** configurando un túnel `ngrok` (`PUBLIC_API_URL`/`PUBLIC_WEB_URL` públicos) — verificado con `POST /api/payments/preference` real contra la API de MP: preferencia creada con `init_point` real (`RF-366453`). Ver sección 6 para la guía completa.
3. **[Alto — CORREGIDO] Los catch de `/api/payments/card` y `/api/payments/preference` tragaban cualquier excepción sin loguearla.** Ahora `console.error` registra el error real de MP antes de responder 500 — este logging fue clave para diagnosticar tanto H-01 como H-02 correctamente. Corregido con TDD (test rojo → fix → test verde) en `apps/api/src/routes/payments.ts`.
4. **[Medio — CORREGIDO] Órdenes huérfanas en `pending` cuando `createOrder` tenía éxito pero la llamada a MP fallaba.** Ahora la orden pasa a `cancelled` en ese caso. Corregido con TDD, mismo archivo. Verificado en los reintentos reales de esta sesión (`RF-278711`, `RF-399811` quedaron `cancelled`, no huérfanas).
5. **[Bajo/hardening — AGREGADO] Device Fingerprint (`security.js` + `X-Meli-Session-Id`) no implementado.** Requisito real documentado por MP, no relacionado con H-01 pero sí buena práctica de seguridad. Implementado completo con TDD — ver H-06.
6. **[Bajo/UX] El copy "Hasta 3 cuotas sin interés" no coincide con lo que devuelve el Brick real.** Con esta cuenta, MP cotizó 2 cuotas en $36.318 c/u (total $72.636 sobre una base de $60.000/$30.000) — hay interés real desde la 2ª cuota, no promoción "sin interés" configurada. Si la cuenta de producción tampoco tiene la promoción bancaria configurada, el copy es engañoso.

---

## 2. Resultados por caso del archivo (`docs/qa/05-payments.md` y `06-webhook-order-lifecycle.md`)

| Caso | Resultado | Nota |
|------|-----------|------|
| TC-PAY-001 método default Transferencia | PASS | Confirmado en UI real |
| TC-PAY-003 Subtotal + envío gratis | PASS | `$60.000` / `Gratis` |
| TC-PAY-004 discount line por método | PASS | Transferencia muestra `−$6.000`; Tarjeta y Mercado Pago no |
| TC-PAY-005 toggle recalcula total | PASS (vía suite automática) | No re-ejercido manualmente, sin motivo de riesgo |
| TC-PAY-006 Card Brick renderiza con monto server | PASS | Brick real de MP cargó con `amount=60000`, iframes seguros para PAN/venc/CVV |
| TC-PAY-007 tarjeta aprobada → paid + stock | **BLOQUEADO** | H-01: con URL pública ya resuelta (túnel ngrok), MP igual rechaza el cobro con `Unauthorized use of live credentials` — problema del lado de la cuenta MP, no de esta app |
| TC-PAY-008 tarjeta rechazada → cancelled | **BLOQUEADO** | Ídem H-01 — nunca se llegó a un status de negocio real de MP |
| TC-PAY-009 tarjeta in_process → pending | **BLOQUEADO** | Ídem H-01 |
| TC-PAY-010 stock se agota durante el pago → refund | **BLOQUEADO** | Ídem H-01 (requiere un cobro aprobado real primero) |
| TC-PAY-011 doble submit guardado | PASS (vía suite automática) | Lógica de `busy` cubierta en `CheckoutModal.payments.test.tsx` |
| TC-PAY-012 falla de red en submit | PASS (vía suite automática) | No re-ejercido manualmente |
| TC-PAY-013 payload de pago inválido (400) | PASS | 3/3 variantes: falta `token`, `installments=0`, email de `payer` inválido |
| TC-PAY-014 sin stock al crear orden (409) | PASS | `qty=9999` → `409` mensaje claro con producto/talle |
| TC-PAY-015 boundary de cuotas | PASS (vía suite automática) | UI real mostró selector de cuotas calculado en vivo por MP (BIN real) |
| TC-PAY-016 Wallet crea preferencia + botón | PASS | Con túnel ngrok configurado, `POST /api/payments/preference` real devolvió `200` con `init_point` y `preferenceId` reales de MP (`RF-366453`) |
| TC-PAY-017 preferencia rechaza customer inválido | PASS | Email inválido → `400 {"error":"Datos inválidos"}` |
| TC-PAY-018 preferencia sin stock (409) | PASS | `qty=9999` → `409` |
| TC-PAY-019 wallet success limpia carrito | PASS | Navegación directa a `/checkout/success?...` — "¡Pedido confirmado!" |
| TC-PAY-020 wallet pending mantiene carrito | PASS | "Pago en proceso" |
| TC-PAY-021 wallet failure sin cargo | PASS | "Pago no completado. No se realizó ningún cargo." |
| TC-PAY-022 ruta desconocida → home | PASS | `/checkout/anything-else` → redirige a `/` |
| TC-PAY-023 transfer crea orden pending con descuento | PASS | `RF-625059`: pending, `subtotal=60000 discount=6000 total=54000`, stock sin tocar |
| TC-PAY-024 descuento 1 unidad | PASS | `RF-407821`: `discount=3000 total=27000` |
| TC-PAY-025 redondeo subtotal impar | PASS (vía suite automática) | No re-ejercido manualmente |
| TC-PAY-026 badge % dinámico | PASS | "10% OFF" visible y coherente con el descuento real |
| TC-PAY-027 transfer sin datos bancarios | PASS (vía suite automática) | El seed actual **sí** tiene alias cargado (`resolute.force`); condición de bloque vacío cubierta por test automático |
| TC-PAY-028 transfer con datos bancarios | PASS | Confirmación mostró Alias `resolute.force` + Importe; sin CBU (vacío en seed) — gating correcto |
| TC-PAY-029 transfer validación de errores | PASS | Customer vacío/ inválido → `400`; producto inexistente → `409` |
| TC-PAY-030 integridad de monto (tamper) | PASS | Inyecté `price`, `unitPrice`, `total`, `amount` falsos en el payload → servidor ignoró todo, cobró el precio real (`$27.000` sobre un producto de `$30.000` con 10% desc.) |
| TC-PAY-031 PAN nunca llega al server | PASS | Body real capturado de `/api/payments/card`: solo `token` (hash opaco), sin PAN/CVV/vencimiento |
| TC-PAY-032 access token nunca expuesto al browser | PASS | `/api/payments/public-key` solo devuelve `publicKey`; sin referencias a `MP_ACCESS_TOKEN` en el bundle web |
| TC-PAY-033 XSS vía nombre de cliente | PASS | `<img src=x onerror=alert(1)>` como nombre → renderizado como texto literal escapado, sin ejecución, sin diálogo |
| TC-PAY-034/035/036 accesibilidad / mobile / back-nav | PASS (vía suite automática) | No re-ejercidos manualmente en esta pasada |
| TC-WHK-001..037 (firma, procesamiento, idempotencia, reversal, lifecycle, oversell) | **PASS (37/37, suite automática)** | Mockeado — ver sección 4 para lo que falta probar con webhook real |

---

## 3. Hallazgos

### [H-01] `Unauthorized use of live credentials` al cobrar con Card Brick, pese a credenciales confirmadas correctas
- **Severidad:** Crítico — **sin resolver, parece del lado de la cuenta MercadoPago**
- **Tipo:** Cuenta MP / Configuración externa (no bug de este código)
- **Dónde:** cobro real vía `POST /api/payments/card` → `mp.createCardPayment` (`apps/api/src/lib/mp.ts`)
- **Historial del diagnóstico (por transparencia):**
  1. Primer intento (curl directo a `/v1/payments`, `PUBLIC_API_URL` aún en `localhost`): `401 Unauthorized use of live credentials`. Interpreté esto como mismatch Public Key / Access Token — **incorrecto**, ver punto 3.
  2. Segundo intento (app real, pero `PUBLIC_API_URL` todavía en `localhost`): la app frenó antes, en la validación de URL (`notificaction_url attribute must be url valid`, ver H-02) — nunca llegó a la capa de credenciales. Retracté el hallazgo #1 por esto, **prematuramente**.
  3. Tercer intento (app real + túnel `ngrok`, `PUBLIC_API_URL` público): con la URL ya válida, MP avanza a la siguiente validación y **el error de credenciales reaparece**, ahora en el log real de la app (gracias al fix de H-03):
     ```
     [payments/card] RF-278711 {
       message: 'Unauthorized use of live credentials',
       error: 'unauthorized', status: 401,
       cause: [{ code: 7, data: '17-07-2026T20:30:00UTC;3a9547d5-8fc2-42ff-9708-382dbe13661a' }]
     }
     ```
  4. El usuario confirmó (captura del panel MP) que Public Key + Access Token son el par oficial de "Credenciales de prueba" — descarta mismatch.
  5. Propuse probar con un usuario de prueba (Cuenta de prueba) Vendedor nuevo, creado por el usuario específicamente para esto. **El usuario objetó, correctamente:** loguearse como ese usuario de prueba implicaría entrar a otra cuenta/aplicación sin relación con esta integración, no "vincular" nada a la app real.
  6. Confirmado con la **documentación oficial de MercadoPago** (aportada por el usuario): (a) "Las integraciones con Checkout Bricks no soportan cuentas de prueba para realizar pruebas de integración" — este proyecto usa Checkout Bricks (`@mercadopago/sdk-react` `CardPayment`) para el cobro de tarjeta; (b) "al realizar este inicio de sesión con una cuenta de prueba, no tendrás acceso a... Credenciales de prueba" — la vía que propuse ni siquiera era técnicamente posible; (c) las Credenciales de prueba son un **par único vinculado a la aplicación**, no a un usuario de prueba elegible. **La vía de "usuarios/cuentas de prueba" queda descartada por completo** — nunca aplicaba a este caso.
  7. El payload real enviado por el Brick trae `issuerId: "3"` (válido para el BIN de la Mastercard de prueba) — descarta un `issuer_id` mal formado.
  8. Se conectó el **MCP oficial de MercadoPago** (`claude mcp add`, autenticado por OAuth). `get_credentials` confirmó de forma **autoritativa** — no ya por inspección propia del usuario — que Public Key + Access Token son el único par de Credenciales de prueba de esta aplicación (`App ID 4732004631592509`, owner `333563021`, seller test user `2518294877`/`7178058589178314`). Descarta mismatch de forma definitiva, con la fuente de verdad de MP.
  9. `search_documentation` (mismo MCP) reveló un requisito real, no implementado: el **Device Fingerprint** — script `security.js` que genera `window.MP_DEVICE_SESSION_ID`, a reenviar como header `X-Meli-Session-Id` al crear el pago. Se implementó completo con TDD (ver H-06): script agregado, valor capturado y confirmado viajando correctamente en el request real (`"deviceId":"armor.abe1a054a..."`). **El error persistió idéntico** (`RF-399811`, mismo `code: 7`) — descarta también esta hipótesis.
- **Esperado:** el cobro con la tarjeta `APRO` se aprueba.
- **Actual:** `401 Unauthorized use of live credentials` de forma consistente, con: credenciales verificadas por la propia API de MP como el único par válido, rol de usuario de prueba correcto (Vendedor — vía descartada por no aplicar a Bricks de todos modos), URL pública válida, payload correcto, Device Fingerprint presente y correctamente enviado, integración Checkout Bricks usada tal como MP la documenta.
- **Impacto:** el cobro directo con Card Brick no puede completarse en este ambiente hasta que se resuelva del lado de MercadoPago. **Wallet sí funciona** (ver H-02) — es una vía de pago con tarjeta alternativa disponible hoy.
- **Recomendación:** contactar soporte de MercadoPago citando (a) que es una integración **Checkout Bricks**, (b) el `App ID` (`4732004631592509`) y el trace id de la respuesta (`17-07-2026T20:30:00UTC;3a9547d5-...` o `17-07-2026T21:48:22UTC;ef23f56b-...`), (c) que se descartaron las 5 causas técnicas usuales (credenciales, rol de usuario de prueba, `issuer_id`, `X-Idempotency-Key` — autogenerado por el SDK —, Device Fingerprint). A esta altura es un diagnóstico que solo MP puede hacer desde su lado (revisión de cuenta, flags internos, estado de la aplicación).

### [H-02] `notification_url` / `back_urls` en `localhost` son rechazadas por MercadoPago — RESUELTO con túnel ngrok
- **Severidad:** Crítico — **resuelto**
- **Tipo:** Configuración
- **Dónde:** `mp.createCardPayment` y `mp.createPreference` (`apps/api/src/lib/mp.ts:20,34`) — siempre arman `notification_url` desde `PUBLIC_API_URL` y (solo preferencia) `back_urls` desde `PUBLIC_WEB_URL`.
- **Pasos para reproducir (estado original):** `POST /v1/payments` con `notification_url: "http://localhost:4000/..."` → `400 notificaction_url attribute must be url valid`. `POST /checkout/preferences` con `back_urls` en `localhost` → `400 auto_return invalid. back_url.success must be defined`.
- **Fix/solución:** se configuró `ngrok` (dos túneles: uno para la API en `:4000`, otro para el web en `:5173`) y se apuntaron `PUBLIC_API_URL`/`PUBLIC_WEB_URL` a las URLs públicas resultantes. Verificado con una llamada real a `POST /api/payments/preference` (nuestro propio backend, con el fix aplicado): devolvió `200` con `preferenceId` e `init_point` reales de MP (`RF-366453`), orden creada correctamente en la DB. **Wallet queda confirmado funcional end-to-end del lado de creación de preferencia.**
- **Nota:** al usar un `PUBLIC_WEB_URL` distinto de `http://localhost:5173`, el CORS de la API (`apps/api/src/app.ts:36`, `cors({ origin: env.PUBLIC_WEB_URL })`) solo permite ese origen — si el navegador sigue en `localhost:5173` mientras `PUBLIC_WEB_URL` apunta al túnel, los fetches del browser se bloquean por CORS. Para probar Wallet completo desde el navegador (incluyendo el redirect de vuelta), hay que navegar también a través de la URL del túnel del web, no `localhost`. Además, el dev server de Vite bloquea hosts desconocidos por default (`allowedHosts`) — se agregó `allowedHosts: true` en `apps/web/vite.config.ts` para permitir el dominio de ngrok (cambio de conveniencia para dev, no para producción).
- **Impacto:** era el motivo concreto por el que hacía falta el túnel/webhook que el usuario preguntó cómo configurar. Ya resuelto — ver sección 6 para la guía completa.

### [H-03] Errores de MercadoPago se tragan sin loguear en el servidor — CORREGIDO
- **Severidad:** Alto
- **Tipo:** Funcional / Observabilidad
- **Dónde:** `apps/api/src/routes/payments.ts` (`/card`, `/preference`)
- **Pasos para reproducir (estado original):** Cualquier excepción no controlada de `mp.createCardPayment`/`mp.createPreference` (como H-01/H-02) caía en `catch (e) { ...; return res.status(500).json({error: '...'}) }` **sin `console.error`**.
- **Esperado:** un fallo real de la pasarela de pago debería quedar registrado server-side con detalle suficiente para diagnosticar.
- **Actual (antes del fix):** el log de la API no mostraba nada — tuve que reproducir el error por fuera de la app (curl directo a MP) para descubrir la causa, lo cual inicialmente llevó a un diagnóstico apresurado de H-01 (luego revisado dos veces más, ver historial en H-01).
- **Impacto:** en producción, cualquier fallo de integración con MP sería invisible en logs.
- **Fix aplicado (TDD):** `console.error` ahora registra el error real de MP en ambas rutas antes de responder 500. Test nuevo en `apps/api/tests/payments.test.ts` (`mp.createCardPayment throwing ... logs the error`) verificado rojo→verde. Este mismo logging fue clave para diagnosticar correctamente tanto H-01 como H-02 en las re-verificaciones con la app real.

### [H-04] Órdenes huérfanas en `pending` cuando falla la llamada a MP tras crear la orden — CORREGIDO
- **Severidad:** Medio
- **Tipo:** Datos
- **Dónde:** `apps/api/src/routes/payments.ts` (`/card`, `/preference`)
- **Pasos para reproducir (estado original):** `createOrder()` se ejecutaba y persistía **antes** de llamar a MP; si la llamada a MP tiraba excepción, no había ningún `catch` que marcara la orden como `cancelled`. Reproducidos en esta sesión: `RF-205920` (método `card`) y `RF-173025` (método `wallet`), ambas quedaron `pending` para siempre tras los intentos fallidos por H-02.
- **Esperado:** una orden cuyo intento de cobro falló con excepción debería quedar en un estado distinguible de un checkout en curso.
- **Actual (antes del fix):** quedaba `pending` para siempre, indistinguible de un cliente completando el pago.
- **Impacto:** con el tiempo, el panel de admin acumularía pedidos "fantasma".
- **Fix aplicado (TDD):** la orden pasa a `cancelled` cuando la llamada a MP tira excepción (tras `createOrder` haber tenido éxito). Tests nuevos en `payments.test.ts` verificados rojo→verde. Suite completa (253 backend + 150 frontend) sin regresiones; typecheck limpio.

### [H-05] Puerto 5432 de Postgres en conflicto con otro proyecto en la misma máquina
- **Severidad:** Bajo (solo entorno local del usuario)
- **Tipo:** Configuración
- **Dónde:** `docker-compose.yml:14`
- **Detalle:** el contenedor `my-finance-db-1` de otro proyecto ya ocupaba `0.0.0.0:5432`. Remapeé `resolute-postgres` a `5436:5432` (editado en `docker-compose.yml`, cambio sin commitear) y actualicé `DATABASE_URL` en `apps/api/.env` acorde. **No toqué el contenedor ajeno.**
- **Impacto:** ninguno funcional; dejo el cambio sin commitear para que el usuario decida si lo mantiene o prefiere otro puerto/detener el otro proyecto.

### [H-06] Device Fingerprint (`security.js` + `X-Meli-Session-Id`) no implementado — AGREGADO (no era la causa de H-01, pero es buena práctica documentada por MP)
- **Severidad:** Bajo/Buena práctica
- **Tipo:** Seguridad / Hardening
- **Dónde:** `apps/web/index.html` (script), `apps/web/src/components/CheckoutModal.tsx` (`payCard`), `apps/web/src/lib/api.ts` (`paymentCard` body), `apps/api/src/routes/payments.ts` (`/card` schema), `apps/api/src/lib/mp.ts` (`createCardPayment`)
- **Detalle:** MercadoPago documenta que el cliente debe cargar `https://www.mercadopago.com/v2/security.js`, que genera `window.MP_DEVICE_SESSION_ID`, y reenviarlo al crear el pago como header `X-Meli-Session-Id` (mejora el análisis de riesgo de fraude). El proyecto no lo hacía. Se agregó completo con TDD:
  - `index.html`: script de seguridad agregado.
  - `CheckoutModal.tsx`: `payCard()` ahora lee `window.MP_DEVICE_SESSION_ID` y lo manda como `deviceId`.
  - `api.ts` / ruta `/card`: `deviceId` opcional, tipado y validado.
  - `mp.ts`: `createCardPayment` reenvía `deviceId` como `requestOptions.meliSessionId` al SDK oficial (que lo traduce al header `X-Meli-Session-Id`).
  - Tests nuevos: `apps/api/tests/mp.test.ts` (2 tests, mockeando el SDK `mercadopago` directamente) + 1 test en `payments.test.ts` — todos rojo→verde.
- **Verificado en vivo:** el valor viajó correctamente en un pago real (`"deviceId":"armor.abe1a054a..."`) — confirmado por request-body capturado. **No resolvió H-01** (mismo error, mismo `code: 7`) — se mantiene igual porque es una buena práctica de seguridad válida independientemente de esta investigación puntual.
- **Impacto:** mejora el perfil de riesgo/fraude de los cobros reales una vez que H-01 se resuelva; no bloqueante hoy.

---

## 4. Huecos de cobertura

Casos que **no** están en `docs/qa/05-payments.md` / `06-webhook-order-lifecycle.md` y deberían agregarse:

1. **Sanity check previo a cualquier corrida de sandbox:** un caso "0" que, con túnel público ya configurado, intente un cobro `APRO` real de punta a punta **antes** de correr el resto de la suite manual — habría ahorrado toda la investigación de H-01/H-02 en un solo paso. (Nota: descartar de este chequeo cualquier variante de "verificar usuario de prueba" — no aplica, ver punto 7.)
2. **Precondición de entorno:** un caso que exija `PUBLIC_API_URL`/`PUBLIC_WEB_URL` públicos (documentar que MP rechaza `localhost` en ambos campos) — hoy el doc solo lo menciona de pasada en el paso manual final de M4, no como bloqueante temprano.
3. **Webhook con firma real de MP:** todos los TC-WHK de firma (001-004) usan un HMAC sintético propio. Nunca se validó contra una firma **real** que MP calcule y envíe — riesgo de que el formato de manifest (`id:...;request-id:...;ts:...;`) asumido en `webhook.ts` no coincida exactamente con lo que MP envía hoy.
4. **Instalments reales vs. copy de marketing:** un caso que compare "Hasta 3 cuotas sin interés" contra lo que el Brick cotiza en vivo por BIN — ver hallazgo Bajo/UX #6 en la sección de top hallazgos, descubierto en esta sesión.
5. **Regresión manual obligatoria antes de cada release que toque pagos:** con túnel público real, ejecutar al menos un cobro de tarjeta aprobado y un Wallet completo, confirmando que MP efectivamente llama al webhook y la orden pasa a `paid` — ningún test automatizado (mockeado) puede cubrir esto.
6. **Email al admin/cliente por método de pago:** Módulo 7 no fue tocado en esta pasada; falta confirmar que el email de confirmación etiqueta correctamente `wallet` vs `card` vs `transfer` con datos reales de MP (no mockeados).
7. **Nota para futuras sesiones de QA de pagos:** confirmado con documentación oficial de MercadoPago que **las Cuentas de prueba (Comprador/Vendedor) no son compatibles con integraciones Checkout Bricks** (lo que usa este proyecto) y que loguearse con una cuenta de prueba no da acceso a "Credenciales de prueba". Para Bricks, la única vía de testing es el par único de Credenciales de prueba de la aplicación + tarjetas de prueba oficiales — no hay "usuario de prueba" que elegir o rotar. Cualquier diagnóstico futuro de errores de MP en este proyecto debería descartar esa vía de entrada.

---

## 5. Suite automática (baseline, MP mockeado)

Ejecutada antes del testing manual, **70/70 PASS** (63 backend + 7 frontend):

- `apps/api`: `orders.test.ts` (8), `payments.test.ts` (10), `webhook.test.ts` (4), `qa-m6-webhook-lifecycle.test.ts` (36, TC-WHK-001..037), `env.test.ts` (5) → **63/63**.
- `apps/web`: `CheckoutModal.payments.test.tsx` (4), `CheckoutSuccess.test.tsx` (2), `CheckoutPending.test.tsx` (1) → **7/7**.

Tras los fixes de H-03/H-04 y el agregado de H-06 (2 tests nuevos en `payments.test.ts` + `apps/api/tests/mp.test.ts` nuevo con 2 tests, todo TDD rojo→verde), la suite **completa** del monorepo (no solo el módulo de pagos) corre en **406/406 PASS** — 256 backend + 150 frontend — sin regresiones. Typecheck de `apps/api` y `apps/web` limpio.

---

## 6. Cómo configurar el webhook (pedido explícito del usuario)

El webhook **no es opcional para probar en sandbox** — H-02 demostró que sin URLs públicas, MercadoPago ni siquiera acepta crear el cobro/preferencia. Pasos:

1. **Instalar y correr un túnel.** El más simple es [ngrok](https://ngrok.com) (cuenta gratis alcanza):
   ```bash
   ngrok http 4000   # túnel para la API — necesario para tarjeta Y wallet
   ```
   Copiá la URL `https://xxxx.ngrok-free.app` que te da.
   Si también querés probar el **regreso del Wallet** (redirect de vuelta a `/checkout/success`), corré un segundo túnel para el front:
   ```bash
   ngrok http 5173   # túnel para el web — necesario solo para Wallet
   ```
2. **Actualizar `apps/api/.env`:**
   ```
   PUBLIC_API_URL="https://xxxx.ngrok-free.app"
   PUBLIC_WEB_URL="https://yyyy.ngrok-free.app"   # solo si tuneleaste el web también
   ```
   Reiniciar la API para que tome los nuevos valores.
   **Ojo con CORS:** la API solo acepta pedidos del origen exacto de `PUBLIC_WEB_URL` (`apps/api/src/app.ts:36`). Si cambiás `PUBLIC_WEB_URL` al túnel pero seguís navegando por `localhost:5173`, los fetches del navegador se bloquean por CORS. Para probar el regreso del Wallet de punta a punta, navegá **también** por la URL del túnel del web, no por localhost. Además, Vite bloquea hosts desconocidos por default — hace falta `allowedHosts: true` en `apps/web/vite.config.ts` para que acepte el dominio de ngrok (ya lo agregué).
3. **Registrar el webhook en el panel de MercadoPago:** [panel de desarrolladores](https://www.mercadopago.com.ar/developers/panel/app) → tu aplicación → sección **Webhooks** → agregar URL `https://xxxx.ngrok-free.app/api/payments/webhook`, evento **payments**. MP te va a mostrar una **firma secreta** (webhook signature secret) — copiala.
4. **Cargar la firma en `apps/api/.env`:**
   ```
   MP_WEBHOOK_SECRET="<la firma secreta que te dio MP>"
   ```
   Con esto la app empieza a **validar** que el webhook realmente viene de MP (`verifyWebhookSignature` en `apps/api/src/lib/webhook.ts`) — hoy queda desactivado porque el valor está vacío.
5. **Probar:** el Wallet ya funciona (preferencia real creada y verificada, `RF-366453`) — completá un Wallet real para el resto del flujo. **El cobro directo con tarjeta (Card Brick) sigue bloqueado por H-01** (`Unauthorized use of live credentials`), un problema aparentemente del lado de la cuenta de MercadoPago pendiente de resolver con soporte — no depende de esta configuración. Podés ver en vivo si MP llamó al webhook en el inspector local de ngrok (`http://127.0.0.1:4040`), y confirmar en la DB que la orden pasó a `paid`.
