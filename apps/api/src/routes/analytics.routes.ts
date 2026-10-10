import { Router } from 'express'
import { getAnalyticsData, getEmbudoAnalytics } from '../controllers/analytics.controller.js'
import { requireAuth } from '../middlewares/auth.middleware.js'

const router = Router()

router.get('/', requireAuth, getAnalyticsData)
router.get('/embudo', requireAuth, getEmbudoAnalytics)

export { router as analyticsRoutes }
