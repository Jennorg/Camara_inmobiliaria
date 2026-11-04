import { db } from '../lib/db.js'

/**
 * Los meses "pagado" del listado de solvencia importado (tabla solvencia_historial) no tienen recibo, monto ni
 * fecha de pago. Para que los libros y el dashboard los reflejen se valoran con el arancel de la cuota de
 * sostenimiento vigente CUANDO SE REGISTRARON (columna monto_usd) y se fechan el día 1 del mes que cubren. El monto
 * queda fijo: cambiar el arancel después no reescribe ingresos que ya ocurrieron. Se calculan al consultar: no se
 * escribe nada en `pagos`.
 */
const MONTO_DEFECTO_USD = 5

/** Fecha con la que una cuota importada entra a los libros */
export const fechaCuota = (periodo: string) => `${periodo}-01`

/** Condición SQL de fecha sobre el día 1 del periodo, para reutilizar la de los libros */
export const COLUMNA_FECHA_CUOTA = `(h.periodo || '-01')`

// Un mes ya cubierto por un pago verificado de mensualidad no se cuenta dos veces
const SIN_PAGO_REAL = `NOT EXISTS (
  SELECT 1 FROM pagos pg
  WHERE pg.id_afiliado = h.id_afiliado AND pg.tipo_concepto = 'mensualidad' AND pg.estatus = 'Verificado'
    AND pg.eliminado_en IS NULL AND pg.periodo IS NOT NULL AND pg.periodo <= h.periodo
    AND strftime('%Y-%m', date(pg.periodo || '-01', '+' || (COALESCE(pg.meses_cubiertos, 1) - 1) || ' months')) >= h.periodo
)`

export async function montoCuotaActual(): Promise<number> {
  const r = await db.execute(`SELECT monto_usd FROM aranceles_config WHERE codigo = 'mensualidad_base'`)
  const monto = Number(r.rows[0]?.monto_usd)
  return monto > 0 ? monto : MONTO_DEFECTO_USD
}

let montoFijado: Promise<void> | null = null

/**
 * Garantiza la columna monto_usd de solvencia_historial y fija en las cuotas pagadas que no la tienen el arancel
 * vigente (las bases anteriores a este cambio). Idempotente; con `forzar` se repite (antes de cambiar el arancel).
 */
export function fijarMontoCuotas(forzar = false): Promise<void> {
  if (forzar) montoFijado = null
  return (montoFijado ??= (async () => {
    const cols = (await db.execute(`SELECT name FROM pragma_table_info('solvencia_historial')`)).rows.map(r => String(r.name))
    if (!cols.includes('monto_usd')) await db.execute(`ALTER TABLE solvencia_historial ADD COLUMN monto_usd REAL`)
    await db.execute({
      sql: `UPDATE solvencia_historial SET monto_usd = ? WHERE estado = 'pagado' AND monto_usd IS NULL`,
      args: [await montoCuotaActual()],
    })
  })().catch(e => { montoFijado = null; throw e }))
}

export interface CuotaImportada {
  id_afiliado: number
  codigo: string | null
  nombre: string
  identificacion: string
  periodo: string
  fuente: string | null
  importado_en: string
  monto_usd: number
}

/** Cuotas pagadas del listado importado dentro de la condición de fecha dada (sobre COLUMNA_FECHA_CUOTA). */
export async function cuotasImportadas(cond: { sql: string; args: any[] }): Promise<CuotaImportada[]> {
  await fijarMontoCuotas()
  const r = await
    db.execute({
      sql: `SELECT h.id_afiliado, h.periodo, h.fuente, h.importado_en, h.monto_usd, a.codigo,
                   CASE WHEN a.tipo_afiliado = 'Corporativo'
                        THEN COALESCE(NULLIF(TRIM(e.razon_social), ''), TRIM(COALESCE(p.nombres, '') || ' ' || COALESCE(p.apellidos, '')))
                        ELSE TRIM(COALESCE(p.nombres, '') || ' ' || COALESCE(p.apellidos, '')) END AS nombre,
                   COALESCE(p.cedula_tipo || '-' || p.cedula, e.rif_tipo || '-' || e.rif_numero, '') AS identificacion
            FROM solvencia_historial h
            JOIN afiliados a ON a.id_afiliado = h.id_afiliado
            LEFT JOIN personas p ON p.id = a.id_persona
            LEFT JOIN empresas e ON e.id_empresa = a.id_empresa
            WHERE h.estado = 'pagado' AND a.eliminado_en IS NULL AND ${SIN_PAGO_REAL} AND ${cond.sql}
            ORDER BY h.periodo DESC, nombre`,
      args: cond.args,
    })
  return (r.rows as any[]).map(f => ({
    id_afiliado: Number(f.id_afiliado),
    codigo: f.codigo ? String(f.codigo) : null,
    nombre: String(f.nombre || 'Afiliado'),
    identificacion: String(f.identificacion),
    periodo: String(f.periodo),
    fuente: f.fuente ? String(f.fuente) : null,
    importado_en: String(f.importado_en),
    monto_usd: Number(f.monto_usd),
  }))
}

/** Cantidad y valor de las cuotas importadas por periodo (AAAA-MM) de un año, para los totales mensuales. */
export async function cuotasImportadasPorPeriodo(anio: number): Promise<Map<string, { n: number; total: number }>> {
  await fijarMontoCuotas()
  const r = await
    db.execute({
      sql: `SELECT h.periodo, COUNT(*) AS n, COALESCE(SUM(h.monto_usd), 0) AS total
            FROM solvencia_historial h JOIN afiliados a ON a.id_afiliado = h.id_afiliado
            WHERE h.estado = 'pagado' AND a.eliminado_en IS NULL AND ${SIN_PAGO_REAL} AND h.periodo LIKE ?
            GROUP BY h.periodo`,
      args: [`${anio}-%`],
    })
  return new Map((r.rows as any[]).map(f => [String(f.periodo), { n: Number(f.n), total: Number(f.total) }]))
}

/** Cantidad y valor de las cuotas importadas dentro de la condición de fecha, sin traer las filas. */
export async function resumenCuotasImportadas(cond: { sql: string; args: any[] }): Promise<{ cantidad: number; total_usd: number }> {
  await fijarMontoCuotas()
  const r = await
    db.execute({
      sql: `SELECT COUNT(*) AS n, COALESCE(SUM(h.monto_usd), 0) AS total
            FROM solvencia_historial h JOIN afiliados a ON a.id_afiliado = h.id_afiliado
            WHERE h.estado = 'pagado' AND a.eliminado_en IS NULL AND ${SIN_PAGO_REAL} AND ${cond.sql}`,
      args: cond.args,
    })
  return { cantidad: Number(r.rows[0]?.n ?? 0), total_usd: Number(r.rows[0]?.total ?? 0) }
}
