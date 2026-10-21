import { Request, Response } from 'express';
import { finanzasService, FiltrosFinanzas } from '../services/finanzas.service.js';
import { tasasService } from '../services/tasas.service.js';
import { cerrarCaja, cuentasPorCobrar, getCierreCaja, ingresosPorConcepto } from '../services/reportes.service.js';
import { hoyCaracas } from '../services/cobranza.service.js';
import { ETIQUETA_CONCEPTO } from '../lib/conceptos.js';
import XLSX from 'xlsx';

function parseFiltros(req: Request): FiltrosFinanzas {
  const { anio, mes, fechaInicio, fechaFin, search, categoria, tipo, concepto, metodo, cajero } = req.query;
  return {
    anio: anio ? parseInt(String(anio), 10) : undefined,
    mes: mes ? parseInt(String(mes), 10) : undefined,
    fechaInicio: fechaInicio ? String(fechaInicio) : undefined,
    fechaFin: fechaFin ? String(fechaFin) : undefined,
    search: search ? String(search) : undefined,
    categoria: categoria ? String(categoria) : undefined,
    tipo: tipo === 'ingreso' || tipo === 'egreso' ? tipo : undefined,
    concepto: concepto ? String(concepto) : undefined,
    metodo: metodo ? String(metodo) : undefined,
    cajero: cajero ? String(cajero) : undefined
  };
}

export async function getResumenFinanciero(req: Request, res: Response) {
  try {
    const filtros = parseFiltros(req);
    const resumen = await finanzasService.getResumenFinanciero(filtros);
    return res.json({ success: true, data: resumen });
  } catch (error: any) {
    console.error('Error al obtener resumen financiero:', error);
    return res.status(500).json({ error: error.message || 'Error al obtener resumen financiero' });
  }
}

export async function getLibroVentas(req: Request, res: Response) {
  try {
    const filtros = parseFiltros(req);
    const libro = await finanzasService.getLibroVentas(filtros);
    return res.json({ success: true, data: libro });
  } catch (error: any) {
    console.error('Error al obtener libro de ventas:', error);
    return res.status(500).json({ error: error.message || 'Error al obtener libro de ventas' });
  }
}

export async function getLibroCompras(req: Request, res: Response) {
  try {
    const filtros = parseFiltros(req);
    const libro = await finanzasService.getLibroCompras(filtros);
    return res.json({ success: true, data: libro });
  } catch (error: any) {
    console.error('Error al obtener libro de compras:', error);
    return res.status(500).json({ error: error.message || 'Error al obtener libro de compras' });
  }
}

export async function crearMovimiento(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    const {
      tipo,
      categoria,
      fecha,
      concepto,
      proveedor_cliente,
      rif_cedula,
      nro_factura_documento,
      nro_control_fiscal,
      base_imponible,
      monto_exento,
      alicuota_iva,
      monto_iva,
      monto_total,
      moneda,
      tasa_bcv,
      metodo_pago,
      referencia_pago,
      banco_origen,
      comprobante_url,
      estatus,
      notas
    } = req.body;

    if (!tipo || !categoria || !concepto || !proveedor_cliente) {
      return res.status(400).json({ error: 'Faltan campos obligatorios (tipo, categoría, concepto, proveedor/cliente)' });
    }

    const resultado = await finanzasService.registrarMovimiento({
      tipo,
      categoria,
      fecha,
      concepto,
      proveedor_cliente,
      rif_cedula,
      nro_factura_documento,
      nro_control_fiscal,
      base_imponible,
      monto_exento,
      alicuota_iva,
      monto_iva,
      monto_total,
      moneda,
      tasa_bcv,
      metodo_pago,
      referencia_pago,
      banco_origen,
      comprobante_url,
      estatus,
      notas
    }, userId);

    return res.status(201).json({ success: true, data: resultado });
  } catch (error: any) {
    console.error('Error al registrar movimiento financiero:', error);
    return res.status(500).json({ error: error.message || 'Error al registrar movimiento financiero' });
  }
}

export async function actualizarMovimiento(req: Request, res: Response) {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    const resultado = await finanzasService.actualizarMovimiento(id, req.body);
    return res.json({ success: true, data: resultado });
  } catch (error: any) {
    console.error('Error al actualizar movimiento financiero:', error);
    return res.status(500).json({ error: error.message || 'Error al actualizar movimiento financiero' });
  }
}

export async function anularMovimiento(req: Request, res: Response) {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    const { motivo } = req.body;
    const resultado = await finanzasService.anularMovimiento(id, motivo);
    return res.json({ success: true, data: resultado });
  } catch (error: any) {
    console.error('Error al anular movimiento financiero:', error);
    return res.status(500).json({ error: error.message || 'Error al anular movimiento financiero' });
  }
}

export async function eliminarMovimiento(req: Request, res: Response) {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    const resultado = await finanzasService.eliminarMovimiento(id);
    return res.json({ success: true, data: resultado });
  } catch (error: any) {
    console.error('Error al eliminar movimiento financiero:', error);
    return res.status(500).json({ error: error.message || 'Error al eliminar movimiento financiero' });
  }
}

// ── CONTROLADORES DE TASAS DE CAMBIO Y REFERENCIAS ──

export async function getTasasReferencias(req: Request, res: Response) {
  try {
    const force = req.query.force === 'true' || req.query.force === '1';
    const snapshot = await tasasService.getTasas(force);
    return res.json({ success: true, data: snapshot });
  } catch (error: any) {
    console.error('Error al obtener referencias cambiarias:', error);
    return res.status(500).json({ success: false, error: error.message || 'Error al obtener tasas de cambio' });
  }
}

export async function sincronizarTasasEnVivo(_req: Request, res: Response) {
  try {
    const snapshot = await tasasService.sincronizarEnVivo();
    return res.json({
      success: true,
      message: 'Tasas sincronizadas en vivo exitosamente',
      data: snapshot
    });
  } catch (error: any) {
    console.error('Error sincronizando tasas en vivo:', error);
    return res.status(500).json({ success: false, error: error.message || 'Error al sincronizar tasas en vivo' });
  }
}

export async function actualizarTasaManual(req: Request, res: Response) {
  try {
    const codigo = String(req.params.codigo).toUpperCase();
    if (codigo !== 'USD_BCV' && codigo !== 'USDT_BINANCE') {
      return res.status(400).json({ success: false, error: 'Código de tasa no soportado. Use USD_BCV o USDT_BINANCE' });
    }

    const tasa = parseFloat(req.body.tasa);
    if (isNaN(tasa) || tasa <= 0) {
      return res.status(400).json({ success: false, error: 'La tasa debe ser un número mayor a 0' });
    }

    const actualizada = await tasasService.setTasaManual(codigo as any, tasa);
    return res.json({
      success: true,
      message: `Tasa ${codigo} actualizada manualmente a Bs. ${tasa.toFixed(2)}`,
      data: actualizada
    });
  } catch (error: any) {
    console.error('Error actualizando tasa manual:', error);
    return res.status(500).json({ success: false, error: error.message || 'Error al actualizar tasa manual' });
  }
}

export async function resetTasaManual(req: Request, res: Response) {
  try {
    const codigo = String(req.params.codigo).toUpperCase();
    if (codigo !== 'USD_BCV' && codigo !== 'USDT_BINANCE') {
      return res.status(400).json({ success: false, error: 'Código de tasa no soportado' });
    }

    await tasasService.resetTasaAuto(codigo as any);
    const snapshot = await tasasService.getTasas(true);
    return res.json({
      success: true,
      message: `Tasa ${codigo} restablecida a sincronización automática`,
      data: snapshot
    });
  } catch (error: any) {
    console.error('Error restableciendo tasa:', error);
    return res.status(500).json({ success: false, error: error.message || 'Error al restablecer tasa automática' });
  }
}

export async function getHistorialTasas(req: Request, res: Response) {
  try {
    const codigo = req.query.codigo ? String(req.query.codigo) : undefined;
    const limite = req.query.limite ? parseInt(String(req.query.limite), 10) : 50;
    const historial = await tasasService.getHistorial(codigo, limite);
    return res.json({ success: true, data: historial });
  } catch (error: any) {
    console.error('Error obteniendo historial de tasas:', error);
    return res.status(500).json({ success: false, error: error.message || 'Error al obtener historial' });
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// Reportes de control: ingresos por concepto, cierre de caja, cuentas por cobrar, Excel
// ─────────────────────────────────────────────────────────────────────────────

/** Responde con el status de los errores de negocio (`status`) o 500. */
function responderError(res: Response, error: unknown, contexto: string) {
  const status = (error as { status?: number }).status
  if (status) return res.status(status).json({ success: false, message: (error as Error).message })
  console.error(`${contexto}:`, error)
  return res.status(500).json({ success: false, message: `Error en ${contexto}` })
}

const anioDe = (req: Request) => Number(req.query.anio) || new Date().getFullYear()

export async function getIngresosPorConcepto(req: Request, res: Response) {
  try {
    return res.json({ success: true, data: await ingresosPorConcepto(anioDe(req)) });
  } catch (error) {
    return responderError(res, error, 'ingresos por concepto');
  }
}

export async function getCierreCajaController(req: Request, res: Response) {
  try {
    return res.json({ success: true, data: await getCierreCaja(String(req.query.fecha ?? hoyCaracas())) });
  } catch (error) {
    return responderError(res, error, 'cierre de caja');
  }
}

export async function cerrarCajaController(req: Request, res: Response) {
  try {
    const { fecha, observaciones } = req.body ?? {};
    return res.status(201).json({ success: true, data: await cerrarCaja(String(fecha ?? hoyCaracas()), req.user!.id, typeof observaciones === 'string' ? observaciones : null) });
  } catch (error) {
    return responderError(res, error, 'cierre de caja');
  }
}

export async function getCuentasPorCobrar(_req: Request, res: Response) {
  try {
    return res.json({ success: true, data: await cuentasPorCobrar() });
  } catch (error) {
    return responderError(res, error, 'cuentas por cobrar');
  }
}

/** Filas con encabezados en español para cada reporte exportable. */
async function filasReporte(reporte: string, req: Request): Promise<Record<string, unknown>[] | null> {
  const filtros = parseFiltros(req);
  if (reporte === 'libro-ventas') {
    const { items } = await finanzasService.getLibroVentas(filtros);
    return items.map(i => ({
      Fecha: i.fecha.slice(0, 10), Documento: i.documento, Cliente: i.cliente, 'RIF/C.I.': i.rif_cedula,
      Concepto: i.concepto, Categoría: ETIQUETA_CONCEPTO[i.concepto_reporte], Método: i.metodo_pago, Moneda: i.moneda,
      'Monto original': i.monto_original, 'Tasa BCV': i.tasa_bcv || null, 'Monto USD': i.monto_usd, Referencia: i.referencia, Cajero: i.cajero,
    }));
  }
  if (reporte === 'libro-compras') {
    const { items } = await finanzasService.getLibroCompras(filtros);
    return items.map((i: any) => ({
      Fecha: i.fecha.slice(0, 10), Factura: i.nro_factura_documento, 'N° control': i.nro_control_fiscal, Proveedor: i.proveedor,
      'RIF/C.I.': i.rif_cedula, Concepto: i.concepto, Categoría: i.categoria, Exento: i.monto_exento, Base: i.base_imponible,
      'IVA %': i.alicuota_iva, IVA: i.monto_iva, 'Total USD': i.monto_usd_equivalente, Método: i.metodo_pago, Estatus: i.estatus,
    }));
  }
  if (reporte === 'ingresos-por-concepto') {
    const r = await ingresosPorConcepto(anioDe(req));
    const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const fila = (nombre: string, meses: number[], total: number) =>
      ({ Concepto: nombre, ...Object.fromEntries(MESES.map((m, i) => [m, meses[i]])), Total: total });
    return [...r.conceptos.map(c => fila(c.etiqueta, c.meses, c.total)), fila('TOTAL', r.totalesMes, r.total)];
  }
  if (reporte === 'cuentas-por-cobrar') {
    const r = await cuentasPorCobrar();
    return r.filas.map(f => ({
      Tipo: f.tipo === 'curso' ? 'Curso' : 'Mensualidad', 'N° afiliado': f.codigo, Nombre: f.nombre, 'C.I./RIF': f.identificacion,
      Correo: f.email, Detalle: f.detalle, 'Monto USD': f.monto_usd, 'Días vencido': f.dias, Antigüedad: f.tramo,
    }));
  }
  return null;
}

/** GET /api/finanzas/export/:reporte.xlsx — mismos filtros que el reporte en pantalla */
export async function exportarXlsx(req: Request, res: Response) {
  try {
    const reporte = String(req.params.reporte);
    const filas = await filasReporte(reporte, req);
    if (!filas) return res.status(404).json({ success: false, message: 'Reporte no disponible' });
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(filas), reporte.slice(0, 31));
    const buffer = XLSX.write(libro, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${reporte}-${hoyCaracas()}.xlsx"`);
    return res.send(buffer);
  } catch (error) {
    return responderError(res, error, 'exportación a Excel');
  }
}
