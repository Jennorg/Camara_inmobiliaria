import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { createHash } from 'crypto'
import { db } from '../lib/db.js'
import { resetCredenciales } from '../lib/credentials.js'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { isSuperAdmin, isAdmin, isAsistente, enrichUserPayload, JwtPayload } from '../middlewares/auth.middleware.js'

const sha256 = (raw: string) => createHash('sha256').update(raw).digest('hex')

const parseRoles = (rolesField: unknown): string[] => {
  if (typeof rolesField === 'string' && rolesField.startsWith('[')) {
    try { return JSON.parse(rolesField) } catch { /* fall through */ }
  }
  if (typeof rolesField === 'string') return [rolesField]
  return ['afiliado']
}

/**
 * POST /api/users
 * Crea un nuevo usuario.
 * Afiliados normales por admin/super_admin/asistente. 
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

    if (!['admin', 'afiliado', 'super_admin', 'asistente', 'administrativo', 'estudiante', 'secretaria', 'secretario', 'personal', 'personal_admin', 'personal_administrativo'].includes(rol)) {
      res.status(400).json({ success: false, message: 'rol inválido' })
      return
    }

    // Only super_admin can create 'admin' or 'super_admin' roles
    if (['admin', 'super_admin'].includes(rol) && !isSuperAdmin(req.user!)) {
      res.status(403).json({ success: false, message: 'Acceso denegado: Solo el súper administrador puede crear administradores' })
      return
    }

    // Only admin/super_admin can create staff roles
    if (['asistente', 'administrativo', 'secretaria', 'secretario', 'personal', 'personal_admin', 'personal_administrativo'].includes(rol) && !isAdmin(req.user!)) {
      res.status(403).json({ success: false, message: 'Acceso denegado: Solo administradores pueden crear personal administrativo' })
      return
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const rolesJson = JSON.stringify([rol])
    const normalizedEmail = email.trim().toLowerCase()

    const result = await db.execute({
      sql: `INSERT INTO users (email, password_hash, roles)
            VALUES (?, ?, ?) RETURNING id, email, roles, activo, creado_en`,
      args: [normalizedEmail, passwordHash, rolesJson],
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
    const { rol, activo, password, email } = req.body

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

    if (email !== undefined) {
      const normalizedEmail = email.trim().toLowerCase()
      if (!normalizedEmail) {
        res.status(400).json({ success: false, message: 'El correo no puede estar vacío' })
        return
      }

      const dup = await db.execute({
        sql: `SELECT id FROM users WHERE LOWER(TRIM(email)) = ? AND id != ?`,
        args: [normalizedEmail, Number(id)],
      })
      if (dup.rows.length > 0) {
        res.status(409).json({ success: false, message: 'El correo electrónico ya está registrado por otro usuario' })
        return
      }
      fields.push('email = ?'); args.push(normalizedEmail)
    }

    if (rol !== undefined) {
      if (!['admin', 'afiliado', 'super_admin', 'asistente', 'administrativo', 'estudiante'].includes(rol)) {
        res.status(400).json({ success: false, message: 'rol inválido' })
        return
      }
      if (['admin', 'super_admin'].includes(rol) && !isSuperAdmin(req.user!)) {
        res.status(403).json({ success: false, message: 'Acceso denegado: No puedes ascender a este rol' })
        return
      }
      if (['asistente', 'administrativo'].includes(rol) && !isAdmin(req.user!)) {
        res.status(403).json({ success: false, message: 'Acceso denegado: Solo administradores pueden asignar rol administrativo' })
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
 * GET /api/users
 * Lista todos los usuarios del sistema (solo admin).
 */
export const getUsers = async (_req: Request, res: Response): Promise<void> => {
  try {
    // Sincronizar/crear cuentas de usuario en `users` para afiliados que carecen de ellas
    try {
      await db.execute({
        sql: `INSERT INTO users (email, password_hash, roles, activo)
              SELECT LOWER(TRIM(p.email)), '$2a$10$dummyHashToPreventEmptyLogin', '["afiliado"]', 1
              FROM afiliados a
              JOIN personas p ON a.id_persona = p.id
              WHERE (a.id_user IS NULL OR a.id_user NOT IN (SELECT id FROM users))
                AND p.email IS NOT NULL AND TRIM(p.email) != ''
                AND LOWER(TRIM(p.email)) NOT IN (SELECT LOWER(TRIM(email)) FROM users)`,
        args: []
      });

      await db.execute({
        sql: `UPDATE afiliados
              SET id_user = (
                SELECT u.id FROM users u 
                WHERE LOWER(TRIM(u.email)) = LOWER(TRIM((SELECT p.email FROM personas p WHERE p.id = afiliados.id_persona)))
                LIMIT 1
              )
              WHERE id_user IS NULL OR id_user NOT IN (SELECT id FROM users)`,
        args: []
      });
    } catch (syncErr) {
      console.warn('Advertencia al auto-sincronizar usuarios de afiliados:', syncErr);
    }

    const result = await db.execute({
      sql: `SELECT u.id, u.email, u.roles, u.activo, u.creado_en,
                   a.id_afiliado, a.tipo_afiliado,
                   COALESCE(p.email, p_by_email.email, p_est.email) AS persona_email,
                   COALESCE(e.email, e_by_email.email) AS empresa_email,
                   COALESCE(
                     NULLIF(TRIM(e.razon_social), ''),
                     NULLIF(TRIM(e_by_email.razon_social), ''),
                     NULLIF(TRIM(COALESCE(p.nombres, '') || ' ' || COALESCE(p.apellidos, '')), ''),
                     NULLIF(TRIM(COALESCE(p_by_email.nombres, '') || ' ' || COALESCE(p_by_email.apellidos, '')), ''),
                     NULLIF(TRIM(COALESCE(p_est.nombres, '') || ' ' || COALESCE(p_est.apellidos, '')), ''),
                     CASE 
                       WHEN u.roles LIKE '%admin%' THEN 'Usuario Administrador'
                       ELSE 'Sin registro de persona'
                     END
                   ) as nombre_completo,
                   COALESCE(p.nombres, p_by_email.nombres, p_est.nombres) as nombres,
                   COALESCE(p.apellidos, p_by_email.apellidos, p_est.apellidos) as apellidos,
                   COALESCE(e.razon_social, e_by_email.razon_social) as razon_social,
                   a.codigo, a.estatus as estatus_afiliado,
                   COALESCE(p.cedula_tipo, p_by_email.cedula_tipo, p_est.cedula_tipo) as cedula_tipo,
                   COALESCE(p.cedula, p_by_email.cedula, p_est.cedula) as cedula,
                   COALESCE(e.rif_tipo, e_by_email.rif_tipo) as rif_tipo,
                   COALESCE(e.rif_numero, e_by_email.rif_numero) as rif_numero
            FROM users u
            LEFT JOIN afiliados a ON u.id = a.id_user
            LEFT JOIN personas p ON a.id_persona = p.id
            LEFT JOIN personas p_by_email ON LOWER(TRIM(p_by_email.email)) = LOWER(TRIM(u.email))
            LEFT JOIN estudiantes est ON u.id = est.id_user
            LEFT JOIN personas p_est ON est.id_persona = p_est.id
            LEFT JOIN empresas e ON a.id_empresa = e.id_empresa
            LEFT JOIN empresas e_by_email ON LOWER(TRIM(e_by_email.email)) = LOWER(TRIM(u.email))
            GROUP BY u.id
            ORDER BY u.creado_en DESC`,
      args: [],
    })
    const rows = result.rows.map(r => {
      const roles = parseRoles(r.roles)
      const rol = roles.includes('super_admin')
        ? 'super_admin'
        : roles.includes('admin')
          ? 'admin'
          : roles.includes('asistente') || roles.includes('administrativo')
            ? 'asistente'
            : 'afiliado'
      return { ...r, roles, rol }
    })
    res.status(200).json({ success: true, data: rows })
  } catch (error) {
    console.error('Error en getUsers:', error)
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
    const expira = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 días

    const tokenHash = sha256(token)
    await db.execute({
      sql: `INSERT INTO tokens_accion (token, tipo, email, fecha_expiracion) VALUES (?, 'reset_password', ?, ?)`,
      args: [tokenHash, user.email, expira],
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
 * POST /api/users/:id/invite
 * Envía el correo de invitación (onboarding) para establecer contraseña (solo admin).
 */
export const sendUserInvitation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const userId = Number(id)

    // Verificar que el usuario existe y obtener sus datos
    const check = await db.execute({ 
      sql: `SELECT u.id, u.email, 
                   COALESCE(NULLIF(TRIM(e.razon_social), ''), NULLIF(TRIM(COALESCE(p.nombres, '') || ' ' || COALESCE(p.apellidos, '')), '')) as nombre_completo,
                   a.id_afiliado
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
    const expStr = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 días de validez
    const tokenHash = sha256(token)

    // Eliminar tokens anteriores
    await db.execute({
      sql: `DELETE FROM tokens_accion WHERE email = ? AND tipo = 'reset_password'`,
      args: [user.email]
    })

    // Insertar el nuevo token
    await db.execute({
      sql: `INSERT INTO tokens_accion (token, tipo, email, usado, fecha_expiracion)
            VALUES (?, 'reset_password', ?, 0, ?)`,
      args: [tokenHash, user.email, expStr]
    })

    const { enviarCorreoOnboardingMasivo } = await import('../lib/email.js')
    await enviarCorreoOnboardingMasivo(nombre, user.email, token)

    res.status(200).json({
      success: true,
      message: 'Correo de invitación enviado correctamente.',
    })
  } catch (error) {
    console.error('Error en sendUserInvitation:', error)
    res.status(500).json({ success: false, message: 'Error al enviar la invitación.' })
  }
}

/**
 * DELETE /api/users/:id
 * Elimina completamente un usuario.
 */
export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    if (isAsistente(req.user!)) {
      res.status(403).json({ success: false, message: 'Acceso denegado: El personal administrativo no tiene permisos para eliminar usuarios' })
      return
    }

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

/**
 * POST /api/users/:id/impersonate
 * Suplanta temporalmente la sesión de un usuario (solo admin / super_admin).
 */
export const impersonateUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const targetUserId = Number(id)

    // Solo admin y super_admin pueden suplantar
    if (!isAdmin(req.user!)) {
      res.status(403).json({ success: false, message: 'Acceso denegado: Solo administradores pueden suplantar usuarios' })
      return
    }

    const userResult = await db.execute({
      sql: `SELECT id, email, roles, activo FROM users WHERE id = ?`,
      args: [targetUserId]
    })

    if (userResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Usuario objetivo no encontrado' })
      return
    }

    const targetRow = userResult.rows[0]
    if (targetRow.activo !== 1) {
      res.status(400).json({ success: false, message: 'No se puede ingresar a una cuenta de usuario inactiva' })
      return
    }

    const roles = parseRoles(targetRow.roles)
    const rol = roles.includes('super_admin')
      ? 'super_admin'
      : roles.includes('admin')
        ? 'admin'
        : roles.includes('asistente') || roles.includes('administrativo')
          ? 'asistente'
          : roles.includes('estudiante')
            ? 'estudiante'
            : 'afiliado'

    const targetPayload: JwtPayload = {
      id: Number(targetRow.id),
      email: String(targetRow.email),
      roles: roles as any,
      rol: rol as any,
      impersonatedBy: req.user!.id
    }

    // Enriquecer el payload con id_afiliado, id_persona, id_empresa, etc.
    const enrichedUser = await enrichUserPayload(targetPayload)

    // Firmar JWT con 8 horas de duración
    const token = jwt.sign(enrichedUser, env.JWT_SECRET, { expiresIn: '8h' })

    res.status(200).json({
      success: true,
      message: `Ingresando como ${enrichedUser.nombre_completo || enrichedUser.email}`,
      data: {
        token,
        user: enrichedUser,
        originalAdmin: {
          id: req.user!.id,
          email: req.user!.email,
          nombre_completo: req.user!.nombre_completo || req.user!.email
        }
      }
    })
  } catch (error) {
    console.error('Error en impersonateUser:', error)
    res.status(500).json({ success: false, message: 'Error interno del servidor al ingresar como usuario' })
  }
}
