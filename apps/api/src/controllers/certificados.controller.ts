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

    // Extraer id_inscripcion si viene en formato CIV-00005-001 o como número directo
    let idInscripcionParsed: number | null = null
    const civMatch = codigoRaw.match(/^CIV-(\d+)-/i)
    if (civMatch) {
      idInscripcionParsed = parseInt(civMatch[1], 10)
    } else if (/^\d+$/.test(codigoRaw)) {
      idInscripcionParsed = parseInt(codigoRaw, 10)
    }

    const result = await db.execute({
      sql: `
        SELECT
          COALESCE(c.id_certificado, 0) AS id_certificado,
          COALESCE(c.codigo_validacion, ?) AS codigo_validacion,
          COALESCE(c.fecha_emision, ic.fecha_inscripcion, datetime('now')) AS fecha_emision,
          c.firmantes_snapshot,
          cu.firmantes AS curso_firmantes,
          COALESCE(p.nombres || ' ' || p.apellidos, emp.razon_social) as titular_nombre,
          p.nombres as titular_nombres,
          p.apellidos as titular_apellidos,
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
        FROM inscripciones_cursos ic
        LEFT JOIN certificados c ON c.id_inscripcion = ic.id_inscripcion
        JOIN estudiantes e ON e.id_estudiante = ic.id_estudiante
        LEFT JOIN personas p ON e.id_persona = p.id
        LEFT JOIN empresas emp ON e.id_empresa = emp.id_empresa
        LEFT JOIN cursos cu ON cu.id_curso = ic.id_curso
        WHERE UPPER(c.codigo_validacion) = UPPER(?)
           OR (ic.id_inscripcion = ? AND ? IS NOT NULL)
        LIMIT 1
      `,
      args: [codigoRaw, codigoRaw, idInscripcionParsed, idInscripcionParsed],
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

    // Resolver firmantes dinámicos (Snapshot -> Curso -> Presidente Directiva)
    let firmantesRawArray: any[] = []
    const rawSnapshot = row.firmantes_snapshot as string | null
    const rawCursoFirmantes = row.curso_firmantes as string | null

    if (rawSnapshot) {
      try {
        const parsed = JSON.parse(rawSnapshot)
        if (Array.isArray(parsed)) firmantesRawArray = parsed
      } catch {}
    }
    if (firmantesRawArray.length === 0 && rawCursoFirmantes) {
      try {
        const parsed = JSON.parse(rawCursoFirmantes)
        if (Array.isArray(parsed)) firmantesRawArray = parsed
      } catch {}
    }

    // Obtener autoridades activas de la junta directiva desde la BD
    let directivaDbFirmantes: Array<{
      nombre: string
      cargo: string
      cargo_canonical?: string | null
      firma_url: string | null
      mostrar_firma: boolean
    }> = []

    try {
      const dirRes = await db.execute(`
        SELECT p.nombres || ' ' || p.apellidos as nombre, dc.cargo, dc.cargo_canonical, dc.firma_url
        FROM directiva_cargos dc
        JOIN afiliados a ON dc.id_afiliado = a.id_afiliado
        LEFT JOIN personas p ON a.id_persona = p.id
        WHERE dc.activo = 1 AND (
          dc.cargo_canonical = 'presidente' OR LOWER(dc.cargo) LIKE '%presidente%'
          OR dc.cargo_canonical = 'director_de_formacion' OR LOWER(dc.cargo) LIKE '%formaci%'
        )
        ORDER BY CASE 
          WHEN dc.cargo_canonical = 'presidente' OR LOWER(dc.cargo) LIKE '%presidente%' THEN 1 
          ELSE 2 
        END
      `)
      directivaDbFirmantes = dirRes.rows.map((r: any) => ({
        nombre: (r.nombre || '').trim(),
        cargo: (r.cargo || '').trim(),
        cargo_canonical: r.cargo_canonical || null,
        firma_url: r.firma_url || null,
        mostrar_firma: true,
      }))
    } catch (err) {
      console.error('Error fetching directiva cargos for comprobante:', err)
    }

    const isCibirOrProgram = row.programa_codigo === 'CIBIR' || (!row.curso_nombre && !!row.programa_codigo)

    if (firmantesRawArray.length === 0 || isCibirOrProgram) {
      if (directivaDbFirmantes.length > 0) {
        firmantesRawArray = directivaDbFirmantes
      }
    }

    // Asegurar que si un firmante no tiene firma_url o proviene de snapshot sin firma, se sincronice con la BD
    firmantesRawArray = firmantesRawArray.map((f) => {
      const fName = String(f?.nombre || '').toLowerCase().trim()
      const fCargo = String(f?.cargo || '').toLowerCase().trim()
      const dbMatch = directivaDbFirmantes.find((dbF) => {
        const dbName = dbF.nombre.toLowerCase().trim()
        const dbCargo = dbF.cargo.toLowerCase().trim()
        return (
          (fName && (dbName.includes(fName) || fName.includes(dbName))) ||
          (fCargo.includes('presidente') && dbCargo.includes('presidente')) ||
          (fCargo.includes('formaci') && dbCargo.includes('formaci'))
        )
      })
      return {
        ...f,
        firma_url: f?.firma_url || dbMatch?.firma_url || null,
      }
    })

    if (firmantesRawArray.length === 0) {
      firmantesRawArray = [{
        nombre: 'FRANCISCO PIÑANGO',
        cargo: 'PRESIDENTE DE LA CÁMARA INMOBILIARIA DE BOLÍVAR',
        firma_url: null,
        mostrar_firma: true
      }]
    }

    const firmantesParsed = firmantesRawArray.map(f => ({
      id: f?.id,
      nombre: String(f?.nombre || 'AUTORIDAD').trim(),
      cargo: String(f?.cargo || 'CÁMARA INMOBILIARIA').trim(),
      firma_url: typeof f?.firma_url === 'string' ? f.firma_url : null,
      mostrar_firma: f?.mostrar_firma !== false
    }))

    res.json({
      success: true,
      data: {
        codigo_validacion: row.codigo_validacion,
        fecha_emision: row.fecha_emision,
        titular_nombre: row.titular_nombre,
        titular_nombres: (row.titular_nombres as string | null) || null,
        titular_apellidos: (row.titular_apellidos as string | null) || null,
        cedula: row.cedula,
        programa_o_curso: programaOCurso,
        programa_codigo: row.programa_codigo,
        tipo_inscripcion: row.tipo_inscripcion,
        modalidad: row.curso_modalidad,
        categoria: row.curso_categoria,
        descripcion: row.curso_descripcion,
        modulos_lista: row.modulos_lista || null,
        instructor_nombre: row.instructor_nombre || null,
        firmantes: firmantesParsed,
        vigente: Number(row.completado) === 1 && (row.inscripcion_estatus === 'Inscrito' || row.inscripcion_estatus === 'Pagado'),
      },
    })
  } catch (error) {
    console.error('publicGetComprobanteByCodigo:', error)
    res.status(500).json({ success: false, message: 'Error al verificar el comprobante' })
  }
}
