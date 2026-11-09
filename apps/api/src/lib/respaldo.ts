import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { crearZip, esZip, leerZip } from './zip.js'

// Respaldo lógico de la base: los DATOS de cada tabla en un JSON dentro de un .zip (Windows lo abre sin instalar nada). El esquema lo gestiona initdb, no se respalda.
// Restaurar reemplaza el contenido de las tablas que existen en el respaldo y en la base actual, en una sola transacción.

type Db = { execute: (s: any) => Promise<any>; batch: (s: any[], mode?: any) => Promise<any> }

export const VERSION_RESPALDO = 1
/** Datos volátiles que no se respaldan ni se restauran: restaurar no debe revivir sesiones ya cerradas. */
export const TABLAS_EXCLUIDAS = ['user_refresh_tokens']

type Valor = string | number | bigint | ArrayBuffer | null
export interface TablaRespaldo { columnas: string[]; filas: unknown[][] }
export interface Respaldo {
  version: number
  generado_en: string
  checksum: string
  tablas: Record<string, TablaRespaldo>
}
export interface ResumenRespaldo { generado_en: string; tablas: number; filas: number }

// JSON no distingue bigint ni BLOB: se marcan para recuperarlos tal cual al restaurar.
export const codificar = (v: Valor): unknown =>
  typeof v === 'bigint' ? { $bigint: v.toString() }
    : v instanceof ArrayBuffer ? { $b64: Buffer.from(v).toString('base64') }
      : v
export const decodificar = (v: any): any => {
  if (v && typeof v === 'object' && '$bigint' in v) return BigInt(v.$bigint)
  if (v && typeof v === 'object' && '$b64' in v) return new Uint8Array(Buffer.from(v.$b64, 'base64'))
  return v
}

const checksumDe = (tablas: Record<string, TablaRespaldo>) => createHash('sha256').update(JSON.stringify(tablas)).digest('hex')
const comillas = (n: string) => `"${n.replace(/"/g, '""')}"`
const nombresDeTablas = async (db: Db): Promise<string[]> =>
  ((await db.execute(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`)).rows as any[]).map(r => String(r.name))

/** Lee todas las tablas en una sola transacción de lectura: una foto consistente aunque haya escrituras en curso. */
export async function generarRespaldo(db: Db): Promise<Respaldo> {
  const nombres = (await nombresDeTablas(db)).filter(n => !TABLAS_EXCLUIDAS.includes(n))
  const lecturas = nombres.length ? await db.batch(nombres.map(n => `SELECT * FROM ${comillas(n)}`), 'read') : []
  const tablas: Record<string, TablaRespaldo> = {}
  nombres.forEach((n, i) => {
    const r = lecturas[i]
    tablas[n] = { columnas: [...r.columns], filas: r.rows.map((fila: any) => r.columns.map((_: string, c: number) => codificar(fila[c]))) }
  })
  return { version: VERSION_RESPALDO, generado_en: new Date().toISOString(), checksum: checksumDe(tablas), tablas }
}

export const resumir = (r: Respaldo): ResumenRespaldo => ({
  generado_en: r.generado_en,
  tablas: Object.keys(r.tablas).length,
  filas: Object.values(r.tablas).reduce((s, t) => s + t.filas.length, 0),
})

export const empaquetar = (r: Respaldo): Buffer =>
  crearZip(`ciebo-respaldo-${r.generado_en.slice(0, 16).replace(/[-:]/g, '').replace('T', '-')}.json`, Buffer.from(JSON.stringify(r)), new Date(r.generado_en))

/** Acepta .zip, .json.gz (respaldos anteriores) o JSON sin comprimir. Lanza Error con mensaje para el usuario si no es válido. */
export function leerRespaldo(contenido: Buffer): Respaldo {
  let r: any
  try {
    const esGzip = contenido.length > 2 && contenido[0] === 0x1f && contenido[1] === 0x8b
    r = JSON.parse((esZip(contenido) ? leerZip(contenido) : esGzip ? gunzipSync(contenido) : contenido).toString('utf8'))
  } catch {
    throw new Error('El archivo no es un respaldo válido.')
  }
  if (!r || r.version !== VERSION_RESPALDO || typeof r.tablas !== 'object' || r.tablas === null || typeof r.checksum !== 'string') {
    throw new Error('El archivo no es un respaldo válido de esta plataforma.')
  }
  for (const t of Object.values(r.tablas) as any[]) {
    if (!Array.isArray(t?.columnas) || !Array.isArray(t?.filas)) throw new Error('El respaldo está dañado: estructura de tablas inválida.')
  }
  if (checksumDe(r.tablas) !== r.checksum) throw new Error('El respaldo está dañado o fue modificado: la verificación de integridad falló.')
  return r as Respaldo
}

export interface ResultadoRestauracion { tablas: number; filas: number; omitidas: string[] }

/**
 * Reemplaza los datos de cada tabla del respaldo que exista en la base actual. Todo en una transacción:
 * si algo falla no se cambia nada. Las claves foráneas se validan al final (no fila a fila), así el orden no importa.
 * Las tablas que ya no existen en la base, o que el respaldo no trae, se dejan intactas.
 */
export async function restaurarRespaldo(db: Db, r: Respaldo): Promise<ResultadoRestauracion> {
  const actuales = new Set(await nombresDeTablas(db))
  const sentencias: { sql: string; args?: any[] }[] = [{ sql: 'PRAGMA defer_foreign_keys = ON' }]
  const omitidas: string[] = []
  let tablas = 0, filas = 0

  for (const [nombre, t] of Object.entries(r.tablas)) {
    if (!actuales.has(nombre) || TABLAS_EXCLUIDAS.includes(nombre)) { omitidas.push(nombre); continue }
    const columnasActuales = new Set(((await db.execute(`PRAGMA table_info(${comillas(nombre)})`)).rows as any[]).map(c => String(c.name)))
    // Solo las columnas que existen en ambos lados: un esquema que evolucionó no impide restaurar.
    const idx = t.columnas.map((c, i) => (columnasActuales.has(c) ? i : -1)).filter(i => i >= 0)
    sentencias.push({ sql: `DELETE FROM ${comillas(nombre)}` })
    tablas++
    if (!idx.length || !t.filas.length) continue
    const cols = idx.map(i => comillas(t.columnas[i])).join(', ')
    const porLote = Math.max(1, Math.min(200, Math.floor(30000 / idx.length)))
    for (let i = 0; i < t.filas.length; i += porLote) {
      const lote = t.filas.slice(i, i + porLote)
      sentencias.push({
        sql: `INSERT INTO ${comillas(nombre)} (${cols}) VALUES ${lote.map(() => `(${idx.map(() => '?').join(',')})`).join(',')}`,
        args: lote.flatMap(fila => idx.map(c => decodificar(fila[c]))),
      })
    }
    filas += t.filas.length
  }
  await db.batch(sentencias, 'write')
  return { tablas, filas, omitidas }
}
