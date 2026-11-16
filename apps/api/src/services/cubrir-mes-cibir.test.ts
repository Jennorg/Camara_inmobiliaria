import { beforeEach, describe, expect, it, vi } from 'vitest'

const sqls: string[] = []
const estadoMes = vi.fn()
vi.mock('../lib/db.js', () => ({ db: { execute: vi.fn(async (q: any) => { sqls.push(typeof q === 'string' ? q : q.sql); return { rows: [], rowsAffected: 0 } }) } }))
vi.mock('./cuotas-importadas.service.js', () => ({ fijarMontoCuotas: vi.fn(), montoCuotaActual: vi.fn(async () => 5) }))
vi.mock('./cobranza.service.js', () => ({
  mesMasAntiguoImpago: vi.fn(),
  calcularSolvencias: vi.fn(async () => ({ hoy: '2026-11-13', solvencias: new Map([[7, { meses: [{ periodo: '2026-11', estado: estadoMes() }] }]]) })),
}))
const { cubrirMesActualCibir } = await import('./pagos.service.js')
const marco = () => sqls.some(s => s.includes('INSERT INTO solvencia_historial'))

describe('cubrirMesActualCibir', () => {
  beforeEach(() => { sqls.length = 0 })
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
})
