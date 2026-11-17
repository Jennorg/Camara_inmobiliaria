import { createClient } from '@libsql/client'
import { beforeAll, describe, expect, it, vi } from 'vitest'

const mem = createClient({ url: ':memory:' })
let hoy = '2026-11-17'
let desde = '2026-01'
vi.mock('../lib/db.js', () => ({ db: mem }))
vi.mock('./cobranza.service.js', () => ({ hoyCaracas: () => hoy, mesMasAntiguoImpago: async () => desde, calcularSolvencias: vi.fn() }))
const { ofertaAnual, precioMensualidades, validarMontoArancel } = await import('./pagos.service.js')

beforeAll(async () => {
  await mem.batch([
    `CREATE TABLE aranceles_config (codigo TEXT PRIMARY KEY, nombre TEXT, descripcion TEXT, monto_usd REAL, categoria TEXT, activo INTEGER, fecha_limite TEXT)`,
    `INSERT INTO aranceles_config VALUES ('mensualidad_base', 'Cuota', '', 10, 'mensualidad', 1, NULL)`,
    `INSERT INTO aranceles_config VALUES ('mensualidad_anual_adelantada', 'Año', '', 100, 'mensualidad', 1, '2026-12-24')`,
  ], 'write')
})

const oferta = { anio: 2026, monto: 100, fecha_limite: '2026-12-24' }

describe('año adelantado', () => {
  it('solo el año en curso, hasta la fecha límite inclusive', async () => {
    hoy = '2026-12-24'
    expect(await ofertaAnual()).toEqual(oferta)
    hoy = '2026-12-25'
    expect(await ofertaAnual()).toBeNull()
    hoy = '2025-12-01' // la fecha límite es de 2026: no se adelanta un año que no está en curso
    expect(await ofertaAnual()).toBeNull()
    hoy = '2026-11-17'
  })

  it('precio: 12 meses ene–dic al precio anual; 11 meses o un año ya empezado, a cuota normal; mezcla de 13', () => {
    expect(precioMensualidades('2026-01', 12, 10, oferta)).toBe(100)
    expect(precioMensualidades('2026-01', 11, 10, oferta)).toBe(110)
    expect(precioMensualidades('2026-02', 12, 10, oferta)).toBe(120) // feb 2026–ene 2027: no es el año completo
    expect(precioMensualidades('2027-01', 12, 10, oferta)).toBe(120) // el año siguiente, a cuota normal
    expect(precioMensualidades('2025-12', 13, 10, oferta)).toBe(110) // deuda de dic 2025 + el año 2026
    expect(precioMensualidades('2025-12', 13, 10, null)).toBe(130)
  })

  it('la caja cobra el pronto pago antes de la fecha límite y no después; el afiliado siempre a cuota normal', async () => {
    const pago = { tipo_concepto: 'mensualidad', id_afiliado: 1, meses_cubiertos: 12, monto_usd: 100, conOfertaAnual: true }
    hoy = '2026-12-20'
    expect(await validarMontoArancel(pago)).toBeNull()
    expect(await validarMontoArancel({ ...pago, conOfertaAnual: false })).toEqual({ esperado: 120 })
    hoy = '2026-12-26'
    expect(await validarMontoArancel(pago)).toEqual({ esperado: 120 })
    hoy = '2026-11-17'
  })
})
