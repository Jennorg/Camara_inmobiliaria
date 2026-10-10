import { Request, Response } from 'express';
import { finanzasService, FiltrosFinanzas } from '../services/finanzas.service.js';

function parseFiltros(req: Request): FiltrosFinanzas {
  const { anio, mes, fechaInicio, fechaFin, search, categoria, tipo } = req.query;
  return {
    anio: anio ? parseInt(String(anio), 10) : undefined,
    mes: mes ? parseInt(String(mes), 10) : undefined,
    fechaInicio: fechaInicio ? String(fechaInicio) : undefined,
    fechaFin: fechaFin ? String(fechaFin) : undefined,
    search: search ? String(search) : undefined,
    categoria: categoria ? String(categoria) : undefined,
    tipo: tipo === 'ingreso' || tipo === 'egreso' ? tipo : undefined
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
