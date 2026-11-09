import { createClient } from '@libsql/client'
import { beforeEach, describe, expect, it } from 'vitest'
import { empaquetar, generarRespaldo, leerRespaldo, resumir, restaurarRespaldo } from './respaldo.js'

let db: ReturnType<typeof createClient>
const filas = async (sql: string) => (await db.execute(sql)).rows.map(r => ({ ...r }))

beforeEach(async () => {
  db = createClient({ url: ':memory:' })
  await db.execute('PRAGMA foreign_keys = ON')
  await db.batch([
    `CREATE TABLE padres (id INTEGER PRIMARY KEY, nombre TEXT NOT NULL)`,
    `CREATE TABLE hijos (id INTEGER PRIMARY KEY, id_padre INTEGER NOT NULL REFERENCES padres(id) ON DELETE CASCADE, nota TEXT, foto BLOB)`,
    `CREATE TABLE user_refresh_tokens (id INTEGER PRIMARY KEY, token TEXT)`,
    `INSERT INTO padres VALUES (1, 'Ana'), (2, 'Luis')`,
    `INSERT INTO hijos VALUES (1, 1, 'ñandú', x'00ff10'), (2, 2, NULL, NULL), (3, 1, 'tilde á', NULL)`,
    `INSERT INTO user_refresh_tokens VALUES (1, 'sesion-abierta')`,
  ], 'write')
})

describe('respaldo', () => {
  it('genera, empaqueta, lee y restaura devolviendo los datos exactos (con BLOB, NULL y cascada)', async () => {
    const original = { padres: await filas('SELECT * FROM padres'), hijos: await filas('SELECT id, id_padre, nota, hex(foto) AS foto FROM hijos') }
    const respaldo = leerRespaldo(empaquetar(await generarRespaldo(db)))
    expect(resumir(respaldo)).toMatchObject({ tablas: 2, filas: 5 })

    await db.batch(['DELETE FROM padres', `INSERT INTO padres VALUES (9, 'Intruso')`, `UPDATE user_refresh_tokens SET token = 'otra'`], 'write') // la cascada vacía hijos
    const r = await restaurarRespaldo(db, respaldo)

    expect(r).toMatchObject({ tablas: 2, filas: 5, omitidas: [] })
    expect(await filas('SELECT * FROM padres')).toEqual(original.padres)
    expect(await filas('SELECT id, id_padre, nota, hex(foto) AS foto FROM hijos')).toEqual(original.hijos)
  })

  it('no respalda ni toca las sesiones (user_refresh_tokens)', async () => {
    const respaldo = await generarRespaldo(db)
    expect(Object.keys(respaldo.tablas)).not.toContain('user_refresh_tokens')
    await db.execute(`UPDATE user_refresh_tokens SET token = 'nueva-sesion'`)
    await restaurarRespaldo(db, respaldo)
    expect(await filas('SELECT token FROM user_refresh_tokens')).toEqual([{ token: 'nueva-sesion' }])
  })

  it('rechaza archivos que no son un respaldo o que fueron alterados', async () => {
    expect(() => leerRespaldo(Buffer.from('hola'))).toThrow(/no es un respaldo válido/)
    expect(() => leerRespaldo(Buffer.from(JSON.stringify({ version: 99, tablas: {}, checksum: 'x' })))).toThrow(/válido de esta plataforma/)
    const r = await generarRespaldo(db)
    r.tablas.padres.filas[0][1] = 'Alterado'
    expect(() => leerRespaldo(empaquetar(r))).toThrow(/integridad/)
  })

  it('tablas o columnas que cambiaron: omite lo que ya no existe y deja intactas las tablas que el respaldo no trae', async () => {
    const r = await generarRespaldo(db)
    await db.batch([`CREATE TABLE nueva (id INTEGER PRIMARY KEY)`, `INSERT INTO nueva VALUES (1)`], 'write')
    r.tablas.fantasma = { columnas: ['id'], filas: [[1]] }
    r.tablas.padres.columnas.push('columna_vieja')
    r.tablas.padres.filas.forEach(f => f.push('x'))
    // el checksum cubre las tablas: se recalcula como lo haría un respaldo legítimo
    const sellado = leerRespaldo(empaquetar({ ...(await generarRespaldo(db)), tablas: { ...r.tablas }, checksum: (await import('node:crypto')).createHash('sha256').update(JSON.stringify(r.tablas)).digest('hex') }))
    const res = await restaurarRespaldo(db, sellado)
    expect(res.omitidas).toEqual(['fantasma'])
    expect(await filas('SELECT * FROM nueva')).toEqual([{ id: 1 }])
    expect(await filas('SELECT COUNT(*) AS n FROM padres')).toEqual([{ n: 2 }])
  })

  it('es atómica: si el respaldo viola una restricción no cambia nada', async () => {
    const r = await generarRespaldo(db)
    r.tablas.hijos.filas.push([99, 12345, 'huérfano', null]) // padre inexistente
    r.checksum = (await import('node:crypto')).createHash('sha256').update(JSON.stringify(r.tablas)).digest('hex')
    await db.execute(`INSERT INTO padres VALUES (7, 'Sigue aquí')`)
    await expect(restaurarRespaldo(db, leerRespaldo(empaquetar(r)))).rejects.toThrow()
    expect(await filas('SELECT id FROM padres ORDER BY id')).toEqual([{ id: 1 }, { id: 2 }, { id: 7 }])
    expect(await filas('SELECT COUNT(*) AS n FROM hijos')).toEqual([{ n: 3 }])
  })
})
