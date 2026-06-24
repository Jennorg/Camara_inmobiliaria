import { randomBytes } from 'crypto'
import { db } from './db.js'
import { enviarCorreoComprobanteGraduacion } from './email.js'
import { env } from '../config/env.js'

export function nuevoCodigoValidacion(): string {
  return `CIV-${randomBytes(6).toString('hex').toUpperCase()}`
}

/** LibSQL/Turso puede devolver 1 como number, bigint o string; evita fallos silenciosos al comparar con === 1 */
export function esCompletadoUno(val: unknown): boolean {
  const n = Number(val)
  return n === 1 && !Number.isNaN(n)
}

export type EmitirComprobanteOptions = {
  /** Si true, no envía correo (p. ej. migración / backfill). */
  skipEmail?: boolean
}

/**
 * Crea fila en `certificados` cuando una inscripción queda marcada como completada.
 * Idempotente si ya existe comprobante para esa inscripción.
 */
export async function emitirComprobanteSiCompleto(
  idInscripcion: number,
  options: EmitirComprobanteOptions = {}
): Promise<void> {
  const { skipEmail = false } = options
  const row = await db.execute({
    sql: `SELECT id_inscripcion, completado FROM inscripciones_cursos WHERE id_inscripcion = ?`,
    args: [idInscripcion],
  })
  const ins = row.rows[0] as unknown as { completado: unknown } | undefined
  if (!ins || !esCompletadoUno(ins.completado)) return

  const exists = await db.execute({
    sql: `SELECT 1 FROM certificados WHERE id_inscripcion = ? LIMIT 1`,
    args: [idInscripcion],
  })
  if (exists.rows.length > 0) return

  const fecha = new Date().toISOString()
  let insertedCodigo: string | null = null
  for (let a = 0; a < 8; a++) {
    const codigo = nuevoCodigoValidacion()
    try {
      await db.execute({
        sql: `INSERT INTO certificados (id_inscripcion, codigo_validacion, url, fecha_emision) VALUES (?, ?, ?, ?)`,
        args: [idInscripcion, codigo, `${env.APP_URL}/comprobante/${codigo}`, fecha],
      })
      insertedCodigo = codigo
      break
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (!msg.includes('UNIQUE')) throw e
    }
  }
  if (!insertedCodigo) {
    throw new Error('No se pudo generar un código de validación único')
  }

  if (skipEmail) return

  try {
    const meta = await db.execute({
      sql: `
        SELECT
          COALESCE(p.nombres || ' ' || p.apellidos, emp.razon_social) AS nombre,
          COALESCE(p.email, emp.email) AS email,
          COALESCE(
            c.titulo,
            CASE WHEN ic.programa_codigo IS NOT NULL AND TRIM(ic.programa_codigo) != ''
              THEN 'Programa ' || ic.programa_codigo
              ELSE NULL
            END,
            'Formación académica'
          ) AS titulo_formacion
        FROM inscripciones_cursos ic
        JOIN estudiantes e ON e.id_estudiante = ic.id_estudiante
        LEFT JOIN personas p ON e.id_persona = p.id
        LEFT JOIN empresas emp ON e.id_empresa = emp.id_empresa
        LEFT JOIN cursos c ON c.id_curso = ic.id_curso
        WHERE ic.id_inscripcion = ?
        LIMIT 1
      `,
      args: [idInscripcion],
    })
    const m = meta.rows[0] as unknown as {
      nombre: string
      email: string
      titulo_formacion: string
    } | undefined
    if (m?.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m.email)) {
      await enviarCorreoComprobanteGraduacion({
        nombre: m.nombre || 'Estudiante',
        emailEstudiante: m.email.trim().toLowerCase(),
        tituloFormacion: m.titulo_formacion || 'Formación académica',
        codigoValidacion: insertedCodigo,
      })
    }
  } catch (e) {
    console.error('emitirComprobanteSiCompleto (correo):', e)
  }
}

/**
 * Asegura que un afiliado convalidado en CIBIR (o con todos los módulos aprobados)
 * tenga su registro de estudiante, inscripción del programa CIBIR y certificado generado.
 */
export async function ensureCibirCertificate(idAfiliado: number): Promise<void> {
  try {
    // 1. Obtener datos del afiliado
    const afiRes = await db.execute({
      sql: `SELECT id_afiliado, id_persona, id_empresa, cibir_acreditado FROM afiliados WHERE id_afiliado = ?`,
      args: [idAfiliado]
    })
    if (afiRes.rows.length === 0) return
    const afi = afiRes.rows[0] as any

    // 2. Contar módulos aprobados en acreditaciones_cibir
    const countRes = await db.execute({
      sql: `SELECT COUNT(*) as approved_count FROM acreditaciones_cibir WHERE id_afiliado = ? AND estatus = 'aprobado'`,
      args: [idAfiliado]
    })
    const approvedCount = Number((countRes.rows[0] as any).approved_count)

    const isCibirApproved = Number(afi.cibir_acreditado) === 1 || approvedCount === 5
    if (!isCibirApproved) return

    // Auto-corregir cibir_acreditado = 1 en afiliados si no lo tenía
    if (Number(afi.cibir_acreditado) !== 1) {
      await db.execute({
        sql: `UPDATE afiliados SET cibir_acreditado = 1, actualizado_en = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id_afiliado = ?`,
        args: [idAfiliado]
      })
    }

    // 3. Obtener o crear estudiante
    let idEstudiante: number | null = null
    if (afi.id_persona) {
      const estRes = await db.execute({
        sql: `SELECT id_estudiante FROM estudiantes WHERE id_persona = ?`,
        args: [afi.id_persona]
      })
      if (estRes.rows.length > 0) {
        idEstudiante = (estRes.rows[0] as any).id_estudiante
      } else {
        const insEst = await db.execute({
          sql: `INSERT INTO estudiantes (id_persona, tipo, creado_en) VALUES (?, 'Afiliado', strftime('%Y-%m-%dT%H:%M:%SZ','now')) RETURNING id_estudiante`,
          args: [afi.id_persona]
        })
        idEstudiante = (insEst.rows[0] as any).id_estudiante
      }
    } else if (afi.id_empresa) {
      const estRes = await db.execute({
        sql: `SELECT id_estudiante FROM estudiantes WHERE id_empresa = ?`,
        args: [afi.id_empresa]
      })
      if (estRes.rows.length > 0) {
        idEstudiante = (estRes.rows[0] as any).id_estudiante
      } else {
        const insEst = await db.execute({
          sql: `INSERT INTO estudiantes (id_empresa, tipo, creado_en) VALUES (?, 'Afiliado', strftime('%Y-%m-%dT%H:%M:%SZ','now')) RETURNING id_estudiante`,
          args: [afi.id_empresa]
        })
        idEstudiante = (insEst.rows[0] as any).id_estudiante
      }
    }

    if (!idEstudiante) return

    // 4. Obtener o crear inscripción de CIBIR
    let idInscripcion: number | null = null
    const inscRes = await db.execute({
      sql: `SELECT id_inscripcion, completado, estatus FROM inscripciones_cursos WHERE id_estudiante = ? AND programa_codigo = 'CIBIR' AND id_curso IS NULL LIMIT 1`,
      args: [idEstudiante]
    })

    if (inscRes.rows.length > 0) {
      const insc = inscRes.rows[0] as any
      idInscripcion = insc.id_inscripcion
      if (Number(insc.completado) !== 1 || !['Inscrito', 'Pagado'].includes(insc.estatus)) {
        await db.execute({
          sql: `UPDATE inscripciones_cursos SET completado = 1, estatus = 'Inscrito', actualizado_en = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id_inscripcion = ?`,
          args: [idInscripcion]
        })
      }
    } else {
      const insInsc = await db.execute({
        sql: `INSERT INTO inscripciones_cursos (id_estudiante, programa_codigo, tipo_inscripcion, estatus, completado, creado_en, actualizado_en)
              VALUES (?, 'CIBIR', 'programa', 'Inscrito', 1, strftime('%Y-%m-%dT%H:%M:%SZ','now'), strftime('%Y-%m-%dT%H:%M:%SZ','now')) RETURNING id_inscripcion`,
        args: [idEstudiante]
      })
      idInscripcion = (insInsc.rows[0] as any).id_inscripcion
    }

    if (!idInscripcion) return

    // 5. Asegurar certificado en tabla certificados
    const certRes = await db.execute({
      sql: `SELECT 1 FROM certificados WHERE id_inscripcion = ?`,
      args: [idInscripcion]
    })

    if (certRes.rows.length === 0) {
      const fecha = new Date().toISOString()
      let insertedCodigo: string | null = null
      for (let a = 0; a < 8; a++) {
        const codigo = nuevoCodigoValidacion()
        try {
          await db.execute({
            sql: `INSERT INTO certificados (id_inscripcion, codigo_validacion, url, fecha_emision) VALUES (?, ?, ?, ?)`,
            args: [idInscripcion, codigo, `${env.APP_URL}/comprobante/${codigo}`, fecha],
          })
          insertedCodigo = codigo
          break
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e)
          if (!msg.includes('UNIQUE')) throw e
        }
      }
      if (!insertedCodigo) {
        throw new Error('No se pudo generar un código de validación único para CIBIR convalidado')
      }
    }
  } catch (err) {
    console.error(`ensureCibirCertificate for idAfiliado=${idAfiliado} failed:`, err)
  }
}
