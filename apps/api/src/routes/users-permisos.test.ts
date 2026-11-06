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
vi.mock('../controllers/users.controller.js', () => mockear([
  'getUsers', 'createUser', 'updateUser', 'resetUserPassword', 'sendUserInvitation', 'deleteUser', 'impersonateUser',
]))

const { env } = await import('../config/env.js')
const { usersRoutes } = await import('./users.routes.js')

const app = express()
app.use(express.json())
app.use('/api/users', usersRoutes)

const token = (roles: string[]) => `Bearer ${jwt.sign({ id: 9, email: 'u@x', roles, rol: roles[0] }, env.JWT_SECRET)}`

// Ruta migrada → [sección, acción]. Reset e invitación cambian a un usuario existente: «editar».
const RUTAS: [string, string, string, Accion][] = [
  ['get', '/api/users', 'users', 'ver'],
  ['post', '/api/users', 'users', 'crear'],
  ['patch', '/api/users/1', 'users', 'editar'],
  ['post', '/api/users/1/reset', 'users', 'editar'],
  ['post', '/api/users/1/invite', 'users', 'editar'],
  ['delete', '/api/users/1', 'users', 'eliminar'],
]

const STAFF = ['asistente', 'administrativo', 'personal_admin', 'secretario', 'secretaria', 'personal', 'personal_administrativo']

const llamar = (m: string, url: string, auth?: string) => {
  const r = (request(app) as any)[m](url).send({})
  return auth ? r.set('Authorization', auth) : r
}

beforeAll(async () => {
  await mem.batch([
    `CREATE TABLE roles (id INTEGER PRIMARY KEY, clave TEXT UNIQUE NOT NULL, nombre TEXT NOT NULL, es_sistema INTEGER NOT NULL DEFAULT 0, activo INTEGER NOT NULL DEFAULT 1, creado_en TEXT)`,
    `CREATE TABLE rol_permisos (id_rol INTEGER NOT NULL, seccion TEXT NOT NULL, ver INTEGER NOT NULL DEFAULT 0, crear INTEGER NOT NULL DEFAULT 0, editar INTEGER NOT NULL DEFAULT 0, eliminar INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (id_rol, seccion))`,
  ], 'write')
  await sembrarRoles(mem, { staffHistorico: true })
  for (const a of ACCIONES) {
    for (const [clave, casillas] of [[`solo_${a}_users`, [a]], [`sin_${a}_users`, ACCIONES.filter(x => x !== a)]] as const) {
      await mem.execute({ sql: `INSERT INTO roles (clave, nombre) VALUES (?, ?)`, args: [clave, clave] })
      await mem.execute({
        sql: `INSERT INTO rol_permisos (id_rol, seccion, ver, crear, editar, eliminar) SELECT id, 'users', ?, ?, ?, ? FROM roles WHERE clave = ?`,
        args: [...ACCIONES.map(x => ((casillas as readonly string[]).includes(x) ? 1 : 0)), clave],
      })
    }
  }
})

describe('users: permisos por sección', () => {
  it.each(RUTAS)('%s %s exige %s/%s', async (m, url, seccion, accion) => {
    expect((await llamar(m, url)).status).toBe(401)
    expect((await llamar(m, url, token([`solo_${accion}_${seccion}`]))).status).toBe(200)
    expect((await llamar(m, url, token([`sin_${accion}_${seccion}`]))).status).toBe(403)
    expect((await llamar(m, url, token(['super_admin']))).status).toBe(200)
    expect((await llamar(m, url, token(['admin']))).status).toBe(200)
    expect((await llamar(m, url, token(['afiliado']))).status).toBe(403)
    expect((await llamar(m, url, token(['estudiante']))).status).toBe(403)
  })

  it('todo el staff conserva ver/crear/editar y sigue sin eliminar (antes solo admin)', async () => {
    for (const [m, url, , accion] of RUTAS) {
      for (const rol of STAFF) expect((await llamar(m, url, token([rol]))).status, `${rol} ${m} ${url}`).toBe(accion === 'eliminar' ? 403 : 200)
    }
  })

  it('suplantar sigue restringido a admin y super_admin, sin importar la matriz', async () => {
    const url = '/api/users/1/impersonate'
    expect((await llamar('post', url, token(['admin']))).status).toBe(200)
    expect((await llamar('post', url, token(['super_admin']))).status).toBe(200)
    for (const rol of [...STAFF, 'solo_editar_users', 'sin_ver_users', 'afiliado']) {
      expect((await llamar('post', url, token([rol]))).status, rol).toBe(403)
    }
  })
})
