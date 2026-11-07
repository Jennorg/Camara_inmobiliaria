// Secciones (categorías) de documentos del Marco Legal: tabla cms_normativa_secciones.
// Los documentos guardan la categoría por NOMBRE en cms_normativas.categoria; el slug no cambia al renombrar.

type Db = { execute: (s: any) => Promise<any>; batch: (s: any[], mode?: any) => Promise<any> }

export const DDL_SECCIONES_NORMATIVA = `CREATE TABLE IF NOT EXISTS cms_normativa_secciones (
    id          INTEGER     PRIMARY KEY,
    nombre      TEXT        UNIQUE NOT NULL,
    slug        TEXT        UNIQUE NOT NULL,
    orden       INTEGER     NOT NULL DEFAULT 0,
    publica     INTEGER     NOT NULL DEFAULT 1 CHECK (publica IN (0,1)),
    creado_en   TEXT        NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  )`

export const SECCIONES_NORMATIVA_ORIGINALES = ['Leyes y Decretos', 'Reglamentos y Estatutos', 'Normas y Procedimientos', 'Actas de Asamblea']

// Categoría reservada (solo admin, nunca pública): no puede ser nombre de sección.
export const CATEGORIA_OTROS = 'Otros'

export const slugify = (nombre: string): string =>
  nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

// Solo siembra si la tabla está vacía: así una sección original borrada no reaparece al volver a correr initdb.
export async function sembrarSeccionesNormativa(db: Db): Promise<void> {
  await db.execute(DDL_SECCIONES_NORMATIVA)
  const r = await db.execute('SELECT COUNT(*) AS n FROM cms_normativa_secciones')
  if (Number(r.rows[0]?.n ?? 0) > 0) return
  await db.batch(SECCIONES_NORMATIVA_ORIGINALES.map((nombre, i) => ({
    sql: 'INSERT OR IGNORE INTO cms_normativa_secciones (nombre, slug, orden, publica) VALUES (?, ?, ?, 1)',
    args: [nombre, slugify(nombre), i],
  })), 'write')
}
