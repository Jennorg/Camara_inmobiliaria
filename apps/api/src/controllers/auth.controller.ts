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

import { randomBytes } from 'crypto'

async function createRefreshTokenSession(userId: number): Promise<{ token: string; expira: string }> {
  // Pruner de tokens expirados
  await db.execute({
    sql: `DELETE FROM user_refresh_tokens WHERE id_user = ? AND expira_en < ?`,
    args: [userId, new Date().toISOString()]
  });

  const token = randomBytes(32).toString('hex');
  const expira = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 dias
  const tokenHash = sha256(token);
  
  await db.execute({
    sql: `INSERT INTO user_refresh_tokens (id_user, token_hash, expira_en) VALUES (?, ?, ?)`,
    args: [userId, tokenHash, expira]
  });
  
  return { token, expira };
}

function getCookie(req: Request, name: string): string | undefined {
  const raw = req.headers.cookie;
  if (!raw) return undefined;
  const cookies = raw.split(';').map(c => c.trim());
  for (const cookie of cookies) {
    const [key, ...valParts] = cookie.split('=');
    if (key === name) {
      return decodeURIComponent(valParts.join('='));
    }
  }
  return undefined;
}

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
      sql: `SELECT id, email, password_hash, roles, activo FROM users WHERE LOWER(email) = ?`,
      args: [email.trim().toLowerCase()],
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
        : roles.includes('asistente') || roles.includes('administrativo')
          ? 'asistente'
          : roles.includes('estudiante')
            ? 'estudiante'
            : 'afiliado'

    // Generar JWT (el JWT base solo contiene lo esencial)
    const payload: JwtPayload = {
      id: user.id as number,
      email: user.email as string,
      rol: rolPrimary,
      roles
    }

    const token = jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: '30m',
    })

    // Generar Refresh Token y guardar en la base de datos
    const { token: refreshToken } = await createRefreshTokenSession(user.id as number);

    // Set Refresh Token HttpOnly cookie
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/'
    });

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

    // Migración transparente si no tiene cookie pero viene con token válido
    const hasRefreshToken = getCookie(req, 'refresh_token');
    if (!hasRefreshToken && req.user) {
      try {
        const { token: refreshToken } = await createRefreshTokenSession(req.user.id);
        res.cookie('refresh_token', refreshToken, {
          httpOnly: true,
          secure: env.NODE_ENV === 'production',
          sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
          path: '/'
        });
      } catch (err) {
        console.error('Error generando cookie de refresh en getMe:', err);
      }
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
      sql: `SELECT id, email FROM users WHERE LOWER(email) = ? AND activo = 1`,
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
      sql: `INSERT INTO tokens_accion (token, tipo, email, usado, fecha_expiracion) VALUES (?, 'reset_password', ?, 0, ?)`,
      args: [tokenHash, user.email, expira],
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
      sql: `SELECT email, fecha_expiracion FROM tokens_accion WHERE token = ? AND tipo = 'reset_password' AND usado = 0`,
      args: [tokenHash],
    })

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'El enlace no es válido o ya fue utilizado.' })
      return
    }

    const tokenData = result.rows[0] as any
    if (new Date(tokenData.fecha_expiracion) < new Date()) {
      res.status(400).json({ success: false, message: 'El enlace ha expirado. Solicita un nuevo enlace.' })
      return
    }

    const userResult = await db.execute({
      sql: `SELECT id FROM users WHERE LOWER(email) = ?`,
      args: [tokenData.email.toLowerCase()]
    })
    if (userResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Usuario no encontrado o inactivo.' })
      return
    }
    const userId = userResult.rows[0].id

    const passwordHash = await bcrypt.hash(password, 10)

    await db.execute({
      sql: `UPDATE users SET password_hash = ?, activo = 1, actualizado_en = ? WHERE id = ?`,
      args: [passwordHash, new Date().toISOString(), userId],
    })

    await db.execute({
      sql: `UPDATE tokens_accion SET usado = 1 WHERE token = ?`,
      args: [tokenHash]
    })

    res.status(200).json({
      success: true,
      message: 'Contraseña actualizada correctamente. Ya puedes iniciar sesión.',
      email: tokenData.email
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

    const result = await db.execute({
      sql: `SELECT email, fecha_expiracion FROM tokens_accion WHERE token = ? AND tipo = 'reset_password' AND usado = 0`,
      args: [tokenHash],
    })

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Token inválido, expirado o ya utilizado' })
      return
    }

    const tokenData = result.rows[0] as any
    if (new Date(tokenData.fecha_expiracion) < new Date()) {
      res.status(400).json({ success: false, message: 'El enlace ha expirado. Contacta al administrador.' })
      return
    }

    const userResult = await db.execute({
      sql: `SELECT id FROM users WHERE LOWER(email) = ?`,
      args: [tokenData.email.toLowerCase()]
    })
    if (userResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Usuario no encontrado' })
      return
    }
    const userId = userResult.rows[0].id

    const passwordHash = await bcrypt.hash(password, 10)

    // Actualizar contraseña y limpiar token
    await db.execute({
      sql: `UPDATE users 
            SET password_hash = ?, activo = 1, actualizado_en = ?
            WHERE id = ?`,
      args: [passwordHash, new Date().toISOString(), userId],
    })

    await db.execute({
      sql: `UPDATE tokens_accion SET usado = 1 WHERE token = ?`,
      args: [tokenHash]
    })

    res.status(200).json({
      success: true,
      message: 'Contraseña establecida exitosamente. Ya puedes iniciar sesión.',
      email: tokenData.email
    })
  } catch (error) {
    console.error('Error en setupInitialPassword:', error)
    res.status(500).json({ success: false, message: 'Error interno del servidor' })
  }
}

export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const refreshToken = getCookie(req, 'refresh_token');
    if (refreshToken) {
      const tokenHash = sha256(refreshToken);
      await db.execute({
        sql: `DELETE FROM user_refresh_tokens WHERE token_hash = ?`,
        args: [tokenHash]
      });
    }
  } catch (err) {
    console.error('Error invalidando refresh token en logout:', err);
  } finally {
    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/'
    });
    res.status(200).json({ success: true, message: 'Sesión cerrada' });
  }
}

/**
 * POST /api/auth/refresh
 * Recibe el refresh token por cookie, lo valida, rota el refresh token y devuelve un nuevo access token.
 */
export const refresh = async (req: Request, res: Response): Promise<void> => {
  try {
    const refreshToken = getCookie(req, 'refresh_token');
    
    if (!refreshToken) {
      res.status(401).json({ success: false, message: 'Refresh token requerido' });
      return;
    }
    
    const tokenHash = sha256(refreshToken);
    
    // Buscar el token en la base de datos
    const resultToken = await db.execute({
      sql: `SELECT id_user, expira_en FROM user_refresh_tokens WHERE token_hash = ?`,
      args: [tokenHash]
    });
    
    if (resultToken.rows.length === 0) {
      res.status(401).json({ success: false, message: 'Token inválido o expirado' });
      return;
    }
    
    const session = resultToken.rows[0] as any;
    
    // Verificar si el token ha expirado
    if (new Date(session.expira_en) < new Date()) {
      await db.execute({
        sql: `DELETE FROM user_refresh_tokens WHERE token_hash = ?`,
        args: [tokenHash]
      });
      res.clearCookie('refresh_token', {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/'
      });
      res.status(401).json({ success: false, message: 'Token de sesión expirado' });
      return;
    }
    
    // Buscar al usuario asociado
    const resultUser = await db.execute({
      sql: `SELECT id, email, roles, activo FROM users WHERE id = ?`,
      args: [session.id_user]
    });
    
    const user = resultUser.rows[0];
    
    if (!user) {
      res.status(401).json({ success: false, message: 'Usuario no encontrado' });
      return;
    }
    
    if (!user.activo) {
      res.status(403).json({ success: false, message: 'Cuenta desactivada. Contacta al administrador.' });
      return;
    }
    
    // Eliminar el refresh token viejo (Rotación de Refresh Tokens)
    await db.execute({
      sql: `DELETE FROM user_refresh_tokens WHERE token_hash = ?`,
      args: [tokenHash]
    });
    
    // Crear una nueva sesión y refresh token
    const { token: newRefreshToken } = await createRefreshTokenSession(user.id as number);
    
    // Establecer la nueva cookie
    res.cookie('refresh_token', newRefreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/'
    });
    
    // Generar nuevo Access Token (30 minutos)
    const roles = parseRoles(user.roles);
    const rolPrimary: UserRole = roles.includes('super_admin')
      ? 'super_admin'
      : roles.includes('admin')
        ? 'admin'
        : roles.includes('asistente') || roles.includes('administrativo')
          ? 'asistente'
          : roles.includes('estudiante')
            ? 'estudiante'
            : 'afiliado';
        
    const payload: JwtPayload = {
      id: user.id as number,
      email: user.email as string,
      rol: rolPrimary,
      roles
    };
    
    const newAccessToken = jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: '30m'
    });
    
    const enrichedUser = await enrichUserPayload({ ...payload });
    
    res.status(200).json({
      success: true,
      token: newAccessToken,
      user: enrichedUser
    });
  } catch (error) {
    console.error('Error en refresh:', error);
    res.status(500).json({ success: false, message: 'Error al refrescar sesión' });
  }
};
