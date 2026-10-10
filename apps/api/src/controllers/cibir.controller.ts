import { Request, Response } from 'express'
import { db } from '../lib/db.js'

/**
 * GET /api/admin/cibir/ediciones
 * Lista todas las ediciones CIBIR con estadísticas de inscritos.
 */
export const listEdiciones = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await db.execute(`
      SELECT 
        e.*,
        COUNT(CASE WHEN i.estatus = 'Preinscrito' THEN 1 END) as total_preinscrito,
        COUNT(CASE WHEN i.estatus = 'Aprobado' THEN 1 END) as total_aprobado,
        COUNT(CASE WHEN i.estatus = 'Rechazado' THEN 1 END) as total_rechazado,
        COUNT(CASE WHEN i.estatus = 'Cancelado' THEN 1 END) as total_cancelado,
        COUNT(CASE WHEN i.estatus <> 'Cancelado' THEN 1 END) as total_activos
      FROM ediciones_cibir e
      LEFT JOIN inscripciones_edicion_cibir i ON i.id_edicion = e.id_edicion
      WHERE e.eliminado_en IS NULL
      GROUP BY e.id_edicion
      ORDER BY e.creado_en DESC
    `)

    res.json({
      success: true,
      data: result.rows
    })
  } catch (error) {
    console.error('listEdiciones error:', error)
    res.status(500).json({ success: false, message: 'Error al listar ediciones CIBIR' })
  }
}

/**
 * POST /api/admin/cibir/ediciones
 * Crea una nueva edición CIBIR.
 * R2: Valida que NO exista otra edición 'Planificada' o 'Abierta'.
 */
export const createEdicion = async (req: Request, res: Response): Promise<void> => {
  try {
    const { nombre, descripcion, fecha_inicio, fecha_fin, cupo_maximo, estado } = req.body

    if (!nombre || !fecha_inicio) {
      res.status(400).json({ success: false, message: 'El nombre y la fecha de inicio son requeridos' })
      return
    }

    const estadoFinal = estado && ['Planificada', 'Abierta'].includes(estado) ? estado : 'Planificada'

    // Regla R2: Solo una edición activa a la vez
    const activas = await db.execute(`
      SELECT id_edicion, nombre, estado 
      FROM ediciones_cibir 
      WHERE estado IN ('Planificada', 'Abierta') AND eliminado_en IS NULL
      LIMIT 1
    `)

    if (activas.rows.length > 0) {
      const act = activas.rows[0] as any
      res.status(409).json({
        success: false,
        message: `Ya existe una edición CIBIR activa ("${act.nombre}" en estado ${act.estado}). Debe cerrarla o finalizarla antes de crear una nueva.`
      })
      return
    }

    const userId = req.user?.id || null
    const cupo = cupo_maximo !== undefined && cupo_maximo !== null && cupo_maximo !== '' ? Number(cupo_maximo) : null

    const ins = await db.execute({
      sql: `INSERT INTO ediciones_cibir (nombre, descripcion, fecha_inicio, fecha_fin, estado, cupo_maximo, creado_por)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            RETURNING *`,
      args: [nombre.trim(), descripcion ? descripcion.trim() : null, fecha_inicio, fecha_fin || null, estadoFinal, cupo, userId]
    })

    const nuevaEdicion = ins.rows[0] as any

    // Si se creó directamente como 'Abierta', auto-asignar a todos los pendientes en 5_CIBIR
    if (estadoFinal === 'Abierta') {
      await autoAsignarPendientesAEdicion(nuevaEdicion.id_edicion, cupo)
    }

    res.status(201).json({
      success: true,
      message: 'Edición CIBIR creada exitosamente',
      data: nuevaEdicion
    })
  } catch (error) {
    console.error('createEdicion error:', error)
    res.status(500).json({ success: false, message: 'Error al crear edición CIBIR' })
  }
}

/**
 * GET /api/admin/cibir/ediciones/:id
 * Detalle de una edición CIBIR.
 */
export const getEdicion = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) {
      res.status(400).json({ success: false, message: 'ID inválido' })
      return
    }

    const edRes = await db.execute({
      sql: `SELECT * FROM ediciones_cibir WHERE id_edicion = ? AND eliminado_en IS NULL`,
      args: [id]
    })

    if (edRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Edición CIBIR no encontrada' })
      return
    }

    res.json({
      success: true,
      data: edRes.rows[0]
    })
  } catch (error) {
    console.error('getEdicion error:', error)
    res.status(500).json({ success: false, message: 'Error al obtener edición CIBIR' })
  }
}

/**
 * PATCH /api/admin/cibir/ediciones/:id
 * Actualiza datos de la edición (nombre, descripción, fechas, cupo).
 */
export const updateEdicion = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) {
      res.status(400).json({ success: false, message: 'ID inválido' })
      return
    }

    const { nombre, descripcion, fecha_inicio, fecha_fin, cupo_maximo } = req.body
    const sets: string[] = []
    const args: any[] = []

    if (nombre !== undefined) {
      sets.push('nombre = ?')
      args.push(String(nombre).trim())
    }
    if (descripcion !== undefined) {
      sets.push('descripcion = ?')
      args.push(descripcion ? String(descripcion).trim() : null)
    }
    if (fecha_inicio !== undefined) {
      sets.push('fecha_inicio = ?')
      args.push(fecha_inicio)
    }
    if (fecha_fin !== undefined) {
      sets.push('fecha_fin = ?')
      args.push(fecha_fin || null)
    }
    if (cupo_maximo !== undefined) {
      sets.push('cupo_maximo = ?')
      args.push(cupo_maximo !== null && cupo_maximo !== '' ? Number(cupo_maximo) : null)
    }

    if (sets.length === 0) {
      res.status(400).json({ success: false, message: 'Nada que actualizar' })
      return
    }

    sets.push('actualizado_en = ?')
    args.push(new Date().toISOString())
    args.push(id)

    const updated = await db.execute({
      sql: `UPDATE ediciones_cibir SET ${sets.join(', ')} WHERE id_edicion = ? AND eliminado_en IS NULL RETURNING *`,
      args
    })

    if (updated.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Edición CIBIR no encontrada' })
      return
    }

    res.json({
      success: true,
      message: 'Edición CIBIR actualizada exitosamente',
      data: updated.rows[0]
    })
  } catch (error) {
    console.error('updateEdicion error:', error)
    res.status(500).json({ success: false, message: 'Error al actualizar edición CIBIR' })
  }
}

/**
 * PATCH /api/admin/cibir/ediciones/:id/estado
 * Cambia el estado de una edición (Planificada, Abierta, Cerrada, Finalizada).
 * Al abrirla, auto-asigna en lote a todos los que estén esperando en 5_CIBIR (R1).
 */
export const cambiarEstadoEdicion = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id)
    const { estado } = req.body

    const allowed = ['Planificada', 'Abierta', 'Cerrada', 'Finalizada']
    if (!estado || !allowed.includes(estado)) {
      res.status(400).json({ success: false, message: 'Estado inválido. Use Planificada, Abierta, Cerrada o Finalizada.' })
      return
    }

    // Regla R2: Si se intenta poner en 'Abierta' o 'Planificada', verificar que no haya OTRA activa distinta a esta
    if (['Planificada', 'Abierta'].includes(estado)) {
      const act = await db.execute({
        sql: `SELECT id_edicion, nombre, estado 
              FROM ediciones_cibir 
              WHERE estado IN ('Planificada', 'Abierta') AND id_edicion <> ? AND eliminado_en IS NULL
              LIMIT 1`,
        args: [id]
      })
      if (act.rows.length > 0) {
        const other = act.rows[0] as any
        res.status(409).json({
          success: false,
          message: `Ya existe otra edición activa ("${other.nombre}" en estado ${other.estado}). Debe cerrarla primero.`
        })
        return
      }
    }

    const now = new Date().toISOString()
    const updated = await db.execute({
      sql: `UPDATE ediciones_cibir 
            SET estado = ?, actualizado_en = ? 
            WHERE id_edicion = ? AND eliminado_en IS NULL 
            RETURNING *`,
      args: [estado, now, id]
    })

    if (updated.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Edición CIBIR no encontrada' })
      return
    }

    const edicion = updated.rows[0] as any

    // Si pasa a 'Abierta', auto-asignar a todos los pendientes que esperan en 5_CIBIR
    let asignadosCount = 0
    if (estado === 'Abierta') {
      asignadosCount = await autoAsignarPendientesAEdicion(id, edicion.cupo_maximo)
    }

    res.json({
      success: true,
      message: `Estado actualizado a ${estado}.${asignadosCount > 0 ? ` Se asignaron ${asignadosCount} afiliados automáticamente.` : ''}`,
      data: edicion,
      asignadosCount
    })
  } catch (error) {
    console.error('cambiarEstadoEdicion error:', error)
    res.status(500).json({ success: false, message: 'Error al cambiar estado de edición' })
  }
}

/**
 * DELETE /api/admin/cibir/ediciones/:id
 * Soft-delete de una edición. Solo permitido si no está 'Abierta'.
 */
export const deleteEdicion = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id)
    const check = await db.execute({
      sql: `SELECT id_edicion, estado FROM ediciones_cibir WHERE id_edicion = ? AND eliminado_en IS NULL`,
      args: [id]
    })

    if (check.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Edición CIBIR no encontrada' })
      return
    }

    const ed = check.rows[0] as any
    if (ed.estado === 'Abierta') {
      res.status(400).json({ success: false, message: 'No se puede eliminar una edición mientras esté Abierta. Ciérrela primero.' })
      return
    }

    const now = new Date().toISOString()
    await db.execute({
      sql: `UPDATE ediciones_cibir SET eliminado_en = ?, actualizado_en = ? WHERE id_edicion = ?`,
      args: [now, now, id]
    })

    res.json({ success: true, message: 'Edición eliminada correctamente' })
  } catch (error) {
    console.error('deleteEdicion error:', error)
    res.status(500).json({ success: false, message: 'Error al eliminar edición' })
  }
}

/**
 * GET /api/admin/cibir/ediciones/:id/inscritos
 * Lista los participantes inscritos en una edición específica.
 */
export const listInscritos = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id)
    const { estatus, search } = req.query

    let sql = `
      SELECT 
        i.id,
        i.id_edicion,
        i.id_afiliado,
        i.estatus,
        i.asignado_automatico,
        i.aprobado_por,
        i.nota_admin,
        i.fecha_asignacion,
        i.fecha_resolucion,
        a.codigo as afiliado_codigo,
        a.tipo_afiliado,
        a.estatus as afiliado_estatus,
        p.cedula,
        COALESCE(p.nombres || ' ' || p.apellidos, e.razon_social) as nombre_completo,
        COALESCE(p.email, e.email) as email,
        COALESCE(p.telefono, e.telefono) as telefono,
        e.razon_social as empresa_nombre
      FROM inscripciones_edicion_cibir i
      JOIN afiliados a ON a.id_afiliado = i.id_afiliado
      LEFT JOIN personas p ON a.id_persona = p.id
      LEFT JOIN empresas e ON a.id_empresa = e.id_empresa
      WHERE i.id_edicion = ?
    `
    const args: any[] = [id]

    if (estatus && estatus !== 'Todos') {
      sql += ` AND i.estatus = ?`
      args.push(estatus)
    }

    if (search && String(search).trim() !== '') {
      const term = `%${String(search).trim()}%`
      sql += ` AND (p.nombres LIKE ? OR p.apellidos LIKE ? OR p.cedula LIKE ? OR e.razon_social LIKE ? OR a.codigo LIKE ?)`
      args.push(term, term, term, term, term)
    }

    sql += ` ORDER BY i.fecha_asignacion DESC`

    const result = await db.execute({ sql, args })

    res.json({
      success: true,
      data: result.rows
    })
  } catch (error) {
    console.error('listInscritos error:', error)
    res.status(500).json({ success: false, message: 'Error al listar inscritos' })
  }
}

/**
 * PATCH /api/admin/cibir/ediciones/:id/inscritos/:idAfiliado
 * Aprueba o rechaza a un participante en la edición.
 * R4: Al aprobar, avanza automáticamente al afiliado a '6_INSCRIPCION'.
 */
export const aprobarRechazarInscrito = async (req: Request, res: Response): Promise<void> => {
  try {
    const idEdicion = Number(req.params.id)
    const idAfiliado = Number(req.params.idAfiliado)
    const { estatus, notaAdmin } = req.body

    const validos = ['Preinscrito', 'Aprobado', 'Rechazado', 'Cancelado']
    if (!estatus || !validos.includes(estatus)) {
      res.status(400).json({ success: false, message: 'Estatus inválido. Use Preinscrito, Aprobado, Rechazado o Cancelado.' })
      return
    }

    const now = new Date().toISOString()
    const userId = req.user?.id || null

    const upd = await db.execute({
      sql: `UPDATE inscripciones_edicion_cibir 
            SET estatus = ?, aprobado_por = ?, nota_admin = COALESCE(?, nota_admin), 
                fecha_resolucion = ?, actualizado_en = ?
            WHERE id_edicion = ? AND id_afiliado = ?
            RETURNING *`,
      args: [estatus, userId, notaAdmin || null, now, now, idEdicion, idAfiliado]
    })

    if (upd.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Inscripción no encontrada' })
      return
    }

    // Regla R4: Si aprueba el CIBIR, avanzar automáticamente a 6_INSCRIPCION
    if (estatus === 'Aprobado') {
      await db.execute({
        sql: `UPDATE afiliados 
              SET estatus = '6_INSCRIPCION', 
                  fecha_ultimo_cambio_estatus = ?, 
                  actualizado_en = ?
              WHERE id_afiliado = ? AND estatus = '5_CIBIR'`,
        args: [now, now, idAfiliado]
      })
    }

    res.json({
      success: true,
      message: `Inscripción actualizada a "${estatus}" correctamente.`,
      data: upd.rows[0]
    })
  } catch (error) {
    console.error('aprobarRechazarInscrito error:', error)
    res.status(500).json({ success: false, message: 'Error al actualizar estatus de participante' })
  }
}

/**
 * POST /api/admin/cibir/ediciones/:id/asignar
 * Asignar manualmente uno o varios afiliados a una edición CIBIR.
 */
export const asignarAfiliados = async (req: Request, res: Response): Promise<void> => {
  try {
    const idEdicion = Number(req.params.id)
    const { afiliadosIds } = req.body

    if (!Array.isArray(afiliadosIds) || afiliadosIds.length === 0) {
      res.status(400).json({ success: false, message: 'Debe proveer una lista de IDs de afiliados' })
      return
    }

    const now = new Date().toISOString()
    let insertados = 0

    for (const aId of afiliadosIds) {
      const resIns = await db.execute({
        sql: `INSERT OR IGNORE INTO inscripciones_edicion_cibir 
              (id_edicion, id_afiliado, estatus, asignado_automatico, fecha_asignacion)
              VALUES (?, ?, 'Preinscrito', 0, ?)`,
        args: [idEdicion, Number(aId), now]
      })
      if (Number(resIns.rowsAffected || 0) > 0) {
        insertados++
      }
    }

    res.json({
      success: true,
      message: `Se asignaron ${insertados} afiliados a la edición.`
    })
  } catch (error) {
    console.error('asignarAfiliados error:', error)
    res.status(500).json({ success: false, message: 'Error al asignar afiliados a edición' })
  }
}

/**
 * DELETE /api/admin/cibir/ediciones/:id/inscritos/:idAfiliado
 * Cancela o remueve la inscripción de un afiliado en la edición.
 */
export const cancelarInscrito = async (req: Request, res: Response): Promise<void> => {
  try {
    const idEdicion = Number(req.params.id)
    const idAfiliado = Number(req.params.idAfiliado)

    const now = new Date().toISOString()
    const del = await db.execute({
      sql: `UPDATE inscripciones_edicion_cibir 
            SET estatus = 'Cancelado', actualizado_en = ? 
            WHERE id_edicion = ? AND id_afiliado = ?
            RETURNING *`,
      args: [now, idEdicion, idAfiliado]
    })

    if (del.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Inscripción no encontrada' })
      return
    }

    res.json({ success: true, message: 'Inscripción cancelada' })
  } catch (error) {
    console.error('cancelarInscrito error:', error)
    res.status(500).json({ success: false, message: 'Error al cancelar inscripción' })
  }
}

/**
 * GET /api/admin/cibir/pendientes
 * Lista todos los afiliados en '5_CIBIR' que no tienen una edición activa asignada.
 */
export const listPendientesSinEdicion = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await db.execute(`
      SELECT 
        a.id_afiliado,
        a.codigo,
        a.tipo_afiliado,
        a.estatus,
        a.fecha_registro,
        p.cedula,
        COALESCE(p.nombres || ' ' || p.apellidos, e.razon_social) as nombre_completo,
        COALESCE(p.email, e.email) as email,
        COALESCE(p.telefono, e.telefono) as telefono,
        e.razon_social as empresa_nombre
      FROM afiliados a
      LEFT JOIN personas p ON a.id_persona = p.id
      LEFT JOIN empresas e ON a.id_empresa = e.id_empresa
      WHERE a.estatus = '5_CIBIR'
        AND a.optar_acreditacion = 0
        AND a.cibir_acreditado = 0
        AND a.eliminado_en IS NULL
        AND NOT EXISTS (
          SELECT 1 
          FROM inscripciones_edicion_cibir iec
          JOIN ediciones_cibir ec ON ec.id_edicion = iec.id_edicion
          WHERE iec.id_afiliado = a.id_afiliado
            AND iec.estatus IN ('Preinscrito', 'Aprobado')
            AND ec.estado IN ('Planificada', 'Abierta')
            AND ec.eliminado_en IS NULL
        )
      ORDER BY a.fecha_registro ASC
    `)

    res.json({
      success: true,
      data: result.rows
    })
  } catch (error) {
    console.error('listPendientesSinEdicion error:', error)
    res.status(500).json({ success: false, message: 'Error al listar pendientes CIBIR' })
  }
}

/**
 * Helper: Asigna masivamente los afiliados esperando en 5_CIBIR a una edición
 */
async function autoAsignarPendientesAEdicion(idEdicion: number, cupoMaximo: number | null): Promise<number> {
  try {
    let limitClause = ''
    if (cupoMaximo !== null && cupoMaximo !== undefined) {
      const countRes = await db.execute({
        sql: `SELECT COUNT(*) as total FROM inscripciones_edicion_cibir WHERE id_edicion = ? AND estatus <> 'Cancelado'`,
        args: [idEdicion]
      })
      const actuales = Number((countRes.rows[0] as any)?.total || 0)
      const cuposRestantes = Math.max(0, cupoMaximo - actuales)
      if (cuposRestantes <= 0) return 0
      limitClause = `LIMIT ${cuposRestantes}`
    }

    const now = new Date().toISOString()
    const query = `
      INSERT OR IGNORE INTO inscripciones_edicion_cibir (id_edicion, id_afiliado, estatus, asignado_automatico, fecha_asignacion)
      SELECT ?, a.id_afiliado, 'Preinscrito', 1, ?
      FROM afiliados a
      WHERE a.estatus = '5_CIBIR'
        AND a.optar_acreditacion = 0
        AND a.cibir_acreditado = 0
        AND a.eliminado_en IS NULL
        AND NOT EXISTS (
          SELECT 1 
          FROM inscripciones_edicion_cibir iec
          JOIN ediciones_cibir ec ON ec.id_edicion = iec.id_edicion
          WHERE iec.id_afiliado = a.id_afiliado
            AND iec.estatus IN ('Preinscrito', 'Aprobado')
            AND ec.estado IN ('Planificada', 'Abierta')
            AND ec.eliminado_en IS NULL
        )
      ORDER BY a.fecha_registro ASC
      ${limitClause}
    `

    const resIns = await db.execute({
      sql: query,
      args: [idEdicion, now]
    })

    return Number(resIns.rowsAffected || 0)
  } catch (err) {
    console.error('autoAsignarPendientesAEdicion error:', err)
    return 0
  }
}
