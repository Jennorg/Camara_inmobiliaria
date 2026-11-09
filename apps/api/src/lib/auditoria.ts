// Auditoría: quién hizo qué, cuándo y sobre qué registro. Un middleware registra cada acción de escritura de un usuario autenticado.

type Db = { execute: (s: any) => Promise<any>; batch: (s: any[], mode?: any) => Promise<any> }

/** Tablas con borrado lógico: ganan `eliminado_por` para saber quién borró. */
export const TABLAS_BORRADO_LOGICO = ['cms_noticias', 'cms_cursos', 'cms_convenios', 'cms_hitos', 'cms_normativas', 'cursos', 'users', 'afiliados', 'personas', 'empresas', 'estudiantes', 'documentos']

let esquemaListo: Promise<void> | null = null
/** Idempotente: crea la tabla de auditoría y agrega `eliminado_por` donde falte. Se ejecuta una vez por proceso. */
export const asegurarEsquemaAuditoria = (db: Db): Promise<void> => {
  esquemaListo ??= (async () => {
    await db.batch([
      `CREATE TABLE IF NOT EXISTS auditoria (
        id            INTEGER PRIMARY KEY,
        creado_en     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
        id_user       INTEGER,
        email         TEXT,
        rol           TEXT,
        suplantado_por INTEGER,
        accion        TEXT    NOT NULL,
        modulo        TEXT,
        entidad       TEXT,
        id_entidad    TEXT,
        metodo        TEXT,
        ruta          TEXT,
        estado        INTEGER,
        resumen       TEXT,
        antes         TEXT,
        despues       TEXT,
        ip            TEXT
      )`,
      `CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON auditoria(creado_en)`,
      `CREATE INDEX IF NOT EXISTS idx_auditoria_user ON auditoria(id_user)`,
      `CREATE INDEX IF NOT EXISTS idx_auditoria_entidad ON auditoria(entidad, id_entidad)`,
    ], 'write')
    for (const t of TABLAS_BORRADO_LOGICO) {
      const cols = ((await db.execute(`PRAGMA table_info("${t}")`)).rows as any[]).map(c => String(c.name))
      if (cols.length && !cols.includes('eliminado_por')) await db.execute(`ALTER TABLE "${t}" ADD COLUMN eliminado_por INTEGER`)
    }
  })().catch(e => { esquemaListo = null; throw e })
  return esquemaListo
}
/** Solo para pruebas: fuerza a recrear el esquema en una base nueva. */
export const reiniciarEsquemaAuditoria = () => { esquemaListo = null }

// ── Datos sensibles y tamaño ────────────────────────────────────────────────
const SENSIBLE = /pass|contrase|token|secret|authorization|cookie|base64/i
const MAX_TEXTO = 300
const MAX_JSON = 6000

/** Copia de un objeto apta para guardar: sin claves sensibles ni archivos, con textos y listas acotados. */
export function sanitizar(valor: unknown, profundidad = 0): unknown {
  if (valor === null || valor === undefined) return valor
  if (Buffer.isBuffer(valor) || valor instanceof ArrayBuffer) return '[archivo]'
  if (typeof valor === 'string') return valor.length > MAX_TEXTO ? `${valor.slice(0, MAX_TEXTO)}…` : valor
  if (typeof valor !== 'object') return valor
  if (profundidad >= 4) return '[…]'
  if (Array.isArray(valor)) return valor.slice(0, 20).map(v => sanitizar(v, profundidad + 1))
  return Object.fromEntries(Object.entries(valor as Record<string, unknown>).map(([k, v]) => [k, SENSIBLE.test(k) ? '[omitido]' : sanitizar(v, profundidad + 1)]))
}
export const aJson = (valor: unknown): string | null => {
  if (valor === null || valor === undefined) return null
  const s = JSON.stringify(sanitizar(valor))
  return s.length > MAX_JSON ? JSON.stringify({ _truncado: true, vista_previa: s.slice(0, 500) }) : s
}

// ── Qué acción y sobre qué registro ─────────────────────────────────────────
const ACCIONES_POR_PALABRA: [RegExp, string][] = [
  [/restaur/, 'restaurar'], [/aprob/, 'aprobar'], [/rechaz/, 'rechazar'], [/verific/, 'verificar'], [/remitir/, 'remitir'],
  [/finalizar/, 'finalizar'], [/etapa/, 'cambiar_etapa'], [/reorder/, 'reordenar'], [/generar/, 'generar'], [/impersonar|suplant/, 'suplantar'],
  [/cobro|cobrar/, 'cobrar'], [/cerrar|cierre/, 'cerrar'], [/asignar/, 'asignar'], [/anular/, 'anular'], [/agendar/, 'agendar'],
]
export function accionDe(metodo: string, ruta: string): string {
  if (metodo === 'DELETE') return 'eliminar'
  const final = ruta.split('/').filter(Boolean).filter(s => !/^\d+$/.test(s)).slice(-2).join('/').toLowerCase()
  for (const [re, accion] of ACCIONES_POR_PALABRA) if (re.test(final)) return accion
  return metodo === 'POST' ? 'crear' : 'editar'
}

export interface EntidadDeRuta { modulo: string; entidad: string; id: string | null }
/** /api/cms/noticias/12 → { modulo: 'cms', entidad: 'noticias', id: '12' } */
export function entidadDeRuta(ruta: string): EntidadDeRuta {
  const seg = ruta.replace(/^\/api\//, '').split('?')[0].split('/').filter(Boolean)
  const modulo = seg[0] ?? ''
  const i = seg.findIndex((s, k) => k > 0 && /^\d+$/.test(s))
  if (i > 0) return { modulo, entidad: seg[i - 1], id: seg[i] }
  const sinNumeros = seg.filter(s => !/^\d+$/.test(s))
  return { modulo, entidad: sinNumeros[sinNumeros.length - 1] ?? modulo, id: null }
}

/** Rutas cuyo registro se fotografía ANTES de editarlo o borrarlo (el "antes" de la auditoría). */
export const TABLA_POR_RUTA: Record<string, { tabla: string; pk: string }> = {
  'cms/noticias': { tabla: 'cms_noticias', pk: 'id_noticia' },
  'cms/cursos': { tabla: 'cms_cursos', pk: 'id_cms_curso' },
  'cms/convenios': { tabla: 'cms_convenios', pk: 'id_convenio' },
  'cms/hitos': { tabla: 'cms_hitos', pk: 'id_hito' },
  'cms/normativas': { tabla: 'cms_normativas', pk: 'id_normativa' },
  'academia/cursos': { tabla: 'cursos', pk: 'id_curso' },
  'users/users': { tabla: 'users', pk: 'id' },
  'afiliados/afiliados': { tabla: 'afiliados', pk: 'id_afiliado' },
  'academia/inscripciones': { tabla: 'inscripciones_cursos', pk: 'id_inscripcion' },
}
export const tablaDeRuta = (e: EntidadDeRuta) => TABLA_POR_RUTA[`${e.modulo}/${e.entidad}`] ?? (e.modulo === e.entidad ? TABLA_POR_RUTA[`${e.modulo}/${e.modulo}`] : undefined)

export interface RegistroAuditoria {
  id_user: number | null; email: string | null; rol: string | null; suplantado_por: number | null
  accion: string; modulo: string; entidad: string; id_entidad: string | null
  metodo: string; ruta: string; estado: number; resumen: string
  antes: unknown; despues: unknown; ip: string | null
}
export async function registrarAuditoria(db: Db, r: RegistroAuditoria): Promise<void> {
  await asegurarEsquemaAuditoria(db)
  await db.execute({
    sql: `INSERT INTO auditoria (id_user, email, rol, suplantado_por, accion, modulo, entidad, id_entidad, metodo, ruta, estado, resumen, antes, despues, ip)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [r.id_user, r.email, r.rol, r.suplantado_por, r.accion, r.modulo, r.entidad, r.id_entidad, r.metodo, r.ruta, r.estado, r.resumen, aJson(r.antes), aJson(r.despues), r.ip],
  })
}

/**
 * Fotografía de registros (antes de un borrado definitivo): { tabla: [filas] }. Sirve para saber qué se perdió y quién lo hizo.
 * Nunca incluye hashes de contraseña.
 */
export async function fotografiar(db: Db, especificacion: Record<string, [pk: string, ids: (string | number | null | undefined)[]]>): Promise<Record<string, unknown[]>> {
  const salida: Record<string, unknown[]> = {}
  for (const [tabla, [pk, todos]] of Object.entries(especificacion)) {
    const ids = todos.filter((i): i is string | number => i !== null && i !== undefined)
    if (!ids.length) continue
    const filas = (await db.execute({ sql: `SELECT * FROM "${tabla}" WHERE "${pk}" IN (${ids.map(() => '?').join(',')})`, args: ids })).rows as any[]
    salida[tabla] = filas.map(f => { const { password_hash, ...resto } = { ...f }; void password_hash; return resto })
  }
  return salida
}
