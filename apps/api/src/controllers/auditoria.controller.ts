import type { Request, Response } from 'express'
import { db } from '../lib/db.js'
import { asegurarEsquemaAuditoria, fotografiar } from '../lib/auditoria.js'
import { PAPELERA, TIPOS_INSTANTANEA } from '../lib/papelera.js'
import { eliminarInstantanea, listarInstantaneas, restaurarInstantanea } from '../lib/instantaneas.js'

const fallo = (res: Response, contexto: string, e: unknown) => {
  console.error(`auditoria (${contexto}):`, e)
  res.status(500).json({ success: false, message: `Error al ${contexto}` })
}
const texto = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

// GET /api/auditoria?usuario=&accion=&modulo=&entidad=&desde=&hasta=&q=&pagina=&porPagina=
export const listar = async (req: Request, res: Response) => {
  try {
    await asegurarEsquemaAuditoria(db)
    const f = { usuario: texto(req.query.usuario), accion: texto(req.query.accion), modulo: texto(req.query.modulo), entidad: texto(req.query.entidad), desde: texto(req.query.desde), hasta: texto(req.query.hasta), q: texto(req.query.q) }
    const donde: string[] = []; const args: string[] = []
    if (f.usuario) { donde.push('a.email = ?'); args.push(f.usuario) }
    if (f.accion) { donde.push('a.accion = ?'); args.push(f.accion) }
    if (f.modulo) { donde.push('a.modulo = ?'); args.push(f.modulo) }
    if (f.entidad) { donde.push('a.entidad = ?'); args.push(f.entidad) }
    if (f.desde) { donde.push('a.creado_en >= ?'); args.push(f.desde) }
    if (f.hasta) { donde.push('a.creado_en < ?'); args.push(`${f.hasta}T23:59:59.999Z`) }
    if (f.q) { donde.push('a.resumen LIKE ?'); args.push(`%${f.q}%`) }
    const filtro = donde.length ? `WHERE ${donde.join(' AND ')}` : ''
    const porPagina = Math.min(100, Math.max(1, Number(req.query.porPagina) || 50))
    const pagina = Math.max(1, Number(req.query.pagina) || 1)
    const [filas, total] = await Promise.all([
      db.execute({ sql: `SELECT a.*, u.nombre AS nombre_usuario FROM auditoria a LEFT JOIN users u ON u.id = a.id_user ${filtro} ORDER BY a.id DESC LIMIT ? OFFSET ?`, args: [...args, porPagina, (pagina - 1) * porPagina] }),
      db.execute({ sql: `SELECT COUNT(*) AS n FROM auditoria a ${filtro}`, args }),
    ])
    res.json({ success: true, data: filas.rows, total: Number((total.rows[0] as any).n), pagina, porPagina })
  } catch (e) { fallo(res, 'cargar la auditoría', e) }
}

// GET /api/auditoria/filtros → valores para los desplegables
export const filtros = async (_req: Request, res: Response) => {
  try {
    await asegurarEsquemaAuditoria(db)
    const distintos = async (col: string) => ((await db.execute(`SELECT DISTINCT ${col} AS v FROM auditoria WHERE ${col} IS NOT NULL ORDER BY ${col}`)).rows as any[]).map(r => String(r.v))
    res.json({ success: true, data: { acciones: await distintos('accion'), modulos: await distintos('modulo'), entidades: await distintos('entidad'), usuarios: await distintos('email') } })
  } catch (e) { fallo(res, 'cargar los filtros de auditoría', e) }
}

const primera = (s: unknown) => String(s ?? '').trim().split(/\s+/)[0]
/** «Ana Contreras»: primer nombre y primer apellido de la persona del usuario; si no tiene ficha, su nombre de usuario; si tampoco, el correo. */
const nombreCorto = (x: { nombres?: unknown; apellidos?: unknown; nombre_usuario?: unknown; email?: unknown }) =>
  [primera(x.nombres), primera(x.apellidos)].filter(Boolean).join(' ') || String(x.nombre_usuario ?? '').trim() || (x.email as string | null)

// GET /api/auditoria/ultimo?entidad=afiliados&ids=1,2,3 → quién hizo lo último sobre cada registro («Modificado por»)
export const ultimo = async (req: Request, res: Response) => {
  try {
    const entidad = texto(req.query.entidad)
    const ids = String(req.query.ids ?? '').split(',').map(s => s.trim()).filter(s => /^\d+$/.test(s)).slice(0, 200)
    if (!entidad || !ids.length) { res.json({ success: true, data: {} }); return }
    await asegurarEsquemaAuditoria(db)
    const r = await db.execute({
      sql: `SELECT a.id_entidad, a.accion, a.email, a.creado_en, u.nombre AS nombre_usuario,
              (SELECT p.nombres FROM personas p WHERE LOWER(p.email) = LOWER(COALESCE(u.email, a.email)) AND p.eliminado_en IS NULL LIMIT 1) AS nombres,
              (SELECT p.apellidos FROM personas p WHERE LOWER(p.email) = LOWER(COALESCE(u.email, a.email)) AND p.eliminado_en IS NULL LIMIT 1) AS apellidos
            FROM auditoria a LEFT JOIN users u ON u.id = a.id_user
            WHERE a.entidad = ? AND a.id_entidad IN (${ids.map(() => '?').join(',')})
              AND a.id = (SELECT MAX(b.id) FROM auditoria b WHERE b.entidad = a.entidad AND b.id_entidad = a.id_entidad)`,
      args: [entidad, ...ids],
    })
    res.json({ success: true, data: Object.fromEntries((r.rows as any[]).map(x => [String(x.id_entidad), { accion: x.accion, usuario: nombreCorto(x), email: x.email, fecha: x.creado_en }])) })
  } catch (e) { fallo(res, 'consultar la última modificación', e) }
}

// ── Papelera ────────────────────────────────────────────────────────────────
// GET /api/auditoria/papelera?tipo=
export const papelera = async (req: Request, res: Response) => {
  try {
    await asegurarEsquemaAuditoria(db)
    const tipo = texto(req.query.tipo)
    if (tipo && !PAPELERA[tipo] && !TIPOS_INSTANTANEA[tipo]) { res.status(400).json({ success: false, message: 'Tipo de registro desconocido' }); return }
    const tipos = tipo ? (PAPELERA[tipo] ? [tipo] : []) : Object.keys(PAPELERA)
    const instantaneas = (tipo ? (TIPOS_INSTANTANEA[tipo] ? await listarInstantaneas(db, tipo) : []) : await listarInstantaneas(db))
      .map(i => ({ tipo: i.tipo, etiqueta: TIPOS_INSTANTANEA[i.tipo] ?? i.tipo, id: i.id, nombre: i.nombre, eliminado_en: i.eliminado_en, eliminado_por: i.eliminado_por }))
    const filas = [...(await Promise.all(tipos.map(async t => {
      const e = PAPELERA[t]
      const r = await db.execute(`SELECT x."${e.pk}" AS id, x."${e.nombre}" AS nombre, x.eliminado_en, u.email AS eliminado_por
        FROM "${e.tabla}" x LEFT JOIN users u ON u.id = x.eliminado_por WHERE x.eliminado_en IS NOT NULL ORDER BY x.eliminado_en DESC LIMIT 200`)
      return (r.rows as any[]).map(x => ({ tipo: t, etiqueta: e.etiqueta, id: x.id, nombre: x.nombre, eliminado_en: x.eliminado_en, eliminado_por: x.eliminado_por }))
    }))).flat(), ...instantaneas].sort((a, b) => String(b.eliminado_en).localeCompare(String(a.eliminado_en)))
    res.json({ success: true, data: filas, tipos: { ...Object.fromEntries(Object.entries(PAPELERA).map(([k, v]) => [k, v.etiqueta])), ...TIPOS_INSTANTANEA } })
  } catch (e) { fallo(res, 'cargar la papelera', e) }
}

// POST /api/auditoria/papelera/:tipo/:id/restaurar
export const restaurar = async (req: Request, res: Response) => {
  try {
    const tipoReq = String(req.params.tipo)
    if (TIPOS_INSTANTANEA[tipoReq]) {
      try {
        const r = await restaurarInstantanea(db, Number(req.params.id))
        if (!r) { res.status(404).json({ success: false, message: 'El registro no está en la papelera' }); return }
        res.locals.auditoria = { accion: 'restaurar', entidad: tipoReq, resumen: `restaurar · ${TIPOS_INSTANTANEA[tipoReq]} #${req.params.id} (${r.restauradas} registros)` }
        res.json({ success: true, message: 'Registro restaurado', data: r })
      } catch (err) {
        // Casi siempre: la persona se volvió a registrar y ahora hay un registro con el mismo correo, cédula o código
        console.error('auditoria (restaurar instantánea):', err)
        res.status(409).json({ success: false, message: 'No se pudo restaurar: ya existe un registro con los mismos datos (¿la persona se volvió a registrar?). No se modificó nada. Elimina el registro nuevo y vuelve a intentarlo.' })
      }
      return
    }
    const e = PAPELERA[String(req.params.tipo)]
    if (!e) { res.status(404).json({ success: false, message: 'Tipo de registro desconocido' }); return }
    const r = await db.execute({ sql: `UPDATE "${e.tabla}" SET eliminado_en = NULL, eliminado_por = NULL${e.alRestaurar ?? ''} WHERE "${e.pk}" = ? AND eliminado_en IS NOT NULL`, args: [String(req.params.id)] })
    if (!r.rowsAffected) { res.status(404).json({ success: false, message: 'El registro no está en la papelera' }); return }
    res.locals.auditoria = { accion: 'restaurar', entidad: String(req.params.tipo), resumen: `restaurar · ${e.etiqueta} #${req.params.id}` }
    res.json({ success: true, message: 'Registro restaurado' })
  } catch (e) { fallo(res, 'restaurar el registro', e) }
}

// DELETE /api/auditoria/papelera/:tipo/:id?confirmacion=ELIMINAR  → borrado definitivo de lo que ya está en la papelera
export const eliminarDefinitivo = async (req: Request, res: Response) => {
  try {
    const tipoReq = String(req.params.tipo)
    if (TIPOS_INSTANTANEA[tipoReq]) {
      if (req.query.confirmacion !== 'ELIMINAR') { res.status(400).json({ success: false, message: 'Escribe ELIMINAR para confirmar el borrado definitivo' }); return }
      if (!(await eliminarInstantanea(db, Number(req.params.id)))) { res.status(404).json({ success: false, message: 'El registro no está en la papelera' }); return }
      res.locals.auditoria = { accion: 'eliminar_definitivo', entidad: tipoReq, resumen: `eliminar definitivamente · ${TIPOS_INSTANTANEA[tipoReq]} #${req.params.id} (descartado de la papelera)` }
      res.json({ success: true, message: 'Registro eliminado definitivamente' })
      return
    }
    const e = PAPELERA[String(req.params.tipo)]
    if (!e) { res.status(404).json({ success: false, message: 'Tipo de registro desconocido' }); return }
    if (req.query.confirmacion !== 'ELIMINAR') { res.status(400).json({ success: false, message: 'Escribe ELIMINAR para confirmar el borrado definitivo' }); return }
    const existe = await db.execute({ sql: `SELECT 1 FROM "${e.tabla}" WHERE "${e.pk}" = ? AND eliminado_en IS NOT NULL`, args: [String(req.params.id)] })
    if (!existe.rows.length) { res.status(404).json({ success: false, message: 'El registro no está en la papelera' }); return }
    const antes = await fotografiar(db, { [e.tabla]: [e.pk, [String(req.params.id)]] })
    await db.execute({ sql: `DELETE FROM "${e.tabla}" WHERE "${e.pk}" = ?`, args: [String(req.params.id)] })
    res.locals.auditoria = { accion: 'eliminar_definitivo', entidad: String(req.params.tipo), resumen: `eliminar definitivamente · ${e.etiqueta} #${req.params.id}`, antes }
    res.json({ success: true, message: 'Registro eliminado definitivamente' })
  } catch (e) { fallo(res, 'eliminar el registro definitivamente', e) }
}
