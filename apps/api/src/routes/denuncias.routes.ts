import { Router } from 'express';
import { requireAuth, requireRole, UserRole } from '../middlewares/auth.middleware.js';
import {
  publicCrearDenuncia,
  publicConsultarDenuncia,
  adminListarDenuncias,
  adminGetDetalleDenuncia,
  adminCambiarEstatus,
  adminConvocarMediacion,
  adminRegistrarDescargos,
  adminResolverDenuncia,
  adminGuardarNotas
} from '../controllers/denuncias.controller.js';

const router = Router();
const adminRoles: UserRole[] = ['admin', 'super_admin', 'asistente', 'administrativo', 'personal_admin'];

// ── Rutas Públicas (Ciudadanos / Afiliados) ──
router.post('/', publicCrearDenuncia);
router.post('/consultar', publicConsultarDenuncia);

// ── Rutas Administrativas / Tribunal Disciplinario ──
router.get('/admin', requireAuth, requireRole(...adminRoles), adminListarDenuncias);
router.get('/admin/:id', requireAuth, requireRole(...adminRoles), adminGetDetalleDenuncia);
router.patch('/admin/:id/estatus', requireAuth, requireRole(...adminRoles), adminCambiarEstatus);
router.post('/admin/:id/mediacion', requireAuth, requireRole(...adminRoles), adminConvocarMediacion);
router.post('/admin/:id/descargos', requireAuth, requireRole(...adminRoles), adminRegistrarDescargos);
router.post('/admin/:id/resolver', requireAuth, requireRole(...adminRoles), adminResolverDenuncia);
router.put('/admin/:id/notas', requireAuth, requireRole(...adminRoles), adminGuardarNotas);

export default router;
