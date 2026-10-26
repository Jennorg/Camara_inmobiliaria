import { randomUUID } from 'node:crypto'
import type { Intervalo } from '../lib/agenda.js'
import type { Google } from './agenda.service.js'

const API = 'https://www.googleapis.com/calendar/v3'
const falla503 = (message: string) => Object.assign(new Error(message), { status: 503 })

type Opciones = { fetch?: typeof fetch; env?: Partial<Record<string, string | undefined>> }

/** Cliente mínimo de Google Calendar (freeBusy, crear evento con Meet, borrar evento) sobre `fetch`, con el refresh token de la cuenta de la Cámara. */
export function crearGoogleCalendar({ fetch: http = fetch, env = process.env }: Opciones = {}): Google {
  let acceso: { token: string; vence: number } | null = null

  async function accessToken(): Promise<string> {
    if (acceso && acceso.vence > Date.now()) return acceso.token
    const { GOOGLE_CLIENT_ID: id, GOOGLE_CLIENT_SECRET: secreto, GOOGLE_REFRESH_TOKEN: refresh } = env
    if (!id || !secreto || !refresh) throw falla503('Google Calendar no está configurado.')
    const r = await http('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: id, client_secret: secreto, refresh_token: refresh, grant_type: 'refresh_token' }).toString(),
    })
    if (!r.ok) throw falla503('No se pudo autenticar con Google.')
    const j = await r.json() as { access_token: string; expires_in: number }
    acceso = { token: j.access_token, vence: Date.now() + (j.expires_in - 60) * 1000 }
    return acceso.token
  }

  async function llamar(url: string, init: { method?: string; body?: unknown } = {}): Promise<Response> {
    const r = await http(url, {
      method: init.method ?? 'POST',
      headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    })
    if (!r.ok) throw falla503('Google Calendar respondió con un error.')
    return r
  }

  return {
    async ocupados(desde, hasta): Promise<Intervalo[]> {
      const r = await llamar(`${API}/freeBusy`, { body: { timeMin: desde.toISOString(), timeMax: hasta.toISOString(), items: [{ id: 'primary' }] } })
      const j = await r.json() as { calendars?: { primary?: { busy?: { start: string; end: string }[] } } }
      return (j.calendars?.primary?.busy ?? []).map(b => ({ inicio: new Date(b.start).toISOString(), fin: new Date(b.end).toISOString() }))
    },

    async crearEvento({ inicio, fin, titulo, emailInvitado }) {
      const r = await llamar(`${API}/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all`, {
        body: {
          summary: titulo,
          start: { dateTime: inicio }, end: { dateTime: fin },
          ...(emailInvitado ? { attendees: [{ email: emailInvitado }] } : {}),
          conferenceData: { createRequest: { requestId: randomUUID(), conferenceSolutionKey: { type: 'hangoutsMeet' } } },
        },
      })
      const j = await r.json() as { id?: string; hangoutLink?: string }
      if (!j.id || !j.hangoutLink) throw falla503('Google no devolvió el enlace de Meet.')
      return { eventId: j.id, meetUrl: j.hangoutLink }
    },

    async borrarEvento(eventId) {
      await llamar(`${API}/calendars/primary/events/${encodeURIComponent(eventId)}?sendUpdates=all`, { method: 'DELETE' })
    },
  }
}
