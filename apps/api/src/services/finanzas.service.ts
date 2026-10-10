import { db } from '../lib/db.js';

export interface FiltrosFinanzas {
  anio?: number;
  mes?: number;
  fechaInicio?: string;
  fechaFin?: string;
  search?: string;
  categoria?: string;
  tipo?: 'ingreso' | 'egreso';
}

export interface MovimientoInput {
  tipo: 'ingreso' | 'egreso';
  categoria: string;
  fecha: string;
  concepto: string;
  proveedor_cliente: string;
  rif_cedula?: string | null;
  nro_factura_documento?: string | null;
  nro_control_fiscal?: string | null;
  base_imponible?: number;
  monto_exento?: number;
  alicuota_iva?: number;
  monto_iva?: number;
  monto_total: number;
  moneda?: 'USD' | 'VES';
  tasa_bcv?: number;
  metodo_pago?: string;
  referencia_pago?: string | null;
  banco_origen?: string | null;
  comprobante_url?: string | null;
  estatus?: 'completado' | 'pendiente' | 'anulado';
  notas?: string | null;
}

const MESES_NOMBRES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/**
 * Normaliza y construye condiciones de fecha SQL para filtrar por año/mes o rango.
 */
function buildDateCondition(campoFecha: string, filtros: FiltrosFinanzas): { sql: string; args: any[] } {
  const conditions: string[] = [];
  const args: any[] = [];

  if (filtros.fechaInicio && filtros.fechaFin) {
    conditions.push(`${campoFecha} >= ? AND ${campoFecha} <= ?`);
    args.push(filtros.fechaInicio, filtros.fechaFin);
  } else if (filtros.anio && filtros.mes) {
    const mesStr = String(filtros.mes).padStart(2, '0');
    const anioMes = `${filtros.anio}-${mesStr}`;
    conditions.push(`${campoFecha} LIKE ?`);
    args.push(`${anioMes}%`);
  } else if (filtros.anio) {
    conditions.push(`${campoFecha} LIKE ?`);
    args.push(`${filtros.anio}%`);
  }

  return {
    sql: conditions.length > 0 ? conditions.join(' AND ') : '1=1',
    args
  };
}

export interface ItemVenta {
  id: string;
  id_pago: number | null;
  tipo_origen: 'pago_recibo' | 'movimiento_manual';
  fecha: string;
  documento: string;
  nro_control: string | null;
  cliente: string;
  rif_cedula: string;
  concepto: string;
  categoria: string;
  metodo_pago: string;
  moneda: string;
  monto_original: number;
  monto_usd: number;
  tasa_bcv: number;
  base_imponible: number;
  monto_exento: number;
  alicuota_iva: number;
  monto_iva: number;
  referencia: string | null;
}

export const finanzasService = {
  /**
   * Obtiene el resumen general de flujo de caja y KPIs contables
   */
  async getResumenFinanciero(filtros: FiltrosFinanzas = {}) {
    const anioActual = filtros.anio || new Date().getFullYear();

    // 1. Ingresos provenientes de pagos verificados
    const dateCondPagos = buildDateCondition('p.fecha_pago', filtros);
    const pagosRes = await db.execute({
      sql: `SELECT 
              COALESCE(SUM(p.monto_usd_equivalente), 0) as total_usd,
              COUNT(p.id_pago) as conteo
            FROM pagos p
            WHERE p.estatus = 'Verificado'
              AND p.eliminado_en IS NULL
              AND ${dateCondPagos.sql}`,
      args: dateCondPagos.args
    });
    const totalPagosUSD = Number(pagosRes.rows[0]?.total_usd || 0);
    const conteoPagos = Number(pagosRes.rows[0]?.conteo || 0);

    // 2. Ingresos manuales en movimientos_financieros (sin id_pago para evitar duplicados)
    const dateCondIngresosManuales = buildDateCondition('m.fecha', filtros);
    const ingManualesRes = await db.execute({
      sql: `SELECT 
              COALESCE(SUM(m.monto_usd_equivalente), 0) as total_usd,
              COUNT(m.id_movimiento) as conteo,
              COALESCE(SUM(m.monto_iva), 0) as total_iva
            FROM movimientos_financieros m
            WHERE m.tipo = 'ingreso'
              AND m.estatus != 'anulado'
              AND m.id_pago IS NULL
              AND m.eliminado_en IS NULL
              AND ${dateCondIngresosManuales.sql}`,
      args: dateCondIngresosManuales.args
    });
    const totalIngManualesUSD = Number(ingManualesRes.rows[0]?.total_usd || 0);
    const conteoIngManuales = Number(ingManualesRes.rows[0]?.conteo || 0);
    const totalIvaDebito = Number(ingManualesRes.rows[0]?.total_iva || 0);

    const totalIngresosUSD = totalPagosUSD + totalIngManualesUSD;
    const conteoIngresos = conteoPagos + conteoIngManuales;

    // 3. Egresos (Gastos Operativos y Compras)
    const dateCondEgresos = buildDateCondition('m.fecha', filtros);
    const egresosRes = await db.execute({
      sql: `SELECT 
              COALESCE(SUM(m.monto_usd_equivalente), 0) as total_usd,
              COUNT(m.id_movimiento) as conteo,
              COALESCE(SUM(m.monto_iva), 0) as total_iva_credito,
              COALESCE(SUM(m.base_imponible), 0) as total_base,
              COALESCE(SUM(m.monto_exento), 0) as total_exento
            FROM movimientos_financieros m
            WHERE m.tipo = 'egreso'
              AND m.estatus != 'anulado'
              AND m.eliminado_en IS NULL
              AND ${dateCondEgresos.sql}`,
      args: dateCondEgresos.args
    });
    const totalEgresosUSD = Number(egresosRes.rows[0]?.total_usd || 0);
    const conteoEgresos = Number(egresosRes.rows[0]?.conteo || 0);
    const totalIvaCredito = Number(egresosRes.rows[0]?.total_iva_credito || 0);
    const totalBaseCompras = Number(egresosRes.rows[0]?.total_base || 0);
    const totalExentoCompras = Number(egresosRes.rows[0]?.total_exento || 0);

    const flujoNetoUSD = totalIngresosUSD - totalEgresosUSD;

    // 4. Histórico Mensual para gráficos (12 meses del año)
    const historicoMensual = [];
    for (let m = 1; m <= 12; m++) {
      const mesStr = String(m).padStart(2, '0');
      const prefix = `${anioActual}-${mesStr}`;

      const ingPagosMes = await db.execute({
        sql: `SELECT COALESCE(SUM(monto_usd_equivalente), 0) as t FROM pagos WHERE estatus = 'Verificado' AND fecha_pago LIKE ?`,
        args: [`${prefix}%`]
      });
      const ingManualMes = await db.execute({
        sql: `SELECT COALESCE(SUM(monto_usd_equivalente), 0) as t FROM movimientos_financieros WHERE tipo = 'ingreso' AND estatus != 'anulado' AND id_pago IS NULL AND fecha LIKE ?`,
        args: [`${prefix}%`]
      });
      const egresosMes = await db.execute({
        sql: `SELECT COALESCE(SUM(monto_usd_equivalente), 0) as t FROM movimientos_financieros WHERE tipo = 'egreso' AND estatus != 'anulado' AND fecha LIKE ?`,
        args: [`${prefix}%`]
      });

      const ing = Number(ingPagosMes.rows[0]?.t || 0) + Number(ingManualMes.rows[0]?.t || 0);
      const eg = Number(egresosMes.rows[0]?.t || 0);

      historicoMensual.push({
        mesNumero: m,
        mes: MESES_NOMBRES[m - 1],
        ingresos: Math.round(ing * 100) / 100,
        egresos: Math.round(eg * 100) / 100,
        neto: Math.round((ing - eg) * 100) / 100
      });
    }

    // 5. Desglose de egresos por categoría
    const categoriasRes = await db.execute({
      sql: `SELECT 
              m.categoria, 
              COALESCE(SUM(m.monto_usd_equivalente), 0) as total,
              COUNT(m.id_movimiento) as cantidad
            FROM movimientos_financieros m 
            WHERE m.tipo = 'egreso' 
              AND m.estatus != 'anulado' 
              AND m.eliminado_en IS NULL
              AND ${dateCondEgresos.sql}
            GROUP BY m.categoria
            ORDER BY total DESC`,
      args: dateCondEgresos.args
    });

    return {
      periodo: {
        anio: anioActual,
        mes: filtros.mes || null,
        fechaInicio: filtros.fechaInicio || null,
        fechaFin: filtros.fechaFin || null
      },
      kpis: {
        totalIngresosUSD: Math.round(totalIngresosUSD * 100) / 100,
        totalEgresosUSD: Math.round(totalEgresosUSD * 100) / 100,
        flujoNetoUSD: Math.round(flujoNetoUSD * 100) / 100,
        ivaDebitoFiscal: Math.round(totalIvaDebito * 100) / 100,
        ivaCreditoFiscal: Math.round(totalIvaCredito * 100) / 100,
        totalBaseCompras: Math.round(totalBaseCompras * 100) / 100,
        totalExentoCompras: Math.round(totalExentoCompras * 100) / 100,
        conteoIngresos,
        conteoEgresos
      },
      historicoMensual,
      gastosPorCategoria: categoriasRes.rows.map((r: any) => ({
        categoria: String(r.categoria),
        total: Number(r.total),
        cantidad: Number(r.cantidad)
      }))
    };
  },

  /**
   * Libro de Ventas (Ingresos por afiliación, cuotas, CIBIR y cursos)
   */
  async getLibroVentas(filtros: FiltrosFinanzas = {}) {
    const dateCond = buildDateCondition('p.fecha_pago', filtros);

    const pagosQuery = `
      SELECT 
        p.id_pago,
        p.numero_recibo,
        p.fecha_pago as fecha,
        p.tipo_concepto,
        p.descripcion_concepto as concepto,
        p.metodo_pago,
        p.moneda,
        p.monto as monto_original,
        p.monto_usd_equivalente as monto_usd,
        p.tasa_bcv,
        p.referencia,
        p.titular_origen,
        p.estatus,
        p.creado_en,
        a.id_afiliado,
        a.codigo as codigo_afiliado,
        a.tipo_afiliado,
        per.nombres || ' ' || COALESCE(per.apellidos, '') as nombre_persona,
        per.cedula as cedula_persona,
        per.cedula_tipo as cedula_tipo_persona,
        emp.razon_social as razon_social_empresa,
        emp.rif_tipo as rif_tipo_empresa,
        emp.rif_numero as rif_numero_empresa
      FROM pagos p
      LEFT JOIN afiliados a ON p.id_afiliado = a.id_afiliado
      LEFT JOIN personas per ON a.id_persona = per.id
      LEFT JOIN empresas emp ON a.id_empresa = emp.id_empresa
      WHERE p.estatus = 'Verificado'
        AND p.eliminado_en IS NULL
        AND ${dateCond.sql}
      ORDER BY p.fecha_pago DESC, p.id_pago DESC
    `;

    const pagosRes = await db.execute({
      sql: pagosQuery,
      args: dateCond.args
    });

    const itemsVentas: ItemVenta[] = pagosRes.rows.map((r: any): ItemVenta => {
      const esEmpresa = r.tipo_afiliado === 'Corporativo' || !!r.razon_social_empresa;
      let clienteNombre = '';
      if (esEmpresa && r.razon_social_empresa) {
        clienteNombre = String(r.razon_social_empresa);
      } else if (r.nombre_persona && r.nombre_persona.trim().length > 0) {
        clienteNombre = String(r.nombre_persona.trim());
      } else if (r.titular_origen && r.titular_origen.trim().length > 0) {
        clienteNombre = String(r.titular_origen.trim());
      } else {
        clienteNombre = 'Cliente / Afiliado';
      }

      let rifCedula = '';
      if (esEmpresa && r.rif_numero_empresa) {
        rifCedula = `${r.rif_tipo_empresa || 'J'}-${r.rif_numero_empresa}`;
      } else if (r.cedula_persona) {
        rifCedula = `${r.cedula_tipo_persona || 'V'}-${r.cedula_persona}`;
      }

      const montoUsd = Number(r.monto_usd || 0);

      return {
        id: `PAGO-${r.id_pago}`,
        id_pago: Number(r.id_pago),
        tipo_origen: 'pago_recibo' as const,
        fecha: String(r.fecha),
        documento: String(r.numero_recibo),
        nro_control: null as string | null,
        cliente: clienteNombre,
        rif_cedula: rifCedula,
        concepto: String(r.concepto),
        categoria: String(r.tipo_concepto || 'afiliacion'),
        metodo_pago: String(r.metodo_pago),
        moneda: String(r.moneda),
        monto_original: Number(r.monto_original),
        monto_usd: montoUsd,
        tasa_bcv: Number(r.tasa_bcv || 0),
        base_imponible: 0, // Servicios gremiales exentos/no sujetos
        monto_exento: montoUsd,
        alicuota_iva: 0,
        monto_iva: 0,
        referencia: r.referencia ? String(r.referencia) : null
      };
    });

    // Ingresos manuales no vinculados a pagos
    const dateCondManual = buildDateCondition('m.fecha', filtros);
    const manualesRes = await db.execute({
      sql: `SELECT * FROM movimientos_financieros m 
            WHERE m.tipo = 'ingreso' 
              AND m.estatus != 'anulado' 
              AND m.id_pago IS NULL 
              AND m.eliminado_en IS NULL
              AND ${dateCondManual.sql}
            ORDER BY m.fecha DESC`,
      args: dateCondManual.args
    });

    for (const m of manualesRes.rows as any[]) {
      itemsVentas.push({
        id: `MOV-${m.id_movimiento}`,
        id_pago: null,
        tipo_origen: 'movimiento_manual' as const,
        fecha: String(m.fecha),
        documento: String(m.nro_factura_documento || `ING-${m.id_movimiento}`),
        nro_control: m.nro_control_fiscal ? String(m.nro_control_fiscal) : null,
        cliente: String(m.proveedor_cliente),
        rif_cedula: String(m.rif_cedula || ''),
        concepto: String(m.concepto),
        categoria: String(m.categoria),
        metodo_pago: String(m.metodo_pago),
        moneda: String(m.moneda),
        monto_original: Number(m.monto_total),
        monto_usd: Number(m.monto_usd_equivalente),
        tasa_bcv: Number(m.tasa_bcv || 0),
        base_imponible: Number(m.base_imponible || 0),
        monto_exento: Number(m.monto_exento || 0),
        alicuota_iva: Number(m.alicuota_iva || 0),
        monto_iva: Number(m.monto_iva || 0),
        referencia: m.referencia_pago ? String(m.referencia_pago) : null
      });
    }

    // Filtrar por búsqueda si se especificó
    let filtrados = itemsVentas;
    if (filtros.search) {
      const q = filtros.search.toLowerCase();
      filtrados = itemsVentas.filter((i: any) => 
        i.cliente.toLowerCase().includes(q) ||
        i.documento.toLowerCase().includes(q) ||
        i.concepto.toLowerCase().includes(q) ||
        i.rif_cedula.toLowerCase().includes(q)
      );
    }

    const totalVentasUSD = filtrados.reduce((acc: number, i: any) => acc + i.monto_usd, 0);
    const totalExentoUSD = filtrados.reduce((acc: number, i: any) => acc + i.monto_exento, 0);
    const totalBaseUSD = filtrados.reduce((acc: number, i: any) => acc + i.base_imponible, 0);
    const totalIvaUSD = filtrados.reduce((acc: number, i: any) => acc + i.monto_iva, 0);

    return {
      totales: {
        totalVentasUSD: Math.round(totalVentasUSD * 100) / 100,
        totalExentoUSD: Math.round(totalExentoUSD * 100) / 100,
        totalBaseUSD: Math.round(totalBaseUSD * 100) / 100,
        totalIvaUSD: Math.round(totalIvaUSD * 100) / 100,
        cantidadRegistros: filtrados.length
      },
      items: filtrados
    };
  },

  /**
   * Libro de Compras (Gastos operativos, servicios, alquiler, suministros y facturas con crédito fiscal)
   */
  async getLibroCompras(filtros: FiltrosFinanzas = {}) {
    const dateCond = buildDateCondition('m.fecha', filtros);

    let sql = `
      SELECT 
        m.*
      FROM movimientos_financieros m
      WHERE m.tipo = 'egreso'
        AND m.eliminado_en IS NULL
        AND ${dateCond.sql}
    `;
    const args = [...dateCond.args];

    if (filtros.categoria) {
      sql += ` AND m.categoria = ?`;
      args.push(filtros.categoria);
    }

    sql += ` ORDER BY m.fecha DESC, m.id_movimiento DESC`;

    const res = await db.execute({ sql, args });

    let items = res.rows.map((r: any) => ({
      id_movimiento: Number(r.id_movimiento),
      fecha: String(r.fecha),
      nro_factura_documento: String(r.nro_factura_documento || `EGR-${r.id_movimiento}`),
      nro_control_fiscal: r.nro_control_fiscal ? String(r.nro_control_fiscal) : null,
      proveedor: String(r.proveedor_cliente),
      rif_cedula: String(r.rif_cedula || ''),
      concepto: String(r.concepto),
      categoria: String(r.categoria),
      base_imponible: Number(r.base_imponible || 0),
      monto_exento: Number(r.monto_exento || 0),
      alicuota_iva: Number(r.alicuota_iva || 16),
      monto_iva: Number(r.monto_iva || 0),
      monto_total: Number(r.monto_total),
      monto_usd_equivalente: Number(r.monto_usd_equivalente),
      moneda: String(r.moneda || 'USD'),
      tasa_bcv: Number(r.tasa_bcv || 0),
      metodo_pago: String(r.metodo_pago),
      referencia_pago: r.referencia_pago ? String(r.referencia_pago) : null,
      comprobante_url: r.comprobante_url ? String(r.comprobante_url) : null,
      estatus: String(r.estatus),
      notas: r.notas ? String(r.notas) : null,
      creado_en: String(r.creado_en)
    }));

    if (filtros.search) {
      const q = filtros.search.toLowerCase();
      items = items.filter((i: any) =>
        i.proveedor.toLowerCase().includes(q) ||
        i.nro_factura_documento.toLowerCase().includes(q) ||
        (i.nro_control_fiscal && i.nro_control_fiscal.toLowerCase().includes(q)) ||
        i.concepto.toLowerCase().includes(q) ||
        i.rif_cedula.toLowerCase().includes(q)
      );
    }

    const totalComprasUSD = items.filter((i: any) => i.estatus !== 'anulado').reduce((acc: number, i: any) => acc + i.monto_usd_equivalente, 0);
    const totalBaseUSD = items.filter((i: any) => i.estatus !== 'anulado').reduce((acc: number, i: any) => acc + i.base_imponible, 0);
    const totalExentoUSD = items.filter((i: any) => i.estatus !== 'anulado').reduce((acc: number, i: any) => acc + i.monto_exento, 0);
    const totalIvaCreditoUSD = items.filter((i: any) => i.estatus !== 'anulado').reduce((acc: number, i: any) => acc + i.monto_iva, 0);

    return {
      totales: {
        totalComprasUSD: Math.round(totalComprasUSD * 100) / 100,
        totalBaseUSD: Math.round(totalBaseUSD * 100) / 100,
        totalExentoUSD: Math.round(totalExentoUSD * 100) / 100,
        totalIvaCreditoUSD: Math.round(totalIvaCreditoUSD * 100) / 100,
        cantidadRegistros: items.length
      },
      items
    };
  },

  /**
   * Registra una compra / gasto operativo o ingreso manual
   */
  async registrarMovimiento(data: MovimientoInput, registradoPor?: number) {
    const fecha = data.fecha || new Date().toISOString().slice(0, 10);
    const moneda = data.moneda || 'USD';
    const tasaBcv = Number(data.tasa_bcv || 1);

    const base = Number(data.base_imponible || 0);
    const exento = Number(data.monto_exento || 0);
    const alicuota = Number(data.alicuota_iva !== undefined ? data.alicuota_iva : 16);
    let iva = Number(data.monto_iva !== undefined ? data.monto_iva : (base * (alicuota / 100)));
    
    let total = Number(data.monto_total || (base + exento + iva));
    if (total <= 0) {
      total = base + exento + iva;
    }

    const usdEquivalente = moneda === 'VES' && tasaBcv > 0 ? (total / tasaBcv) : total;

    const res = await db.execute({
      sql: `INSERT INTO movimientos_financieros (
              tipo, categoria, fecha, concepto, proveedor_cliente, rif_cedula,
              nro_factura_documento, nro_control_fiscal, base_imponible, monto_exento,
              alicuota_iva, monto_iva, monto_total, monto_usd_equivalente, moneda,
              tasa_bcv, metodo_pago, referencia_pago, banco_origen, comprobante_url,
              estatus, notas, registrado_por
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        data.tipo,
        data.categoria,
        fecha,
        data.concepto,
        data.proveedor_cliente,
        data.rif_cedula || null,
        data.nro_factura_documento || null,
        data.nro_control_fiscal || null,
        base,
        exento,
        alicuota,
        iva,
        total,
        usdEquivalente,
        moneda,
        tasaBcv,
        data.metodo_pago || 'transferencia',
        data.referencia_pago || null,
        data.banco_origen || null,
        data.comprobante_url || null,
        data.estatus || 'completado',
        data.notas || null,
        registradoPor || null
      ]
    });

    const newId = Number(res.lastInsertRowid);
    return { id_movimiento: newId, message: 'Movimiento financiero registrado exitosamente' };
  },

  /**
   * Actualiza un movimiento financiero
   */
  async actualizarMovimiento(id: number, data: Partial<MovimientoInput>) {
    const existing = await db.execute({
      sql: `SELECT * FROM movimientos_financieros WHERE id_movimiento = ? AND eliminado_en IS NULL`,
      args: [id]
    });
    if (!existing.rows.length) {
      throw new Error('Movimiento no encontrado');
    }

    const updates: string[] = [];
    const args: any[] = [];

    if (data.concepto !== undefined) { updates.push('concepto = ?'); args.push(data.concepto); }
    if (data.proveedor_cliente !== undefined) { updates.push('proveedor_cliente = ?'); args.push(data.proveedor_cliente); }
    if (data.rif_cedula !== undefined) { updates.push('rif_cedula = ?'); args.push(data.rif_cedula); }
    if (data.nro_factura_documento !== undefined) { updates.push('nro_factura_documento = ?'); args.push(data.nro_factura_documento); }
    if (data.nro_control_fiscal !== undefined) { updates.push('nro_control_fiscal = ?'); args.push(data.nro_control_fiscal); }
    if (data.categoria !== undefined) { updates.push('categoria = ?'); args.push(data.categoria); }
    if (data.fecha !== undefined) { updates.push('fecha = ?'); args.push(data.fecha); }
    if (data.base_imponible !== undefined) { updates.push('base_imponible = ?'); args.push(data.base_imponible); }
    if (data.monto_exento !== undefined) { updates.push('monto_exento = ?'); args.push(data.monto_exento); }
    if (data.monto_iva !== undefined) { updates.push('monto_iva = ?'); args.push(data.monto_iva); }
    if (data.monto_total !== undefined) { updates.push('monto_total = ?'); args.push(data.monto_total); }
    if (data.metodo_pago !== undefined) { updates.push('metodo_pago = ?'); args.push(data.metodo_pago); }
    if (data.referencia_pago !== undefined) { updates.push('referencia_pago = ?'); args.push(data.referencia_pago); }
    if (data.comprobante_url !== undefined) { updates.push('comprobante_url = ?'); args.push(data.comprobante_url); }
    if (data.notas !== undefined) { updates.push('notas = ?'); args.push(data.notas); }

    updates.push("actualizado_en = datetime('now')");
    args.push(id);

    await db.execute({
      sql: `UPDATE movimientos_financieros SET ${updates.join(', ')} WHERE id_movimiento = ?`,
      args
    });

    return { message: 'Movimiento actualizado exitosamente' };
  },

  /**
   * Anula un movimiento financiero con motivo
   */
  async anularMovimiento(id: number, motivo?: string) {
    await db.execute({
      sql: `UPDATE movimientos_financieros 
            SET estatus = 'anulado', motivo_anulacion = ?, actualizado_en = datetime('now') 
            WHERE id_movimiento = ?`,
      args: [motivo || 'Anulado por administración', id]
    });
    return { message: 'Movimiento anulado exitosamente' };
  },

  /**
   * Elimina suavemente un movimiento
   */
  async eliminarMovimiento(id: number) {
    await db.execute({
      sql: `UPDATE movimientos_financieros SET eliminado_en = datetime('now') WHERE id_movimiento = ?`,
      args: [id]
    });
    return { message: 'Movimiento eliminado' };
  }
};
