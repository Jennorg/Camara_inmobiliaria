import { Router } from 'express';
import { requireAuth, requireRole, UserRole } from '../middlewares/auth.middleware.js';
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
  adminUpdateArancel
} from '../controllers/pagos.controller.js';

const router = Router();
const adminRoles: UserRole[] = ['admin', 'super_admin', 'asistente', 'administrativo', 'personal_admin'];

// ── Rutas generales y aspirantes ──
router.get('/cuentas', getCuentas);
router.get('/aranceles', getArancelesController);
router.get('/arancel-formalizacion/:idAfiliado', getArancelFormalizacion);
router.get('/recibo/:reciboIdOrCode', getRecibo);
router.post('/reportar', requireAuth, reportarPago);
router.get('/afiliado/:idAfiliado', requireAuth, getPagosByAfiliado);

// ── Rutas administrativas ──
router.get('/admin', requireAuth, requireRole(...adminRoles), adminListPagos);
router.post('/admin/cobro-taquilla', requireAuth, requireRole(...adminRoles), adminCobroTaquilla);
router.patch('/admin/:id/verificar', requireAuth, requireRole(...adminRoles), adminVerificarPago);
router.patch('/admin/:id/rechazar', requireAuth, requireRole(...adminRoles), adminRechazarPago);

// ── Gestión administrativa de cuentas bancarias y aranceles ──
router.get('/admin/cuentas', requireAuth, requireRole(...adminRoles), adminListCuentas);
router.post('/admin/cuentas', requireAuth, requireRole(...adminRoles), adminCreateCuenta);
router.put('/admin/cuentas/:id', requireAuth, requireRole(...adminRoles), adminUpdateCuenta);
router.delete('/admin/cuentas/:id', requireAuth, requireRole(...adminRoles), adminDeleteCuenta);
router.put('/admin/aranceles/:codigo', requireAuth, requireRole(...adminRoles), adminUpdateArancel);

export default router;
