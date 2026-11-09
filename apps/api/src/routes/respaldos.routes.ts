import express, { Router } from 'express'
import { requireAuth } from '../middlewares/auth.middleware.js'
import * as c from '../controllers/respaldos.controller.js'

const router = Router()
// El archivo viaja como cuerpo binario. Vercel limita el cuerpo de una petición a ~4,5 MB (un respaldo comprimido pesa mucho menos).
const archivo = express.raw({ type: () => true, limit: '25mb' })

router.use(requireAuth, c.soloSuperAdmin)

router.get('/', c.estado)
router.post('/generar', c.generar)
router.post('/validar', archivo, c.validar)
router.post('/restaurar', archivo, c.restaurarArchivo)
router.get('/:id/descargar', c.descargar)
router.post('/:id/restaurar', c.restaurarGuardado)
router.delete('/:id', c.eliminar)

export default router
