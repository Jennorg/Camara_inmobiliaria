import { Request, Response } from 'express'
import { randomUUID } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { env } from '../config/env.js'

function requireSupabaseConfig() {
  const missing: string[] = []
  if (!env.SUPABASE_URL) missing.push('SUPABASE_URL')
  if (!env.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY')
  if (!env.SUPABASE_STORAGE_PUBLIC_BUCKET) missing.push('SUPABASE_STORAGE_PUBLIC_BUCKET')
  return missing
}

function sanitizeFilename(name: string, isUppercase = false): string {
  let clean = name.trim();
  if (isUppercase) {
    clean = clean.toUpperCase();
  }
  return clean
    .replace(/[/\\\\]/g, '-')         // no paths
    .replace(/[^\w.\-() ]+/g, '')     // keep it simple
    .replace(/\s+/g, '_')
    .slice(0, 80)
}

function buildKey(folder: string, filename: string) {
  const safeFolder = folder.trim().replace(/^\/+|\/+$/g, '').replace(/[^\w\-\/]/g, '')
  const isNormativas = safeFolder.toLowerCase() === 'normativas'
  const safeName = sanitizeFilename(filename || 'documento', isNormativas)
  const id = randomUUID()
  return `${safeFolder}/${id}-${safeName}`
}

function getSupabaseAdmin() {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function normalizeSignedUploadUrl(rawSignedUrl: string, baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, '')
  const candidate = rawSignedUrl.trim()
  if (/^https?:\/\//i.test(candidate)) return candidate
  if (/^https?:\/\//i.test(candidate.replace(/^https?:\/\//i, ''))) return candidate
  if (candidate.startsWith('/')) return `${base}${candidate}`
  if (/^https\/\//i.test(candidate)) return candidate.replace(/^https\/\//i, 'https://')
  if (/^http\/\//i.test(candidate)) return candidate.replace(/^http\/\//i, 'http://')
  return `${base}/${candidate.replace(/^\/+/, '')}`
}

/**
 * POST /api/cms/uploads/presign
 * Body: { filename: string, contentType?: string, folder?: string }
 * Returns: { uploadUrl, publicUrl, key }
 */
export const presignUpload = async (req: Request, res: Response) => {
  try {
    const missing = requireSupabaseConfig()
    if (missing.length) {
      return res.status(500).json({
        success: false,
        message: `Faltan variables de Supabase para presign: ${missing.join(', ')}`,
      })
    }

    const { filename, folder, bucket } = req.body as Record<string, unknown>
    const file = typeof filename === 'string' ? filename.trim() : ''
    if (!file) return res.status(400).json({ success: false, message: 'filename es requerido' })

    const baseFolder = typeof folder === 'string' && folder.trim() ? folder.trim() : 'uploads'
    const bucketName =
      typeof bucket === 'string' && bucket.trim()
        ? bucket.trim()
        : (env.SUPABASE_STORAGE_PUBLIC_BUCKET as string)

    const path = buildKey(baseFolder, file)
    const supabase = getSupabaseAdmin()
    if (!supabase) return res.status(500).json({ success: false, message: 'Supabase no está configurado correctamente' })

    const { data, error } = await supabase.storage.from(bucketName).createSignedUploadUrl(path)
    if (error || !data) {
      return res.status(500).json({ success: false, message: error?.message || 'No se pudo generar URL firmada de subida' })
    }

    const base = env.SUPABASE_URL!.replace(/\/$/, '')
    const signedUploadUrl = normalizeSignedUploadUrl(data.signedUrl, base)
    const publicUrl = `${base}/storage/v1/object/public/${bucketName}/${path}`

    return res.json({
      success: true,
      data: {
        signedUploadUrl,
        token: data.token,
        path,
        bucket: bucketName,
        publicUrl,
      },
    })
  } catch (error) {
    console.error('presignUpload:', error)
    return res.status(500).json({ success: false, message: 'Error al generar URL firmada' })
  }
}

