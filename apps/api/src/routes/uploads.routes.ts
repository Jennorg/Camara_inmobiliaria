import { Router } from 'express'
import { presignUpload, directUpload } from '../controllers/uploads.controller.js'
import { requireAuth, requireRole } from '../middlewares/auth.middleware.js'

const router = Router()

// Permitir a usuarios autenticados generar URLs firmadas o subir directamente a Storage.
router.post('/presign', requireAuth, presignUpload)
router.post('/direct', requireAuth, directUpload)

export { router as uploadsRoutes }

