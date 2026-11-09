import { Router } from 'express'
import { requireAuth } from '../middlewares/auth.middleware.js'
import { soloSuperAdmin } from '../middlewares/superadmin.middleware.js'
import * as c from '../controllers/auditoria.controller.js'

const router = Router()
router.use(requireAuth)

// Por ahora todo, incluido «Modificado por», es solo del súper administrador
router.use(soloSuperAdmin('la auditoría'))
router.get('/', c.listar)
router.get('/ultimo', c.ultimo)
router.get('/filtros', c.filtros)
router.get('/papelera', c.papelera)
router.post('/papelera/:tipo/:id/restaurar', c.restaurar)
router.delete('/papelera/:tipo/:id', c.eliminarDefinitivo)

export default router
