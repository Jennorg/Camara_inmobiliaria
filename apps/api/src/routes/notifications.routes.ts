import { Router } from 'express'
import { requireAuth } from '../middlewares/auth.middleware.js'
import { NotificationService } from '../services/notification.service.js'

const router = Router()

/**
 * GET /api/notifications
 * Obtiene las notificaciones del usuario autenticado.
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      res.status(401).json({ success: false, message: 'No autorizado' })
      return
    }

    const limit = parseInt(req.query.limit as string) || 20
    const offset = parseInt(req.query.offset as string) || 0

    const notifications = await NotificationService.getUserNotifications(userId, limit, offset)
    const unreadCount = await NotificationService.getUnreadCount(userId)
    res.json({ success: true, data: notifications, unreadCount })
  } catch (error) {
    console.error('GET /notifications:', error)
    res.status(500).json({ success: false, message: 'Error al obtener notificaciones' })
  }
})

/**
 * PATCH /api/notifications/:id/read
 * Marca una notificación específica como leída.
 */
router.patch('/:id/read', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id
    const notificationId = parseInt(req.params.id as string)

    if (!userId || !notificationId) {
      res.status(400).json({ success: false, message: 'Faltan parámetros' })
      return
    }

    await NotificationService.markAsRead(notificationId, userId)
    res.json({ success: true, message: 'Notificación marcada como leída' })
  } catch (error) {
    console.error('PATCH /notifications/:id/read:', error)
    res.status(500).json({ success: false, message: 'Error al actualizar notificación' })
  }
})

/**
 * PATCH /api/notifications/read-all
 * Marca todas las notificaciones del usuario como leídas.
 */
router.patch('/read-all', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      res.status(401).json({ success: false, message: 'No autorizado' })
      return
    }

    await NotificationService.markAllAsRead(userId)
    res.json({ success: true, message: 'Todas las notificaciones marcadas como leídas' })
  } catch (error) {
    console.error('PATCH /notifications/read-all:', error)
    res.status(500).json({ success: false, message: 'Error al actualizar notificaciones' })
  }
})

export default router
