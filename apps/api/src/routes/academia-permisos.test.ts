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
vi.mock('../controllers/academia.controller.js', () => mockear([
  'adminAsignarEstudianteACurso', 'adminAgendarEntrevista', 'adminFinalizarEntrevista', 'adminGetEstudiante', 'adminGetEstudianteDocumentos',
  'adminAgregarEstudianteDocumento', 'adminCrearInscripcionManual', 'adminQuitarEstudianteDocumento', 'adminListCursos', 'adminCreateCurso',
  'adminUpdateCurso', 'adminDeleteCurso', 'adminListEstudiantes', 'adminListPreinscripciones', 'adminRechazarPreinscripcion',
  'adminCompletarCursoEstudiante', 'adminAprobarModulo', 'adminReenviarConfirmacionCurso', 'adminEstadoCorreo', 'adminRemitirACibir',
  'adminCambiarEtapaInscripcion', 'adminBuscarReferenciaAfiliado', 'adminToggleCorredorStatus', 'adminDeleteInscripcion',
  'adminUpdateInscripcionDatos', 'adminGetModulosInscripcion', 'adminAprobarModuloInscripcion', 'adminRechazarModuloInscripcion',
  'adminAprobarTodosModulosInscripcion', 'adminListProfesores', 'adminListPersonasDisponibles', 'adminCreateProfesor', 'adminDeleteProfesor',
  'adminReenviarEnlaceExpediente',
]))
vi.mock('../controllers/agenda.controller.js', () => mockear(['adminEnviarEnlaceAgenda', 'adminGuardarDisponibilidad', 'adminLeerDisponibilidad']))
vi.mock('../controllers/cohortes.controller.js', () => mockear(['adminAsignarCohorte', 'adminCambiarEstadoCohorte', 'adminCrearCohorte', 'adminExportarCohorte', 'adminListCohortes']))

const { env } = await import('../config/env.js')
const { academiaRoutes } = await import('./academia.routes.js')

const app = express()
app.use(express.json())
app.use('/api/academia', academiaRoutes)

const token = (roles: string[]) => `Bearer ${jwt.sign({ id: 9, email: 'u@x', roles, rol: roles[0] }, env.JWT_SECRET)}`
const STAFF = ['asistente', 'administrativo', 'personal_admin', 'secretario', 'secretaria', 'personal', 'personal_administrativo']

const llamar = (m: string, url: string, auth?: string) => {
  const r = (request(app) as any)[m](url).send({})
  return auth ? r.set('Authorization', auth) : r
}

const A = '/api/academia'
// Ruta migrada → [método, ruta, sección, acción]. Mapa: cursos/inscripciones/módulos/profesores/cohortes → formacion;
// lista de preinscripciones y acciones del flujo (aprobar, rechazar, remitir, agenda, etapa) → preinscripciones; fichas y documentos → estudiantes.
const RUTAS: [string, string, string, Accion][] = [
  ['get', `${A}/cursos`, 'formacion', 'ver'],
  ['post', `${A}/cursos`, 'formacion', 'crear'],
  ['put', `${A}/cursos/1`, 'formacion', 'editar'],
  ['delete', `${A}/cursos/1`, 'formacion', 'eliminar'],
  ['post', `${A}/cursos/1/asignar`, 'formacion', 'crear'],
  ['post', `${A}/inscripciones/manual`, 'formacion', 'crear'],
  ['delete', `${A}/inscripciones/1`, 'formacion', 'eliminar'],
  ['put', `${A}/inscripciones/1/datos`, 'formacion', 'editar'],
  ['patch', `${A}/inscripciones/1/completar`, 'formacion', 'editar'],
  ['post', `${A}/inscripciones/1/reenviar-confirmacion`, 'formacion', 'editar'], // POST que reenvía un correo: «editar»
  ['patch', `${A}/inscripciones/1/toggle-corredor`, 'formacion', 'editar'],
  ['patch', `${A}/inscripciones/1/cohorte`, 'formacion', 'editar'],
  ['get', `${A}/correos/abc/estado`, 'formacion', 'ver'],
  ['get', `${A}/inscripciones/1/modulos`, 'formacion', 'ver'],
  ['patch', `${A}/inscripciones/1/modulos/Modulo1/aprobar`, 'formacion', 'editar'],
  ['patch', `${A}/inscripciones/1/modulos/Modulo1/rechazar`, 'formacion', 'editar'],
  ['patch', `${A}/inscripciones/1/modulos/aprobar-todos`, 'formacion', 'editar'],
  ['get', `${A}/profesores`, 'formacion', 'ver'],
  ['post', `${A}/profesores`, 'formacion', 'crear'],
  ['delete', `${A}/profesores/1`, 'formacion', 'eliminar'],
  ['get', `${A}/personas-disponibles`, 'formacion', 'ver'],
  ['get', `${A}/cohortes`, 'formacion', 'ver'],
  ['post', `${A}/cohortes`, 'formacion', 'crear'],
  ['patch', `${A}/cohortes/1/estado`, 'formacion', 'editar'],
  ['get', `${A}/cohortes/1/inscritos.xlsx`, 'formacion', 'ver'],
  ['get', `${A}/preinscripciones`, 'preinscripciones', 'ver'],
  ['get', `${A}/afiliados/referencia`, 'preinscripciones', 'ver'],
  ['get', `${A}/agenda/disponibilidad`, 'preinscripciones', 'ver'],
  ['put', `${A}/agenda/disponibilidad`, 'preinscripciones', 'editar'],
  ['post', `${A}/inscripciones/1/enlace-agenda`, 'preinscripciones', 'editar'], // POST que envía un correo: «editar»
  ['post', `${A}/inscripciones/1/reenviar-enlace`, 'preinscripciones', 'editar'], // idem
  ['patch', `${A}/inscripciones/1/agendar-entrevista`, 'preinscripciones', 'editar'],
  ['patch', `${A}/inscripciones/1/finalizar-entrevista`, 'preinscripciones', 'editar'],
  ['patch', `${A}/inscripciones/1/aprobar-directo`, 'preinscripciones', 'editar'],
  ['patch', `${A}/inscripciones/1/remitir-cibir`, 'preinscripciones', 'editar'],
  ['patch', `${A}/inscripciones/1/aprobar`, 'preinscripciones', 'editar'],
  ['patch', `${A}/inscripciones/1/rechazar`, 'preinscripciones', 'editar'],
  ['patch', `${A}/inscripciones/1/cambiar-etapa`, 'preinscripciones', 'editar'],
  ['get', `${A}/estudiantes`, 'estudiantes', 'ver'],
  ['get', `${A}/estudiantes/1`, 'estudiantes', 'ver'],
  ['get', `${A}/estudiantes/1/documentos`, 'estudiantes', 'ver'],
  ['post', `${A}/estudiantes/1/documentos`, 'estudiantes', 'crear'],
  ['delete', `${A}/estudiantes/1/documentos/2`, 'estudiantes', 'eliminar'],
]

beforeAll(async () => {
  await mem.batch([
    `CREATE TABLE roles (id INTEGER PRIMARY KEY, clave TEXT UNIQUE NOT NULL, nombre TEXT NOT NULL, es_sistema INTEGER NOT NULL DEFAULT 0, activo INTEGER NOT NULL DEFAULT 1, creado_en TEXT)`,
    `CREATE TABLE rol_permisos (id_rol INTEGER NOT NULL, seccion TEXT NOT NULL, ver INTEGER NOT NULL DEFAULT 0, crear INTEGER NOT NULL DEFAULT 0, editar INTEGER NOT NULL DEFAULT 0, eliminar INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (id_rol, seccion))`,
  ], 'write')
  await sembrarRoles(mem)
  for (const s of new Set(RUTAS.map(r => r[2]))) {
    for (const a of ACCIONES) {
      for (const [clave, casillas] of [[`solo_${a}_${s}`, [a]], [`sin_${a}_${s}`, ACCIONES.filter(x => x !== a)]] as const) {
        await mem.execute({ sql: `INSERT INTO roles (clave, nombre) VALUES (?, ?)`, args: [clave, clave] })
        await mem.execute({
          sql: `INSERT INTO rol_permisos (id_rol, seccion, ver, crear, editar, eliminar) SELECT id, ?, ?, ?, ?, ? FROM roles WHERE clave = ?`,
          args: [s, ...ACCIONES.map(x => ((casillas as readonly string[]).includes(x) ? 1 : 0)), clave],
        })
      }
    }
  }
})

describe('academia: permisos por sección', () => {
  it.each(RUTAS)('%s %s exige %s/%s', async (m, url, seccion, accion) => {
    expect((await llamar(m, url)).status).toBe(401)
    expect((await llamar(m, url, token([`solo_${accion}_${seccion}`]))).status).toBe(200)
    expect((await llamar(m, url, token([`sin_${accion}_${seccion}`]))).status).toBe(403)
    expect((await llamar(m, url, token(['super_admin']))).status).toBe(200)
    expect((await llamar(m, url, token(['admin']))).status).toBe(200)
    expect((await llamar(m, url, token(['afiliado']))).status).toBe(403)
    expect((await llamar(m, url, token(['estudiante']))).status).toBe(403)
  })

  it('el staff conserva su acceso: todo menos los deletes que eran solo admin (cursos, inscripciones, profesores)', async () => {
    const soloAdmin = ['/cursos/1', '/inscripciones/1', '/profesores/1'].map(p => `delete ${A}${p}`)
    for (const [m, url] of RUTAS) {
      const esperado = soloAdmin.includes(`${m} ${url}`) ? 403 : 200
      for (const rol of STAFF) expect((await llamar(m, url, token([rol]))).status, `${rol} ${m} ${url}`).toBe(esperado)
    }
  })
})
