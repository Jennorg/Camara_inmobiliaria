import { db } from '../lib/db.js'
import { ACCIONES, SECCIONES, SECCIONES_SOLO_SUPERADMIN, type Accion } from '../config/secciones.js'

export type MapaPermisos = Record<string, Record<Accion, boolean>>

// TTL corto por si corre más de un proceso (la invalidación explícita solo alcanza al actual).
const TTL_MS = 30_000
const cache = new Map<string, { mapa: MapaPermisos; vence: number }>()

export function invalidarCachePermisos(): void {
  cache.clear()
}

const congelar = (m: MapaPermisos): MapaPermisos => {
  for (const p of Object.values(m)) Object.freeze(p)
  return Object.freeze(m)
}

async function calcular(roles: string[]): Promise<MapaPermisos> {
  if (roles.includes('super_admin')) {
    return Object.fromEntries(SECCIONES.map(s => [s.id, { ver: true, crear: true, editar: true, eliminar: true }]))
  }
  if (roles.length === 0) return {}
  const r = await db.execute({
    sql: `SELECT rp.seccion, MAX(rp.ver) AS ver, MAX(rp.crear) AS crear, MAX(rp.editar) AS editar, MAX(rp.eliminar) AS eliminar
          FROM rol_permisos rp JOIN roles r ON r.id = rp.id_rol
          WHERE r.activo = 1 AND r.clave IN (${roles.map(() => '?').join(',')})
          GROUP BY rp.seccion`,
    args: roles,
  })
  const mapa: MapaPermisos = {}
  for (const row of r.rows) {
    const seccion = String(row.seccion)
    if (SECCIONES_SOLO_SUPERADMIN.includes(seccion)) continue
    mapa[seccion] = Object.fromEntries(ACCIONES.map(a => [a, Number(row[a]) === 1])) as Record<Accion, boolean>
  }
  return mapa
}

/** Permisos efectivos (OR por casilla) de un conjunto de roles. El resultado está congelado. */
export async function permisosDeRoles(roles: string[]): Promise<MapaPermisos> {
  const clave = [...new Set(roles)].sort().join(',')
  const hit = cache.get(clave)
  if (hit && hit.vence > Date.now()) return hit.mapa
  const mapa = congelar(await calcular(roles))
  cache.set(clave, { mapa, vence: Date.now() + TTL_MS })
  return mapa
}

/**
 * Rol primario (retrocompatibilidad con `rol`). Los roles base conservan su jerarquía (admin/afiliado/estudiante);
 * un rol personalizado con algún `ver` da 'personal'. Nunca toca `roles[]` (lo que autoriza requireRole).
 */
export function rolPrimario(roles: string[], permisos: MapaPermisos, fallback = 'estudiante'): string {
  if (roles.includes('super_admin')) return 'super_admin'
  if (roles.includes('admin')) return 'admin'
  if (roles.includes('afiliado')) return 'afiliado'
  if (roles.includes('estudiante')) return fallback // rol base: no pasa a 'personal'
  return Object.values(permisos).some(p => p.ver) ? 'personal' : fallback
}

/** ¿Tiene el usuario esa casilla en esa sección? super_admin siempre; ante error de BD, false (fail-closed). */
export async function puedePermiso(user: { roles?: string[]; rol?: string }, seccion: string, accion: Accion): Promise<boolean> {
  try {
    const roles = user.roles ?? (user.rol ? [user.rol] : [])
    if (roles.includes('super_admin')) return true
    return (await permisosDeRoles(roles))[seccion]?.[accion] === true
  } catch {
    return false
  }
}

/** Directorio de Miembros y proceso de Afiliaciones: los datos de un afiliado los abre cualquiera de las dos. */
export const SECCIONES_AFILIADO = ['afiliados', 'afiliaciones']

/** ¿Tiene la casilla en alguna de las secciones? Mismas reglas que puedePermiso. */
export async function puedeAlgunPermiso(user: { roles?: string[]; rol?: string }, secciones: string[], accion: Accion): Promise<boolean> {
  for (const s of secciones) if (await puedePermiso(user, s, accion)) return true
  return false
}
