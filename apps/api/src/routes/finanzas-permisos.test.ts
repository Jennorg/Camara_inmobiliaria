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
vi.mock('../controllers/finanzas.controller.js', () => mockear([
  'getResumenFinanciero', 'getLibroVentas', 'getLibroCompras', 'crearMovimiento', 'actualizarMovimiento',
  'anularMovimiento', 'eliminarMovimiento', 'getTasasReferencias', 'sincronizarTasasEnVivo', 'actualizarTasaManual',
  'resetTasaManual', 'getHistorialTasas', 'getIngresosPorConcepto', 'getIngresosPorCohorte', 'getNombrePorRif',
  'getEgresosPorConcepto', 'getCuentasPorCobrar', 'exportarXlsx',
]))
vi.mock('../controllers/pagos.controller.js', () => mockear([
  'getCuentas', 'getArancelesController', 'getArancelFormalizacion', 'reportarPago', 'getPagosByAfiliado', 'getRecibo',
  'adminListPagos', 'adminCobroTaquilla', 'adminVerificarPago', 'adminRechazarPago', 'adminListCuentas',
  'adminCreateCuenta', 'adminUpdateCuenta', 'adminDeleteCuenta', 'adminUpdateArancel', 'adminCursosPorCobrar',
  'adminBuscarPagadores', 'getModalidadPagos', 'adminSetModalidadPagos', 'getCobrosAfiliacion', 'adminAnularPago',
  'adminMarcarMesSolvencia',
]))
vi.mock('../controllers/solvencia.controller.js', () => mockear([
  'getSolvenciaAfiliado', 'adminResumenSolvencia', 'adminSetInicioSolvencia', 'adminEnviarRecordatorio', 'emitirConstancia',
]))

const { env } = await import('../config/env.js')
const { default: finanzasRoutes } = await import('./finanzas.routes.js')
const { default: pagosRoutes } = await import('./pagos.routes.js')

const app = express()
app.use(express.json())
app.use('/api/finanzas', finanzasRoutes)
app.use('/api/pagos', pagosRoutes)

const token = (roles: string[]) => `Bearer ${jwt.sign({ id: 9, email: 'u@x', roles, rol: roles[0] }, env.JWT_SECRET)}`

// Ruta migrada → acción que exige en la sección «finanzas».
const RUTAS: [string, string, Accion][] = [
  ['get', '/api/finanzas/resumen', 'ver'],
  ['get', '/api/finanzas/libro-ventas', 'ver'],
  ['get', '/api/finanzas/libro-compras', 'ver'],
  ['post', '/api/finanzas/movimientos', 'crear'],
  ['put', '/api/finanzas/movimientos/1', 'editar'],
  ['patch', '/api/finanzas/movimientos/1/anular', 'editar'],
  ['delete', '/api/finanzas/movimientos/1', 'eliminar'],
  ['get', '/api/finanzas/ingresos-por-concepto', 'ver'],
  ['get', '/api/finanzas/ingresos-por-cohorte', 'ver'],
  ['get', '/api/finanzas/nombre-por-rif', 'ver'],
  ['get', '/api/finanzas/egresos-por-concepto', 'ver'],
  ['get', '/api/finanzas/cuentas-por-cobrar', 'ver'],
  ['get', '/api/finanzas/export/libro-ventas.xlsx', 'ver'],
  ['get', '/api/finanzas/referencias', 'ver'],
  ['post', '/api/finanzas/referencias/sync', 'editar'],
  ['put', '/api/finanzas/referencias/USD_BCV', 'editar'],
  ['delete', '/api/finanzas/referencias/USD_BCV/manual', 'editar'],
  ['get', '/api/finanzas/referencias/historial', 'ver'],
  ['get', '/api/pagos/admin', 'ver'],
  ['get', '/api/pagos/admin/solvencia', 'ver'],
  ['put', '/api/pagos/admin/solvencia/config', 'editar'],
  ['post', '/api/pagos/admin/solvencia/recordatorio', 'editar'],
  ['get', '/api/pagos/admin/cursos-por-cobrar', 'ver'],
  ['put', '/api/pagos/admin/modalidad', 'editar'],
  ['get', '/api/pagos/admin/pagadores', 'ver'],
  ['post', '/api/pagos/admin/cobro-taquilla', 'crear'],
  ['patch', '/api/pagos/admin/1/anular', 'editar'],
  ['put', '/api/pagos/admin/solvencia/afiliado/1/mes', 'editar'],
  ['patch', '/api/pagos/admin/1/verificar', 'editar'],
  ['patch', '/api/pagos/admin/1/rechazar', 'editar'],
  ['get', '/api/pagos/admin/cuentas', 'ver'],
  ['post', '/api/pagos/admin/cuentas', 'crear'],
  ['put', '/api/pagos/admin/cuentas/1', 'editar'],
  ['delete', '/api/pagos/admin/cuentas/1', 'eliminar'],
  ['put', '/api/pagos/admin/aranceles/INSCRIPCION', 'editar'],
]

// Todos los roles que el viejo requireRole(admin, asistente, …) dejaba pasar (jerarquía de staff incluida).
const LEGADO = ['admin', 'asistente', 'administrativo', 'personal_admin', 'secretario', 'secretaria', 'personal', 'personal_administrativo']

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
  // Por cada acción: un rol con solo esa casilla y otro con las otras tres.
  for (const a of ACCIONES) {
    for (const [clave, casillas] of [[`solo_${a}`, [a]], [`sin_${a}`, ACCIONES.filter(x => x !== a)]] as const) {
      await mem.execute({ sql: `INSERT INTO roles (clave, nombre) VALUES (?, ?)`, args: [clave, clave] })
      await mem.execute({
        sql: `INSERT INTO rol_permisos (id_rol, seccion, ver, crear, editar, eliminar) SELECT id, 'finanzas', ?, ?, ?, ? FROM roles WHERE clave = ?`,
        args: [...ACCIONES.map(x => ((casillas as readonly string[]).includes(x) ? 1 : 0)), clave],
      })
    }
  }
})

describe('finanzas y pagos admin: permisos por sección', () => {
  it.each(RUTAS)('%s %s exige finanzas/%s', async (m, url, accion) => {
    expect((await llamar(m, url)).status).toBe(401)
    expect((await llamar(m, url, token([`solo_${accion}`]))).status).toBe(200)
    expect((await llamar(m, url, token([`sin_${accion}`]))).status).toBe(403)
    expect((await llamar(m, url, token(['super_admin']))).status).toBe(200)
    expect((await llamar(m, url, token(['afiliado']))).status).toBe(403)
    expect((await llamar(m, url, token(['estudiante']))).status).toBe(403)
    for (const rol of LEGADO) expect((await llamar(m, url, token([rol]))).status, rol).toBe(200)
  })

  it('las rutas de autoservicio del afiliado no cambian', async () => {
    expect((await llamar('get', '/api/pagos/cuentas')).status).toBe(200)
    expect((await llamar('get', '/api/pagos/aranceles')).status).toBe(200)
    expect((await llamar('get', '/api/pagos/modalidad')).status).toBe(200)
    expect((await llamar('post', '/api/pagos/reportar')).status).toBe(401)
    expect((await llamar('post', '/api/pagos/reportar', token(['afiliado']))).status).toBe(200)
    expect((await llamar('get', '/api/pagos/afiliado/1', token(['afiliado']))).status).toBe(200)
  })
})
