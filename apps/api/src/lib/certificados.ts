import { randomBytes } from 'crypto'
import { db } from './db.js'
import { enviarCorreoComprobanteGraduacion } from './email.js'

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
        sql: `INSERT INTO certificados (id_inscripcion, codigo_validacion, fecha_emision) VALUES (?, ?, ?)`,
        args: [idInscripcion, codigo, fecha],
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
