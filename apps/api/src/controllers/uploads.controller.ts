import { Request, Response } from 'express'
import { randomUUID } from 'crypto'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { env } from '../config/env.js'

function getS3Client() {
  const keyId = env.KEY_ID || process.env.KEY_ID
  const secretAccessKey = env.APPLICATION_KEY || process.env.APPLICATION_KEY
  const endpoint = env.B2_ENDPOINT || 'https://s3.us-east-005.backblazeb2.com'
  const region = env.B2_REGION || 'us-east-005'

  if (!keyId || !secretAccessKey) return null

  return new S3Client({
    endpoint,
    region,
    credentials: {
      accessKeyId: keyId,
      secretAccessKey,
    },
  })
}

function sanitizeFilename(name: string, isUppercase = false): string {
  let clean = name.trim()
  if (isUppercase) {
    clean = clean.toUpperCase()
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

  // Mantener la estructura 'public-docs/folder/uuid-filename'
  if (safeFolder.startsWith('public-docs')) {
    return `${safeFolder}/${id}-${safeName}`
  }
  return `public-docs/${safeFolder}/${id}-${safeName}`
}

/**
 * POST /api/cms/uploads/presign (o /api/public/uploads/presign)
 * Body: { filename: string, contentType?: string, folder?: string }
 * Returns: { signedUploadUrl, path, bucket, publicUrl }
 */
export const presignUpload = async (req: Request, res: Response) => {
  try {
    const s3 = getS3Client()
    if (!s3) {
      return res.status(500).json({
        success: false,
        message: 'Faltan credenciales de Backblaze B2 (KEY_ID, APPLICATION_KEY)',
      })
    }

    const { filename, folder, contentType } = req.body as Record<string, unknown>
    const file = typeof filename === 'string' ? filename.trim() : ''
    if (!file) return res.status(400).json({ success: false, message: 'filename es requerido' })

    const baseFolder = typeof folder === 'string' && folder.trim() ? folder.trim() : 'uploads'
    const bucketName = env.BUCKET_NAME || 'files-supa'
    const mimeType = typeof contentType === 'string' && contentType.trim() ? contentType.trim() : 'application/octet-stream'

    const path = buildKey(baseFolder, file)

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: path,
      ContentType: mimeType,
    })

    const signedUploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 })
    const baseUrl = (env.B2_PUBLIC_URL_BASE || 'https://files-supa.s3.us-east-005.backblazeb2.com/').replace(/\/$/, '')
    const publicUrl = `${baseUrl}/${path}`

    return res.json({
      success: true,
      data: {
        signedUploadUrl,
        path,
        bucket: bucketName,
        publicUrl,
      },
    })
  } catch (error: any) {
    console.error('presignUpload error:', error)
    return res.status(500).json({ success: false, message: error?.message || 'Error al generar URL firmada de Backblaze B2' })
  }
}

/**
 * POST /api/cms/uploads/direct (o /api/public/uploads/direct)
 * Body: { filename: string, contentType?: string, folder?: string, fileData: string (base64) }
 * Returns: { success: true, data: { path, bucket, publicUrl } }
 */
export const directUpload = async (req: Request, res: Response) => {
  try {
    const s3 = getS3Client()
    if (!s3) {
      return res.status(500).json({
        success: false,
        message: 'Faltan credenciales de Backblaze B2 (KEY_ID, APPLICATION_KEY)',
      })
    }

    const { filename, folder, contentType, fileData } = req.body as Record<string, unknown>
    const file = typeof filename === 'string' ? filename.trim() : ''
    const base64Content = typeof fileData === 'string' ? fileData : ''

    if (!file || !base64Content) {
      return res.status(400).json({ success: false, message: 'filename y fileData son requeridos' })
    }

    const baseFolder = typeof folder === 'string' && folder.trim() ? folder.trim() : 'uploads'
    const bucketName = env.BUCKET_NAME || 'files-supa'
    const mimeType = typeof contentType === 'string' && contentType.trim() ? contentType.trim() : 'application/octet-stream'

    const path = buildKey(baseFolder, file)

    const cleanBase64 = base64Content.replace(/^data:[^;]+;base64,/, '')
    const buffer = Buffer.from(cleanBase64, 'base64')

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: path,
      Body: buffer,
      ContentType: mimeType,
    })

    await s3.send(command)

    const baseUrl = (env.B2_PUBLIC_URL_BASE || 'https://files-supa.s3.us-east-005.backblazeb2.com/').replace(/\/$/, '')
    const publicUrl = `${baseUrl}/${path}`

    return res.json({
      success: true,
      data: {
        path,
        bucket: bucketName,
        publicUrl,
      },
    })
  } catch (error: any) {
    console.error('directUpload error:', error)
    return res.status(500).json({ success: false, message: error?.message || 'Error al subir archivo directamente a Storage' })
  }
}
