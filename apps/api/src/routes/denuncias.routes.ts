import { Router } from 'express';
import { db } from '../lib/db.js';
import { asegurarEsquemaDenuncias } from '../lib/denuncias-esquema.js';
import { requireAuth, optionalAuth, requirePermiso } from '../middlewares/auth.middleware.js';
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

// ── Rutas Públicas (Ciudadanos / Afiliados) ──
router.post('/', optionalAuth, publicCrearDenuncia);
router.get('/mi-identidad', requireAuth, miIdentidadDenunciante);
router.post('/consultar', publicConsultarDenuncia);

// ── Rutas Administrativas / Tribunal Disciplinario ──
// Mediación, defensa y resolución modifican una denuncia existente: «editar» explícito
router.get('/admin', requireAuth, requirePermiso('denuncias', 'ver'), adminListarDenuncias);
router.get('/admin/:id', requireAuth, requirePermiso('denuncias', 'ver'), adminGetDetalleDenuncia);
router.patch('/admin/:id/estatus', requireAuth, requirePermiso('denuncias', 'editar'), adminCambiarEstatus);
router.patch('/admin/:id/prioridad', requireAuth, requirePermiso('denuncias', 'editar'), adminCambiarPrioridad);
router.post('/admin/:id/mediacion', requireAuth, requirePermiso('denuncias', 'editar'), adminConvocarMediacion);
router.post('/admin/:id/defensa', requireAuth, requirePermiso('denuncias', 'editar'), adminRegistrarDefensa);
router.post('/admin/:id/resolver', requireAuth, requirePermiso('denuncias', 'editar'), adminResolverDenuncia);
router.put('/admin/:id/notas', requireAuth, requirePermiso('denuncias', 'editar'), adminGuardarNotas);

export default router;
