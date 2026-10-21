import { createClient, type Client } from '@libsql/client'
import { beforeEach, describe, expect, it } from 'vitest'
import { asegurarEsquemaCohortes } from './cohortes.js'

let db: Client

beforeEach(async () => {
  db = createClient({ url: ':memory:' })
  await db.batch([
    `CREATE TABLE estudiantes (id_estudiante INTEGER PRIMARY KEY, id_persona INTEGER, id_empresa INTEGER)`,
    `CREATE TABLE afiliados (id_afiliado INTEGER PRIMARY KEY, id_persona INTEGER, id_empresa INTEGER, estatus TEXT)`,
    `CREATE TABLE inscripciones_cursos (id_inscripcion INTEGER PRIMARY KEY, id_estudiante INTEGER, id_curso INTEGER, programa_codigo TEXT)`,
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
