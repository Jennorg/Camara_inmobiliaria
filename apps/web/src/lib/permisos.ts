// Permisos por sección que devuelve la API en `user.permisos` (ver apps/api/src/services/permisos.service.ts).
export type Accion = 'ver' | 'crear' | 'editar' | 'eliminar'
export type MapaPermisos = Record<string, Partial<Record<Accion, boolean>>>

// Fallback legacy: solo cuando la respuesta no trae `permisos` (API vieja). `{}` NO activa el fallback.
// Se puede eliminar cuando la API con permisos esté desplegada en todos lados.
export type RolLegacy = 'admin' | null
const SOLO_SUPERADMIN = ['roles', 'admin_users']

export const puede = (
  permisos: MapaPermisos | undefined,
  seccion: string,
  accion: Accion,
  esSuperAdmin: boolean,
  rolLegacy: RolLegacy = null,
) => {
  if (esSuperAdmin) return true
  if (permisos === undefined) {
    if (rolLegacy === 'admin') return !SOLO_SUPERADMIN.includes(seccion)
    return false
  }
  return !!permisos[seccion]?.[accion]
}

export const tieneAlgunVer = (permisos: MapaPermisos | undefined, rolLegacy: RolLegacy = null) =>
  permisos === undefined ? rolLegacy !== null : Object.values(permisos).some(p => !!p?.ver)
