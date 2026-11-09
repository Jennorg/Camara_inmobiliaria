import { createClient } from '@libsql/client'
import express from 'express'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mem = createClient({ url: ':memory:' })
vi.mock('../lib/db.js', () => ({ db: mem }))
// Los controladores reales arrastran correo, Google y otros servicios: no se necesitan para borrar
vi.mock('../lib/email.js', async (orig) => Object.fromEntries(Object.keys(await orig<object>()).map(k => [k, async () => undefined])))

const { env } = await import('../config/env.js')
const { requireAuth } = await import('../middlewares/auth.middleware.js')
const { auditoria } = await import('../middlewares/auditoria.middleware.js')
const { adminDeleteInscripcion } = await import('../controllers/academia.controller.js')
const { deleteAfiliado } = await import('../controllers/afiliados.controller.js')
const { default: auditoriaRoutes } = await import('./auditoria.routes.js')
const { reiniciarEsquemaAuditoria } = await import('../lib/auditoria.js')
const { reiniciarEsquemaInstantaneas } = await import('../lib/instantaneas.js')

const app = express()
app.use(express.json())
app.use('/api', auditoria)
app.delete('/api/academia/inscripciones/:id', requireAuth, adminDeleteInscripcion)
app.delete('/api/afiliados/:id', requireAuth, deleteAfiliado)
app.use('/api/auditoria', auditoriaRoutes)

const token = (id: number, roles: string[]) => `Bearer ${jwt.sign({ id, email: `u${id}@ciebo.test`, roles, rol: roles[0] }, env.JWT_SECRET)}`
const ADMIN = token(2, ['admin']), SUPER = token(1, ['super_admin'])
const f = async (sql: string) => (await mem.execute(sql)).rows.map(r => ({ ...r })) as any[]

// El registro de auditoría se escribe tras responder: se espera a que termine antes de recrear las tablas del siguiente test
afterEach(() => new Promise(r => setTimeout(r, 150)))

beforeEach(async () => {
  reiniciarEsquemaAuditoria(); reiniciarEsquemaInstantaneas()
  const tablas = ['auditoria', 'papelera_instantaneas', 'documentos', 'modulos_inscripcion', 'inscripciones_cursos', 'afiliados', 'estudiantes', 'empresas', 'personas', 'users', 'tokens_accion', 'cursos', 'cms_noticias', 'cms_cursos', 'cms_convenios', 'cms_hitos', 'cms_normativas']
  await mem.batch([
    ...tablas.map(t => `DROP TABLE IF EXISTS ${t}`),
    `CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT UNIQUE, nombre TEXT, password_hash TEXT, roles TEXT, activo INTEGER DEFAULT 1, eliminado_en TEXT, eliminado_por INTEGER)`,
    `CREATE TABLE personas (id INTEGER PRIMARY KEY, nombres TEXT, apellidos TEXT, email TEXT UNIQUE NOT NULL, cedula TEXT, eliminado_en TEXT)`,
    `CREATE TABLE empresas (id_empresa INTEGER PRIMARY KEY, razon_social TEXT, email TEXT, rif_numero TEXT, eliminado_en TEXT)`,
    `CREATE TABLE afiliados (id_afiliado INTEGER PRIMARY KEY, id_persona INTEGER UNIQUE NOT NULL REFERENCES personas(id) ON DELETE CASCADE, id_user INTEGER REFERENCES users(id) ON DELETE SET NULL, id_empresa INTEGER, tipo_afiliado TEXT, estatus TEXT, codigo TEXT, activo INTEGER DEFAULT 1, eliminado_en TEXT)`,
    `CREATE TABLE estudiantes (id_estudiante INTEGER PRIMARY KEY, id_persona INTEGER UNIQUE REFERENCES personas(id) ON DELETE CASCADE, id_empresa INTEGER, id_user INTEGER, eliminado_en TEXT)`,
    `CREATE TABLE inscripciones_cursos (id_inscripcion INTEGER PRIMARY KEY, id_estudiante INTEGER NOT NULL REFERENCES estudiantes(id_estudiante) ON DELETE CASCADE, id_curso INTEGER, programa_codigo TEXT, estatus TEXT DEFAULT 'Preinscrito')`,
    `CREATE TABLE modulos_inscripcion (id INTEGER PRIMARY KEY, id_inscripcion INTEGER NOT NULL REFERENCES inscripciones_cursos(id_inscripcion) ON DELETE CASCADE, estatus TEXT)`,
    `CREATE TABLE documentos (id_documento INTEGER PRIMARY KEY, entidad_tipo TEXT, entidad_id INTEGER, nombre_archivo TEXT, eliminado_en TEXT)`,
    `CREATE TABLE tokens_accion (id INTEGER PRIMARY KEY, token TEXT, tipo TEXT, email TEXT, data_json TEXT)`,
    // tablas que lista la papelera
    ...['cursos:id_curso:titulo', 'cms_noticias:id_noticia:titulo', 'cms_cursos:id_cms_curso:titulo', 'cms_convenios:id_convenio:nombre', 'cms_hitos:id_hito:titulo', 'cms_normativas:id_normativa:titulo'].map(d => { const [t, pk, n] = d.split(':'); return `CREATE TABLE ${t} (${pk} INTEGER PRIMARY KEY, ${n} TEXT, eliminado_en TEXT, eliminado_por INTEGER)` }),
    `INSERT INTO users (id, email, nombre, password_hash, roles) VALUES (1, 'u1@ciebo.test', 'Super', 'x', '["super_admin"]'), (2, 'u2@ciebo.test', 'Ana Admin', 'x', '["admin"]'), (7, 'maria@x.test', 'María', 'hash-de-maria', '["estudiante"]')`,
    `INSERT INTO personas (id, nombres, apellidos, email, cedula) VALUES (5, 'María', 'Pérez', 'maria@x.test', '123')`,
    `INSERT INTO estudiantes (id_estudiante, id_persona, id_user) VALUES (9, 5, 7)`,
    `INSERT INTO afiliados (id_afiliado, id_persona, id_user, tipo_afiliado, estatus, codigo) VALUES (3, 5, 7, 'Natural', '2_EXPEDIENTE', NULL)`,
    `INSERT INTO inscripciones_cursos (id_inscripcion, id_estudiante, programa_codigo, estatus) VALUES (40, 9, 'AFILIACION', 'Preinscrito')`,
    `INSERT INTO modulos_inscripcion VALUES (1, 40, 'Pendiente')`,
    `INSERT INTO documentos VALUES (1, 'estudiante', 9, 'cedula.pdf', NULL)`,
  ], 'write')
})

describe('preinscripciones y afiliados: papelera por instantánea', () => {
  it('un admin elimina una preinscripción: sale de las tablas vivas, queda en la papelera y el súper administrador la restaura entera', async () => {
    const r = await request(app).delete('/api/academia/inscripciones/40').set('Authorization', ADMIN)
    expect(r.status, JSON.stringify(r.body)).toBe(200)
    expect(await f('SELECT COUNT(*) AS n FROM inscripciones_cursos')).toEqual([{ n: 0 }])
    expect(await f('SELECT COUNT(*) AS n FROM personas')).toEqual([{ n: 0 }]) // limpieza profunda de siempre: el re-registro funciona

    expect((await request(app).get('/api/auditoria/papelera').set('Authorization', ADMIN)).status).toBe(403)
    const lista = (await request(app).get('/api/auditoria/papelera').set('Authorization', SUPER)).body.data
    expect(lista).toEqual([expect.objectContaining({ tipo: 'preinscripcion', etiqueta: 'Preinscripciones', eliminado_por: 'u2@ciebo.test', nombre: expect.stringContaining('María Pérez') })])

    const res = await request(app).post(`/api/auditoria/papelera/preinscripcion/${lista[0].id}/restaurar`).set('Authorization', SUPER)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(await f('SELECT id_inscripcion, id_estudiante FROM inscripciones_cursos')).toEqual([{ id_inscripcion: 40, id_estudiante: 9 }])
    expect(await f('SELECT COUNT(*) AS n FROM modulos_inscripcion')).toEqual([{ n: 1 }])
    expect(await f(`SELECT password_hash FROM users WHERE id = 7`)).toEqual([{ password_hash: 'hash-de-maria' }]) // el usuario vuelve con su contraseña
    expect(await f('SELECT nombre_archivo FROM documentos')).toEqual([{ nombre_archivo: 'cedula.pdf' }])
    expect((await request(app).get('/api/auditoria/papelera').set('Authorization', SUPER)).body.data).toEqual([])
  })

  it('?definitivo=true: solo el súper administrador, y no deja instantánea', async () => {
    expect((await request(app).delete('/api/academia/inscripciones/40?definitivo=true').set('Authorization', ADMIN)).status).toBe(403)
    expect(await f('SELECT COUNT(*) AS n FROM inscripciones_cursos')).toEqual([{ n: 1 }])
    expect((await request(app).delete('/api/academia/inscripciones/40?definitivo=true').set('Authorization', SUPER)).status).toBe(200)
    expect((await request(app).get('/api/auditoria/papelera').set('Authorization', SUPER)).body.data).toEqual([])
    await vi.waitFor(async () => expect((await f(`SELECT accion FROM auditoria WHERE accion = 'eliminar_definitivo'`)).length).toBe(1))
  })

  it('elimina un afiliado: todo su registro queda en la papelera y se restaura', async () => {
    expect((await request(app).delete('/api/afiliados/3').set('Authorization', ADMIN)).status).toBe(200)
    expect(await f('SELECT COUNT(*) AS n FROM afiliados')).toEqual([{ n: 0 }])
    const lista = (await request(app).get('/api/auditoria/papelera?tipo=afiliado').set('Authorization', SUPER)).body.data
    expect(lista).toHaveLength(1)
    expect((await request(app).post(`/api/auditoria/papelera/afiliado/${lista[0].id}/restaurar`).set('Authorization', SUPER)).status).toBe(200)
    expect(await f('SELECT id_afiliado, id_persona, id_user FROM afiliados')).toEqual([{ id_afiliado: 3, id_persona: 5, id_user: 7 }])
    expect(await f('SELECT COUNT(*) AS n FROM inscripciones_cursos')).toEqual([{ n: 1 }])
  })

  it('descartar de la papelera exige confirmar y registra quién lo hizo', async () => {
    await request(app).delete('/api/academia/inscripciones/40').set('Authorization', ADMIN)
    const id = (await request(app).get('/api/auditoria/papelera').set('Authorization', SUPER)).body.data[0].id
    expect((await request(app).delete(`/api/auditoria/papelera/preinscripcion/${id}`).set('Authorization', SUPER)).status).toBe(400)
    expect((await request(app).delete(`/api/auditoria/papelera/preinscripcion/${id}?confirmacion=ELIMINAR`).set('Authorization', SUPER)).status).toBe(200)
    expect((await request(app).get('/api/auditoria/papelera').set('Authorization', SUPER)).body.data).toEqual([])
  })
  // Va al final: un batch rechazado deja bloqueada la tabla en la base en memoria de la prueba (en Turso no ocurre)
  it('si la persona se volvió a registrar, restaurar se rechaza con un mensaje claro y no cambia nada', async () => {
    await request(app).delete('/api/academia/inscripciones/40').set('Authorization', ADMIN)
    const id = (await request(app).get('/api/auditoria/papelera').set('Authorization', SUPER)).body.data[0].id
    await mem.execute(`INSERT INTO personas (id, nombres, email) VALUES (60, 'María (nuevo)', 'maria@x.test')`) // mismo correo, otro id
    const r = await request(app).post(`/api/auditoria/papelera/preinscripcion/${id}/restaurar`).set('Authorization', SUPER)
    expect(r.status).toBe(409)
    expect(r.body.message).toMatch(/se volvió a registrar/)
    expect(await f('SELECT COUNT(*) AS n FROM inscripciones_cursos')).toEqual([{ n: 0 }])
    expect((await request(app).get('/api/auditoria/papelera').set('Authorization', SUPER)).body.data).toHaveLength(1) // sigue disponible
  })

})
