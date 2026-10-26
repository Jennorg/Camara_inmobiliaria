import { createClient, type Client } from '@libsql/client'
import { beforeEach, describe, expect, it } from 'vitest'
import { asegurarEsquemaAgenda } from '../lib/agenda-esquema.js'
import { agendarEntrevista } from './entrevistas.service.js'

let db: Client

beforeEach(async () => {
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
    `INSERT INTO personas VALUES (10, 'Ana', 'Pérez', 'ana@example.com')`,
    `INSERT INTO estudiantes VALUES (1, 10, NULL)`,
    `INSERT INTO afiliados VALUES (1, 10, NULL, '2_EXPEDIENTE', NULL, NULL)`,
    `INSERT INTO inscripciones_cursos VALUES (1, 1, NULL, 'AFILIACION', 'Preinscrito', NULL)`,
    `INSERT INTO inscripciones_cursos VALUES (2, 1, NULL, 'AFILIACION', 'Inscrito', NULL)`,
  ])
  await asegurarEsquemaAgenda(db)
})

const datos = { fecha: '2026-11-02', hora: '09:00', lugar: 'Sede' }
const entrevistas = async () => (await db.execute(`SELECT * FROM entrevistas WHERE id_inscripcion = 1`)).rows as any[]

describe('agendarEntrevista', () => {
  it('pasa la inscripción a Entrevista, crea la fila y mueve al afiliado a 3_ENTREVISTA', async () => {
    const { row, estudiante } = await agendarEntrevista(db, 1, { ...datos, meetUrl: 'https://meet.google.com/abc', googleEventId: 'ev1' })
    expect(row.estatus).toBe('Entrevista')
    expect(estudiante).toEqual({ nombre_completo: 'Ana Pérez', email: 'ana@example.com' })
    const e = await entrevistas()
    expect(e).toHaveLength(1)
    expect(e[0]).toMatchObject({ fecha: '2026-11-02', hora: '09:00', lugar: 'Sede', estatus: 'Pendiente', meet_url: 'https://meet.google.com/abc', google_event_id: 'ev1' })
    const af = await db.execute(`SELECT estatus FROM afiliados WHERE id_afiliado = 1`)
    expect(af.rows[0].estatus).toBe('3_ENTREVISTA')
  })

  it('agendar de nuevo actualiza la misma fila en vez de duplicarla', async () => {
    await agendarEntrevista(db, 1, datos)
    await agendarEntrevista(db, 1, { ...datos, fecha: '2026-11-03', hora: '10:30' })
    const e = await entrevistas()
    expect(e).toHaveLength(1)
    expect(e[0]).toMatchObject({ fecha: '2026-11-03', hora: '10:30' })
  })

  it('devuelve el evento de Google anterior al reprogramar, y null si no lo había o es el mismo', async () => {
    expect((await agendarEntrevista(db, 1, { ...datos, googleEventId: 'a' })).eventoPrevio).toBeNull()
    expect((await agendarEntrevista(db, 1, { ...datos, hora: '10:00', googleEventId: 'b' })).eventoPrevio).toBe('a')
    expect((await agendarEntrevista(db, 1, { ...datos, hora: '11:00', googleEventId: 'b' })).eventoPrevio).toBeNull()
    expect((await agendarEntrevista(db, 1, { ...datos, hora: '12:00' })).eventoPrevio).toBe('b') // a mano: el evento viejo queda huérfano
  })

  it('una inscripción que no está en Preinscrito ni Entrevista lanza el error 404', async () => {
    await expect(agendarEntrevista(db, 2, datos)).rejects.toMatchObject({ status: 404 })
  })
})

describe('asegurarEsquemaAgenda', () => {
  it('es idempotente', async () => {
    await asegurarEsquemaAgenda(db)
    await asegurarEsquemaAgenda(db)
    const t = await db.execute(`SELECT name FROM sqlite_master WHERE name IN ('disponibilidad_entrevistas', 'enlaces_agenda', 'uq_entrevista_reservada')`)
    expect(t.rows).toHaveLength(3)
  })

  it('el índice único solo impide dos reservas por enlace al mismo horario, no las manuales', async () => {
    const ins = (ev: string | null, hora = '09:00') => db.execute({
      sql: `INSERT INTO entrevistas (id_inscripcion, fecha, hora, google_event_id) VALUES (1, '2026-11-02', ?, ?)`, args: [hora, ev] })
    await ins(null); await ins(null) // manuales: se permiten
    await ins('a', '10:00')
    await expect(ins('b', '10:00')).rejects.toThrow()
  })
})
