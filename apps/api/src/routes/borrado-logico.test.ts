import { createClient } from '@libsql/client'
import express from 'express'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mem = createClient({ url: ':memory:' })
vi.mock('../lib/db.js', () => ({ db: mem }))
vi.mock('../services/asambleas.service.js', () => ({ actasPublicadas: async () => [] }))

const { env } = await import('../config/env.js')
const { requireAuth } = await import('../middlewares/auth.middleware.js')
const { auditoria } = await import('../middlewares/auditoria.middleware.js')
const { getNoticias, deleteNoticia, deleteBatchNormativas } = await import('../controllers/cms.controller.js')
const { default: auditoriaRoutes } = await import('./auditoria.routes.js')
const { reiniciarEsquemaAuditoria } = await import('../lib/auditoria.js')

const app = express()
app.use(express.json())
app.use('/api', auditoria)
app.get('/api/cms/noticias', getNoticias)
app.delete('/api/cms/noticias/:id', requireAuth, deleteNoticia)
app.post('/api/cms/normativas-batch-delete', requireAuth, deleteBatchNormativas)
app.use('/api/auditoria', auditoriaRoutes)

const token = (id: number, roles: string[]) => `Bearer ${jwt.sign({ id, email: `u${id}@ciebo.test`, roles, rol: roles[0] }, env.JWT_SECRET)}`
const ADMIN = token(2, ['admin']), SUPER = token(1, ['super_admin'])
const f = async (sql: string) => (await mem.execute(sql)).rows.map(r => ({ ...r })) as any[]
const visibles = async () => (await request(app).get('/api/cms/noticias?publicado=0')).body.data.map((n: any) => n.id_noticia)
const auditoriaDe = async (accion: string) => vi.waitFor(async () => { const r = await f(`SELECT * FROM auditoria WHERE accion = '${accion}' ORDER BY id DESC`); expect(r.length).toBeGreaterThan(0); return r[0] })

beforeEach(async () => {
  reiniciarEsquemaAuditoria()
  await mem.batch([
    `DROP TABLE IF EXISTS auditoria`, `DROP TABLE IF EXISTS cms_noticias`, `DROP TABLE IF EXISTS cms_normativas`, `DROP TABLE IF EXISTS users`, `DROP TABLE IF EXISTS cms_cursos`,
    `CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT, nombre TEXT, activo INTEGER DEFAULT 1, eliminado_en TEXT, eliminado_por INTEGER)`,
    `INSERT INTO users (id, email, nombre) VALUES (1, 'u1@ciebo.test', 'Super'), (2, 'u2@ciebo.test', 'Ana Admin')`,
    `CREATE TABLE cms_noticias (id_noticia INTEGER PRIMARY KEY, titulo TEXT, publicado INTEGER DEFAULT 0, orden INTEGER, fecha_publicacion TEXT, eliminado_en TEXT)`,
    `INSERT INTO cms_noticias (id_noticia, titulo) VALUES (1, 'Primera'), (2, 'Segunda')`,
    `CREATE TABLE cms_normativas (id_normativa INTEGER PRIMARY KEY, titulo TEXT, eliminado_en TEXT)`,
    // el resto de tablas de la papelera, vacías
    ...['cms_cursos:id_cms_curso:titulo', 'cms_convenios:id_convenio:nombre', 'cms_hitos:id_hito:titulo', 'cursos:id_curso:titulo'].flatMap(d => { const [t, pk, n] = d.split(':'); return [`DROP TABLE IF EXISTS ${t}`, `CREATE TABLE ${t} (${pk} INTEGER PRIMARY KEY, ${n} TEXT, eliminado_en TEXT, eliminado_por INTEGER)`] }),
    `INSERT INTO cms_normativas VALUES (10, 'Ley A', NULL), (11, 'Ley B', NULL)`,
  ], 'write')
})

describe('borrado lógico: todos los roles; definitivo solo el súper administrador', () => {
  it('un admin elimina: el registro se conserva, deja de verse y queda quién lo borró', async () => {
    expect((await request(app).delete('/api/cms/noticias/1').set('Authorization', ADMIN)).status).toBe(200)
    expect(await visibles()).toEqual([2])
    expect(await f('SELECT id_noticia, eliminado_por, eliminado_en IS NOT NULL AS borrada FROM cms_noticias WHERE id_noticia = 1')).toEqual([{ id_noticia: 1, eliminado_por: 2, borrada: 1 }])
    const a = await auditoriaDe('eliminar')
    expect(a).toMatchObject({ email: 'u2@ciebo.test', entidad: 'noticias', id_entidad: '1' })
    expect(JSON.parse(a.antes).titulo).toBe('Primera')
  })
  it('un admin que pide el borrado definitivo recibe 403 y no se toca nada', async () => {
    expect((await request(app).delete('/api/cms/noticias/1?definitivo=true').set('Authorization', ADMIN)).status).toBe(403)
    expect(await visibles()).toEqual([1, 2])
  })
  it('el súper administrador elige: lógico por defecto o definitivo con ?definitivo=true', async () => {
    expect((await request(app).delete('/api/cms/noticias/1').set('Authorization', SUPER)).status).toBe(200)
    expect(await f('SELECT COUNT(*) AS n FROM cms_noticias')).toEqual([{ n: 2 }])
    expect((await request(app).delete('/api/cms/noticias/2?definitivo=true').set('Authorization', SUPER)).status).toBe(200)
    expect(await f('SELECT COUNT(*) AS n FROM cms_noticias')).toEqual([{ n: 1 }])
    const a = await auditoriaDe('eliminar_definitivo')
    expect(a).toMatchObject({ email: 'u1@ciebo.test', id_entidad: '2' })
    expect(JSON.parse(a.antes).titulo).toBe('Segunda') // lo borrado queda fotografiado
  })
  it('el borrado en lote también es lógico y deja constancia de cada documento', async () => {
    await request(app).post('/api/cms/normativas-batch-delete').set('Authorization', ADMIN).send({ ids: [10, 11] })
    expect(await f('SELECT COUNT(*) AS n FROM cms_normativas WHERE eliminado_en IS NULL')).toEqual([{ n: 0 }])
    const a = await auditoriaDe('eliminar')
    expect(JSON.parse(a.antes).map((x: any) => x.titulo).sort()).toEqual(['Ley A', 'Ley B'])
  })
})

describe('papelera (solo súper administrador)', () => {
  it('lista lo eliminado con quién lo eliminó, restaura y elimina definitivamente', async () => {
    await request(app).delete('/api/cms/noticias/1').set('Authorization', ADMIN)
    expect((await request(app).get('/api/auditoria/papelera').set('Authorization', ADMIN)).status).toBe(403)

    const lista = (await request(app).get('/api/auditoria/papelera').set('Authorization', SUPER)).body.data
    expect(lista).toEqual([expect.objectContaining({ tipo: 'noticias', id: 1, nombre: 'Primera', eliminado_por: 'u2@ciebo.test' })])

    expect((await request(app).post('/api/auditoria/papelera/noticias/1/restaurar').set('Authorization', SUPER)).status).toBe(200)
    expect(await visibles()).toEqual([1, 2])
    expect((await auditoriaDe('restaurar')).email).toBe('u1@ciebo.test')

    await request(app).delete('/api/cms/noticias/1').set('Authorization', ADMIN)
    expect((await request(app).delete('/api/auditoria/papelera/noticias/1').set('Authorization', SUPER)).status).toBe(400) // sin confirmar
    expect((await request(app).delete('/api/auditoria/papelera/noticias/2?confirmacion=ELIMINAR').set('Authorization', SUPER)).status).toBe(404) // no está en la papelera
    expect((await request(app).delete('/api/auditoria/papelera/noticias/1?confirmacion=ELIMINAR').set('Authorization', SUPER)).status).toBe(200)
    expect(await f('SELECT id_noticia FROM cms_noticias')).toEqual([{ id_noticia: 2 }])
  })
})
