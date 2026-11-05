// Catálogo de secciones del panel (ids de NAV_MAIN en CmsAside.tsx, más «roles») y siembra de roles.
export const SECCIONES: { id: string; etiqueta: string }[] = [
  { id: 'finanzas', etiqueta: 'Finanzas' },
  { id: 'asambleas', etiqueta: 'Gestión de Asambleas' },
  { id: 'noticias', etiqueta: 'Noticias' },
  { id: 'leyes', etiqueta: 'Leyes y Decretos' },
  { id: 'reglamentos', etiqueta: 'Reglamentos y Estatutos' },
  { id: 'normas', etiqueta: 'Normas y Procedimientos' },
  { id: 'actas', etiqueta: 'Actas de Asamblea' },
  { id: 'directiva', etiqueta: 'Directiva' },
  { id: 'config', etiqueta: 'Configuración' },
  { id: 'formacion', etiqueta: 'Formación' },
  { id: 'preinscripciones', etiqueta: 'Preinscripciones' },
  { id: 'media', etiqueta: 'Medios' },
  { id: 'afiliados', etiqueta: 'Afiliados' },
  { id: 'solicitudes_cambio', etiqueta: 'Solicitudes de Cambio' },
  { id: 'denuncias', etiqueta: 'Denuncias' },
  { id: 'estudiantes', etiqueta: 'Estudiantes' },
  { id: 'users', etiqueta: 'Usuarios' },
  { id: 'admin_users', etiqueta: 'Administradores' },
  { id: 'analytics', etiqueta: 'Análisis' },
  { id: 'roles', etiqueta: 'Roles y permisos' },
]

// Solo super_admin; nunca se guardan en rol_permisos.
export const SECCIONES_SOLO_SUPERADMIN = ['roles', 'admin_users']

export const ACCIONES = ['ver', 'crear', 'editar', 'eliminar'] as const
export type Accion = (typeof ACCIONES)[number]

const TODAS: Accion[] = [...ACCIONES]
const SIN_ELIMINAR: Accion[] = ['ver', 'crear', 'editar']
const SOLO_VER_EDITAR: Accion[] = ['ver', 'editar']

// Reproduce el acceso actual de las rutas (requireRole / adminRoles), no el de la UI.
export const ROLES_SISTEMA_SEMILLA: Record<string, Record<string, Accion[]>> = {
  admin: Object.fromEntries(
    SECCIONES.filter(s => !SECCIONES_SOLO_SUPERADMIN.includes(s.id)).map(s => [s.id, TODAS]),
  ),
  // afiliados/users/cibir: admin|asistente|administrativo; finanzas/denuncias/pagos: + personal_admin
  // finanzas (finanzas.routes + pagos /admin): requireRole con 'asistente' admitía a TODO el staff por la jerarquía.
  // asambleas (asambleas.routes): adminRoles con 'asistente' admitía a TODO el staff, eliminar incluido.
  // denuncias (denuncias.routes /admin*): adminRoles con 'asistente' admitía a TODO el staff por la jerarquía.
  // users (users.routes): requireRole con 'asistente' admitía a TODO el staff; eliminar era solo admin.
  // afiliados (afiliados.routes): requireRole con 'asistente' admitía a TODO el staff; eliminar era solo admin.
  asistente: { afiliados: SIN_ELIMINAR, solicitudes_cambio: SOLO_VER_EDITAR, users: SIN_ELIMINAR, finanzas: TODAS, asambleas: TODAS, denuncias: TODAS },
  administrativo: { afiliados: SIN_ELIMINAR, solicitudes_cambio: SOLO_VER_EDITAR, users: SIN_ELIMINAR, finanzas: TODAS, asambleas: TODAS, denuncias: TODAS },
  personal_admin: { afiliados: SIN_ELIMINAR, solicitudes_cambio: SOLO_VER_EDITAR, users: SIN_ELIMINAR, finanzas: TODAS, asambleas: TODAS, denuncias: TODAS },
  secretario: { afiliados: SIN_ELIMINAR, solicitudes_cambio: SOLO_VER_EDITAR, users: SIN_ELIMINAR, finanzas: TODAS, asambleas: TODAS, denuncias: TODAS },
  secretaria: { afiliados: SIN_ELIMINAR, solicitudes_cambio: SOLO_VER_EDITAR, users: SIN_ELIMINAR, finanzas: TODAS, asambleas: TODAS, denuncias: TODAS },
  personal: { afiliados: SIN_ELIMINAR, solicitudes_cambio: SOLO_VER_EDITAR, users: SIN_ELIMINAR, finanzas: TODAS, asambleas: TODAS, denuncias: TODAS },
  personal_administrativo: { afiliados: SIN_ELIMINAR, solicitudes_cambio: SOLO_VER_EDITAR, users: SIN_ELIMINAR, finanzas: TODAS, asambleas: TODAS, denuncias: TODAS },
}

const NOMBRES: Record<string, string> = {
  admin: 'Administrador',
  asistente: 'Asistente',
  administrativo: 'Administrativo',
  personal_admin: 'Personal administrativo (admin)',
  secretario: 'Secretario',
  secretaria: 'Secretaria',
  personal: 'Personal',
  personal_administrativo: 'Personal administrativo',
}

type Db = { execute: (s: any) => Promise<any>; batch: (s: any[], mode?: any) => Promise<any> }

// Idempotente: INSERT OR IGNORE, nunca pisa permisos editados.
export async function sembrarRoles(db: Db): Promise<void> {
  const stmts: { sql: string; args: any[] }[] = []
  for (const [clave, secs] of Object.entries(ROLES_SISTEMA_SEMILLA)) {
    stmts.push({ sql: `INSERT OR IGNORE INTO roles (clave, nombre, es_sistema) VALUES (?, ?, 1)`, args: [clave, NOMBRES[clave] ?? clave] })
    for (const [seccion, acc] of Object.entries(secs)) {
      stmts.push({
        sql: `INSERT OR IGNORE INTO rol_permisos (id_rol, seccion, ver, crear, editar, eliminar)
              SELECT id, ?, ?, ?, ?, ? FROM roles WHERE clave = ?`,
        args: [seccion, ...ACCIONES.map(a => (acc.includes(a) ? 1 : 0)), clave],
      })
    }
  }
  await db.batch(stmts, 'write')
}
