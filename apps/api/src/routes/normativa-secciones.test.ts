import { createClient } from '@libsql/client'
import express from 'express'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ACCIONES, sembrarRoles, type Accion } from '../config/secciones.js'

const mem = createClient({ url: ':memory:' })
vi.mock('../lib/db.js', () => ({ db: mem }))
// Un acta publicada desde la gestión de asambleas (se suma a la sección de slug «actas-de-asamblea»).
vi.mock('../services/asambleas.service.js', () => ({
  actasPublicadas: async () => [{ id_normativa: 'asamblea-1', titulo: 'ACTA ASAMBLEA', descripcion: null, url_archivo: 'https://x.test/acta.pdf', categoria: 'Actas de Asamblea', orden: 0, creado_en: '2026-01-01' }],
}))

const { env } = await import('../config/env.js')
const { sembrarSeccionesNormativa, slugify } = await import('../config/secciones-normativa.js')
const { cmsRoutes } = await import('./cms.routes.js')
const { publicListNormativas, publicListSeccionesNormativa } = await import('../controllers/cms.controller.js')

const app = express()
app.use(express.json())
app.use('/api/cms', cmsRoutes)
// Mismas rutas que public.routes.ts (no se importa: arrastra otros controladores)
app.get('/api/public/normativas/secciones', publicListSeccionesNormativa)
app.get('/api/public/normativas', publicListNormativas)

const token = (roles: string[]) => `Bearer ${jwt.sign({ id: 9, email: 'u@x', roles, rol: roles[0] }, env.JWT_SECRET)}`
const llamar = (m: string, url: string, auth?: string, body: object = {}) => {
  const r = (request(app) as any)[m](url).send(body)
  return auth ? r.set('Authorization', auth) : r
}
const solo = (a: Accion) => token([`solo_${a}_marco_legal`])
const sin = (a: Accion) => token([`sin_${a}_marco_legal`])
const ADMIN = token(['admin'])

let n = 0
const crearSeccion = async (nombre = `Sección ${++n}`, publica = true) => {
  const r = await llamar('post', '/api/cms/normativas-secciones', ADMIN, { nombre, publica })
  expect(r.status, JSON.stringify(r.body)).toBe(201)
  return r.body.data as { id: number; nombre: string; slug: string; publica: number }
}
const crearDoc = async (categoria: string | null, activo = true) => {
  const r = await mem.execute({
    sql: `INSERT INTO cms_normativas (titulo, url_archivo, categoria, activo) VALUES (?, 'https://x.test/d.pdf', ?, ?) RETURNING id_normativa`,
    args: [`DOC ${++n}`, categoria, activo ? 1 : 0],
  })
  return Number(r.rows[0].id_normativa)
}
const seccionPorSlug = async (slug: string) => (await mem.execute({ sql: 'SELECT * FROM cms_normativa_secciones WHERE slug = ?', args: [slug] })).rows[0] as any

beforeAll(async () => {
  await mem.batch([
    `CREATE TABLE roles (id INTEGER PRIMARY KEY, clave TEXT UNIQUE NOT NULL, nombre TEXT NOT NULL, es_sistema INTEGER NOT NULL DEFAULT 0, activo INTEGER NOT NULL DEFAULT 1, creado_en TEXT)`,
    `CREATE TABLE rol_permisos (id_rol INTEGER NOT NULL, seccion TEXT NOT NULL, ver INTEGER NOT NULL DEFAULT 0, crear INTEGER NOT NULL DEFAULT 0, editar INTEGER NOT NULL DEFAULT 0, eliminar INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (id_rol, seccion))`,
    `CREATE TABLE cms_normativas (
      id_normativa INTEGER PRIMARY KEY, titulo TEXT NOT NULL, descripcion TEXT, url_archivo TEXT NOT NULL, categoria TEXT,
      orden INTEGER DEFAULT 0, activo INTEGER DEFAULT 1 CHECK (activo IN (0,1)),
      creado_en TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')), eliminado_en TEXT)`,
  ], 'write')
  await sembrarRoles(mem)
  await sembrarSeccionesNormativa(mem)
  for (const a of ACCIONES) {
    for (const [clave, casillas] of [[`solo_${a}_marco_legal`, [a]], [`sin_${a}_marco_legal`, ACCIONES.filter(x => x !== a)]] as const) {
      await mem.execute({ sql: `INSERT INTO roles (clave, nombre) VALUES (?, ?)`, args: [clave, clave] })
      await mem.execute({
        sql: `INSERT INTO rol_permisos (id_rol, seccion, ver, crear, editar, eliminar) SELECT id, 'marco_legal', ?, ?, ?, ? FROM roles WHERE clave = ?`,
        args: [...ACCIONES.map(x => ((casillas as readonly string[]).includes(x) ? 1 : 0)), clave],
      })
    }
  }
})

describe('siembra y slug', () => {
  it('slugify quita acentos, mayúsculas y símbolos', () => {
    expect(slugify('  Actas de Asamblea ')).toBe('actas-de-asamblea')
    expect(slugify('Leyes & Decretos (Año 2026)')).toBe('leyes-decretos-ano-2026')
    expect(slugify('!!!')).toBe('')
  })

  it('siembra las cuatro originales en orden y no resucita una borrada', async () => {
    const r = await mem.execute('SELECT nombre, slug FROM cms_normativa_secciones ORDER BY orden')
    expect(r.rows.slice(0, 4).map(x => x.slug)).toEqual(['leyes-y-decretos', 'reglamentos-y-estatutos', 'normas-y-procedimientos', 'actas-de-asamblea'])
    const tmp = await crearSeccion('Temporal siembra')
    await mem.execute({ sql: 'DELETE FROM cms_normativa_secciones WHERE id = ?', args: [tmp.id] })
    await sembrarSeccionesNormativa(mem)
    expect(await seccionPorSlug('temporal-siembra')).toBeUndefined()
    expect((await mem.execute('SELECT COUNT(*) AS n FROM cms_normativa_secciones WHERE slug = \'leyes-y-decretos\'')).rows[0].n).toBe(1)
  })
})

describe('secciones: permisos por acción (marco_legal)', () => {
  it('listar exige «ver»', async () => {
    expect((await llamar('get', '/api/cms/normativas-secciones')).status).toBe(401)
    expect((await llamar('get', '/api/cms/normativas-secciones', solo('ver'))).status).toBe(200)
    expect((await llamar('get', '/api/cms/normativas-secciones', sin('ver'))).status).toBe(403)
    expect((await llamar('get', '/api/cms/normativas-secciones', token(['super_admin']))).status).toBe(200)
    expect((await llamar('get', '/api/cms/normativas-secciones', ADMIN)).status).toBe(200)
    expect((await llamar('get', '/api/cms/normativas-secciones', token(['afiliado']))).status).toBe(403)
  })

  it('crear exige «crear»', async () => {
    expect((await llamar('post', '/api/cms/normativas-secciones', undefined, { nombre: 'Anon' })).status).toBe(401)
    expect((await llamar('post', '/api/cms/normativas-secciones', sin('crear'), { nombre: 'Sin crear' })).status).toBe(403)
    expect((await llamar('post', '/api/cms/normativas-secciones', token(['afiliado']), { nombre: 'Afiliado' })).status).toBe(403)
    for (const [i, t] of [solo('crear'), token(['super_admin']), ADMIN].entries()) {
      expect((await llamar('post', '/api/cms/normativas-secciones', t, { nombre: `Creada por ${i}` })).status).toBe(201)
    }
  })

  it('editar exige «editar»', async () => {
    const s = await crearSeccion()
    const url = `/api/cms/normativas-secciones/${s.id}`
    expect((await llamar('put', url, undefined, { publica: false })).status).toBe(401)
    expect((await llamar('put', url, sin('editar'), { publica: false })).status).toBe(403)
    for (const t of [solo('editar'), token(['super_admin']), ADMIN]) expect((await llamar('put', url, t, { publica: false })).status).toBe(200)
  })

  it('eliminar exige «eliminar»', async () => {
    for (const t of [solo('eliminar'), token(['super_admin']), ADMIN]) {
      const s = await crearSeccion()
      const url = `/api/cms/normativas-secciones/${s.id}`
      expect((await llamar('delete', url)).status).toBe(401)
      expect((await llamar('delete', url, sin('eliminar'))).status).toBe(403)
      expect((await llamar('delete', url, t)).status).toBe(200)
      expect((await llamar('delete', url, t)).status).toBe(404)
    }
  })

  it('listar devuelve el total de documentos (no eliminados) y si es pública', async () => {
    const s = await crearSeccion('Con total', false)
    await crearDoc(s.nombre)
    await crearDoc(s.nombre, false)
    const borrado = await crearDoc(s.nombre)
    await mem.execute({ sql: `UPDATE cms_normativas SET eliminado_en = 'x' WHERE id_normativa = ?`, args: [borrado] })
    const r = await llamar('get', '/api/cms/normativas-secciones', ADMIN)
    const fila = r.body.data.find((x: any) => x.id === s.id)
    expect(fila).toMatchObject({ nombre: 'Con total', slug: 'con-total', publica: 0, total: 2 })
  })
})

describe('secciones: validación', () => {
  it('nombres duplicados (mayúsculas/acentos) → 409; vacíos, largos, «Otros» o sin letras → 400', async () => {
    for (const nombre of ['Leyes y Decretos', 'leyes y decretos', 'LEYES Y DECRETÓS', '  Leyes   y  Decretos ']) {
      const r = await llamar('post', '/api/cms/normativas-secciones', ADMIN, { nombre })
      expect(r.status, nombre).toBe(409)
      expect(r.body.message).toMatch(/Ya existe/)
    }
    for (const nombre of ['', '   ', 'x'.repeat(81), 'Otros', 'otros', '!!!', 42]) {
      expect((await llamar('post', '/api/cms/normativas-secciones', ADMIN, { nombre })).status, String(nombre)).toBe(400)
    }
    expect((await llamar('post', '/api/cms/normativas-secciones', ADMIN, { nombre: 'Válida', publica: 'si' })).status).toBe(400)
  })

  it('renombrar: mueve los documentos, conserva el slug y no choca con otra sección', async () => {
    const s = await crearSeccion('Antes')
    const d1 = await crearDoc('Antes')
    const d2 = await crearDoc('Antes', false)
    const r = await llamar('put', `/api/cms/normativas-secciones/${s.id}`, solo('editar'), { nombre: 'Después' })
    expect(r.status).toBe(200)
    expect(r.body.data).toMatchObject({ nombre: 'Después', slug: 'antes' })
    const docs = await mem.execute({ sql: `SELECT categoria FROM cms_normativas WHERE id_normativa IN (?, ?)`, args: [d1, d2] })
    expect(docs.rows.map(x => x.categoria)).toEqual(['Después', 'Después'])
    // el slug viejo sigue ocupado
    expect((await llamar('post', '/api/cms/normativas-secciones', ADMIN, { nombre: 'Antes' })).status).toBe(409)
    // el nombre de otra sección también
    expect((await llamar('put', `/api/cms/normativas-secciones/${s.id}`, ADMIN, { nombre: 'Reglamentos y estatutos' })).status).toBe(409)
    expect((await llamar('put', `/api/cms/normativas-secciones/${s.id}`, ADMIN, { nombre: 'Otros' })).status).toBe(400)
    // cambiar solo mayúsculas del propio nombre sí se puede
    expect((await llamar('put', `/api/cms/normativas-secciones/${s.id}`, ADMIN, { nombre: 'DESPUÉS', orden: 7 })).status).toBe(200)
    expect(await seccionPorSlug('antes')).toMatchObject({ nombre: 'DESPUÉS', orden: 7 })
    expect((await llamar('put', '/api/cms/normativas-secciones/99999', ADMIN, { publica: false })).status).toBe(404)
  })

  it('eliminar: 409 mientras tenga documentos, permitido cuando está vacía', async () => {
    const s = await crearSeccion('Con documentos')
    const d = await crearDoc('Con documentos', false)
    const r = await llamar('delete', `/api/cms/normativas-secciones/${s.id}`, ADMIN)
    expect(r.status).toBe(409)
    expect(r.body.message).toMatch(/documentos/)
    await mem.execute({ sql: 'DELETE FROM cms_normativas WHERE id_normativa = ?', args: [d] })
    expect((await llamar('delete', `/api/cms/normativas-secciones/${s.id}`, ADMIN)).status).toBe(200)
  })

  it('una sección original también se puede renombrar y borrar', async () => {
    const normas = await seccionPorSlug('normas-y-procedimientos')
    await mem.execute(`DELETE FROM cms_normativas WHERE categoria = 'Normas y Procedimientos'`)
    expect((await llamar('put', `/api/cms/normativas-secciones/${normas.id}`, ADMIN, { nombre: 'Normas internas' })).status).toBe(200)
    expect((await llamar('delete', `/api/cms/normativas-secciones/${normas.id}`, ADMIN)).status).toBe(200)
  })
})

describe('documentos: categoría y permisos con secciones creadas', () => {
  const doc = (categoria?: string) => ({ titulo: 'Doc', url_archivo: 'https://x.test/a.pdf', ...(categoria === undefined ? {} : { categoria }) })

  it('acepta una sección nueva, «Otros» o vacío (admin); rechaza una desconocida', async () => {
    const s = await crearSeccion('Circulares')
    expect((await llamar('post', '/api/cms/normativas', ADMIN, doc(s.nombre))).status).toBe(201)
    expect((await llamar('post', '/api/cms/normativas', ADMIN, doc('Otros'))).status).toBe(201)
    expect((await llamar('post', '/api/cms/normativas', ADMIN, doc(''))).status).toBe(201)
    expect((await llamar('post', '/api/cms/normativas', ADMIN, doc())).status).toBe(201)
    expect((await llamar('post', '/api/cms/normativas', ADMIN, doc('Inventada'))).status).toBe(400)
    const id = await crearDoc(s.nombre)
    expect((await llamar('put', `/api/cms/normativas/${id}`, ADMIN, doc('Inventada'))).status).toBe(400)
    expect((await llamar('put', `/api/cms/normativas/${id}`, ADMIN, doc('Leyes y Decretos'))).status).toBe(200)
  })

  it('una sección creada se resuelve como marco_legal; «Otros» queda solo para admin', async () => {
    const s = await crearSeccion('Resoluciones')
    expect((await llamar('post', '/api/cms/normativas', solo('crear'), doc(s.nombre))).status).toBe(201)
    expect((await llamar('post', '/api/cms/normativas', sin('crear'), doc(s.nombre))).status).toBe(403)
    expect((await llamar('post', '/api/cms/normativas', solo('crear'), doc('Otros'))).status).toBe(403)
    const id = await crearDoc(s.nombre)
    expect((await llamar('put', `/api/cms/normativas/${id}`, solo('editar'), doc(s.nombre))).status).toBe(200)
    expect((await llamar('put', `/api/cms/normativas/${id}`, sin('editar'), doc(s.nombre))).status).toBe(403)
    expect((await llamar('put', '/api/cms/normativas-reorder', solo('editar'), { items: [{ id, orden: 1 }] })).status).toBe(200)
    expect((await llamar('post', '/api/cms/normativas-batch-delete', sin('eliminar'), { ids: [id] })).status).toBe(403)
    expect((await llamar('delete', `/api/cms/normativas/${id}`, solo('eliminar'))).status).toBe(200)
  })

  it('suplantación: se resuelve con la categoría GUARDADA, exacta', async () => {
    const s = await crearSeccion('Dictámenes')
    const t = token(['solo_crear_marco_legal', 'solo_editar_marco_legal', 'solo_eliminar_marco_legal'])
    const otros = await crearDoc('Otros')
    const casiIgual = await crearDoc('dictámenes') // no coincide exacto con ninguna sección
    const propio = await crearDoc(s.nombre)
    // decir en el cuerpo que es de la sección no abre un registro «Otros»
    expect((await llamar('put', `/api/cms/normativas/${otros}`, t, doc(s.nombre))).status).toBe(403)
    expect((await llamar('delete', `/api/cms/normativas/${otros}`, t)).status).toBe(403)
    expect((await llamar('delete', `/api/cms/normativas/${casiIgual}`, t)).status).toBe(403)
    // ni mover uno propio a «Otros»; ni colar un «Otros» en un lote/reorden
    expect((await llamar('put', `/api/cms/normativas/${propio}`, t, doc('Otros'))).status).toBe(403)
    expect((await llamar('post', '/api/cms/normativas-batch-delete', t, { ids: [propio, otros] })).status).toBe(403)
    expect((await llamar('put', '/api/cms/normativas-reorder', t, { items: [{ id: propio, orden: 0 }, { id: otros, orden: 1 }] })).status).toBe(403)
    // no se puede crear una sección llamada «Otros» para abrir esos documentos
    expect((await llamar('post', '/api/cms/normativas-secciones', ADMIN, { nombre: 'OTROS' })).status).toBe(400)
    // tras renombrar, sus documentos siguen siendo marco_legal; el nombre viejo ya no
    expect((await llamar('put', `/api/cms/normativas-secciones/${s.id}`, ADMIN, { nombre: 'Dictámenes técnicos' })).status).toBe(200)
    expect((await llamar('put', `/api/cms/normativas/${propio}`, t, doc('Dictámenes técnicos'))).status).toBe(200)
    expect((await llamar('post', '/api/cms/normativas', t, doc('Dictámenes'))).status).toBe(403)
  })

  it('el listado del panel exige marco_legal/ver', async () => {
    expect((await llamar('get', '/api/cms/normativas')).status).toBe(401)
    expect((await llamar('get', '/api/cms/normativas', sin('ver'))).status).toBe(403)
    expect((await llamar('get', '/api/cms/normativas', solo('ver'))).status).toBe(200)
  })
})

describe('público: solo secciones públicas con documentos publicados', () => {
  let publica: any, privada: any, vacia: any, soloOcultos: any
  beforeEach(async () => {
    await mem.execute('DELETE FROM cms_normativas')
    await mem.execute(`DELETE FROM cms_normativa_secciones`)
    await sembrarSeccionesNormativa(mem)
    publica = await crearSeccion('Pública con docs', true)
    privada = await crearSeccion('Privada con docs', false)
    vacia = await crearSeccion('Pública vacía', true)
    soloOcultos = await crearSeccion('Pública con ocultos', true)
    await crearDoc(publica.nombre)
    await crearDoc(privada.nombre)
    await crearDoc(soloOcultos.nombre, false)
    const borrado = await crearDoc(vacia.nombre)
    await mem.execute({ sql: `UPDATE cms_normativas SET eliminado_en = 'x' WHERE id_normativa = ?`, args: [borrado] })
    await crearDoc('Otros')
    await crearDoc(null)
    await crearDoc('Inventada')
  })

  it('GET /secciones lista solo las públicas con documentos', async () => {
    const r = await llamar('get', '/api/public/normativas/secciones')
    expect(r.status).toBe(200)
    expect(r.body.data).toEqual([{ nombre: 'Pública con docs', slug: 'publica-con-docs', total: 1 }])
  })

  it('sin categoría: solo documentos de secciones públicas (nunca privadas, «Otros», nulos ni desconocidas)', async () => {
    const r = await llamar('get', '/api/public/normativas')
    const cats = new Set(r.body.data.map((x: any) => x.categoria))
    expect([...cats].sort()).toEqual(['Actas de Asamblea', 'Pública con docs'])
  })

  it('con categoría: privada, desconocida u «Otros» → lista vacía', async () => {
    for (const categoria of [privada.nombre, 'Otros', 'Inventada', '']) {
      const r = await llamar('get', `/api/public/normativas?categoria=${encodeURIComponent(categoria)}`)
      expect(r.status).toBe(200)
      expect(r.body.data.every((x: any) => x.categoria !== privada.nombre && x.categoria !== 'Otros' && x.categoria !== 'Inventada'), categoria).toBe(true)
    }
    expect((await llamar('get', `/api/public/normativas?categoria=${encodeURIComponent(privada.nombre)}`)).body.data).toEqual([])
    const ok = await llamar('get', `/api/public/normativas?categoria=${encodeURIComponent(publica.nombre)}`)
    expect(ok.body.data.map((x: any) => x.categoria)).toEqual(['Pública con docs'])
  })

  it('al volverse privada desaparece de todas las respuestas públicas', async () => {
    await llamar('put', `/api/cms/normativas-secciones/${publica.id}`, ADMIN, { publica: false })
    expect((await llamar('get', '/api/public/normativas/secciones')).body.data).toEqual([])
    expect((await llamar('get', `/api/public/normativas?categoria=${encodeURIComponent(publica.nombre)}`)).body.data).toEqual([])
    expect((await llamar('get', '/api/public/normativas')).body.data.some((x: any) => x.categoria === publica.nombre)).toBe(false)
  })

  it('las actas de asamblea siguen a la sección de slug «actas-de-asamblea» (privada → ocultas; renombrada → nuevo nombre)', async () => {
    const actas = await seccionPorSlug('actas-de-asamblea')
    expect((await llamar('get', '/api/public/normativas?categoria=Actas%20de%20Asamblea')).body.data.map((x: any) => x.id_normativa)).toEqual(['asamblea-1'])
    await llamar('put', `/api/cms/normativas-secciones/${actas.id}`, ADMIN, { nombre: 'Actas', publica: true })
    expect((await llamar('get', '/api/public/normativas?categoria=Actas')).body.data.map((x: any) => x.categoria)).toEqual(['Actas'])
    await llamar('put', `/api/cms/normativas-secciones/${actas.id}`, ADMIN, { publica: false })
    expect((await llamar('get', '/api/public/normativas?categoria=Actas')).body.data).toEqual([])
    expect((await llamar('get', '/api/public/normativas')).body.data.some((x: any) => String(x.id_normativa).startsWith('asamblea-'))).toBe(false)
    await llamar('delete', `/api/cms/normativas-secciones/${actas.id}`, ADMIN)
    expect((await llamar('get', '/api/public/normativas')).body.data.some((x: any) => String(x.id_normativa).startsWith('asamblea-'))).toBe(false)
  })
})
