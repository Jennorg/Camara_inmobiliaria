import { createClient, type Client } from '@libsql/client'
import { beforeEach, describe, expect, it } from 'vitest'
import { asegurarEsquemaCohortes, etapaDe, etapasPorCohorte } from './cohortes.js'

let db: Client

beforeEach(async () => {
  db = createClient({ url: ':memory:' })
  await db.batch([
    `CREATE TABLE estudiantes (id_estudiante INTEGER PRIMARY KEY, id_persona INTEGER, id_empresa INTEGER)`,
    `CREATE TABLE afiliados (id_afiliado INTEGER PRIMARY KEY, id_persona INTEGER, id_empresa INTEGER, estatus TEXT)`,
    `CREATE TABLE inscripciones_cursos (id_inscripcion INTEGER PRIMARY KEY, id_estudiante INTEGER, id_curso INTEGER, programa_codigo TEXT, estatus TEXT, completado INTEGER)`,
    `CREATE TABLE documentos (entidad_tipo TEXT, entidad_id INTEGER, eliminado_en TEXT)`,
    `INSERT INTO estudiantes VALUES (1, 10, NULL), (2, 20, NULL)`,
    `INSERT INTO afiliados VALUES (1, 10, NULL, '4_VERIFICACION'), (2, 20, NULL, '4_VERIFICACION')`,
  ])
  await asegurarEsquemaCohortes(db)
})

const cohorte = (programa: string, numero: number, estado: 'Abierta' | 'Cerrada') =>
  db.execute({ sql: `INSERT INTO cohortes (programa_codigo, numero, nombre, estado) VALUES (?, ?, ?, ?)`, args: [programa, numero, `Cohorte ${numero}`, estado] })
const insc = (idEstudiante: number, programa: string | null, idCurso: number | null = null) =>
  db.execute({ sql: `INSERT INTO inscripciones_cursos (id_estudiante, id_curso, programa_codigo) VALUES (?, ?, ?) RETURNING id_inscripcion`, args: [idEstudiante, idCurso, programa] })
    .then(r => Number(r.rows[0].id_inscripcion))
const cohorteDe = async (idInscripcion: number) =>
  (await db.execute({ sql: `SELECT c.numero FROM inscripciones_cursos i LEFT JOIN cohortes c ON c.id_cohorte = i.id_cohorte WHERE i.id_inscripcion = ?`, args: [idInscripcion] })).rows[0].numero

describe('cohortes: asignación automática', () => {
  it('una inscripción nueva de programa entra a la cohorte abierta de ese programa', async () => {
    await cohorte('CIBIR', 1, 'Cerrada'); await cohorte('CIBIR', 2, 'Abierta'); await cohorte('PEGI', 1, 'Abierta')
    expect(await cohorteDe(await insc(1, 'CIBIR'))).toBe(2)
    expect(await cohorteDe(await insc(2, 'PEGI'))).toBe(1)
  })

  it('no toca cursos, AFILIACION ni programas sin cohorte abierta', async () => {
    await cohorte('CIBIR', 1, 'Abierta')
    expect(await cohorteDe(await insc(1, null, 5))).toBeNull()
    expect(await cohorteDe(await insc(1, 'AFILIACION'))).toBeNull()
    expect(await cohorteDe(await insc(1, 'PADI'))).toBeNull()
  })

  it('la inscripción CIBIR hereda la cohorte de su AFILIACION aunque ya haya otra abierta', async () => {
    await cohorte('CIBIR', 1, 'Abierta')
    const afiliacion = await insc(1, 'AFILIACION')
    await db.execute(`UPDATE afiliados SET estatus = '5_CIBIR' WHERE id_afiliado = 1`) // entra a la cohorte 1
    expect(await cohorteDe(afiliacion)).toBe(1)

    await db.batch([`UPDATE cohortes SET estado = 'Cerrada' WHERE numero = 1`, `INSERT INTO cohortes (programa_codigo, numero, nombre) VALUES ('CIBIR', 2, 'Cohorte 2')`])
    expect(await cohorteDe(await insc(1, 'CIBIR'))).toBe(1) // la suya, no la 2
    expect(await cohorteDe(await insc(2, 'CIBIR'))).toBe(2) // sin AFILIACION: la abierta
  })

  it('pasar a 5_CIBIR asigna la cohorte abierta solo si aún no tenía, y no se repite', async () => {
    await cohorte('CIBIR', 1, 'Abierta')
    const a = await insc(1, 'AFILIACION'); const b = await insc(2, 'AFILIACION')
    await db.execute(`UPDATE afiliados SET estatus = '5_CIBIR' WHERE id_afiliado = 1`)
    expect(await cohorteDe(a)).toBe(1)
    expect(await cohorteDe(b)).toBeNull() // el otro afiliado sigue en su etapa

    await db.batch([`UPDATE cohortes SET estado = 'Cerrada' WHERE numero = 1`, `INSERT INTO cohortes (programa_codigo, numero, nombre) VALUES ('CIBIR', 2, 'Cohorte 2')`])
    await db.execute(`UPDATE afiliados SET estatus = '4_VERIFICACION' WHERE id_afiliado = 1`)
    await db.execute(`UPDATE afiliados SET estatus = '5_CIBIR' WHERE id_afiliado = 1`)
    expect(await cohorteDe(a)).toBe(1) // no se reasigna
  })

  it('solo puede haber una cohorte abierta por programa y el esquema se puede crear dos veces', async () => {
    await cohorte('CIBIR', 1, 'Abierta')
    await expect(cohorte('CIBIR', 2, 'Abierta')).rejects.toThrow()
    await asegurarEsquemaCohortes(db)
    await cohorte('PADI', 1, 'Abierta')
  })
})

describe('cohortes: etapas', () => {
  const base = { estatus: 'Inscrito', completado: 0, afiliado: null as string | null, documentos: 0 }
  it('clasifica cada inscripción en una sola etapa', () => {
    expect(etapaDe({ ...base, estatus: 'Rechazado' })).toBe('rechazado')
    expect(etapaDe({ ...base, estatus: 'Cancelado' })).toBe('rechazado')
    expect(etapaDe({ ...base, afiliado: '5_CIBIR' })).toBe('cursando')
    expect(etapaDe({ ...base, completado: 1, afiliado: 'Afiliado' })).toBe('completado')
    expect(etapaDe(base)).toBe('admitido')
    expect(etapaDe({ ...base, estatus: 'Entrevista' })).toBe('entrevista')
    expect(etapaDe({ ...base, estatus: 'Preinscrito', documentos: 2 })).toBe('pendiente')
    expect(etapaDe({ ...base, estatus: 'Preinscrito' })).toBe('sin_expediente')
  })

  it('cuenta por etapa dentro de cada cohorte, con documentos y etapa del afiliado', async () => {
    await cohorte('CIBIR', 1, 'Abierta'); await cohorte('PEGI', 1, 'Abierta')
    const nueva = async (idEstudiante: number, programa: string, estatus: string, completado: number) =>
      db.execute({ sql: `INSERT INTO inscripciones_cursos (id_estudiante, programa_codigo, estatus, completado) VALUES (?, ?, ?, ?)`, args: [idEstudiante, programa, estatus, completado] })
    await nueva(1, 'CIBIR', 'Inscrito', 1)               // completado (cohorte CIBIR 1, por trigger)
    await nueva(2, 'CIBIR', 'Inscrito', 1)               // completado
    await nueva(1, 'PEGI', 'Preinscrito', 0)             // sin expediente (cohorte PEGI 1)
    await db.execute(`INSERT INTO documentos VALUES ('estudiante', 2, NULL), ('estudiante', 2, '2026-01-01')`) // solo 1 vigente
    await nueva(2, 'PEGI', 'Preinscrito', 0)             // pendiente (tiene un documento vigente)
    await db.execute(`UPDATE afiliados SET estatus = '5_CIBIR' WHERE id_afiliado = 1`)
    await db.execute(`UPDATE inscripciones_cursos SET estatus = 'Inscrito' WHERE programa_codigo = 'PEGI' AND id_estudiante = 1`) // cursando: su afiliado está en 5_CIBIR

    const porCohorte = await etapasPorCohorte(db)
    const ids = Object.fromEntries((await db.execute(`SELECT id_cohorte, programa_codigo FROM cohortes`)).rows.map(r => [String(r.programa_codigo), Number(r.id_cohorte)]))
    expect(porCohorte.get(ids.CIBIR)).toMatchObject({ completado: 1, cursando: 1 }) // el estudiante 1 pasó a 5_CIBIR
    expect(porCohorte.get(ids.PEGI)).toMatchObject({ cursando: 1, pendiente: 1, sin_expediente: 0 })
  })
})
