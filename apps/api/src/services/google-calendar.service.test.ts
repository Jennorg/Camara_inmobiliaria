import { describe, expect, it, vi } from 'vitest'
import { crearGoogleCalendar } from './google-calendar.service.js'

const ENV = { GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 'secreto', GOOGLE_REFRESH_TOKEN: 'refresh' }
const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status })

/** fetch simulado: responde el token de OAuth y delega el resto en `api`. */
const fetchFalso = (api: (url: string, init: RequestInit) => Response) =>
  vi.fn(async (url: string | URL | Request, init: RequestInit = {}) => {
    const u = String(url)
    return u.startsWith('https://oauth2.googleapis.com/token') ? json({ access_token: 'tok', expires_in: 3600 }) : api(u, init)
  })
const llamadas = (f: ReturnType<typeof fetchFalso>, prefijo: string) => f.mock.calls.filter(([u]) => String(u).startsWith(prefijo))

describe('crearGoogleCalendar', () => {
  it('sin credenciales falla con 503 al usarse', async () => {
    const g = crearGoogleCalendar({ fetch: fetchFalso(() => json({})), env: {} })
    await expect(g.ocupados(new Date(), new Date())).rejects.toMatchObject({ status: 503 })
  })

  it('pide el access token una sola vez y lo reutiliza', async () => {
    const f = fetchFalso(() => json({ calendars: { primary: { busy: [] } } }))
    const g = crearGoogleCalendar({ fetch: f, env: ENV })
    await g.ocupados(new Date(), new Date())
    await g.ocupados(new Date(), new Date())
    const [, init] = llamadas(f, 'https://oauth2.googleapis.com/token')[0]
    expect(llamadas(f, 'https://oauth2.googleapis.com/token')).toHaveLength(1)
    expect(String(init?.body)).toContain('grant_type=refresh_token')
    expect(String(init?.body)).toContain('refresh_token=refresh')
  })

  it('ocupados consulta freeBusy del calendario primary y devuelve los intervalos', async () => {
    const f = fetchFalso(() => json({ calendars: { primary: { busy: [{ start: '2026-11-02T13:00:00Z', end: '2026-11-02T13:30:00Z' }] } } }))
    const g = crearGoogleCalendar({ fetch: f, env: ENV })
    const desde = new Date('2026-11-01T00:00:00Z'); const hasta = new Date('2026-11-15T00:00:00Z')
    expect(await g.ocupados(desde, hasta)).toEqual([{ inicio: '2026-11-02T13:00:00.000Z', fin: '2026-11-02T13:30:00.000Z' }])
    const [url, init] = llamadas(f, 'https://www.googleapis.com/calendar/v3/freeBusy')[0]
    expect(url).toBe('https://www.googleapis.com/calendar/v3/freeBusy')
    expect(JSON.parse(String(init?.body))).toEqual({ timeMin: desde.toISOString(), timeMax: hasta.toISOString(), items: [{ id: 'primary' }] })
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer tok')
  })

  it('crearEvento pide Meet, invita al aspirante y usa un requestId distinto cada vez', async () => {
    const f = fetchFalso(() => json({ id: 'ev9', hangoutLink: 'https://meet.google.com/abc-defg-hij' }))
    const g = crearGoogleCalendar({ fetch: f, env: ENV })
    const p = { inicio: '2026-11-02T13:00:00.000Z', fin: '2026-11-02T13:30:00.000Z', titulo: 'Entrevista', emailInvitado: 'ana@example.com' }
    expect(await g.crearEvento(p)).toEqual({ eventId: 'ev9', meetUrl: 'https://meet.google.com/abc-defg-hij' })
    await g.crearEvento(p)
    const eventos = llamadas(f, 'https://www.googleapis.com/calendar/v3/calendars/primary/events')
    expect(String(eventos[0][0])).toContain('conferenceDataVersion=1')
    expect(String(eventos[0][0])).toContain('sendUpdates=all')
    const cuerpos = eventos.map(([, init]) => JSON.parse(String(init?.body)))
    expect(cuerpos[0]).toMatchObject({
      summary: 'Entrevista',
      start: { dateTime: p.inicio }, end: { dateTime: p.fin },
      attendees: [{ email: 'ana@example.com' }],
      conferenceData: { createRequest: { conferenceSolutionKey: { type: 'hangoutsMeet' } } },
    })
    expect(cuerpos[0].conferenceData.createRequest.requestId).not.toBe(cuerpos[1].conferenceData.createRequest.requestId)
  })

  it('crearEvento sin correo del aspirante no manda invitados', async () => {
    const f = fetchFalso(() => json({ id: 'ev1', hangoutLink: 'https://meet.google.com/x' }))
    await crearGoogleCalendar({ fetch: f, env: ENV }).crearEvento({ inicio: 'a', fin: 'b', titulo: 't', emailInvitado: null })
    expect(JSON.parse(String(llamadas(f, 'https://www.googleapis.com/calendar/v3/calendars')[0][1]?.body)).attendees).toBeUndefined()
  })

  it('una respuesta de error o sin enlace de Meet da 503', async () => {
    const error = crearGoogleCalendar({ fetch: fetchFalso(() => json({ error: 'x' }, 500)), env: ENV })
    await expect(error.ocupados(new Date(), new Date())).rejects.toMatchObject({ status: 503 })
    const sinMeet = crearGoogleCalendar({ fetch: fetchFalso(() => json({ id: 'ev1' })), env: ENV })
    await expect(sinMeet.crearEvento({ inicio: 'a', fin: 'b', titulo: 't', emailInvitado: null })).rejects.toMatchObject({ status: 503 })
  })

  it('borrarEvento hace DELETE del evento avisando a los invitados', async () => {
    const f = fetchFalso(() => new Response(null, { status: 204 }))
    await crearGoogleCalendar({ fetch: f, env: ENV }).borrarEvento('ev9')
    const [url, init] = llamadas(f, 'https://www.googleapis.com/calendar/v3/calendars')[0]
    expect(String(url)).toContain('/events/ev9')
    expect(String(url)).toContain('sendUpdates=all')
    expect(init?.method).toBe('DELETE')
  })
})
