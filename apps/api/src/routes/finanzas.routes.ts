import { Router } from 'express';
import { requireAuth, requireRole, UserRole } from '../middlewares/auth.middleware.js';
import {
  getResumenFinanciero,
  getLibroVentas,
  getLibroCompras,
  crearMovimiento,
  actualizarMovimiento,
  anularMovimiento,
  eliminarMovimiento,
  getTasasReferencias,
  sincronizarTasasEnVivo,
  actualizarTasaManual,
  resetTasaManual,
  getHistorialTasas
} from '../controllers/finanzas.controller.js';

const router = Router();
const adminRoles: UserRole[] = ['admin', 'super_admin', 'asistente', 'administrativo', 'personal_admin'];

// Todas las rutas de finanzas requieren autenticación y rol administrativo / contable
router.use(requireAuth, requireRole(...adminRoles));

router.get('/resumen', getResumenFinanciero);
router.get('/libro-ventas', getLibroVentas);
router.get('/libro-compras', getLibroCompras);
router.post('/movimientos', crearMovimiento);
router.put('/movimientos/:id', actualizarMovimiento);
router.patch('/movimientos/:id/anular', anularMovimiento);
router.delete('/movimientos/:id', eliminarMovimiento);

// ── Rutas de referencias y tasas de cambio ──
router.get('/referencias', getTasasReferencias);
router.post('/referencias/sync', sincronizarTasasEnVivo);
router.put('/referencias/:codigo', actualizarTasaManual);
router.delete('/referencias/:codigo/manual', resetTasaManual);
router.get('/referencias/historial', getHistorialTasas);

export default router;
