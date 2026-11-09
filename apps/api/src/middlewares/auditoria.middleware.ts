import type { NextFunction, Request, Response } from 'express'
import { db } from '../lib/db.js'
import { accionDe, asegurarEsquemaAuditoria, entidadDeRuta, registrarAuditoria, sanitizar, tablaDeRuta } from '../lib/auditoria.js'

const ESCRITURA = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
// Sin interés para auditar: sesión, tareas programadas, formularios públicos anónimos, avisos y subidas de archivos
const IGNORADAS = /^\/api\/(auth|cron|public|notifications|uploads)(\/|$)/

/** Datos que un controlador puede fijar en `res.locals.auditoria` para afinar el registro (p. ej. un borrado definitivo). */
export interface AuditoriaLocal { accion?: string; entidad?: string; id_entidad?: string | null; resumen?: string; antes?: unknown; despues?: unknown }

const nombreDe = (cuerpo: any): string | null => {
  if (!cuerpo || typeof cuerpo !== 'object') return null
  const v = cuerpo.titulo ?? cuerpo.nombre ?? cuerpo.razon_social ?? cuerpo.razonSocial ?? cuerpo.email
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, 80) : null
}

/**
 * Registra en `auditoria` cada escritura exitosa de un usuario autenticado: quién, qué, sobre qué registro y, cuando se conoce
 * la tabla, cómo era el registro ANTES de editarlo o borrarlo. Nunca interrumpe ni retrasa la respuesta.
 */
export const auditoria = async (req: Request, res: Response, next: NextFunction) => {
  const ruta = req.originalUrl.split('?')[0]
  if (!ESCRITURA.has(req.method) || IGNORADAS.test(ruta)) return next()

  const destino = entidadDeRuta(ruta)
  let antes: unknown = null
  const tabla = destino.id ? tablaDeRuta(destino) : undefined
  if (tabla && req.method !== 'POST') {
    try {
      await asegurarEsquemaAuditoria(db)
      antes = (await db.execute({ sql: `SELECT * FROM "${tabla.tabla}" WHERE "${tabla.pk}" = ?`, args: [destino.id] })).rows[0] ?? null
    } catch (e) { console.error('auditoria (antes):', e) }
  }

  res.on('finish', () => {
    if (!req.user || res.statusCode >= 400) return
    const extra: AuditoriaLocal = res.locals.auditoria ?? {}
    const accion = extra.accion ?? accionDe(req.method, ruta)
    const entidad = extra.entidad ?? destino.entidad
    const id = extra.id_entidad !== undefined ? extra.id_entidad : destino.id
    const nombre = nombreDe(req.body)
    registrarAuditoria(db, {
      id_user: req.user.id ?? null,
      email: req.user.email ?? null,
      rol: req.user.rol ?? null,
      suplantado_por: req.user.impersonatedBy ?? null,
      accion, modulo: destino.modulo, entidad, id_entidad: id,
      metodo: req.method, ruta, estado: res.statusCode,
      resumen: extra.resumen ?? `${accion} · ${entidad}${id ? ` #${id}` : ''}${nombre ? ` — «${nombre}»` : ''}`,
      antes: extra.antes ?? antes,
      despues: extra.despues ?? (req.method === 'DELETE' ? null : sanitizar(req.body)),
      ip: (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0].trim() ?? req.ip ?? null,
    }).catch(e => console.error('auditoria (registro):', e))
  })
  next()
}
