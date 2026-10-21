import type { Request, Response } from 'express'
import { db } from '../lib/db.js'
import { puedeAccederAfiliado } from '../middlewares/auth.middleware.js'
import { calcularSolvencias, setConfigSolvencia } from '../services/cobranza.service.js'

/** GET /api/pagos/solvencia/afiliado/:idAfiliado — admin, o el propio afiliado */
export const getSolvenciaAfiliado = async (req: Request, res: Response): Promise<void> => {
  try {
    const idAfiliado = Number(req.params.idAfiliado)
    if (!Number.isFinite(idAfiliado)) {
      res.status(400).json({ success: false, message: 'ID de afiliado inválido' })
      return
    }
    const af = await db.execute({
      sql: `SELECT 1 FROM afiliados WHERE id_afiliado = ? AND eliminado_en IS NULL`,
      args: [idAfiliado],
    })
    if (!af.rows.length) {
      res.status(404).json({ success: false, message: 'Afiliado no encontrado' })
      return
    }
    if (!(await puedeAccederAfiliado(req.user!, idAfiliado))) {
      res.status(403).json({ success: false, message: 'No puedes consultar la solvencia de otro afiliado' })
      return
    }

    const { inicio, cobranza, hoy, montoMensual, solvencias } = await calcularSolvencias([idAfiliado])
    const s = solvencias.get(idAfiliado)!
    res.json({
      success: true,
      data: {
        inicio,
        mes_actual: hoy.slice(0, 7),
        monto_mensual: montoMensual,
        dia_vencimiento: cobranza.diaVencimiento,
        meses_gracia: cobranza.mesesGracia,
        solvente: s.mesesDeuda === 0,
        meses_deuda: s.mesesDeuda,
        deuda_usd: s.montoUsd,
        mes_mas_antiguo: s.mesMasAntiguo,
        bloqueado: s.bloqueado,
        meses: s.meses,
      },
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
    const [{ inicio, cobranza, hoy, montoMensual, solvencias }, afs] = await Promise.all([
      calcularSolvencias(),
      db.execute(`SELECT a.id_afiliado, a.codigo,
                         COALESCE(NULLIF(TRIM(COALESCE(p.nombres, '') || ' ' || COALESCE(p.apellidos, '')), ''), e.razon_social) AS nombre,
                         p.nombres, p.apellidos, e.razon_social,
                         p.cedula, e.rif_numero AS rif,
                         COALESCE(p.email, e.email) AS email
                  FROM afiliados a
                  LEFT JOIN personas p ON a.id_persona = p.id
                  LEFT JOIN empresas e ON a.id_empresa = e.id_empresa
                  WHERE a.estatus = 'Afiliado' AND a.activo = 1 AND a.eliminado_en IS NULL
                  ORDER BY nombre`),
    ])
    const data = (afs.rows as any[]).flatMap(a => {
      const s = solvencias.get(a.id_afiliado)
      if (!s) return []
      // Estado de cada mes del año pedido (null = sin dato: antes de afiliarse o fuera del seguimiento)
      const celdas = Array.from({ length: 12 }, (_, i) => s.meses.find(m => m.periodo === `${anio}-${String(i + 1).padStart(2, '0')}`)?.estado ?? null)
      return [{
        id_afiliado: a.id_afiliado, codigo: a.codigo, nombre: a.nombre, nombres: a.nombres, apellidos: a.apellidos,
        razon_social: a.razon_social, cedula: a.cedula, rif: a.rif, email: a.email,
        solvente: s.mesesDeuda === 0, meses_deuda: s.mesesDeuda, deuda_usd: s.montoUsd, bloqueado: s.bloqueado, celdas,
      }]
    })
    res.json({ success: true, data: { inicio, cobranza, mes_actual: hoy.slice(0, 7), anio, monto_mensual: montoMensual, afiliados: data } })
  } catch (error) {
    console.error('adminResumenSolvencia:', error)
    res.status(500).json({ success: false, message: 'Error al calcular la solvencia' })
  }
}

/** PUT /api/pagos/admin/solvencia/config — { inicio?: 'YYYY-MM', cobranza?: Partial<ConfigCobranza> } */
export const adminSetInicioSolvencia = async (req: Request, res: Response): Promise<void> => {
  try {
    res.json({ success: true, data: await setConfigSolvencia(req.body ?? {}) })
  } catch (error) {
    const msg = (error as Error).message
    if (/formato|entero/.test(msg)) {
      res.status(400).json({ success: false, message: msg })
      return
    }
    console.error('adminSetInicioSolvencia:', error)
    res.status(500).json({ success: false, message: 'No se pudo guardar la configuración' })
  }
}
