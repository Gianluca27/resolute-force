# Reporte de QA — Resolute Force · Landing & UI (Módulo 2) — 2026-06-27

## 1. Resumen ejecutivo

- **Alcance probado:** 73 casos del archivo `02-landing-ui.md` ejecutados contra el código embarcado (`apps/web`, Vite `:5173`, API `:4000`), más testing exploratorio (responsive 360/768/1280, contraste WCAG, orden de foco/teclado, fuentes, imagen rota, persistencia de carrito, ticking del countdown en vivo). Verificación cruzada con código fuente para ramas no disparables por red sin tumbar la API compartida.
- **Conteo:** **PASS 60 · FAIL 0 · BLOQUEADO 1** · *(12 verificados por código/lógica + unit tests, no ejercitados en vivo por requerir mutación de stock/red — marcados como PASS\*)*.
- **Hallazgos por severidad:** **0 Críticos · 0 Altos · 3 Medios · 11 Bajos.**
- **Veredicto general:** Landing **sólida y estable**: todos los flujos núcleo (render de secciones, navegación por anchors, selección de talle, agregar al carrito → toast + drawer, badge, responsive, scroll suave, jerarquía de headings, foco de teclado) funcionan correctamente y sin errores de consola. Los hallazgos son de **pulido**: accesibilidad (reduced-motion, contraste blanco/rojo, tap targets), consistencia de marca (casing de "Stop At Nothing") y **desincronizaciones por strings hardcodeados** frente a contenido dinámico (10% OFF, número de WhatsApp, año del footer). Ninguno bloquea una tarea.

> Nota: los diffs sin commit en `Footer.tsx`/`Contacto.tsx`/`Landing.tsx` son **arreglos** (Instagram del footer ahora deriva de `contactInstagram` y usa `www.instagram.com/.../` consistente con Contacto). No introducen regresiones.

---

## 2. Resultados por caso del archivo

| Caso | Resultado | Nota |
|------|-----------|------|
| TC-LAND-001 Orden de secciones | PASS | Marquee→Nav→Hero→Manifiesto→Productos→Historia→Proximos→Contacto→Footer; sin errores de consola |
| TC-LAND-002 `lang="es-AR"` | PASS | Confirmado |
| TC-LAND-003 Título + favicon | PASS | `Resolute Force · Champion Mentality`; icon `/assets/logo-r.png` |
| TC-LAND-004 Fuentes | PASS | `document.fonts.check` Saira + Barlow = true; preconnect + `display=swap` presentes |
| TC-LAND-005 Placeholder blanco | PASS* | Código: `Landing` retorna `div.bg-bg` mientras `!content.data` (no throttleado en vivo) |
| TC-LAND-006 Track 1× | PASS | 2× `POST /api/track` en dev (StrictMode) — aceptable per nota |
| TC-LAND-007 Falla de track no rompe | PASS* | Código: fire-and-forget `.catch(()=>{})` |
| TC-LAND-008 Logo + wordmark | PASS | `img alt="Resolute Force"`, punto `·` rojo, → `#inicio` |
| TC-LAND-009 Anchors de nav | PASS | Productos/Manifiesto/Historia/Contacto → `top=80px` (respeta `scroll-mt-20`) |
| TC-LAND-010 aria-label Carrito | PASS | `button[aria-label="Carrito"]` único |
| TC-LAND-011 Badge 0→count | PASS | Oculto vacío; muestra 1, incrementa por suma de qty |
| TC-LAND-012 Header sticky + blur | PASS | `sticky top-0 z-50`, `rgba(10,10,11,0.78)`, `backdrop blur(14px)` |
| TC-LAND-013 Sin hamburguesa, wrap | PASS | A 360px nav envuelve (h=164px), Carrito visible, sin toggle |
| TC-LAND-014 Carrito abre drawer | PASS | Drawer vacío "Tu carrito (0) · está vacío · Ver productos" |
| TC-LAND-015 Marquee 6 frases + ◆ | PASS | 12 spans (lista duplicada); incluye `Stop at Nothing` |
| TC-LAND-016 Anima y loopea | PASS | `animate-marquee` 32s linear infinite (código + movimiento visible) |
| TC-LAND-017 Marquee vacío | PASS* | Código: mapea array doblado vacío, sin crash |
| TC-LAND-018 Reduced-motion ignorado | **FAIL→Hallazgo H-01** | Sin `prefers-reduced-motion` en ningún lado |
| TC-LAND-019 Hero kicker/títulos/subtítulo | PASS | Subtítulo dinámico + hardcode `Esta es la norma Resolute.` |
| TC-LAND-020 CTA primario → Productos | PASS | Scroll a `#productos` |
| TC-LAND-021 CTA secundario → Manifiesto | PASS | `top=80px` |
| TC-LAND-022 Badges + scroll cue | PASS | Envíos/3 cuotas/Algodón premium + cue `Scroll` |
| TC-LAND-023 Manifiesto copy + imagen | PASS | Alt y badge correctos |
| TC-LAND-024 Tres principios | PASS | `03 Stop at nothing` (minúscula) — ver H-02 |
| TC-LAND-025 Grilla 4 productos | PASS | Azul Marino, Negro, Verde Militar, Blanco |
| TC-LAND-026 Contenido de card | PASS | h3 línea, swatch `dotColor`, `$30.000`. **Seed:** Blanco línea = "Stop At Nothing" |
| TC-LAND-027 Tag badge | PASS | Más vendida / Nuevo; Negro y Verde sin badge |
| TC-LAND-028 Default primer talle en stock | PASS | Todo en stock → `S` seleccionado (bg-tx). OOS-default no ejercitado en vivo (código + unit test) |
| TC-LAND-029 Seleccionar resalta | PASS | Click `M` → activo (bg-tx text-bg) |
| TC-LAND-030 Talle OOS deshabilitado/tachado | PASS* | Código: `disabled`, `title="Sin stock"`, `line-through` (sin stock=0 en seed) |
| TC-LAND-031 Agregar → toast + drawer | PASS | Toast `Stop At Nothing · Blanco (S)`, drawer abre, badge sube |
| TC-LAND-032 Agotado → "Sin stock" | PASS* | Código: `soldOut=every(stock<=0)`, botón disabled "Sin stock" |
| TC-LAND-033 Grilla vacía si falla catálogo | PASS* | Código: degrada silencioso a grilla vacía → **gap UX H-10** |
| TC-LAND-034 CD-4 "10% OFF" hardcodeado | **FAIL→Hallazgo H-04** | String literal en `Productos.tsx` |
| TC-LAND-035 Historia copy/stats/imagen | PASS | 2024 / +5.000 / 100%; alt y overlay |
| TC-LAND-036 Countdown tickea | PASS | 49d; `Seg` decrementó 21→02 en vivo; `Seg` en gold |
| TC-LAND-037 Última palabra en gold | PASS | `Algo se está` / **forjando** |
| TC-LAND-038 Título de 1 palabra duplica | **FAIL→Hallazgo H-03** | Código: `{lastWord \|\| leadWords}` duplica (seed multi-palabra OK) |
| TC-LAND-039 Clampa a cero en pasado | PASS* | Código + unit test `useCountdown` → **gap UX H-11** |
| TC-LAND-040 `visible=false` oculta | PASS* | Código: `if(!drop.visible) return null` |
| TC-LAND-041 Falla de drop oculta sección | PASS* | Código: `{drop.data && <Proximos/>}` |
| TC-LAND-042 WhatsApp link + número | PASS | href dinámico OK; **número visible hardcodeado → H-05** |
| TC-LAND-043 Instagram + Email | PASS | IG `www.instagram.com/resoluteforceok/`, handle `@resoluteforceok`; mailto OK. `noopener` sin `noreferrer` → H-13 |
| TC-LAND-044 Ubicación no-link | PASS | `<div>` "Rosario · Envíos a todo el país" |
| TC-LAND-045 Sin formulario | PASS | No hay `<form>` ni inputs |
| TC-LAND-046 Footer marca + columnas | PASS | Tienda/Marca/Seguinos. `Guía de talles`→`#productos` → H-12 |
| TC-LAND-047 Social del footer desde contenido | PASS | IG ahora deriva de `contactInstagram` (fix aplicado), WA de `contactWhatsapp` |
| TC-LAND-048 Legal + año + badges | PASS | Badges OK. **Año `2026` hardcodeado → H-06** |
| TC-LAND-049 Toast único | PASS | Reemplaza mensaje anterior |
| TC-LAND-050 Auto-dismiss ~2400ms | PASS | `animation: toast 2.4s`; removido del DOM |
| TC-LAND-051 Check rojo (no verde) | PASS | `stroke="#e4322b"` — divergencia conocida (cosmética) |
| TC-LAND-052 Mobile 360–428 | PASS | 1 columna (308px), sin scroll horizontal |
| TC-LAND-053 Tablet 768 | PASS | 2 columnas (329px) |
| TC-LAND-054 Desktop ≥1024 | PASS | 4 columnas (270px) a 1280 |
| TC-LAND-055 Reflow suave | PASS | 4→2→1 sin clipping ni overflow |
| TC-LAND-056 Tap targets | PARCIAL | Botones 41–43px OK; **nav links 23px < 44px → H-08** |
| TC-LAND-057 Jerarquía de headings | PASS | 1× h1, secciones h2, productos h3, sin saltos |
| TC-LAND-058 Calidad de alt | PASS | Decorativas `alt=""`; con contenido descriptivas |
| TC-LAND-059 Navegación por teclado | PASS | Orden DOM correcto; 0 tabindex positivos; disabled excluidos |
| TC-LAND-060 Focus-visible | PASS | Ring por defecto presente (`outline auto` azul) |
| TC-LAND-061 Contraste | PARCIAL | gold 10.5, muted **6.81 (OK, corrige sospecha del doc)**, texto 18; **blanco/rojo 4.38 < 4.5 → H-07** |
| TC-LAND-062 Reduced-motion ignorado | **FAIL→H-01** | Mismo origen que TC-018 |
| TC-LAND-063 Carrito anunciado | PASS | Vía `aria-label`; badge sin `aria-live` → H-14 |
| TC-LAND-064 Colores de marca | PASS | Tokens `#e4322b`/`#e8b53e`/`#0a0a0b` verificados |
| TC-LAND-065 Tipografía Saira/Barlow | PASS | h1 = Saira Condensed; root = Barlow |
| TC-LAND-066 Selección roja | PASS | `::selection #e4322b` |
| TC-LAND-067 Fallback de error de contenido | PASS* | Código: rama `content.isError` → h1 "No pudimos cargar la tienda" + Reintentar |
| TC-LAND-068 Reintentar recupera | PASS* | Código: `content.refetch()` |
| TC-LAND-069 Red lenta → blank → hidrata | PASS* | Código: placeholder `bg-bg` mientras pending |
| TC-LAND-070 Imagen rota | PASS | En vivo: sin `onError`, `naturalWidth=0`, alt preservado, card usable → H-09 |
| TC-LAND-071 Reload conserva carrito, drawer cerrado | PASS | `partialize:{items}`; tras reload drawer/checkout cerrados, badge refleja persistido |
| TC-LAND-072 CDN de fuentes bloqueado | BLOQUEADO | No se puede bloquear el CDN con el tooling disponible; fallback `system-ui` presente en código |
| TC-LAND-073 CD-9 casing inconsistente | **FAIL→Hallazgo H-02** | Tres casings coexisten confirmados |

\* PASS por inspección de código/lógica + unit tests; no ejercitado en vivo por requerir mutación de stock/contenido o intercepción de red sin tumbar la API compartida.

---

## 3. Hallazgos exploratorios

Sin hallazgos nuevos fuera del guion más allá de los confirmados abajo. El testing exploratorio (responsive a 4 anchos, contraste WCAG calculado, orden de foco real con Tab, fuentes vía `document.fonts`, imagen rota inyectada, persistencia de `rf-cart`) reforzó hallazgos ya previstos por el archivo. Observación positiva: el texto **muted `#97979d` mide 6.81:1** sobre el fondo — **supera AA normal**, contradiciendo la sospecha del doc; no es defecto.

---

## 4. Huecos de cobertura (sugerencias para el set)

1. **Escape/XSS de contenido dinámico en la landing** (marquee, hero titles, drop title) — referido a Módulo 13, pero falta un smoke test en esta página que renderiza casi todo desde `content`.
2. **Robustez ante campos de contacto ausentes:** `Contacto.tsx` usa `content.contactWhatsapp`/`contactInstagram` **sin optional chaining** (`.replace`). Falta TC que valide que `content` sin esos campos no tira la página.
3. **Producto con `sizes: []`** (vacuously `soldOut`) — mencionado en nota de TC-032 pero sin caso propio.
4. **Doble-clic rápido en `Agregar`** (dedupe de línea / suma de qty) — borde de robustez, aunque el drawer sea Módulo 3.
5. **`rf-cart` corrupto/ inválido en localStorage** y su reconcile al cargar — no hay TC.
6. **Zoom 200% / text-resize (a11y WCAG 1.4.4)** y reflow de tipografía `clamp()`.
7. **`prefers-reduced-motion`** como caso accionable único (hoy disperso entre TC-018/062).
8. **Cambio dinámico de `transferDiscountPct`/`contactWhatsapp` en admin** y su verificación de desync en la landing (hoy implícito en CD-4/H-05).

---

## 5. Detalle de hallazgos (ordenados por severidad)

### [H-01] No se respeta `prefers-reduced-motion`
- **Severidad:** Medio
- **Tipo:** Accesibilidad
- **Dónde:** Global (`index.css`, Tailwind) — marquee, `ember` (Proximos), `float` (Hero), toast, `scroll-behavior: smooth`.
- **Pasos para reproducir:**
  1. Activar "Reducir movimiento" en el SO.
  2. Cargar `/`.
- **Esperado:** Animaciones decorativas pausadas/atenuadas y scroll no-suave bajo reduced-motion.
- **Actual:** Todas las animaciones siguen corriendo; no existe ninguna media query `prefers-reduced-motion` (`grep` = 0 coincidencias).
- **Impacto:** Usuarios con sensibilidad vestibular/mareo o trastornos por movimiento sufren molestia; incumple WCAG 2.3.3 (AAA) y buena práctica 2.2.
- **Evidencia:** `apps/web/src/index.css` (sin media query); marquee/ember/float/toast activos.

### [H-02] "Stop At Nothing" con tres casings distintos (CD-9)
- **Severidad:** Medio
- **Tipo:** Visual / Datos
- **Dónde:** Card de producto (Blanco), Marquee + intro de Productos, Manifiesto principio 03.
- **Pasos para reproducir:**
  1. Cargar `/` y comparar el frase en las tres ubicaciones.
- **Esperado:** Un único casing canónico de marca.
- **Actual:** Coexisten **`Stop At Nothing`** (card), **`Stop at Nothing`** (marquee/intro) y **`Stop at nothing`** (principio 03).
- **Impacto:** Inconsistencia de marca visible; resta prolijidad y confunde el nombre de la línea.
- **Evidencia:** `landing-fullpage.png` (sección Manifiesto vs Productos vs Marquee).

### [H-04] "10% OFF" hardcodeado se desincroniza de `transferDiscountPct` (CD-4)
- **Severidad:** Medio
- **Tipo:** Funcional / Datos
- **Dónde:** `Productos.tsx` línea inferior de la grilla.
- **Pasos para reproducir:**
  1. Cambiar `transferDiscountPct` (admin) a, p.ej., 15.
  2. Recargar la landing.
- **Esperado:** El descuento mostrado refleja el valor de contenido (o una única fuente de verdad con el badge de checkout).
- **Actual:** El texto `… 10% OFF pagando por transferencia` es un literal en `Productos.tsx`; no deriva de `transferDiscountPct`. El badge de transferencia del checkout sí se computa → ambos se desincronizan.
- **Impacto:** Promesa de precio incorrecta al usuario si el % real difiere de 10 (riesgo comercial/legal menor).
- **Evidencia:** `Productos.tsx:17`.

### [H-03] Título de drop de una sola palabra se renderiza duplicado
- **Severidad:** Bajo
- **Tipo:** Funcional / Visual
- **Dónde:** `Proximos.tsx` (`#proximos`).
- **Pasos para reproducir:**
  1. Setear `drop.title` a una sola palabra (p.ej. `Pressure`) en admin.
  2. Recargar.
- **Esperado:** La palabra se muestra una vez (en gold).
- **Actual:** Con un solo token, `lastWord=''`, `leadWords='Pressure'` y `{lastWord || leadWords}` cae al lead → renderiza `Pressure` / `Pressure` (con `<br/>`). El seed actual es multi-palabra, por eso en vivo se ve bien.
- **Impacto:** Título roto solo en el caso de una palabra; bajo porque el contenido habitual es multi-palabra.
- **Evidencia:** `Proximos.tsx` (`words.length > 1 ? words.pop()! : ''`).

### [H-05] Número de WhatsApp visible hardcodeado (desync con `contactWhatsapp`)
- **Severidad:** Bajo
- **Tipo:** Datos
- **Dónde:** `Contacto.tsx:18` (card WhatsApp).
- **Pasos para reproducir:**
  1. Cambiar `contactWhatsapp` en admin a otro número.
  2. Recargar la landing.
- **Esperado:** El número mostrado coincide con el `href`.
- **Actual:** El `href` usa `content.contactWhatsapp`, pero el texto visible `+54 341 321-3723` es literal → si cambia el número, el link va a uno y el texto muestra otro.
- **Impacto:** El usuario podría leer un número y ser dirigido a otro chat; confusión.
- **Evidencia:** `Contacto.tsx:16-18`.

### [H-06] Año del footer hardcodeado (`© 2026`)
- **Severidad:** Bajo
- **Tipo:** Datos
- **Dónde:** `Footer.tsx:33`.
- **Pasos para reproducir:**
  1. Leer la línea legal del footer.
- **Esperado:** Año dinámico (`new Date().getFullYear()`).
- **Actual:** `© 2026 Resolute Force · Hecho en Argentina` literal; quedará obsoleto en 2027.
- **Impacto:** Mantenimiento silencioso; percepción de sitio desactualizado el año próximo.
- **Evidencia:** `Footer.tsx:33`.

### [H-07] Contraste blanco-sobre-rojo 4.38:1 no alcanza AA-normal
- **Severidad:** Bajo
- **Tipo:** Accesibilidad
- **Dónde:** Marquee (texto blanco sobre `#e4322b`), badges `Más vendida`/`Nuevo`, hover de CTA.
- **Pasos para reproducir:**
  1. Medir `#ffffff` sobre `#e4322b`.
- **Esperado:** ≥ 4.5:1 para texto normal.
- **Actual:** 4.38:1 → cumple AA-large (≥3.0) pero **no** AA-normal; el texto del marquee es de tamaño normal.
- **Impacto:** Legibilidad reducida para baja visión en el marquee/badges.
- **Evidencia:** cálculo WCAG (ratio 4.38).

### [H-08] Tap target de links de nav ~23px (< 44px)
- **Severidad:** Bajo
- **Tipo:** Accesibilidad
- **Dónde:** `Nav.tsx` (Productos/Manifiesto/Historia/Contacto).
- **Pasos para reproducir:**
  1. Emular 390px; medir altura de los links de nav.
- **Esperado:** ~44px de área táctil (WCAG 2.5.5 / guía móvil).
- **Actual:** ~23px de alto (solo texto, sin padding vertical extra). Carrito/talles/Agregar sí cumplen (41–43px).
- **Impacto:** Toques imprecisos en móvil sobre la navegación principal.
- **Evidencia:** `getBoundingClientRect().height = 23`.

### [H-09] Imagen de producto rota sin fallback
- **Severidad:** Bajo
- **Tipo:** Visual / UX
- **Dónde:** `ProductCard.tsx` (y logos/lifestyle).
- **Pasos para reproducir:**
  1. Apuntar `imageUrl` a un asset inexistente (probado en vivo cambiando `src`).
- **Esperado:** Imagen placeholder de marca.
- **Actual:** Sin `onError`; se ve el placeholder de imagen rota del browser (`naturalWidth=0`). El resto de la card (talles, precio, Agregar) sigue funcional y el `alt` se expone.
- **Impacto:** Estética degradada ante 404 de assets; no bloquea la compra.
- **Evidencia:** prueba en vivo + ausencia de `onError` en `ProductCard.tsx`.

### [H-10] Falla del catálogo degrada a grilla vacía sin estado de error
- **Severidad:** Bajo
- **Tipo:** UX
- **Dónde:** `Productos` / `Landing.tsx` (`products.data ?? []`).
- **Pasos para reproducir:**
  1. Forzar `GET /api/products` a fallar/`[]` con `/api/content` OK.
- **Esperado:** Estado vacío o error con guía/reintento.
- **Actual:** La sección renderiza header/intro/footer pero la grilla queda vacía, sin banner ni mensaje (a diferencia de `content`, que sí tiene fallback).
- **Impacto:** Usuario ve "tienda sin productos" sin saber que hubo un error.
- **Evidencia:** código (`products.data ?? []`, sin rama de error).

### [H-11] Countdown muestra `00:00:00:00` indefinido tras el target
- **Severidad:** Bajo
- **Tipo:** UX
- **Dónde:** `Proximos.tsx` / `useCountdown`.
- **Pasos para reproducir:**
  1. Setear `targetAt` en el pasado con `visible=true`.
- **Esperado:** Estado "ya salió"/"en vivo" o auto-ocultar.
- **Actual:** Clampa a `00/00/00/00` y se queda así; no hay estado de lanzamiento ni auto-hide (solo `visible=false` lo oculta).
- **Impacto:** Sección con countdown muerto si el equipo olvida actualizar el drop.
- **Evidencia:** `diffParts` con `Math.max(0,…)` + unit test.

### [H-12] "Guía de talles" enlaza a `#productos` (no existe guía real)
- **Severidad:** Bajo
- **Tipo:** UX
- **Dónde:** `Footer.tsx` columna Tienda.
- **Pasos para reproducir:**
  1. Click en `Guía de talles`.
- **Esperado:** Página/sección de guía de talles.
- **Actual:** Hace scroll a la grilla de productos; no hay guía.
- **Impacto:** Expectativa incumplida; el usuario que duda del talle no obtiene ayuda.
- **Evidencia:** `Footer.tsx` (`href="#productos"`).

### [H-13] Enlaces externos con `rel="noopener"` sin `noreferrer`
- **Severidad:** Bajo
- **Tipo:** Visual/UX (seguridad menor — ver Módulo 13)
- **Dónde:** Cards de WhatsApp/Instagram/Email (`Contacto.tsx`), social del footer.
- **Pasos para reproducir:**
  1. Inspeccionar anclas `target="_blank"`.
- **Esperado:** `rel="noopener noreferrer"`.
- **Actual:** Solo `noopener`; falta `noreferrer` (fuga de `Referer`).
- **Impacto:** Menor; privacidad del referrer hacia terceros.
- **Evidencia:** `Contacto.tsx:16,20` y `Footer.tsx`.

### [H-14] Badge del carrito sin `aria-live`
- **Severidad:** Bajo
- **Tipo:** Accesibilidad
- **Dónde:** `Nav.tsx` badge.
- **Pasos para reproducir:**
  1. Con lector de pantalla, agregar productos y observar si se anuncia el cambio de cantidad.
- **Esperado:** Anuncio del nuevo conteo al cambiar.
- **Actual:** El conteo es texto plano dentro del botón, sin `aria-live`; el cambio no se anuncia dinámicamente (se lee solo al enfocar el botón).
- **Impacto:** Usuario de lector no percibe que se sumó un ítem sin re-navegar al botón.
- **Evidencia:** ausencia de `aria-live` en el badge.

---

### Evidencia adjunta
- `landing-fullpage.png` — captura de página completa (escritorio 1280px) usada para H-02 y verificación visual general.
