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
vi.mock('../controllers/asambleas.controller.js', () => mockear([
  'listar', 'obtener', 'crear', 'actualizar', 'eliminar', 'registrarAsistencia', 'quitarAsistencia', 'buscarAfiliados', 'miembros',
]))

const { env } = await import('../config/env.js')
const { default: asambleasRoutes } = await import('./asambleas.routes.js')

const app = express()
app.use(express.json())
app.use('/api/asambleas', asambleasRoutes)

const token = (roles: string[]) => `Bearer ${jwt.sign({ id: 9, email: 'u@x', roles, rol: roles[0] }, env.JWT_SECRET)}`

// Ruta migrada → [sección, acción]. Registrar y quitar asistencia modifican una asamblea existente: «editar».
const RUTAS: [string, string, string, Accion][] = [
  ['get', '/api/asambleas', 'asambleas', 'ver'],
  ['get', '/api/asambleas/afiliados', 'asambleas', 'ver'],
  ['get', '/api/asambleas/miembros', 'asambleas', 'ver'],
  ['get', '/api/asambleas/1', 'asambleas', 'ver'],
  ['post', '/api/asambleas', 'asambleas', 'crear'],
  ['put', '/api/asambleas/1', 'asambleas', 'editar'],
  ['delete', '/api/asambleas/1', 'asambleas', 'eliminar'],
  ['post', '/api/asambleas/1/asistencia', 'asambleas', 'editar'],
  ['delete', '/api/asambleas/1/asistencia/5', 'asambleas', 'editar'],
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
  await sembrarRoles(mem)
  for (const a of ACCIONES) {
    for (const [clave, casillas] of [[`solo_${a}_asambleas`, [a]], [`sin_${a}_asambleas`, ACCIONES.filter(x => x !== a)]] as const) {
      await mem.execute({ sql: `INSERT INTO roles (clave, nombre) VALUES (?, ?)`, args: [clave, clave] })
      await mem.execute({
        sql: `INSERT INTO rol_permisos (id_rol, seccion, ver, crear, editar, eliminar) SELECT id, 'asambleas', ?, ?, ?, ? FROM roles WHERE clave = ?`,
        args: [...ACCIONES.map(x => ((casillas as readonly string[]).includes(x) ? 1 : 0)), clave],
      })
    }
  }
})

describe('asambleas: permisos por sección', () => {
  it.each(RUTAS)('%s %s exige %s/%s', async (m, url, seccion, accion) => {
    expect((await llamar(m, url)).status).toBe(401)
    expect((await llamar(m, url, token([`solo_${accion}_${seccion}`]))).status).toBe(200)
    expect((await llamar(m, url, token([`sin_${accion}_${seccion}`]))).status).toBe(403)
    expect((await llamar(m, url, token(['super_admin']))).status).toBe(200)
    expect((await llamar(m, url, token(['admin']))).status).toBe(200)
    expect((await llamar(m, url, token(['afiliado']))).status).toBe(403)
    expect((await llamar(m, url, token(['estudiante']))).status).toBe(403)
  })

  it('todo el staff (la jerarquía de requireRole lo admitía) conserva todas las rutas', async () => {
    for (const [m, url] of RUTAS) {
      for (const rol of STAFF) expect((await llamar(m, url, token([rol]))).status, `${rol} ${m} ${url}`).toBe(200)
    }
  })
})
