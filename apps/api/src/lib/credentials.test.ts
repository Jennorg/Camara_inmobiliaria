import { createClient } from '@libsql/client'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const mem = createClient({ url: ':memory:' })
vi.mock('./db.js', () => ({ db: mem }))
const enviar = vi.fn(async () => undefined)
vi.mock('./email.js', () => ({ enviarCorreoAccesoCibirAprobado: enviar, enviarCorreoOnboardingMasivo: vi.fn() }))

const { concederAccesoAlAprobarCibir } = await import('./credentials.js')

const afiliado = async (email: string) => {
  const p = await mem.execute({ sql: `INSERT INTO personas (nombres, apellidos, email) VALUES ('Ana', 'Pérez', ?) RETURNING id`, args: [email] })
  const a = await mem.execute({ sql: `INSERT INTO afiliados (id_persona, estatus) VALUES (?, '6_INSCRIPCION') RETURNING id_afiliado`, args: [p.rows[0].id] })
  return Number(a.rows[0].id_afiliado)
}
const usuario = (email: string) => mem.execute({ sql: `INSERT INTO users (email, password_hash, roles) VALUES (?, 'x', '["afiliado"]')`, args: [email] })
const token = (email: string, usado: number) => mem.execute({ sql: `INSERT INTO tokens_accion (token, tipo, email, usado, fecha_expiracion) VALUES (?, 'reset_password', ?, ?, '2999-01-01')`, args: [`t-${Math.random()}`, email, usado] })

beforeAll(async () => {
  await mem.batch([
    `CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT UNIQUE, password_hash TEXT, roles TEXT)`,
    `CREATE TABLE personas (id INTEGER PRIMARY KEY, nombres TEXT, apellidos TEXT, email TEXT)`,
    `CREATE TABLE empresas (id_empresa INTEGER PRIMARY KEY, razon_social TEXT, email TEXT)`,
    `CREATE TABLE afiliados (id_afiliado INTEGER PRIMARY KEY, id_persona INTEGER, id_empresa INTEGER, id_user INTEGER, estatus TEXT)`,
    `CREATE TABLE tokens_accion (token TEXT PRIMARY KEY, tipo TEXT, email TEXT, usado INTEGER, fecha_expiracion TEXT)`,
  ])
})
beforeEach(() => enviar.mockClear())

describe('concederAccesoAlAprobarCibir', () => {
  it('sin usuario: lo crea y envía el enlace', async () => {
    await concederAccesoAlAprobarCibir(await afiliado('nuevo@x.test'))
    expect(enviar).toHaveBeenCalledTimes(1)
    expect((await mem.execute(`SELECT 1 FROM users WHERE email = 'nuevo@x.test'`)).rows).toHaveLength(1)
  })

  it('usuario que nunca estableció contraseña (cuenta creada antes, enlace ya desactivado): envía el enlace', async () => {
    await usuario('viejo@x.test')
    await concederAccesoAlAprobarCibir(await afiliado('viejo@x.test'))
    expect(enviar).toHaveBeenCalledTimes(1)
  })

  it('usuario que ya estableció su contraseña (enlace usado): no envía nada', async () => {
    await usuario('listo@x.test')
    await token('listo@x.test', 1)
    await concederAccesoAlAprobarCibir(await afiliado('listo@x.test'))
    expect(enviar).not.toHaveBeenCalled()
  })
})
