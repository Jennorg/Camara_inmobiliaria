import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { createHash } from 'crypto'
import { db } from '../lib/db.js'
import { env } from '../config/env.js'
import type { JwtPayload, UserRole } from '../middlewares/auth.middleware.js'
import { enrichUserPayload } from '../middlewares/auth.middleware.js'

/** Hashea un token en crudo con SHA-256 (para almacenar en reset_token_hash). */
const sha256 = (raw: string) => createHash('sha256').update(raw).digest('hex')

/**
 * Parsea el campo `roles` de la DB (puede venir como JSON string o como string simple).
 */
function parseRoles(rolesField: unknown): UserRole[] {
  if (typeof rolesField === 'string' && rolesField.startsWith('[')) {
    try {
      return JSON.parse(rolesField) as UserRole[]
    } catch {
      // fall through
    }
  }
  if (typeof rolesField === 'string' && rolesField.length > 0) {
    return [rolesField as UserRole]
  }
  return ['afiliado']
}

/**
 * POST /api/auth/login
 * Autentica al usuario con email + contraseña.
 * Devuelve un JWT con array de roles.
 */
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      res.status(400).json({ success: false, message: 'Email y contraseña son requeridos' })
      return
    }

    // Buscar usuario por email (incluyendo campo roles)
    const result = await db.execute({
      sql: `SELECT id, email, password_hash, roles, activo FROM users WHERE email = ?`,
      args: [email],
    })

    const user = result.rows[0]

    if (!user) {
      res.status(401).json({ success: false, message: 'Credenciales incorrectas' })
      return
    }

    if (!user.activo) {
      res.status(403).json({ success: false, message: 'Cuenta desactivada. Contacta al administrador.' })
      return
    }

    // Verificar contraseña
    const passwordMatch = await bcrypt.compare(password, user.password_hash as string)
    if (!passwordMatch) {
      res.status(401).json({ success: false, message: 'Credenciales incorrectas' })
      return
    }

    const roles = parseRoles(user.roles)

    // El rol primario (para retrocompatibilidad) es el "más alto" en jerarquía
    const rolPrimary: UserRole = roles.includes('super_admin')
      ? 'super_admin'
      : roles.includes('admin')
        ? 'admin'
        : 'afiliado'

    // Generar JWT (el JWT base solo contiene lo esencial)
    const payload: JwtPayload = {
      id: user.id as number,
      email: user.email as string,
      rol: rolPrimary,
      roles
    }

    const token = jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    })

    // Enriquecer el usuario para retornarlo en la respuesta del login
    const enrichedUser = await enrichUserPayload({ ...payload })

    res.status(200).json({
      success: true,
      token,
      user: enrichedUser,
    })
  } catch (error) {
    console.error('Error en login:', error)
    res.status(500).json({ success: false, message: 'Error interno del servidor' })
  }
}

/**
 * GET /api/auth/me
 * Devuelve los datos del usuario autenticado (requiere JWT válido).
 * El middleware enrichUser ya se encarga de poblar las relaciones en req.user
 */
export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(404).json({ success: false, message: 'Usuario no encontrado' })
      return
    }

    res.status(200).json({ success: true, user: req.user })
  } catch (error) {
    console.error('Error en getMe:', error)
    res.status(500).json({ success: false, message: 'Error interno del servidor' })
  }
}

/**
 * POST /api/auth/forgot-password
 * Recibe el email, genera un token y envía correo para restablecer contraseña.
 */
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body

    if (!email) {
      res.status(400).json({ success: false, message: 'El email es requerido' })
      return
    }

    const result = await db.execute({
      sql: `SELECT id, email FROM users WHERE email = ? AND activo = 1`,
      args: [email.trim().toLowerCase()],
    })

    const successMsg = 'Si el correo existe en nuestro sistema, te enviaremos un enlace para restablecer tu contraseña.'

    if (result.rows.length === 0) {
      // Por seguridad, no revela si el usuario existe o no
      res.status(200).json({ success: true, message: successMsg })
      return
    }

    const user = result.rows[0] as any
    // Generar token
    const { randomBytes } = await import('crypto')
    const token = randomBytes(32).toString('hex')
    // Expira en 1 hora
    const expira = new Date(Date.now() + 60 * 60 * 1000).toISOString()

    const tokenHash = sha256(token)
    await db.execute({
      sql: `UPDATE users SET reset_token_hash = ?, reset_token_expira = ?, actualizado_en = ? WHERE id = ?`,
      args: [tokenHash, expira, new Date().toISOString(), user.id],
    })

    const { enviarCorreoOlvideContrasena } = await import('../lib/email.js')
    try {
      await enviarCorreoOlvideContrasena(user.email, token)
    } catch (err) {
      console.error('Error enviando correo de forgotPassword:', err)
      // Aun así respondemos 200 para no dar pistas
    }

    res.status(200).json({ success: true, message: successMsg })
  } catch (error) {
    console.error('Error en forgotPassword:', error)
    res.status(500).json({ success: false, message: 'Error interno del servidor' })
  }
}

/**
 * POST /api/auth/reset-password
 * Valida el token y establece la nueva contraseña (flujo olvidé mi contraseña/reset admin).
 * Body: { token, password }
 */
export const resetPasswordWithToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, password } = req.body

    if (!token || !password) {
      res.status(400).json({ success: false, message: 'Token y contraseña son requeridos' })
      return
    }
    if (password.length < 8) {
      res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 8 caracteres' })
      return
    }

    // SHA-256 del token crudo para buscar en la BD
    const tokenHash = sha256(token)
    const result = await db.execute({
      sql: `SELECT id, email, reset_token_expira FROM users WHERE reset_token_hash = ?`,
      args: [tokenHash],
    })

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'El enlace no es válido o ya fue utilizado.' })
      return
    }

    const user = result.rows[0] as any
    if (new Date(user.reset_token_expira) < new Date()) {
      res.status(400).json({ success: false, message: 'El enlace ha expirado. Solicita un nuevo enlace.' })
      return
    }

    const passwordHash = await bcrypt.hash(password, 10)

    await db.execute({
      sql: `UPDATE users SET password_hash = ?, reset_token_hash = NULL, reset_token_expira = NULL, activo = 1, actualizado_en = ? WHERE id = ?`,
      args: [passwordHash, new Date().toISOString(), user.id],
    })

    res.status(200).json({
      success: true,
      message: 'Contraseña actualizada correctamente. Ya puedes iniciar sesión.',
      email: user.email
    })
  } catch (error) {
    console.error('Error en resetPasswordWithToken:', error)
    res.status(500).json({ success: false, message: 'Error interno del servidor' })
  }
}


/**
 * POST /api/auth/setup-initial-password
 * Valida el token de configuración inicial y establece la contraseña definitiva.
 */
export const setupInitialPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, password } = req.body

    if (!token || !password) {
      res.status(400).json({ success: false, message: 'Token y contraseña son requeridos' })
      return
    }

    if (password.length < 8) {
      res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 8 caracteres' })
      return
    }

    // SHA-256 del token crudo para buscar en la BD
    const tokenHash = sha256(token)

    const resultFix = await db.execute({
      sql: `SELECT id, email FROM users WHERE reset_token_hash = ?`,
      args: [tokenHash],
    })

    const user = resultFix.rows[0]
    if (!user) {
      res.status(404).json({ success: false, message: 'Token inválido o no encontrado' })
      return
    }

    // Verificar expiración (ISO compare)
    const { id, email } = user as any
    const userWithExp = await db.execute({
      sql: `SELECT reset_token_expira FROM users WHERE id = ?`,
      args: [id]
    })
    const exp = userWithExp.rows[0].reset_token_expira as string
    if (new Date(exp) < new Date()) {
      res.status(400).json({ success: false, message: 'El enlace ha expirado. Contacta al administrador.' })
      return
    }

    const passwordHash = await bcrypt.hash(password, 10)

    // Actualizar contraseña y limpiar token
    await db.execute({
      sql: `UPDATE users 
            SET password_hash = ?, reset_token_hash = NULL, reset_token_expira = NULL, activo = 1, actualizado_en = ?
            WHERE id = ?`,
      args: [passwordHash, new Date().toISOString(), id],
    })

    res.status(200).json({
      success: true,
      message: 'Contraseña establecida exitosamente. Ya puedes iniciar sesión.',
      email
    })
  } catch (error) {
    console.error('Error en setupInitialPassword:', error)
    res.status(500).json({ success: false, message: 'Error interno del servidor' })
  }
}

/**
 * POST /api/auth/logout
 * No-op — el cliente elimina el token de localStorage.
 */
export const logout = (_req: Request, res: Response): void => {
  res.status(200).json({ success: true, message: 'Sesión cerrada' })
}
