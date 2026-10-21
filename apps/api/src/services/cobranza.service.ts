import { db } from '../lib/db.js'
import {
  calcularMeses,
  resumenDeuda,
  CONFIG_COBRANZA_DEFECTO,
  type ConfigCobranza,
  type HistorialMes,
  type MesSolvencia,
  type PagoCubierto,
  type ResumenDeuda,
} from '../lib/solvencia.js'

export const MES_RE = /^\d{4}-(0[1-9]|1[0-2])$/
const CLAVE_INICIO = 'solvencia_inicio'
const CLAVES_COBRANZA: Record<keyof ConfigCobranza, string> = {
  diaVencimiento: 'cobranza_dia_vencimiento',
  diasAvisoPrevio: 'cobranza_dias_aviso_previo',
  frecuenciaMoraDias: 'cobranza_frecuencia_mora_dias',
  mesesGracia: 'cobranza_meses_gracia',
}
/** Rango válido de cada parámetro de cobranza */
const RANGOS: Record<keyof ConfigCobranza, [number, number]> = {
  diaVencimiento: [1, 28],
  diasAvisoPrevio: [0, 20],
  frecuenciaMoraDias: [1, 60],
  mesesGracia: [0, 24],
}

/** Fecha de hoy en Venezuela (YYYY-MM-DD): el vencimiento se cuenta en hora local, no UTC. */
export const hoyCaracas = (): string => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Caracas' })

async function leerConfig(claves: string[]): Promise<Map<string, string>> {
  const r = await db.execute({
    sql: `SELECT clave, valor FROM cms_configuracion WHERE clave IN (${claves.map(() => '?').join(',')})`,
    args: claves,
  })
  return new Map(r.rows.map(row => [String(row.clave), String(row.valor)]))
}

async function guardarConfig(pares: [string, string][]) {
  const ahora = new Date().toISOString()
  await db.batch(pares.map(([clave, valor]) => ({
    sql: `INSERT INTO cms_configuracion (clave, valor, actualizado_en) VALUES (?, ?, ?)
          ON CONFLICT (clave) DO UPDATE SET valor = excluded.valor, actualizado_en = excluded.actualizado_en`,
    args: [clave, valor, ahora],
  })), 'write')
}

/** Mes desde el que se cuenta la deuda y parámetros de cobranza (con valores por defecto). */
export async function getConfigSolvencia(): Promise<{ inicio: string; cobranza: ConfigCobranza }> {
  const valores = await leerConfig([CLAVE_INICIO, ...Object.values(CLAVES_COBRANZA)])
  const inicio = valores.get(CLAVE_INICIO)
  const cobranza = { ...CONFIG_COBRANZA_DEFECTO }
  for (const k of Object.keys(CLAVES_COBRANZA) as (keyof ConfigCobranza)[]) {
    const n = Number(valores.get(CLAVES_COBRANZA[k]))
    if (Number.isInteger(n) && n >= RANGOS[k][0] && n <= RANGOS[k][1]) cobranza[k] = n
  }
  return { inicio: inicio && MES_RE.test(inicio) ? inicio : hoyCaracas().slice(0, 7), cobranza }
}

/** Valida y guarda lo que venga (inicio y/o parámetros de cobranza). Lanza Error con mensaje si algo es inválido. */
export async function setConfigSolvencia(body: Record<string, unknown>) {
  const pares: [string, string][] = []
  if (body.inicio !== undefined) {
    if (typeof body.inicio !== 'string' || !MES_RE.test(body.inicio)) throw new Error('inicio debe tener el formato AAAA-MM')
    pares.push([CLAVE_INICIO, body.inicio])
  }
  const cobranza = (body.cobranza ?? {}) as Record<string, unknown>
  for (const k of Object.keys(CLAVES_COBRANZA) as (keyof ConfigCobranza)[]) {
    if (cobranza[k] === undefined) continue
    const n = Number(cobranza[k])
    const [min, max] = RANGOS[k]
    if (!Number.isInteger(n) || n < min || n > max) throw new Error(`${k} debe ser un entero entre ${min} y ${max}`)
    pares.push([CLAVES_COBRANZA[k], String(n)])
  }
  if (pares.length) await guardarConfig(pares)
  return getConfigSolvencia()
}

// shortcut: usa el precio vigente de mensualidad_base para todos los meses, guardar el precio por mes si cambia el arancel
export async function getMontoMensual(): Promise<number> {
  const r = await db.execute(`SELECT monto_usd FROM aranceles_config WHERE codigo = 'mensualidad_base'`)
  return Number(r.rows[0]?.monto_usd ?? 5)
}

const PAGOS_SQL = `SELECT id_pago, id_afiliado, numero_recibo, estatus, periodo, meses_cubiertos, monto_usd_equivalente, fecha_pago
                   FROM pagos
                   WHERE eliminado_en IS NULL AND periodo IS NOT NULL
                     AND tipo_concepto IN ('mensualidad', 'formalizacion_afiliacion')
                     AND estatus IN ('Verificado', 'Pendiente')`

const HISTORIAL_SQL = `SELECT id_afiliado, periodo, estado FROM solvencia_historial`

/** Con historial importado manda el primer mes registrado; sin él, el mayor entre el arranque y la afiliación. */
const desdeAfiliado = (inicio: string, fechaAfiliacion: unknown, historial: HistorialMes[] = []) => {
  if (historial.length) return historial.reduce((min, h) => (h.periodo < min ? h.periodo : min), historial[0].periodo)
  const f = typeof fechaAfiliacion === 'string' ? fechaAfiliacion.slice(0, 7) : ''
  return MES_RE.test(f) && f > inicio ? f : inicio
}

export interface SolvenciaAfiliado extends ResumenDeuda {
  id_afiliado: number
  meses: MesSolvencia[]
}

/**
 * Solvencia de los afiliados dados (todos los afiliados oficiales activos si no se pasan ids),
 * con tres consultas en total —no una por afiliado— para que sirva igual al panel y al cron.
 */
export async function calcularSolvencias(ids?: number[]) {
  const filtro = ids ? `AND a.id_afiliado IN (${ids.map(() => '?').join(',') || 'NULL'})` : `AND a.estatus = 'Afiliado' AND a.activo = 1`
  const filtroPagos = ids ? `AND id_afiliado IN (${ids.map(() => '?').join(',') || 'NULL'})` : ''
  const [config, monto, afs, pagos, hist] = await Promise.all([
    getConfigSolvencia(),
    getMontoMensual(),
    db.execute({ sql: `SELECT a.id_afiliado, a.fecha_afiliacion FROM afiliados a WHERE a.eliminado_en IS NULL ${filtro}`, args: ids ?? [] }),
    db.execute({ sql: `${PAGOS_SQL} ${filtroPagos}`, args: ids ?? [] }),
    db.execute({ sql: `${HISTORIAL_SQL} ${ids ? `WHERE id_afiliado IN (${ids.map(() => '?').join(',') || 'NULL'})` : ''}`, args: ids ?? [] }),
  ])
  const porAfiliado = new Map<number, PagoCubierto[]>()
  for (const p of pagos.rows as any[]) porAfiliado.set(p.id_afiliado, [...(porAfiliado.get(p.id_afiliado) ?? []), p])
  const histPorAfiliado = new Map<number, HistorialMes[]>()
  for (const h of hist.rows as any[]) histPorAfiliado.set(h.id_afiliado, [...(histPorAfiliado.get(h.id_afiliado) ?? []), h])

  const hoy = hoyCaracas()
  const solvencias = new Map<number, SolvenciaAfiliado>()
  for (const a of afs.rows as any[]) {
    const historial = histPorAfiliado.get(a.id_afiliado) ?? []
    const meses = calcularMeses(desdeAfiliado(config.inicio, a.fecha_afiliacion, historial), hoy.slice(0, 7), porAfiliado.get(a.id_afiliado) ?? [], historial)
    solvencias.set(a.id_afiliado, { id_afiliado: a.id_afiliado, meses, ...resumenDeuda(meses, hoy, monto, config.cobranza) })
  }
  return { ...config, hoy, montoMensual: monto, solvencias }
}
