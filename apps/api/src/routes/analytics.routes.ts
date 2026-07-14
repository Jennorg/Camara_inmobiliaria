import { Router } from 'express'
import { getAnalyticsData } from '../controllers/analytics.controller.js'
import { requireAuth } from '../middlewares/auth.middleware.js'

const router = Router()

router.get('/', requireAuth, getAnalyticsData)

export { router as analyticsRoutes }
