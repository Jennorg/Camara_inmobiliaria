import { createClient } from '@libsql/client'
import express from 'express'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import { beforeAll, describe, expect, it, vi } from 'vitest'

const mem = createClient({ url: ':memory:' })
vi.mock('../lib/db.js', () => ({ db: mem }))

const { env } = await import('../config/env.js')
const { requireAuth } = await import('../middlewares/auth.middleware.js')
const { auditoria } = await import('../middlewares/auditoria.middleware.js')
const { default: auditoriaRoutes } = await import('./auditoria.routes.js')

const app = express()
app.use(express.json())
app.use('/api', auditoria)
// Rutas simuladas con la misma forma que las reales
app.put('/api/cms/noticias/:id', requireAuth, (_req, res) => { res.json({ success: true }) })
app.delete('/api/cms/noticias/:id', requireAuth, (_req, res) => { res.locals.auditoria = { accion: 'eliminar_definitivo', resumen: 'borrado definitivo' }; res.json({ success: true }) })
app.post('/api/users', requireAuth, (_req, res) => { res.status(201).json({ success: true }) })
app.post('/api/pagos/falla', requireAuth, (_req, res) => { res.status(409).json({ success: false }) })
app.post('/api/auth/login', (_req, res) => { res.json({ success: true }) })
app.post('/api/public/preinscribir', (_req, res) => { res.json({ success: true }) })
app.get('/api/cms/noticias', requireAuth, (_req, res) => { res.json({ success: true }) })
app.use('/api/auditoria', auditoriaRoutes)

const token = (roles: string[], extra: object = {}) => `Bearer ${jwt.sign({ id: 4, email: 'ana@ciebo.test', roles, rol: roles[0], ...extra }, env.JWT_SECRET)}`
const ADMIN = token(['admin']), SUPER = token(['super_admin'])
const filas = async () => (await mem.execute('SELECT * FROM auditoria ORDER BY id')).rows.map(r => ({ ...r })) as any[]
const asentada = (n: number) => vi.waitFor(async () => expect((await filas()).length).toBe(n))

beforeAll(async () => {
  await mem.execute(`CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT, nombre TEXT)`)
  await mem.execute(`INSERT INTO users VALUES (4, 'ana@ciebo.test', 'Ana Contreras')`)
  await mem.execute(`CREATE TABLE personas (id INTEGER PRIMARY KEY, nombres TEXT, apellidos TEXT, email TEXT, eliminado_en TEXT)`)
  await mem.execute(`CREATE TABLE cms_noticias (id_noticia INTEGER PRIMARY KEY, titulo TEXT, eliminado_en TEXT)`)
  await mem.execute(`INSERT INTO cms_noticias VALUES (12, 'Título original', NULL)`)
})

describe('middleware de auditoría', () => {
  it('registra quién editó, con el antes y el después, sin secretos', async () => {
    await request(app).put('/api/cms/noticias/12').set('Authorization', ADMIN).send({ titulo: 'Título nuevo', password: 'secreta' })
    await asentada(1)
    const [f] = await filas()
    expect(f).toMatchObject({ id_user: 4, email: 'ana@ciebo.test', rol: 'admin', accion: 'editar', modulo: 'cms', entidad: 'noticias', id_entidad: '12', metodo: 'PUT', estado: 200 })
    expect(JSON.parse(f.antes).titulo).toBe('Título original')
    expect(JSON.parse(f.despues)).toEqual({ titulo: 'Título nuevo', password: '[omitido]' })
    expect(f.resumen).toBe('editar · noticias #12 — «Título nuevo»')
  })
  it('un controlador puede afinar el registro (borrado definitivo)', async () => {
    await request(app).delete('/api/cms/noticias/12').set('Authorization', SUPER)
    await asentada(2)
    expect((await filas())[1]).toMatchObject({ accion: 'eliminar_definitivo', resumen: 'borrado definitivo' })
  })
  it('anota la suplantación: quién hizo la acción y quién la ejecutó realmente', async () => {
    await request(app).post('/api/users').set('Authorization', token(['admin'], { impersonatedBy: 99 })).send({ email: 'x@x.test' })
    await asentada(3)
    expect((await filas())[2]).toMatchObject({ accion: 'crear', suplantado_por: 99 })
  })
  it('no registra lecturas, errores, sesión ni formularios anónimos', async () => {
    await request(app).get('/api/cms/noticias').set('Authorization', ADMIN)
    await request(app).post('/api/pagos/falla').set('Authorization', ADMIN).send({})
    await request(app).post('/api/auth/login').send({})
    await request(app).post('/api/public/preinscribir').send({})
    await new Promise(r => setTimeout(r, 150))
    expect(await filas()).toHaveLength(3)
  })
})

describe('consulta de la auditoría', () => {
  it('el listado y los filtros son solo del súper administrador', async () => {
    expect((await request(app).get('/api/auditoria')).status).toBe(401)
    expect((await request(app).get('/api/auditoria').set('Authorization', ADMIN)).status).toBe(403)
    expect((await request(app).get('/api/auditoria/filtros').set('Authorization', ADMIN)).status).toBe(403)
    const ok = await request(app).get('/api/auditoria?accion=editar').set('Authorization', SUPER)
    expect(ok.status).toBe(200)
    expect(ok.body.total).toBe(1)
    expect(ok.body.data[0]).toMatchObject({ email: 'ana@ciebo.test', nombre_usuario: 'Ana Contreras' })
    const f = await request(app).get('/api/auditoria/filtros').set('Authorization', SUPER)
    expect(f.body.data.acciones).toEqual(expect.arrayContaining(['editar', 'crear', 'eliminar_definitivo']))
  })
  it('«Modificado por»: solo el súper administrador lo consulta', async () => {
    const r = await request(app).get('/api/auditoria/ultimo?entidad=noticias&ids=12,13').set('Authorization', SUPER)
    expect(r.status).toBe(200)
    expect(r.body.data['12']).toMatchObject({ accion: 'eliminar_definitivo', email: 'ana@ciebo.test', usuario: 'Ana Contreras' })
    // con ficha de persona: primer nombre y primer apellido, no el correo ni el nombre completo
    await mem.execute(`INSERT INTO personas (id, nombres, apellidos, email) VALUES (1, 'Anita María', 'Contreras Pérez', 'ANA@ciebo.test')`)
    const corto = await request(app).get('/api/auditoria/ultimo?entidad=noticias&ids=12').set('Authorization', SUPER)
    expect(corto.body.data['12'].usuario).toBe('Anita Contreras')
    await mem.execute(`DELETE FROM personas`)
    expect(r.body.data['13']).toBeUndefined()
    for (const rol of ['admin', 'afiliado']) expect((await request(app).get('/api/auditoria/ultimo?entidad=noticias&ids=12').set('Authorization', token([rol]))).status).toBe(403)
  })
})
