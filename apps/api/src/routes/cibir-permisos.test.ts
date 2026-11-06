import { createClient } from '@libsql/client'
import express from 'express'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { ACCIONES, sembrarRoles, type Accion } from '../config/secciones.js'

const mem = createClient({ url: ':memory:' })
vi.mock('../lib/db.js', () => ({ db: mem }))

const ok = (_req: any, res: any) => res.json({ success: true })
const mockear = (nombres: string[]) => Object.fromEntries(nombres.map(n => [n, ok]))
vi.mock('../controllers/cibir.controller.js', () => mockear([
  'listEdiciones', 'createEdicion', 'getEdicion', 'updateEdicion', 'cambiarEstadoEdicion', 'deleteEdicion', 'listInscritos',
  'aprobarRechazarInscrito', 'asignarAfiliados', 'cancelarInscrito', 'listPendientesSinEdicion',
]))

const { env } = await import('../config/env.js')
const { cibirRoutes } = await import('./cibir.routes.js')

const app = express()
app.use(express.json())
app.use('/api/admin/cibir', cibirRoutes)

const token = (roles: string[]) => `Bearer ${jwt.sign({ id: 9, email: 'u@x', roles, rol: roles[0] }, env.JWT_SECRET)}`
const STAFF = ['asistente', 'administrativo', 'personal_admin', 'secretario', 'secretaria', 'personal', 'personal_administrativo']

const llamar = (m: string, url: string, auth?: string) => {
  const r = (request(app) as any)[m](url).send({})
  return auth ? r.set('Authorization', auth) : r
}

const C = '/api/admin/cibir'
// CIBIR (ediciones, inscritos, pendientes) se administra desde Formación. Los DELETE los podía hacer todo el staff
// (el router solo pedía staff) y «eliminar» de formación es solo admin: se exigen como «editar» (son bajas lógicas).
const RUTAS: [string, string, Accion][] = [
  ['get', `${C}/ediciones`, 'ver'],
  ['post', `${C}/ediciones`, 'crear'],
  ['get', `${C}/ediciones/1`, 'ver'],
  ['patch', `${C}/ediciones/1`, 'editar'],
  ['patch', `${C}/ediciones/1/estado`, 'editar'],
  ['delete', `${C}/ediciones/1`, 'editar'],
  ['get', `${C}/ediciones/1/inscritos`, 'ver'],
  ['post', `${C}/ediciones/1/asignar`, 'editar'], // asigna afiliados a una edición existente
  ['patch', `${C}/ediciones/1/inscritos/5`, 'editar'],
  ['delete', `${C}/ediciones/1/inscritos/5`, 'editar'],
  ['get', `${C}/pendientes`, 'ver'],
]

beforeAll(async () => {
  await mem.batch([
    `CREATE TABLE roles (id INTEGER PRIMARY KEY, clave TEXT UNIQUE NOT NULL, nombre TEXT NOT NULL, es_sistema INTEGER NOT NULL DEFAULT 0, activo INTEGER NOT NULL DEFAULT 1, creado_en TEXT)`,
    `CREATE TABLE rol_permisos (id_rol INTEGER NOT NULL, seccion TEXT NOT NULL, ver INTEGER NOT NULL DEFAULT 0, crear INTEGER NOT NULL DEFAULT 0, editar INTEGER NOT NULL DEFAULT 0, eliminar INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (id_rol, seccion))`,
  ], 'write')
  await sembrarRoles(mem, { staffHistorico: true })
  for (const a of ACCIONES) {
    for (const [clave, casillas] of [[`solo_${a}_formacion`, [a]], [`sin_${a}_formacion`, ACCIONES.filter(x => x !== a)]] as const) {
      await mem.execute({ sql: `INSERT INTO roles (clave, nombre) VALUES (?, ?)`, args: [clave, clave] })
      await mem.execute({
        sql: `INSERT INTO rol_permisos (id_rol, seccion, ver, crear, editar, eliminar) SELECT id, 'formacion', ?, ?, ?, ? FROM roles WHERE clave = ?`,
        args: [...ACCIONES.map(x => ((casillas as readonly string[]).includes(x) ? 1 : 0)), clave],
      })
    }
  }
})

describe('cibir: permisos por sección (formacion)', () => {
  it.each(RUTAS)('%s %s exige formacion/%s', async (m, url, accion) => {
    expect((await llamar(m, url)).status).toBe(401)
    expect((await llamar(m, url, token([`solo_${accion}_formacion`]))).status).toBe(200)
    expect((await llamar(m, url, token([`sin_${accion}_formacion`]))).status).toBe(403)
    expect((await llamar(m, url, token(['super_admin']))).status).toBe(200)
    expect((await llamar(m, url, token(['admin']))).status).toBe(200)
    expect((await llamar(m, url, token(['afiliado']))).status).toBe(403)
    expect((await llamar(m, url, token(['estudiante']))).status).toBe(403)
  })

  it('todo el staff (el router pedía staff, y la jerarquía admite a todos) conserva todas las rutas', async () => {
    for (const [m, url] of RUTAS) {
      for (const rol of STAFF) expect((await llamar(m, url, token([rol]))).status, `${rol} ${m} ${url}`).toBe(200)
    }
  })
})
