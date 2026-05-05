import { Router } from 'express'
import { login, getMe, logout, forgotPassword, setupInitialPassword, resetPasswordWithToken } from '../controllers/auth.controller.js'
import { requireAuth, enrichUser } from '../middlewares/auth.middleware.js'

const router = Router()

// POST /api/auth/login — público
router.post('/login', login)

// GET /api/auth/me — protegido
router.get('/me', requireAuth, enrichUser, getMe)

// POST /api/auth/logout — público (limpia en cliente)
router.post('/logout', logout)

// POST /api/auth/forgot-password — público
router.post('/forgot-password', forgotPassword)

// POST /api/auth/setup-initial-password — público
router.post('/setup-initial-password', setupInitialPassword)

// POST /api/auth/reset-password — público
router.post('/reset-password', resetPasswordWithToken)

export { router as authRoutes }
