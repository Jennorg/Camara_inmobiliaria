import { db } from '../lib/db.js'

export const TIPOS_ASAMBLEA = ['Ordinaria', 'Extraordinaria'] as const
export const CONDICIONES = ['Presente', 'Representado'] as const

/** Error de negocio con código HTTP para que el controller lo traduzca. */
const fallo = (status: number, message: string) => Object.assign(new Error(message), { status })

let esquema: Promise<void> | null = null
/** Crea (si faltan) las tablas del módulo, una vez por instancia; solo añade, no toca datos existentes. */
export const asegurarAsambleas = (): Promise<void> =>
  (esquema ??= db.batch([
    `CREATE TABLE IF NOT EXISTS asambleas (
      id_asamblea     INTEGER PRIMARY KEY,
      tipo            TEXT    NOT NULL CHECK (tipo IN ('Ordinaria','Extraordinaria')),
      numero_acta     TEXT,
      titulo          TEXT    NOT NULL,
      fecha           TEXT    NOT NULL,
      hora            TEXT,
      lugar           TEXT,
      convocatoria    TEXT,
      orden_del_dia   TEXT,
      resumen         TEXT,
      acuerdos        TEXT,
      url_acta        TEXT,
      quorum_pct      INTEGER NOT NULL DEFAULT 50 CHECK (quorum_pct BETWEEN 1 AND 100),
      total_miembros  INTEGER NOT NULL DEFAULT 0 CHECK (total_miembros >= 0),
      publicada       INTEGER NOT NULL DEFAULT 0,
      creado_por      INTEGER,
      creado_en       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
      actualizado_en  TEXT,
      eliminado_en    TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_asambleas_fecha ON asambleas(fecha)`,
    `CREATE TABLE IF NOT EXISTS asamblea_asistencia (
      id_asamblea   INTEGER NOT NULL REFERENCES asambleas(id_asamblea),
      id_afiliado   INTEGER NOT NULL,
      condicion     TEXT    NOT NULL DEFAULT 'Presente' CHECK (condicion IN ('Presente','Representado')),
      representante TEXT,
      registrado_en TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
      PRIMARY KEY (id_asamblea, id_afiliado)
    )`,
  ], 'write').then(() => undefined).catch(e => { esquema = null; throw e }))

const texto = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

/** Afiliados con derecho a participar hoy: base sugerida para el quórum de una asamblea nueva. */
export async function miembrosConDerecho(): Promise<number> {
  const r = await db.execute(`SELECT COUNT(*) n FROM afiliados WHERE estatus = 'Afiliado' AND eliminado_en IS NULL`)
  return Number(r.rows[0].n)
}

/** Quórum: asistentes (presentes y representados) frente al total de miembros y al porcentaje exigido. */
const conQuorum = (a: any) => {
  const asistentes = Number(a.asistentes ?? 0)
  const total = Number(a.total_miembros)
  const requeridos = Math.ceil((total * Number(a.quorum_pct)) / 100)
  return { ...a, asistentes, quorum_requeridos: requeridos, quorum_alcanzado: total > 0 && asistentes >= requeridos }
}

function validar(b: any, parcial = false) {
  const d: Record<string, unknown> = {}
  if (!parcial || b.tipo !== undefined) {
    if (!TIPOS_ASAMBLEA.includes(b.tipo)) throw fallo(400, 'El tipo debe ser Ordinaria o Extraordinaria')
    d.tipo = b.tipo
  }
  if (!parcial || b.titulo !== undefined) {
    if (!texto(b.titulo)) throw fallo(400, 'El título es obligatorio')
    d.titulo = texto(b.titulo)
  }
  if (!parcial || b.fecha !== undefined) {
    if (typeof b.fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(b.fecha)) throw fallo(400, 'La fecha es obligatoria (AAAA-MM-DD)')
    d.fecha = b.fecha
  }
  for (const k of ['numero_acta', 'hora', 'lugar', 'convocatoria', 'orden_del_dia', 'resumen', 'acuerdos'] as const) if (b[k] !== undefined) d[k] = texto(b[k])
  if (b.url_acta !== undefined) {
    const u = texto(b.url_acta)
    if (u && !/^https?:\/\//.test(u)) throw fallo(400, 'El enlace del acta no es válido')
    d.url_acta = u
  }
  if (b.quorum_pct !== undefined) {
    const q = Number(b.quorum_pct)
    if (!Number.isInteger(q) || q < 1 || q > 100) throw fallo(400, 'El quórum debe estar entre 1 y 100')
    d.quorum_pct = q
  }
  if (b.total_miembros !== undefined) {
    const t = Number(b.total_miembros)
    if (!Number.isInteger(t) || t < 0) throw fallo(400, 'El total de miembros no es válido')
    d.total_miembros = t
  }
  if (b.publicada !== undefined) d.publicada = b.publicada ? 1 : 0
  return d
}

export async function listarAsambleas(f: { tipo?: string; anio?: string }) {
  await asegurarAsambleas()
  const where = ['a.eliminado_en IS NULL']; const args: string[] = []
  if (f.tipo && TIPOS_ASAMBLEA.includes(f.tipo as any)) { where.push('a.tipo = ?'); args.push(f.tipo) }
  if (f.anio && /^\d{4}$/.test(f.anio)) { where.push('substr(a.fecha, 1, 4) = ?'); args.push(f.anio) }
  const r = await db.execute({
    sql: `SELECT a.*, (SELECT COUNT(*) FROM asamblea_asistencia s WHERE s.id_asamblea = a.id_asamblea) AS asistentes
          FROM asambleas a WHERE ${where.join(' AND ')} ORDER BY a.fecha DESC, a.id_asamblea DESC`,
    args,
  })
  return r.rows.map(conQuorum)
}

export async function obtenerAsamblea(id: number) {
  await asegurarAsambleas()
  const a = await db.execute({
    sql: `SELECT a.*, (SELECT COUNT(*) FROM asamblea_asistencia s WHERE s.id_asamblea = a.id_asamblea) AS asistentes
          FROM asambleas a WHERE a.id_asamblea = ? AND a.eliminado_en IS NULL`,
    args: [id],
  })
  if (!a.rows.length) throw fallo(404, 'Asamblea no encontrada')
  const asist = await db.execute({
    sql: `SELECT s.id_afiliado, s.condicion, s.representante, s.registrado_en, af.codigo,
                 COALESCE(NULLIF(TRIM(COALESCE(p.nombres,'') || ' ' || COALESCE(p.apellidos,'')), ''), e.razon_social) AS nombre,
                 COALESCE(p.cedula_tipo || '-' || p.cedula, e.rif_numero) AS documento
          FROM asamblea_asistencia s
          JOIN afiliados af ON af.id_afiliado = s.id_afiliado
          LEFT JOIN personas p ON p.id = af.id_persona
          LEFT JOIN empresas e ON e.id_empresa = af.id_empresa
          WHERE s.id_asamblea = ? ORDER BY nombre`,
    args: [id],
  })
  return { ...conQuorum(a.rows[0]), asistencia: asist.rows }
}

export async function crearAsamblea(body: any, idUsuario: number) {
  await asegurarAsambleas()
  const d = validar(body)
  if (d.total_miembros === undefined) d.total_miembros = await miembrosConDerecho()
  const cols = Object.keys(d)
  const r = await db.execute({
    sql: `INSERT INTO asambleas (${cols.join(', ')}, creado_por) VALUES (${cols.map(() => '?').join(', ')}, ?) RETURNING id_asamblea`,
    args: [...(Object.values(d) as any[]), idUsuario],
  })
  return Number(r.rows[0].id_asamblea)
}

export async function actualizarAsamblea(id: number, body: any) {
  await asegurarAsambleas()
  const d = validar(body, true)
  const cols = Object.keys(d)
  if (!cols.length) throw fallo(400, 'No hay cambios que guardar')
  const r = await db.execute({
    sql: `UPDATE asambleas SET ${cols.map(c => `${c} = ?`).join(', ')}, actualizado_en = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id_asamblea = ? AND eliminado_en IS NULL`,
    args: [...(Object.values(d) as any[]), id],
  })
  if (!r.rowsAffected) throw fallo(404, 'Asamblea no encontrada')
}

export async function eliminarAsamblea(id: number) {
  await asegurarAsambleas()
  const r = await db.execute({ sql: `UPDATE asambleas SET eliminado_en = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id_asamblea = ? AND eliminado_en IS NULL`, args: [id] })
  if (!r.rowsAffected) throw fallo(404, 'Asamblea no encontrada')
}

export async function registrarAsistencia(id: number, b: { id_afiliado?: unknown; condicion?: unknown; representante?: unknown }) {
  await asegurarAsambleas()
  const idAfiliado = Number(b.id_afiliado)
  const condicion = (b.condicion ?? 'Presente') as string
  if (!Number.isInteger(idAfiliado) || !CONDICIONES.includes(condicion as any)) throw fallo(400, 'Afiliado o condición inválidos')
  const rep = condicion === 'Representado' ? texto(b.representante) : null
  if (condicion === 'Representado' && !rep) throw fallo(400, 'Indica quién lo representa')
  const [asamblea, afiliado] = await Promise.all([
    db.execute({ sql: `SELECT 1 FROM asambleas WHERE id_asamblea = ? AND eliminado_en IS NULL`, args: [id] }),
    db.execute({ sql: `SELECT 1 FROM afiliados WHERE id_afiliado = ? AND eliminado_en IS NULL`, args: [idAfiliado] }),
  ])
  if (!asamblea.rows.length) throw fallo(404, 'Asamblea no encontrada')
  if (!afiliado.rows.length) throw fallo(404, 'Afiliado no encontrado')
  await db.execute({
    sql: `INSERT INTO asamblea_asistencia (id_asamblea, id_afiliado, condicion, representante) VALUES (?, ?, ?, ?)
          ON CONFLICT (id_asamblea, id_afiliado) DO UPDATE SET condicion = excluded.condicion, representante = excluded.representante`,
    args: [id, idAfiliado, condicion, rep],
  })
}

export async function quitarAsistencia(id: number, idAfiliado: number) {
  await asegurarAsambleas()
  await db.execute({ sql: `DELETE FROM asamblea_asistencia WHERE id_asamblea = ? AND id_afiliado = ?`, args: [id, idAfiliado] })
}

/** Busca afiliados para registrar su asistencia, por nombre, cédula/RIF o código. */
export async function buscarAfiliados(q: string) {
  const t = q.trim().toLowerCase()
  if (t.length < 2) return []
  const digitos = t.replace(/\D/g, '')
  const r = await db.execute({
    sql: `SELECT af.id_afiliado, af.codigo,
                 COALESCE(NULLIF(TRIM(COALESCE(p.nombres,'') || ' ' || COALESCE(p.apellidos,'')), ''), e.razon_social) AS nombre,
                 COALESCE(p.cedula_tipo || '-' || p.cedula, e.rif_numero) AS documento
          FROM afiliados af
          LEFT JOIN personas p ON p.id = af.id_persona
          LEFT JOIN empresas e ON e.id_empresa = af.id_empresa
          WHERE af.eliminado_en IS NULL AND af.estatus = 'Afiliado'
            AND (LOWER(COALESCE(p.nombres,'') || ' ' || COALESCE(p.apellidos,'')) LIKE ? OR LOWER(COALESCE(e.razon_social,'')) LIKE ?
                 OR LOWER(COALESCE(af.codigo,'')) = ? OR (? != '' AND (p.cedula LIKE ? OR e.rif_numero LIKE ?)))
          ORDER BY nombre LIMIT 15`,
    args: [`%${t}%`, `%${t}%`, t, digitos, `%${digitos}%`, `%${digitos}%`],
  })
  return r.rows
}

/** Actas publicadas con PDF, para el sitio público (mismo formato que las normativas). */
export async function actasPublicadas() {
  await asegurarAsambleas()
  const r = await db.execute(`SELECT id_asamblea, tipo, numero_acta, titulo, resumen, url_acta, fecha FROM asambleas
                              WHERE publicada = 1 AND eliminado_en IS NULL AND url_acta IS NOT NULL ORDER BY fecha DESC`)
  return r.rows.map((a: any) => ({
    id_normativa: `asamblea-${a.id_asamblea}`,
    titulo: a.numero_acta ? `${a.titulo} (Acta N° ${a.numero_acta})` : a.titulo,
    descripcion: a.resumen ?? `Asamblea ${a.tipo}`,
    url_archivo: a.url_acta,
    categoria: 'Actas de Asamblea',
    orden: 0,
    creado_en: a.fecha,
  }))
}
