import type { Request, Response, NextFunction } from 'express'
import { env } from '../config/env.js'

/** Normaliza URL de origin (sin barra final). */
export const normalizeOrigin = (url: string): string => url.replace(/\/$/, '')

/**
 * Comprueba si un Origin del navegador está permitido.
 * Soporta lista exacta, comodín `*` por segmento (ej. https://*.vercel.app)
 * y previews de Vercel cuando hay algún origin *.vercel.app configurado.
 */
export function isOriginAllowed(origin: string): boolean {
  const normalized = normalizeOrigin(origin)

  for (const entry of env.CORS_ORIGINS) {
    const allowed = normalizeOrigin(entry)
    if (allowed === normalized) return true
    if (allowed.includes('*')) {
      const re = new RegExp(
        '^' + allowed.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]+') + '$'
      )
      if (re.test(normalized)) return true
    }
  }

  try {
    const appOrigin = normalizeOrigin(env.APP_URL)
    if (normalized === appOrigin) return true
    const appHost = new URL(appOrigin).hostname
    const originHost = new URL(normalized).hostname
    if (originHost === appHost) return true
  } catch {
    /* ignore */
  }

  const vercelPreview = /^https:\/\/[\w.-]+\.vercel\.app$/i.test(normalized)
  if (vercelPreview && env.CORS_ORIGINS.some(o => o.includes('.vercel.app'))) {
    return true
  }

  return false
}

/**
 * Middleware CORS manual (no depende del paquete `cors` para evitar
 * problemas de compatibilidad con Express 5).
 *
 * - En desarrollo (`NODE_ENV !== 'production'`) permite todos los orígenes.
 * - En producción valida contra `isOriginAllowed()`.
 * - Las OPTIONS preflight se responden inmediatamente (204).
 */
export function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin

  // ── 1. Determinar si el origen está permitido ───────────────────────
  let allowed = false
  if (!origin) {
    allowed = true // server-to-server, curl, etc.
  } else if (env.NODE_ENV !== 'production') {
    console.log(`[CORS] Desarrollo — permitido: ${origin}`)
    allowed = true
  } else if (isOriginAllowed(origin)) {
    allowed = true
  } else {
    console.warn(
      `[CORS] 🚫 Bloqueado: ${origin}\n` +
      `       NODE_ENV: ${env.NODE_ENV}\n` +
      `       APP_URL:  ${env.APP_URL}\n` +
      `       Permitidos: [${env.CORS_ORIGINS.join(', ')}]`
    )
  }

  // ── 2. Setear cabeceras CORS en TODAS las respuestas ───────────────
  if (allowed && origin) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  // ── 3. Si es una preflight OPTIONS, responder ya ────────────────────
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  // ── 4. Bloquear si el origen no está permitido ─────────────────────
  if (!allowed) {
    res.status(403).json({ error: 'CORS: origin not allowed' })
    return
  }

  next()
}
