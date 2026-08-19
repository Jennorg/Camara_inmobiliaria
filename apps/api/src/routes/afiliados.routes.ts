import { Router } from 'express';
import { 
  registerAfiliado, getAfiliados, getAfiliadoById, getMisCertificados, getMisCursos, aprobarAfiliado, 
  getSolicitudesCibir, rechazarAfiliado, verificarEmail, formalizarInscripcion, updateEstatusAfiliado, 
  updateAfiliado, generarInvitacionCorporativa, listarInvitacionesCorporativas, revocarInvitacionCorporativa, 
  listarAfiliadosCorporativos, registrarMiembroDirecto, deleteAfiliado, createAfiliado, convertirAgenteANatural, 
  establecerAccesoPanel, aprobarAfiliadoCorporativo, rechazarAfiliadoCorporativo, crearSolicitudAgenteCorporativo, 
  listarIndependientesDisponibles, vincularAfiliadoIndependiente,
  crearSolicitudCambio, getMiSolicitudCambio, cancelarMiSolicitudCambio, listarSolicitudesCambioEmpresa,
  resolverSolicitudCambioEmpresa, listarSolicitudesCambioAdmin, resolverSolicitudCambioAdmin,
  cambiarMembresiaDirectoAdmin, cambiarAccesoEmail
} from '../controllers/afiliados.controller.js';
import { requireAuth, requireRole, enrichUser } from '../middlewares/auth.middleware.js';

const router = Router();

// GET /api/afiliados
router.get('/', requireAuth, requireRole('admin', 'super_admin', 'asistente', 'administrativo'), getAfiliados);

// POST /api/afiliados (Direct Creation)
router.post('/', requireAuth, requireRole('admin', 'super_admin', 'asistente', 'administrativo'), createAfiliado);

// GET /api/afiliados/cibir/solicitudes
router.get('/cibir/solicitudes', requireAuth, requireRole('admin', 'super_admin', 'asistente', 'administrativo'), getSolicitudesCibir);

// GET /api/afiliados/me/certificados — comprobantes digitales del usuario autenticado
router.get('/me/certificados', requireAuth, enrichUser, getMisCertificados);

// GET /api/afiliados/me/cursos — cursos inscritos y progreso de módulos
router.get('/me/cursos', requireAuth, enrichUser, getMisCursos);

// GET /api/afiliados/:id — para el portal del afiliado (requiere auth)
router.get('/:id', requireAuth, enrichUser, getAfiliadoById);

// POST /api/afiliados/registro
router.post('/registro', registerAfiliado);

// POST /api/afiliados/registro/verificar
router.post('/registro/verificar', verificarEmail);

// POST /api/afiliados/formalizar — Para que el afiliado pague su inscripción
router.post('/formalizar', requireAuth, enrichUser, formalizarInscripcion);

// PATCH /api/afiliados/:id/acceso-panel — Contraseña de acceso al panel (admin)
router.patch('/:id/acceso-panel', requireAuth, requireRole('admin', 'super_admin', 'asistente', 'administrativo'), establecerAccesoPanel);

// PATCH /api/afiliados/:id/acceso-email — Cambiar correo de acceso (dueño o admin)
router.patch('/:id/acceso-email', requireAuth, enrichUser, cambiarAccesoEmail);

// PATCH /api/afiliados/:id — Actualización general del afiliado
router.patch('/:id', requireAuth, enrichUser, updateAfiliado);

// DELETE /api/afiliados/:id (Solo admin y super_admin pueden eliminar registros)
router.delete('/:id', requireAuth, requireRole('admin', 'super_admin'), deleteAfiliado);

// PATCH /api/afiliados/:id/estatus — Actualización granular del proceso de 9 pasos
router.patch('/:id/estatus', requireAuth, requireRole('admin', 'super_admin', 'asistente', 'administrativo'), updateEstatusAfiliado);

// PATCH /api/afiliados/:id/aprobar
router.patch('/:id/aprobar', requireAuth, requireRole('admin', 'super_admin', 'asistente', 'administrativo'), aprobarAfiliado);

// PATCH /api/afiliados/:id/rechazar
router.patch('/:id/rechazar', requireAuth, requireRole('admin', 'super_admin', 'asistente', 'administrativo'), rechazarAfiliado);

// ── Invitaciones Corporativas ──────────────────────────────────────────────────
// POST /api/afiliados/:id/invitacion — Genera link reutilizable (admin o afiliado corp)
router.post('/:id/invitacion', requireAuth, enrichUser, generarInvitacionCorporativa);

// GET /api/afiliados/:id/invitaciones — Lista links generados
router.get('/:id/invitaciones', requireAuth, enrichUser, listarInvitacionesCorporativas);

// DELETE /api/afiliados/:id/invitaciones/:tokenId — Revoca un link
router.delete('/:id/invitaciones/:tokenId', requireAuth, requireRole('admin', 'super_admin'), revocarInvitacionCorporativa);

// GET /api/afiliados/:id/afiliados-corp — Lista individuales vinculados a la empresa
router.get('/:id/afiliados-corp', requireAuth, enrichUser, listarAfiliadosCorporativos);

// POST /api/afiliados/:id/registrar-miembro — Registro directo por la empresa
router.post('/:id/registrar-miembro', requireAuth, enrichUser, registrarMiembroDirecto);

// POST /api/afiliados/:id/convertir-natural — Agente a Natural
router.post('/:id/convertir-natural', requireAuth, enrichUser, convertirAgenteANatural);

// POST /api/afiliados/:id/afiliados-corp/:idAfiliado/aprobar — Aprobar agente corporativo pendiente
router.post('/:id/afiliados-corp/:idAfiliado/aprobar', requireAuth, enrichUser, aprobarAfiliadoCorporativo);

// POST /api/afiliados/:id/afiliados-corp/:idAfiliado/rechazar — Rechazar agente corporativo pendiente
router.post('/:id/afiliados-corp/:idAfiliado/rechazar', requireAuth, enrichUser, rechazarAfiliadoCorporativo);

// POST /api/afiliados/:id/afiliados-corp/crear-solicitud — Crear solicitud (pendiente) de agente corporativo
router.post('/:id/afiliados-corp/crear-solicitud', requireAuth, enrichUser, crearSolicitudAgenteCorporativo);

// GET /api/afiliados/:id/independientes-disponibles — Lista afiliados Naturales disponibles para vincular
router.get('/:id/independientes-disponibles', requireAuth, enrichUser, listarIndependientesDisponibles);

// POST /api/afiliados/:id/afiliados-corp/vincular — Vincula directamente un afiliado independiente como agente corporativo
router.post('/:id/afiliados-corp/vincular', requireAuth, enrichUser, vincularAfiliadoIndependiente);

// ── Solicitudes de Cambio de Estado / Membresía ───────────────────────────────────────────
// POST /api/afiliados/me/solicitud-cambio — Crear solicitud de cambio de estado
router.post('/me/solicitud-cambio', requireAuth, enrichUser, crearSolicitudCambio);

// GET /api/afiliados/me/solicitud-cambio — Obtener solicitud activa del usuario
router.get('/me/solicitud-cambio', requireAuth, enrichUser, getMiSolicitudCambio);

// DELETE /api/afiliados/me/solicitud-cambio/:id — Cancelar solicitud de cambio activa del usuario
router.delete('/me/solicitud-cambio/:id', requireAuth, enrichUser, cancelarMiSolicitudCambio);
router.delete('/me/solicitud-cambio', requireAuth, enrichUser, cancelarMiSolicitudCambio);
router.post('/me/solicitud-cambio/cancelar', requireAuth, enrichUser, cancelarMiSolicitudCambio);

// GET /api/afiliados/empresa/solicitudes-cambio — Lista solicitudes de Agente Corp pendientes para esta empresa
router.get('/empresa/solicitudes-cambio', requireAuth, enrichUser, listarSolicitudesCambioEmpresa);

// POST /api/afiliados/empresa/solicitudes-cambio/:id/resolver — Aprobar o rechazar solicitud como empresa
router.post('/empresa/solicitudes-cambio/:id/resolver', requireAuth, enrichUser, resolverSolicitudCambioEmpresa);

// GET /api/afiliados/admin/solicitudes-cambio — Listar todas las solicitudes pendientes de Admin
router.get('/admin/solicitudes-cambio', requireAuth, requireRole('admin', 'super_admin', 'asistente', 'administrativo'), listarSolicitudesCambioAdmin);

// POST /api/afiliados/admin/solicitudes-cambio/:id/resolver — Aprobar o rechazar solicitud como Admin
router.post('/admin/solicitudes-cambio/:id/resolver', requireAuth, requireRole('admin', 'super_admin', 'asistente', 'administrativo'), resolverSolicitudCambioAdmin);

// POST /api/afiliados/admin/:id/cambiar-membresia — Cambiar membresía directamente desde admin
router.post('/admin/:id/cambiar-membresia', requireAuth, requireRole('admin', 'super_admin', 'asistente', 'administrativo'), cambiarMembresiaDirectoAdmin);

export { router as afiliadosRoutes };

