import { describe, expect, it } from 'vitest'
import { aCaracas, generarHorarios, validarReglas, type Regla } from './agenda.js'

// Lunes 26-oct-2026, 10:00 en Caracas (14:00 UTC)
const AHORA = new Date('2026-10-26T14:00:00.000Z')
const lunes: Regla = { dia_semana: 1, hora_inicio: '09:00', hora_fin: '10:00' }
const inicios = (h: { inicio: string }[]) => h.map(x => x.inicio)

describe('generarHorarios', () => {
  it('una regla de lunes 09:00-10:00 da dos horarios de 30 min por lunes dentro del horizonte', () => {
    const h = generarHorarios([lunes], AHORA, [])
    expect(inicios(h)).toEqual([
      '2026-11-02T13:00:00.000Z', '2026-11-02T13:30:00.000Z',
      '2026-11-09T13:00:00.000Z', '2026-11-09T13:30:00.000Z',
    ])
    expect(h[0].fin).toBe('2026-11-02T13:30:00.000Z')
  })

  it('respeta la anticipación mínima de 24 h', () => {
    // martes 09:00 Caracas = 13:00 UTC; el del 27-oct está a 23 h de AHORA
    const martes: Regla = { dia_semana: 2, hora_inicio: '09:00', hora_fin: '09:30' }
    expect(inicios(generarHorarios([martes], AHORA, []))).toEqual(['2026-11-03T13:00:00.000Z']) // el 10-nov ya queda fuera de los 14 días
  })

  it('un ocupado quita solo su horario; uno que termina justo al inicio no quita nada', () => {
    const h = generarHorarios([lunes], AHORA, [
      { inicio: '2026-11-02T13:00:00.000Z', fin: '2026-11-02T13:30:00.000Z' },
      { inicio: '2026-11-09T12:30:00.000Z', fin: '2026-11-09T13:00:00.000Z' },
    ])
    expect(inicios(h)).toEqual(['2026-11-02T13:30:00.000Z', '2026-11-09T13:00:00.000Z', '2026-11-09T13:30:00.000Z'])
  })

  it('sin reglas no hay horarios', () => {
    expect(generarHorarios([], AHORA, [])).toEqual([])
  })
})

describe('validarReglas', () => {
  it('acepta una lista vacía y reglas correctas', () => {
    expect(validarReglas([])).toEqual([])
    expect(validarReglas([lunes])).toEqual([lunes])
  })

  it('rechaza reglas que se solapan el mismo día, pero acepta contiguas y solapes en días distintos', () => {
    expect(() => validarReglas([lunes, { ...lunes, hora_inicio: '09:30', hora_fin: '10:30' }])).toThrow()
    expect(() => validarReglas([lunes, { ...lunes, hora_inicio: '10:00', hora_fin: '11:00' }])).not.toThrow()
    expect(() => validarReglas([lunes, { ...lunes, dia_semana: 2, hora_inicio: '09:30', hora_fin: '10:30' }])).not.toThrow()
  })

  it('rechaza hora_fin <= hora_inicio, día fuera de 0-6 y horas que no son HH:MM', () => {
    expect(() => validarReglas([{ ...lunes, hora_fin: '09:00' }])).toThrow()
    expect(() => validarReglas([{ ...lunes, hora_fin: '08:00' }])).toThrow()
    expect(() => validarReglas([{ ...lunes, dia_semana: 7 }])).toThrow()
    expect(() => validarReglas([{ ...lunes, hora_inicio: '9:00' }])).toThrow()
    expect(() => validarReglas([{ ...lunes, hora_fin: '25:00' }])).toThrow()
    expect(() => validarReglas('no es una lista')).toThrow()
  })
})

describe('aCaracas', () => {
  it('convierte un instante UTC a fecha y hora de Caracas', () => {
    expect(aCaracas('2026-11-02T13:00:00.000Z')).toEqual({ fecha: '2026-11-02', hora: '09:00' })
    expect(aCaracas('2026-11-03T02:30:00.000Z')).toEqual({ fecha: '2026-11-02', hora: '22:30' })
  })
})
