import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { db } from '../lib/db.js'

export type UserRole = 'admin' | 'afiliado' | 'super_admin' | 'estudiante' | 'asistente' | 'administrativo' | 'secretario' | 'secretaria' | 'personal' | 'personal_admin' | 'personal_administrativo'

export interface JwtPayload {
  id: number
  email: string
  roles: UserRole[]
  rol: UserRole
  
  // Estos campos se pueblan en runtime a través del middleware enrichUser
  id_persona?: number
  id_empresa?: number
  id_afiliado?: number
  id_estudiante?: number
  codigo?: string
  nombre_completo?: string
  cedula?: string
  telefono?: string
  tipo_afiliado?: string
  impersonatedBy?: number
}

// Extend Express Request to include the decoded user
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload
    }
  }
}

/**
 * Middleware que verifica el JWT en el header Authorization.
 * Si es válido, inyecta `req.user` con el payload decodificado.
 */
export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Token de acceso requerido' })
    return
  }

  const token = authHeader.split(' ')[1]

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload
    // Retrocompatibilidad: si el token viejo no tiene `roles`, lo generamos del `rol`
    if (!payload.roles) {
      payload.roles = [payload.rol]
    }
    req.user = payload
    next()
  } catch (err) {
    res.status(401).json({ success: false, message: 'Token inválido o expirado' })
  }
}

/**
 * Helpers para enriquecer un usuario (reutilizable en login y middleware)
 */
export const enrichUserPayload = async (user: JwtPayload): Promise<JwtPayload> => {
  try {
    const userId = user.id

    // 1. Intentar buscar en afiliados
    const resultAfiliado = await db.execute({
      sql: `SELECT a.id_afiliado, a.id_persona, a.id_empresa, a.codigo, a.tipo_afiliado,
                   COALESCE(p.nombres, '') || ' ' || COALESCE(p.apellidos, '') as persona_nombre,
                   p.cedula, p.telefono,
                   e.razon_social as empresa_nombre
            FROM afiliados a
            LEFT JOIN personas p ON a.id_persona = p.id
            LEFT JOIN empresas e ON a.id_empresa = e.id_empresa
            WHERE a.id_user = ?`,
      args: [userId]
    })

    if (resultAfiliado.rows.length > 0) {
      const afi = resultAfiliado.rows[0]
      user.id_afiliado = afi.id_afiliado as number
      user.id_persona = afi.id_persona as number
      user.id_empresa = afi.id_empresa as number
      user.codigo = afi.codigo as string
      user.cedula = afi.cedula as string
      user.telefono = afi.telefono as string
      user.tipo_afiliado = afi.tipo_afiliado as string
      user.nombre_completo = (afi.persona_nombre || afi.empresa_nombre) as string

      // Si es de tipo Corporativo y id_empresa no está asignado en afiliados, buscar la empresa que representa
      if (user.tipo_afiliado === 'Corporativo' && !user.id_empresa) {
        try {
          const empRes = await db.execute({
            sql: `SELECT id_empresa, razon_social FROM empresas WHERE (id_representante_legal = ? OR id_user = ?) AND eliminado_en IS NULL LIMIT 1`,
            args: [user.id_afiliado, userId]
          });
          if (empRes.rows.length > 0) {
            user.id_empresa = Number(empRes.rows[0].id_empresa);
            if (empRes.rows[0].razon_social) {
              user.nombre_completo = empRes.rows[0].razon_social as string;
            }
          }
        } catch (e) {
          console.error('Error enriqueciendo empresa de afiliado corporativo:', e);
        }
      }

      return user
    }

    // 2. Si no es afiliado, tal vez es estudiante sin ser afiliado
    const resultEstudiante = await db.execute({
      sql: `SELECT e.id_estudiante, e.id_persona, e.id_empresa,
                   COALESCE(p.nombres, '') || ' ' || COALESCE(p.apellidos, '') as persona_nombre,
                   p.cedula, p.telefono,
                   emp.razon_social as empresa_nombre
            FROM estudiantes e
            LEFT JOIN personas p ON e.id_persona = p.id
            LEFT JOIN empresas emp ON e.id_empresa = emp.id_empresa
            WHERE e.id_user = ?`,
      args: [userId]
    })

    if (resultEstudiante.rows.length > 0) {
      const est = resultEstudiante.rows[0]
      user.id_estudiante = est.id_estudiante as number
      user.id_persona = est.id_persona as number
      user.id_empresa = est.id_empresa as number
      user.cedula = est.cedula as string
      user.telefono = est.telefono as string
      user.nombre_completo = (est.persona_nombre || est.empresa_nombre) as string
      return user
    }

    // 3. Fallbacks
    const resultPersona = await db.execute({
      sql: `SELECT id, COALESCE(nombres, '') || ' ' || COALESCE(apellidos, '') as nombre_completo FROM personas WHERE email = ?`,
      args: [user.email]
    })
    
    if (resultPersona.rows.length > 0) {
      user.id_persona = resultPersona.rows[0].id as number
      user.nombre_completo = resultPersona.rows[0].nombre_completo as string
    } else {
      const resultEmpresa = await db.execute({
        sql: `SELECT id_empresa, razon_social FROM empresas WHERE id_user = ? OR email = ?`,
        args: [userId, user.email]
      })
      if (resultEmpresa.rows.length > 0) {
        user.id_empresa = resultEmpresa.rows[0].id_empresa as number
        user.nombre_completo = resultEmpresa.rows[0].razon_social as string
      }
    }

    return user
  } catch (err) {
    console.error('Error en enrichUserPayload:', err)
    return user
  }
}

/**
 * Middleware que enriquece el request con las relaciones del usuario en base de datos.
 * Busca si el usuario tiene un perfil en afiliados, estudiantes, personas o empresas.
 * Requiere que requireAuth se haya ejecutado antes.
 */
export const enrichUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  if (!req.user) {
    next()
    return
  }
  
  req.user = await enrichUserPayload(req.user)
  next()
}


/**
 * Middleware de autorización por rol.
 * Usa el array `roles` del JWT.
 * super_admin y admin tienen herencia sobre asistente.
 */
export const requireRole = (...allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'No autenticado' })
      return
    }

    const userRoles = req.user.roles ?? [req.user.rol]

    const staffRoles: UserRole[] = ['asistente', 'administrativo', 'secretario', 'secretaria', 'personal', 'personal_admin', 'personal_administrativo']

    // Construir lista efectiva de roles permitidos según jerarquía
    const effectiveAllowed = [...allowedRoles]
    if (allowedRoles.includes('admin') && !effectiveAllowed.includes('super_admin')) {
      effectiveAllowed.push('super_admin')
    }
    
    if (allowedRoles.some(r => staffRoles.includes(r))) {
      for (const r of staffRoles) {
        if (!effectiveAllowed.includes(r)) effectiveAllowed.push(r)
      }
      if (!effectiveAllowed.includes('admin')) effectiveAllowed.push('admin')
      if (!effectiveAllowed.includes('super_admin')) effectiveAllowed.push('super_admin')
    }

    const hasAccess = userRoles.some(r => effectiveAllowed.includes(r))

    if (!hasAccess) {
      res.status(403).json({ success: false, message: 'Acceso denegado: permisos insuficientes' })
      return
    }
    next()
  }
}

/** Helpers de conveniencia */
export const hasRole = (user: JwtPayload, role: UserRole): boolean => {
  const roles = user.roles ?? [user.rol]
  return roles.includes(role)
}

export const isSuperAdmin = (user: JwtPayload): boolean => hasRole(user, 'super_admin')
export const isAdmin      = (user: JwtPayload): boolean => hasRole(user, 'admin') || hasRole(user, 'super_admin')
export const isAsistente  = (user: JwtPayload): boolean => 
  hasRole(user, 'asistente') || 
  hasRole(user, 'administrativo') || 
  hasRole(user, 'secretario') || 
  hasRole(user, 'secretaria') || 
  hasRole(user, 'personal') || 
  hasRole(user, 'personal_admin') || 
  hasRole(user, 'personal_administrativo')
export const isStaff      = (user: JwtPayload): boolean => isAdmin(user) || isAsistente(user)
export const isAfiliado   = (user: JwtPayload): boolean => hasRole(user, 'afiliado')
