import { Router } from 'express';
import { registerAfiliado, getAfiliados, getAfiliadoById, getMisCertificados, getMisCursos, aprobarAfiliado, getSolicitudesCibir, rechazarAfiliado, verificarEmail, formalizarInscripcion, updateEstatusAfiliado, updateAfiliado, generarInvitacionCorporativa, listarInvitacionesCorporativas, revocarInvitacionCorporativa, listarAfiliadosCorporativos, registrarMiembroDirecto, deleteAfiliado, createAfiliado, convertirAgenteANatural, establecerAccesoPanel } from '../controllers/afiliados.controller.js';
import { requireAuth, requireRole } from '../middlewares/auth.middleware.js';

const router = Router();

// GET /api/afiliados
router.get('/', requireAuth, requireRole('admin', 'super_admin'), getAfiliados);

// POST /api/afiliados (Direct Creation)
router.post('/', requireAuth, requireRole('admin', 'super_admin'), createAfiliado);

// GET /api/afiliados/cibir/solicitudes
router.get('/cibir/solicitudes', requireAuth, requireRole('admin', 'super_admin'), getSolicitudesCibir);

// GET /api/afiliados/me/certificados — comprobantes digitales del usuario autenticado
router.get('/me/certificados', requireAuth, getMisCertificados);

// GET /api/afiliados/me/cursos — cursos inscritos y progreso de módulos
router.get('/me/cursos', requireAuth, getMisCursos);

// GET /api/afiliados/:id — para el portal del afiliado (requiere auth)
router.get('/:id', requireAuth, getAfiliadoById);

// POST /api/afiliados/registro
router.post('/registro', registerAfiliado);

// POST /api/afiliados/registro/verificar
router.post('/registro/verificar', verificarEmail);

// POST /api/afiliados/formalizar — Para que el afiliado pague su inscripción
router.post('/formalizar', requireAuth, formalizarInscripcion);

// PATCH /api/afiliados/:id/acceso-panel — Contraseña de acceso al panel (admin)
router.patch('/:id/acceso-panel', requireAuth, requireRole('admin', 'super_admin'), establecerAccesoPanel);

// PATCH /api/afiliados/:id — Actualización general del afiliado
router.patch('/:id', requireAuth, updateAfiliado);

// DELETE /api/afiliados/:id
router.delete('/:id', requireAuth, requireRole('admin', 'super_admin'), deleteAfiliado);

// PATCH /api/afiliados/:id/estatus — Actualización granular del proceso de 9 pasos
router.patch('/:id/estatus', requireAuth, requireRole('admin', 'super_admin'), updateEstatusAfiliado);

// PATCH /api/afiliados/:id/aprobar
router.patch('/:id/aprobar', requireAuth, requireRole('admin', 'super_admin'), aprobarAfiliado);

// PATCH /api/afiliados/:id/rechazar
router.patch('/:id/rechazar', requireAuth, requireRole('admin', 'super_admin'), rechazarAfiliado);

// ── Invitaciones Corporativas ──────────────────────────────────────────────────
// POST /api/afiliados/:id/invitacion — Genera link reutilizable (admin o afiliado corp)
router.post('/:id/invitacion', requireAuth, generarInvitacionCorporativa);

// GET /api/afiliados/:id/invitaciones — Lista links generados
router.get('/:id/invitaciones', requireAuth, listarInvitacionesCorporativas);

// DELETE /api/afiliados/:id/invitaciones/:tokenId — Revoca un link
router.delete('/:id/invitaciones/:tokenId', requireAuth, requireRole('admin', 'super_admin'), revocarInvitacionCorporativa);

// GET /api/afiliados/:id/afiliados-corp — Lista individuales vinculados a la empresa
router.get('/:id/afiliados-corp', requireAuth, listarAfiliadosCorporativos);

// POST /api/afiliados/:id/registrar-miembro — Registro directo por la empresa
router.post('/:id/registrar-miembro', requireAuth, registrarMiembroDirecto);

// POST /api/afiliados/:id/convertir-natural — Agente a Natural
router.post('/:id/convertir-natural', requireAuth, convertirAgenteANatural);

export { router as afiliadosRoutes };

