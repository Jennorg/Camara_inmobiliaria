import { Router } from 'express'
import { requireAuth } from '../middlewares/auth.middleware.js'
import * as c from '../controllers/roles.controller.js'

const router = Router()

router.use(requireAuth, c.soloSuperAdmin)

router.get('/secciones', c.secciones)
router.get('/', c.listar)
router.post('/', c.crear)
router.post('/staff', c.crearStaff)
router.put('/usuarios/:idUser', c.asignar)
router.put('/:id', c.actualizar)
router.delete('/:id', c.eliminar)

export default router
