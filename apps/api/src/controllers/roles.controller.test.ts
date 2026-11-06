import { createClient } from '@libsql/client'
import express from 'express'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { sembrarRoles } from '../config/secciones.js'

const mem = createClient({ url: ':memory:' })
vi.mock('../lib/db.js', () => ({ db: mem }))
const enviarCorreo = vi.fn(async (..._a: any[]) => {})
// Pasa al original y registra las llamadas (un spy sobre el namespace ESM no intercepta el import del controller).
const invalidar = vi.fn()
vi.mock('../services/permisos.service.js', async (orig) => {
  const real: any = await orig()
  return { ...real, invalidarCachePermisos: () => { invalidar(); real.invalidarCachePermisos() } }
})
vi.mock('../lib/email.js', () => ({ enviarCorreoOnboardingMasivo: (...a: any[]) => enviarCorreo(...a) }))

const { env } = await import('../config/env.js')
const { default: rolesRoutes } = await import('../routes/roles.routes.js')
const permisos = await import('../services/permisos.service.js')

const app = express()
app.use(express.json())
app.use('/api/roles', rolesRoutes)

const token = (u: { id: number; roles: string[] }) =>
  `Bearer ${jwt.sign({ id: u.id, email: `u${u.id}@x`, roles: u.roles, rol: u.roles[0] }, env.JWT_SECRET)}`
const SUPER = token({ id: 1, roles: ['super_admin'] })
const ADMIN = token({ id: 2, roles: ['admin'] })

beforeAll(async () => {
  // DDL copiado de config/initdb.ts (columnas necesarias)
  await mem.batch([
    `CREATE TABLE users (
      id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
      roles TEXT NOT NULL DEFAULT '["afiliado"]', activo INTEGER NOT NULL DEFAULT 1,
      creado_en TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
      actualizado_en TEXT, eliminado_en TEXT, nombre TEXT)`,
    `CREATE TABLE roles (
      id INTEGER PRIMARY KEY, clave TEXT UNIQUE NOT NULL, nombre TEXT NOT NULL,
      es_sistema INTEGER NOT NULL DEFAULT 0 CHECK (es_sistema IN (0,1)),
      activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0,1)),
      creado_en TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')))`,
    `CREATE TABLE rol_permisos (
      id_rol INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE, seccion TEXT NOT NULL,
      ver INTEGER NOT NULL DEFAULT 0, crear INTEGER NOT NULL DEFAULT 0,
      editar INTEGER NOT NULL DEFAULT 0, eliminar INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (id_rol, seccion))`,
    `CREATE TABLE tokens_accion (
      id INTEGER PRIMARY KEY, token TEXT UNIQUE NOT NULL, tipo TEXT NOT NULL, email TEXT,
      data_json TEXT, usado INTEGER NOT NULL DEFAULT 0, fecha_expiracion TEXT NOT NULL,
      creado_en TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')))`,
    `CREATE TABLE afiliados (id_afiliado INTEGER PRIMARY KEY, id_user INTEGER, id_persona INTEGER)`,
    `CREATE TABLE personas (id INTEGER PRIMARY KEY, nombres TEXT)`,
    `INSERT INTO users (id, email, password_hash, roles) VALUES
      (1, 'super@x', 'h', '["super_admin"]'),
      (2, 'admin@x', 'h', '["admin"]'),
      (3, 'afi@x', 'h', '["afiliado"]'),
      (4, 'otro_super@x', 'h', '["super_admin"]'),
      (5, 'asis@x', 'h', '["asistente"]'),
      (6, 'legacy@x', 'h', 'admin'),
      (7, ' Mixto@Ciebo.ORG', 'h', '["afiliado"]'),
      (8, 'carrera@ciebo.org', 'h', '["afiliado"]')`,
  ], 'write')
  await sembrarRoles(mem)
})

beforeEach(() => { enviarCorreo.mockReset(); enviarCorreo.mockResolvedValue(undefined) })

const idDe = async (clave: string) =>
  Number((await mem.execute({ sql: 'SELECT id FROM roles WHERE clave = ?', args: [clave] })).rows[0].id)
const flags = async (idRol: number, seccion: string) =>
  (await mem.execute({ sql: 'SELECT ver, crear, editar, eliminar FROM rol_permisos WHERE id_rol = ? AND seccion = ?', args: [idRol, seccion] })).rows[0]
const rolesDe = async (id: number) =>
  JSON.parse(String((await mem.execute({ sql: 'SELECT roles FROM users WHERE id = ?', args: [id] })).rows[0].roles))

describe('acceso', () => {
  it('sesión suplantada no accede aunque sea super_admin', async () => {
    const firmar = (extra: object) => `Bearer ${jwt.sign({ id: 4, email: 'u4@x', roles: ['super_admin'], rol: 'super_admin', ...extra }, env.JWT_SECRET)}`
    expect((await request(app).get('/api/roles').set('Authorization', firmar({ impersonatedBy: 2 }))).status).toBe(403)
    expect((await request(app).get('/api/roles').set('Authorization', firmar({}))).status).toBe(200)
  })

  it('solo_super_admin_accede', async () => {
    for (const [m, url] of [['get', '/api/roles'], ['get', '/api/roles/secciones'], ['post', '/api/roles'], ['put', '/api/roles/1'],
      ['delete', '/api/roles/1'], ['put', '/api/roles/usuarios/3'], ['post', '/api/roles/staff']] as const) {
      expect((await (request(app) as any)[m](url).set('Authorization', ADMIN).send({})).status).toBe(403)
    }
    expect((await request(app).get('/api/roles')).status).toBe(401)
    expect((await request(app).get('/api/roles').set('Authorization', SUPER)).status).toBe(200)
  })

  it('secciones_sin_las_solo_superadmin', async () => {
    const r = await request(app).get('/api/roles/secciones').set('Authorization', SUPER)
    const ids = r.body.data.map((s: any) => s.id)
    expect(ids).toContain('finanzas')
    expect(ids).not.toContain('roles')
    expect(ids).not.toContain('admin_users')
    expect(r.body.data[0]).toHaveProperty('etiqueta')
  })
})

describe('roles', () => {
  it('crear_rol_y_editar_matriz_invalida_cache', async () => {
    const c = await request(app).post('/api/roles').set('Authorization', SUPER)
      .send({ nombre: 'Editor de noticias', permisos: { noticias: { ver: true, crear: true } } })
    expect(c.status).toBe(201)
    expect(c.body.data.clave).toBe('editor_de_noticias')
    const id = c.body.data.id

    expect((await permisos.permisosDeRoles(['editor_de_noticias'])).noticias).toEqual({ ver: true, crear: true, editar: false, eliminar: false })

    const u = await request(app).put(`/api/roles/${id}`).set('Authorization', SUPER)
      .send({ nombre: 'Editor', permisos: { marco_legal: { ver: true, editar: true } } })
    expect(u.status).toBe(200)

    const m = await permisos.permisosDeRoles(['editor_de_noticias'])
    expect(m.marco_legal).toEqual({ ver: true, crear: false, editar: true, eliminar: false })
    expect(m.noticias).toEqual({ ver: false, crear: false, editar: false, eliminar: false }) // no enviada => todo a 0
    // nunca borra filas: la de noticias queda en 0
    expect(await flags(id, 'noticias')).toMatchObject({ ver: 0, crear: 0, editar: 0, eliminar: 0 })

    const l = await request(app).get('/api/roles').set('Authorization', SUPER)
    const fila = l.body.data.find((r: any) => r.id === id)
    expect(fila).toMatchObject({ clave: 'editor_de_noticias', nombre: 'Editor', es_sistema: 0, usuarios: 0 })
    expect(fila.permisos.marco_legal).toEqual({ ver: true, crear: false, editar: true, eliminar: false })
    expect(fila.permisos.roles).toBeUndefined()
    expect(l.body.data.find((r: any) => r.clave === 'admin').usuarios).toBe(2) // incluye roles legado no-JSON
  })

  it('clave normalizada y rechazo de claves reservadas', async () => {
    const c = await request(app).post('/api/roles').set('Authorization', SUPER)
      .send({ nombre: '  Coordinación, Académica!! ', permisos: {} })
    expect(c.status).toBe(201)
    expect(c.body.data.clave).toBe('coordinacion_academica')
    for (const nombre of ['Super Admin', 'afiliado', 'Estudiante', '!!!', '']) {
      expect((await request(app).post('/api/roles').set('Authorization', SUPER).send({ nombre, permisos: {} })).status).toBe(400)
    }
  })

  it('409 duplicado', async () => {
    await request(app).post('/api/roles').set('Authorization', SUPER).send({ nombre: 'Duplicado', permisos: {} })
    expect((await request(app).post('/api/roles').set('Authorization', SUPER).send({ nombre: 'duplicado', permisos: {} })).status).toBe(409)
    expect((await request(app).post('/api/roles').set('Authorization', SUPER).send({ nombre: 'Admin', permisos: {} })).status).toBe(409)
  })

  it('matriz con ver=false fuerza el resto a false', async () => {
    const c = await request(app).post('/api/roles').set('Authorization', SUPER)
      .send({ nombre: 'Sin ver', permisos: { finanzas: { ver: false, crear: true, editar: true, eliminar: true } } })
    expect(c.status).toBe(201)
    expect(await flags(c.body.data.id, 'finanzas')).toMatchObject({ ver: 0, crear: 0, editar: 0, eliminar: 0 })
  })

  it('sección solo-superadmin, desconocida o acción no booleana rechazadas', async () => {
    const id = await idDe('asistente')
    for (const p of [{ roles: { ver: true } }, { admin_users: { ver: true } }, { inventada: { ver: true } }, { finanzas: { ver: 'si' } }, { finanzas: true }, []]) {
      expect((await request(app).put(`/api/roles/${id}`).set('Authorization', SUPER).send({ permisos: p })).status).toBe(400)
    }
    expect((await request(app).put('/api/roles/super_admin').set('Authorization', SUPER).send({ permisos: {} })).status).toBe(404)
    expect((await request(app).put('/api/roles/99999').set('Authorization', SUPER).send({ permisos: {} })).status).toBe(404)
  })

  it('no_borra_rol_de_sistema_ni_con_usuarios', async () => {
    expect((await request(app).delete(`/api/roles/${await idDe('asistente')}`).set('Authorization', SUPER)).status).toBe(400)

    const c = await request(app).post('/api/roles').set('Authorization', SUPER).send({ nombre: 'Temporal', permisos: { noticias: { ver: true } } })
    const id = c.body.data.id
    // falso positivo de LIKE: 'temporal_x' no es 'temporal'
    await mem.execute(`INSERT INTO users (id, email, password_hash, roles) VALUES (20, 't@x', 'h', '["temporal_x"]')`)
    await mem.execute(`INSERT INTO users (id, email, password_hash, roles) VALUES (21, 't2@x', 'h', '["temporal"]')`)
    expect((await request(app).delete(`/api/roles/${id}`).set('Authorization', SUPER)).status).toBe(409)

    await mem.execute(`DELETE FROM users WHERE id = 21`)
    expect((await permisos.permisosDeRoles(['temporal'])).noticias?.ver).toBe(true)
    expect((await request(app).delete(`/api/roles/${id}`).set('Authorization', SUPER)).status).toBe(200)
    expect(await permisos.permisosDeRoles(['temporal'])).toEqual({}) // caché invalidada
    expect((await mem.execute({ sql: 'SELECT COUNT(*) AS n FROM rol_permisos WHERE id_rol = ?', args: [id] })).rows[0].n).toBe(0)
    expect((await mem.execute(`SELECT COUNT(*) AS n FROM roles WHERE clave = 'temporal'`)).rows[0].n).toBe(0)
  })
})

describe('asignación', () => {
  it('asignar_rol_conserva_afiliado', async () => {
    invalidar.mockClear()
    const r = await request(app).put('/api/roles/usuarios/3').set('Authorization', SUPER).send({ roles: ['secretario', 'secretario', 'personal'] })
    expect(r.status).toBe(200)
    expect(invalidar).toHaveBeenCalled()
    expect((await rolesDe(3)).sort()).toEqual(['afiliado', 'personal', 'secretario'])
    expect((await mem.execute('SELECT actualizado_en FROM users WHERE id = 3')).rows[0].actualizado_en).not.toBeNull()

    expect((await request(app).put('/api/roles/usuarios/5').set('Authorization', SUPER).send({ roles: ['estudiante'] })).status).toBe(200)
    expect(await rolesDe(5)).toEqual(['estudiante'])
    expect((await request(app).put('/api/roles/usuarios/5').set('Authorization', SUPER).send({ roles: ['no_existe'] })).status).toBe(400)
    expect((await request(app).put('/api/roles/usuarios/5').set('Authorization', SUPER).send({ roles: 'secretario' })).status).toBe(400)
    expect((await request(app).put('/api/roles/usuarios/999').set('Authorization', SUPER).send({ roles: [] })).status).toBe(404)
  })

  it('no_permite_asignarse_a_si_mismo', async () => {
    expect((await request(app).put('/api/roles/usuarios/1').set('Authorization', SUPER).send({ roles: ['personal'] })).status).toBe(403)
    expect(await rolesDe(1)).toEqual(['super_admin'])
    // tampoco tocar a otro super_admin
    expect((await request(app).put('/api/roles/usuarios/4').set('Authorization', SUPER).send({ roles: ['personal'] })).status).toBe(403)
    expect(await rolesDe(4)).toEqual(['super_admin'])
  })

  it('asignar a un admin conserva admin', async () => {
    expect((await request(app).put('/api/roles/usuarios/2').set('Authorization', SUPER).send({ roles: ['secretario'] })).status).toBe(200)
    expect((await rolesDe(2)).sort()).toEqual(['admin', 'secretario'])
  })

  it('no puede asignar admin/super_admin', async () => {
    for (const roles of [['admin'], ['super_admin'], ['personal', 'admin']]) {
      expect((await request(app).put('/api/roles/usuarios/5').set('Authorization', SUPER).send({ roles })).status).toBe(403)
    }
  })
})

describe('staff', () => {
  it('crear_staff_sin_afiliado', async () => {
    const r = await request(app).post('/api/roles/staff').set('Authorization', SUPER)
      .send({ nombre: 'Ana Pérez', email: '  Ana@Ciebo.ORG ', roles: ['secretaria'] })
    expect(r.status).toBe(201)
    expect(r.body.data.invitacion_enviada).toBe(true)
    const u = (await mem.execute(`SELECT id, roles, nombre, password_hash FROM users WHERE email = 'ana@ciebo.org'`)).rows[0]
    expect(JSON.parse(String(u.roles))).toEqual(['secretaria'])
    expect(u.nombre).toBe('Ana Pérez')
    expect(String(u.password_hash)).toMatch(/^\$2[aby]\$/)
    expect((await mem.execute({ sql: 'SELECT COUNT(*) AS n FROM afiliados WHERE id_user = ?', args: [u.id] })).rows[0].n).toBe(0)
    expect((await mem.execute('SELECT COUNT(*) AS n FROM personas')).rows[0].n).toBe(0)

    expect(enviarCorreo).toHaveBeenCalledTimes(1)
    const [nombre, email, raw] = enviarCorreo.mock.calls[0]
    expect([nombre, email]).toEqual(['Ana Pérez', 'ana@ciebo.org'])
    const tk = (await mem.execute(`SELECT token, tipo FROM tokens_accion WHERE email = 'ana@ciebo.org'`)).rows
    expect(tk).toHaveLength(1)
    expect(tk[0].tipo).toBe('reset_password')
    expect(tk[0].token).not.toBe(raw) // se guarda el hash

    expect((await request(app).post('/api/roles/staff').set('Authorization', SUPER)
      .send({ nombre: 'Otra', email: 'ana@ciebo.org', roles: ['secretaria'] })).status).toBe(409)
  })

  it('valida datos y roles del staff', async () => {
    const base = { nombre: 'X', email: 'x@ciebo.org', roles: ['personal'] }
    for (const [cambio, st] of [[{ email: 'no-es-correo' }, 400], [{ nombre: '  ' }, 400], [{ roles: [] }, 400],
      [{ roles: ['afiliado'] }, 400], [{ roles: ['no_existe'] }, 400], [{ roles: ['admin'] }, 403], [{ roles: ['super_admin'] }, 403]] as const) {
      expect((await request(app).post('/api/roles/staff').set('Authorization', SUPER).send({ ...base, ...cambio })).status).toBe(st)
    }
    expect((await mem.execute(`SELECT COUNT(*) AS n FROM users WHERE email = 'x@ciebo.org'`)).rows[0].n).toBe(0)
  })

  it('correo duplicado sin distinguir mayúsculas ni espacios => 409', async () => {
    const r = await request(app).post('/api/roles/staff').set('Authorization', SUPER)
      .send({ nombre: 'Mixto', email: 'mixto@ciebo.org', roles: ['personal'] })
    expect(r.status).toBe(409)
    expect((await mem.execute(`SELECT COUNT(*) AS n FROM users WHERE LOWER(TRIM(email)) = 'mixto@ciebo.org'`)).rows[0].n).toBe(1)
  })

  it('carrera en el alta (violación de UNIQUE) => 409, no 500', async () => {
    const original = mem.execute.bind(mem)
    const spy = vi.spyOn(mem, 'execute').mockImplementation((q: any) =>
      String(q?.sql ?? q).includes('SELECT 1 FROM users') ? Promise.resolve({ rows: [] } as any) : original(q))
    const r = await request(app).post('/api/roles/staff').set('Authorization', SUPER)
      .send({ nombre: 'Dup', email: 'carrera@ciebo.org', roles: ['personal'] })
    spy.mockRestore()
    expect(r.status).toBe(409)
  })

  it('crear staff con fallo de correo => 201 invitacion_enviada:false', async () => {
    enviarCorreo.mockRejectedValueOnce(new Error('resend caído'))
    const r = await request(app).post('/api/roles/staff').set('Authorization', SUPER)
      .send({ nombre: 'Luis', email: 'luis@ciebo.org', roles: ['personal'] })
    expect(r.status).toBe(201)
    expect(r.body.data.invitacion_enviada).toBe(false)
    expect(r.body.message).toBeTruthy()
    expect((await mem.execute(`SELECT COUNT(*) AS n FROM users WHERE email = 'luis@ciebo.org'`)).rows[0].n).toBe(1)
  })
})
