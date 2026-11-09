import type { Request, Response } from 'express'
import { asegurarEsquemaAuditoria } from './auditoria.js'
import { isSuperAdmin } from '../middlewares/auth.middleware.js'

type Db = { execute: (s: any) => Promise<any>; batch: (s: any[], mode?: any) => Promise<any> }

/**
 * Borrado de un registro: lógico para todos los roles; definitivo solo si el súper administrador lo pide con `?definitivo=true`.
 * Devuelve el modo a aplicar, o null después de responder 403 cuando alguien sin permiso pide el definitivo.
 */
export function modoDeBorrado(req: Request, res: Response): 'logico' | 'definitivo' | null {
  const pideDefinitivo = req.query?.definitivo === 'true' || req.query?.definitivo === '1'
  if (!pideDefinitivo) return 'logico'
  if (req.user && isSuperAdmin(req.user) && !req.user.impersonatedBy) return 'definitivo'
  res.status(403).json({ success: false, message: 'Solo el súper administrador puede eliminar definitivamente' })
  return null
}

/** Marca como eliminados (con quién y cuándo) los registros de `tabla` cuyo `pk` esté en `ids`. Devuelve cuántos cambió. */
export async function borrarLogico(db: Db, tabla: string, pk: string, ids: (string | number)[], idUser: number | null | undefined): Promise<number> {
  if (!ids.length) return 0
  await asegurarEsquemaAuditoria(db)
  const r = await db.execute({
    sql: `UPDATE "${tabla}" SET eliminado_en = strftime('%Y-%m-%dT%H:%M:%SZ','now'), eliminado_por = ? WHERE "${pk}" IN (${ids.map(() => '?').join(',')}) AND eliminado_en IS NULL`,
    args: [idUser ?? null, ...ids],
  })
  return Number(r.rowsAffected)
}

/** Deja constancia en la auditoría del modo de borrado (el middleware la completa con quién y cuándo). */
export const marcarBorrado = (res: Response, modo: 'logico' | 'definitivo', extra: { antes?: unknown; resumen?: string } = {}) => {
  res.locals ??= {} // Express siempre lo trae; las pruebas con un `res` simulado no
  res.locals.auditoria = { ...res.locals.auditoria, accion: modo === 'definitivo' ? 'eliminar_definitivo' : 'eliminar', ...extra }
}
