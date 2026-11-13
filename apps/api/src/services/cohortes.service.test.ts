import { createClient } from '@libsql/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mem = vi.hoisted(() => ({ client: null as unknown as import('@libsql/client').Client }))
vi.mock('../lib/db.js', () => ({ db: new Proxy({}, { get: (_t, k) => (mem.client as any)[k].bind(mem.client) }) }))

import { faltaCohorteParaCibir } from './cohortes.service.js'

beforeEach(async () => {
  mem.client = createClient({ url: ':memory:' })
  await mem.client.batch([
    `CREATE TABLE estudiantes (id_estudiante INTEGER PRIMARY KEY, id_persona INTEGER, id_empresa INTEGER)`,
    `CREATE TABLE afiliados (id_afiliado INTEGER PRIMARY KEY, id_persona INTEGER, id_empresa INTEGER, estatus TEXT)`,
    `CREATE TABLE inscripciones_cursos (id_inscripcion INTEGER PRIMARY KEY, id_estudiante INTEGER, id_curso INTEGER, programa_codigo TEXT, estatus TEXT, completado INTEGER, id_cohorte INTEGER)`,
    `CREATE TABLE cohortes (id_cohorte INTEGER PRIMARY KEY, programa_codigo TEXT, numero INTEGER, nombre TEXT, estado TEXT)`,
    `INSERT INTO estudiantes VALUES (1, 10, NULL), (2, 20, NULL)`,
    `INSERT INTO afiliados VALUES (1, 10, NULL, '4_VERIFICACION'), (2, 20, NULL, '5_CIBIR')`,
  ])
})

describe('entrada a la etapa CIBIR: exige cohorte', () => {
  it('sin cohorte CIBIR abierta no se entra, ni por afiliado ni por estudiante', async () => {
    await mem.client.execute(`INSERT INTO cohortes VALUES (1, 'CIBIR', 1, 'Cohorte 1', 'Cerrada'), (2, 'PEGI', 1, 'Cohorte 1', 'Abierta')`)
    expect(await faltaCohorteParaCibir({ idAfiliado: 1 })).toBe(true)
    expect(await faltaCohorteParaCibir({ idEstudiante: 1 })).toBe(true)
  })

  it('con una cohorte CIBIR abierta se entra', async () => {
    await mem.client.execute(`INSERT INTO cohortes VALUES (1, 'CIBIR', 1, 'Cohorte 1', 'Abierta')`)
    expect(await faltaCohorteParaCibir({ idAfiliado: 1 })).toBe(false)
  })

  it('a quien ya está en la etapa no se le vuelve a exigir', async () => {
    expect(await faltaCohorteParaCibir({ idAfiliado: 2 })).toBe(false)
    expect(await faltaCohorteParaCibir({ idEstudiante: 2 })).toBe(false)
  })
})
