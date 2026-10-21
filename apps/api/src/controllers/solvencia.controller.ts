import type { Request, Response } from 'express'
import { db } from '../lib/db.js'
import { calcularMeses, type HistorialMes, type PagoCubierto } from '../lib/solvencia.js'
import { puedeAccederAfiliado } from '../middlewares/auth.middleware.js'

const CLAVE_INICIO = 'solvencia_inicio'
const MES_RE = /^\d{4}-(0[1-9]|1[0-2])$/
const mesActual = () => new Date().toISOString().slice(0, 7)

/** Mes desde el que se cuenta la deuda; sin configurar es el mes actual (nadie debe nada aún). */
async function getInicio(): Promise<string> {
  const r = await db.execute({ sql: `SELECT valor FROM cms_configuracion WHERE clave = ?`, args: [CLAVE_INICIO] })
  const v = r.rows[0]?.valor as string | undefined
  return v && MES_RE.test(v) ? v : mesActual()
}

// shortcut: usa el precio vigente de mensualidad_base para todos los meses, guardar el precio por mes si cambia el arancel
async function getMontoMensual(): Promise<number> {
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

/** GET /api/pagos/solvencia/afiliado/:idAfiliado — admin, o el propio afiliado */
export const getSolvenciaAfiliado = async (req: Request, res: Response): Promise<void> => {
  try {
    const idAfiliado = Number(req.params.idAfiliado)
    if (!Number.isFinite(idAfiliado)) {
      res.status(400).json({ success: false, message: 'ID de afiliado inválido' })
      return
    }
    const af = await db.execute({
      sql: `SELECT id_afiliado, fecha_afiliacion FROM afiliados WHERE id_afiliado = ? AND eliminado_en IS NULL`,
      args: [idAfiliado],
    })
    const afiliado = af.rows[0] as any
    if (!afiliado) {
      res.status(404).json({ success: false, message: 'Afiliado no encontrado' })
      return
    }
    if (!(await puedeAccederAfiliado(req.user!, idAfiliado))) {
      res.status(403).json({ success: false, message: 'No puedes consultar la solvencia de otro afiliado' })
      return
    }

    const [inicio, monto, pagos, hist] = await Promise.all([
      getInicio(),
      getMontoMensual(),
      db.execute({ sql: `${PAGOS_SQL} AND id_afiliado = ?`, args: [idAfiliado] }),
      db.execute({ sql: `${HISTORIAL_SQL} WHERE id_afiliado = ?`, args: [idAfiliado] }),
    ])
    const hoy = mesActual()
    const historial = hist.rows as unknown as HistorialMes[]
    const meses = calcularMeses(desdeAfiliado(inicio, afiliado.fecha_afiliacion, historial), hoy, pagos.rows as unknown as PagoCubierto[], historial)
    const mesesDeuda = meses.filter(m => m.estado === 'deuda').length
    res.json({
      success: true,
      data: { inicio, mes_actual: hoy, monto_mensual: monto, solvente: mesesDeuda === 0, meses_deuda: mesesDeuda, deuda_usd: mesesDeuda * monto, meses },
    })
  } catch (error) {
    console.error('getSolvenciaAfiliado:', error)
    res.status(500).json({ success: false, message: 'Error al calcular la solvencia' })
  }
}

/** GET /api/pagos/admin/solvencia — estado de todos los afiliados activos */
export const adminResumenSolvencia = async (req: Request, res: Response): Promise<void> => {
  try {
    const anio = Number(req.query.anio) || new Date().getFullYear()
    const [inicio, monto, afs, pagos, hist] = await Promise.all([
      getInicio(),
      getMontoMensual(),
      db.execute(`SELECT a.id_afiliado, a.codigo, a.fecha_afiliacion,
                         COALESCE(NULLIF(TRIM(COALESCE(p.nombres, '') || ' ' || COALESCE(p.apellidos, '')), ''), e.razon_social) AS nombre,
                         p.nombres, p.apellidos, e.razon_social,
                         p.cedula, e.rif_numero AS rif,
                         COALESCE(p.email, e.email) AS email
                  FROM afiliados a
                  LEFT JOIN personas p ON a.id_persona = p.id
                  LEFT JOIN empresas e ON a.id_empresa = e.id_empresa
                  WHERE a.estatus = 'Afiliado' AND a.activo = 1 AND a.eliminado_en IS NULL
                  ORDER BY nombre`),
      db.execute(PAGOS_SQL),
      db.execute(HISTORIAL_SQL),
    ])
    const porAfiliado = new Map<number, PagoCubierto[]>()
    for (const p of pagos.rows as any[]) porAfiliado.set(p.id_afiliado, [...(porAfiliado.get(p.id_afiliado) ?? []), p])
    const histPorAfiliado = new Map<number, HistorialMes[]>()
    for (const h of hist.rows as any[]) histPorAfiliado.set(h.id_afiliado, [...(histPorAfiliado.get(h.id_afiliado) ?? []), h])

    const hoy = mesActual()
    const data = (afs.rows as any[]).map(a => {
      const historial = histPorAfiliado.get(a.id_afiliado) ?? []
      const meses = calcularMeses(desdeAfiliado(inicio, a.fecha_afiliacion, historial), hoy, porAfiliado.get(a.id_afiliado) ?? [], historial)
      const mesesDeuda = meses.filter(m => m.estado === 'deuda').length
      // Estado de cada mes del año pedido (null = sin dato: antes de afiliarse o fuera del seguimiento)
      const celdas = Array.from({ length: 12 }, (_, i) => meses.find(m => m.periodo === `${anio}-${String(i + 1).padStart(2, '0')}`)?.estado ?? null)
      return { id_afiliado: a.id_afiliado, codigo: a.codigo, nombre: a.nombre, nombres: a.nombres, apellidos: a.apellidos, razon_social: a.razon_social, cedula: a.cedula, rif: a.rif, email: a.email, solvente: mesesDeuda === 0, meses_deuda: mesesDeuda, deuda_usd: mesesDeuda * monto, celdas }
    })
    res.json({ success: true, data: { inicio, mes_actual: hoy, anio, monto_mensual: monto, afiliados: data } })
  } catch (error) {
    console.error('adminResumenSolvencia:', error)
    res.status(500).json({ success: false, message: 'Error al calcular la solvencia' })
  }
}

/** PUT /api/pagos/admin/solvencia/config — { inicio: 'YYYY-MM' } */
export const adminSetInicioSolvencia = async (req: Request, res: Response): Promise<void> => {
  const inicio = req.body?.inicio
  if (typeof inicio !== 'string' || !MES_RE.test(inicio)) {
    res.status(400).json({ success: false, message: 'inicio debe tener el formato AAAA-MM' })
    return
  }
  try {
    await db.execute({
      sql: `INSERT INTO cms_configuracion (clave, valor, actualizado_en) VALUES (?, ?, ?)
            ON CONFLICT (clave) DO UPDATE SET valor = excluded.valor, actualizado_en = excluded.actualizado_en`,
      args: [CLAVE_INICIO, inicio, new Date().toISOString()],
    })
    res.json({ success: true, data: { inicio } })
  } catch (error) {
    console.error('adminSetInicioSolvencia:', error)
    res.status(500).json({ success: false, message: 'No se pudo guardar el mes de inicio' })
  }
}
