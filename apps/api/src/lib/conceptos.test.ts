import { describe, expect, it } from 'vitest'
import { conceptoReporte, tramoAntiguedad } from './conceptos.js'

describe('conceptoReporte', () => {
  it('clasifica por tipo y arancel', () => {
    expect(conceptoReporte('mensualidad', 'mensualidad_base')).toBe('mensualidad')
    expect(conceptoReporte('formalizacion_afiliacion', 'inscripcion_natural')).toBe('afiliacion')
    expect(conceptoReporte('curso_cibir', null)).toBe('cibir')
    expect(conceptoReporte('programa', 'programa_pegi')).toBe('pegi')
    expect(conceptoReporte('curso', null)).toBe('curso')
    expect(conceptoReporte('otro', null)).toBe('otros')
  })
})

describe('tramoAntiguedad', () => {
  it('agrupa en tramos de 30 días', () => {
    expect([0, 30, 31, 60, 61, 90, 91].map(tramoAntiguedad)).toEqual(['0-30', '0-30', '31-60', '31-60', '61-90', '61-90', '90+'])
  })
})
