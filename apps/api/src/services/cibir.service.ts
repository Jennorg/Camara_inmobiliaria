import { db } from '../lib/db.js'

/**
 * Intenta asignar automáticamente a un afiliado a la edición CIBIR abierta más reciente,
 * siempre que no opte por acreditación y no esté ya inscrito en una edición activa.
 */
export async function autoAsignarEdicionCibir(idAfiliado: number): Promise<boolean> {
  try {
    // 1. Validar si el afiliado existe, está en 5_CIBIR y NO opta por acreditación
    const afiRes = await db.execute({
      sql: `SELECT id_afiliado, estatus, optar_acreditacion, cibir_acreditado 
            FROM afiliados 
            WHERE id_afiliado = ? AND eliminado_en IS NULL`,
      args: [idAfiliado]
    })
    if (afiRes.rows.length === 0) return false
    const afi = afiRes.rows[0] as any

    if (afi.optar_acreditacion === 1 || afi.cibir_acreditado === 1) {
      // Excluido de ediciones CIBIR
      return false
    }

    // 2. Buscar si hay una edición CIBIR abierta
    const edicionRes = await db.execute(`
      SELECT id_edicion, cupo_maximo 
      FROM ediciones_cibir 
      WHERE estado = 'Abierta' AND eliminado_en IS NULL 
      ORDER BY creado_en DESC 
      LIMIT 1
    `)
    if (edicionRes.rows.length === 0) {
      return false
    }
    const edicion = edicionRes.rows[0] as any
    const idEdicion = Number(edicion.id_edicion)

    // 3. Verificar si ya está inscrito en esta edición
    const yaInscrito = await db.execute({
      sql: `SELECT id FROM inscripciones_edicion_cibir 
            WHERE id_edicion = ? AND id_afiliado = ?`,
      args: [idEdicion, idAfiliado]
    })
    if (yaInscrito.rows.length > 0) {
      return false
    }

    // 4. Si tiene cupo_maximo, validar si no está lleno
    if (edicion.cupo_maximo !== null && edicion.cupo_maximo !== undefined) {
      const countRes = await db.execute({
        sql: `SELECT COUNT(*) as total FROM inscripciones_edicion_cibir 
              WHERE id_edicion = ? AND estatus <> 'Cancelado'`,
        args: [idEdicion]
      })
      const total = Number((countRes.rows[0] as any)?.total || 0)
      if (total >= Number(edicion.cupo_maximo)) {
        return false // Cupo lleno
      }
    }

    // 5. Insertar inscripción como Preinscrito
    const now = new Date().toISOString()
    await db.execute({
      sql: `INSERT OR IGNORE INTO inscripciones_edicion_cibir 
            (id_edicion, id_afiliado, estatus, asignado_automatico, fecha_asignacion)
            VALUES (?, ?, 'Preinscrito', 1, ?)`,
      args: [idEdicion, idAfiliado, now]
    })

    return true
  } catch (err) {
    console.error('Error en autoAsignarEdicionCibir:', err)
    return false
  }
}
