import { describe, expect, it } from 'vitest'
import { avisoDelDia, calcularMeses, desdeAfiliado, resumenDeuda, type PagoCubierto } from './solvencia.js'

const pago = (periodo: string, estatus = 'Verificado', meses = 1): PagoCubierto => ({
  id_pago: 1, numero_recibo: 'REC-1', estatus, periodo, meses_cubiertos: meses, monto_usd_equivalente: 5, fecha_pago: '2026-01-01',
})
const estados = (d: string, h: string, p: PagoCubierto[], hist: Parameters<typeof calcularMeses>[3] = []) => calcularMeses(d, h, p, hist).map(m => `${m.periodo}:${m.estado}`)

describe('calcularMeses', () => {
  it('meses anteriores sin pago son deuda y el actual está por pagar', () => {
    expect(estados('2026-08', '2026-10', [pago('2026-08')])).toEqual(['2026-08:pagado', '2026-09:deuda', '2026-10:por_pagar'])
  })
  it('un pago pendiente queda en revisión y un pago de varios meses cubre todos', () => {
    expect(estados('2026-08', '2026-10', [pago('2026-08', 'Pendiente'), pago('2026-09', 'Verificado', 2)]))
      .toEqual(['2026-08:en_revision', '2026-09:pagado', '2026-10:pagado'])
  })
  it('el historial importado marca pagado, oculta los meses sin afiliación y el pago real prevalece', () => {
    const historial = [
      ...['2026-06', '2026-07'].map(periodo => ({ periodo, estado: 'no_afiliado' as const })),
      ...['2026-08', '2026-09'].map(periodo => ({ periodo, estado: 'pagado' as const })),
    ]
    expect(estados('2026-06', '2026-10', [], historial)).toEqual(['2026-08:pagado', '2026-09:pagado', '2026-10:por_pagar'])
    expect(calcularMeses('2026-08', '2026-10', [pago('2026-08')], historial)[0].historico).toBeUndefined()
  })
  it('un mes sin registro entre pagos históricos es deuda', () => {
    const historial = ['2026-01', '2026-03'].map(periodo => ({ periodo, estado: 'pagado' as const }))
    expect(estados('2026-01', '2026-03', [], historial)).toEqual(['2026-01:pagado', '2026-02:deuda', '2026-03:pagado'])
  })
  it('pagos por adelantado extienden la línea y rechazados no cuentan', () => {
    expect(estados('2026-10', '2026-10', [pago('2026-10', 'Verificado', 3), pago('2026-10', 'Rechazado')]))
      .toEqual(['2026-10:pagado', '2026-11:adelantado', '2026-12:adelantado'])
  })
})

describe('resumenDeuda', () => {
  const cfg = { diaVencimiento: 5, diasAvisoPrevio: 3, frecuenciaMoraDias: 7, mesesGracia: 2 }
  const meses = calcularMeses('2026-07', '2026-10', [pago('2026-07')])
  it('antes del vencimiento el mes en curso no es deuda', () => {
    expect(resumenDeuda(meses, '2026-10-05', 5, cfg)).toEqual({ mesesDeuda: 2, montoUsd: 10, mesMasAntiguo: '2026-08', mesesSinVerificar: 2, bloqueado: false })
  })
  it('pasado el vencimiento el mes en curso suma y supera la gracia', () => {
    expect(resumenDeuda(meses, '2026-10-06', 5, cfg)).toEqual({ mesesDeuda: 3, montoUsd: 15, mesMasAntiguo: '2026-08', mesesSinVerificar: 3, bloqueado: true })
  })
  it('un pago en revisión deja de ser deuda pero no levanta el bloqueo hasta verificarse', () => {
    const conReporte = calcularMeses('2026-07', '2026-10', [pago('2026-07'), pago('2026-08', 'Pendiente', 3)])
    expect(resumenDeuda(conReporte, '2026-10-06', 5, cfg)).toEqual({ mesesDeuda: 0, montoUsd: 0, mesMasAntiguo: null, mesesSinVerificar: 3, bloqueado: true })
  })
  it('al día no debe nada', () => {
    expect(resumenDeuda(calcularMeses('2026-10', '2026-10', [pago('2026-10')]), '2026-10-20', 5, cfg).mesesDeuda).toBe(0)
  })
})

describe('avisoDelDia', () => {
  const cfg = { diaVencimiento: 5, diasAvisoPrevio: 3, frecuenciaMoraDias: 7, mesesGracia: 2 }
  it('al día: aviso previo y el día del vencimiento, nada si ya pagó o reportó', () => {
    expect(avisoDelDia('2026-10-02', cfg, 'por_pagar', 0, null)).toBe('previo')
    expect(avisoDelDia('2026-10-05', cfg, 'por_pagar', 0, null)).toBe('vencimiento')
    expect(avisoDelDia('2026-10-03', cfg, 'por_pagar', 0, null)).toBeNull()
    expect(avisoDelDia('2026-10-05', cfg, 'en_revision', 0, null)).toBeNull()
    expect(avisoDelDia('2026-10-05', cfg, 'pagado', 0, null)).toBeNull()
  })
  it('con deuda: mora la primera vez y luego cada N días', () => {
    expect(avisoDelDia('2026-10-10', cfg, 'por_pagar', 2, null)).toBe('mora')
    expect(avisoDelDia('2026-10-16', cfg, 'por_pagar', 2, '2026-10-10')).toBeNull()
    expect(avisoDelDia('2026-10-17', cfg, 'por_pagar', 2, '2026-10-10')).toBe('mora')
  })
})

describe('desdeAfiliado', () => {
  it('con historial importado manda su primer mes', () => {
    expect(desdeAfiliado('2026-07', '2026-09-01', [{ periodo: '2026-03', estado: 'pagado' }, { periodo: '2026-01', estado: 'pagado' }])).toBe('2026-01')
  })
  it('una marca manual suelta no mueve el inicio ni oculta la deuda anterior', () => {
    expect(desdeAfiliado('2026-07', null, [{ periodo: '2026-08', estado: 'pagado', manual: true }])).toBe('2026-07')
    expect(desdeAfiliado('2026-07', '2026-09-15', [{ periodo: '2026-08', estado: 'pagado', manual: true }])).toBe('2026-09')
  })
  it('sin historial usa el mayor entre el arranque y la afiliación', () => {
    expect(desdeAfiliado('2026-07', '2026-02-10')).toBe('2026-07')
    expect(desdeAfiliado('2026-07', '2026-09-10')).toBe('2026-09')
  })
})
