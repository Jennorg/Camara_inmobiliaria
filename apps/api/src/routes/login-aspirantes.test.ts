import { createClient } from '@libsql/client'
import bcrypt from 'bcryptjs'
import express from 'express'
import request from 'supertest'
import { beforeAll, describe, expect, it, vi } from 'vitest'

const mem = createClient({ url: ':memory:' })
vi.mock('../lib/db.js', () => ({ db: mem }))
vi.mock('../services/permisos.service.js', async (orig) => ({ ...(await orig<object>()), permisosDeRoles: async () => ({}) }))
// enrichUserPayload consulta tablas de perfil que esta prueba no necesita
vi.mock('../middlewares/auth.middleware.js', async (orig) => ({ ...(await orig<object>()), enrichUserPayload: async (u: object) => u }))

const { login } = await import('../controllers/auth.controller.js')
const app = express()
app.use(express.json())
app.post('/login', login)

const PASS = 'Clave-123'
const crear = async (email: string, roles: string[], estatus?: string) => {
  const u = await mem.execute({
    sql: `INSERT INTO users (email, password_hash, roles) VALUES (?, ?, ?) RETURNING id`,
    args: [email, await bcrypt.hash(PASS, 4), JSON.stringify(roles)],
  })
  if (!estatus) return
  const p = await mem.execute({ sql: `INSERT INTO personas (nombres, apellidos, email) VALUES ('A', 'B', ?) RETURNING id`, args: [email] })
  await mem.execute({ sql: `INSERT INTO afiliados (id_persona, id_user, estatus) VALUES (?, ?, ?)`, args: [p.rows[0].id, u.rows[0].id, estatus] })
}
const entrar = (email: string) => request(app).post('/login').send({ email, password: PASS })

beforeAll(async () => {
  await mem.batch([
    `CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT, password_hash TEXT, roles TEXT, activo INTEGER DEFAULT 1)`,
    `CREATE TABLE personas (id INTEGER PRIMARY KEY, nombres TEXT, apellidos TEXT, email TEXT, eliminado_en TEXT)`,
    `CREATE TABLE empresas (id_empresa INTEGER PRIMARY KEY, email TEXT)`,
    `CREATE TABLE afiliados (id_afiliado INTEGER PRIMARY KEY, id_persona INTEGER, id_empresa INTEGER, id_user INTEGER, estatus TEXT, eliminado_en TEXT)`,
    `CREATE TABLE user_refresh_tokens (id INTEGER PRIMARY KEY, id_user INTEGER, token_hash TEXT, expira_en TEXT)`,
  ])
  await crear('cibir@x.test', ['estudiante', 'afiliado'], '5_CIBIR')
  await crear('expediente@x.test', ['estudiante'], '2_EXPEDIENTE')
  await crear('aprobado@x.test', ['estudiante', 'afiliado'], '6_INSCRIPCION')
  await crear('oficial@x.test', ['afiliado'], 'Afiliado')
  await crear('curso@x.test', ['estudiante'])
  await crear('staff@x.test', ['admin'], '5_CIBIR')
})

describe('login de aspirantes', () => {
  it.each(['cibir@x.test', 'expediente@x.test'])('%s: sin acceso hasta que la Junta apruebe el CIBIR', async (email) => {
    const r = await entrar(email)
    expect(r.status).toBe(403)
    expect(r.body.code).toBe('CIBIR_PENDIENTE')
    expect(r.body.message).toMatch(/Junta Directiva apruebe tu CIBIR/)
    expect(r.body.token).toBeUndefined()
  })

  it.each(['aprobado@x.test', 'oficial@x.test', 'curso@x.test', 'staff@x.test'])('%s: sí entra', async (email) => {
    const r = await entrar(email)
    expect(r.status, JSON.stringify(r.body)).toBe(200)
    expect(r.body.token).toBeTruthy()
  })

  it('una contraseña incorrecta sigue siendo 401 (no revela el estado de la solicitud)', async () => {
    const r = await request(app).post('/login').send({ email: 'cibir@x.test', password: 'mala' })
    expect(r.status).toBe(401)
  })
})
