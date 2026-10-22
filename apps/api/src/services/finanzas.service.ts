import { db } from '../lib/db.js';
import { COLUMNA_FECHA_CUOTA, cuotasImportadas, cuotasImportadasPorPeriodo, fechaCuota } from './cuotas-importadas.service.js';
import { SQL_JOIN_PAGADOR } from './pagos.service.js';
import { CONCEPTOS_REPORTE, ETIQUETA_CONCEPTO, conceptoReporte, type ConceptoReporte } from '../lib/conceptos.js';

export interface FiltrosFinanzas {
  anio?: number;
  mes?: number;
  fechaInicio?: string;
  fechaFin?: string;
  search?: string;
  categoria?: string;
  tipo?: 'ingreso' | 'egreso';
  /** Libro de ventas: concepto de reporte, método de pago y cajero (email de quien registró) */
  concepto?: string;
  metodo?: string;
  cajero?: string;
  /** Paginación de los libros: sin `pagina` se devuelven todas las filas (exportaciones) */
  pagina?: number;
  limite?: number;
}

export interface MovimientoInput {
  tipo: 'ingreso' | 'egreso';
  categoria: string;
  fecha: string;
  concepto: string;
  proveedor_cliente: string;
  rif_cedula?: string | null;
  nro_factura_documento?: string | null;
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

export const LIMITE_LIBRO = 50;

/** Corta una lista ya ordenada en la página pedida; la página se ajusta al rango válido. */
function paginar<T>(items: T[], filtros: FiltrosFinanzas) {
  if (!filtros.pagina) return { items, paginacion: null };
  const limite = Math.min(Math.max(filtros.limite || LIMITE_LIBRO, 1), 200);
  const paginas = Math.max(Math.ceil(items.length / limite), 1);
  const pagina = Math.min(Math.max(filtros.pagina, 1), paginas);
  return { items: items.slice((pagina - 1) * limite, pagina * limite), paginacion: { pagina, limite, total: items.length, paginas } };
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
  tipo_origen: 'pago_recibo' | 'movimiento_manual' | 'cuota_importada';
  fecha: string;
  documento: string;
  cliente: string;
  rif_cedula: string;
  concepto: string;
  categoria: string;
  metodo_pago: string;
  moneda: string;
  monto_original: number;
  monto_usd: number;
  tasa_bcv: number;
  referencia: string | null;
  /** Cuándo se registró en el sistema; ordena el libro (lo más reciente primero) */
  registrado_en: string;
  concepto_reporte: ConceptoReporte;
  cajero: string | null;
}

export const finanzasService = {
  /**
   * Obtiene el resumen general de flujo de caja y KPIs contables
   */
  async getResumenFinanciero(filtros: FiltrosFinanzas = {}) {
    const anio = filtros.anio || new Date().getFullYear();
    const prefijo = `${anio}%`;

    // Se calcula el año completo en una sola pasada (consultas agrupadas por mes y en paralelo): así el cliente
    // cambia de mes al instante, sin volver a pedir nada al servidor.
    const [pagosRes, manualesRes, egresosRes, importadas] = await Promise.all([
      db.execute({
        sql: `SELECT substr(fecha_pago, 6, 2) AS mes, tipo_concepto, codigo_arancel, COALESCE(SUM(monto_usd_equivalente), 0) AS total, COUNT(*) AS n
              FROM pagos WHERE estatus = 'Verificado' AND eliminado_en IS NULL AND fecha_pago LIKE ?
              GROUP BY mes, tipo_concepto, codigo_arancel`,
        args: [prefijo]
      }),
      // Ingresos manuales (sin id_pago para evitar duplicados)
      db.execute({
        sql: `SELECT substr(fecha, 6, 2) AS mes, COALESCE(SUM(monto_usd_equivalente), 0) AS total, COUNT(*) AS n
              FROM movimientos_financieros
              WHERE tipo = 'ingreso' AND estatus != 'anulado' AND id_pago IS NULL AND eliminado_en IS NULL AND fecha LIKE ?
              GROUP BY mes`,
        args: [prefijo]
      }),
      db.execute({
        sql: `SELECT substr(fecha, 6, 2) AS mes, categoria, COALESCE(SUM(monto_usd_equivalente), 0) AS total, COUNT(*) AS n
              FROM movimientos_financieros
              WHERE tipo = 'egreso' AND estatus != 'anulado' AND eliminado_en IS NULL AND fecha LIKE ?
              GROUP BY mes, categoria`,
        args: [prefijo]
      }),
      // Cuotas de sostenimiento del listado de solvencia importado (sin recibo)
      cuotasImportadasPorPeriodo(anio),
    ]);

    const nuevoMes = () => ({
      ingresos: new Map<ConceptoReporte, { total: number; cantidad: number }>(CONCEPTOS_REPORTE.map(c => [c, { total: 0, cantidad: 0 }])),
      gastos: new Map<string, { total: number; cantidad: number }>(),
    });
    const meses = Array.from({ length: 12 }, nuevoMes);
    const sumarIngreso = (m: number, c: ConceptoReporte, total: number, cantidad: number) => {
      const e = meses[m].ingresos.get(c)!;
      e.total += total;
      e.cantidad += cantidad;
    };

    for (const r of pagosRes.rows as any[]) sumarIngreso(Number(r.mes) - 1, conceptoReporte(r.tipo_concepto, r.codigo_arancel), Number(r.total), Number(r.n));
    for (const r of manualesRes.rows as any[]) sumarIngreso(Number(r.mes) - 1, 'otros', Number(r.total), Number(r.n));
    for (const [periodo, n] of importadas.porPeriodo) sumarIngreso(Number(periodo.slice(5, 7)) - 1, 'mensualidad', n * importadas.monto, n);
    for (const r of egresosRes.rows as any[]) {
      const g = meses[Number(r.mes) - 1].gastos;
      const e = g.get(String(r.categoria)) ?? { total: 0, cantidad: 0 };
      e.total += Number(r.total);
      e.cantidad += Number(r.n);
      g.set(String(r.categoria), e);
    }

    const redondear = (n: number) => Math.round(n * 100) / 100;
    /** Resumen de un conjunto de meses (uno o los doce) */
    const resumir = (indices: number[]) => {
      const ingresos = new Map<ConceptoReporte, { total: number; cantidad: number }>(CONCEPTOS_REPORTE.map(c => [c, { total: 0, cantidad: 0 }]));
      const gastos = new Map<string, { total: number; cantidad: number }>();
      for (const i of indices) {
        for (const [c, v] of meses[i].ingresos) { const e = ingresos.get(c)!; e.total += v.total; e.cantidad += v.cantidad; }
        for (const [c, v] of meses[i].gastos) { const e = gastos.get(c) ?? { total: 0, cantidad: 0 }; e.total += v.total; e.cantidad += v.cantidad; gastos.set(c, e); }
      }
      const totalIngresos = [...ingresos.values()].reduce((a, v) => a + v.total, 0);
      const totalEgresos = [...gastos.values()].reduce((a, v) => a + v.total, 0);
      return {
        kpis: {
          totalIngresosUSD: redondear(totalIngresos),
          totalEgresosUSD: redondear(totalEgresos),
          flujoNetoUSD: redondear(totalIngresos - totalEgresos),
          conteoIngresos: [...ingresos.values()].reduce((a, v) => a + v.cantidad, 0),
          conteoEgresos: [...gastos.values()].reduce((a, v) => a + v.cantidad, 0),
        },
        ingresosPorConcepto: CONCEPTOS_REPORTE
          .map(c => ({ concepto: c, etiqueta: ETIQUETA_CONCEPTO[c], total: redondear(ingresos.get(c)!.total), cantidad: ingresos.get(c)!.cantidad }))
          .filter(c => c.total > 0)
          .sort((a, b) => b.total - a.total),
        gastosPorCategoria: [...gastos.entries()]
          .map(([categoria, v]) => ({ categoria, total: redondear(v.total), cantidad: v.cantidad }))
          .sort((a, b) => b.total - a.total),
      };
    };

    const porMes = meses.map((_, i) => ({ mesNumero: i + 1, ...resumir([i]) }));
    const anual = resumir(meses.map((_, i) => i));
    const mes = filtros.mes && filtros.mes >= 1 && filtros.mes <= 12 ? filtros.mes : null;
    const periodo = mes ? porMes[mes - 1] : anual;

    return {
      periodo: { anio, mes, fechaInicio: null, fechaFin: null },
      kpis: periodo.kpis,
      ingresosPorConcepto: periodo.ingresosPorConcepto,
      gastosPorCategoria: periodo.gastosPorCategoria,
      historicoMensual: porMes.map(m => ({
        mesNumero: m.mesNumero,
        mes: MESES_NOMBRES[m.mesNumero - 1],
        ingresos: m.kpis.totalIngresosUSD,
        egresos: m.kpis.totalEgresosUSD,
        neto: m.kpis.flujoNetoUSD,
      })),
      // El año completo y cada mes, para que el cliente cambie de período sin ir al servidor
      anual,
      meses: porMes,
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
        p.codigo_arancel,
        u_reg.email as cajero,
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
      ${SQL_JOIN_PAGADOR}
      LEFT JOIN users u_reg ON u_reg.id = p.registrado_por
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
        cliente: clienteNombre,
        rif_cedula: rifCedula,
        concepto: String(r.concepto),
        categoria: String(r.tipo_concepto || 'afiliacion'),
        metodo_pago: String(r.metodo_pago),
        moneda: String(r.moneda),
        monto_original: Number(r.monto_original),
        monto_usd: montoUsd,
        tasa_bcv: Number(r.tasa_bcv || 0),
        referencia: r.referencia ? String(r.referencia) : null,
        registrado_en: String(r.creado_en),
        concepto_reporte: conceptoReporte(r.tipo_concepto, r.codigo_arancel),
        cajero: r.cajero ? String(r.cajero) : null
      };
    });

    // Ingresos manuales no vinculados a pagos
    const dateCondManual = buildDateCondition('m.fecha', filtros);
    const manualesRes = await db.execute({
      sql: `SELECT m.*, u.email AS cajero FROM movimientos_financieros m
            LEFT JOIN users u ON u.id = m.registrado_por
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
        cliente: String(m.proveedor_cliente),
        rif_cedula: String(m.rif_cedula || ''),
        concepto: String(m.concepto),
        categoria: String(m.categoria),
        metodo_pago: String(m.metodo_pago),
        moneda: String(m.moneda),
        monto_original: Number(m.monto_total),
        monto_usd: Number(m.monto_usd_equivalente),
        tasa_bcv: Number(m.tasa_bcv || 0),
        referencia: m.referencia_pago ? String(m.referencia_pago) : null,
        registrado_en: String(m.creado_en),
        concepto_reporte: 'otros',
        cajero: m.cajero ? String(m.cajero) : null
      });
    }

    // Cuotas de sostenimiento del listado de solvencia importado: una fila por afiliado y mes, sin recibo
    for (const c of await cuotasImportadas(buildDateCondition(COLUMNA_FECHA_CUOTA, filtros))) {
      itemsVentas.push({
        id: `SOL-${c.id_afiliado}-${c.periodo}`,
        id_pago: null,
        tipo_origen: 'cuota_importada' as const,
        fecha: fechaCuota(c.periodo),
        documento: `SOL-${c.periodo}-${c.codigo ?? c.id_afiliado}`,
        cliente: c.nombre,
        rif_cedula: c.identificacion,
        concepto: `Cuota de sostenimiento ${c.periodo} (${c.fuente?.startsWith('manual') ? 'marcada manualmente' : 'listado importado'})`,
        categoria: 'mensualidad',
        metodo_pago: 'importado',
        moneda: 'USD',
        monto_original: c.monto_usd,
        monto_usd: c.monto_usd,
        tasa_bcv: 0,
        referencia: c.fuente,
        registrado_en: c.importado_en,
        concepto_reporte: 'mensualidad',
        cajero: null,
      });
    }
    // Lo registrado más recientemente primero; la fecha del movimiento desempata
    itemsVentas.sort((a, b) => b.registrado_en.localeCompare(a.registrado_en) || b.fecha.localeCompare(a.fecha));

    // Filtrar por búsqueda si se especificó
    let filtrados = itemsVentas.filter(i =>
      (!filtros.concepto || i.concepto_reporte === filtros.concepto) &&
      (!filtros.metodo || i.metodo_pago === filtros.metodo) &&
      (!filtros.cajero || i.cajero === filtros.cajero)
    );
    if (filtros.search) {
      const q = filtros.search.toLowerCase();
      filtrados = filtrados.filter((i: any) => 
        i.cliente.toLowerCase().includes(q) ||
        i.documento.toLowerCase().includes(q) ||
        i.concepto.toLowerCase().includes(q) ||
        i.rif_cedula.toLowerCase().includes(q)
      );
    }

    const pag = paginar(filtrados, filtros);
    const totalVentasUSD = filtrados.reduce((acc: number, i: any) => acc + i.monto_usd, 0);

    return {
      totales: {
        totalVentasUSD: Math.round(totalVentasUSD * 100) / 100,
        cantidadRegistros: filtrados.length
      },
      items: pag.items,
      paginacion: pag.paginacion
    };
  },

  /**
   * Libro de Compras (Gastos operativos, servicios, alquiler, suministros y facturas)
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

    sql += ` ORDER BY m.creado_en DESC, m.id_movimiento DESC`;

    const res = await db.execute({ sql, args });

    let items = res.rows.map((r: any) => ({
      id_movimiento: Number(r.id_movimiento),
      fecha: String(r.fecha),
      nro_factura_documento: String(r.nro_factura_documento || `EGR-${r.id_movimiento}`),
      proveedor: String(r.proveedor_cliente),
      rif_cedula: String(r.rif_cedula || ''),
      concepto: String(r.concepto),
      categoria: String(r.categoria),
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
        i.concepto.toLowerCase().includes(q) ||
        i.rif_cedula.toLowerCase().includes(q)
      );
    }

    const pag = paginar(items, filtros);
    const totalComprasUSD = items.filter((i: any) => i.estatus !== 'anulado').reduce((acc: number, i: any) => acc + i.monto_usd_equivalente, 0);

    return {
      totales: {
        totalComprasUSD: Math.round(totalComprasUSD * 100) / 100,
        cantidadRegistros: items.length
      },
      items: pag.items,
      paginacion: pag.paginacion
    };
  },

  /**
   * Registra una compra / gasto operativo o ingreso manual
   */
  async registrarMovimiento(data: MovimientoInput, registradoPor?: number) {
    const fecha = data.fecha || new Date().toISOString().slice(0, 10);
    const moneda = data.moneda || 'USD';
    const tasaBcv = Number(data.tasa_bcv || 1);

    const total = Number(data.monto_total || 0);
    if (!(total > 0)) throw new Error('El monto total debe ser mayor a cero');

    const usdEquivalente = moneda === 'VES' && tasaBcv > 0 ? (total / tasaBcv) : total;

    const res = await db.execute({
      sql: `INSERT INTO movimientos_financieros (
              tipo, categoria, fecha, concepto, proveedor_cliente, rif_cedula,
              nro_factura_documento, monto_total, monto_usd_equivalente, moneda,
              tasa_bcv, metodo_pago, referencia_pago, banco_origen, comprobante_url,
              estatus, notas, registrado_por
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        data.tipo,
        data.categoria,
        fecha,
        data.concepto,
        data.proveedor_cliente,
        data.rif_cedula || null,
        data.nro_factura_documento || null,
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
    if (data.categoria !== undefined) { updates.push('categoria = ?'); args.push(data.categoria); }
    if (data.fecha !== undefined) { updates.push('fecha = ?'); args.push(data.fecha); }
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
