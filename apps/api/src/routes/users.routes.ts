import { Router } from 'express'
import { getUsers, createUser, updateUser, resetUserPassword, sendUserInvitation, deleteUser, impersonateUser } from '../controllers/users.controller.js'
import { requireAuth, requireRole } from '../middlewares/auth.middleware.js'

const router = Router()

// Las rutas de usuarios requieren autenticación y rol administrativo (admin, super_admin, asistente)
router.use(requireAuth, requireRole('admin', 'super_admin', 'asistente', 'administrativo'))

// GET /api/users — listar usuarios
router.get('/', getUsers)

// POST /api/users — crear usuario
router.post('/', createUser)

// PATCH /api/users/:id — actualizar usuario
router.patch('/:id', updateUser)

// POST /api/users/:id/reset — reset de contraseña
router.post('/:id/reset', resetUserPassword)

// POST /api/users/:id/invite — enviar correo de invitación
router.post('/:id/invite', sendUserInvitation)

// POST /api/users/:id/impersonate — suplantar sesión (solo admin y super_admin)
router.post('/:id/impersonate', requireRole('admin', 'super_admin'), impersonateUser)

// DELETE /api/users/:id — eliminar usuario (solo admin y super_admin)
router.delete('/:id', requireRole('admin', 'super_admin'), deleteUser)

export { router as usersRoutes }
