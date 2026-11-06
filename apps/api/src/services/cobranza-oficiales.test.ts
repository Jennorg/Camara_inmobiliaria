import { createClient } from '@libsql/client'
import { beforeAll, describe, expect, it, vi } from 'vitest'

const mem = createClient({ url: ':memory:' })
vi.mock('../lib/db.js', () => ({ db: mem }))
vi.mock('../lib/email.js', () => ({ enviarCorreosLote: vi.fn() }))

const svc = await import('./cobranza.service.js')

beforeAll(async () => {
  await mem.batch([
    `CREATE TABLE cms_configuracion (clave TEXT PRIMARY KEY, valor TEXT, actualizado_en TEXT)`,
    `CREATE TABLE aranceles_config (codigo TEXT PRIMARY KEY, monto_usd REAL)`,
    `CREATE TABLE afiliados (id_afiliado INTEGER PRIMARY KEY, estatus TEXT, activo INTEGER DEFAULT 1, codigo TEXT, fecha_afiliacion TEXT, eliminado_en TEXT)`,
    `CREATE TABLE pagos (id_pago INTEGER PRIMARY KEY, id_afiliado INTEGER, numero_recibo TEXT, estatus TEXT, periodo TEXT, meses_cubiertos INTEGER, monto_usd_equivalente REAL, fecha_pago TEXT, tipo_concepto TEXT, eliminado_en TEXT)`,
    `CREATE TABLE solvencia_historial (id_afiliado INTEGER, periodo TEXT, estado TEXT, fuente TEXT)`,
    `INSERT INTO cms_configuracion VALUES ('solvencia_inicio', '2026-01', 'x')`,
    // 1 oficial con código (sin fecha: cuenta desde el arranque) · 2 aspirante CIBIR sin código · 3 «Afiliado» sin código · 4 oficial con fecha de afiliación
    `INSERT INTO afiliados (id_afiliado, estatus, codigo, fecha_afiliacion) VALUES
       (1, 'Afiliado', 'A-001', NULL), (2, '5_CIBIR', NULL, NULL), (3, 'Afiliado', '  ', NULL), (4, 'Afiliado', 'A-004', '2026-09-15')`,
  ], 'write')
})

describe('cobranza: solo se cobra a afiliados oficiales con código', () => {
  it('por id, el aspirante CIBIR y el afiliado sin código no tienen deuda ni meses', async () => {
    const { solvencias } = await svc.calcularSolvencias([1, 2, 3, 4])
    expect([...solvencias.keys()].sort()).toEqual([1, 4])
  })

  it('en el cálculo general tampoco aparecen', async () => {
    const { solvencias } = await svc.calcularSolvencias()
    expect([...solvencias.keys()].sort()).toEqual([1, 4])
  })

  it('la deuda del oficial arranca en su afiliación, no antes', async () => {
    const { solvencias } = await svc.calcularSolvencias([1, 4])
    expect(solvencias.get(1)!.meses[0].periodo).toBe('2026-01') // sin fecha: desde el arranque configurado
    expect(solvencias.get(4)!.meses[0].periodo).toBe('2026-09')
  })

  it('un aspirante no puede emitir constancia y su próximo mes de pago es el actual', async () => {
    await expect(svc.emitirConstanciaSolvencia(2)).rejects.toMatchObject({ status: 409 })
    await expect(svc.emitirConstanciaSolvencia(3)).rejects.toMatchObject({ status: 409 })
    expect(await svc.mesMasAntiguoImpago(2)).toBe(svc.hoyCaracas().slice(0, 7))
  })
})
