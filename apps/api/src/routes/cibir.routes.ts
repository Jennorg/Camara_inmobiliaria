import { Router } from 'express'
import { requireAuth, requireRole } from '../middlewares/auth.middleware.js'
import {
  listEdiciones,
  createEdicion,
  getEdicion,
  updateEdicion,
  cambiarEstadoEdicion,
  deleteEdicion,
  listInscritos,
  aprobarRechazarInscrito,
  asignarAfiliados,
  cancelarInscrito,
  listPendientesSinEdicion
} from '../controllers/cibir.controller.js'

const router = Router()

// Proteger todas las rutas bajo autenticación administrativa
router.use(requireAuth)
router.use(requireRole('admin', 'super_admin', 'asistente', 'administrativo'))

// Ediciones CIBIR
router.get('/ediciones', listEdiciones)
router.post('/ediciones', createEdicion)
router.get('/ediciones/:id', getEdicion)
router.patch('/ediciones/:id', updateEdicion)
router.patch('/ediciones/:id/estado', cambiarEstadoEdicion)
router.delete('/ediciones/:id', deleteEdicion)

// Participantes en edición
router.get('/ediciones/:id/inscritos', listInscritos)
router.post('/ediciones/:id/asignar', asignarAfiliados)
router.patch('/ediciones/:id/inscritos/:idAfiliado', aprobarRechazarInscrito)
router.delete('/ediciones/:id/inscritos/:idAfiliado', cancelarInscrito)

// Afiliados en 5_CIBIR pendientes de edición
router.get('/pendientes', listPendientesSinEdicion)

export { router as cibirRoutes }
