import { codificar, decodificar } from './respaldo.js'

// «Papelera por instantánea»: al borrar un registro que arrastra otros (una preinscripción con su estudiante, persona,
// usuario y afiliado, p. ej.) se guarda una copia completa de todo lo que se va a perder. Restaurar lo vuelve a crear.
// No toca las consultas existentes: el registro desaparece de verdad de las tablas vivas, así el re-registro no choca.

type Db = { execute: (s: any) => Promise<any>; batch: (s: any[], mode?: any) => Promise<any> }
type Fila = Record<string, unknown>
export interface Semilla { tabla: string; donde: string; args: (string | number)[] }
export type Instantanea = Record<string, Fila[]>
export interface ItemInstantanea { id: number; tipo: string; id_entidad: string; nombre: string; filas: number; eliminado_en: string; eliminado_por: string | null }

const comillas = (n: string) => `"${n.replace(/"/g, '""')}"`

let esquemaListo: Promise<void> | null = null
export const asegurarEsquemaInstantaneas = (db: Db): Promise<void> => {
  esquemaListo ??= db.execute(`CREATE TABLE IF NOT EXISTS papelera_instantaneas (
    id            INTEGER PRIMARY KEY,
    tipo          TEXT    NOT NULL,
    id_entidad    TEXT    NOT NULL,
    nombre        TEXT    NOT NULL,
    eliminado_en  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    eliminado_por INTEGER,
    filas         INTEGER NOT NULL,
    datos         TEXT    NOT NULL
  )`).then(() => undefined).catch(e => { esquemaListo = null; throw e })
  return esquemaListo
}
export const reiniciarEsquemaInstantaneas = () => { esquemaListo = null }

interface Relacion { hijo: string; desde: string; hacia: string; cascada: boolean }
/** Relaciones FK de toda la base: qué tabla depende de cuál, y si al borrar el padre se borra el hijo. */
async function relaciones(db: Db): Promise<{ porPadre: Map<string, Relacion[]>; pk: Map<string, string> }> {
  const tablas = ((await db.execute(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`)).rows as any[]).map(r => String(r.name))
  const pk = new Map<string, string>()
  const porPadre = new Map<string, Relacion[]>()
  for (const t of tablas) {
    const info = (await db.execute(`PRAGMA table_info(${comillas(t)})`)).rows as any[]
    pk.set(t, String(info.find(c => Number(c.pk) === 1)?.name ?? 'rowid'))
  }
  for (const t of tablas) {
    for (const fk of (await db.execute(`PRAGMA foreign_key_list(${comillas(t)})`)).rows as any[]) {
      const padre = String(fk.table)
      const r: Relacion = { hijo: t, desde: String(fk.from), hacia: String(fk.to ?? pk.get(padre) ?? 'rowid'), cascada: String(fk.on_delete).toUpperCase() === 'CASCADE' }
      porPadre.set(padre, [...(porPadre.get(padre) ?? []), r])
    }
  }
  return { porPadre, pk }
}

/** Copia las filas de las semillas y, en cascada, todas las que dependen de ellas (las que se perderían con ON DELETE CASCADE). */
export async function capturar(db: Db, semillas: Semilla[]): Promise<Instantanea> {
  const { porPadre } = await relaciones(db)
  const salida: Instantanea = {}
  const vistos = new Set<string>()
  const cola: Semilla[] = [...semillas]
  while (cola.length) {
    const { tabla, donde, args } = cola.shift()!
    const res = await db.execute({ sql: `SELECT * FROM ${comillas(tabla)} WHERE ${donde}`, args })
    const nuevas: Fila[] = []
    for (const f of res.rows as any[]) {
      const fila = Object.fromEntries((res.columns as string[]).map((c, i) => [c, codificar(f[i])]))
      const clave = `${tabla}|${JSON.stringify(fila)}`
      if (vistos.has(clave)) continue
      vistos.add(clave); nuevas.push(fila); (salida[tabla] ??= []).push(fila)
    }
    if (!nuevas.length) continue
    for (const rel of (porPadre.get(tabla) ?? []).filter(r => r.cascada)) {
      const valores = [...new Set(nuevas.map(f => f[rel.hacia]).filter(v => v !== null && v !== undefined))] as (string | number)[]
      if (valores.length) cola.push({ tabla: rel.hijo, donde: `${comillas(rel.desde)} IN (${valores.map(() => '?').join(',')})`, args: valores })
    }
  }
  return salida
}

export const contarFilas = (i: Instantanea) => Object.values(i).reduce((s, f) => s + f.length, 0)

export async function guardarInstantanea(db: Db, d: { tipo: string; idEntidad: string | number; nombre: string; eliminadoPor: number | null | undefined; semillas: Semilla[] }): Promise<number> {
  await asegurarEsquemaInstantaneas(db)
  const datos = await capturar(db, d.semillas)
  const r = await db.execute({
    sql: `INSERT INTO papelera_instantaneas (tipo, id_entidad, nombre, eliminado_por, filas, datos) VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
    args: [d.tipo, String(d.idEntidad), d.nombre, d.eliminadoPor ?? null, contarFilas(datos), JSON.stringify(datos)],
  })
  return Number(r.rows[0].id)
}

export async function listarInstantaneas(db: Db, tipo?: string): Promise<ItemInstantanea[]> {
  await asegurarEsquemaInstantaneas(db)
  const r = await db.execute({
    sql: `SELECT i.id, i.tipo, i.id_entidad, i.nombre, i.filas, i.eliminado_en, u.email AS eliminado_por
          FROM papelera_instantaneas i LEFT JOIN users u ON u.id = i.eliminado_por ${tipo ? 'WHERE i.tipo = ?' : ''} ORDER BY i.id DESC LIMIT 200`,
    args: tipo ? [tipo] : [],
  })
  return (r.rows as any[]).map(x => ({ id: Number(x.id), tipo: String(x.tipo), id_entidad: String(x.id_entidad), nombre: String(x.nombre), filas: Number(x.filas), eliminado_en: String(x.eliminado_en), eliminado_por: x.eliminado_por ?? null }))
}

export async function eliminarInstantanea(db: Db, id: number): Promise<boolean> {
  await asegurarEsquemaInstantaneas(db)
  return (await db.execute({ sql: `DELETE FROM papelera_instantaneas WHERE id = ?`, args: [id] })).rowsAffected > 0
}

export interface ResultadoRestauracion { restauradas: number; yaExistian: number }
/**
 * Vuelve a crear las filas de una instantánea (padres antes que hijos), en una sola transacción.
 * Las filas que ya existen se respetan (OR IGNORE): si la persona se volvió a registrar mientras tanto, no se pisa su registro nuevo.
 * Devuelve null si la instantánea no existe; lanza Error si la base rechaza algo (no se modifica nada).
 */
export async function restaurarInstantanea(db: Db, id: number): Promise<ResultadoRestauracion | null> {
  await asegurarEsquemaInstantaneas(db)
  const r = await db.execute({ sql: `SELECT datos FROM papelera_instantaneas WHERE id = ?`, args: [id] })
  if (!r.rows.length) return null
  const datos = JSON.parse(String(r.rows[0].datos)) as Instantanea
  const { porPadre } = await relaciones(db)

  // Orden: un padre se inserta antes que sus hijos
  const presentes = new Set(Object.keys(datos))
  const dependeDe = new Map<string, Set<string>>()
  for (const [padre, rels] of porPadre) for (const rel of rels) if (presentes.has(padre) && presentes.has(rel.hijo) && padre !== rel.hijo) dependeDe.set(rel.hijo, (dependeDe.get(rel.hijo) ?? new Set()).add(padre))
  const orden: string[] = []; const pendientes = new Set(presentes)
  while (pendientes.size) {
    const listo = [...pendientes].find(t => [...(dependeDe.get(t) ?? [])].every(p => !pendientes.has(p))) ?? [...pendientes][0] // ciclo: se inserta igual (las FK se validan al final)
    orden.push(listo); pendientes.delete(listo)
  }

  const columnasActuales = async (t: string) => new Set(((await db.execute(`PRAGMA table_info(${comillas(t)})`)).rows as any[]).map(c => String(c.name)))
  const sentencias: { sql: string; args?: any[] }[] = [{ sql: 'PRAGMA defer_foreign_keys = ON' }]
  let total = 0
  for (const t of orden) {
    const existentes = await columnasActuales(t)
    for (const fila of datos[t]) {
      const cols = Object.keys(fila).filter(c => existentes.has(c))
      if (!cols.length) continue
      sentencias.push({ sql: `INSERT OR IGNORE INTO ${comillas(t)} (${cols.map(comillas).join(', ')}) VALUES (${cols.map(() => '?').join(',')})`, args: cols.map(c => decodificar(fila[c])) })
      total++
    }
  }
  const resultados = await db.batch(sentencias, 'write')
  const restauradas = (resultados as any[]).slice(1).reduce((s, x) => s + Number(x.rowsAffected ?? 0), 0)
  await db.execute({ sql: `DELETE FROM papelera_instantaneas WHERE id = ?`, args: [id] })
  return { restauradas, yaExistian: total - restauradas }
}
