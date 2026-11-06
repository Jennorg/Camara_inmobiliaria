import { Router } from 'express'
import { requireAuth, requirePermiso } from '../middlewares/auth.middleware.js'
import * as c from '../controllers/asambleas.controller.js'

const router = Router()
router.use(requireAuth)

router.get('/', requirePermiso('asambleas', 'ver'), c.listar)
router.post('/', requirePermiso('asambleas', 'crear'), c.crear)
router.get('/afiliados', requirePermiso('asambleas', 'ver'), c.buscarAfiliados)
router.get('/miembros', requirePermiso('asambleas', 'ver'), c.miembros)
router.get('/:id', requirePermiso('asambleas', 'ver'), c.obtener)
router.put('/:id', requirePermiso('asambleas', 'editar'), c.actualizar)
router.delete('/:id', requirePermiso('asambleas', 'eliminar'), c.eliminar)
// Registrar y quitar asistencia modifican una asamblea existente: «editar» explícito
router.post('/:id/asistencia', requirePermiso('asambleas', 'editar'), c.registrarAsistencia)
router.delete('/:id/asistencia/:idAfiliado', requirePermiso('asambleas', 'editar'), c.quitarAsistencia)

export default router
