import { createClient } from '@libsql/client'
import express from 'express'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const principal = createClient({ url: ':memory:' })
const respaldos = createClient({ url: ':memory:' })
vi.mock('../lib/db.js', () => ({ db: principal }))

const { crearHistorial } = await import('../lib/respaldo-historial.js')
vi.mock('../lib/respaldo-historial.js', async (orig) => ({ ...(await orig<object>()), historial: (await orig<{ crearHistorial: (c: unknown) => unknown }>()).crearHistorial(respaldos) }))

const { env } = await import('../config/env.js')
const { leerRespaldo } = await import('../lib/respaldo.js')
const { default: respaldosRoutes } = await import('./respaldos.routes.js')
void crearHistorial

const app = express()
app.use(express.json())
app.use('/api/respaldos', respaldosRoutes)

const token = (roles: string[], extra: object = {}) => `Bearer ${jwt.sign({ id: 1, email: 'sa@x.test', roles, rol: roles[0], ...extra }, env.JWT_SECRET)}`
const SUPER = token(['super_admin'])
const binario = (r: request.Test) => r.buffer(true).parse((res, cb) => { const c: Buffer[] = []; res.on('data', d => c.push(d)); res.on('end', () => cb(null, Buffer.concat(c))) })
const datos = async () => (await principal.execute('SELECT id, nombre FROM socios ORDER BY id')).rows.map(r => ({ ...r }))

beforeAll(async () => {
  await principal.execute('CREATE TABLE socios (id INTEGER PRIMARY KEY, nombre TEXT)')
})
beforeEach(async () => {
  await principal.batch(['DELETE FROM socios', `INSERT INTO socios VALUES (1, 'Ana'), (2, 'Luis')`], 'write')
})

describe('acceso: solo el súper administrador', () => {
  const rutas: [string, string][] = [['get', '/api/respaldos'], ['post', '/api/respaldos/generar'], ['post', '/api/respaldos/validar'], ['post', '/api/respaldos/restaurar'], ['get', '/api/respaldos/1/descargar'], ['post', '/api/respaldos/1/restaurar'], ['delete', '/api/respaldos/1']]
  it.each(rutas)('%s %s sin sesión: 401', async (m, url) => { expect((await (request(app) as any)[m](url)).status).toBe(401) })
  it.each(['admin', 'asistente', 'afiliado'])('rol %s: 403 en todas las rutas', async (rol) => {
    for (const [m, url] of rutas) expect((await (request(app) as any)[m](url).set('Authorization', token([rol]))).status, `${m} ${url}`).toBe(403)
  })
  it('una sesión suplantada de súper administrador también recibe 403', async () => {
    expect((await request(app).get('/api/respaldos').set('Authorization', token(['super_admin'], { impersonatedBy: 5 }))).status).toBe(403)
  })
})

describe('flujo', () => {
  it('genera (entrega el archivo y lo guarda), lista y restaura con respaldo previo', async () => {
    const gen = await binario(request(app).post('/api/respaldos/generar').set('Authorization', SUPER))
    expect(gen.status).toBe(200)
    expect(gen.headers['content-disposition']).toMatch(/ciebo-respaldo-.*\.zip/)
    expect(gen.headers['content-type']).toMatch(/application\/zip/)
    const archivo = gen.body as Buffer
    expect(leerRespaldo(archivo).tablas.socios.filas).toHaveLength(2)

    const lista = await request(app).get('/api/respaldos').set('Authorization', SUPER)
    expect(lista.body.data.almacenamiento).toBe(true)
    expect(lista.body.data.respaldos).toHaveLength(1)

    await principal.batch([`DELETE FROM socios`, `INSERT INTO socios VALUES (9, 'Intruso')`], 'write')

    // sin la palabra de confirmación no se toca nada
    const sin = await request(app).post('/api/respaldos/restaurar').set('Authorization', SUPER).set('Content-Type', 'application/octet-stream').send(archivo)
    expect(sin.status).toBe(400)
    expect(await datos()).toEqual([{ id: 9, nombre: 'Intruso' }])

    const val = await request(app).post('/api/respaldos/validar').set('Authorization', SUPER).set('Content-Type', 'application/octet-stream').send(archivo)
    expect(val.body.data).toMatchObject({ tablas: 1, filas: 2 })

    const rest = await request(app).post('/api/respaldos/restaurar').set('Authorization', SUPER).set('X-Confirmacion', 'RESTAURAR').set('Content-Type', 'application/octet-stream').send(archivo)
    expect(rest.status, JSON.stringify(rest.body)).toBe(200)
    expect(await datos()).toEqual([{ id: 1, nombre: 'Ana' }, { id: 2, nombre: 'Luis' }])
    // el respaldo previo conserva el estado que se reemplazó (Intruso) y se guardó en el historial
    const previo = leerRespaldo(Buffer.from(rest.body.data.respaldo_previo.contenido, 'base64'))
    expect(previo.tablas.socios.filas).toEqual([[9, 'Intruso']])
    expect((await request(app).get('/api/respaldos').set('Authorization', SUPER)).body.data.respaldos.map((r: any) => r.tipo)).toContain('previo_restauracion')
  })

  it('restaura desde el historial y rechaza archivos inválidos', async () => {
    const id = (await request(app).get('/api/respaldos').set('Authorization', SUPER)).body.data.respaldos.find((r: any) => r.tipo === 'manual').id
    await principal.execute('DELETE FROM socios')
    expect((await request(app).post(`/api/respaldos/${id}/restaurar`).set('Authorization', SUPER).send({ confirmacion: 'si' })).status).toBe(400)
    expect((await request(app).post(`/api/respaldos/${id}/restaurar`).set('Authorization', SUPER).send({ confirmacion: 'RESTAURAR' })).status).toBe(200)
    expect((await datos()).length).toBe(2)
    const mal = await request(app).post('/api/respaldos/validar').set('Authorization', SUPER).set('Content-Type', 'application/octet-stream').send(Buffer.from('no soy un respaldo'))
    expect(mal.status).toBe(400)
    expect((await request(app).delete(`/api/respaldos/${id}`).set('Authorization', SUPER)).status).toBe(200)
    expect((await request(app).get(`/api/respaldos/${id}/descargar`).set('Authorization', SUPER)).status).toBe(404)
  })
})
