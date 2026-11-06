// Catálogo de secciones del panel (ids de NAV_MAIN en CmsAside.tsx, más «roles») y siembra de roles.
export const SECCIONES: { id: string; etiqueta: string }[] = [
  { id: 'finanzas', etiqueta: 'Control de Finanzas' },
  { id: 'asambleas', etiqueta: 'Gestión de Asambleas' },
  { id: 'noticias', etiqueta: 'Noticias' },
  { id: 'marco_legal', etiqueta: 'Marco Legal' },
  { id: 'directiva', etiqueta: 'Junta Directiva' },
  { id: 'config', etiqueta: 'Configuración' },
  { id: 'formacion', etiqueta: 'Gestión de Formación' },
  { id: 'preinscripciones', etiqueta: 'Preinscripciones' },
  { id: 'afiliados', etiqueta: 'Directorio de Miembros' },
  { id: 'afiliaciones', etiqueta: 'Afiliaciones' },
  { id: 'solicitudes_cambio', etiqueta: 'Solicitudes de Cambio' },
  { id: 'denuncias', etiqueta: 'Tribunal de Ética' },
  { id: 'estudiantes', etiqueta: 'Estudiantes' },
  { id: 'users', etiqueta: 'Control de Acceso' },
  { id: 'admin_users', etiqueta: 'Administradores' },
  { id: 'analytics', etiqueta: 'Análisis y Métricas' },
  { id: 'roles', etiqueta: 'Roles y permisos' },
]

// Solo super_admin; nunca se guardan en rol_permisos.
export const SECCIONES_SOLO_SUPERADMIN = ['roles', 'admin_users']

export const ACCIONES = ['ver', 'crear', 'editar', 'eliminar'] as const
export type Accion = (typeof ACCIONES)[number]

const TODAS: Accion[] = [...ACCIONES]
const SIN_ELIMINAR: Accion[] = ['ver', 'crear', 'editar']
const SOLO_VER_EDITAR: Accion[] = ['ver', 'editar']

// Único rol de sistema que se siembra en producción (super_admin no es fila: acceso total). Los demás roles los crea el super_admin.
export const ROLES_SISTEMA_SEMILLA: Record<string, Record<string, Accion[]>> = {
  admin: Object.fromEntries(
    SECCIONES.filter(s => !SECCIONES_SOLO_SUPERADMIN.includes(s.id)).map(s => [s.id, TODAS]),
  ),
}

// Roles de personal anteriores: ya NO se siembran; solo los usan las pruebas (sembrarRoles con staffHistorico)
// para comprobar que cada ruta conserva el acceso que daba el guard viejo.
// Reproduce el acceso actual de las rutas (requireRole / adminRoles), no el de la UI.
export const STAFF_HISTORICO_PRUEBAS: Record<string, Record<string, Accion[]>> = {
  // afiliados/users/cibir: admin|asistente|administrativo; finanzas/denuncias/pagos: + personal_admin
  // finanzas (finanzas.routes + pagos /admin): requireRole con 'asistente' admitía a TODO el staff por la jerarquía.
  // asambleas (asambleas.routes): adminRoles con 'asistente' admitía a TODO el staff, eliminar incluido.
  // denuncias (denuncias.routes /admin*): adminRoles con 'asistente' admitía a TODO el staff por la jerarquía.
  // users (users.routes): requireRole con 'asistente' admitía a TODO el staff; eliminar era solo admin.
  // afiliados (afiliados.routes): requireRole con 'asistente' admitía a TODO el staff; eliminar era solo admin.
  // afiliaciones: se separó de afiliados (proceso de afiliación); mismo acceso que afiliados.
  // formacion/preinscripciones/estudiantes (academia.routes + cibir.routes): el guard de router admitía a TODO el staff;
  //   los DELETE de cursos, inscripciones y profesores eran solo admin (formacion sin «eliminar»); borrar un documento de
  //   estudiante lo podía hacer el staff (estudiantes con «eliminar»).
  // cms/uploads: solo admin/super_admin (el staff no recibe noticias, leyes, directiva, config ni media). analytics: sin guard de rol.
  asistente: { afiliados: SIN_ELIMINAR, afiliaciones: SIN_ELIMINAR, solicitudes_cambio: SOLO_VER_EDITAR, users: SIN_ELIMINAR, finanzas: TODAS, asambleas: TODAS, denuncias: TODAS, formacion: SIN_ELIMINAR, preinscripciones: SIN_ELIMINAR, estudiantes: TODAS },
  administrativo: { afiliados: SIN_ELIMINAR, afiliaciones: SIN_ELIMINAR, solicitudes_cambio: SOLO_VER_EDITAR, users: SIN_ELIMINAR, finanzas: TODAS, asambleas: TODAS, denuncias: TODAS, formacion: SIN_ELIMINAR, preinscripciones: SIN_ELIMINAR, estudiantes: TODAS },
  personal_admin: { afiliados: SIN_ELIMINAR, afiliaciones: SIN_ELIMINAR, solicitudes_cambio: SOLO_VER_EDITAR, users: SIN_ELIMINAR, finanzas: TODAS, asambleas: TODAS, denuncias: TODAS, formacion: SIN_ELIMINAR, preinscripciones: SIN_ELIMINAR, estudiantes: TODAS },
  secretario: { afiliados: SIN_ELIMINAR, afiliaciones: SIN_ELIMINAR, solicitudes_cambio: SOLO_VER_EDITAR, users: SIN_ELIMINAR, finanzas: TODAS, asambleas: TODAS, denuncias: TODAS, formacion: SIN_ELIMINAR, preinscripciones: SIN_ELIMINAR, estudiantes: TODAS },
  secretaria: { afiliados: SIN_ELIMINAR, afiliaciones: SIN_ELIMINAR, solicitudes_cambio: SOLO_VER_EDITAR, users: SIN_ELIMINAR, finanzas: TODAS, asambleas: TODAS, denuncias: TODAS, formacion: SIN_ELIMINAR, preinscripciones: SIN_ELIMINAR, estudiantes: TODAS },
  personal: { afiliados: SIN_ELIMINAR, afiliaciones: SIN_ELIMINAR, solicitudes_cambio: SOLO_VER_EDITAR, users: SIN_ELIMINAR, finanzas: TODAS, asambleas: TODAS, denuncias: TODAS, formacion: SIN_ELIMINAR, preinscripciones: SIN_ELIMINAR, estudiantes: TODAS },
  personal_administrativo: { afiliados: SIN_ELIMINAR, afiliaciones: SIN_ELIMINAR, solicitudes_cambio: SOLO_VER_EDITAR, users: SIN_ELIMINAR, finanzas: TODAS, asambleas: TODAS, denuncias: TODAS, formacion: SIN_ELIMINAR, preinscripciones: SIN_ELIMINAR, estudiantes: TODAS },
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
export async function sembrarRoles(db: Db, opciones: { staffHistorico?: boolean } = {}): Promise<void> {
  const stmts: { sql: string; args: any[] }[] = []
  const semilla = opciones.staffHistorico ? { ...ROLES_SISTEMA_SEMILLA, ...STAFF_HISTORICO_PRUEBAS } : ROLES_SISTEMA_SEMILLA
  for (const [clave, secs] of Object.entries(semilla)) {
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
