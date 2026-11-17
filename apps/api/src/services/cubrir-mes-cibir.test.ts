import { beforeEach, describe, expect, it, vi } from 'vitest'

const sqls: string[] = []
const estadoMes = vi.fn()
vi.mock('./cuotas-importadas.service.js', () => ({ fijarMontoCuotas: vi.fn(), montoCuotaActual: vi.fn(async () => 5) }))
let hoy = '2026-11-13'
const marcados: unknown[][] = []
vi.mock('../lib/db.js', () => ({ db: { execute: vi.fn(async (q: any) => {
  sqls.push(typeof q === 'string' ? q : q.sql)
  if (typeof q !== 'string' && q.sql.includes('INSERT INTO solvencia_historial')) marcados.push(q.args)
  return { rows: [], rowsAffected: 0 }
}) } }))
vi.mock('./cobranza.service.js', () => ({
  mesMasAntiguoImpago: vi.fn(),
  hoyCaracas: () => hoy,
  calcularSolvencias: vi.fn(async () => ({ hoy, solvencias: new Map([[7, { meses: [{ periodo: '2026-11', estado: estadoMes() }] }]]) })),
}))
const { cubrirMesActualCibir, mesesPrimeraCuota } = await import('./pagos.service.js')
const marco = () => sqls.some(s => s.includes('INSERT INTO solvencia_historial'))

describe('cubrirMesActualCibir', () => {
  beforeEach(() => { sqls.length = 0; marcados.length = 0; hoy = '2026-11-13' })
  it('marca el mes en curso cuando ningún pago lo cubre', async () => {
    estadoMes.mockReturnValue('por_pagar')
    await cubrirMesActualCibir(7, 1)
    expect(marco()).toBe(true)
  })
  it('no lo duplica si el pago del CIBIR ya cubre el mes', async () => {
    estadoMes.mockReturnValue('pagado')
    await cubrirMesActualCibir(7, 1)
    expect(marco()).toBe(false)
  })
  it('desde el día 15 exonera también el mes siguiente', async () => {
    hoy = '2026-11-15'
    estadoMes.mockReturnValue('pagado')
    await cubrirMesActualCibir(7, 1)
    expect(marcados.map(a => a[1])).toEqual(['2026-12'])
  })
})

describe('mesesPrimeraCuota', () => {
  it('hasta el 14 cubre un mes; desde el 15, dos', () => {
    expect(mesesPrimeraCuota('2026-11-14')).toBe(1)
    expect(mesesPrimeraCuota('2026-11-15')).toBe(2)
  })
})
