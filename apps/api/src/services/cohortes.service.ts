import { db } from '../lib/db.js'
import { asegurarEsquemaCohortes, esProgramaCohorte, etapasPorCohorte, ETAPAS, type ProgramaCohorte } from '../lib/cohortes.js'

/** Error de negocio con código HTTP para que el controller lo traduzca. */
const fallo = (status: number, message: string) => Object.assign(new Error(message), { status })

let esquema: Promise<void> | null = null
/** Garantiza el esquema una vez por instancia; si falla se reintenta en la siguiente llamada. */
export const asegurarCohortes = (): Promise<void> =>
  (esquema ??= asegurarEsquemaCohortes(db).catch(e => { esquema = null; throw e }))

/** Fecha de hoy en Venezuela (YYYY-MM-DD). */
const hoyCaracas = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Caracas' })

export async function listarCohortes(programa?: string) {
  await asegurarCohortes()
  if (programa && !esProgramaCohorte(programa)) throw fallo(400, 'programa inválido')
  const [r, etapas] = await Promise.all([
    db.execute({
      sql: `SELECT c.*, COUNT(ic.id_inscripcion) AS inscritos
            FROM cohortes c LEFT JOIN inscripciones_cursos ic ON ic.id_cohorte = c.id_cohorte
            WHERE (? IS NULL OR c.programa_codigo = ?)
            GROUP BY c.id_cohorte ORDER BY c.programa_codigo, c.numero`,
      args: [programa ?? null, programa ?? null],
    }),
    etapasPorCohorte(db),
  ])
  const vacio = Object.fromEntries(ETAPAS.map(e => [e, 0]))
  return r.rows.map(c => ({ ...c, etapas: etapas.get(Number(c.id_cohorte)) ?? vacio }))
}

/** Abre la siguiente cohorte del programa y cierra la que estaba abierta, en una sola transacción. */
export async function crearCohorte(programa: ProgramaCohorte, nombre?: string, descripcion?: string) {
  await asegurarCohortes()
  const max = await db.execute({ sql: `SELECT COALESCE(MAX(numero), 0) AS n FROM cohortes WHERE programa_codigo = ?`, args: [programa] })
  const numero = Number(max.rows[0].n) + 1
  const ahora = new Date().toISOString()
  const [, creada] = await db.batch([
    { sql: `UPDATE cohortes SET estado = 'Cerrada', actualizado_en = ? WHERE programa_codigo = ? AND estado = 'Abierta'`, args: [ahora, programa] },
    {
      sql: `INSERT INTO cohortes (programa_codigo, numero, nombre, descripcion, fecha_inicio, estado) VALUES (?, ?, ?, ?, ?, 'Abierta') RETURNING *`,
      args: [programa, numero, nombre?.trim() || `Cohorte ${numero}`, descripcion?.trim() || null, hoyCaracas()],
    },
  ], 'write')
  return creada.rows[0]
}

/** Mueve una inscripción a otra cohorte (o la deja sin cohorte con `null`). Debe ser del mismo programa. */
export async function asignarCohorte(idInscripcion: number, idCohorte: number | null) {
  await asegurarCohortes()
  const insc = await db.execute({ sql: `SELECT programa_codigo, id_curso FROM inscripciones_cursos WHERE id_inscripcion = ?`, args: [idInscripcion] })
  const fila = insc.rows[0] as any
  if (!fila) throw fallo(404, 'Inscripción no encontrada')
  if (idCohorte !== null) {
    const c = await db.execute({ sql: `SELECT programa_codigo FROM cohortes WHERE id_cohorte = ?`, args: [idCohorte] })
    if (!c.rows[0]) throw fallo(404, 'Cohorte no encontrada')
    // En el panel, la inscripción AFILIACION de quien está en la etapa CIBIR se muestra como CIBIR
    const programa = fila.id_curso === null && fila.programa_codigo === 'AFILIACION' ? 'CIBIR' : fila.programa_codigo
    if (fila.id_curso !== null || c.rows[0].programa_codigo !== programa) throw fallo(409, 'La cohorte no corresponde al programa de la inscripción')
  }
  await db.execute({ sql: `UPDATE inscripciones_cursos SET id_cohorte = ?, actualizado_en = ? WHERE id_inscripcion = ?`, args: [idCohorte, new Date().toISOString(), idInscripcion] })
}

/** Lista de inscritos de una cohorte (para el Excel). */
export async function inscritosDeCohorte(idCohorte: number) {
  await asegurarCohortes()
  const c = await db.execute({ sql: `SELECT * FROM cohortes WHERE id_cohorte = ?`, args: [idCohorte] })
  const cohorte = c.rows[0] as any
  if (!cohorte) throw fallo(404, 'Cohorte no encontrada')
  const r = await db.execute({
    sql: `SELECT COALESCE(NULLIF(TRIM(COALESCE(p.nombres, '') || ' ' || COALESCE(p.apellidos, '')), ''), emp.razon_social) AS nombre,
                 COALESCE(p.cedula_tipo || '-' || p.cedula, 'J-' || REPLACE(emp.rif_numero, 'J-', '')) AS cedula,
                 COALESCE(p.email, emp.email) AS email,
                 COALESCE(p.telefono, emp.telefono) AS telefono,
                 (SELECT af.codigo FROM afiliados af WHERE (e.id_persona IS NOT NULL AND af.id_persona = e.id_persona)
                    OR (e.id_empresa IS NOT NULL AND af.id_empresa = e.id_empresa) LIMIT 1) AS n_afiliado,
                 ic.estatus, ic.fecha_inscripcion
          FROM inscripciones_cursos ic
          JOIN estudiantes e ON e.id_estudiante = ic.id_estudiante
          LEFT JOIN personas p ON p.id = e.id_persona
          LEFT JOIN empresas emp ON emp.id_empresa = e.id_empresa
          WHERE ic.id_cohorte = ?
          ORDER BY nombre`,
    args: [idCohorte],
  })
  return { cohorte, filas: r.rows as any[] }
}
