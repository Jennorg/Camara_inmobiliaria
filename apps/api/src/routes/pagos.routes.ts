import { Router } from 'express';
import { requireAuth, requirePermiso } from '../middlewares/auth.middleware.js';
import {
  getCuentas,
  getArancelesController,
  getArancelFormalizacion,
  reportarPago,
  getPagosByAfiliado,
  getRecibo,
  adminListPagos,
  adminCobroTaquilla,
  adminVerificarPago,
  adminRechazarPago,
  adminListCuentas,
  adminCreateCuenta,
  adminUpdateCuenta,
  adminDeleteCuenta,
  adminUpdateArancel,
  adminCursosPorCobrar,
  adminBuscarPagadores,
  getModalidadPagos,
  adminSetModalidadPagos,
  getCobrosAfiliacion,
  adminAnularPago,
  adminMarcarMesSolvencia
} from '../controllers/pagos.controller.js';
import { getSolvenciaAfiliado, adminResumenSolvencia, adminSetInicioSolvencia, adminEnviarRecordatorio, emitirConstancia } from '../controllers/solvencia.controller.js';

const router = Router();
const finanzas = requirePermiso('finanzas'); // acción según el verbo HTTP
// Recordar, anular, verificar o rechazar cambian el estado de un pago existente.
const editar = requirePermiso('finanzas', 'editar');

// ── Rutas generales y aspirantes ──
router.get('/cuentas', getCuentas);
router.get('/aranceles', getArancelesController);
router.get('/arancel-formalizacion/:idAfiliado', getArancelFormalizacion);
router.get('/modalidad', getModalidadPagos);
router.get('/afiliado/:idAfiliado/cobros', requireAuth, getCobrosAfiliacion);
router.get('/recibo/:reciboIdOrCode', requireAuth, getRecibo);
router.post('/reportar', requireAuth, reportarPago);
router.get('/afiliado/:idAfiliado', requireAuth, getPagosByAfiliado);
router.get('/solvencia/afiliado/:idAfiliado', requireAuth, getSolvenciaAfiliado);
router.post('/constancia-solvencia', requireAuth, emitirConstancia);

// ── Rutas administrativas ──
router.get('/admin', requireAuth, finanzas, adminListPagos);
router.get('/admin/solvencia', requireAuth, finanzas, adminResumenSolvencia);
router.put('/admin/solvencia/config', requireAuth, finanzas, adminSetInicioSolvencia);
router.post('/admin/solvencia/recordatorio', requireAuth, editar, adminEnviarRecordatorio);
router.get('/admin/cursos-por-cobrar', requireAuth, finanzas, adminCursosPorCobrar);
router.put('/admin/modalidad', requireAuth, finanzas, adminSetModalidadPagos);
router.get('/admin/pagadores', requireAuth, finanzas, adminBuscarPagadores);
router.post('/admin/cobro-taquilla', requireAuth, finanzas, adminCobroTaquilla);
router.patch('/admin/:id/anular', requireAuth, editar, adminAnularPago);
router.put('/admin/solvencia/afiliado/:idAfiliado/mes', requireAuth, finanzas, adminMarcarMesSolvencia);
router.patch('/admin/:id/verificar', requireAuth, editar, adminVerificarPago);
router.patch('/admin/:id/rechazar', requireAuth, editar, adminRechazarPago);

// ── Gestión administrativa de cuentas bancarias y aranceles ──
router.get('/admin/cuentas', requireAuth, finanzas, adminListCuentas);
router.post('/admin/cuentas', requireAuth, finanzas, adminCreateCuenta);
router.put('/admin/cuentas/:id', requireAuth, finanzas, adminUpdateCuenta);
router.delete('/admin/cuentas/:id', requireAuth, finanzas, adminDeleteCuenta);
router.put('/admin/aranceles/:codigo', requireAuth, finanzas, adminUpdateArancel);

export default router;
