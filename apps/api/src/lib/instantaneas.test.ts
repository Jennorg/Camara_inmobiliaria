import { createClient } from '@libsql/client'
import { beforeEach, describe, expect, it } from 'vitest'
import { capturar, guardarInstantanea, listarInstantaneas, reiniciarEsquemaInstantaneas, restaurarInstantanea } from './instantaneas.js'

let db: ReturnType<typeof createClient>
const filas = async (sql: string) => (await db.execute(sql)).rows.map(r => ({ ...r }))

beforeEach(async () => {
  reiniciarEsquemaInstantaneas()
  db = createClient({ url: ':memory:' })
  await db.execute('PRAGMA foreign_keys = ON')
  await db.batch([
    `CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT UNIQUE, password_hash TEXT)`,
    `CREATE TABLE personas (id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, nombre TEXT)`,
    `CREATE TABLE afiliados (id_afiliado INTEGER PRIMARY KEY, id_persona INTEGER UNIQUE NOT NULL REFERENCES personas(id) ON DELETE CASCADE, id_user INTEGER REFERENCES users(id) ON DELETE SET NULL)`,
    `CREATE TABLE estudiantes (id_estudiante INTEGER PRIMARY KEY, id_persona INTEGER UNIQUE NOT NULL REFERENCES personas(id) ON DELETE CASCADE)`,
    `CREATE TABLE inscripciones (id_inscripcion INTEGER PRIMARY KEY, id_estudiante INTEGER NOT NULL REFERENCES estudiantes(id_estudiante) ON DELETE CASCADE, nota TEXT, foto BLOB)`,
    `CREATE TABLE modulos (id INTEGER PRIMARY KEY, id_inscripcion INTEGER NOT NULL REFERENCES inscripciones(id_inscripcion) ON DELETE CASCADE, estatus TEXT)`,
    `CREATE TABLE documentos (id INTEGER PRIMARY KEY, entidad_tipo TEXT, entidad_id INTEGER, nombre TEXT)`,
    `INSERT INTO users VALUES (1, 'ana@x.test', 'hash-secreto'), (2, 'otro@x.test', 'h2')`,
    `INSERT INTO personas VALUES (1, 'ana@x.test', 'Ana'), (2, 'otro@x.test', 'Otro')`,
    `INSERT INTO afiliados VALUES (1, 1, 1), (2, 2, 2)`,
    `INSERT INTO estudiantes VALUES (1, 1), (2, 2)`,
    `INSERT INTO inscripciones VALUES (1, 1, 'nota ñ', x'00ff10'), (2, 1, NULL, NULL), (3, 2, 'ajena', NULL)`,
    `INSERT INTO modulos VALUES (1, 1, 'ok'), (2, 2, 'ok'), (3, 3, 'ajeno')`,
    `INSERT INTO documentos VALUES (1, 'estudiante', 1, 'cv.pdf'), (2, 'estudiante', 2, 'ajeno.pdf')`,
  ], 'write')
})

const semillasAna = [
  { tabla: 'personas', donde: 'id = ?', args: [1] },
  { tabla: 'users', donde: 'id = ?', args: [1] },
  { tabla: 'documentos', donde: `entidad_tipo = 'estudiante' AND entidad_id = ?`, args: [1] },
]

describe('instantáneas de la papelera', () => {
  it('captura la fila y, en cascada, todo lo que se perdería: nunca lo ajeno ni lo que solo quedaría sin enlace', async () => {
    const i = await capturar(db, semillasAna)
    expect(Object.keys(i).sort()).toEqual(['afiliados', 'documentos', 'estudiantes', 'inscripciones', 'modulos', 'personas', 'users'])
    expect(i.inscripciones).toHaveLength(2)               // solo las del estudiante 1
    expect(i.modulos).toHaveLength(2)                     // nieto: módulos de esas inscripciones
    expect(i.documentos).toHaveLength(1)
    expect(i.personas.map(p => p.nombre)).toEqual(['Ana'])
  })

  it('borrar y restaurar devuelve todo exactamente igual, incluso BLOB, NULL y el hash del usuario', async () => {
    const antes = { insc: await filas('SELECT id_inscripcion, id_estudiante, nota, hex(foto) AS foto FROM inscripciones ORDER BY 1'), user: await filas('SELECT * FROM users ORDER BY id'), mod: await filas('SELECT * FROM modulos ORDER BY id') }
    const id = await guardarInstantanea(db, { tipo: 'inscripcion', idEntidad: 1, nombre: 'Preinscripción de Ana', eliminadoPor: 2, semillas: semillasAna })
    await db.batch([`DELETE FROM personas WHERE id = 1`, `DELETE FROM users WHERE id = 1`, `DELETE FROM documentos WHERE entidad_id = 1`], 'write') // la cascada vacía el resto
    expect(await filas('SELECT COUNT(*) AS n FROM inscripciones')).toEqual([{ n: 1 }])

    expect((await listarInstantaneas(db))[0]).toMatchObject({ id, tipo: 'inscripcion', nombre: 'Preinscripción de Ana', filas: 9 })
    const r = await restaurarInstantanea(db, id)

    expect(r).toEqual({ restauradas: 9, yaExistian: 0 })
    expect(await filas('SELECT id_inscripcion, id_estudiante, nota, hex(foto) AS foto FROM inscripciones ORDER BY 1')).toEqual(antes.insc)
    expect(await filas('SELECT * FROM users ORDER BY id')).toEqual(antes.user)
    expect(await filas('SELECT * FROM modulos ORDER BY id')).toEqual(antes.mod)
    expect(await filas('SELECT id_user FROM afiliados WHERE id_afiliado = 1')).toEqual([{ id_user: 1 }])
    expect(await listarInstantaneas(db)).toEqual([])      // ya no está en la papelera
  })

  it('respeta lo que ya existe: si la persona se volvió a registrar, no se pisa su registro nuevo', async () => {
    const id = await guardarInstantanea(db, { tipo: 'afiliado', idEntidad: 1, nombre: 'Ana', eliminadoPor: 2, semillas: semillasAna })
    await db.batch([`DELETE FROM personas WHERE id = 1`, `DELETE FROM users WHERE id = 1`, `INSERT INTO personas VALUES (1, 'ana@x.test', 'Ana (nuevo registro)')`], 'write')
    const r = await restaurarInstantanea(db, id)
    expect(r!.yaExistian).toBeGreaterThan(0)
    expect(await filas('SELECT nombre FROM personas WHERE id = 1')).toEqual([{ nombre: 'Ana (nuevo registro)' }])
  })

  it('es atómica: si la persona se volvió a registrar con otro id y el mismo correo, restaurar se rechaza sin cambiar nada y la instantánea se conserva', async () => {
    const id = await guardarInstantanea(db, { tipo: 'inscripcion', idEntidad: 1, nombre: 'Ana', eliminadoPor: 2, semillas: semillasAna })
    await db.batch([`DELETE FROM personas WHERE id = 1`, `DELETE FROM users WHERE id = 1`, `INSERT INTO personas VALUES (50, 'ana@x.test', 'Otra Ana')`], 'write')
    const antes = await filas('SELECT COUNT(*) AS n FROM inscripciones')
    await expect(restaurarInstantanea(db, id)).rejects.toThrow(/FOREIGN KEY/)   // dejaría un afiliado sin su persona
    expect(await filas('SELECT COUNT(*) AS n FROM inscripciones')).toEqual(antes)
    expect((await filas('SELECT id FROM personas ORDER BY id')).map(p => p.id)).toEqual([2, 50])
    expect(await listarInstantaneas(db)).toHaveLength(1)
  })

  it('una instantánea inexistente devuelve null', async () => {
    expect(await restaurarInstantanea(db, 999)).toBeNull()
  })
})
