import { createClient } from '@libsql/client'
import express from 'express'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import { beforeAll, describe, expect, it, vi } from 'vitest'

const mem = createClient({ url: ':memory:' })
vi.mock('../lib/db.js', () => ({ db: mem }))
vi.mock('../lib/email.js', () => ({ enviarCorreoOnboardingMasivo: async () => {} }))

const { env } = await import('../config/env.js')
const { default: rolesRoutes } = await import('../routes/roles.routes.js')
const { isStaff, isAsistente, requireRole, puedeAccederAfiliado } = await import('../middlewares/auth.middleware.js')
const { invalidarCachePermisos } = await import('../services/permisos.service.js')

const app = express()
app.use(express.json())
app.use('/api/roles', rolesRoutes)
const SUPER = `Bearer ${jwt.sign({ id: 1, email: 'u1@x', roles: ['super_admin'], rol: 'super_admin' }, env.JWT_SECRET)}`
const crear = (nombre: string, permisos: any = {}) => request(app).post('/api/roles').set('Authorization', SUPER).send({ nombre, permisos })

beforeAll(async () => {
  await mem.batch([
    `CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL DEFAULT 'h', roles TEXT NOT NULL DEFAULT '["afiliado"]', activo INTEGER NOT NULL DEFAULT 1, creado_en TEXT, actualizado_en TEXT, eliminado_en TEXT, nombre TEXT)`,
    `CREATE TABLE roles (id INTEGER PRIMARY KEY, clave TEXT UNIQUE NOT NULL, nombre TEXT NOT NULL, es_sistema INTEGER NOT NULL DEFAULT 0, activo INTEGER NOT NULL DEFAULT 1, creado_en TEXT)`,
    `CREATE TABLE rol_permisos (id_rol INTEGER NOT NULL, seccion TEXT NOT NULL, ver INTEGER NOT NULL DEFAULT 0, crear INTEGER NOT NULL DEFAULT 0, editar INTEGER NOT NULL DEFAULT 0, eliminar INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (id_rol, seccion))`,
    `CREATE TABLE afiliados (id_afiliado INTEGER PRIMARY KEY, id_user INTEGER, eliminado_en TEXT)`,
    `INSERT INTO users (id, email) VALUES (1, 'u1@x')`,
    `INSERT INTO afiliados (id_afiliado, id_user) VALUES (50, 99)`,
  ], 'write')
})

describe('claves reservadas', () => {
  it('solo super_admin, admin, afiliado y estudiante (también por alias)', async () => {
    for (const nombre of ['Admin', 'súper admin', 'Super_Admin', 'AFILIADO', 'Estudiante']) {
      expect((await crear(nombre)).status, nombre).toBe(400)
    }
  })
  it('los nombres heredados ahora se pueden crear', async () => {
    for (const nombre of ['Asistente', 'Secretaria', 'Personal', 'Personal Admin']) {
      const r = await crear(nombre)
      expect(r.status, nombre).toBe(201)
    }
    expect((await crear('asistente')).status).toBe(409)
  })
})

describe('un rol llamado asistente no tiene poder implícito', () => {
  const u = (roles: string[]) => ({ id: 5, email: 'a@x', roles, rol: roles[0] } as any)
  it('isStaff/isAsistente solo reconocen a admin y super_admin', () => {
    for (const r of ['asistente', 'administrativo', 'secretaria', 'personal']) {
      expect(isAsistente(u([r]))).toBe(false)
      expect(isStaff(u([r]))).toBe(false)
    }
    expect(isStaff(u(['admin']))).toBe(true)
    expect(isStaff(u(['super_admin']))).toBe(true)
  })
  it('requireRole ya no admite por jerarquía de nombres', () => {
    const corre = (roles: string[], ...permitidos: any[]) => {
      let paso = false
      requireRole(...permitidos)({ user: u(roles) } as any, { status: () => ({ json: () => {} }) } as any, () => { paso = true })
      return paso
    }
    expect(corre(['asistente'], 'asistente')).toBe(true) // coincidencia exacta
    expect(corre(['secretaria'], 'asistente')).toBe(false)
    expect(corre(['admin'], 'asistente')).toBe(false)
    expect(corre(['super_admin'], 'admin')).toBe(true)
  })
  it('puedeAccederAfiliado: false sin filas de matriz, true con finanzas/afiliados ver', async () => {
    expect(await puedeAccederAfiliado(u(['asistente']), 50)).toBe(false)
    expect(await puedeAccederAfiliado(u(['admin']), 50)).toBe(true)
    const id = Number((await mem.execute(`SELECT id FROM roles WHERE clave='asistente'`)).rows[0].id)
    await mem.execute({ sql: `UPDATE rol_permisos SET ver = 1 WHERE id_rol = ? AND seccion = 'finanzas'`, args: [id] })
    invalidarCachePermisos()
    expect(await puedeAccederAfiliado(u(['asistente']), 50)).toBe(true)
    expect(await puedeAccederAfiliado(u(['secretaria']), 50)).toBe(false)
  })
})
