import { Router } from 'express';
import { requireAuth, requirePermiso } from '../middlewares/auth.middleware.js';
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
  getHistorialTasas,
  getIngresosPorConcepto,
  getIngresosPorCohorte,
  getNombrePorRif,
  getEgresosPorConcepto,
  getCuentasPorCobrar,
  exportarXlsx
} from '../controllers/finanzas.controller.js';

const router = Router();
const finanzas = requirePermiso('finanzas'); // acción según el verbo HTTP
// Sincronizar o fijar/restablecer una tasa cambia la referencia, no crea ni borra registros.
const editarTasas = requirePermiso('finanzas', 'editar');

// Permiso por ruta (no router.use): las tasas usan una acción distinta a la de su verbo.
router.use(requireAuth);

router.get('/resumen', finanzas, getResumenFinanciero);
router.get('/libro-ventas', finanzas, getLibroVentas);
router.get('/libro-compras', finanzas, getLibroCompras);
router.post('/movimientos', finanzas, crearMovimiento);
router.put('/movimientos/:id', finanzas, actualizarMovimiento);
router.patch('/movimientos/:id/anular', finanzas, anularMovimiento);
router.delete('/movimientos/:id', finanzas, eliminarMovimiento);

// ── Reportes de control ──
router.get('/ingresos-por-concepto', finanzas, getIngresosPorConcepto);
router.get('/ingresos-por-cohorte', finanzas, getIngresosPorCohorte);
router.get('/nombre-por-rif', finanzas, getNombrePorRif);
router.get('/egresos-por-concepto', finanzas, getEgresosPorConcepto);
router.get('/cuentas-por-cobrar', finanzas, getCuentasPorCobrar);
router.get('/export/:reporte.xlsx', finanzas, exportarXlsx);

// ── Rutas de referencias y tasas de cambio ──
router.get('/referencias', finanzas, getTasasReferencias);
router.post('/referencias/sync', editarTasas, sincronizarTasasEnVivo);
router.put('/referencias/:codigo', editarTasas, actualizarTasaManual);
router.delete('/referencias/:codigo/manual', editarTasas, resetTasaManual);
router.get('/referencias/historial', finanzas, getHistorialTasas);

export default router;
