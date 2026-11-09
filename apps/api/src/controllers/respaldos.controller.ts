import type { NextFunction, Request, Response } from 'express'
import { db } from '../lib/db.js'
import { empaquetar, generarRespaldo, leerRespaldo, resumir, restaurarRespaldo, type Respaldo } from '../lib/respaldo.js'
import { CONSERVAR, historial, type TipoRespaldo } from '../lib/respaldo-historial.js'
import { isSuperAdmin } from '../middlewares/auth.middleware.js'

const PALABRA_CONFIRMACION = 'RESTAURAR'

/** Solo el súper administrador. Una sesión suplantada nunca respalda ni restaura, aunque el JWT diga super_admin. */
export const soloSuperAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || !isSuperAdmin(req.user) || req.user.impersonatedBy) {
    res.status(403).json({ success: false, message: 'Acceso denegado: solo el súper administrador gestiona los respaldos' })
    return
  }
  next()
}

const fallo = (res: Response, contexto: string, error: unknown, estado = 500) => {
  console.error(`respaldos (${contexto}):`, error)
  res.status(estado).json({ success: false, message: error instanceof Error && estado !== 500 ? error.message : `Error al ${contexto}` })
}
const nombreArchivo = (fecha: string) => `ciebo-respaldo-${fecha.slice(0, 16).replace(/[-:]/g, '').replace('T', '-')}.zip`
const enviarArchivo = (res: Response, contenido: Buffer, nombre: string, id?: number) => {
  res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`)
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, X-Respaldo-Id')
  if (id !== undefined) res.setHeader('X-Respaldo-Id', String(id))
  res.status(200).type('application/zip').send(contenido)
}

/** Genera un respaldo de la base actual y, si hay base de respaldo, lo guarda en el historial. */
export const crearRespaldo = async (tipo: TipoRespaldo, creadoPor: string | null) => {
  const respaldo = await generarRespaldo(db)
  const contenido = empaquetar(respaldo)
  const id = historial ? await historial.guardar(tipo, contenido, { creadoPor, ...resumir(respaldo) }) : undefined
  return { respaldo, contenido, id }
}

// GET /api/respaldos
export const estado = async (_req: Request, res: Response) => {
  try {
    res.json({ success: true, data: { almacenamiento: !!historial, conservar: CONSERVAR, respaldos: historial ? await historial.listar() : [] } })
  } catch (e) { fallo(res, 'cargar el historial de respaldos', e) }
}

// POST /api/respaldos/generar  → entrega el archivo y lo guarda en el historial
export const generar = async (req: Request, res: Response) => {
  try {
    const { respaldo, contenido, id } = await crearRespaldo('manual', req.user?.email ?? null)
    console.log(`[respaldos] respaldo manual por ${req.user?.email}`, resumir(respaldo))
    enviarArchivo(res, contenido, nombreArchivo(respaldo.generado_en), id)
  } catch (e) { fallo(res, 'generar el respaldo', e) }
}

// GET /api/respaldos/:id/descargar
export const descargar = async (req: Request, res: Response) => {
  try {
    const contenido = historial ? await historial.obtener(Number(req.params.id)) : null
    if (!contenido) { res.status(404).json({ success: false, message: 'Respaldo no encontrado' }); return }
    enviarArchivo(res, contenido, nombreArchivo(leerRespaldo(contenido).generado_en), Number(req.params.id))
  } catch (e) { fallo(res, 'descargar el respaldo', e) }
}

// DELETE /api/respaldos/:id
export const eliminar = async (req: Request, res: Response) => {
  try {
    if (!historial || !(await historial.eliminar(Number(req.params.id)))) { res.status(404).json({ success: false, message: 'Respaldo no encontrado' }); return }
    console.log(`[respaldos] respaldo ${req.params.id} eliminado por ${req.user?.email}`)
    res.json({ success: true })
  } catch (e) { fallo(res, 'eliminar el respaldo', e) }
}

const archivoDe = (req: Request): Buffer => {
  if (!Buffer.isBuffer(req.body) || !req.body.length) throw Object.assign(new Error('Adjunta el archivo del respaldo.'), { esDeUsuario: true })
  return req.body
}
const leerOVolver = (res: Response, contenido: Buffer): Respaldo | null => {
  try { return leerRespaldo(contenido) } catch (e) { fallo(res, 'leer el respaldo', e, 400); return null }
}

// POST /api/respaldos/validar  (cuerpo: el archivo) → resumen para confirmar antes de restaurar
export const validar = async (req: Request, res: Response) => {
  try {
    const r = leerOVolver(res, archivoDe(req))
    if (r) res.json({ success: true, data: resumir(r) })
  } catch (e) { fallo(res, 'validar el respaldo', e, 400) }
}

/** Genera el respaldo de seguridad del estado actual y restaura. El respaldo previo se entrega siempre en la respuesta. */
const restaurarDesde = async (req: Request, res: Response, respaldo: Respaldo, confirmacion: unknown) => {
  if (confirmacion !== PALABRA_CONFIRMACION) {
    res.status(400).json({ success: false, message: `Escribe ${PALABRA_CONFIRMACION} para confirmar la restauración` })
    return
  }
  try {
    const previo = await crearRespaldo('previo_restauracion', req.user?.email ?? null)
    const resultado = await restaurarRespaldo(db, respaldo)
    console.log(`[respaldos] RESTAURACIÓN por ${req.user?.email}: respaldo del ${respaldo.generado_en}`, resultado)
    res.json({
      success: true,
      data: { ...resultado, restaurado_de: respaldo.generado_en, respaldo_previo: { id: previo.id ?? null, nombre: nombreArchivo(previo.respaldo.generado_en), contenido: previo.contenido.toString('base64') } },
    })
  } catch (e) { fallo(res, 'restaurar el respaldo (no se modificó ningún dato)', e) }
}

// POST /api/respaldos/restaurar  (cuerpo: el archivo; cabecera X-Confirmacion)
export const restaurarArchivo = async (req: Request, res: Response) => {
  try {
    const r = leerOVolver(res, archivoDe(req))
    if (r) await restaurarDesde(req, res, r, req.header('x-confirmacion'))
  } catch (e) { fallo(res, 'restaurar el respaldo', e, 400) }
}

// POST /api/respaldos/:id/restaurar  (cuerpo JSON: { confirmacion })
export const restaurarGuardado = async (req: Request, res: Response) => {
  try {
    const contenido = historial ? await historial.obtener(Number(req.params.id)) : null
    if (!contenido) { res.status(404).json({ success: false, message: 'Respaldo no encontrado' }); return }
    const r = leerOVolver(res, contenido)
    if (r) await restaurarDesde(req, res, r, req.body?.confirmacion)
  } catch (e) { fallo(res, 'restaurar el respaldo', e) }
}
