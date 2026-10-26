import { createClient, type Client } from '@libsql/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { asegurarEsquemaAgenda } from '../lib/agenda-esquema.js'
import { crearEnlace, guardarDisponibilidad, horariosLibres, leerDisponibilidad, reservar, verificarAgendaLista, type Google } from './agenda.service.js'

// Lunes 26-oct-2026, 10:00 en Caracas. El primer horario libre es el lunes 2-nov 09:00 (13:00 UTC).
const AHORA = new Date('2026-10-26T14:00:00.000Z')
const PRIMERO = '2026-11-02T13:00:00.000Z'
const SEGUNDO = '2026-11-02T13:30:00.000Z'

let db: Client
let n = 0
const googleFalso = (over: Partial<Google> = {}): Google => ({
  ocupados: vi.fn(async () => []),
  crearEvento: vi.fn(async () => ({ eventId: `ev${++n}`, meetUrl: `https://meet.google.com/m-${n}` })),
  borrarEvento: vi.fn(async () => {}),
  ...over,
})
const codigo = async (p: Promise<unknown>) => p.then(() => 0, (e: { status?: number }) => e.status ?? -1)
const entrevistasReservadas = async () => (await db.execute(`SELECT * FROM entrevistas WHERE google_event_id IS NOT NULL`)).rows as any[]

beforeEach(async () => {
  n = 0
  db = createClient({ url: ':memory:' })
  await db.batch([
    `CREATE TABLE personas (id INTEGER PRIMARY KEY, nombres TEXT, apellidos TEXT, email TEXT)`,
    `CREATE TABLE empresas (id_empresa INTEGER PRIMARY KEY, razon_social TEXT, email TEXT)`,
    `CREATE TABLE estudiantes (id_estudiante INTEGER PRIMARY KEY, id_persona INTEGER, id_empresa INTEGER)`,
    `CREATE TABLE afiliados (id_afiliado INTEGER PRIMARY KEY, id_persona INTEGER, id_empresa INTEGER, estatus TEXT, fecha_ultimo_cambio_estatus TEXT, actualizado_en TEXT)`,
    `CREATE TABLE inscripciones_cursos (id_inscripcion INTEGER PRIMARY KEY, id_estudiante INTEGER, id_curso INTEGER, programa_codigo TEXT, estatus TEXT, actualizado_en TEXT)`,
    `CREATE TABLE entrevistas (
       id_entrevista INTEGER PRIMARY KEY, id_afiliado INTEGER, id_inscripcion INTEGER, fecha TEXT NOT NULL, hora TEXT, lugar TEXT,
       estatus TEXT NOT NULL DEFAULT 'Pendiente', notas TEXT, creado_en TEXT, actualizado_en TEXT, eliminado_en TEXT)`,
    `INSERT INTO personas VALUES (10, 'Ana', 'Pérez', 'ana@example.com'), (20, 'Luis', 'Gil', 'luis@example.com'), (30, 'Eva', 'Ruiz', 'eva@example.com')`,
    `INSERT INTO estudiantes VALUES (1, 10, NULL), (2, 20, NULL), (3, 30, NULL)`,
    `INSERT INTO afiliados VALUES (1, 10, NULL, '2_EXPEDIENTE', NULL, NULL), (2, 20, NULL, '2_EXPEDIENTE', NULL, NULL), (3, 30, NULL, '2_EXPEDIENTE', NULL, NULL)`,
    `INSERT INTO inscripciones_cursos VALUES (1, 1, NULL, 'AFILIACION', 'Preinscrito', NULL), (2, 2, NULL, 'AFILIACION', 'Preinscrito', NULL), (3, 3, NULL, 'AFILIACION', 'Inscrito', NULL)`,
  ])
  await asegurarEsquemaAgenda(db)
  await guardarDisponibilidad(db, [{ dia_semana: 1, hora_inicio: '09:00', hora_fin: '10:00' }])
})

describe('disponibilidad', () => {
  it('guarda y lee las reglas; rechaza una regla inválida sin tocar las guardadas', async () => {
    expect(await leerDisponibilidad(db)).toEqual([{ dia_semana: 1, hora_inicio: '09:00', hora_fin: '10:00' }])
    await expect(guardarDisponibilidad(db, [{ dia_semana: 1, hora_inicio: '10:00', hora_fin: '09:00' }])).rejects.toThrow()
    expect(await leerDisponibilidad(db)).toHaveLength(1)
  })
})

describe('enlaces', () => {
  it('un enlace nuevo invalida el anterior de la misma inscripción', async () => {
    const g = googleFalso()
    const a = await crearEnlace(db, 1, AHORA)
    const b = await crearEnlace(db, 1, AHORA)
    expect(await codigo(horariosLibres(db, g, a.token, AHORA))).toBe(410)
    expect((await horariosLibres(db, g, b.token, AHORA)).length).toBeGreaterThan(0)
  })

  it('un enlace vencido o desconocido da 410', async () => {
    const g = googleFalso()
    const { token } = await crearEnlace(db, 1, AHORA)
    const despues = new Date(AHORA.getTime() + 15 * 86_400_000)
    expect(await codigo(horariosLibres(db, g, token, despues))).toBe(410)
    expect(await codigo(horariosLibres(db, g, 'no-existe', AHORA))).toBe(410)
  })
})

describe('horariosLibres', () => {
  it('descarta lo que Google reporta ocupado y las entrevistas ya agendadas', async () => {
    const g = googleFalso({ ocupados: vi.fn(async () => [{ inicio: PRIMERO, fin: SEGUNDO }]) })
    const { token } = await crearEnlace(db, 1, AHORA)
    expect((await horariosLibres(db, g, token, AHORA)).map(h => h.inicio)).not.toContain(PRIMERO)
    await db.execute(`INSERT INTO entrevistas (id_inscripcion, fecha, hora, estatus) VALUES (2, '2026-11-02', '09:30', 'Pendiente')`)
    expect((await horariosLibres(db, googleFalso(), token, AHORA)).map(h => h.inicio)).not.toContain(SEGUNDO)
  })
})

describe('reservar', () => {
  it('crea el evento una vez, deja la entrevista con el Meet y marca el enlace usado', async () => {
    const g = googleFalso()
    const { token } = await crearEnlace(db, 1, AHORA)
    const r = await reservar(db, g, token, PRIMERO, AHORA)
    expect(r).toEqual({ meetUrl: 'https://meet.google.com/m-1', fecha: '2026-11-02', hora: '09:00' })
    expect(g.crearEvento).toHaveBeenCalledTimes(1)
    expect(g.crearEvento).toHaveBeenCalledWith(expect.objectContaining({ inicio: PRIMERO, emailInvitado: 'ana@example.com' }))
    const e = await entrevistasReservadas()
    expect(e).toHaveLength(1)
    expect(e[0]).toMatchObject({ id_inscripcion: 1, fecha: '2026-11-02', hora: '09:00', meet_url: 'https://meet.google.com/m-1', google_event_id: 'ev1' })
    const insc = await db.execute(`SELECT estatus FROM inscripciones_cursos WHERE id_inscripcion = 1`)
    expect(insc.rows[0].estatus).toBe('Entrevista')
  })

  it('la segunda reserva con el mismo enlace da 410 y no crea otro evento', async () => {
    const g = googleFalso()
    const { token } = await crearEnlace(db, 1, AHORA)
    await reservar(db, g, token, PRIMERO, AHORA)
    expect(await codigo(reservar(db, g, token, SEGUNDO, AHORA))).toBe(410)
    expect(g.crearEvento).toHaveBeenCalledTimes(1)
  })

  it('dos aspirantes al mismo horario a la vez: uno gana, el otro recibe 409 y se borra su evento', async () => {
    const g = googleFalso()
    const a = await crearEnlace(db, 1, AHORA)
    const b = await crearEnlace(db, 2, AHORA)
    const res = await Promise.allSettled([reservar(db, g, a.token, PRIMERO, AHORA), reservar(db, g, b.token, PRIMERO, AHORA)])
    expect(res.filter(r => r.status === 'fulfilled')).toHaveLength(1)
    const perdedor = res.find(r => r.status === 'rejected') as PromiseRejectedResult
    expect(perdedor.reason.status).toBe(409)
    expect(await entrevistasReservadas()).toHaveLength(1)
    expect(g.borrarEvento).toHaveBeenCalledTimes(1)
  })

  it('si la inscripción ya no está en Preinscrito ni Entrevista, da 409 sin crear evento', async () => {
    const g = googleFalso()
    const { token } = await crearEnlace(db, 3, AHORA)
    expect(await codigo(reservar(db, g, token, PRIMERO, AHORA))).toBe(409)
    expect(g.crearEvento).not.toHaveBeenCalled()
  })

  it('un horario ocupado en Google o fuera de los horarios libres da 409', async () => {
    const { token } = await crearEnlace(db, 1, AHORA)
    const ocupado = googleFalso({ ocupados: vi.fn(async () => [{ inicio: PRIMERO, fin: SEGUNDO }]) })
    expect(await codigo(reservar(db, ocupado, token, PRIMERO, AHORA))).toBe(409)
    expect(await codigo(reservar(db, googleFalso(), token, '2026-11-02T15:00:00.000Z', AHORA))).toBe(409)
    expect(ocupado.crearEvento).not.toHaveBeenCalled()
  })

  it('si Google falla al crear el evento da 503 y no deja nada a medias', async () => {
    const g = googleFalso({ crearEvento: vi.fn(async () => { throw new Error('boom') }) })
    const { token } = await crearEnlace(db, 1, AHORA)
    expect(await codigo(reservar(db, g, token, PRIMERO, AHORA))).toBe(503)
    expect(await entrevistasReservadas()).toHaveLength(0)
    expect((await db.execute(`SELECT estatus FROM inscripciones_cursos WHERE id_inscripcion = 1`)).rows[0].estatus).toBe('Preinscrito')
    expect((await horariosLibres(db, googleFalso(), token, AHORA)).length).toBeGreaterThan(0) // el enlace sigue vigente
  })

  it('dos envíos simultáneos con el mismo enlace crean un solo evento', async () => {
    const g = googleFalso({ crearEvento: vi.fn(async () => { await new Promise(r => setTimeout(r, 5)); return { eventId: `ev${++n}`, meetUrl: `https://meet.google.com/m-${n}` } }) })
    const { token } = await crearEnlace(db, 1, AHORA)
    const res = await Promise.allSettled([reservar(db, g, token, PRIMERO, AHORA), reservar(db, g, token, SEGUNDO, AHORA)])
    expect(res.filter(r => r.status === 'fulfilled')).toHaveLength(1)
    expect(((res.find(r => r.status === 'rejected') as PromiseRejectedResult).reason as { status: number }).status).toBe(410)
    expect(g.crearEvento).toHaveBeenCalledTimes(1)
  })

  it('si la inscripción es rechazada mientras Google crea el evento: 409, no se revive la inscripción y el enlace se libera', async () => {
    const g = googleFalso({ crearEvento: vi.fn(async () => {
      await db.execute(`UPDATE inscripciones_cursos SET estatus = 'Rechazado' WHERE id_inscripcion = 1`)
      return { eventId: 'evX', meetUrl: 'https://meet.google.com/x' }
    }) })
    const { token } = await crearEnlace(db, 1, AHORA)
    expect(await codigo(reservar(db, g, token, PRIMERO, AHORA))).toBe(409)
    expect((await db.execute(`SELECT estatus FROM inscripciones_cursos WHERE id_inscripcion = 1`)).rows[0].estatus).toBe('Rechazado')
    expect(g.borrarEvento).toHaveBeenCalledWith('evX')
  })

  it('al reprogramar con un enlace nuevo se borra el evento de Google anterior', async () => {
    const g = googleFalso()
    await reservar(db, g, (await crearEnlace(db, 1, AHORA)).token, PRIMERO, AHORA)
    await reservar(db, g, (await crearEnlace(db, 1, AHORA)).token, SEGUNDO, AHORA)
    expect(g.borrarEvento).toHaveBeenCalledTimes(1)
    expect(g.borrarEvento).toHaveBeenCalledWith('ev1')
    const e = await entrevistasReservadas()
    expect(e).toHaveLength(1)
    expect(e[0]).toMatchObject({ hora: '09:30', google_event_id: 'ev2' })
  })
})

describe('verificarAgendaLista', () => {
  const ENV = { GOOGLE_CLIENT_ID: 'a', GOOGLE_CLIENT_SECRET: 'b', GOOGLE_REFRESH_TOKEN: 'c' }
  it('503 si falta configurar Google, 409 si no hay disponibilidad, y pasa si hay ambas', async () => {
    expect(await codigo(verificarAgendaLista(db, {}))).toBe(503)
    expect(await codigo(verificarAgendaLista(db, { ...ENV, GOOGLE_REFRESH_TOKEN: '' }))).toBe(503)
    await guardarDisponibilidad(db, [])
    expect(await codigo(verificarAgendaLista(db, ENV))).toBe(409)
    await guardarDisponibilidad(db, [{ dia_semana: 1, hora_inicio: '09:00', hora_fin: '10:00' }])
    expect(await codigo(verificarAgendaLista(db, ENV))).toBe(0)
  })
})
