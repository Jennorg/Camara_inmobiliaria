import type { Request, Response } from 'express'
import XLSX from 'xlsx'
import { esProgramaCohorte } from '../lib/cohortes.js'
import { asignarCohorte, cambiarEstadoCohorte, crearCohorte, inscritosDeCohorte, listarCohortes } from '../services/cohortes.service.js'

/** Responde con el status de los errores de negocio (`status`) o 500. */
function responderError(res: Response, error: unknown, contexto: string) {
  const status = (error as { status?: number }).status
  if (status) return res.status(status).json({ success: false, message: (error as Error).message })
  console.error(`${contexto}:`, error)
  return res.status(500).json({ success: false, message: `Error en ${contexto}` })
}

const entero = (v: unknown) => (/^\d+$/.test(String(v ?? '')) ? Number(v) : null)

/** GET /api/academia/cohortes?programa=CIBIR */
export const adminListCohortes = async (req: Request, res: Response) => {
  try {
    res.json({ success: true, data: await listarCohortes(typeof req.query.programa === 'string' ? req.query.programa : undefined) })
  } catch (e) {
    responderError(res, e, 'listado de cohortes')
  }
}

/** POST /api/academia/cohortes — { programa_codigo, nombre?, descripcion? }: abre la siguiente y cierra la abierta */
export const adminCrearCohorte = async (req: Request, res: Response) => {
  const { programa_codigo, nombre, descripcion } = req.body ?? {}
  if (!esProgramaCohorte(programa_codigo)) {
    res.status(400).json({ success: false, message: 'programa_codigo debe ser CIBIR, PREANI, PEGI o PADI' })
    return
  }
  try {
    res.status(201).json({ success: true, data: await crearCohorte(programa_codigo, typeof nombre === 'string' ? nombre : undefined, typeof descripcion === 'string' ? descripcion : undefined) })
  } catch (e) {
    responderError(res, e, 'creación de cohorte')
  }
}

/** PATCH /api/academia/cohortes/:id/estado — { estado: 'Abierta' | 'Cerrada' } */
export const adminCambiarEstadoCohorte = async (req: Request, res: Response) => {
  const id = entero(req.params.id)
  const { estado } = req.body ?? {}
  if (id === null || (estado !== 'Abierta' && estado !== 'Cerrada')) {
    res.status(400).json({ success: false, message: 'id de cohorte o estado inválido' })
    return
  }
  try {
    await cambiarEstadoCohorte(id, estado)
    res.json({ success: true })
  } catch (e) {
    responderError(res, e, 'cambio de estado de cohorte')
  }
}

/** PATCH /api/academia/inscripciones/:id/cohorte — { id_cohorte: number | null } */
export const adminAsignarCohorte = async (req: Request, res: Response) => {
  const idInscripcion = entero(req.params.id)
  const raw = req.body?.id_cohorte
  const idCohorte = raw === null ? null : entero(raw)
  if (idInscripcion === null || (raw !== null && idCohorte === null)) {
    res.status(400).json({ success: false, message: 'id de inscripción o de cohorte inválido' })
    return
  }
  try {
    await asignarCohorte(idInscripcion, idCohorte)
    res.json({ success: true })
  } catch (e) {
    responderError(res, e, 'asignación de cohorte')
  }
}

/** GET /api/academia/cohortes/:id/inscritos.xlsx */
export const adminExportarCohorte = async (req: Request, res: Response) => {
  const id = entero(req.params.id)
  if (id === null) {
    res.status(400).json({ success: false, message: 'id de cohorte inválido' })
    return
  }
  try {
    const { cohorte, filas } = await inscritosDeCohorte(id)
    const hoja = XLSX.utils.json_to_sheet(filas.map(f => ({
      Nombre: f.nombre, 'C.I./RIF': f.cedula, Correo: f.email, Teléfono: f.telefono, 'N° afiliado': f.n_afiliado,
      Estatus: f.estatus, 'Fecha de inscripción': String(f.fecha_inscripcion ?? '').slice(0, 10),
    })))
    const libro = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(libro, hoja, String(cohorte.nombre).slice(0, 31).replace(/[\\/?*[\]:]/g, ' '))
    const archivo = `${cohorte.programa_codigo}-cohorte-${cohorte.numero}.xlsx`
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${archivo}"`)
    res.send(XLSX.write(libro, { type: 'buffer', bookType: 'xlsx' }))
  } catch (e) {
    responderError(res, e, 'exportación de cohorte')
  }
}
