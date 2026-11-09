import type { NextFunction, Request, Response } from 'express'
import { isSuperAdmin } from './auth.middleware.js'

/** Solo el súper administrador. Una sesión suplantada nunca pasa, aunque el JWT diga super_admin. */
export const soloSuperAdmin = (recurso: string) => (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || !isSuperAdmin(req.user) || req.user.impersonatedBy) {
    res.status(403).json({ success: false, message: `Acceso denegado: solo el súper administrador gestiona ${recurso}` })
    return
  }
  next()
}
