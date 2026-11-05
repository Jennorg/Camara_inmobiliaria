import { NextFunction, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'
import { db } from '../lib/db.js'
import { enviarInvitacion } from '../lib/credentials.js'
import { ACCIONES, SECCIONES, SECCIONES_SOLO_SUPERADMIN, type Accion } from '../config/secciones.js'
import { isSuperAdmin } from '../middlewares/auth.middleware.js'
import { invalidarCachePermisos, type MapaPermisos } from '../services/permisos.service.js'

const EDITABLES = SECCIONES.filter(s => !SECCIONES_SOLO_SUPERADMIN.includes(s.id))
// Roles base: un rol personalizado no puede adoptar su clave.
const BASE = ['super_admin', 'admin', 'afiliado', 'estudiante', 'asistente', 'administrativo', 'secretario', 'secretaria', 'personal', 'personal_admin', 'personal_administrativo']
const NIVEL_ADMIN = ['admin', 'super_admin'] // se asignan por el flujo de usuarios
const BASE_LIBRES = ['afiliado', 'estudiante'] // asignables aunque no sean fila de roles

const fallo = (status: number, message: string) => Object.assign(new Error(message), { status })

const responder = (res: Response, error: any, contexto: string) => {
  if (error?.status) return res.status(error.status).json({ success: false, message: error.message })
  console.error(`roles (${contexto}):`, error)
  return res.status(500).json({ success: false, message: `Error al ${contexto}` })
}

export const soloSuperAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || !isSuperAdmin(req.user)) {
    res.status(403).json({ success: false, message: 'Acceso denegado: solo el súper administrador gestiona roles' })
    return
  }
  next()
}

/** Solo [a-z0-9_]: la caché de permisos usa la coma como separador. */
export const claveDe = (nombre: string) =>
  nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')

const parseRoles = (v: unknown): string[] => {
  try { const r = JSON.parse(String(v)); return Array.isArray(r) ? r.map(String) : [String(v)] } catch { return [String(v)] }
}

// Tolera valores legado no-JSON en users.roles (p. ej. 'admin').
const USUARIOS_CON_ROL = `SELECT COUNT(*) FROM users u
  JOIN json_each(CASE WHEN json_valid(u.roles) THEN u.roles ELSE json_array(u.roles) END) j
  WHERE u.eliminado_en IS NULL AND j.value = r.clave`

/** Valida la matriz y la normaliza (sin `ver` no hay otras acciones). */
function validarMatriz(permisos: unknown): MapaPermisos {
  if (!permisos || typeof permisos !== 'object' || Array.isArray(permisos)) throw fallo(400, 'permisos debe ser un objeto por sección')
  const mapa: MapaPermisos = {}
  for (const [seccion, p] of Object.entries(permisos)) {
    if (!EDITABLES.some(s => s.id === seccion)) throw fallo(400, `Sección no válida: ${seccion}`)
    if (!p || typeof p !== 'object' || Array.isArray(p)) throw fallo(400, `Permisos inválidos para ${seccion}`)
    const fila = {} as Record<Accion, boolean>
    for (const a of ACCIONES) {
      const v = (p as any)[a] ?? false
      if (typeof v !== 'boolean') throw fallo(400, `La acción ${a} de ${seccion} debe ser booleana`)
      fila[a] = v
    }
    if (!fila.ver) fila.crear = fila.editar = fila.eliminar = false
    mapa[seccion] = fila
  }
  return mapa
}

/** Upsert de todas las secciones editables; las no enviadas quedan en 0. Nunca borra filas (la siembra las recrearía). */
const guardarMatriz = (idRol: number, mapa: MapaPermisos) =>
  EDITABLES.map(s => ({
    sql: `INSERT INTO rol_permisos (id_rol, seccion, ver, crear, editar, eliminar) VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT (id_rol, seccion) DO UPDATE SET ver = excluded.ver, crear = excluded.crear,
            editar = excluded.editar, eliminar = excluded.eliminar`,
    args: [idRol, s.id, ...ACCIONES.map(a => (mapa[s.id]?.[a] ? 1 : 0))],
  }))

async function rolPorId(id: unknown) {
  const r = await db.execute({ sql: 'SELECT id, clave, es_sistema FROM roles WHERE id = ?', args: [Number(id) || 0] })
  if (!r.rows.length) throw fallo(404, 'Rol no encontrado')
  return r.rows[0]
}

/** Comprueba que cada rol pueda asignarse; devuelve la lista sin duplicados. */
async function validarRoles(roles: unknown, permitirBase: boolean): Promise<string[]> {
  if (!Array.isArray(roles) || roles.some(r => typeof r !== 'string')) throw fallo(400, 'roles debe ser una lista de claves')
  const unicos = [...new Set(roles as string[])]
  if (unicos.some(r => NIVEL_ADMIN.includes(r))) throw fallo(403, 'admin y super_admin se asignan desde la gestión de usuarios')
  const custom = unicos.filter(r => !(permitirBase && BASE_LIBRES.includes(r)))
  if (custom.length) {
    const r = await db.execute({
      sql: `SELECT clave FROM roles WHERE activo = 1 AND clave IN (${custom.map(() => '?').join(',')})`,
      args: custom,
    })
    const existentes = new Set(r.rows.map(x => String(x.clave)))
    const malos = custom.filter(c => !existentes.has(c))
    if (malos.length) throw fallo(400, `Roles no válidos: ${malos.join(', ')}`)
  }
  return unicos
}

export const secciones = (_req: Request, res: Response) => {
  res.json({ success: true, data: EDITABLES })
}

export const listar = async (_req: Request, res: Response) => {
  try {
    const [roles, perms] = await Promise.all([
      db.execute(`SELECT r.id, r.clave, r.nombre, r.es_sistema, (${USUARIOS_CON_ROL}) AS usuarios FROM roles r ORDER BY r.es_sistema DESC, r.nombre`),
      db.execute('SELECT * FROM rol_permisos WHERE ver = 1'),
    ])
    const data = roles.rows.map(r => ({
      id: Number(r.id), clave: String(r.clave), nombre: String(r.nombre),
      es_sistema: Number(r.es_sistema), usuarios: Number(r.usuarios),
      permisos: Object.fromEntries(perms.rows
        .filter(p => Number(p.id_rol) === Number(r.id) && !SECCIONES_SOLO_SUPERADMIN.includes(String(p.seccion)))
        .map(p => [String(p.seccion), Object.fromEntries(ACCIONES.map(a => [a, Number(p[a]) === 1]))])) as MapaPermisos,
    }))
    res.json({ success: true, data })
  } catch (e) { responder(res, e, 'listar los roles') }
}

export const crear = async (req: Request, res: Response) => {
  try {
    const nombre = String(req.body?.nombre ?? '').trim()
    const clave = claveDe(nombre)
    const mapa = validarMatriz(req.body?.permisos ?? {})
    if (!clave) throw fallo(400, 'El nombre del rol es obligatorio')
    if ((await db.execute({ sql: 'SELECT 1 FROM roles WHERE clave = ?', args: [clave] })).rows.length) throw fallo(409, `Ya existe un rol con la clave ${clave}`)
    if (BASE.includes(clave)) throw fallo(400, `La clave ${clave} está reservada`)

    const ins = await db.execute({ sql: 'INSERT INTO roles (clave, nombre, es_sistema) VALUES (?, ?, 0)', args: [clave, nombre] })
    const id = Number(ins.lastInsertRowid)
    await db.batch(guardarMatriz(id, mapa), 'write')
    invalidarCachePermisos()
    res.status(201).json({ success: true, data: { id, clave, nombre } })
  } catch (e) { responder(res, e, 'crear el rol') }
}

export const actualizar = async (req: Request, res: Response) => {
  try {
    const rol = await rolPorId(req.params.id)
    const stmts = []
    if (req.body?.nombre !== undefined) {
      const nombre = String(req.body.nombre).trim()
      if (!nombre) throw fallo(400, 'El nombre del rol no puede quedar vacío')
      stmts.push({ sql: 'UPDATE roles SET nombre = ? WHERE id = ?', args: [nombre, rol.id] })
    }
    if (req.body?.permisos !== undefined) stmts.push(...guardarMatriz(Number(rol.id), validarMatriz(req.body.permisos)))
    if (stmts.length) await db.batch(stmts, 'write')
    invalidarCachePermisos()
    res.json({ success: true })
  } catch (e) { responder(res, e, 'actualizar el rol') }
}

export const eliminar = async (req: Request, res: Response) => {
  try {
    const rol = await rolPorId(req.params.id)
    if (Number(rol.es_sistema) === 1) throw fallo(400, 'Los roles del sistema no se pueden eliminar')
    const n = await db.execute({ sql: `SELECT (${USUARIOS_CON_ROL}) AS n FROM roles r WHERE r.id = ?`, args: [rol.id] })
    if (Number(n.rows[0].n) > 0) throw fallo(409, 'El rol tiene usuarios asignados; quítaselo antes de eliminarlo')
    // Borrado explícito: PRAGMA foreign_keys es por conexión y aquí no está garantizado.
    await db.batch([
      { sql: 'DELETE FROM rol_permisos WHERE id_rol = ?', args: [rol.id] },
      { sql: 'DELETE FROM roles WHERE id = ?', args: [rol.id] },
    ], 'write')
    invalidarCachePermisos()
    res.json({ success: true })
  } catch (e) { responder(res, e, 'eliminar el rol') }
}

export const asignar = async (req: Request, res: Response) => {
  try {
    const idUser = Number(req.params.idUser)
    if (idUser === req.user!.id) throw fallo(403, 'No puedes cambiar tus propios roles')
    const u = await db.execute({ sql: 'SELECT roles FROM users WHERE id = ? AND eliminado_en IS NULL', args: [idUser] })
    if (!u.rows.length) throw fallo(404, 'Usuario no encontrado')
    const actuales = parseRoles(u.rows[0].roles)
    if (actuales.includes('super_admin')) throw fallo(403, 'No se pueden cambiar los roles de un súper administrador')

    const roles = await validarRoles(req.body?.roles, true)
    if (actuales.includes('afiliado') && !roles.includes('afiliado')) roles.unshift('afiliado')
    await db.execute({
      sql: `UPDATE users SET roles = ?, actualizado_en = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id = ?`,
      args: [JSON.stringify(roles), idUser],
    })
    invalidarCachePermisos()
    res.json({ success: true, data: { roles } })
  } catch (e) { responder(res, e, 'asignar los roles') }
}

export const crearStaff = async (req: Request, res: Response) => {
  try {
    const nombre = String(req.body?.nombre ?? '').trim()
    const email = String(req.body?.email ?? '').trim().toLowerCase()
    if (!nombre) throw fallo(400, 'El nombre es obligatorio')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw fallo(400, 'Email inválido')
    const roles = await validarRoles(req.body?.roles, false)
    if (!roles.length) throw fallo(400, 'Asigna al menos un rol')
    if ((await db.execute({ sql: 'SELECT 1 FROM users WHERE email = ?', args: [email] })).rows.length) throw fallo(409, 'Ya existe un usuario con ese email')

    // Contraseña inutilizable: el acceso se establece con el enlace de la invitación.
    const hash = await bcrypt.hash(randomBytes(32).toString('hex'), 10)
    const ins = await db.execute({
      sql: 'INSERT INTO users (email, password_hash, roles, nombre) VALUES (?, ?, ?, ?)',
      args: [email, hash, JSON.stringify(roles), nombre],
    })
    const id = Number(ins.lastInsertRowid)

    let invitacion_enviada = true
    try { await enviarInvitacion({ email, nombre }) } catch (err) {
      console.error('roles (invitación de staff):', err)
      invitacion_enviada = false
    }
    res.status(201).json({
      success: true,
      message: invitacion_enviada
        ? 'Usuario creado; se envió la invitación por correo.'
        : 'Usuario creado, pero falló el envío de la invitación. Reenvíala desde la gestión de usuarios.',
      data: { id, email, nombre, roles, invitacion_enviada },
    })
  } catch (e) { responder(res, e, 'crear el usuario de staff') }
}
