import { db } from '../lib/db.js'
import { enviarCorreosLote, type CorreoSimple } from '../lib/email.js'
import { env } from '../config/env.js'
import {
  avisoDelDia,
  calcularMeses,
  resumenDeuda,
  CONFIG_COBRANZA_DEFECTO,
  type ConfigCobranza,
  type HistorialMes,
  type MesSolvencia,
  type PagoCubierto,
  type ResumenDeuda,
  type TipoAviso,
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

// ─────────────────────────────────────────────────────────────────────────────
// Avisos de cobranza (cron diario y recordatorio manual)
// ─────────────────────────────────────────────────────────────────────────────

let tablaAvisosLista = false
/** Registro de avisos enviados: el UNIQUE por día evita duplicados si el cron se reintenta. */
async function asegurarTablaAvisos() {
  if (tablaAvisosLista) return
  await db.execute(`CREATE TABLE IF NOT EXISTS avisos_cobranza (
    id_aviso     INTEGER PRIMARY KEY,
    id_afiliado  INTEGER NOT NULL REFERENCES afiliados(id_afiliado) ON DELETE CASCADE,
    tipo         TEXT    NOT NULL CHECK (tipo IN ('previo', 'vencimiento', 'mora', 'manual')),
    periodo      TEXT    NOT NULL,
    fecha_dia    TEXT    NOT NULL,
    enviado_en   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    UNIQUE (id_afiliado, tipo, fecha_dia)
  )`)
  tablaAvisosLista = true
}

type TipoAvisoEnvio = TipoAviso | 'manual'

interface Contacto { id_afiliado: number; id_user: number | null; email: string | null; nombre: string }

const nombreMes = (ym: string) =>
  new Date(`${ym}-15T12:00:00Z`).toLocaleDateString('es-VE', { month: 'long', year: 'numeric', timeZone: 'UTC' })

function textoAviso(tipo: TipoAvisoEnvio, s: SolvenciaAfiliado, cfg: ConfigCobranza, monto: number, mesHoy: string) {
  const usd = (n: number) => `$${n.toFixed(2)}`
  const enlace = `${env.APP_URL.replace(/\/$/, '')}/panel`
  if (tipo === 'previo' || tipo === 'vencimiento') {
    const cuando = tipo === 'previo' ? `vence el día ${cfg.diaVencimiento}` : 'vence hoy'
    return {
      titulo: tipo === 'previo' ? 'Recordatorio de mensualidad' : 'Tu mensualidad vence hoy',
      mensaje: `Tu mensualidad de ${nombreMes(mesHoy)} (${usd(monto)}) ${cuando}. Puedes reportar tu pago desde "Estado de Cuenta" en tu panel: ${enlace}`,
    }
  }
  const bloqueo = s.bloqueado
    ? 'Tu carnet, constancia de solvencia y certificados están bloqueados hasta que se verifique el pago.'
    : `Si la deuda supera ${cfg.mesesGracia} ${cfg.mesesGracia === 1 ? 'mes' : 'meses'}, se bloquearán tu carnet, constancia de solvencia y certificados.`
  return {
    titulo: 'Tienes mensualidades pendientes',
    mensaje: `Tienes ${s.mesesDeuda} ${s.mesesDeuda === 1 ? 'mensualidad pendiente' : 'mensualidades pendientes'} desde ${nombreMes(s.mesMasAntiguo!)} por ${usd(s.montoUsd)}. ${bloqueo} Reporta tu pago desde "Estado de Cuenta" en tu panel: ${enlace}`,
  }
}

async function contactosAfiliados(ids: number[]): Promise<Map<number, Contacto>> {
  if (!ids.length) return new Map()
  const r = await db.execute({
    sql: `SELECT a.id_afiliado, a.id_user, COALESCE(NULLIF(TRIM(p.email), ''), e.email) AS email,
                 COALESCE(NULLIF(TRIM(COALESCE(p.nombres, '') || ' ' || COALESCE(p.apellidos, '')), ''), e.razon_social) AS nombre
          FROM afiliados a
          LEFT JOIN personas p ON a.id_persona = p.id
          LEFT JOIN empresas e ON a.id_empresa = e.id_empresa
          WHERE a.id_afiliado IN (${ids.map(() => '?').join(',')})`,
    args: ids,
  })
  return new Map(r.rows.map((row: any) => [Number(row.id_afiliado), row as Contacto]))
}

/**
 * Registra y envía los avisos. Cada aviso se inserta ANTES de enviarse (INSERT OR IGNORE sobre el
 * UNIQUE diario): si el proceso se corta o se reintenta, no se repite lo ya registrado.
 */
async function enviarAvisos(lista: { s: SolvenciaAfiliado; tipo: TipoAvisoEnvio }[], cfg: ConfigCobranza, monto: number, hoy: string) {
  await asegurarTablaAvisos()
  const contactos = await contactosAfiliados(lista.map(l => l.s.id_afiliado))
  const inApp: { sql: string; args: any[] }[] = []
  const correos: CorreoSimple[] = []
  let registrados = 0
  for (const { s, tipo } of lista) {
    const reg = await db.execute({
      sql: `INSERT OR IGNORE INTO avisos_cobranza (id_afiliado, tipo, periodo, fecha_dia) VALUES (?, ?, ?, ?)`,
      args: [s.id_afiliado, tipo, hoy.slice(0, 7), hoy],
    })
    if (!reg.rowsAffected) continue
    registrados++
    const c = contactos.get(s.id_afiliado)
    const { titulo, mensaje } = textoAviso(tipo, s, cfg, monto, hoy.slice(0, 7))
    if (c?.id_user) {
      inApp.push({
        sql: `INSERT INTO notificaciones (id_user, tipo, prioridad, titulo, mensaje, data_json) VALUES (?, 'COBRANZA', ?, ?, ?, ?)`,
        args: [c.id_user, tipo === 'mora' || tipo === 'manual' ? 'ALTA' : 'NORMAL', titulo, mensaje, JSON.stringify({ id_afiliado: s.id_afiliado, tipo, meses_deuda: s.mesesDeuda })],
      })
    }
    if (c?.email) correos.push({ to: c.email, subject: titulo, titulo, parrafos: [`Hola, ${c.nombre}.`, mensaje] })
  }
  if (inApp.length) await db.batch(inApp, 'write')
  const emails = await enviarCorreosLote(correos)
  return { registrados, inApp: inApp.length, emails }
}

/** Cancela las reservas de curso vencidas sin pago por verificar y avisa por correo a cada persona. */
export async function expirarReservasVencidas() {
  const r = await db.execute(`
    UPDATE inscripciones_cursos
    SET estatus = 'Cancelado',
        nota_admin = COALESCE(nota_admin || ' · ', '') || 'Reserva vencida sin pago',
        actualizado_en = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
    WHERE estatus = 'Preinscrito'
      AND reserva_vence_en IS NOT NULL AND reserva_vence_en <= strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
      AND NOT EXISTS (SELECT 1 FROM pagos pg WHERE pg.id_inscripcion_curso = inscripciones_cursos.id_inscripcion
                      AND pg.estatus = 'Pendiente' AND pg.eliminado_en IS NULL)
    RETURNING id_inscripcion`)
  const ids = r.rows.map(row => Number(row.id_inscripcion))
  if (!ids.length) return { canceladas: 0, emails: 0 }
  const datos = await db.execute({
    sql: `SELECT c.titulo, COALESCE(NULLIF(TRIM(p.email), ''), e.email) AS email,
                 COALESCE(NULLIF(TRIM(COALESCE(p.nombres, '') || ' ' || COALESCE(p.apellidos, '')), ''), e.razon_social) AS nombre
          FROM inscripciones_cursos ic
          JOIN cursos c ON c.id_curso = ic.id_curso
          JOIN estudiantes est ON est.id_estudiante = ic.id_estudiante
          LEFT JOIN personas p ON p.id = est.id_persona
          LEFT JOIN empresas e ON e.id_empresa = est.id_empresa
          WHERE ic.id_inscripcion IN (${ids.map(() => '?').join(',')})`,
    args: ids,
  })
  const emails = await enviarCorreosLote((datos.rows as any[]).map(d => ({
    to: d.email,
    subject: `Tu reserva en "${d.titulo}" venció`,
    titulo: 'Reserva vencida',
    parrafos: [
      `Hola, ${d.nombre}.`,
      `La reserva de tu cupo en "${d.titulo}" venció sin un pago registrado, así que el cupo quedó liberado.`,
      'Si aún te interesa, puedes volver a preinscribirte mientras queden cupos disponibles.',
    ],
  })))
  return { canceladas: ids.length, emails }
}

/** Job diario (Vercel Cron): avisos de mensualidad y expiración de reservas de curso. */
export async function ejecutarCobranzaDiaria() {
  await asegurarTablaAvisos()
  const { cobranza, hoy, montoMensual, solvencias } = await calcularSolvencias()
  const ultimas = await db.execute(`SELECT id_afiliado, MAX(fecha_dia) AS ultima FROM avisos_cobranza WHERE tipo IN ('mora', 'manual') GROUP BY id_afiliado`)
  const ultimaMora = new Map(ultimas.rows.map(row => [Number(row.id_afiliado), String(row.ultima)]))
  const mesHoy = hoy.slice(0, 7)

  const lista: { s: SolvenciaAfiliado; tipo: TipoAvisoEnvio }[] = []
  for (const s of solvencias.values()) {
    const estadoMesActual = s.meses.find(m => m.periodo === mesHoy)?.estado
    const tipo = avisoDelDia(hoy, cobranza, estadoMesActual, s.mesesDeuda, ultimaMora.get(s.id_afiliado) ?? null)
    if (tipo) lista.push({ s, tipo })
  }
  const avisos = await enviarAvisos(lista, cobranza, montoMensual, hoy)
  const reservas = await expirarReservasVencidas()
  return { fecha: hoy, afiliados: solvencias.size, avisos, reservas }
}

/** Recordatorio manual desde Finanzas a uno o a todos los morosos (máximo uno por día y afiliado). */
export async function enviarRecordatorioManual(idAfiliado?: number) {
  const { cobranza, hoy, montoMensual, solvencias } = await calcularSolvencias(idAfiliado ? [idAfiliado] : undefined)
  const morosos = [...solvencias.values()].filter(s => s.mesesDeuda > 0).map(s => ({ s, tipo: 'manual' as const }))
  return { morosos: morosos.length, ...(await enviarAvisos(morosos, cobranza, montoMensual, hoy)) }
}
