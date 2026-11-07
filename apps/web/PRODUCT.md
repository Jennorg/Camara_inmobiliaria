# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Afiliados y empresas (confirmado):** corredores y empresas inmobiliarias del Estado Bolívar afiliadas a la Cámara. Entran a `/panel` a ver su estado de cuenta, reportar pagos, sacar carnet, constancia de solvencia y certificados, y formarse.
- **Personal administrativo (confirmado):** directiva, finanzas y administradores. Gestionan afiliaciones, cobranza, formación (CIBIR), contenido del sitio (CMS), denuncias y roles/permisos por sección, también desde `/panel`.
- **Inferido del código, no confirmado como prioridad:** aspirantes y estudiantes del CIBIR (preinscripción, entrevista, aprobación) y público general que visita el sitio institucional.

## Product Purpose

Plataforma web institucional y de gestión de la Cámara Inmobiliaria del Estado Bolívar (CIEBO). Presenta a la Cámara ante el público y centraliza la operación: afiliaciones, mensualidades y cobranza, formación CIBIR, documentos del Marco Legal, directorio de miembros y denuncias. El éxito es que un afiliado resuelva sus trámites sin pedir ayuda y que el personal administre la Cámara sin hojas de cálculo.

## Positioning

Es la plataforma oficial de una cámara gremial regional, con respaldo legal e institucional: carnets, constancias de solvencia y certificados verificables por código, y un directorio de miembros oficiales. Un portal inmobiliario genérico no puede emitir esos documentos ni representar a la Cámara.

## Operating Context

- Operación en Venezuela, idioma español, montos en USD con equivalencia en bolívares.
- Un afiliado es oficial solo con estatus `Afiliado` y código asignado; antes es aspirante (CIBIR, expediente).
- La mensualidad vence un día fijo del mes; la mora bloquea carnet, constancia y certificados.
- Acceso por roles y permisos por sección; el super_admin crea roles. Existe un único rol de sistema `admin`.
- Documentos legales (Marco Legal) organizados en secciones que el admin crea, renombra y marca públicas o privadas.
- Despliegue en Vercel (SPA + API serverless) con Turso. Dominio de producción: camarainmobiliariadebolivar.com.

## Capabilities and Constraints

- Frontend: React 19, Vite, Tailwind CSS 4, shadcn/ui, lucide-react. Monorepo pnpm/Turborepo con API Express 5.
- Regla de proyecto (GEMINI.md): todo buscador de personas/registros lleva dropdown de criterio a la izquierda, ícono de búsqueda, botón limpiar y placeholder contextual. Sin buscadores generales: los filtros son por categoría con dropdown.
- Rutas públicas: inicio, historia, misión/visión, propósito, junta directiva, dirección, directorio, Marco Legal, denuncias, cursos, afiliación. Panel: `/panel` (el antiguo `/admin` fue eliminado).
- Type-check de web con línea base conocida de errores previos; no empeorarla.

## Brand Commitments

- Nombre: Cámara Inmobiliaria del Estado Bolívar (CIEBO); programa de formación CIBIR.
- Logos existentes en `src/assets` (logo.svg, logo_ciebo_green.svg, Logo*.png). Identidad verde institucional (esmeralda) vigente: el usuario pidió conservarla y refinarla, no reemplazarla.

## Evidence on Hand

- Imágenes reales en `src/assets` (Cibir, Camara_Metropolitana, empresaria, catálogo CIBIR).
- Documentos legales reales cargados en producción (Leyes y Decretos, Reglamentos y Estatutos, Actas de Asamblea).
- No hay testimonios, cifras de afiliados ni casos de éxito documentados: no inventarlos.

## Product Principles

1. **Confianza institucional:** todo se ve oficial, verificable y sobrio; la Cámara avala lo que emite.
2. **Resolver sin ayuda:** el afiliado ve su estado (solvencia, deuda, documentos) y la siguiente acción sin interpretar.
3. **Densidad útil para el personal:** el panel prioriza escaneo rápido, consistencia y permisos claros por encima de la expresión.
4. **Lo público es público:** nada privado ni de uso interno aparece en el sitio abierto.
5. **Español claro:** etiquetas y mensajes directos, sin jerga técnica.

## Accessibility & Inclusion

Sin estándar formal confirmado. Mínimo razonable adoptado: contraste legible, foco visible, navegación por teclado y uso en móvil, porque muchos afiliados acceden desde el teléfono (a confirmar).
