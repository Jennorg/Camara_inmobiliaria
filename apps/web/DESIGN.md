---
name: CIEBO
description: Plataforma institucional de la Cámara Inmobiliaria del Estado Bolívar; sobria, verificable, verde profundo sobre papel claro.
colors:
  registro-green-deep: "#022c22"
  registro-green: "#04432f"
  emerald: "#10b981"
  emerald-strong: "#059669"
  emerald-wash: "#d1fae5"
  emerald-mist: "#ecfdf5"
  ink: "#1e293b"
  ink-muted: "#64748b"
  paper: "#f8fafc"
  surface: "#ffffff"
  surface-subtle: "#f1f5f9"
  line: "#e2e8f0"
  danger: "#ef4444"
  warning: "#f59e0b"
typography:
  display:
    fontFamily: "'Playfair Display', Georgia, serif"
    fontSize: "clamp(2rem, 5vw, 3.5rem)"
    fontWeight: 600
    lineHeight: 1.1
  headline:
    fontFamily: "'Montserrat', 'Inter Variable', sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.2
  body:
    fontFamily: "'Inter Variable', sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "'Inter Variable', sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    letterSpacing: "0.06em"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.emerald-strong}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "10px 20px"
  button-primary-hover:
    backgroundColor: "{colors.registro-green}"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "24px"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "10px 14px"
---

# Design System: CIEBO

## Overview

**Creative North Star: "El Registro Oficial"**

CIEBO avala carnets, constancias de solvencia y documentos legales; su interfaz debe parecerse a un registro público bien llevado: papel claro, tinta oscura, un verde profundo que da autoridad y un esmeralda que señala acción. La expresión es contenida. El sitio público puede tener un titular editorial en serif; el panel es de trabajo y prioriza escaneo, densidad útil y consistencia sobre decoración.

La identidad verde esmeralda existente se conserva y se refina. No se reemplaza: se unifican radios, sombras, grises y verdes que hoy varían entre pantallas.

**Key Characteristics:**
- Verde profundo + esmeralda sobre papel claro; neutros de la familia slate.
- Titulares serif solo en el sitio público; todo el panel en sans.
- Superficies planas con borde fino; sombra solo como respuesta a estado o para capas flotantes.
- Movimiento corto y funcional; respeta `prefers-reduced-motion`.

## Colors

Paleta de dos verdes y un neutro frío, con color de estado reservado a significado.

### Primary
- **Verde Registro** (#022c22 / #04432f): barras de navegación oscuras, encabezados institucionales, texto de máxima autoridad.
- **Esmeralda** (#10b981 / #059669 hover): acciones primarias, foco, estados activos, íconos de acento.

### Secondary
- **Bruma Esmeralda** (#ecfdf5 / #d1fae5): fondos de chips, filas seleccionadas, avisos informativos positivos.

### Neutral
- **Tinta** (#1e293b): texto principal.
- **Tinta Suave** (#64748b): texto secundario; es el gris más claro permitido para texto.
- **Papel** (#f8fafc), **Superficie** (#ffffff), **Superficie Sutil** (#f1f5f9): fondo de página, tarjetas, zonas de apoyo.
- **Línea** (#e2e8f0): bordes y divisores.

### Named Rules
**La Regla del Texto Legible.** Ningún texto informativo por debajo de 4.5:1 contra su fondo. El gris más claro para texto es Tinta Suave; los tonos más claros son solo para bordes e íconos decorativos.
**La Regla del Esmeralda Escaso.** El esmeralda marca acción o estado activo; no se usa como relleno decorativo de secciones enteras.

## Typography

**Display Font:** Playfair Display (con Georgia) — solo titulares del sitio público.
**Body Font:** Inter Variable (con sans-serif) — panel, formularios, texto corrido.
**Certificados y comprobantes:** Great Vibes y Alex Brush (caligráficas) solo en certificados imprimibles; no en la interfaz.
**Headline/Label:** Montserrat en títulos de sección institucionales; Inter para etiquetas.

**Character:** autoridad editorial en la puerta de entrada, claridad neutra en el trabajo diario.

### Hierarchy
- **Display** (600, clamp 2–3.5rem, 1.1): titular del hero y cabeceras de páginas institucionales.
- **Headline** (700, 1.5rem, 1.2): títulos de sección y de panel.
- **Title** (600, 1.125rem, 1.3): tarjetas y modales.
- **Body** (400, 1rem, 1.6): texto corrido, 65–75ch máximo.
- **Label** (700, 0.75rem, 0.06em, mayúsculas): encabezados de tabla y metadatos. Piso de 11px; nada por debajo.

### Named Rules
**La Regla del Piso de 11px.** Ningún texto por debajo de 11px. Las microetiquetas de 8–10px se suben a 11px.

## Layout

Contenedor centrado con márgenes de 16px en móvil y hasta ~1280px en escritorio. El panel usa barra lateral fija en escritorio que pasa a navegación colapsable en móvil. Espaciado en pasos de 4/8px; secciones públicas con aire generoso (48–96px), el panel con ritmo compacto (16–24px). Tablas anchas se envuelven en contenedor con scroll horizontal propio y no desbordan la página. Objetivos táctiles de al menos 44px en móvil.

## Elevation & Depth

Planas por defecto: tarjetas con borde Línea y sombra mínima (`shadow-sm`). La elevación fuerte (`shadow-lg`/`2xl`) queda para modales, menús flotantes y popovers. Las sombras tintadas de esmeralda solo aparecen en el botón primario durante hover/foco.

### Named Rules
**La Regla de Sombra por Estado.** Una superficie en reposo no lleva sombra pesada; la sombra aparece al elevarse o interactuar.

## Shapes

Esquinas suaves y consistentes: 8px para controles pequeños, 12px para botones e inputs, 16px para tarjetas, 24px solo para modales y heros. Los radios mayores (2rem–2.5rem) se retiran del panel. Píldoras (`rounded-full`) solo para chips, avatares y estados.

## Components

### Buttons
- **Shape:** 12px de radio.
- **Primary:** fondo Esmeralda fuerte (#059669), texto blanco, padding 10×20px; hover a Verde Registro.
- **Hover / Focus:** transición ≤200ms de color; foco con anillo esmeralda visible (2px, offset 2px).
- **Secondary / Ghost:** borde Línea, texto Tinta; hover con Superficie Sutil.

### Cards / Containers
- **Corner Style:** 16px.
- **Background:** Superficie sobre Papel.
- **Border:** 1px Línea.
- **Internal Padding:** 24px (16px en móvil).

### Inputs / Fields
- **Style:** fondo Papel, borde 1px Línea, radio 12px.
- **Focus:** borde Esmeralda y anillo esmeralda suave.
- **Búsqueda:** siempre con dropdown de criterio a la izquierda, ícono de lupa, botón limpiar y placeholder contextual (regla de GEMINI.md).

### Navigation
- Barra pública oscura (Verde Registro) con cinta de afiliación; panel con barra lateral. Estado activo en Esmeralda. En móvil, menú colapsable de ancho completo.

## Do's and Don'ts

### Do:
- **Do** usar Tinta Suave (#64748b) como gris mínimo para texto.
- **Do** unificar radios en 8/12/16/24px y sombras en la escala sm/md/lg.
- **Do** respetar `prefers-reduced-motion` en toda animación.
- **Do** mantener los filtros como dropdowns por categoría.

### Don't:
- **Don't** usar texto de menos de 11px ni grises más claros que Tinta Suave para texto.
- **Don't** usar `animate-bounce` ni rebotes elásticos.
- **Don't** mezclar serif en el panel de trabajo.
- **Don't** rellenar secciones completas de esmeralda ni usar sombras tintadas en reposo.
