import { createClient } from '@libsql/client'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { ACCIONES, sembrarRoles } from '../config/secciones.js'

const mem = createClient({ url: ':memory:' })
vi.mock('../lib/db.js', () => ({ db: mem }))

const { invalidarCachePermisos } = await import('../services/permisos.service.js')
const { deleteUser, createUser, updateUser } = await import('./users.controller.js')

const res = () => {
  const r: any = { statusCode: 200 }
  r.status = (c: number) => { r.statusCode = c; return r }
  r.json = (b: any) => { r.body = b; return r }
  return r
}
const llamar = async (fn: any, roles: string[], extra: any = {}) => {
  const r = res()
  await fn({ user: { id: 9, email: 'u@x', roles, rol: roles[0] }, params: { id: '77' }, body: {}, ...extra }, r)
  return r
}

beforeAll(async () => {
  await mem.batch([
    `CREATE TABLE roles (id INTEGER PRIMARY KEY, clave TEXT UNIQUE NOT NULL, nombre TEXT NOT NULL, es_sistema INTEGER NOT NULL DEFAULT 0, activo INTEGER NOT NULL DEFAULT 1, creado_en TEXT)`,
    `CREATE TABLE rol_permisos (id_rol INTEGER NOT NULL, seccion TEXT NOT NULL, ver INTEGER NOT NULL DEFAULT 0, crear INTEGER NOT NULL DEFAULT 0, editar INTEGER NOT NULL DEFAULT 0, eliminar INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (id_rol, seccion))`,
    `CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT, roles TEXT)`,
    `INSERT INTO users (id, email, roles) VALUES (77, 'a@x', '["afiliado"]'), (78, 'adm@x', '["admin"]')`,
    `INSERT INTO roles (clave, nombre) VALUES ('con_eliminar', 'e'), ('sin_eliminar', 's')`,
  ], 'write')
  await sembrarRoles(mem)
  await mem.execute(`INSERT INTO rol_permisos SELECT id, 'users', 1, 1, 1, 1 FROM roles WHERE clave='con_eliminar'`)
  await mem.execute(`INSERT INTO rol_permisos SELECT id, 'users', 1, 1, 1, 0 FROM roles WHERE clave='sin_eliminar'`)
  invalidarCachePermisos()
})

// Sin 404 de «no existe» se entiende que superó el control de rol (el usuario 77 existe y se borra).
describe('deleteUser acepta eliminar por sección', () => {
  it('asistente sin eliminar sigue bloqueado (403)', async () => {
    expect((await llamar(deleteUser, ['asistente'])).statusCode).toBe(403)
  })
  it('asistente con eliminar concedido en la matriz pasa; un rol personalizado con eliminar también', async () => {
    await mem.execute(`UPDATE rol_permisos SET eliminar = 1 WHERE seccion = 'users' AND id_rol = (SELECT id FROM roles WHERE clave='asistente')`)
    invalidarCachePermisos()
    expect((await llamar(deleteUser, ['asistente', ])).statusCode).toBe(200)
    await mem.execute(`INSERT INTO users (id, email, roles) VALUES (77, 'a@x', '["afiliado"]')`)
    expect((await llamar(deleteUser, ['con_eliminar'])).statusCode).toBe(200)
    await mem.execute(`UPDATE rol_permisos SET eliminar = 0 WHERE seccion = 'users' AND id_rol = (SELECT id FROM roles WHERE clave='asistente')`)
    invalidarCachePermisos()
  })
  it('un rol personalizado con eliminar nunca borra a un admin', async () => {
    expect((await llamar(deleteUser, ['con_eliminar'], { params: { id: '78' } })).statusCode).toBe(403)
  })
})

describe('un rol personalizado con crear/editar no escala privilegios', () => {
  it('createUser: no crea admin, super_admin ni personal', async () => {
    for (const rol of ['admin', 'super_admin', 'asistente', 'secretario']) {
      expect((await llamar(createUser, ['con_eliminar'], { body: { email: 'n@x', password: 'x', rol } })).statusCode, rol).toBe(403)
    }
  })
  it('updateUser: no edita administradores ni asigna roles de personal', async () => {
    expect((await llamar(updateUser, ['con_eliminar'], { params: { id: '78' }, body: { activo: 0 } })).statusCode).toBe(403)
    await mem.execute(`INSERT OR IGNORE INTO users (id, email, roles) VALUES (77, 'a@x', '["afiliado"]')`)
    expect((await llamar(updateUser, ['con_eliminar'], { body: { rol: 'asistente' } })).statusCode).toBe(403)
    expect((await llamar(updateUser, ['con_eliminar'], { body: { rol: 'admin' } })).statusCode).toBe(403)
  })
})
