# API — Backend REST de CIEBO

Backend de la plataforma CIEBO. Construido con **Express 5**, **TypeScript** y **Turso (LibSQL)** como base de datos edge. Diseñado para correr tanto en servidor local como en entornos serverless (Vercel Functions).

---

## 📁 Estructura

```
apps/api/
├── src/
│   ├── index.ts              # Entry point — Express app + rutas
│   ├── config/
│   │   └── env.ts            # Validación de variables de entorno
│   ├── controllers/
│   │   ├── cms.controller.ts      # CRUD para todo el contenido de la landing
│   │   └── afiliados.controller.ts# Registro y gestión de afiliados
│   ├── routes/
│   │   ├── index.ts          # Agrupador de rutas
│   │   ├── cms.routes.ts     # /api/cms/*
│   │   ├── afiliados.routes.ts # /api/afiliados/*
│   │   └── public.routes.ts  # /api/public/*
│   ├── lib/
│   │   ├── db.ts             # Cliente singleton de Turso/LibSQL
│   │   └── http.ts           # Helpers de respuesta HTTP
│   ├── middlewares/          # Middlewares de Express (auth, errores, etc.)
│   ├── schemas/              # Esquemas de validación Zod
│   ├── services/             # Lógica de negocio separada de los controllers
│   └── types/                # Tipos TypeScript compartidos
├── .env.example              # Plantilla de variables de entorno
├── vercel.json               # Configuración serverless Vercel
├── tsconfig.json
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
PORT=3000
NODE_ENV=development

# Turso — obtén en https://app.turso.tech → tu DB → Connect
TURSO_DATABASE_URL=libsql://your-db-name-your-org.turso.io
TURSO_AUTH_TOKEN=your_token_here

# Auth
JWT_SECRET=tu_secreto_seguro_minimo_16_chars
JWT_EXPIRES_IN=7d

# Frontend (para links en correos)
APP_URL=http://localhost:5173

# CORS (uno o varios, separados por coma)
CORS_ORIGINS=http://localhost:5173,https://cim-front.vercel.app,https://*.vercel.app
```

### 2. Instalar y ejecutar

```bash
# Desde la raíz del monorepo
pnpm dev

# O directamente en este paquete
pnpm --filter api dev
```

La API estará disponible en `http://localhost:3000`.

---

## 🗺️ Endpoints de la API

### Health Check

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/` | Estado de la API |
| `GET` | `/health` | Health check con timestamp |

---

### CMS — `/api/cms`

Gestión del contenido de la landing page. Todos los endpoints son utilizados exclusivamente por el Panel Administrativo.

#### Noticias

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/cms/noticias` | Listar todas las noticias |
| `POST` | `/api/cms/noticias` | Crear nueva noticia |
| `PUT` | `/api/cms/noticias/:id` | Actualizar noticia |
| `DELETE` | `/api/cms/noticias/:id` | Eliminar noticia |

#### Cursos

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/cms/cursos` | Listar cursos activos |
| `POST` | `/api/cms/cursos` | Crear curso |
| `PUT` | `/api/cms/cursos/:id` | Actualizar curso |
| `DELETE` | `/api/cms/cursos/:id` | Eliminar curso |

#### Convenios

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/cms/convenios` | Listar convenios |
| `POST` | `/api/cms/convenios` | Crear convenio |
| `PUT` | `/api/cms/convenios/:id` | Actualizar convenio |
| `DELETE` | `/api/cms/convenios/:id` | Eliminar convenio |

#### Junta Directiva

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/cms/directiva` | Listar miembros |
| `POST` | `/api/cms/directiva` | Agregar miembro |
| `PUT` | `/api/cms/directiva/:id` | Actualizar miembro |
| `DELETE` | `/api/cms/directiva/:id` | Eliminar miembro |

#### Hitos Históricos

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/cms/hitos` | Listar hitos |
| `POST` | `/api/cms/hitos` | Crear hito |
| `PUT` | `/api/cms/hitos/:id` | Actualizar hito |
| `DELETE` | `/api/cms/hitos/:id` | Eliminar hito |

#### Configuración General

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/cms/config` | Obtener toda la configuración (clave→valor) |
| `POST` | `/api/cms/config` | Crear/actualizar un campo de configuración |
| `POST` | `/api/cms/config/batch` | Guardar múltiples campos en una sola solicitud |
| `DELETE` | `/api/cms/config/:clave` | Eliminar un campo de configuración |

---

### Afiliados — `/api/afiliados`

Gestión del padrón de afiliados a CIEBO.

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/afiliados` | Listar todos los afiliados |
| `GET` | `/api/afiliados/cibir/solicitudes` | Solicitudes al programa CIBIR |
| `POST` | `/api/afiliados/registro` | Registrar nuevo afiliado |
| `PATCH` | `/api/afiliados/:id/aprobar` | Aprobar solicitud de afiliado |
| `PATCH` | `/api/afiliados/:id/rechazar` | Rechazar solicitud |

---

## 🗃️ Base de Datos

La API usa **Turso** — una plataforma de bases de datos SQLite distribuida (edge) compatible con LibSQL.

- Cliente: `@libsql/client`
- Singleton en `src/lib/db.ts`
- Compatible con SQLite local en desarrollo y Turso en producción

---

## 🛠️ Scripts

| Comando | Acción |
|---|---|
| `pnpm dev` | Servidor de desarrollo con hot-reload (`tsx watch`) |
| `pnpm build` | Compila TypeScript a `dist/` |
| `pnpm start` | Ejecuta el binario compilado (`dist/index.js`) |
| `pnpm lint` | ESLint con TypeScript |
| `pnpm check-types` | Verificación de tipos sin compilar |

---

## Despliegue en Vercel

El proyecto incluye `vercel.json` configurado para funcionar como serverless function. La app Express está preparada para no escuchar en puerto cuando `VERCEL=1`.

```bash
vercel --prod
```

Asegúrate de configurar las variables de entorno en el dashboard de Vercel antes del despliegue.
