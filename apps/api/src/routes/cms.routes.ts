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
import { Request, Response, NextFunction } from 'express';
import { requireAuth, requireRole, requirePermiso } from '../middlewares/auth.middleware.js';
import { db } from '../lib/db.js';
import { permisosDeRoles } from '../services/permisos.service.js';
import type { Accion } from '../config/secciones.js';

const router = Router();
const auth = [requireAuth];
// Mapa: ruta CMS → sección del panel. Hitos, páginas y configuración → «config»; cursos y convenios → «formacion».
const permiso = (seccion: string, accion?: Accion) => [requireAuth, requirePermiso(seccion, accion)];

// Normativas: la sección sale de la categoría (la del cuerpo al crear, la guardada al editar/eliminar).
// «Otros», sin categoría, desconocida o sin registro: solo admin/super_admin (nunca se abre).
const SECCION_NORMATIVA: Record<string, string> = {
  'Leyes y Decretos': 'leyes', 'Reglamentos y Estatutos': 'reglamentos', 'Normas y Procedimientos': 'normas', 'Actas de Asamblea': 'actas',
};
const soloAdmin = requireRole('admin', 'super_admin');
const guardadas = async (ids: unknown): Promise<unknown[]> => {
  const lista = (Array.isArray(ids) ? ids : []).map(String);
  if (lista.length === 0) return [];
  const r = await db.execute({ sql: `SELECT DISTINCT categoria FROM cms_normativas WHERE id_normativa IN (${lista.map(() => '?').join(',')})`, args: lista });
  return r.rows.map(x => x.categoria);
};
const permisoNormativa = (accion: Accion, categorias: (req: Request) => Promise<unknown[]>) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const secciones = (await categorias(req)).map(c => SECCION_NORMATIVA[String(c)]);
      if (secciones.length === 0 || secciones.some(s => !s)) { soloAdmin(req, res, next); return; }
      const mapa = await permisosDeRoles(req.user!.roles ?? [req.user!.rol]);
      if (secciones.some(s => !mapa[s!]?.[accion])) {
        res.status(403).json({ success: false, message: 'Acceso denegado: permisos insuficientes' });
        return;
      }
      next();
    } catch (err) {
      console.error('Error leyendo permisos:', err);
      res.status(500).json({ success: false, message: 'Error verificando permisos' });
    }
  };

// ── Noticias ──────────────────────────────────────────
router.get('/noticias', getNoticias);
router.post('/noticias', ...permiso('noticias'), createNoticia);
router.put('/noticias/reorder', ...permiso('noticias', 'editar'), reorderNoticias);
router.put('/noticias/:id', ...permiso('noticias'), updateNoticia);
router.delete('/noticias/:id', ...permiso('noticias'), deleteNoticia);

// ── Cursos ────────────────────────────────────────────
router.get('/cursos', getCursos);
router.post('/cursos', ...permiso('formacion'), createCurso);
router.put('/cursos/:id', ...permiso('formacion'), updateCurso);
router.delete('/cursos/:id', ...permiso('formacion'), deleteCurso);

// ── Convenios ─────────────────────────────────────────
router.get('/convenios', getConvenios);
router.post('/convenios', ...permiso('formacion'), createConvenio);
router.put('/convenios/:id', ...permiso('formacion'), updateConvenio);
router.delete('/convenios/:id', ...permiso('formacion'), deleteConvenio);

// ── Normativas (enlaces a documentos) ───────────────────
router.get('/normativas', getNormativas);
router.post('/normativas', ...auth, permisoNormativa('crear', async req => [req.body?.categoria]), createNormativa);
router.post('/normativas-batch-delete', ...auth, permisoNormativa('eliminar', req => guardadas(req.body?.ids)), deleteBatchNormativas);
router.put('/normativas-reorder', ...auth, permisoNormativa('editar', req => guardadas(Array.isArray(req.body?.items) ? req.body.items.map((i: any) => i?.id) : [])), reorderNormativas);
// Al editar se exige la sección de la categoría guardada y la de la nueva (no se puede mover a otra sin permiso en ambas).
router.put('/normativas/:id', ...auth, permisoNormativa('editar', async req => {
  const actual = await guardadas([req.params.id]);
  return actual.length ? [...actual, req.body?.categoria] : [];
}), updateNormativa);
router.delete('/normativas/:id', ...auth, permisoNormativa('eliminar', req => guardadas([req.params.id])), deleteNormativa);

// ── Directiva ─────────────────────────────────────────
router.get('/directiva', getDirectiva);
router.post('/directiva', ...permiso('directiva'), createMiembroDirectiva);
router.put('/directiva/:id', ...permiso('directiva'), updateMiembroDirectiva);
router.delete('/directiva/:id', ...permiso('directiva'), deleteMiembroDirectiva);

// ── Hitos ─────────────────────────────────────────────
router.get('/hitos', getHitos);
router.post('/hitos', ...permiso('config'), createHito);
router.put('/hitos/:id', ...permiso('config'), updateHito);
router.delete('/hitos/:id', ...permiso('config'), deleteHito);

// ── Configuración ─────────────────────────────────────
router.get('/config', ...permiso('config'), getConfig);
// Guardar un ajuste es un upsert: «editar» explícito
router.post('/config', ...permiso('config', 'editar'), upsertConfig);
router.post('/config/batch', ...permiso('config', 'editar'), upsertConfigBatch);
router.delete('/config/:clave', ...permiso('config'), deleteConfig);

// ── Páginas dinámicas (JSON) ────────────────────────────────────────────────
router.get('/paginas', ...permiso('config'), getPaginasList);
router.get('/paginas/:slug', getPaginaBySlug);
router.put('/paginas/:slug', ...permiso('config'), upsertPagina);
router.delete('/paginas/:slug', ...permiso('config'), deletePagina);

export { router as cmsRoutes };
