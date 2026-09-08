import { Router } from 'express'
import { presignUpload } from '../controllers/uploads.controller.js'
import { requireAuth, requireRole } from '../middlewares/auth.middleware.js'

const router = Router()

// Permitir a usuarios autenticados generar URLs firmadas de subida.
router.post('/presign', requireAuth, presignUpload)

export { router as uploadsRoutes }

