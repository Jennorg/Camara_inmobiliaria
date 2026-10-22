import { db } from '../lib/db.js'
import { CONCEPTOS_REPORTE, ETIQUETA_CATEGORIA_EGRESO, ETIQUETA_CONCEPTO, conceptoReporte, tramoAntiguedad } from '../lib/conceptos.js'
import { sqlOcupaCupo } from '../lib/cursos-pago.js'
import { calcularSolvencias } from './cobranza.service.js'
import { cuotasImportadasPorPeriodo } from './cuotas-importadas.service.js'

const redondear = (n: number) => Math.round(n * 100) / 100

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
  const importadas = await cuotasImportadasPorPeriodo(anio)
  for (const [periodo, n] of importadas.porPeriodo) matriz.get('mensualidad')![Number(periodo.slice(5, 7)) - 1] += n * importadas.monto
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
// Egresos por concepto (mes × categoría)
// ─────────────────────────────────────────────────────────────────────────────

/** Matriz de egresos del año por categoría y mes, con el mismo criterio que el Libro de compras (sin anulados ni eliminados). */
export async function egresosPorConcepto(anio: number) {
  const r = await db.execute({
    sql: `SELECT CAST(substr(fecha, 6, 2) AS INTEGER) AS mes, categoria, SUM(monto_usd_equivalente) AS total
          FROM movimientos_financieros
          WHERE tipo = 'egreso' AND estatus != 'anulado' AND eliminado_en IS NULL AND fecha LIKE ?
          GROUP BY 1, 2`,
    args: [`${anio}%`],
  })
  const matriz = new Map<string, number[]>()
  for (const f of r.rows as any[]) {
    const meses = matriz.get(String(f.categoria)) ?? Array<number>(12).fill(0)
    meses[f.mes - 1] += Number(f.total)
    matriz.set(String(f.categoria), meses)
  }
  const conceptos = [...matriz.entries()]
    .map(([categoria, m]) => {
      const meses = m.map(redondear)
      return { concepto: categoria, etiqueta: ETIQUETA_CATEGORIA_EGRESO[categoria] ?? categoria, meses, total: redondear(meses.reduce((a, b) => a + b, 0)) }
    })
    .sort((a, b) => b.total - a.total)
  const totalesMes = Array.from({ length: 12 }, (_, i) => redondear(conceptos.reduce((a, c) => a + c.meses[i], 0)))
  return { anio, conceptos, totalesMes, total: redondear(totalesMes.reduce((a, b) => a + b, 0)) }
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
