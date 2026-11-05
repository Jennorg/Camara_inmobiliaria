import { Router } from 'express'
import { requireAuth, requireRole, UserRole } from '../middlewares/auth.middleware.js'
import * as c from '../controllers/asambleas.controller.js'

const router = Router()
const adminRoles: UserRole[] = ['admin', 'super_admin', 'asistente', 'administrativo', 'secretario', 'secretaria', 'personal_admin']

router.use(requireAuth, requireRole(...adminRoles))

router.get('/', c.listar)
router.post('/', c.crear)
router.get('/afiliados', c.buscarAfiliados)
router.get('/miembros', c.miembros)
router.get('/:id', c.obtener)
router.put('/:id', c.actualizar)
router.delete('/:id', c.eliminar)
router.post('/:id/asistencia', c.registrarAsistencia)
router.delete('/:id/asistencia/:idAfiliado', c.quitarAsistencia)

export default router
