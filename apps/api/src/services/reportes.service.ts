import { db } from '../lib/db.js'
import { CONCEPTOS_REPORTE, ETIQUETA_CONCEPTO, conceptoReporte, tramoAntiguedad } from '../lib/conceptos.js'
import { sqlOcupaCupo } from '../lib/cursos-pago.js'
import { calcularSolvencias, hoyCaracas } from './cobranza.service.js'

const redondear = (n: number) => Math.round(n * 100) / 100
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/

/** Error con código HTTP para que el controller lo traduzca. */
const fallo = (status: number, message: string) => Object.assign(new Error(message), { status })

// ─────────────────────────────────────────────────────────────────────────────
// Ingresos por concepto (mes × concepto)
// ─────────────────────────────────────────────────────────────────────────────

/** Matriz de ingresos verificados del año por concepto y mes, con el mismo criterio de fecha que el libro de ventas. */
export async function ingresosPorConcepto(anio: number) {
  const [pagos, manuales] = await Promise.all([
    db.execute({
      sql: `SELECT CAST(substr(fecha_pago, 6, 2) AS INTEGER) AS mes, tipo_concepto, codigo_arancel, SUM(monto_usd_equivalente) AS total
            FROM pagos
            WHERE estatus = 'Verificado' AND eliminado_en IS NULL AND fecha_pago LIKE ?
            GROUP BY 1, 2, 3`,
      args: [`${anio}%`],
    }),
    db.execute({
      sql: `SELECT CAST(substr(fecha, 6, 2) AS INTEGER) AS mes, SUM(monto_usd_equivalente) AS total
            FROM movimientos_financieros
            WHERE tipo = 'ingreso' AND estatus != 'anulado' AND id_pago IS NULL AND eliminado_en IS NULL AND fecha LIKE ?
            GROUP BY 1`,
      args: [`${anio}%`],
    }),
  ])
  const matriz = new Map(CONCEPTOS_REPORTE.map(c => [c, Array<number>(12).fill(0)]))
  for (const r of pagos.rows as any[]) matriz.get(conceptoReporte(r.tipo_concepto, r.codigo_arancel))![r.mes - 1] += Number(r.total)
  for (const r of manuales.rows as any[]) matriz.get('otros')![r.mes - 1] += Number(r.total)

  const conceptos = CONCEPTOS_REPORTE.map(c => {
    const meses = matriz.get(c)!.map(redondear)
    return { concepto: c, etiqueta: ETIQUETA_CONCEPTO[c], meses, total: redondear(meses.reduce((a, b) => a + b, 0)) }
  })
  const totalesMes = Array.from({ length: 12 }, (_, i) => redondear(conceptos.reduce((a, c) => a + c.meses[i], 0)))
  return { anio, conceptos, totalesMes, total: redondear(totalesMes.reduce((a, b) => a + b, 0)) }
}

// ─────────────────────────────────────────────────────────────────────────────
// Cierre de caja diario
// ─────────────────────────────────────────────────────────────────────────────

interface TotalesCaja {
  porMetodo: { metodo_pago: string; moneda: string; cantidad: number; monto: number; monto_usd: number }[]
  porCajero: { cajero: string; cantidad: number; monto_usd: number }[]
  totalUsd: number
  cantidad: number
  /** Documentos incluidos (P<id_pago> / M<id_movimiento>): detecta cambios aunque el total coincida */
  documentos: string[]
}

/** Cobros verificados (por día local de Caracas) e ingresos manuales del día, por método/moneda y por cajero. */
async function totalesDelDia(fecha: string): Promise<TotalesCaja> {
  const r = await db.execute({
    sql: `SELECT metodo_pago, moneda, cajero, COUNT(*) AS cantidad, SUM(monto) AS monto, SUM(monto_usd) AS monto_usd,
                 GROUP_CONCAT(doc) AS docs FROM (
            SELECT 'P' || p.id_pago AS doc, p.metodo_pago, p.moneda, COALESCE(u.email, 'sin registrar') AS cajero, p.monto, p.monto_usd_equivalente AS monto_usd
            FROM pagos p LEFT JOIN users u ON u.id = p.registrado_por
            WHERE p.estatus = 'Verificado' AND p.eliminado_en IS NULL AND date(p.fecha_pago, '-4 hours') = ?
            UNION ALL
            SELECT 'M' || m.id_movimiento, COALESCE(m.metodo_pago, 'otro'), COALESCE(m.moneda, 'USD'), COALESCE(u.email, 'sin registrar'), m.monto_total, m.monto_usd_equivalente
            FROM movimientos_financieros m LEFT JOIN users u ON u.id = m.registrado_por
            WHERE m.tipo = 'ingreso' AND m.estatus != 'anulado' AND m.id_pago IS NULL AND m.eliminado_en IS NULL AND substr(m.fecha, 1, 10) = ?
          )
          GROUP BY metodo_pago, moneda, cajero`,
    args: [fecha, fecha],
  })
  const porMetodo = new Map<string, TotalesCaja['porMetodo'][number]>()
  const porCajero = new Map<string, TotalesCaja['porCajero'][number]>()
  const documentos: string[] = []
  for (const f of r.rows as any[]) {
    documentos.push(...String(f.docs ?? '').split(',').filter(Boolean))
    const km = `${f.metodo_pago}|${f.moneda}`
    const m = porMetodo.get(km) ?? { metodo_pago: f.metodo_pago, moneda: f.moneda, cantidad: 0, monto: 0, monto_usd: 0 }
    m.cantidad += Number(f.cantidad); m.monto = redondear(m.monto + Number(f.monto)); m.monto_usd = redondear(m.monto_usd + Number(f.monto_usd))
    porMetodo.set(km, m)
    const c = porCajero.get(f.cajero) ?? { cajero: f.cajero, cantidad: 0, monto_usd: 0 }
    c.cantidad += Number(f.cantidad); c.monto_usd = redondear(c.monto_usd + Number(f.monto_usd))
    porCajero.set(f.cajero, c)
  }
  const metodos = [...porMetodo.values()]
  return {
    porMetodo: metodos,
    porCajero: [...porCajero.values()],
    totalUsd: redondear(metodos.reduce((a, m) => a + m.monto_usd, 0)),
    cantidad: metodos.reduce((a, m) => a + m.cantidad, 0),
    documentos: documentos.sort(),
  }
}

let tablaCierresLista = false
async function asegurarTablaCierres() {
  if (tablaCierresLista) return
  await db.execute(`CREATE TABLE IF NOT EXISTS cierres_caja (
    id_cierre     INTEGER PRIMARY KEY,
    fecha         TEXT    NOT NULL UNIQUE,
    id_user       INTEGER REFERENCES users(id),
    totales_json  TEXT    NOT NULL,
    observaciones TEXT,
    creado_en     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  )`)
  tablaCierresLista = true
}

function validarFecha(fecha: string) {
  if (!FECHA_RE.test(fecha) || Number.isNaN(Date.parse(fecha))) throw fallo(400, 'fecha debe tener el formato AAAA-MM-DD')
  if (fecha > hoyCaracas()) throw fallo(400, 'No se puede consultar ni cerrar un día futuro')
}

/**
 * Totales del día y, si ya se cerró, la foto guardada al cerrar. `cambiosTrasCierre` señala que algo
 * se anuló o registró en ese día después del cierre (los totales actuales ya no cuadran con la foto).
 */
export async function getCierreCaja(fecha: string) {
  validarFecha(fecha)
  await asegurarTablaCierres()
  const [actual, c] = await Promise.all([
    totalesDelDia(fecha),
    db.execute({ sql: `SELECT c.*, u.email AS cerrado_por FROM cierres_caja c LEFT JOIN users u ON u.id = c.id_user WHERE fecha = ?`, args: [fecha] }),
  ])
  const fila = c.rows[0] as any
  const cierre = fila ? { ...fila, totales: JSON.parse(fila.totales_json) as TotalesCaja, totales_json: undefined } : null
  const cambiosTrasCierre = !!cierre && (
    Math.abs(cierre.totales.totalUsd - actual.totalUsd) > 0.005 ||
    (cierre.totales.documentos ?? []).join(',') !== actual.documentos.join(',')
  )
  return { fecha, ...actual, cierre, cambiosTrasCierre }
}

/** Congela los totales del día. Un día solo se cierra una vez. */
export async function cerrarCaja(fecha: string, idUser: number, observaciones: string | null) {
  validarFecha(fecha)
  await asegurarTablaCierres()
  const totales = await totalesDelDia(fecha)
  const r = await db.execute({
    sql: `INSERT OR IGNORE INTO cierres_caja (fecha, id_user, totales_json, observaciones) VALUES (?, ?, ?, ?)`,
    args: [fecha, idUser, JSON.stringify(totales), observaciones?.trim() || null],
  })
  if (!r.rowsAffected) throw fallo(409, `La caja del ${fecha} ya fue cerrada`)
  return getCierreCaja(fecha)
}

// ─────────────────────────────────────────────────────────────────────────────
// Cuentas por cobrar
// ─────────────────────────────────────────────────────────────────────────────

const diasEntre = (desde: string, hasta: string) => Math.max(0, Math.floor((Date.parse(hasta) - Date.parse(desde)) / 86_400_000))

/** Mensualidades vencidas de los afiliados y cursos con cupo ocupado sin pago verificado, por antigüedad. */
export async function cuentasPorCobrar() {
  const { cobranza, hoy, solvencias } = await calcularSolvencias()
  const morosos = [...solvencias.values()].filter(s => s.mesesDeuda > 0)

  const [contactos, cursos] = await Promise.all([
    morosos.length
      ? db.execute({
          sql: `SELECT a.id_afiliado, a.codigo,
                       COALESCE(NULLIF(TRIM(COALESCE(p.nombres, '') || ' ' || COALESCE(p.apellidos, '')), ''), e.razon_social) AS nombre,
                       COALESCE(p.cedula, e.rif_numero) AS identificacion, COALESCE(p.email, e.email) AS email
                FROM afiliados a LEFT JOIN personas p ON p.id = a.id_persona LEFT JOIN empresas e ON e.id_empresa = a.id_empresa
                WHERE a.id_afiliado IN (${morosos.map(() => '?').join(',')})`,
          args: morosos.map(s => s.id_afiliado),
        })
      : Promise.resolve({ rows: [] }),
    db.execute(`SELECT ic.id_inscripcion, ic.fecha_inscripcion, c.titulo,
                       COALESCE(ic.monto_usd, c.precio_publico_usd, 0) AS monto_usd,
                       COALESCE(NULLIF(TRIM(COALESCE(p.nombres, '') || ' ' || COALESCE(p.apellidos, '')), ''), e.razon_social) AS nombre,
                       COALESCE(p.cedula, e.rif_numero) AS identificacion, COALESCE(p.email, e.email) AS email
                FROM inscripciones_cursos ic
                JOIN cursos c ON c.id_curso = ic.id_curso
                JOIN estudiantes est ON est.id_estudiante = ic.id_estudiante
                LEFT JOIN personas p ON p.id = est.id_persona
                LEFT JOIN empresas e ON e.id_empresa = est.id_empresa
                WHERE ic.estatus IN ('Preinscrito', 'Entrevista', 'Inscrito') AND ${sqlOcupaCupo('ic')}
                  AND COALESCE(ic.monto_usd, c.precio_publico_usd, 0) > 0
                  AND NOT EXISTS (SELECT 1 FROM pagos pg WHERE pg.id_inscripcion_curso = ic.id_inscripcion
                                   AND pg.estatus = 'Verificado' AND pg.eliminado_en IS NULL)`),
  ])
  const porId = new Map((contactos.rows as any[]).map(c => [Number(c.id_afiliado), c]))
  const dia = String(cobranza.diaVencimiento).padStart(2, '0')

  const filas = [
    ...morosos.map(s => {
      const c = porId.get(s.id_afiliado) ?? {}
      const dias = diasEntre(`${s.mesMasAntiguo}-${dia}`, hoy)
      return {
        tipo: 'mensualidad' as const, id_afiliado: s.id_afiliado, id_inscripcion: null, codigo: c.codigo ?? null,
        nombre: c.nombre ?? '', identificacion: c.identificacion ?? '', email: c.email ?? '',
        detalle: `${s.mesesDeuda} ${s.mesesDeuda === 1 ? 'mensualidad' : 'mensualidades'} desde ${s.mesMasAntiguo}`,
        monto_usd: s.montoUsd, dias, tramo: tramoAntiguedad(dias),
      }
    }),
    ...(cursos.rows as any[]).map(r => {
      const dias = diasEntre(String(r.fecha_inscripcion).slice(0, 10), hoy)
      return {
        tipo: 'curso' as const, id_afiliado: null, id_inscripcion: Number(r.id_inscripcion), codigo: null,
        nombre: r.nombre ?? '', identificacion: r.identificacion ?? '', email: r.email ?? '',
        detalle: `Curso: ${r.titulo}`, monto_usd: redondear(Number(r.monto_usd)), dias, tramo: tramoAntiguedad(dias),
      }
    }),
  ].sort((a, b) => b.dias - a.dias)

  const tramos = (['0-30', '31-60', '61-90', '90+'] as const).map(t => {
    const del = filas.filter(f => f.tramo === t)
    return { tramo: t, cantidad: del.length, monto_usd: redondear(del.reduce((a, f) => a + f.monto_usd, 0)) }
  })
  return { fecha: hoy, filas, tramos, total_usd: redondear(filas.reduce((a, f) => a + f.monto_usd, 0)) }
}
