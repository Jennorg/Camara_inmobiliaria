import { createHash, randomBytes } from 'node:crypto'
import type { Client } from '@libsql/client'
import { aCaracas, generarHorarios, HORIZONTE_DIAS, validarReglas, VALIDEZ_ENLACE_DIAS, type Intervalo, type Regla } from '../lib/agenda.js'
import { asegurarEsquemaAgenda } from '../lib/agenda-esquema.js'
import { agendarEntrevista } from './entrevistas.service.js'

/** Lo que la agenda necesita de Google Calendar (se inyecta para poder probarla sin red). */
export type Google = {
  ocupados(desde: Date, hasta: Date): Promise<Intervalo[]>
  crearEvento(p: { inicio: string; fin: string; titulo: string; emailInvitado: string | null }): Promise<{ eventId: string; meetUrl: string }>
  borrarEvento(eventId: string): Promise<void>
}

const DIA_MS = 86_400_000
const fallo = (status: number, message: string) => Object.assign(new Error(message), { status })
const hashDe = (token: string) => createHash('sha256').update(token).digest('hex')
const ENLACE_INVALIDO = 'Este enlace ya no es válido. Pide uno nuevo a la Cámara.'

let esquema: Promise<void> | null = null
/** Garantiza el esquema una vez por instancia; si falla se reintenta en la siguiente llamada. */
export const asegurarAgenda = (client: Client): Promise<void> =>
  (esquema ??= asegurarEsquemaAgenda(client).catch(e => { esquema = null; throw e }))

export async function leerDisponibilidad(client: Client): Promise<Regla[]> {
  const r = await client.execute(`SELECT dia_semana, hora_inicio, hora_fin FROM disponibilidad_entrevistas ORDER BY dia_semana, hora_inicio`)
  return r.rows.map(f => ({ dia_semana: Number(f.dia_semana), hora_inicio: String(f.hora_inicio), hora_fin: String(f.hora_fin) }))
}

/** Reemplaza toda la disponibilidad; si alguna regla es inválida no se toca lo guardado. */
export async function guardarDisponibilidad(client: Client, reglas: unknown): Promise<Regla[]> {
  let validas: Regla[]
  try { validas = validarReglas(reglas) } catch (e) { throw fallo(400, (e as Error).message) }
  await client.batch([
    `DELETE FROM disponibilidad_entrevistas`,
    ...validas.map(r => ({ sql: `INSERT INTO disponibilidad_entrevistas (dia_semana, hora_inicio, hora_fin) VALUES (?, ?, ?)`, args: [r.dia_semana, r.hora_inicio, r.hora_fin] })),
  ], 'write')
  return validas
}

/** Crea el enlace de reserva de una inscripción e invalida los anteriores. El token solo se devuelve aquí; en BD queda su hash. */
export async function crearEnlace(client: Client, idInscripcion: number, ahora: Date): Promise<{ token: string; venceEn: string }> {
  const token = randomBytes(32).toString('base64url')
  const venceEn = new Date(ahora.getTime() + VALIDEZ_ENLACE_DIAS * DIA_MS).toISOString()
  await client.batch([
    { sql: `UPDATE enlaces_agenda SET usado_en = ? WHERE id_inscripcion = ? AND usado_en IS NULL`, args: [ahora.toISOString(), idInscripcion] },
    { sql: `INSERT INTO enlaces_agenda (id_inscripcion, token_hash, vence_en) VALUES (?, ?, ?)`, args: [idInscripcion, hashDe(token), venceEn] },
  ], 'write')
  return { token, venceEn }
}

async function cargarEnlace(client: Client, token: string, ahora: Date) {
  const r = await client.execute({ sql: `SELECT id, id_inscripcion, vence_en, usado_en FROM enlaces_agenda WHERE token_hash = ?`, args: [hashDe(token)] })
  const e = r.rows[0] as any
  if (!e || e.usado_en || new Date(e.vence_en).getTime() < ahora.getTime()) throw fallo(410, ENLACE_INVALIDO)
  return { id: Number(e.id), idInscripcion: Number(e.id_inscripcion) }
}

/** Horarios libres: las reglas semanales menos lo ocupado en Google y las entrevistas pendientes ya agendadas. */
async function libres(client: Client, google: Google, ahora: Date): Promise<Intervalo[]> {
  const hasta = new Date(ahora.getTime() + (HORIZONTE_DIAS + 1) * DIA_MS)
  let deGoogle: Intervalo[]
  try { deGoogle = await google.ocupados(ahora, hasta) } catch { throw fallo(503, 'No se pudo consultar el calendario. Intenta de nuevo en unos minutos.') }
  const pendientes = await client.execute(`SELECT fecha, hora FROM entrevistas WHERE estatus = 'Pendiente' AND eliminado_en IS NULL AND hora IS NOT NULL`)
  const deEntrevistas: Intervalo[] = []
  for (const f of pendientes.rows) {
    const ini = new Date(`${f.fecha}T${f.hora}:00-04:00`).getTime() // la hora se guarda en Caracas (UTC-4)
    if (Number.isNaN(ini)) continue // entrevistas fijadas a mano con otro formato de hora
    deEntrevistas.push({ inicio: new Date(ini).toISOString(), fin: new Date(ini + 30 * 60_000).toISOString() })
  }
  return generarHorarios(await leerDisponibilidad(client), ahora, [...deGoogle, ...deEntrevistas])
}

/** Antes de enviar un enlace: Google debe estar configurado y haber disponibilidad guardada; si no, el aspirante recibiría un enlace inservible. */
export async function verificarAgendaLista(client: Client, env: Partial<Record<string, string | undefined>> = process.env): Promise<void> {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REFRESH_TOKEN) {
    throw fallo(503, 'Google Calendar no está configurado todavía. Fija la cita a mano por ahora.')
  }
  if ((await leerDisponibilidad(client)).length === 0) throw fallo(409, 'Primero guarda tu disponibilidad con el botón "Mi disponibilidad".')
}

export async function horariosLibres(client: Client, google: Google, token: string, ahora: Date): Promise<Intervalo[]> {
  await cargarEnlace(client, token, ahora)
  return libres(client, google, ahora)
}

export async function reservar(client: Client, google: Google, token: string, inicio: string, ahora: Date): Promise<{ meetUrl: string; fecha: string; hora: string }> {
  const enlace = await cargarEnlace(client, token, ahora)
  const slot = (await libres(client, google, ahora)).find(h => h.inicio === inicio)
  if (!slot) throw fallo(409, 'Ese horario ya no está disponible. Elige otro.')

  const insc = await client.execute({
    sql: `SELECT ic.estatus,
                 COALESCE(NULLIF(TRIM(COALESCE(p.nombres, '') || ' ' || COALESCE(p.apellidos, '')), ''), emp.razon_social) AS nombre,
                 COALESCE(p.email, emp.email) AS email
          FROM inscripciones_cursos ic
          JOIN estudiantes e ON e.id_estudiante = ic.id_estudiante
          LEFT JOIN personas p ON e.id_persona = p.id
          LEFT JOIN empresas emp ON e.id_empresa = emp.id_empresa
          WHERE ic.id_inscripcion = ?`,
    args: [enlace.idInscripcion],
  })
  const f = insc.rows[0] as any
  if (!f || !['Preinscrito', 'Entrevista'].includes(String(f.estatus))) throw fallo(409, 'Esta solicitud ya no admite agendar una entrevista.')

  // El enlace se reclama ANTES de llamar a Google: así dos envíos simultáneos con el mismo enlace nunca crean dos eventos.
  const reclamo = await client.execute({ sql: `UPDATE enlaces_agenda SET usado_en = ? WHERE id = ? AND usado_en IS NULL`, args: [ahora.toISOString(), enlace.id] })
  if (reclamo.rowsAffected === 0) throw fallo(410, ENLACE_INVALIDO)
  const liberarEnlace = () => client.execute({ sql: `UPDATE enlaces_agenda SET usado_en = NULL WHERE id = ?`, args: [enlace.id] }).catch(err => console.error('No se pudo liberar el enlace de agenda:', err))
  const borrarEnGoogle = (eventId: string) => google.borrarEvento(eventId).catch(err => console.error('No se pudo borrar el evento de Google:', err))

  let evento: { eventId: string; meetUrl: string }
  try {
    evento = await google.crearEvento({ inicio: slot.inicio, fin: slot.fin, titulo: `Entrevista de afiliación — ${f.nombre ?? ''}`.trim(), emailInvitado: f.email ?? null })
  } catch {
    await liberarEnlace()
    throw fallo(503, 'No se pudo crear la reunión de Google Meet. Intenta de nuevo en unos minutos.')
  }

  const { fecha, hora } = aCaracas(slot.inicio)
  // Sin transacción interactiva: el índice único `uq_entrevista_reservada` rechaza el horario repetido y, si algo falla,
  // se deshace lo hecho (sin pisar cambios que el admin haya hecho mientras tanto) y se borra el evento.
  let eventoPrevio: string | null
  try {
    ;({ eventoPrevio } = await agendarEntrevista(client, enlace.idInscripcion, { fecha, hora, lugar: evento.meetUrl, meetUrl: evento.meetUrl, googleEventId: evento.eventId }))
  } catch (e) {
    await client.execute({ sql: `UPDATE inscripciones_cursos SET estatus = ? WHERE id_inscripcion = ? AND estatus = 'Entrevista'`, args: [String(f.estatus), enlace.idInscripcion] })
      .catch(err => console.error('No se pudo deshacer la reserva fallida:', err))
    await liberarEnlace()
    await borrarEnGoogle(evento.eventId)
    if ((e as { status?: number }).status === 404) throw fallo(409, 'Esta solicitud ya no admite agendar una entrevista.')
    if ((e as { status?: number }).status) throw e
    if (/UNIQUE/i.test((e as Error).message)) throw fallo(409, 'Ese horario acaba de ser tomado. Elige otro.')
    throw e
  }
  if (eventoPrevio) await borrarEnGoogle(eventoPrevio)
  return { meetUrl: evento.meetUrl, fecha, hora }
}
