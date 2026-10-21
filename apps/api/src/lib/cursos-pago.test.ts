import { createClient } from '@libsql/client'
import { describe, expect, it } from 'vitest'
import { esCupoIlimitado, isoSegundos, precioCurso, sqlOcupaCupo, venceReserva } from './cursos-pago.js'

describe('precioCurso', () => {
  it('cobra el precio de afiliado o de público y trata NULL/0 como gratis', () => {
    const curso = { precio_afiliado_usd: 30, precio_publico_usd: 50 }
    expect(precioCurso(curso, true)).toBe(30)
    expect(precioCurso(curso, false)).toBe(50)
    expect(precioCurso({ precio_afiliado_usd: 0, precio_publico_usd: 20 }, true)).toBe(0)
    expect(precioCurso({}, false)).toBe(0)
  })
})

describe('venceReserva', () => {
  it('suma las horas y guarda la fecha sin milisegundos', () => {
    expect(venceReserva(new Date('2026-10-20T10:00:00.123Z'), 48)).toBe('2026-10-22T10:00:00Z')
  })
})

describe('esCupoIlimitado', () => {
  it('999999 o vacío es ilimitado', () => {
    expect(esCupoIlimitado(999999)).toBe(true)
    expect(esCupoIlimitado(null)).toBe(true)
    expect(esCupoIlimitado(30)).toBe(false)
  })
})

describe('sqlOcupaCupo', () => {
  it('cuenta admitidos, preinscritos sin reserva, con reserva vigente o con pago pendiente', async () => {
    const db = createClient({ url: ':memory:' })
    await db.batch([
      `CREATE TABLE inscripciones_cursos (id_inscripcion INTEGER PRIMARY KEY, estatus TEXT, reserva_vence_en TEXT)`,
      `CREATE TABLE pagos (id_inscripcion_curso INTEGER, estatus TEXT, eliminado_en TEXT)`,
    ])
    const ahora = Date.now()
    const futuro = isoSegundos(new Date(ahora + 3_600_000))
    const pasado = isoSegundos(new Date(ahora - 3_600_000))
    const filas: [number, string, string | null][] = [
      [1, 'Inscrito', null],        // ocupa
      [2, 'Pagado', null],          // ocupa
      [3, 'Entrevista', null],      // ocupa
      [4, 'Preinscrito', null],     // ocupa: curso gratis o con aprobación
      [5, 'Preinscrito', futuro],   // ocupa: reserva vigente
      [6, 'Preinscrito', pasado],   // libre: reserva vencida sin pago
      [7, 'Preinscrito', pasado],   // ocupa: reserva vencida pero con pago pendiente
      [8, 'Preinscrito', pasado],   // libre: su pago fue rechazado
      [9, 'Cancelado', null],       // libre
      [10, 'Rechazado', futuro],    // libre
    ]
    for (const args of filas) await db.execute({ sql: `INSERT INTO inscripciones_cursos VALUES (?, ?, ?)`, args })
    await db.execute(`INSERT INTO pagos VALUES (7, 'Pendiente', NULL), (8, 'Rechazado', NULL)`)

    const r = await db.execute(`SELECT id_inscripcion FROM inscripciones_cursos ic WHERE ${sqlOcupaCupo()} ORDER BY 1`)
    expect(r.rows.map(x => Number(x.id_inscripcion))).toEqual([1, 2, 3, 4, 5, 7])
  })
})
