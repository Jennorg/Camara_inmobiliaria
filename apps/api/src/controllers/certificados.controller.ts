import { Request, Response } from 'express'
import { db } from '../lib/db.js'

/**
 * GET /api/public/comprobantes/:codigo
 * Verificación pública de un comprobante de aprobación digital (sin auth).
 */
export const publicGetComprobanteByCodigo = async (req: Request, res: Response): Promise<void> => {
  try {
    const codigoRaw = typeof req.params.codigo === 'string' ? req.params.codigo.trim() : ''
    if (!codigoRaw) {
      res.status(400).json({ success: false, message: 'Código requerido' })
      return
    }

    const result = await db.execute({
      sql: `
        SELECT
          c.id_certificado,
          c.codigo_validacion,
          c.fecha_emision,
          COALESCE(p.nombres || ' ' || p.apellidos, emp.razon_social) as titular_nombre,
          COALESCE(p.cedula, emp.rif_tipo || '-' || emp.rif_numero) as cedula,
          ic.programa_codigo,
          ic.tipo_inscripcion,
          ic.estatus AS inscripcion_estatus,
          ic.completado,
          cu.titulo AS curso_nombre
        FROM certificados c
        JOIN inscripciones_cursos ic ON ic.id_inscripcion = c.id_inscripcion
        JOIN estudiantes e ON e.id_estudiante = ic.id_estudiante
        LEFT JOIN personas p ON e.id_persona = p.id
        LEFT JOIN empresas emp ON e.id_empresa = emp.id_empresa
        LEFT JOIN cursos cu ON cu.id_curso = ic.id_curso
        WHERE UPPER(c.codigo_validacion) = UPPER(?)
        LIMIT 1
      `,
      args: [codigoRaw],
    })

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Comprobante no encontrado' })
      return
    }

    const row = result.rows[0] as Record<string, unknown>
    const programaOCurso =
      (row.curso_nombre as string | null) ||
      (row.programa_codigo ? `Programa ${String(row.programa_codigo)}` : null) ||
      'Formación académica'

    res.json({
      success: true,
      data: {
        codigo_validacion: row.codigo_validacion,
        fecha_emision: row.fecha_emision,
        titular_nombre: row.titular_nombre,
        cedula: row.cedula,
        programa_o_curso: programaOCurso,
        programa_codigo: row.programa_codigo,
        tipo_inscripcion: row.tipo_inscripcion,
        vigente: Number(row.completado) === 1 && row.inscripcion_estatus === 'Inscrito',
      },
    })
  } catch (error) {
    console.error('publicGetComprobanteByCodigo:', error)
    res.status(500).json({ success: false, message: 'Error al verificar el comprobante' })
  }
}
