// Permisos por sección que devuelve la API en `user.permisos` (ver apps/api/src/services/permisos.service.ts).
export type Accion = 'ver' | 'crear' | 'editar' | 'eliminar'
export type MapaPermisos = Record<string, Partial<Record<Accion, boolean>>>

export const puede = (permisos: MapaPermisos | undefined, seccion: string, accion: Accion, esSuperAdmin: boolean) =>
  esSuperAdmin || !!permisos?.[seccion]?.[accion]

export const tieneAlgunVer = (permisos: MapaPermisos | undefined) =>
  Object.values(permisos ?? {}).some(p => !!p?.ver)
