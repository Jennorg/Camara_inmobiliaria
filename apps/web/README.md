# Web — Frontend de CIEBO

Aplicación frontend de la plataforma CIEBO. Construida con **React 19**, **Vite 7** y **TailwindCSS 4**. Incluye la landing pública institucional, el portal del afiliado y un completo **Panel Administrativo CMS** con vista previa en vivo.

---

## 📁 Estructura

```
apps/web/
├── src/
│   ├── main.tsx              # Entry point React
│   ├── App.tsx               # Router principal
│   ├── index.css             # Estilos globales + tokens de diseño
│   ├── config/
│   │   └── env.ts            # Variables de entorno del frontend
│   └── pages/
│       ├── landing/          # Landing page pública
│       │   ├── LandingPage.tsx        # Composición de todas las secciones
│       │   ├── components/            # Componentes compartidos de landing
│       │   ├── assets/                # Imágenes y recursos estáticos
│       │   ├── courses/               # Página de cursos (CIBIR, etc.)
│       │   ├── formacion/             # Detalle de programas de formación
│       │   ├── historia/              # Historia e hitos de la cámara
│       │   ├── junta-directiva/       # Página de Junta Directiva
│       │   ├── mision-vision/         # Misión, visión y propósito
│       │   ├── proposito/             # Propósito institucional
│       │   └── direccion/             # Directorio y contacto
│       ├── admin/            # Panel Administrativo (CMS)
│       │   ├── AdminPage.tsx          # Shell del admin con sidebar redimensionable
│       │   └── components/
│       │       ├── CmsAside.tsx       # Sidebar de navegación con colapso y drag
│       │       ├── CmsHeader.tsx      # Cabecera del panel admin
│       │       ├── CmsContent.tsx     # Router dinámico de paneles
│       │       ├── dashboard/         # Panel de métricas y resumen
│       │       ├── Cms/               # Paneles CMS con pantalla dividida
│       │       │   ├── CmsArticlesPanel.tsx  # Shell de pantalla dividida + live preview
│       │       │   ├── NoticiasPanel.tsx     # CRUD de noticias
│       │       │   ├── CursosPanel.tsx       # CRUD de cursos
│       │       │   ├── ConveniosPanel.tsx    # CRUD de convenios
│       │       │   ├── DirectivaPanel.tsx    # CRUD de miembros de directiva
│       │       │   ├── HitosPanel.tsx        # CRUD de hitos históricos
│       │       │   ├── ConfigPanel.tsx       # Configuración general de la landing
│       │       │   ├── LandingPreviewPane.tsx# Iframe de vista previa en vivo
│       │       │   └── CmsShared.tsx         # Componentes y lógica compartida del CMS
│       │       ├── Formacion/         # Panel de gestión de programas
│       │       ├── Analytics/         # Panel de analíticas
│       │       └── Users/             # Panel de gestión de afiliados
│       └── afiliado/         # Portal del afiliado (área privada)
├── public/                   # Recursos públicos estáticos
├── index.html                # HTML base
├── vite.config.js            # Configuración de Vite
├── vercel.json               # Config SPA para Vercel
└── package.json
```

---

## 🚀 Inicio Rápido

### 1. Variables de entorno

```bash
cp .env.example .env
```

Edita `.env`:

```env
VITE_API_URL=http://localhost:3000
```

### 2. Instalar y ejecutar

```bash
# Desde la raíz del monorepo
pnpm dev

# O solo este paquete
pnpm --filter web dev
```

La app estará disponible en `http://localhost:5173`.

---

## 🗂️ Páginas y Rutas

### Landing Pública (`/`)

| Sección | Descripción |
|---|---|
| **Hero** | Banner principal con CTA de afiliación |
| **Nosotros** | Información institucional y misión |
| **Formación** | Cursos y programas disponibles (CIBIR, etc.) |
| **Convenios** | Alianzas y beneficios para afiliados |
| **Noticias** | Últimas novedades del sector inmobiliario |
| **Junta Directiva** | Miembros actuales de la directiva |
| **Historia / Hitos** | Línea del tiempo institucional |
| **Footer** | Contacto, redes sociales y copyright |

### Sub-páginas Públicas

| Ruta | Descripción |
|---|---|
| `/formacion` | Detalle de programas de formación |
| `/cursos/*` | Páginas individuales de cursos (ej: CIBIR) |
| `/junta-directiva` | Directorio completo de la junta |
| `/historia` | Historia e hitos de la cámara |
| `/mision-vision` | Misión, visión y propósito |

### Portal del Afiliado

| Ruta | Descripción |
|---|---|
| `/afiliado` | Dashboard del afiliado autenticado |

### Panel Administrativo (`/admin`)

Panel de gestión interna con autenticación. Incluye:

| Sección | Descripción |
|---|---|
| **Dashboard** | Resumen de métricas y actividad reciente |
| **CMS → Noticias** | CRUD completo de noticias con vista previa |
| **CMS → Cursos** | Gestión de cursos y programas |
| **CMS → Convenios** | Administración de convenios activos |
| **CMS → Directiva** | Edición de miembros de la Junta Directiva |
| **CMS → Historia** | Gestión de hitos históricos |
| **CMS → Configuración** | Editor de todos los textos e imágenes de la landing |
| **Formación** | Panel de programas académicos |
| **Medios** | Biblioteca de archivos e imágenes |
| **Afiliados** | Directorio y gestión del padrón |
| **Análisis** | Métricas y reportes de rendimiento |

---

## ✨ Panel CMS — Características Destacadas

El CMS implementa una experiencia de edición profesional:

- **Pantalla dividida** — Panel de edición + iframe de vista previa en vivo sincronizados mediante `window.postMessage`.
- **Divisores redimensionables** — Todas las columnas (sidebar, panel de contenido, preview) son arrastrables con precisión de píxel.
- **Breadcrumb interactivo** — Al seleccionar un ítem se muestra `Sección / Nombre` en la barra superior. Al hacer clic en "Sección" se regresa a la lista.
- **Preview en vivo** — El iframe de la landing recibe las ediciones en tiempo real sin necesidad de guardar.
- **Scroll automático** — El preview navega automáticamente a la sección relevante al cambiar de pestaña CMS.
- **Acordeón de configuración** — La sección de Configuración General agrupa todos los campos de la landing en acordeones con indicadores de cambios sin guardar.
- **Guardado por lotes** — Los cambios de configuración se envían en una sola solicitud `POST /api/cms/config/batch`.

---

## 🎨 Sistema de Diseño

El proyecto usa TailwindCSS 4 con clases utilitarias estándar. Los colores principales están definidos como variables CSS en `src/index.css`:

| Variable | Valor | Uso |
|---|---|---|
| `--color-primary` | `#00D084` | Botones, acentos, hover |
| `--color-primary-dark` | `#00B870` | Estados hover de botones |
| Admin sidebar | `bg-white` con `border-gray-100` | Fondo limpio minimalista |

Tipografía web: **Inter** (Google Fonts).

---

## 🛠️ Scripts

| Comando | Acción |
|---|---|
| `pnpm dev` | Servidor de desarrollo Vite con HMR |
| `pnpm build` | Build de producción en `dist/` |
| `pnpm preview` | Preview del build de producción |
| `pnpm lint` | ESLint con plugins de React |
| `pnpm check-types` | Verificación de tipos TypeScript |

---

## 🚢 Despliegue en Vercel

El `vercel.json` redirige todas las rutas al `index.html` para el correcto funcionamiento del SPA con React Router.

```bash
vercel --prod
```

Configura `VITE_API_URL` en Vercel apuntando a la API **sin barra final**:

```env
VITE_API_URL=https://cim-back-five.vercel.app
```

Si termina en `/` o con `//`, el navegador puede llamar `//api/...`, recibir un redirect **308** sin cabeceras CORS y fallar la preinscripción.
