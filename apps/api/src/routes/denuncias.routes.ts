import { Router } from 'express';
import { db } from '../lib/db.js';
import { asegurarEsquemaDenuncias } from '../lib/denuncias-esquema.js';
import { requireAuth, optionalAuth, requireRole, UserRole } from '../middlewares/auth.middleware.js';
import {
  publicCrearDenuncia,
  miIdentidadDenunciante,
  publicConsultarDenuncia,
  adminListarDenuncias,
  adminGetDetalleDenuncia,
  adminCambiarEstatus,
  adminCambiarPrioridad,
  adminConvocarMediacion,
  adminRegistrarDefensa,
  adminResolverDenuncia,
  adminGuardarNotas
} from '../controllers/denuncias.controller.js';

const router = Router();

// El esquema de denuncias se actualiza (una sola vez, de forma idempotente) antes de atender cualquier petición
router.use((_req, _res, next) => { asegurarEsquemaDenuncias(db).then(() => next(), next); });
const adminRoles: UserRole[] = ['admin', 'super_admin', 'asistente', 'administrativo', 'personal_admin'];

// ── Rutas Públicas (Ciudadanos / Afiliados) ──
router.post('/', optionalAuth, publicCrearDenuncia);
router.get('/mi-identidad', requireAuth, miIdentidadDenunciante);
router.post('/consultar', publicConsultarDenuncia);

// ── Rutas Administrativas / Tribunal Disciplinario ──
router.get('/admin', requireAuth, requireRole(...adminRoles), adminListarDenuncias);
router.get('/admin/:id', requireAuth, requireRole(...adminRoles), adminGetDetalleDenuncia);
router.patch('/admin/:id/estatus', requireAuth, requireRole(...adminRoles), adminCambiarEstatus);
router.patch('/admin/:id/prioridad', requireAuth, requireRole(...adminRoles), adminCambiarPrioridad);
router.post('/admin/:id/mediacion', requireAuth, requireRole(...adminRoles), adminConvocarMediacion);
router.post('/admin/:id/defensa', requireAuth, requireRole(...adminRoles), adminRegistrarDefensa);
router.post('/admin/:id/resolver', requireAuth, requireRole(...adminRoles), adminResolverDenuncia);
router.put('/admin/:id/notas', requireAuth, requireRole(...adminRoles), adminGuardarNotas);

export default router;
