import type { Request, Response } from 'express'
import { env } from '../config/env.js'
import { enviarCorreoEnlaceAgenda } from '../lib/email.js'
import { db } from '../lib/db.js'
import { asegurarAgenda, crearEnlace, guardarDisponibilidad, horariosLibres, leerDisponibilidad, reservar, verificarAgendaLista } from '../services/agenda.service.js'
import { crearGoogleCalendar } from '../services/google-calendar.service.js'

const google = crearGoogleCalendar()

/** Borra (sin fallar) el evento de Google de una cita que se reprogramó a mano. */
export const borrarEventoPrevio = (eventId: string) => google.borrarEvento(eventId).catch(err => console.error('No se pudo borrar el evento de Google:', err))

/** Responde con el status de los errores de negocio (`status`) o 500. */
function responderError(res: Response, error: unknown, contexto: string) {
  const status = (error as { status?: number }).status
  if (status) return res.status(status).json({ success: false, message: (error as Error).message })
  console.error(`${contexto}:`, error)
  return res.status(500).json({ success: false, message: `Error en ${contexto}` })
}

/** GET /api/academia/agenda/disponibilidad */
export const adminLeerDisponibilidad = async (_req: Request, res: Response) => {
  try {
    await asegurarAgenda(db)
    res.json({ success: true, data: await leerDisponibilidad(db) })
  } catch (e) { responderError(res, e, 'lectura de disponibilidad') }
}

/** PUT /api/academia/agenda/disponibilidad — { reglas: [{ dia_semana, hora_inicio, hora_fin }] } */
export const adminGuardarDisponibilidad = async (req: Request, res: Response) => {
  try {
    await asegurarAgenda(db)
    res.json({ success: true, data: await guardarDisponibilidad(db, req.body?.reglas) })
  } catch (e) { responderError(res, e, 'guardado de disponibilidad') }
}

/** POST /api/academia/inscripciones/:id/enlace-agenda — crea el enlace de reserva y se lo envía al aspirante por correo */
export const adminEnviarEnlaceAgenda = async (req: Request, res: Response) => {
  const id = /^\d+$/.test(String(req.params.id)) ? Number(req.params.id) : null
  if (id === null) { res.status(400).json({ success: false, message: 'id inválido' }); return }
  try {
    await asegurarAgenda(db)
    const r = await db.execute({
      sql: `SELECT ic.estatus,
                   COALESCE(NULLIF(TRIM(COALESCE(p.nombres, '') || ' ' || COALESCE(p.apellidos, '')), ''), emp.razon_social) AS nombre,
                   COALESCE(p.email, emp.email) AS email
            FROM inscripciones_cursos ic
            JOIN estudiantes e ON e.id_estudiante = ic.id_estudiante
            LEFT JOIN personas p ON e.id_persona = p.id
            LEFT JOIN empresas emp ON e.id_empresa = emp.id_empresa
            WHERE ic.id_inscripcion = ?`,
      args: [id],
    })
    const f = r.rows[0] as any
    if (!f) { res.status(404).json({ success: false, message: 'Inscripción no encontrada' }); return }
    if (!['Preinscrito', 'Entrevista'].includes(String(f.estatus))) {
      res.status(409).json({ success: false, message: 'Esta solicitud ya no admite agendar una entrevista.' })
      return
    }
    await verificarAgendaLista(db)
    const { token } = await crearEnlace(db, id, new Date())
    const url = `${env.APP_URL.replace(/\/+$/, '')}/agendar/${token}`
    let emailEnviado = false
    if (f.email) {
      try { await enviarCorreoEnlaceAgenda({ nombre: f.nombre ?? '', email: f.email, url }); emailEnviado = true }
      catch (err) { console.error('Error enviando el enlace de agenda:', err) }
    }
    res.json({ success: true, data: { url, emailEnviado } })
  } catch (e) { responderError(res, e, 'envío del enlace de agenda') }
}

/** GET /api/public/agenda/:token — horarios libres */
export const publicHorarios = async (req: Request, res: Response) => {
  try {
    await asegurarAgenda(db)
    res.json({ success: true, data: { horarios: await horariosLibres(db, google, String(req.params.token), new Date()) } })
  } catch (e) { responderError(res, e, 'consulta de horarios') }
}

/** POST /api/public/agenda/:token — { inicio } reserva un horario */
export const publicReservar = async (req: Request, res: Response) => {
  const inicio = typeof req.body?.inicio === 'string' ? req.body.inicio : ''
  if (Number.isNaN(new Date(inicio).getTime())) { res.status(400).json({ success: false, message: 'Horario inválido' }); return }
  try {
    await asegurarAgenda(db)
    res.json({ success: true, data: await reservar(db, google, String(req.params.token), new Date(inicio).toISOString(), new Date()) })
  } catch (e) { responderError(res, e, 'reserva de entrevista') }
}
