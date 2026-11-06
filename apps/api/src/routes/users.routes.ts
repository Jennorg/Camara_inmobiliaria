import { Router } from 'express'
import { getUsers, createUser, updateUser, resetUserPassword, sendUserInvitation, deleteUser, impersonateUser } from '../controllers/users.controller.js'
import { requireAuth, requireRole, requirePermiso } from '../middlewares/auth.middleware.js'

const router = Router()

router.use(requireAuth)

// GET /api/users — listar usuarios
router.get('/', requirePermiso('users', 'ver'), getUsers)

// POST /api/users — crear usuario
router.post('/', requirePermiso('users', 'crear'), createUser)

// PATCH /api/users/:id — actualizar usuario
router.patch('/:id', requirePermiso('users', 'editar'), updateUser)

// POST /api/users/:id/reset — reset de contraseña
// Reset e invitación actúan sobre un usuario existente: «editar»
router.post('/:id/reset', requirePermiso('users', 'editar'), resetUserPassword)

// POST /api/users/:id/invite — enviar correo de invitación
router.post('/:id/invite', requirePermiso('users', 'editar'), sendUserInvitation)

// POST /api/users/:id/impersonate — suplantar sesión. Sigue restringido a admin y super_admin: no es una casilla de la matriz.
router.post('/:id/impersonate', requireRole('admin', 'super_admin'), impersonateUser)

// DELETE /api/users/:id — eliminar usuario
router.delete('/:id', requirePermiso('users', 'eliminar'), deleteUser)

export { router as usersRoutes }
