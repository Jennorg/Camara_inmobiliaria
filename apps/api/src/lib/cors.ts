import { env } from '../config/env.js'

/** Normaliza URL de origin (sin barra final). */
export const normalizeOrigin = (url: string): string => url.replace(/\/$/, '')

const CORPORATIVO_TIPOS = new Set(['Corporativo', 'Agente Corporativo'])

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
