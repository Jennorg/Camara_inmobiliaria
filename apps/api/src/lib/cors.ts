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
    const baseDomain = appHost.split('.').slice(-2).join('.')
    if (originHost.endsWith('.' + baseDomain) || originHost === baseDomain) {
      return true
    }
  } catch {
    /* ignore */
  }

  // ── Vercel previews ────────────────────────────────────────────
  // Si la API está en Vercel, cualquier frontend *.vercel.app se permite
  // automáticamente (previews de deploy, PRs, etc.) sin necesidad de
  // configurar CORS_ORIGINS manualmente.
  const vercelPreview = /^https:\/\/[\w.-]+\.vercel\.app$/i.test(normalized)
  if (vercelPreview) {
    if (env.CORS_ORIGINS.some(o => o.includes('.vercel.app'))) {
      return true
    }
    if (process.env.VERCEL === '1') {
      return true
    }
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
  const isPublicRoute = req.path.startsWith('/api/public')
  let allowed = false
  if (isPublicRoute) {
    allowed = true
  } else if (!origin) {
    allowed = true // server-to-server, curl, etc.
  } else if (env.NODE_ENV !== 'production') {
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
  // Evita respuestas cacheadas sin ACAO (p. ej. visita directa en pestaña sin Origin).
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
  res.setHeader('Vary', 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers')

  if (isPublicRoute) {
    // Si el navegador envía un Origin (siempre lo hace con credentials), respondemos
    // con ese origen concreto para que sea compatible con `credentials: 'include'`.
    // El comodín `*` está prohibido cuando se envían credenciales (cookie/auth header).
    const publicOrigin = origin ?? '*'
    res.setHeader('Access-Control-Allow-Origin', publicOrigin)
    if (origin) {
      // Solo necesario cuando hay un Origin real (peticiones del navegador)
      res.setHeader('Access-Control-Allow-Credentials', 'true')
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Requested-With, Accept'
    )
  } else if (allowed && origin) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  }

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
