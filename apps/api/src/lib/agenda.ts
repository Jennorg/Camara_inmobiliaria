/** Horarios libres para entrevistas. Lógica pura: sin red ni BD. Caracas es UTC-4 todo el año (sin horario de verano). */

export type Regla = { dia_semana: number; hora_inicio: string; hora_fin: string }
export type Intervalo = { inicio: string; fin: string }

export const DURACION_MIN = 30
export const ANTICIPACION_H = 24
export const HORIZONTE_DIAS = 14
export const VALIDEZ_ENLACE_DIAS = 14

const OFFSET_CARACAS_H = -4
const MIN = 60_000
const HORA = 60 * MIN
const DIA = 24 * HORA
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

const aMinutos = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3))

export function validarReglas(reglas: unknown): Regla[] {
  if (!Array.isArray(reglas)) throw new Error('La disponibilidad debe ser una lista de horarios.')
  return reglas.map(r => {
    const { dia_semana, hora_inicio, hora_fin } = r ?? {}
    if (!Number.isInteger(dia_semana) || dia_semana < 0 || dia_semana > 6) throw new Error('El día de la semana debe ir de 0 (domingo) a 6 (sábado).')
    if (typeof hora_inicio !== 'string' || !HHMM.test(hora_inicio) || typeof hora_fin !== 'string' || !HHMM.test(hora_fin)) {
      throw new Error('Las horas deben tener el formato HH:MM.')
    }
    if (aMinutos(hora_fin) <= aMinutos(hora_inicio)) throw new Error('La hora de fin debe ser posterior a la de inicio.')
    return { dia_semana, hora_inicio, hora_fin }
  }).map((r, i, todas) => {
    // Reglas que se solapan el mismo día generarían horarios repetidos o desalineados (doble reserva)
    if (todas.some((o, k) => k !== i && o.dia_semana === r.dia_semana && aMinutos(o.hora_inicio) < aMinutos(r.hora_fin) && aMinutos(r.hora_inicio) < aMinutos(o.hora_fin))) {
      throw new Error('Hay horarios que se solapan el mismo día. Únelos o ajústalos.')
    }
    return r
  })
}

/** Fecha (YYYY-MM-DD) y hora (HH:MM) de Caracas de un instante ISO. */
export function aCaracas(iso: string): { fecha: string; hora: string } {
  const local = new Date(new Date(iso).getTime() + OFFSET_CARACAS_H * HORA).toISOString()
  return { fecha: local.slice(0, 10), hora: local.slice(11, 16) }
}

/** Horarios de DURACION_MIN que caen en las reglas semanales, con anticipación y horizonte, sin solaparse con `ocupados`. */
export function generarHorarios(reglas: Regla[], ahora: Date, ocupados: Intervalo[]): Intervalo[] {
  if (reglas.length === 0) return []
  const desde = ahora.getTime() + ANTICIPACION_H * HORA
  const hasta = ahora.getTime() + HORIZONTE_DIAS * DIA
  const ocupadosMs = ocupados.map(o => [new Date(o.inicio).getTime(), new Date(o.fin).getTime()] as const)
  // Medianoche de Caracas del día de `ahora`, expresada como instante UTC
  const hoyLocal = new Date(ahora.getTime() + OFFSET_CARACAS_H * HORA)
  const medianoche0 = Date.UTC(hoyLocal.getUTCFullYear(), hoyLocal.getUTCMonth(), hoyLocal.getUTCDate()) - OFFSET_CARACAS_H * HORA

  const salida: Intervalo[] = []
  for (let d = 0; d <= HORIZONTE_DIAS + 1; d++) {
    const medianoche = medianoche0 + d * DIA
    const diaSemana = new Date(medianoche + OFFSET_CARACAS_H * HORA).getUTCDay()
    for (const r of reglas) {
      if (r.dia_semana !== diaSemana) continue
      for (let m = aMinutos(r.hora_inicio); m + DURACION_MIN <= aMinutos(r.hora_fin); m += DURACION_MIN) {
        const ini = medianoche + m * MIN
        const fin = ini + DURACION_MIN * MIN
        if (ini < desde || ini > hasta) continue
        if (ocupadosMs.some(([oi, of]) => ini < of && fin > oi)) continue
        salida.push({ inicio: new Date(ini).toISOString(), fin: new Date(fin).toISOString() })
      }
    }
  }
  return salida.sort((a, b) => a.inicio.localeCompare(b.inicio))
}
