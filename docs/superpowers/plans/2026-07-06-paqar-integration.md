# PAQ.AR (Correo Argentino) Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gestión completa de envíos Correo Argentino (alta, cancelación, rótulo, tracking, sucursales) en el panel admin + checkout con dirección estructurada.

**Architecture:** Cliente HTTP `lib/paqar.ts` sobre `undici.request` (la API usa GET con body). Modelo `Shipment` 1:1 con `Order`, `ShippingConfig` fila única para remitente/defaults. Rutas admin bajo `/api/admin/shipping` + acción order-scoped `POST /api/admin/orders/:id/shipment`. Web: checkout extendido y página admin "Correo".

**Tech Stack:** Express + Prisma/Postgres + zod + vitest/supertest (API) · React + react-query + zustand (web) · undici (nuevo dep API).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-06-paqar-integration-design.md`
- Tests corren con `TEST_DATABASE_URL='postgresql://postgres:postgres@localhost:5433/resolute_test?schema=public'` (worktree usa Postgres propio en 5433, container `resolute-postgres-paqar`).
- Migraciones dev: `DATABASE_URL='postgresql://postgres:postgres@localhost:5433/resolute_dev?schema=public' npx prisma migrate dev`.
- Mensajes de error de cara al admin en español; código estilo repo (denso, comentarios solo para invariantes).
- PAQ.AR deshabilitado (sin `PAQAR_API_KEY`/`PAQAR_AGREEMENT`) ⇒ rutas shipping devuelven 503 `{ error: 'PAQ.AR no configurado' }`.
- Provincia = código 1 letra del PDF (24 valores, sin I/O/Ñ). `saleDate` formato `YYYY-MM-DDTHH:mm:ss-03:00`.

---

### Task 1: Shared — provincias + customerSchema estructurado

**Files:**
- Create: `packages/shared/src/provinces.ts`
- Modify: `packages/shared/src/index.ts` (re-export), `packages/shared/src/dto.ts` (CustomerInput), `packages/shared/src/schemas.ts` (customerSchema)
- Test: `packages/shared/tests/schemas.test.ts`

**Interfaces:**
- Produces: `PROVINCES: readonly {code, name}[]`, `PROVINCE_CODES` (tupla para z.enum), `ProvinceCode`; `CustomerInput { nombre, email, tel?, calle, altura, pisoDepto?, cp, provincia, ciudad }`; `customerSchema` validando esa forma.

- [ ] Test primero: provincia inválida (`'I'`) rechazada, CP inválido rechazado, forma válida pasa (`calle:'Av. Siempreviva', altura:'742', cp:'C1425ABC', provincia:'C', ciudad:'CABA'`), `pisoDepto` opcional.
- [ ] `provinces.ts`:

```ts
export const PROVINCES = [
  { code: 'A', name: 'Salta' }, { code: 'B', name: 'Buenos Aires' }, { code: 'C', name: 'CABA' },
  { code: 'D', name: 'San Luis' }, { code: 'E', name: 'Entre Ríos' }, { code: 'F', name: 'La Rioja' },
  { code: 'G', name: 'Santiago del Estero' }, { code: 'H', name: 'Chaco' }, { code: 'J', name: 'San Juan' },
  { code: 'K', name: 'Catamarca' }, { code: 'L', name: 'La Pampa' }, { code: 'M', name: 'Mendoza' },
  { code: 'N', name: 'Misiones' }, { code: 'P', name: 'Formosa' }, { code: 'Q', name: 'Neuquén' },
  { code: 'R', name: 'Río Negro' }, { code: 'S', name: 'Santa Fe' }, { code: 'T', name: 'Tucumán' },
  { code: 'U', name: 'Chubut' }, { code: 'V', name: 'Tierra del Fuego' }, { code: 'W', name: 'Corrientes' },
  { code: 'X', name: 'Córdoba' }, { code: 'Y', name: 'Jujuy' }, { code: 'Z', name: 'Santa Cruz' },
] as const;
export const PROVINCE_CODES = ['A','B','C','D','E','F','G','H','J','K','L','M','N','P','Q','R','S','T','U','V','W','X','Y','Z'] as const;
export type ProvinceCode = (typeof PROVINCE_CODES)[number];
```

- [ ] `customerSchema`: reemplaza `dir`/`ciudad` por:

```ts
calle: z.string().trim().min(1).max(120),
altura: z.string().trim().min(1).max(10),
pisoDepto: z.string().trim().max(40).optional(),
cp: z.string().trim().regex(/^[A-Za-z]?\d{4}[A-Za-z]{0,3}$/, 'Código postal inválido'),
provincia: z.enum(PROVINCE_CODES),
ciudad: z.string().trim().min(1).max(100),
```

- [ ] Tests shared verdes. Commit `feat(shared): structured shipping address in customer schema`.

### Task 2: API — env PAQAR + cliente undici

**Files:**
- Modify: `apps/api/src/env.ts`, `apps/api/package.json` (dep `undici`)
- Create: `apps/api/src/lib/paqar.ts`
- Test: `apps/api/tests/paqar-client.test.ts`

**Interfaces:**
- Produces: `paqarEnabled(): boolean`; `PaqarError { status, message }`; `PaqarDisabledError`; `validateAuth(): Promise<boolean>`; `createShipmentOrder(payload: PaqarOrderPayload): Promise<{ trackingNumber: string; raw: unknown }>`; `cancelShipmentOrder(tn: string): Promise<unknown>`; `getLabels(items: {sellerId: string, trackingNumber: string}[], format?: string): Promise<PaqarLabel[]>`; `getTracking(tns: string[], extClient?: string): Promise<PaqarTrackingEntry[]>`; `getAgencies(f: {stateId?, pickupAvailability?, packageReception?}): Promise<unknown[]>`; tipo `PaqarOrderPayload`.

- [ ] `npm i undici -w apps/api`.
- [ ] Env: `PAQAR_BASE_URL` default `https://apitest.correoargentino.com.ar/paqar`, `PAQAR_API_KEY` default `''`, `PAQAR_AGREEMENT` default `''`. Sin superRefine de prod (feature opcional).
- [ ] Tests (mock `undici` + mock parcial `env`): headers `authorization: Apikey k` + `agreement`; auth 204→true / 401→false; createShipmentOrder extrae `trackingNumber` del body; error 400 con `message` → `PaqarError`; disabled → `PaqarDisabledError`; tracking manda body JSON con método GET; agencies pasa query params snake_case.
- [ ] Implementación núcleo:

```ts
import { request } from 'undici';
import { env } from '../env.js';

export class PaqarError extends Error { constructor(public status: number, msg: string) { super(msg); this.name = 'PaqarError'; } }
export class PaqarDisabledError extends Error { constructor() { super('PAQ.AR no configurado'); this.name = 'PaqarDisabledError'; } }
export const paqarEnabled = () => Boolean(env.PAQAR_API_KEY && env.PAQAR_AGREEMENT);

async function call(method: 'GET'|'POST'|'PATCH', path: string, opts: { body?: unknown; query?: Record<string, string> } = {}) {
  if (!paqarEnabled()) throw new PaqarDisabledError();
  const url = new URL(env.PAQAR_BASE_URL + path);
  for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, v);
  const res = await request(url, {
    method,
    headers: { authorization: `Apikey ${env.PAQAR_API_KEY}`, agreement: env.PAQAR_AGREEMENT, 'content-type': 'application/json' },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    headersTimeout: 15_000, bodyTimeout: 30_000,
  });
  const text = await res.body.text();
  let json: any = null; try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON body (e.g. empty 204) */ }
  if (res.statusCode >= 400) throw new PaqarError(res.statusCode, json?.message || json?.error || `PAQ.AR HTTP ${res.statusCode}`);
  return json;
}
```

`validateAuth`: `call('GET','/v1/auth')` → true; catch `PaqarError` 400/401/403 → false (otros re-throw). `createShipmentOrder`: POST `/v1/orders`, TN = `raw?.trackingNumber ?? raw?.order?.trackingNumber`; sin TN ⇒ `PaqarError(502,…)`. `cancelShipmentOrder`: PATCH `/v1/orders/${encodeURIComponent(tn)}/cancel`. `getLabels`: POST `/v1/labels` con query `labelFormat` si se pasa. `getTracking`: GET `/v1/tracking`, body `tns.map(tn => ({ trackingNumber: tn }))`, query `extClient` si se pasa. `getAgencies`: GET `/v1/agencies` query `stateId`, `pickup_availability`, `package_reception`.
- [ ] Verde. Commit `feat(api): PAQ.AR HTTP client + env config`.

### Task 3: Prisma — Order shipping fields + Shipment + ShippingConfig

**Files:**
- Modify: `apps/api/prisma/schema.prisma`, `apps/api/tests/helpers/db.ts` (resetDb: `shipment.deleteMany`, `shippingConfig.deleteMany` primero)
- Create: migración `paqar_shipments`

**Interfaces:**
- Produces: `Order.shippingStreet/shippingStreetNumber/shippingFloor/shippingApartment/shippingZip/shippingProvince: String?` + `Order.shipment: Shipment?`; modelos según spec (`Shipment.orderId @unique`, `trackingNumber @unique`, `status default "created"`, dims/peso/declaredValue Int, `paqarResponse Json?`; `ShippingConfig id=1` remitente + defaults `defaultServiceType "CP"`, `labelFormat "10x15"`, `defaultWeightGrams 500`, dims default 10/30/40).

- [ ] Editar schema; `DATABASE_URL=…5433/resolute_dev npx prisma migrate dev --name paqar_shipments`; `npx prisma generate`.
- [ ] resetDb actualizado; suite API sigue verde. Commit `feat(api): shipment + shipping config schema`.

### Task 4: API — createOrder guarda dirección estructurada

**Files:**
- Modify: `apps/api/src/services/orders.ts` (mapping), todos los tests API que arman `customer` con `dir`/`ciudad` (grep `dir:`) → nueva forma
- Test: `apps/api/tests/orders.test.ts` (assert campos nuevos persistidos)

**Interfaces:**
- Consumes: `CustomerInput` nuevo de Task 1.
- Produces: órdenes con `shippingStreet…shippingProvince` seteados; `address` legacy = `` `${calle} ${altura}${pisoDepto ? `, ${pisoDepto}` : ''}` ``, `city` = ciudad.

- [ ] Test: crear orden con customer nuevo → `order.shippingZip === 'C1425ABC'` etc.
- [ ] Mapping en `createOrder` + actualización masiva de fixtures de tests.
- [ ] Suite API verde. Commit `feat(api): persist structured shipping address on orders`.

### Task 5: API — servicio shipping (payload builder + operaciones)

**Files:**
- Create: `apps/api/src/services/shipping.ts`
- Test: `apps/api/tests/shipping-service.test.ts`

**Interfaces:**
- Consumes: cliente Task 2, modelos Task 3.
- Produces: `formatPaqarDate(d: Date): string`; `buildPaqarOrder(order, cfg, input): PaqarOrderPayload`; `getShippingConfig()`, `updateShippingConfig(data)`; `createShipmentForOrder(orderId, input): Promise<Shipment | null>` (null = orden inexistente; `ShipmentExistsError` si shipment `created`; `ConfigMissingError` sin remitente; shipment `cancelled` se sobreescribe); `cancelShipment(id)`; `getShipmentLabel(id, format?)` → `{fileName, fileBase64}` o `LabelError`; `getShipmentTracking(id)` → eventos; `listShipments()` con `order: {orderNo, customerName}`. Tipo `ShipmentInput` = `{deliveryType, agencyId?, weightGrams, heightCm, widthCm, depthCm, declaredValue, serviceType, shipping: {street, streetNumber, floor?, apartment?, city, province, zip}}`.

- [ ] Tests (mock `lib/paqar.js`): `formatPaqarDate` produce offset -03:00 correcto; `buildPaqarOrder` mapea sender de config / shipping del input / parcel con strings / `shipmentClientId=orderNo` / `saleDate` del createdAt; `createShipmentForOrder` persiste Shipment + actualiza campos de la orden; doble alta → `ShipmentExistsError`; sin config → `ConfigMissingError`; re-alta sobre cancelado reutiliza fila; `cancelShipment` sólo desde `created`; `getShipmentLabel` result `OK` → base64, result `ERROR: …` → `LabelError`.
- [ ] Implementar. Verde. Commit `feat(api): shipping service for PAQ.AR orders`.

### Task 6: API — rutas admin shipping + shipment en orders DTO

**Files:**
- Create: `apps/api/src/routes/admin/shipping.ts`
- Modify: `apps/api/src/routes/admin/index.ts` (mount `/shipping`), `apps/api/src/routes/admin/orders.ts` (POST `/:id/shipment`; GET incluye `shipment: {id, trackingNumber, status}` y campos `shipping*`)
- Test: `apps/api/tests/admin-shipping.test.ts`

**Interfaces:**
- Consumes: servicio Task 5, `paqarEnabled`/`validateAuth`/`getAgencies` Task 2, `PROVINCE_CODES` Task 1.
- Produces (todas bajo `requireAdmin`):
  - `GET /api/admin/shipping/status` → `{configured: boolean, valid: boolean | null}` (valid null si !configured)
  - `GET|PUT /api/admin/shipping/config` (zod `configSchema`; GET puede devolver null)
  - `GET /api/admin/shipping/agencies?stateId=&pickupAvailability=&packageReception=`
  - `GET /api/admin/shipping/shipments`
  - `POST /api/admin/shipping/shipments/:id/cancel`
  - `GET /api/admin/shipping/shipments/:id/label?format=`
  - `GET /api/admin/shipping/shipments/:id/tracking`
  - `POST /api/admin/orders/:id/shipment` (zod `shipmentInputSchema` con refine agencyId requerido si deliveryType ≠ homeDelivery)
- Errores: `PaqarDisabledError`→503, `PaqarError`→502 con message del correo, `ShipmentExistsError`→409, `ConfigMissingError`→400, `LabelError`→502, not found→404.

- [ ] Tests: sin credenciales → 503 en agencies/status usa configured:false; con `lib/paqar.js` mockeado: config PUT/GET roundtrip, alta shipment persiste y devuelve TN, doble alta 409, cancel, label base64, tracking events, orders GET incluye shipment.
- [ ] Implementar rutas + DTO. Verde. Commit `feat(api): admin shipping routes`.

### Task 7: Web — checkout con dirección estructurada

**Files:**
- Modify: `apps/web/src/store/cart.ts` (emptyCheckoutForm), `apps/web/src/components/CheckoutModal.tsx` (campos + labels), tests de checkout que llenan el form
- Test: `apps/web/src/components/CheckoutModal.checkout.test.tsx`

**Interfaces:**
- Consumes: `customerSchema`, `PROVINCES` de shared.
- Produces: form con Calle / Altura / Piso y depto (opcional) / Código Postal / Provincia (select) / Ciudad.

- [ ] Test: campos nuevos presentes, submit con datos válidos llama API con customer estructurado.
- [ ] Implementar. `FIELD_LABELS` actualizado (calle, altura, cp, provincia, ciudad). Verde. Commit `feat(web): structured shipping address in checkout`.

### Task 8: Web — adminApi + página Correo + generar envío en Pedidos

**Files:**
- Modify: `apps/web/src/lib/adminApi.ts` (métodos shipping), `apps/web/src/App.tsx` (ruta `/admin/correo`), `apps/web/src/pages/admin/AdminLayout.tsx` (NavLink Correo), `apps/web/src/pages/admin/Orders.tsx` (botón + modal)
- Create: `apps/web/src/pages/admin/Shipping.tsx`, `apps/web/src/components/admin/ShipmentModal.tsx`
- Test: `apps/web/src/pages/admin/Shipping.test.tsx`, test del modal en Orders

**Interfaces:**
- Consumes: rutas Task 6.
- Produces: adminApi: `shippingStatus()`, `shippingConfig()`, `saveShippingConfig(body)`, `agencies(params)`, `shipments()`, `createShipment(orderId, body)`, `cancelShipment(id)`, `shipmentLabel(id)`, `shipmentTracking(id)`.
- Página Correo con tabs Envíos (tabla + tracking modal + descargar rótulo blob PDF + cancelar) / Configuración (badge credenciales + form remitente y defaults) / Sucursales (filtro provincia + tabla).
- Orders: pedido con shipment → TN visible; sin shipment → botón "Generar envío" abre `ShipmentModal` prellenado (dirección estructurada del pedido o vacía, defaults de config, declaredValue = total, picker sucursales si agency/locker).

- [ ] Tests render + interacciones clave con adminApi mockeado.
- [ ] Implementar. Verde. Commit `feat(web): admin Correo page + shipment creation from orders`.

### Task 9: Verificación final

- [ ] `npm run typecheck` + `npm test` (root, con TEST_DATABASE_URL 5433) — todo verde.
- [ ] `npm run build` verde.
- [ ] Smoke run dev (API + web) con credenciales dummy → status muestra configured:false y UI avisa.
- [ ] Actualizar spec si hubo desvíos de rutas. Commit final.
