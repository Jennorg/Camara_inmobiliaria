import { Request, Response } from 'express'
import * as svc from '../services/asambleas.service.js'

/** Traduce los errores de negocio (con `status`) y registra los inesperados. */
const responder = (res: Response, error: any, contexto: string) => {
  if (error?.status) return res.status(error.status).json({ success: false, message: error.message })
  console.error(`asambleas (${contexto}):`, error)
  return res.status(500).json({ success: false, message: `Error en ${contexto}` })
}

const id = (req: Request) => Number(req.params.id)

export const listar = async (req: Request, res: Response) => {
  try { res.json({ success: true, data: await svc.listarAsambleas({ tipo: String(req.query.tipo ?? ''), anio: String(req.query.anio ?? '') }) }) }
  catch (e) { responder(res, e, 'listar asambleas') }
}
export const obtener = async (req: Request, res: Response) => {
  try { res.json({ success: true, data: await svc.obtenerAsamblea(id(req)) }) }
  catch (e) { responder(res, e, 'obtener la asamblea') }
}
export const crear = async (req: Request, res: Response) => {
  try { res.status(201).json({ success: true, data: { id_asamblea: await svc.crearAsamblea(req.body ?? {}, req.user!.id) } }) }
  catch (e) { responder(res, e, 'crear la asamblea') }
}
export const actualizar = async (req: Request, res: Response) => {
  try { await svc.actualizarAsamblea(id(req), req.body ?? {}); res.json({ success: true }) }
  catch (e) { responder(res, e, 'actualizar la asamblea') }
}
export const eliminar = async (req: Request, res: Response) => {
  try { await svc.eliminarAsamblea(id(req)); res.json({ success: true }) }
  catch (e) { responder(res, e, 'eliminar la asamblea') }
}
export const registrarAsistencia = async (req: Request, res: Response) => {
  try { await svc.registrarAsistencia(id(req), req.body ?? {}); res.json({ success: true }) }
  catch (e) { responder(res, e, 'registrar la asistencia') }
}
export const quitarAsistencia = async (req: Request, res: Response) => {
  try { await svc.quitarAsistencia(id(req), Number(req.params.idAfiliado)); res.json({ success: true }) }
  catch (e) { responder(res, e, 'quitar la asistencia') }
}
export const buscarAfiliados = async (req: Request, res: Response) => {
  try { res.json({ success: true, data: await svc.buscarAfiliados(String(req.query.q ?? '')) }) }
  catch (e) { responder(res, e, 'buscar afiliados') }
}
export const miembros = async (_req: Request, res: Response) => {
  try { res.json({ success: true, data: { total: await svc.miembrosConDerecho() } }) }
  catch (e) { responder(res, e, 'contar miembros') }
}
