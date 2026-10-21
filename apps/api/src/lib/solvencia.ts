export type EstadoMes = 'pagado' | 'en_revision' | 'deuda' | 'por_pagar' | 'adelantado'

export interface PagoCubierto {
  id_pago: number
  numero_recibo: string
  estatus: string
  periodo: string | null
  meses_cubiertos: number | null
  monto_usd_equivalente: number
  fecha_pago: string
}

/** Mes ya conocido de un registro histórico importado (sin recibo). `no_afiliado` = aún no era afiliado. */
export interface HistorialMes {
  periodo: string
  estado: 'pagado' | 'no_afiliado'
}

export interface MesSolvencia {
  periodo: string
  estado: EstadoMes
  pago: PagoCubierto | null
  /** El pago viene de un historial importado y no tiene recibo */
  historico?: boolean
}

export const sumarMeses = (ym: string, n: number): string => {
  const [y, m] = ym.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7)
}

/**
 * Un mes por fila desde `desde` hasta el mes actual (o el último mes pagado por adelantado).
 * Pagado = pago Verificado que lo cubre; en revisión = solo hay un pago Pendiente;
 * el mes en curso aún no es deuda; los meses anteriores sin pago sí. Un pago real (con recibo)
 * prevalece sobre el historial; los meses `no_afiliado` del historial no se muestran.
 */
export function calcularMeses(desde: string, hoy: string, pagos: PagoCubierto[], historial: HistorialMes[] = []): MesSolvencia[] {
  const noAfiliado = new Set(historial.filter(h => h.estado === 'no_afiliado').map(h => h.periodo))
  const historicos = new Set(historial.filter(h => h.estado === 'pagado').map(h => h.periodo))
  const porMes = new Map<string, PagoCubierto>()
  for (const p of pagos) {
    if (!p.periodo || (p.estatus !== 'Verificado' && p.estatus !== 'Pendiente')) continue
    for (let i = 0; i < Math.max(1, p.meses_cubiertos || 1); i++) {
      const mes = sumarMeses(p.periodo, i)
      const previo = porMes.get(mes)
      if (!previo || (previo.estatus === 'Pendiente' && p.estatus === 'Verificado')) porMes.set(mes, p)
    }
  }
  const ultimo = [...porMes.keys(), ...historicos].reduce((a, b) => (b > a ? b : a), hoy)
  const meses: MesSolvencia[] = []
  for (let m = desde; m <= ultimo; m = sumarMeses(m, 1)) {
    if (noAfiliado.has(m)) continue
    const pago = porMes.get(m) ?? null
    if (!pago && historicos.has(m)) {
      meses.push({ periodo: m, estado: m > hoy ? 'adelantado' : 'pagado', pago: null, historico: true })
      continue
    }
    let estado: EstadoMes
    if (pago) estado = pago.estatus === 'Verificado' ? (m > hoy ? 'adelantado' : 'pagado') : 'en_revision'
    else estado = m < hoy ? 'deuda' : 'por_pagar'
    meses.push({ periodo: m, estado, pago })
  }
  return meses
}

export interface ConfigCobranza {
  /** Día del mes (1-28) en que vence la mensualidad del mes */
  diaVencimiento: number
  /** Días antes del vencimiento en que sale el recordatorio */
  diasAvisoPrevio: number
  /** Cada cuántos días se repite el aviso de mora */
  frecuenciaMoraDias: number
  /** Meses de deuda tolerados antes de bloquear carnet, constancia y certificados */
  mesesGracia: number
}

export const CONFIG_COBRANZA_DEFECTO: ConfigCobranza = { diaVencimiento: 5, diasAvisoPrevio: 3, frecuenciaMoraDias: 7, mesesGracia: 2 }

export interface ResumenDeuda {
  mesesDeuda: number
  montoUsd: number
  /** Mes impago más antiguo (YYYY-MM) o null si está al día */
  mesMasAntiguo: string | null
  /** Meses vencidos sin pago verificado (incluye los reportados en revisión) */
  mesesSinVerificar: number
  bloqueado: boolean
}

/**
 * Deuda vencida a la fecha `hoy` (YYYY-MM-DD): los meses anteriores sin pagar y, pasado el día de
 * vencimiento, también el mes en curso. Un pago reportado (en revisión) deja de contar como deuda,
 * pero el bloqueo solo se levanta cuando Finanzas lo verifica: bloquea si los meses vencidos sin
 * pago verificado superan los meses de gracia.
 */
export function resumenDeuda(meses: MesSolvencia[], hoy: string, montoMensual: number, cfg: ConfigCobranza): ResumenDeuda {
  const mesHoy = hoy.slice(0, 7)
  const vencioMesActual = Number(hoy.slice(8, 10)) > cfg.diaVencimiento
  const vencido = (m: MesSolvencia) => m.periodo < mesHoy || (m.periodo === mesHoy && vencioMesActual)
  const impagos = meses.filter(m => vencido(m) && (m.estado === 'deuda' || m.estado === 'por_pagar'))
  const sinVerificar = meses.filter(m => vencido(m) && (m.estado === 'deuda' || m.estado === 'por_pagar' || m.estado === 'en_revision'))
  return {
    mesesDeuda: impagos.length,
    montoUsd: impagos.length * montoMensual,
    mesMasAntiguo: impagos[0]?.periodo ?? null,
    mesesSinVerificar: sinVerificar.length,
    bloqueado: sinVerificar.length > cfg.mesesGracia,
  }
}

export type TipoAviso = 'previo' | 'vencimiento' | 'mora'

/**
 * Qué aviso de cobranza le toca hoy (YYYY-MM-DD) a un afiliado, o null.
 * Con deuda vencida: aviso de mora, repetido cada `frecuenciaMoraDias` desde el último (`ultimaMora`).
 * Al día pero con el mes en curso sin pagar: aviso el día del vencimiento y `diasAvisoPrevio` días antes.
 */
export function avisoDelDia(hoy: string, cfg: ConfigCobranza, estadoMesActual: EstadoMes | undefined, mesesDeuda: number, ultimaMora: string | null): TipoAviso | null {
  if (mesesDeuda > 0) {
    if (!ultimaMora) return 'mora'
    const dias = (Date.parse(hoy) - Date.parse(ultimaMora)) / 86_400_000
    return dias >= cfg.frecuenciaMoraDias ? 'mora' : null
  }
  if (estadoMesActual !== 'por_pagar') return null
  const dia = Number(hoy.slice(8, 10))
  if (dia === cfg.diaVencimiento) return 'vencimiento'
  if (cfg.diasAvisoPrevio > 0 && dia === cfg.diaVencimiento - cfg.diasAvisoPrevio) return 'previo'
  return null
}
