import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { createHash } from 'crypto'
import { db } from '../lib/db.js'
import { resetCredenciales } from '../lib/credentials.js'
import { isSuperAdmin, isAdmin } from '../middlewares/auth.middleware.js'

const sha256 = (raw: string) => createHash('sha256').update(raw).digest('hex')

const parseRoles = (rolesField: unknown): string[] => {
  if (typeof rolesField === 'string' && rolesField.startsWith('[')) {
    try { return JSON.parse(rolesField) } catch { /* fall through */ }
  }
  if (typeof rolesField === 'string') return [rolesField]
  return ['afiliado']
}

/**
 * GET /api/users
 * Lista todos los usuarios del sistema (solo admin).
 */
export const getUsers = async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await db.execute({
      sql: `SELECT u.id, u.email, u.roles, u.activo, u.creado_en,
                   a.id_afiliado,
                   COALESCE(e.razon_social, p.nombres || ' ' || p.apellidos) as nombre_completo, a.codigo_cibir, a.estatus as estatus_afiliado
            FROM users u
            LEFT JOIN afiliados a ON u.id = a.id_user
            LEFT JOIN personas p ON a.id_persona = p.id
            LEFT JOIN empresas e ON a.id_empresa = e.id_empresa
            ORDER BY u.creado_en DESC`,
      args: [],
    })
    const rows = result.rows.map(r => {
      const roles = parseRoles(r.roles)
      const rol = roles.includes('super_admin') ? 'super_admin' : roles.includes('admin') ? 'admin' : 'afiliado'
      return { ...r, roles, rol }
    })
    res.status(200).json({ success: true, data: rows })
  } catch (error) {
    console.error('Error en getUsers:', error)
    res.status(500).json({ success: false, message: 'Error interno del servidor' })
  }
}

/**
 * POST /api/users
 * Crea un nuevo usuario.
 * Afiliados normales solo por admin/super_admin. 
 * Admins solo por super_admin.
 * Body: { email, password, rol, id_afiliado? }
 */
export const createUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, rol, id_afiliado } = req.body

    if (!email || !password || !rol) {
      res.status(400).json({ success: false, message: 'email, password y rol son requeridos' })
      return
    }

    if (!['admin', 'afiliado', 'super_admin'].includes(rol)) {
      res.status(400).json({ success: false, message: 'rol inválido' })
      return
    }

    // Only super_admin can create 'admin' or 'super_admin' roles
    if (['admin', 'super_admin'].includes(rol) && !isSuperAdmin(req.user!)) {
      res.status(403).json({ success: false, message: 'Acceso denegado: Solo el súper administrador puede crear administradores' })
      return
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const rolesJson = JSON.stringify([rol])

    const result = await db.execute({
      sql: `INSERT INTO users (email, password_hash, roles)
            VALUES (?, ?, ?) RETURNING id, email, roles, activo, creado_en`,
      args: [email, passwordHash, rolesJson],
    })

    const newUser = result.rows[0];

    if (id_afiliado) {
      await db.execute({
        sql: `UPDATE afiliados SET id_user = ? WHERE id_afiliado = ?`,
        args: [newUser.id, id_afiliado]
      });
    }

    res.status(201).json({ success: true, data: newUser })
  } catch (error: any) {
    if (error.message?.includes('UNIQUE constraint failed: users.email')) {
      res.status(409).json({ success: false, message: 'El email ya está registrado' })
      return
    }
    console.error('Error en createUser:', error)
    res.status(500).json({ success: false, message: 'Error interno del servidor' })
  }
}

/**
 * PATCH /api/users/:id
 * Actualiza rol, activo, o contraseñas de un usuario. (El vínculo con afiliado se gestiona del lado del afiliado).
 */
export const updateUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const { rol, activo, password } = req.body

    // Si queremos actualizar a un usuario, validamos permisos estrictos para administradores
    const userToUpdate = await db.execute({ sql: `SELECT roles FROM users WHERE id = ?`, args: [Number(id)] })
    if (userToUpdate.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Usuario no encontrado' })
      return
    }

    const targetRoles = parseRoles(userToUpdate.rows[0].roles)
    const targetRole = targetRoles.includes('super_admin') ? 'super_admin' : targetRoles.includes('admin') ? 'admin' : 'afiliado'
    if (['admin', 'super_admin'].includes(targetRole as string) && !isSuperAdmin(req.user!)) {
      res.status(403).json({ success: false, message: 'Acceso denegado: Solo el súper administrador puede editar a otros administradores' })
      return
    }

    const fields: string[] = []
    const args: any[] = []

    if (rol !== undefined) {
      if (!['admin', 'afiliado', 'super_admin'].includes(rol)) {
        res.status(400).json({ success: false, message: 'rol inválido' })
        return
      }
      if (['admin', 'super_admin'].includes(rol) && req.user?.rol !== 'super_admin') {
        res.status(403).json({ success: false, message: 'Acceso denegado: No puedes ascender a este rol' })
        return
      }
      const rolesJson = JSON.stringify([rol])
      fields.push('roles = ?'); args.push(rolesJson)
    }
    if (activo !== undefined) { fields.push('activo = ?'); args.push(activo ? 1 : 0) }
    if (password !== undefined) {
      if (password.length < 8) {
        res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 8 caracteres' })
        return
      }
      const hash = await bcrypt.hash(password, 10)
      fields.push('password_hash = ?'); args.push(hash)
      fields.push('reset_token_hash = NULL')
      fields.push('reset_token_expira = NULL')
      fields.push('activo = 1')
    }

    if (fields.length === 0) {
      res.status(400).json({ success: false, message: 'No hay campos para actualizar' })
      return
    }

    // args ya contiene los valores de los fields; agregamos fecha y id al final
    const result = await db.execute({
      sql: `UPDATE users SET ${fields.join(', ')}, actualizado_en = ? WHERE id = ? RETURNING id, email, roles, activo`,
      args: [...args, new Date().toISOString(), id],
    })

    res.status(200).json({ success: true, data: result.rows[0] })
  } catch (error) {
    console.error('Error en updateUser:', error)
    res.status(500).json({ success: false, message: 'Error interno del servidor' })
  }
}

/**
 * POST /api/users/:id/reset
 * Resetea la contraseña de un usuario (solo admin).
 * Envía un correo al usuario con un enlace para que establezca su nueva contraseña.
 */
export const resetUserPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    // Verificar que el usuario existe
    const userId = Number(id)
    const check = await db.execute({ 
      sql: `SELECT u.id, u.email, COALESCE(e.razon_social, p.nombres || ' ' || p.apellidos) as nombre_completo 
            FROM users u 
            LEFT JOIN afiliados a ON u.id = a.id_user 
            LEFT JOIN personas p ON a.id_persona = p.id
            LEFT JOIN empresas e ON a.id_empresa = e.id_empresa
            WHERE u.id = ?`, 
      args: [userId] 
    })
    if (check.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Usuario no encontrado' })
      return
    }

    const user = check.rows[0] as any
    const nombre = user.nombre_completo || 'Usuario'

    const { randomBytes } = await import('crypto')
    const token = randomBytes(32).toString('hex')
    const expira = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 horas

    const tokenHash = sha256(token)
    await db.execute({
      sql: `UPDATE users SET reset_token_hash = ?, reset_token_expira = ?, actualizado_en = ? WHERE id = ?`,
      args: [tokenHash, expira, new Date().toISOString(), userId],
    })

    const { enviarCorreoResetAdmin } = await import('../lib/email.js')

    try {
      await enviarCorreoResetAdmin(nombre, user.email, token)
    } catch (err) {
      console.error('Error enviando correo de reset por admin:', err)
      // Podemos informar que falló el envío pero el token fue generado, aunque lo mejor es mostrar error
      res.status(500).json({ success: false, message: 'Se generó el enlace pero falló el envío del correo.' })
      return
    }

    res.status(200).json({
      success: true,
      message: 'Se ha enviado un correo al usuario para que establezca su nueva contraseña.',
    })
  } catch (error) {
    console.error('Error en resetUserPassword:', error)
    res.status(500).json({ success: false, message: 'Error interno del servidor' })
  }
}

/**
 * DELETE /api/users/:id
 * Elimina completamente un usuario.
 */
export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    const userToUpdate = await db.execute({ sql: `SELECT roles FROM users WHERE id = ?`, args: [Number(id)] })
    if (userToUpdate.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Usuario no encontrado' })
      return
    }

    const tRoles = parseRoles(userToUpdate.rows[0].roles)
    const targetRole = tRoles.includes('super_admin') ? 'super_admin' : tRoles.includes('admin') ? 'admin' : 'afiliado'
    if (['admin', 'super_admin'].includes(targetRole as string) && !isSuperAdmin(req.user!)) {
      res.status(403).json({ success: false, message: 'Acceso denegado: Solo el súper administrador puede eliminar a administradores' })
      return
    }

    // Do not allow deleting yourself if you are superadmin
    if (Number(id) === req.user?.id) {
      res.status(400).json({ success: false, message: 'No puedes eliminarte a ti mismo' })
      return
    }

    await db.execute({ sql: `DELETE FROM users WHERE id = ?`, args: [Number(id)] })

    res.status(200).json({ success: true, message: 'Usuario eliminado correctamente' })
  } catch (error) {
    console.error('Error en deleteUser:', error)
    res.status(500).json({ success: false, message: 'Error interno del servidor' })
  }
}
