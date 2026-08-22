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
          cu.titulo AS curso_nombre,
          cu.modalidad AS curso_modalidad,
          cu.categoria AS curso_categoria,
          cu.descripcion AS curso_descripcion,
          COALESCE(
            (SELECT GROUP_CONCAT(mc.nombre_modulo, '|||') FROM modulos_curso mc WHERE mc.id_curso = cu.id_curso AND mc.nombre_modulo NOT LIKE '%Módulo General%'),
            (SELECT GROUP_CONCAT(mi.nombre_modulo, '|||') FROM modulos_inscripcion mi WHERE mi.id_inscripcion = ic.id_inscripcion AND mi.nombre_modulo NOT LIKE '%Módulo General%')
          ) AS modulos_lista,
          (
            SELECT COALESCE(p_prof.nombres || ' ' || p_prof.apellidos, '')
            FROM modulos_curso mc
            JOIN profesores prof ON mc.id_profesor = prof.id_profesor
            JOIN personas p_prof ON prof.id_persona = p_prof.id
            WHERE mc.id_curso = cu.id_curso AND mc.id_profesor IS NOT NULL
            LIMIT 1
          ) AS instructor_nombre
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
        modalidad: row.curso_modalidad,
        categoria: row.curso_categoria,
        descripcion: row.curso_descripcion,
        modulos_lista: row.modulos_lista || null,
        instructor_nombre: row.instructor_nombre || null,
        vigente: Number(row.completado) === 1 && (row.inscripcion_estatus === 'Inscrito' || row.inscripcion_estatus === 'Pagado'),
      },
    })
  } catch (error) {
    console.error('publicGetComprobanteByCodigo:', error)
    res.status(500).json({ success: false, message: 'Error al verificar el comprobante' })
  }
}
