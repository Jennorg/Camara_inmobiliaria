import { createClient } from '@libsql/client'
import express from 'express'
import request from 'supertest'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { sembrarRoles, SECCIONES } from '../config/secciones.js'

const mem = createClient({ url: ':memory:' })
vi.mock('../lib/db.js', () => ({ db: mem }))

const { permisosDeRoles, invalidarCachePermisos } = await import('./permisos.service.js')
const { requirePermiso } = await import('../middlewares/auth.middleware.js')

beforeAll(async () => {
  // DDL copiado de config/initdb.ts
  await mem.batch([
    `CREATE TABLE IF NOT EXISTS roles (
    id                  INTEGER     PRIMARY KEY,
    clave               TEXT        UNIQUE NOT NULL,
    nombre              TEXT        NOT NULL,
    es_sistema          INTEGER     NOT NULL DEFAULT 0 CHECK (es_sistema IN (0,1)),
    activo              INTEGER     NOT NULL DEFAULT 1 CHECK (activo IN (0,1)),
    creado_en           TEXT        NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  )`,
    `CREATE TABLE IF NOT EXISTS rol_permisos (
    id_rol              INTEGER     NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    seccion             TEXT        NOT NULL,
    ver                 INTEGER     NOT NULL DEFAULT 0 CHECK (ver IN (0,1)),
    crear               INTEGER     NOT NULL DEFAULT 0 CHECK (crear IN (0,1)),
    editar              INTEGER     NOT NULL DEFAULT 0 CHECK (editar IN (0,1)),
    eliminar            INTEGER     NOT NULL DEFAULT 0 CHECK (eliminar IN (0,1)),
    PRIMARY KEY (id_rol, seccion)
  )`,
  ], 'write')
  await sembrarRoles(mem)
  await mem.batch([
    `INSERT INTO roles (clave, nombre, activo) VALUES ('lector', 'Lector', 1), ('apagado', 'Apagado', 0)`,
    `INSERT INTO rol_permisos (id_rol, seccion, ver) SELECT id, 'noticias', 1 FROM roles WHERE clave = 'lector'`,
    `INSERT INTO rol_permisos (id_rol, seccion, ver, crear, editar, eliminar) SELECT id, 'noticias', 1, 1, 1, 1 FROM roles WHERE clave = 'apagado'`,
    // casilla que nunca debe valer, aunque esté guardada
    `INSERT INTO rol_permisos (id_rol, seccion, ver) SELECT id, 'roles', 1 FROM roles WHERE clave = 'lector'`,
  ], 'write')
})

beforeEach(() => invalidarCachePermisos())

const todo = { ver: true, crear: true, editar: true, eliminar: true }
const nada = { ver: false, crear: false, editar: false, eliminar: false }

describe('permisosDeRoles', () => {
  it('une_permisos_de_varios_roles', async () => {
    const m = await permisosDeRoles(['secretario', 'asistente', 'lector'])
    expect(m.asambleas).toEqual(todo)
    expect(m.afiliados).toEqual({ ver: true, crear: true, editar: true, eliminar: false })
    expect(m.noticias).toEqual({ ver: true, crear: false, editar: false, eliminar: false })
    expect(m.leyes ?? nada).toEqual(nada)
  })

  it('super_admin_tiene_todo', async () => {
    const m = await permisosDeRoles(['super_admin'])
    for (const s of SECCIONES) expect(m[s.id]).toEqual(todo)
  })

  it('ignora_roles_inactivos_o_inexistentes', async () => {
    const m = await permisosDeRoles(['apagado', 'no_existe', 'lector'])
    expect(m.noticias).toEqual({ ver: true, crear: false, editar: false, eliminar: false })
    expect(await permisosDeRoles(['no_existe'])).toEqual({})
  })

  it('roles y admin_users solo para super_admin', async () => {
    const m = await permisosDeRoles(['admin', 'lector'])
    expect(m.roles ?? nada).toEqual(nada)
    expect(m.admin_users ?? nada).toEqual(nada)
    expect(m.finanzas).toEqual(todo)
  })

  it('invalida_cache_al_editar', async () => {
    expect((await permisosDeRoles(['lector'])).noticias.crear).toBe(false)
    await mem.execute(`UPDATE rol_permisos SET crear = 1 WHERE seccion = 'noticias' AND id_rol = (SELECT id FROM roles WHERE clave = 'lector')`)
    expect((await permisosDeRoles(['lector'])).noticias.crear).toBe(false) // sigue en caché
    invalidarCachePermisos()
    expect((await permisosDeRoles(['lector'])).noticias.crear).toBe(true)
    await mem.execute(`UPDATE rol_permisos SET crear = 0 WHERE seccion = 'noticias' AND id_rol = (SELECT id FROM roles WHERE clave = 'lector')`)
  })

  it('no deja mutar la caché', async () => {
    const m = await permisosDeRoles(['lector'])
    try { m.noticias.eliminar = true } catch { /* congelado */ }
    expect((await permisosDeRoles(['lector'])).noticias.eliminar).toBe(false)
  })
})

describe('requirePermiso', () => {
  const app = (user: any, seccion: string, accion?: any) => {
    const a = express()
    a.use((req, _res, next) => { if (user) req.user = user; next() })
    a.all('/x', requirePermiso(seccion, accion), (_req, res) => { res.json({ ok: true }) })
    return a
  }
  const lector = { id: 1, email: 'l@x', roles: ['lector'], rol: 'lector' }

  it('sin req.user => 401', async () => {
    const r = await request(app(null, 'noticias')).get('/x')
    expect(r.status).toBe(401)
    expect(r.body).toEqual({ success: false, message: 'No autenticado' })
  })

  it('403 sin la casilla', async () => {
    const r = await request(app(lector, 'noticias', 'crear')).get('/x')
    expect(r.status).toBe(403)
    expect(r.body).toEqual({ success: false, message: 'Acceso denegado: permisos insuficientes' })
  })

  it('200 con ella', async () => {
    expect((await request(app(lector, 'noticias')).get('/x')).status).toBe(200)
    expect((await request(app({ ...lector, roles: undefined }, 'noticias')).get('/x')).status).toBe(200)
  })

  it('DELETE exige eliminar', async () => {
    const asistente = { id: 2, email: 'a@x', roles: ['asistente'], rol: 'asistente' }
    expect((await request(app(asistente, 'afiliados')).put('/x')).status).toBe(200)
    expect((await request(app(asistente, 'afiliados')).delete('/x')).status).toBe(403)
    expect((await request(app(asistente, 'finanzas')).delete('/x')).status).toBe(200)
  })

  it("sección 'roles' denegada a admin y permitida a super_admin", async () => {
    expect((await request(app({ id: 3, email: 'ad@x', roles: ['admin'], rol: 'admin' }, 'roles')).get('/x')).status).toBe(403)
    expect((await request(app({ id: 4, email: 's@x', roles: ['super_admin'], rol: 'super_admin' }, 'roles')).get('/x')).status).toBe(200)
  })

  it('error leyendo permisos => 500', async () => {
    const spy = vi.spyOn(mem, 'execute').mockRejectedValueOnce(new Error('db caída'))
    const r = await request(app(lector, 'noticias')).get('/x')
    spy.mockRestore()
    expect(r.status).toBe(500)
    expect(r.body.success).toBe(false)
  })
})
