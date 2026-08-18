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
    sql: `SELECT ic.id_inscripcion, ic.completado, ic.programa_codigo,
                 COALESCE(af.optar_acreditacion, 0) as optar_acreditacion,
                 COALESCE(af.cibir_acreditado, 0) as cibir_acreditado
          FROM inscripciones_cursos ic
          JOIN estudiantes e ON ic.id_estudiante = e.id_estudiante
          LEFT JOIN afiliados af ON (
            (e.id_persona = af.id_persona AND e.id_persona IS NOT NULL)
            OR (e.id_empresa = af.id_empresa AND e.id_empresa IS NOT NULL)
          )
          WHERE ic.id_inscripcion = ?`,
    args: [idInscripcion],
  })
  const ins = row.rows[0] as any
  if (!ins || !esCompletadoUno(ins.completado)) return

  // Si es del programa CIBIR y el afiliado opta por acreditación o ya está acreditado, evitar emitir certificado
  if (ins.programa_codigo === 'CIBIR' && (Number(ins.optar_acreditacion) === 1 || Number(ins.cibir_acreditado) === 1)) {
    return
  }

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
    const afiRes = await db.execute({
      sql: `SELECT id_afiliado, cibir_acreditado FROM afiliados WHERE id_afiliado = ?`,
      args: [idAfiliado]
    })
    if (afiRes.rows.length === 0) return
    const afi = afiRes.rows[0] as any
    const isExonerado = Number(afi.cibir_acreditado) === 1
    await syncCibirCertificateState(idAfiliado, isExonerado)
  } catch (err) {
    console.error(`ensureCibirCertificate for idAfiliado=${idAfiliado} failed:`, err)
  }
}

/**
 * Sincroniza la acreditación CIBIR y la generación/eliminación del certificado CIBIR:
 * - cibirAcreditado = true (Acreditado por convalidación / Exonerado):
 *   NO va a tener certificado CIBIR (se elimina si existía).
 * - cibirAcreditado = false (Aprobado en CIBIR):
 *   SI va a tener certificado CIBIR.
 */
export async function syncCibirCertificateState(idAfiliado: number, cibirAcreditado: boolean): Promise<void> {
  try {
    const afiRes = await db.execute({
      sql: `SELECT id_afiliado, id_persona, id_empresa FROM afiliados WHERE id_afiliado = ?`,
      args: [idAfiliado]
    })
    if (afiRes.rows.length === 0) return
    const afi = afiRes.rows[0] as any

    const extractId = (res: any, key: string): number => {
      const val = res.rows?.[0]?.[key] ?? res.lastInsertRowid ?? res.insertId
      return Number(val) || 0
    }

    // 1. Asegurar registro de estudiante
    let idEstudiante: number | null = null
    if (afi.id_persona) {
      const estRes = await db.execute({
        sql: `SELECT id_estudiante FROM estudiantes WHERE id_persona = ?`,
        args: [afi.id_persona]
      })
      if (estRes.rows.length > 0) {
        idEstudiante = extractId(estRes, 'id_estudiante')
      } else {
        const insEst = await db.execute({
          sql: `INSERT INTO estudiantes (id_persona, tipo, creado_en) VALUES (?, 'Afiliado', strftime('%Y-%m-%dT%H:%M:%SZ','now')) RETURNING id_estudiante`,
          args: [afi.id_persona]
        })
        idEstudiante = extractId(insEst, 'id_estudiante')
      }
    } else if (afi.id_empresa) {
      const estRes = await db.execute({
        sql: `SELECT id_estudiante FROM estudiantes WHERE id_empresa = ?`,
        args: [afi.id_empresa]
      })
      if (estRes.rows.length > 0) {
        idEstudiante = extractId(estRes, 'id_estudiante')
      } else {
        const insEst = await db.execute({
          sql: `INSERT INTO estudiantes (id_empresa, tipo, creado_en) VALUES (?, 'Afiliado', strftime('%Y-%m-%dT%H:%M:%SZ','now')) RETURNING id_estudiante`,
          args: [afi.id_empresa]
        })
        idEstudiante = extractId(insEst, 'id_estudiante')
      }
    }

    if (!idEstudiante) return

    if (cibirAcreditado) {
      // SI Acreditado por convalidación => NO va a tener certificado CIBIR
      await db.execute({
        sql: `DELETE FROM certificados WHERE id_inscripcion IN (
          SELECT id_inscripcion FROM inscripciones_cursos WHERE id_estudiante = ? AND programa_codigo = 'CIBIR'
        )`,
        args: [idEstudiante]
      })
    } else {
      // Aprobado en CIBIR => SI va a tener certificado CIBIR de aprobación
      let idInscripcion: number | null = null
      const inscRes = await db.execute({
        sql: `SELECT id_inscripcion FROM inscripciones_cursos WHERE id_estudiante = ? AND programa_codigo = 'CIBIR' AND id_curso IS NULL LIMIT 1`,
        args: [idEstudiante]
      })

      if (inscRes.rows.length > 0) {
        idInscripcion = extractId(inscRes, 'id_inscripcion')
        await db.execute({
          sql: `UPDATE inscripciones_cursos SET completado = 1, estatus = 'Inscrito', actualizado_en = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id_inscripcion = ?`,
          args: [idInscripcion]
        })
      } else {
        const insInsc = await db.execute({
          sql: `INSERT INTO inscripciones_cursos (id_estudiante, programa_codigo, tipo_inscripcion, estatus, completado, creado_en, actualizado_en)
                VALUES (?, 'CIBIR', 'programa', 'Inscrito', 1, strftime('%Y-%m-%dT%H:%M:%SZ','now'), strftime('%Y-%m-%dT%H:%M:%SZ','now')) RETURNING id_inscripcion`,
          args: [idEstudiante]
        })
        idInscripcion = extractId(insInsc, 'id_inscripcion')
      }

      if (idInscripcion) {
        const certExist = await db.execute({
          sql: `SELECT 1 FROM certificados WHERE id_inscripcion = ? LIMIT 1`,
          args: [idInscripcion]
        })
        if (certExist.rows.length === 0) {
          const fecha = new Date().toISOString()
          const codigo = nuevoCodigoValidacion()
          await db.execute({
            sql: `INSERT INTO certificados (id_inscripcion, codigo_validacion, url, fecha_emision) VALUES (?, ?, ?, ?)`,
            args: [idInscripcion, codigo, `${env.APP_URL}/comprobante/${codigo}`, fecha]
          })
        }
      }
    }
  } catch (err) {
    console.error(`syncCibirCertificateState for idAfiliado=${idAfiliado} failed:`, err)
  }
}
