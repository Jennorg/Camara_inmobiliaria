import { Router } from 'express'
import { requireAuth, requirePermiso } from '../middlewares/auth.middleware.js'
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

// CIBIR se administra desde Formación. Los DELETE (bajas lógicas) los podía hacer todo el staff y «eliminar» de formación
// es solo admin, así que se exigen como «editar» para no quitarle ese acceso al staff.
router.use(requireAuth)
const F = requirePermiso('formacion')
const FE = requirePermiso('formacion', 'editar')

// Ediciones CIBIR
router.get('/ediciones', F, listEdiciones)
router.post('/ediciones', F, createEdicion)
router.get('/ediciones/:id', F, getEdicion)
router.patch('/ediciones/:id', F, updateEdicion)
router.patch('/ediciones/:id/estado', F, cambiarEstadoEdicion)
router.delete('/ediciones/:id', FE, deleteEdicion)

// Participantes en edición
router.get('/ediciones/:id/inscritos', F, listInscritos)
router.post('/ediciones/:id/asignar', FE, asignarAfiliados)
router.patch('/ediciones/:id/inscritos/:idAfiliado', F, aprobarRechazarInscrito)
router.delete('/ediciones/:id/inscritos/:idAfiliado', FE, cancelarInscrito)

// Afiliados en 5_CIBIR pendientes de edición
router.get('/pendientes', F, listPendientesSinEdicion)

export { router as cibirRoutes }
