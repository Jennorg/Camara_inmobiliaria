import { Router } from 'express';
import {
  getNoticias, createNoticia, updateNoticia, deleteNoticia, reorderNoticias,
  getCursos, createCurso, updateCurso, deleteCurso,
  getConvenios, createConvenio, updateConvenio, deleteConvenio,
  getDirectiva, createMiembroDirectiva, updateMiembroDirectiva, deleteMiembroDirectiva,
  getHitos, createHito, updateHito, deleteHito,
  getConfig, upsertConfig, upsertConfigBatch, deleteConfig,
  getPaginasList, getPaginaBySlug, upsertPagina, deletePagina,
  getNormativas, createNormativa, updateNormativa, deleteNormativa, deleteBatchNormativas, reorderNormativas,
} from '../controllers/cms.controller.js';
import { requireAuth, requireRole } from '../middlewares/auth.middleware.js';

const router = Router();
const adminOnly = [requireAuth, requireRole('admin', 'super_admin')];

// ── Noticias ──────────────────────────────────────────
router.get('/noticias', getNoticias);
router.post('/noticias', ...adminOnly, createNoticia);
router.put('/noticias/reorder', ...adminOnly, reorderNoticias);
router.put('/noticias/:id', ...adminOnly, updateNoticia);
router.delete('/noticias/:id', ...adminOnly, deleteNoticia);

// ── Cursos ────────────────────────────────────────────
router.get('/cursos', getCursos);
router.post('/cursos', ...adminOnly, createCurso);
router.put('/cursos/:id', ...adminOnly, updateCurso);
router.delete('/cursos/:id', ...adminOnly, deleteCurso);

// ── Convenios ─────────────────────────────────────────
router.get('/convenios', getConvenios);
router.post('/convenios', ...adminOnly, createConvenio);
router.put('/convenios/:id', ...adminOnly, updateConvenio);
router.delete('/convenios/:id', ...adminOnly, deleteConvenio);

// ── Normativas (enlaces a documentos) ───────────────────
router.get('/normativas', getNormativas);
router.post('/normativas', ...adminOnly, createNormativa);
router.post('/normativas-batch-delete', ...adminOnly, deleteBatchNormativas);
router.put('/normativas-reorder', ...adminOnly, reorderNormativas);
router.put('/normativas/:id', ...adminOnly, updateNormativa);
router.delete('/normativas/:id', ...adminOnly, deleteNormativa);

// ── Directiva ─────────────────────────────────────────
router.get('/directiva', getDirectiva);
router.post('/directiva', ...adminOnly, createMiembroDirectiva);
router.put('/directiva/:id', ...adminOnly, updateMiembroDirectiva);
router.delete('/directiva/:id', ...adminOnly, deleteMiembroDirectiva);

// ── Hitos ─────────────────────────────────────────────
router.get('/hitos', getHitos);
router.post('/hitos', ...adminOnly, createHito);
router.put('/hitos/:id', ...adminOnly, updateHito);
router.delete('/hitos/:id', ...adminOnly, deleteHito);

// ── Configuración ─────────────────────────────────────
router.get('/config', ...adminOnly, getConfig);
router.post('/config', ...adminOnly, upsertConfig);
router.post('/config/batch', ...adminOnly, upsertConfigBatch);
router.delete('/config/:clave', ...adminOnly, deleteConfig);

// ── Páginas dinámicas (JSON) ────────────────────────────────────────────────
router.get('/paginas', ...adminOnly, getPaginasList);
router.get('/paginas/:slug', getPaginaBySlug);
router.put('/paginas/:slug', ...adminOnly, upsertPagina);
router.delete('/paginas/:slug', ...adminOnly, deletePagina);

export { router as cmsRoutes };
