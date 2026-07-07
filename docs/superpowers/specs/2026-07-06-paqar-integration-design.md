# Integración PAQ.AR (Correo Argentino) — Diseño

**Fecha:** 2026-07-06 · **Fuente:** apiPaqAr-v2.pdf (API 2.0, Abril 2023) · **Aprobado por:** Gianluca

## Objetivo

Gestión completa de envíos por Correo Argentino desde el panel admin: alta de orden, cancelación, rótulo PDF, historial de tracking y consulta de sucursales. Checkout público extendido para capturar la dirección estructurada que exige la API.

## Decisiones tomadas

- **Checkout extendido**: el formulario público pide calle, altura, piso/depto (opc.), CP, provincia (select) y ciudad. Reemplaza los campos libres `dir` y `ciudad`.
- **Creación manual**: el envío se registra en Correo Argentino con un botón "Generar envío" por pedido en el admin. Sin automatización al pagar.
- **Modelo `Shipment` dedicado** (1:1 con `Order`) en vez de campos sueltos en Order: conserva request/response crudos, permite cancelar/reimprimir de forma robusta.

## API PAQ.AR (resumen del PDF)

- Base test: `https://apitest.correoargentino.com.ar/paqar/v1/` · prod: `https://api.correoargentino.com.ar/paqar/v1/`
- Headers en todo llamado: `Authorization: Apikey <key>` + `agreement: <id>`
- `GET /v1/auth` → 204 valida credenciales
- `POST /v1/orders` → alta. Body: `{ sellerId?, trackingNumber?, order: { senderData, shippingData, parcels[], deliveryType, agencyId, saleDate, serviceType, shipmentClientId } }`. Solo se toma el **primer** parcel. Devuelve el TN asignado.
  - `deliveryType`: `homeDelivery` | `agency` | `locker`. `agencyId` requerido si no es homeDelivery.
  - Dirección: `state` = código provincia de 1 letra (tabla del PDF, 24 valores). `zipCode` se valida contra provincia. Obligatorios: streetName, streetNumber, cityName, state, zipCode. `productWeight` en gramos (máx 5 dígitos), dims en cm (máx 3 dígitos c/u), `declaredValue` numérico, `saleDate` ISO con offset `-03:00`, `serviceType` 2 letras (ej. `CP`).
- `PATCH /v1/orders/{tn}/cancel` → cancela preimposición.
- `POST /v1/labels` (+ query `labelFormat=10x15|label`) → body array `{sellerId, trackingNumber}` → por ítem `{trackingNumber, fileBase64, fileName, result}` (result `OK`/`ERROR: …`).
- `GET /v1/tracking` (params: `extClient?` + array de `{trackingNumber}` como body) → por TN: `{quantity, event[]: {statusId, status, date, facility…}}`. `quantity 0` = TN sin datos.
- `GET /v1/agencies` (params `stateId?`, `pickup_availability?`, `package_reception?`) → sucursales con location/horarios.
- **Nota técnica**: `/tracking` y `/agencies` usan GET con body JSON — `fetch` nativo lo prohíbe, se usa `undici.request`.

## Backend

### Env (`apps/api/src/env.ts`)

- `PAQAR_API_KEY` (default `''`), `PAQAR_AGREEMENT` (default `''`), `PAQAR_BASE_URL` (default URL test).
- Sin credenciales ⇒ feature deshabilitada: rutas responden 503 con mensaje claro y el admin muestra aviso. No bloquea boot ni deploy.

### Cliente `apps/api/src/lib/paqar.ts`

- `undici.request` con headers comunes; timeout razonable.
- `validateAuth()`, `createShipmentOrder(payload)`, `cancelShipmentOrder(tn)`, `getLabels(items, format)`, `getTracking(tns, extClient?)`, `getAgencies(filters)`.
- `PaqarError extends Error` con `status` y `message` del body de error del correo; `PaqarDisabledError` si faltan credenciales.

### Prisma

- `Order` — nuevos campos nullable: `shippingStreet`, `shippingStreetNumber`, `shippingFloor`, `shippingApartment`, `shippingZip`, `shippingProvince` (código 1 letra). `address`/`city` legacy se mantienen (pedidos viejos + display).
- `Shipment` — `id`, `orderId @unique` (FK), `trackingNumber @unique`, `status` (`created` | `cancelled`), `deliveryType`, `agencyId?`, `serviceType`, `weightGrams`, `heightCm`, `widthCm`, `depthCm`, `declaredValue`, `paqarResponse Json?`, `createdAt`, `updatedAt`.
- `ShippingConfig` — fila única (`id=1`): remitente (`senderName`, `senderEmail?`, `senderPhone?`, `senderStreet`, `senderStreetNumber`, `senderFloor?`, `senderApartment?`, `senderCity`, `senderProvince`, `senderZip`) + defaults (`defaultWeightGrams`, `defaultHeightCm`, `defaultWidthCm`, `defaultDepthCm`, `defaultServiceType` = `CP`, `labelFormat` = `10x15`) + `updatedAt`.

### Rutas admin (bajo `requireAdmin`)

- `GET /api/admin/shipping/status` → `{configured, valid}` (valida vía `/v1/auth`).
- `GET|PUT /api/admin/shipping/config` → ShippingConfig (zod).
- `GET /api/admin/shipping/agencies?stateId=&pickupAvailability=&packageReception=` → proxy.
- `GET /api/admin/shipping/shipments` → listado con datos de orden.
- `POST /api/admin/orders/:id/shipment` → body `{deliveryType, agencyId?, weightGrams, heightCm, widthCm, depthCm, declaredValue, serviceType, shipping: {street, streetNumber, floor?, apartment?, city, province, zip}}`. Compone payload (sender de config, saleDate = createdAt del pedido con offset -03:00, shipmentClientId = orderNo), llama alta, persiste `Shipment` y los campos estructurados en la orden. 409 si ya existe shipment activo.
- `POST /api/admin/shipping/shipments/:id/cancel` → PATCH al correo + `status='cancelled'`.
- `GET /api/admin/shipping/shipments/:id/label?format=` → `{fileName, fileBase64}` o error del correo.
- `GET /api/admin/shipping/shipments/:id/tracking` → eventos.

## Compartido (`packages/shared`)

- `PROVINCES`: `[{code:'A',name:'Salta'}, …]` (24, tabla del PDF).
- `customerSchema`: `nombre`, `email`, `tel?` igual; `dir`/`ciudad` reemplazados por `calle` (1..120), `altura` (1..10), `pisoDepto?` (0..40), `cp` (4..8), `provincia` (enum códigos), `ciudad` (1..100).
- `CustomerInput` actualizado. `createOrder` compone `address` legacy = `"calle altura, piso/depto"`.

## Web

### Checkout (`CheckoutModal.tsx` + `store/cart.ts`)

Campos: Calle · Altura · Piso/Depto (opcional) · Código Postal · Provincia (select con las 24) · Ciudad. Validación con `customerSchema` como hoy.

### Admin — página **Correo** (`/admin/correo`)

Secciones en una página con tabs:
1. **Envíos** — tabla de shipments (TN, pedido, estado, fecha) con acciones: ver tracking (modal con timeline de eventos), descargar rótulo (base64→blob PDF), cancelar (confirmación).
2. **Configuración** — badge estado credenciales (env) + form remitente y defaults (PUT config).
3. **Sucursales** — filtro por provincia + flags, tabla con nombre, dirección, horario.

### Admin — Pedidos

Botón "Generar envío" por pedido (visible si sin shipment activo). Modal prellenado con dirección estructurada del pedido (o vacío si pedido legacy) + defaults de config; selector deliveryType; picker de sucursal (carga `/agencies` filtrado por provincia) cuando no es homeDelivery; declaredValue default = total del pedido. Al crear: muestra TN y acceso a rótulo. Si ya tiene envío: TN visible + link a Correo.

## Manejo de errores

- Errores del correo (400/401/403) se propagan al admin con el `message` original del body.
- Credenciales ausentes → 503 `PAQAR no configurado` + aviso en UI.
- Cancelación: sólo shipments `created`; alta: sólo pedidos sin shipment activo (cancelado permite regenerar).

## Testing

- Shared: schema nuevo (provincias inválidas, CP, altura).
- API: cliente paqar con `undici` mockeado (payload correcto, headers, mapping de errores); rutas shipping (feature off → 503, alta → persiste shipment, doble alta → 409, cancelar, label, tracking, config CRUD); `createOrder` guarda campos estructurados.
- Web: checkout renderiza campos nuevos y valida; página Correo (listado, config form); modal generar envío (prellenado, submit).

## Fuera de alcance

- Cotización de costo de envío (la API no lo expone).
- Registro automático al pagar; webhooks de tracking; multi-parcel (la API toma un solo parcel).
