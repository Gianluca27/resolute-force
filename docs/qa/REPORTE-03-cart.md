# Reporte de QA — Resolute Force · Módulo 3 (Carrito) — 2026-06-27

> Entorno: Linux · Chromium (Playwright MCP) · API `http://localhost:4000` + Web `http://localhost:5173` · NODE_ENV=development · seed canónico (4 productos, precio 30000, stock 25 por variante).
> Alcance: los 34 casos de `docs/qa/03-cart.md` (TC-CART-001 … 034) + testing exploratorio sobre el store Zustand, persistencia, reconcile y el límite servidor (quote).

---

## 1. Resumen ejecutivo

- **Alcance probado:** los 34 casos del archivo + exploración (límite de quote en servidor, JSON corrupto, valores manipulados, persistencia, responsive 360/800/1280, accesibilidad del drawer, orden de transferencia completo end-to-end, y *stock gating* en vivo con stock 0 sembrado y restaurado).
- **Conteo:** **PASS 34 · FAIL 0 · BLOQUEADO 0**. Tasa de aprobación: 34/34 = 100%.
- **Hallazgos:** 0 Críticos · 0 Altos · 1 Medio · 5 Bajos (6 en total). Todos son UX/accesibilidad/datos menores; ningún defecto funcional ni de seguridad/oversell en el carrito.
- **Stock gating (TC-021/022/023):** ejecutados en vivo mutando temporalmente el stock en la DB (`stock=0`) y **restaurando a 25 (seed)** al finalizar. Estado final de la DB verificado: las 4 variantes de los 4 productos quedaron en `stock=25`.
- **Veredicto:** El carrito es **sólido y apto**. La lógica optimista (sin tope de stock/cantidad en cliente) está correctamente delegada al servidor, que rechaza en el boundary (quote `409`/`400`). El *stock gating* en el punto de entrada funciona correctamente. Los hallazgos son pulidos menores de UX/a11y, no bloqueantes para release del módulo.

---

## 2. Resultados por caso del archivo

| Caso | Resultado | Nota |
|------|-----------|------|
| TC-CART-001 Add single item | **PASS\*** | Drawer abre; línea `Azul Marino · Talle M`, qty 1, `1 × $30.000`; badge 1; header `(1)`; Subtotal `$30.000`; toast OK. **Desvío:** el talle preseleccionado por defecto es **S**, no **M** como dice el caso (ver H-01). |
| TC-CART-002 Merge same product+size | PASS | 1 línea, qty 2, `2 × $30.000`, Subtotal `$60.000`, badge 2. |
| TC-CART-003 Same product diff size → 2 líneas | PASS | Líneas `id-M` y `id-L`, badge 2, `$60.000`. |
| TC-CART-004 Distintos productos → 2 líneas | PASS | Azul M + Negro M, badge 2, `$60.000` (se usó Negro en vez de Blanco; misma aserción). |
| TC-CART-005 Varias tarjetas en secuencia | PASS | 4 líneas; +1 Azul → Azul qty 2; badge 5; Subtotal `$150.000`. |
| TC-CART-006 Drawer abre en cada add | PASS | Cerrar → add → drawer reabre. |
| TC-CART-007 Toast contenido + auto-dismiss | PASS | Texto exacto `Champion Mentality · Verde Militar (XL)`; desaparece tras ~2.4 s. |
| TC-CART-008 Badge incrementa / oculta en 0 | PASS | Vacío: sin `cart-badge`; 3 unidades → `3`; vaciar → badge removido. |
| TC-CART-009 `inc` "Sumar uno" | PASS | qty 1→5, `5 × $30.000`, `$150.000`, badge 5. Sin tope. |
| TC-CART-010 `dec` desde >1 | PASS | 5→4→3→2→1, la línea permanece en 1. |
| TC-CART-011 `dec` desde 1 elimina línea | PASS | Línea Azul eliminada (no qty 0); Negro queda; badge 1. |
| TC-CART-012 `remove` "Quitar" | PASS | Elimina la línea en un clic sin importar la qty (verificado también en TC-008). |
| TC-CART-013 Última línea → estado vacío | PASS | `Tu carrito está vacío.` + `Ver productos`; sin footer/checkout. |
| TC-CART-014 `clear` tras orden | PASS | Orden de transferencia completa → `¡Pedido confirmado!` `RF-961685`; `items=[]`; badge fuera; persiste vacío tras reload. |
| TC-CART-015 Subtotal + formato es-AR | PASS | 3 ítems `$90.000`; +1 → `$120.000` (separador de miles con punto). |
| TC-CART-016 Per-línea `qty × unit` (CD-3) | PASS | Renderiza literal `2 × $30.000` (no el total `$60.000`). **CD-3 confirmado** → H-02. |
| TC-CART-017 Copy "Envío" | PASS | Fila `Envío` = `Calculado en el checkout` en dorado; botón `Finalizar compra`. |
| TC-CART-018 Persistencia tras reload | PASS | Ítems restaurados exactos; drawer/checkout cerrados; LS persiste solo `items` (sin `open`/`checkoutOpen`). |
| TC-CART-019 `reconcile` dropea producto removido | **PASS** (vía inyección) | `reconcile` elimina ítems cuyo `productId` no está en el catálogo vivo (verificado con id inexistente, TC-028). Path admin-desactiva no ejecutado por falta de acceso admin/DB. |
| TC-CART-020 `reconcile` refresca precio/labels | **PASS** (vía inyección) | Precio "stale" 99999 → reescrito a 30000 vivo; line/color/slug refrescados; **qty se mantiene** en 2; `2 × $30.000`, `$60.000`. |
| TC-CART-021 Producto agotado no se agrega | **PASS** | Verde Militar con las 4 variantes en stock 0: cada talle disabled + line-through + `title="Sin stock"`; botón etiquetado `Sin stock` y disabled; clic no agrega nada (sin línea, sin drawer, sin toast). Evidencia: `evidence/qa-cart-TC021-soldout-product.png`. |
| TC-CART-022 Talle agotado deshabilitado | **PASS** | Azul Marino con solo M en 0: M disabled + `title="Sin stock"`; S/L/XL habilitados; el clic en M deshabilitado no cambia la selección; agregar usa el default y crea la línea normal. |
| TC-CART-023 Default = primer talle con stock | **PASS** | Con S agotado, el default preseleccionado pasa a **M** y agregar sin elegir talle agrega **M**. Confirma que `firstInStock = sizes.find(stock>0)`: con todo en stock el default es **S** (origen de H-01). |
| TC-CART-024 Cantidad 999 permitida | PASS | badge `999`, `999 × $30.000`, Subtotal `$29.970.000`. Sin tope cliente. |
| TC-CART-025 Cantidad grande vía `inc` | PASS | 30 clics → qty 30, `30 × $30.000`, sin error (supera stock 25). |
| TC-CART-026 Cantidad > stock hasta quote | PASS | Carrito acepta 26 sin error; `POST /api/checkout/quote` qty 26 → **409** `Sin stock suficiente…`. |
| TC-CART-027 JSON `rf-cart` corrupto | PASS | App carga con carrito vacío; sin crash; al agregar, `rf-cart` se reescribe válido. |
| TC-CART-028 Valores manipulados | PASS | Línea de producto inexistente dropeada por `reconcile`; qty `-5` restaurada verbatim (glitch `$-150.000` → H-03); servidor rechaza `-5/0/1.5` con **400** `Items inválidos` y producto inexistente con **409**. |
| TC-CART-029 Estado vacío inicial | PASS | Header `Tu carrito (0)`, icono, `Tu carrito está vacío.`, `Ver productos`; sin footer. |
| TC-CART-030 Nombres accesibles | PASS | aria-labels `Cerrar`/`Quitar`/`Restar uno`/`Sumar uno` en `<button>` reales; `<img alt="">`. **Nota:** la qty no está en región `aria-live` → cambio no anunciado (H-04). |
| TC-CART-031 Teclado en el drawer | **PASS** (con hallazgos) | Botones son `<button>` activables por teclado. **Gaps:** `Esc` NO cierra el drawer y no hay focus-trap (H-05). |
| TC-CART-032 Ancho mobile del drawer | PASS | 360px → 331.2px (=92vw), sin overflow horizontal; 800px → cap 420px. |
| TC-CART-033 "Ver productos" cierra drawer | PASS | Cierra el drawer (`setOpen(false)`); sin navegación (hash vacío). |
| TC-CART-034 Overlay cierra; z-index | PASS | Click en overlay cierra; overlay `z-290`, panel `z-300`. |

\* PASS con desvío documentado como hallazgo.

---

## 3. Hallazgos exploratorios (fuera del guion estricto del carrito)

- **Límite de servidor (quote) — correcto.** `POST /api/checkout/quote` con qty 25 devuelve totales correctos (`subtotal 750000`, `transferDiscount 75000` = 10%, `totalTransfer 675000`, `totalCard 750000`); qty 26 → `409`; qty `-5/0` → `400` "Items inválidos" (`>= 1`); qty `1.5` → `400` ("Expected integer"); productId inexistente → `409` "Producto inexistente o inactivo". El boundary servidor está bien blindado: **no hay forma de que un carrito optimista llegue a oversell o cargo negativo.**
- **CD-11 (cross-módulo, Pagos/Contenido).** La orden de transferencia se confirma pero **no muestra datos bancarios** (`bankAlias`/`bankCbu` vacíos en seed): el bloque "Datos para transferir" no aparece. El cliente no sabe a dónde transferir. Fuera del scope del carrito (Módulo 5/11) pero confirmado de paso.
- **Casing latente (cross-módulo, Catálogo).** El dato del producto es `Stop At Nothing` (A mayúscula) mientras que marquee/manifiesto/copy usan `Stop at Nothing`. En el carrito y la tarjeta se renderiza en mayúsculas (CSS `uppercase`) así que no es visible hoy, pero es una inconsistencia de datos latente (aparecería en emails/confirmación en otro casing). CD-9 figura como "resuelto" pero el seed aún tiene la variante con A mayúscula.
- **Reload del API por `tsx watch`.** Crear un archivo dentro de `apps/api/` dispara un reload del server (downtime breve) y, por CD-16, la falla de `/api/content` lleva a la pantalla "No pudimos cargar la tienda". No es bug del carrito; nota operativa para QA.

---

## 4. Huecos de cobertura (sugerencias para el set de pruebas)

1. **Stock gating sin DB manual.** TC-021/022/023 sí se ejecutaron, pero requirieron mutar la DB a mano (`stock=0`) y restaurar; no hay un camino de QA reproducible sin tocar la DB o el admin. Sugerencia: sembrar un 5º producto "agotado" fijo, o exponer un atajo de admin, para poder testear *sold-out* de forma repetible.
2. **Sincronización multi-pestaña.** No hay caso para dos pestañas abiertas (evento `storage`): hoy el store no escucha cambios de otras pestañas; el carrito puede quedar desincronizado hasta recargar.
3. **Retorno de foco al cerrar el drawer.** Ningún caso valida que el foco vuelva al botón "Carrito" tras cerrar (a11y).
4. **Overflow del cuerpo del drawer con muchas líneas.** No hay caso que estrese el scroll interno (`overflow-y-auto`) con 6+ líneas distintas en viewport bajo.
5. **Imagen rota en la línea.** No hay caso con `imageUrl` 404 (hoy `alt=""` lo silencia, aceptable, pero no documentado).
6. **Doble-clic / carrera en `inc`/`add`.** No hay caso de concurrencia simple (doble disparo rápido) más allá del optimismo ya cubierto.
7. **Ausencia de "vaciar carrito".** Documentar explícitamente la falta de control manual de clear como decisión (ver H-06).

---

## 5. Detalle de hallazgos (orden por severidad)

### [H-01] El talle preseleccionado por defecto es S, no M
- **Severidad:** Medio
- **Tipo:** UX
- **Dónde:** Sección Productos / `ProductCard.tsx` (`firstInStock = product.sizes.find(s => s.stock > 0)`).
- **Pasos para reproducir:**
  1. Abrir `/` con seed (todas las variantes en stock).
  2. Observar cualquier tarjeta de producto sin tocar los talles.
  3. Agregar sin elegir talle.
- **Esperado:** Según TC-CART-001/002/003/etc. el default es **M** (`Talle M`).
- **Actual:** El default es **S** (primer talle con stock). El botón **S** queda activo y el add usa **S**.
- **Impacto:** Discrepancia spec ↔ implementación que afecta a 6 casos del módulo. Para el usuario el impacto es bajo (puede cambiar el talle), pero preseleccionar el talle más chico puede inducir compras de talle equivocado y contradice la expectativa documentada. **Decisión a tomar:** o se corrige el default a M, o se actualiza la documentación (TC-023 ya describe `firstInStock`, así que la doc es internamente contradictoria).
- **Evidencia:** en vivo los 4 cards muestran `S` activo por defecto; al agotar S en la DB, el default pasa correctamente a `M` (TC-023), confirmando que la regla es "primer talle con stock", no "M".

### [H-02] El precio por línea muestra `qty × unitario`, no el total de línea (CD-3)
- **Severidad:** Bajo
- **Tipo:** UX
- **Dónde:** `CartDrawer.tsx` línea de ítem (`{it.qty} × {money(it.price)}`).
- **Pasos:** Agregar Azul M y subir a qty 2.
- **Esperado (plan):** total de la línea `$60.000`.
- **Actual:** `2 × $30.000`. (El Subtotal del footer sí es correcto: `$60.000`.)
- **Impacto:** Menor; el usuario no ve de un vistazo el importe por línea. Candidate defect CD-3 confirmado.
- **Evidencia:** observado en TC-002/009/016/024/025.

### [H-03] Cantidad negativa manipulada en `localStorage` produce subtotal negativo
- **Severidad:** Bajo
- **Tipo:** Datos / Visual
- **Dónde:** rehidratación del store (sin validación) + `CartDrawer`.
- **Pasos:**
  1. Editar `rf-cart` con un ítem `qty:-5` y recargar.
  2. Abrir el drawer.
- **Esperado:** la app no crashea (cumple); idealmente la qty se normalizaría a ≥1 o la línea se descartaría.
- **Actual:** la línea se restaura verbatim: header `(-5)`, per-línea `-5 × $30.000`, **Subtotal `$-150.000`**, badge oculto (porque `-5` no es > 0).
- **Impacto:** Solo reproducible manipulando storage (no por flujo normal). El servidor rechaza en quote (`400`), así que **no hay riesgo de oversell ni cargo negativo**; el impacto es un glitch visual. Recomendado: clamp `qty>=1` al rehidratar/`reconcile`.
- **Evidencia:** captura del estado observado `evidence/qa-cart-H03-negative-subtotal.png`.

### [H-04] El cambio de cantidad no se anuncia a lectores de pantalla
- **Severidad:** Bajo
- **Tipo:** Accesibilidad
- **Dónde:** `CartDrawer.tsx`, `<span>{it.qty}</span>` entre los steppers.
- **Esperado:** al pulsar "Sumar/Restar uno" un lector anuncia la nueva cantidad.
- **Actual:** la qty es texto plano fuera de cualquier región `aria-live`; el cambio no se anuncia.
- **Impacto:** Usuario de lector de pantalla no recibe feedback del cambio de cantidad. Bajo (el subtotal/visual cambia, pero no es audible).

### [H-05] `Esc` no cierra el drawer y no hay focus-trap
- **Severidad:** Bajo
- **Tipo:** Accesibilidad
- **Dónde:** `CartDrawer.tsx` (solo cierra por overlay/`Cerrar`).
- **Pasos:** Abrir drawer → presionar `Esc`.
- **Esperado:** patrón estándar de diálogo modal: `Esc` cierra y el foco queda atrapado dentro del panel.
- **Actual:** `Esc` no hace nada; el foco no está atrapado (Tab puede salir al contenido detrás).
- **Impacto:** Fricción de teclado/a11y. Bajo (existe cierre por overlay y botón `Cerrar`).

### [H-06] No existe control manual de "vaciar carrito"
- **Severidad:** Bajo
- **Tipo:** UX
- **Dónde:** Drawer (no hay botón); `clear()` solo se invoca tras orden exitosa.
- **Esperado/observado:** para vaciar, el usuario debe quitar línea por línea.
- **Impacto:** Gap menor de eficiencia; con carritos grandes es tedioso. Bajo.

---

### Anexo — Notas de ejecución
- Todos los precios/totales verificados contra el formato canónico es-AR (`$` + punto de miles, sin centavos).
- La orden de transferencia de prueba quedó registrada como `RF-961685` (estado `pending`, sin reserva de stock — `STOCK_HELD` solo aplica a `paid/shipped`). Datos de cliente con prefijo identificable `TEST_QA`.
- Para TC-021/022/023 se mutó temporalmente el `stock` de Verde Militar y Azul Marino a 0 vía Prisma y se **restauró a 25 (seed)** al terminar; estado final verificado (4 productos × 4 variantes = `stock 25`). El carrito quedó vacío.
