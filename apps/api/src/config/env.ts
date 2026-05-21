import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { z } from 'zod'

// Carga el .env desde apps/api/ sin importar desde dónde se ejecute el script
const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '../../.env') })

/**
 * Valida las variables de entorno al arrancar el servidor.
 * Exporta el objeto `env` con tipos correctos.
 */
const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  TURSO_DATABASE_URL: z.string().url(),
  TURSO_AUTH_TOKEN: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default('7d'),
  /**
   * APP_URL: URL pública del frontend (para links en correos).
   * En Vercel suele ser tu dominio `https://<app>.vercel.app`.
   */
  APP_URL: z.string().url().default('http://localhost:5173'),

  /**
   * CORS_ORIGINS / CORS_ORIGIN:
   * - `CORS_ORIGINS` puede ser una lista separada por comas.
   * - `CORS_ORIGIN` se mantiene por compatibilidad (un solo origin).
   *
   * Ej: "http://localhost:5173,https://mi-frontend.vercel.app"
   */
  CORS_ORIGINS: z.string().optional(),
  CORS_ORIGIN: z.string().optional(),
  RESEND_API_KEY: z.string().min(1),
  RESEND_FROM_EMAIL: z.string().email().default('info@camarainmobiliariadebolivar.com'),
  ADMIN_EMAIL: z.string().email().default('info@camarainmobiliariadebolivar.com'),

  // ── Supabase Storage ───────────────────────────────────────────────────────
  SUPABASE_URL: z.string().url().optional(),
  // Compatibilidad con nombre antiguo en .env
  SUPABASE_BASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  /** Bucket público para documentos del CMS (ej: public-docs). */
  SUPABASE_STORAGE_PUBLIC_BUCKET: z.string().optional(),
})

const parsed = envSchema.parse(process.env)

const corsRaw = parsed.CORS_ORIGINS ?? parsed.CORS_ORIGIN ?? parsed.APP_URL
const corsList = corsRaw
  .split(',')
  .map(s => s.trim().replace(/\/$/, ''))
  .filter(Boolean)

export const env = {
  ...parsed,
  SUPABASE_URL: parsed.SUPABASE_URL ?? parsed.SUPABASE_BASE_URL,
  CORS_ORIGINS: corsList,
}
