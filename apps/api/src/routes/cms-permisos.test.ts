import { createClient } from '@libsql/client'
import express from 'express'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { ACCIONES, sembrarRoles, type Accion } from '../config/secciones.js'

const mem = createClient({ url: ':memory:' })
vi.mock('../lib/db.js', () => ({ db: mem }))

// Los handlers solo responden OK: aquí se prueba la autorización del router real.
const ok = (_req: any, res: any) => res.json({ success: true })
const mockear = (nombres: string[]) => Object.fromEntries(nombres.map(n => [n, ok]))
vi.mock('../controllers/cms.controller.js', () => mockear([
  'getNoticias', 'createNoticia', 'updateNoticia', 'deleteNoticia', 'reorderNoticias',
  'getCursos', 'createCurso', 'updateCurso', 'deleteCurso',
  'getConvenios', 'createConvenio', 'updateConvenio', 'deleteConvenio',
  'getDirectiva', 'createMiembroDirectiva', 'updateMiembroDirectiva', 'deleteMiembroDirectiva',
  'getHitos', 'createHito', 'updateHito', 'deleteHito',
  'getConfig', 'upsertConfig', 'upsertConfigBatch', 'deleteConfig',
  'getPaginasList', 'getPaginaBySlug', 'upsertPagina', 'deletePagina',
  'getNormativas', 'createNormativa', 'updateNormativa', 'deleteNormativa', 'deleteBatchNormativas', 'reorderNormativas',
]))

const { env } = await import('../config/env.js')
const { cmsRoutes } = await import('./cms.routes.js')

const app = express()
app.use(express.json())
app.use('/api/cms', cmsRoutes)

const token = (roles: string[]) => `Bearer ${jwt.sign({ id: 9, email: 'u@x', roles, rol: roles[0] }, env.JWT_SECRET)}`
const STAFF = ['asistente', 'administrativo', 'personal_admin', 'secretario', 'secretaria', 'personal', 'personal_administrativo']

const llamar = (m: string, url: string, auth?: string, body: object = {}) => {
  const r = (request(app) as any)[m](url).send(body)
  return auth ? r.set('Authorization', auth) : r
}

// Rutas admin con sección fija → [método, ruta, sección, acción]. Reordenar es «editar».
const RUTAS: [string, string, string, Accion][] = [
  ['post', '/api/cms/noticias', 'noticias', 'crear'],
  ['put', '/api/cms/noticias/reorder', 'noticias', 'editar'],
  ['put', '/api/cms/noticias/1', 'noticias', 'editar'],
  ['delete', '/api/cms/noticias/1', 'noticias', 'eliminar'],
  ['post', '/api/cms/cursos', 'formacion', 'crear'],
  ['put', '/api/cms/cursos/1', 'formacion', 'editar'],
  ['delete', '/api/cms/cursos/1', 'formacion', 'eliminar'],
  ['post', '/api/cms/convenios', 'formacion', 'crear'],
  ['put', '/api/cms/convenios/1', 'formacion', 'editar'],
  ['delete', '/api/cms/convenios/1', 'formacion', 'eliminar'],
  ['post', '/api/cms/directiva', 'directiva', 'crear'],
  ['put', '/api/cms/directiva/1', 'directiva', 'editar'],
  ['delete', '/api/cms/directiva/1', 'directiva', 'eliminar'],
  ['post', '/api/cms/hitos', 'config', 'crear'],
  ['put', '/api/cms/hitos/1', 'config', 'editar'],
  ['delete', '/api/cms/hitos/1', 'config', 'eliminar'],
  ['get', '/api/cms/config', 'config', 'ver'],
  ['post', '/api/cms/config', 'config', 'editar'], // upsert de un ajuste
  ['post', '/api/cms/config/batch', 'config', 'editar'], // upsert por lote: modifica claves existentes
  ['delete', '/api/cms/config/x', 'config', 'eliminar'],
  ['get', '/api/cms/paginas', 'config', 'ver'],
  ['put', '/api/cms/paginas/inicio', 'config', 'editar'],
  ['delete', '/api/cms/paginas/inicio', 'config', 'eliminar'],
]

const PUBLICAS = ['/api/cms/noticias', '/api/cms/cursos', '/api/cms/convenios', '/api/cms/normativas', '/api/cms/directiva', '/api/cms/hitos', '/api/cms/paginas/inicio']

const SECCIONES_NORM = ['leyes', 'reglamentos', 'normas', 'actas']
const CATEGORIA: Record<string, string> = { leyes: 'Leyes y Decretos', reglamentos: 'Reglamentos y Estatutos', normas: 'Normas y Procedimientos', actas: 'Actas de Asamblea' }

beforeAll(async () => {
  await mem.batch([
    `CREATE TABLE roles (id INTEGER PRIMARY KEY, clave TEXT UNIQUE NOT NULL, nombre TEXT NOT NULL, es_sistema INTEGER NOT NULL DEFAULT 0, activo INTEGER NOT NULL DEFAULT 1, creado_en TEXT)`,
    `CREATE TABLE rol_permisos (id_rol INTEGER NOT NULL, seccion TEXT NOT NULL, ver INTEGER NOT NULL DEFAULT 0, crear INTEGER NOT NULL DEFAULT 0, editar INTEGER NOT NULL DEFAULT 0, eliminar INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (id_rol, seccion))`,
    `CREATE TABLE cms_normativas (id_normativa INTEGER PRIMARY KEY, categoria TEXT)`,
    `INSERT INTO cms_normativas (id_normativa, categoria) VALUES (1, 'Leyes y Decretos'), (2, 'Reglamentos y Estatutos'), (3, 'Normas y Procedimientos'), (4, 'Actas de Asamblea'), (5, 'Otros'), (6, NULL)`,
  ], 'write')
  await sembrarRoles(mem)
  const secciones = [...new Set([...RUTAS.map(r => r[2]), ...SECCIONES_NORM])]
  for (const s of secciones) {
    for (const a of ACCIONES) {
      for (const [clave, casillas] of [[`solo_${a}_${s}`, [a]], [`sin_${a}_${s}`, ACCIONES.filter(x => x !== a)]] as const) {
        await mem.execute({ sql: `INSERT INTO roles (clave, nombre) VALUES (?, ?)`, args: [clave, clave] })
        await mem.execute({
          sql: `INSERT INTO rol_permisos (id_rol, seccion, ver, crear, editar, eliminar) SELECT id, ?, ?, ?, ?, ? FROM roles WHERE clave = ?`,
          args: [s, ...ACCIONES.map(x => ((casillas as readonly string[]).includes(x) ? 1 : 0)), clave],
        })
      }
    }
  }
})

describe('cms: permisos por sección', () => {
  it.each(RUTAS)('%s %s exige %s/%s', async (m, url, seccion, accion) => {
    expect((await llamar(m, url)).status).toBe(401)
    expect((await llamar(m, url, token([`solo_${accion}_${seccion}`]))).status).toBe(200)
    expect((await llamar(m, url, token([`sin_${accion}_${seccion}`]))).status).toBe(403)
    expect((await llamar(m, url, token(['super_admin']))).status).toBe(200)
    expect((await llamar(m, url, token(['admin']))).status).toBe(200)
    expect((await llamar(m, url, token(['afiliado']))).status).toBe(403)
  })

  it('el staff conserva su acceso de antes: ninguno (el CMS era solo admin/super_admin)', async () => {
    const rutas = [...RUTAS.map(([m, u]) => [m, u]), ['post', '/api/cms/normativas'], ['delete', '/api/cms/normativas/1']]
    for (const [m, url] of rutas) {
      for (const rol of STAFF) expect((await llamar(m, url, token([rol]), { categoria: CATEGORIA.leyes })).status, `${rol} ${m} ${url}`).toBe(403)
    }
  })

  it('las rutas públicas no se tocan', async () => {
    for (const url of PUBLICAS) expect((await llamar('get', url)).status, url).toBe(200)
  })
})

describe('cms: normativas según la categoría', () => {
  for (const s of SECCIONES_NORM) {
    const cat = CATEGORIA[s]
    const id = SECCIONES_NORM.indexOf(s) + 1
    it(`${s}: crear, editar, eliminar, reordenar y lote`, async () => {
      const solo = (a: Accion) => token([`solo_${a}_${s}`])
      const sin = (a: Accion) => token([`sin_${a}_${s}`])
      // crear: categoría del cuerpo
      expect((await llamar('post', '/api/cms/normativas', solo('crear'), { categoria: cat })).status).toBe(200)
      expect((await llamar('post', '/api/cms/normativas', sin('crear'), { categoria: cat })).status).toBe(403)
      // editar y eliminar: categoría guardada del registro
      expect((await llamar('put', `/api/cms/normativas/${id}`, solo('editar'), { categoria: cat })).status).toBe(200)
      expect((await llamar('put', `/api/cms/normativas/${id}`, sin('editar'), { categoria: cat })).status).toBe(403)
      expect((await llamar('delete', `/api/cms/normativas/${id}`, solo('eliminar'))).status).toBe(200)
      expect((await llamar('delete', `/api/cms/normativas/${id}`, sin('eliminar'))).status).toBe(403)
      expect((await llamar('post', '/api/cms/normativas-batch-delete', solo('eliminar'), { ids: [id] })).status).toBe(200)
      expect((await llamar('post', '/api/cms/normativas-batch-delete', sin('eliminar'), { ids: [id] })).status).toBe(403)
      expect((await llamar('put', '/api/cms/normativas-reorder', solo('editar'), { items: [{ id, orden: 1 }] })).status).toBe(200)
      expect((await llamar('put', '/api/cms/normativas-reorder', sin('editar'), { items: [{ id, orden: 1 }] })).status).toBe(403)
    })
  }

  it('el permiso de una categoría no sirve para otra', async () => {
    expect((await llamar('post', '/api/cms/normativas', token(['solo_crear_leyes']), { categoria: CATEGORIA.actas })).status).toBe(403)
    expect((await llamar('put', '/api/cms/normativas/2', token(['solo_editar_leyes']), { categoria: CATEGORIA.leyes })).status).toBe(403) // el registro es de reglamentos
    expect((await llamar('put', '/api/cms/normativas/1', token(['solo_editar_leyes']), { categoria: CATEGORIA.actas })).status).toBe(403) // mover a otra categoría
    expect((await llamar('delete', '/api/cms/normativas/2', token(['solo_eliminar_leyes']))).status).toBe(403)
    expect((await llamar('post', '/api/cms/normativas-batch-delete', token(['solo_eliminar_leyes']), { ids: [1, 2] })).status).toBe(403)
    expect((await llamar('put', '/api/cms/normativas-reorder', token(['solo_editar_leyes']), { items: [{ id: 1, orden: 1 }, { id: 2, orden: 2 }] })).status).toBe(403)
  })

  it('categoría ausente, «Otros» o desconocida: solo admin/super_admin (nunca abre)', async () => {
    const todo = token(['solo_crear_leyes', 'solo_editar_leyes', 'solo_eliminar_leyes', 'solo_crear_actas'])
    for (const body of [{}, { categoria: 'Otros' }, { categoria: 'Inventada' }]) {
      expect((await llamar('post', '/api/cms/normativas', todo, body)).status).toBe(403)
      expect((await llamar('post', '/api/cms/normativas', token(['admin']), body)).status).toBe(200)
      expect((await llamar('post', '/api/cms/normativas', token(['super_admin']), body)).status).toBe(200)
    }
    for (const id of [5, 6, 999]) {
      expect((await llamar('delete', `/api/cms/normativas/${id}`, todo)).status).toBe(403)
      expect((await llamar('delete', `/api/cms/normativas/${id}`, token(['admin']))).status).toBe(200)
    }
    expect((await llamar('post', '/api/cms/normativas-batch-delete', todo, { ids: [] })).status).toBe(403)
    expect((await llamar('put', '/api/cms/normativas-reorder', todo, { items: [] })).status).toBe(403)
    expect((await llamar('put', '/api/cms/normativas-reorder', token(['admin']), { items: [{ id: 5, orden: 1 }] })).status).toBe(200)
  })
})
