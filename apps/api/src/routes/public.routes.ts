import { Router } from 'express';
import { 
  buscarAfiliadosPublic, 
  getAfiliadoPublicById,
  publicValidarInvitacion, 
  publicRegistrarPorInvitacion,
  publicListEmpresas
} from '../controllers/afiliados.controller.js';
import { 
  publicPreinscribirProgramaPrincipal, 
  publicConfirmarPreinscripcionPrograma, 
  publicListCursos, 
  publicPreinscribirCurso,
  publicGetVerificacionPreinscripcionByToken
} from '../controllers/academia.controller.js';
import { getPaginaBySlug, publicListNormativas } from '../controllers/cms.controller.js';
import { publicGetComprobanteByCodigo } from '../controllers/certificados.controller.js';
import { publicVerificarConstancia } from '../controllers/solvencia.controller.js';
import { presignUpload, directUpload } from '../controllers/uploads.controller.js';

import { publicHorarios, publicReservar } from '../controllers/agenda.controller.js';

const router = Router();

// GET/POST /api/public/agenda/:token — el aspirante elige su horario de entrevista
router.get('/agenda/:token', publicHorarios);
router.post('/agenda/:token', publicReservar);

// GET /api/public/empresas
router.get('/empresas', publicListEmpresas);

// GET /api/public/afiliados/buscar
router.get('/afiliados/buscar', buscarAfiliadosPublic);

// GET /api/public/afiliados/:id
router.get('/afiliados/:id', getAfiliadoPublicById);

// POST /api/public/preinscripciones
router.post('/preinscripciones', publicPreinscribirProgramaPrincipal);

// POST /api/public/uploads/presign (Public access for registration documents)
router.post('/uploads/presign', presignUpload);
router.post('/uploads/direct', directUpload);

// POST /api/public/preinscripciones/confirmar
router.post('/preinscripciones/confirmar', publicConfirmarPreinscripcionPrograma);

// GET /api/public/preinscripciones/token/:token
router.get('/preinscripciones/token/:token', publicGetVerificacionPreinscripcionByToken);

// GET /api/public/cursos
router.get('/cursos', publicListCursos);

// POST /api/public/cursos/:id/preinscribir
router.post('/cursos/:id/preinscribir', publicPreinscribirCurso);

// GET /api/public/normativas — documentos / enlaces publicados (CMS)
router.get('/normativas', publicListNormativas);

// GET /api/public/paginas/:slug — contenido JSON de página pública (CMS)
router.get('/paginas/:slug', getPaginaBySlug);

// GET /api/public/comprobantes/:codigo — verificación de comprobante digital
router.get('/comprobantes/:codigo', publicGetComprobanteByCodigo);
router.get('/constancias-solvencia/:codigo', publicVerificarConstancia);

// ── Invitaciones Corporativas (Pública) ─────────────────────────────────
// GET /api/public/invitaciones/:token — Valida y retorna info de la empresa
router.get('/invitaciones/:token', publicValidarInvitacion);

// POST /api/public/invitaciones/:token/registrar — Registro individual por invitación
router.post('/invitaciones/:token/registrar', publicRegistrarPorInvitacion);

// ── Referencias Cambiarias (Pública para pasarela y widgets de afiliación) ──
router.get('/tasas-referencia', async (_req, res) => {
  try {
    const { tasasService } = await import('../services/tasas.service.js');
    const snapshot = await tasasService.getTasas(false);
    return res.json({ success: true, data: snapshot });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Error al obtener tasas' });
  }
});

export { router as publicRoutes };
