import { createClient } from '@libsql/client'
import { beforeAll, describe, expect, it, vi } from 'vitest'

const mem = createClient({ url: ':memory:' })
vi.mock('../lib/db.js', () => ({ db: mem }))
const { sincerarAnioAfiliado } = await import('./cuotas-importadas.service.js')

beforeAll(async () => {
  await mem.batch([
    `CREATE TABLE aranceles_config (codigo TEXT, monto_usd REAL)`,
    `INSERT INTO aranceles_config VALUES ('mensualidad_base', 10)`,
    `CREATE TABLE pagos (id_afiliado INTEGER, tipo_concepto TEXT, estatus TEXT, eliminado_en TEXT, periodo TEXT, meses_cubiertos INTEGER)`,
    `CREATE TABLE solvencia_historial (id_afiliado INTEGER, periodo TEXT, estado TEXT, fuente TEXT, monto_usd REAL, importado_en TEXT, PRIMARY KEY (id_afiliado, periodo))`,
  ], 'write')
  // Afiliado 1: los 12 meses marcados a mano en Solvencia (no importados)
  for (let m = 1; m <= 12; m++) {
    await mem.execute({ sql: `INSERT INTO solvencia_historial VALUES (1, ?, 'pagado', 'manual:334', 10, NULL)`, args: [`2026-${String(m).padStart(2, '0')}`] })
  }
})

describe('sincerarAnioAfiliado', () => {
  it('también revaloriza un año marcado a mano mes a mes, no solo el importado', async () => {
    expect(await sincerarAnioAfiliado(1, 2026, 100)).toEqual({ anio: 2026, antes_usd: 120, despues_usd: 100 })
    const total = await mem.execute(`SELECT SUM(monto_usd) t FROM solvencia_historial WHERE id_afiliado = 1`)
    expect(Number(total.rows[0].t)).toBeCloseTo(100)
  })

  it('exige los 12 meses marcados', async () => {
    await expect(sincerarAnioAfiliado(2, 2026, 100)).rejects.toThrow('tiene 0')
  })
})
