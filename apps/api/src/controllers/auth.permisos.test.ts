import { createClient } from '@libsql/client'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { sembrarRoles } from '../config/secciones.js'

const mem = createClient({ url: ':memory:' })
vi.mock('../lib/db.js', () => ({ db: mem }))

const { impersonateUser } = await import('./users.controller.js')
const jwt = (await import('jsonwebtoken')).default
const { getMe } = await import('./auth.controller.js')
const { rolPrimario, permisosDeRoles } = await import('../services/permisos.service.js')

beforeAll(async () => {
  // DDL copiado de config/initdb.ts
  await mem.batch([
    `CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY, clave TEXT UNIQUE NOT NULL, nombre TEXT NOT NULL,
    es_sistema INTEGER NOT NULL DEFAULT 0, activo INTEGER NOT NULL DEFAULT 1,
    creado_en TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  )`,
    `CREATE TABLE IF NOT EXISTS rol_permisos (
    id_rol INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE, seccion TEXT NOT NULL,
    ver INTEGER NOT NULL DEFAULT 0, crear INTEGER NOT NULL DEFAULT 0,
    editar INTEGER NOT NULL DEFAULT 0, eliminar INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (id_rol, seccion)
  )`,
  ], 'write')
  await mem.execute(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, email TEXT, roles TEXT, activo INTEGER DEFAULT 1)`)
  await mem.execute(`INSERT INTO users (id, email, roles) VALUES (7, 'c@x.y', '["lector"]')`)
  await sembrarRoles(mem)
  await mem.batch([
    `INSERT INTO roles (clave, nombre) VALUES ('lector', 'Lector'), ('sin_ver', 'Sin ver')`,
    `INSERT INTO rol_permisos (id_rol, seccion, ver) SELECT id, 'noticias', 1 FROM roles WHERE clave = 'lector'`,
    `INSERT INTO rol_permisos (id_rol, seccion, ver, crear) SELECT id, 'noticias', 0, 1 FROM roles WHERE clave = 'sin_ver'`,
  ], 'write')
})

const llamarGetMe = async (user: any) => {
  let body: any
  const req: any = { user, headers: { cookie: 'refresh_token=x' } }
  const res: any = { status: () => res, json: (b: any) => { body = b }, cookie: () => {} }
  await getMe(req, res)
  return body
}

describe('getMe', () => {
  it('getMe_incluye_permisos_del_usuario', async () => {
    const body = await llamarGetMe({ id: 1, email: 'a@b.c', roles: ['lector'], rol: 'estudiante' })
    expect(body.user.permisos.noticias).toEqual({ ver: true, crear: false, editar: false, eliminar: false })
  })

  it('rol_personalizado_recibe_rol_primario_personal', async () => {
    const body = await llamarGetMe({ id: 1, email: 'a@b.c', roles: ['lector'], rol: 'estudiante' })
    expect(body.user.rol).toBe('personal')
    expect(body.user.roles).toEqual(['lector'])
  })
})

describe('rolPrimario', () => {
  const p = (r: string[]) => permisosDeRoles(r)
  it.each([
    [['super_admin', 'admin'], 'super_admin'],
    [['admin', 'afiliado'], 'admin'],
    [['asistente'], 'asistente'],
    [['administrativo'], 'asistente'],
    [['afiliado', 'lector'], 'afiliado'],
    [['estudiante'], 'estudiante'],
  ])('rol_base_%j_conserva_%s', async (roles, esperado) => {
    expect(rolPrimario(roles, await p(roles))).toBe(esperado)
  })

  it('rol_personalizado_con_ver_es_personal', async () => {
    expect(rolPrimario(['lector'], await p(['lector']))).toBe('personal')
  })

  it('desconocido_sin_ver_usa_el_fallback', async () => {
    expect(rolPrimario(['sin_ver'], await p(['sin_ver']))).toBe('estudiante')
    expect(rolPrimario(['fantasma'], await p(['fantasma']), 'afiliado')).toBe('afiliado')
  })
})

it('estudiante_con_fallback_afiliado_conserva_el_comportamiento_de_getUsers', async () => {
  expect(rolPrimario(['estudiante', 'lector'], await permisosDeRoles(['estudiante', 'lector']), 'afiliado')).toBe('afiliado')
})

it('impersonar_no_mete_permisos_en_el_jwt_pero_si_en_la_respuesta', async () => {
  let body: any
  const req: any = { user: { id: 1, email: 'a@b.c', roles: ['admin'], rol: 'admin' }, params: { id: '7' } }
  const res: any = { status: () => res, json: (b: any) => { body = b } }
  await impersonateUser(req, res)
  const decoded: any = jwt.verify(body.data.token, process.env.JWT_SECRET!)
  expect(decoded.permisos).toBeUndefined()
  expect(decoded.rol).toBe('personal')
  expect(decoded.roles).toEqual(['lector'])
  expect(body.data.user.permisos.noticias.ver).toBe(true)
})
