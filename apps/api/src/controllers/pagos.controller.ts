import { puedeAccederAfiliado } from '../middlewares/auth.middleware.js';
import { Request, Response } from 'express';
import { db } from '../lib/db.js';
import * as pagosService from '../services/pagos.service.js';

// ============================================================
// PÚBLICO / USUARIO AUTENTICADO
// ============================================================

/**
 * GET /api/pagos/cuentas
 * Listado de cuentas bancarias receptoras oficiales
 */
export const getCuentas = async (req: Request, res: Response): Promise<void> => {
  try {
    const cuentas = await pagosService.getCuentasBancarias(true);
    res.json({ success: true, data: cuentas });
  } catch (error) {
    console.error('getCuentas error:', error);
    res.status(500).json({ success: false, message: 'Error al obtener cuentas bancarias' });
  }
};

/**
 * GET /api/pagos/aranceles
 * Listado de aranceles y tarifas configuradas
 */
export const getArancelesController = async (req: Request, res: Response): Promise<void> => {
  try {
    const aranceles = await pagosService.getAranceles();
    res.json({ success: true, data: aranceles });
  } catch (error) {
    console.error('getAranceles error:', error);
    res.status(500).json({ success: false, message: 'Error al obtener aranceles' });
  }
};

/**
 * GET /api/pagos/arancel-formalizacion/:idAfiliado
 * Obtiene el arancel de formalización para un afiliado
 */
export const getArancelFormalizacion = async (req: Request, res: Response): Promise<void> => {
  try {
    const idAfiliado = Number(req.params.idAfiliado);
    let tipoAfiliado = 'Natural';

    if (idAfiliado && Number.isFinite(idAfiliado)) {
      const af = await db.execute({
        sql: `SELECT tipo_afiliado FROM afiliados WHERE id_afiliado = ?`,
        args: [idAfiliado]
      });
      if (af.rows.length > 0) {
        tipoAfiliado = (af.rows[0].tipo_afiliado as string) || 'Natural';
      }
    }

    const calculo = await pagosService.calcularMontoFormalizacion(tipoAfiliado);
    res.json({ success: true, data: calculo });
  } catch (error) {
    console.error('getArancelFormalizacion error:', error);
    res.status(500).json({ success: false, message: 'Error al calcular arancel' });
  }
};

/**
 * POST /api/pagos/reportar
 * Aspirante reporta un pago digital (Pago Móvil, Zelle, Transferencia)
 */
export const reportarPago = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Usuario no autenticado' });
      return;
    }

    const {
      id_afiliado,
      id_inscripcion_curso,
      id_edicion_cibir,
      tipo_concepto,
      descripcion_concepto,
      metodo_pago,
      moneda,
      monto,
      monto_usd_equivalente,
      tasa_bcv,
      banco_origen,
      banco_destino,
      referencia,
      titular_origen,
      telefono_origen,
      comprobante_url,
      notas,
      periodo,
      meses_cubiertos
    } = req.body;

    if (!id_afiliado || !metodo_pago || !monto || !referencia) {
      res.status(400).json({
        success: false,
        message: 'Faltan campos obligatorios (id_afiliado, metodo_pago, monto, referencia)'
      });
      return;
    }

    if (!(await puedeAccederAfiliado(req.user!, Number(id_afiliado)))) {
      res.status(403).json({ success: false, message: 'No puedes reportar pagos de otro afiliado' });
      return;
    }

    const pago = await pagosService.reportarPagoDigital({
      id_afiliado: Number(id_afiliado),
      id_inscripcion_curso: id_inscripcion_curso ? Number(id_inscripcion_curso) : null,
      id_edicion_cibir: id_edicion_cibir ? Number(id_edicion_cibir) : null,
      tipo_concepto: tipo_concepto || 'formalizacion_afiliacion',
      descripcion_concepto: descripcion_concepto || 'Formalización de Inscripción y Membresía Gremial',
      metodo_pago,
      moneda: moneda || 'USD',
      monto: Number(monto),
      monto_usd_equivalente: Number(monto_usd_equivalente || monto),
      tasa_bcv: tasa_bcv ? Number(tasa_bcv) : null,
      banco_origen,
      banco_destino,
      referencia,
      titular_origen,
      telefono_origen,
      comprobante_url,
      registrado_por: userId,
      notas,
      periodo,
      meses_cubiertos
    });

    res.status(201).json({
      success: true,
      message: 'Pago reportado exitosamente. La administración verificará el comprobante en breve.',
      data: pago
    });
  } catch (error: any) {
    console.error('reportarPago error:', error);
    res.status(500).json({ success: false, message: error.message || 'Error al reportar pago' });
  }
};

/**
 * GET /api/pagos/afiliado/:idAfiliado
 * Obtiene el historial de pagos de un afiliado
 */
export const getPagosByAfiliado = async (req: Request, res: Response): Promise<void> => {
  try {
    const idAfiliado = Number(req.params.idAfiliado);
    if (!Number.isFinite(idAfiliado)) {
      res.status(400).json({ success: false, message: 'ID de afiliado inválido' });
      return;
    }
    if (!(await puedeAccederAfiliado(req.user!, idAfiliado))) {
      res.status(403).json({ success: false, message: 'No puedes consultar los pagos de otro afiliado' });
      return;
    }

    const resPagos = await db.execute({
      sql: `SELECT p.*, 
                   u_admin.email as admin_verificador_email
            FROM pagos p
            LEFT JOIN users u_admin ON p.verificado_por = u_admin.id
            WHERE p.id_afiliado = ? AND p.eliminado_en IS NULL
            ORDER BY p.id_pago DESC`,
      args: [idAfiliado]
    });

    res.json({ success: true, data: resPagos.rows });
  } catch (error) {
    console.error('getPagosByAfiliado error:', error);
    res.status(500).json({ success: false, message: 'Error al obtener pagos' });
  }
};

/**
 * GET /api/pagos/recibo/:reciboIdOrCode
 * Obtiene los datos de un recibo digital oficial
 */
export const getRecibo = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawParam = req.params.reciboIdOrCode;
    const param = Array.isArray(rawParam) ? rawParam[0] : rawParam;
    const recibo = await pagosService.getReciboDetalle(param as string);

    // Mismo 404 para "no existe" y "no es tuyo": no revela qué números de recibo existen.
    if (!recibo || !(await puedeAccederAfiliado(req.user!, Number(recibo.id_afiliado)))) {
      res.status(404).json({ success: false, message: 'Recibo no encontrado' });
      return;
    }

    res.json({ success: true, data: recibo });
  } catch (error) {
    console.error('getRecibo error:', error);
    res.status(500).json({ success: false, message: 'Error al consultar recibo' });
  }
};

// ============================================================
// ADMINISTRACIÓN
// ============================================================

/**
 * GET /api/admin/pagos
 * Listado general de pagos con filtros
 */
export const adminListPagos = async (req: Request, res: Response): Promise<void> => {
  try {
    const { estatus, tipo_concepto, search, limit = '50', offset = '0' } = req.query;

    const conditions: string[] = ['p.eliminado_en IS NULL'];
    const args: any[] = [];

    if (estatus) {
      conditions.push('p.estatus = ?');
      args.push(estatus);
    }

    if (tipo_concepto) {
      conditions.push('p.tipo_concepto = ?');
      args.push(tipo_concepto);
    }

    if (search) {
      conditions.push(`(
        p.numero_recibo LIKE ? OR
        p.referencia LIKE ? OR
        p.titular_origen LIKE ? OR
        per.nombres LIKE ? OR
        per.apellidos LIKE ? OR
        emp.razon_social LIKE ?
      )`);
      const term = `%${search}%`;
      args.push(term, term, term, term, term, term);
    }

    const whereClause = conditions.join(' AND ');

    const countRes = await db.execute({
      sql: `SELECT COUNT(*) as total 
            FROM pagos p
            JOIN afiliados a ON p.id_afiliado = a.id_afiliado
            LEFT JOIN personas per ON a.id_persona = per.id
            LEFT JOIN empresas emp ON a.id_empresa = emp.id_empresa
            WHERE ${whereClause}`,
      args
    });

    const total = Number(countRes.rows[0]?.total || 0);

    const dataRes = await db.execute({
      sql: `SELECT p.*,
                   a.codigo as afiliado_codigo,
                   a.tipo_afiliado,
                   a.estatus as afiliado_estatus,
                   COALESCE(per.nombres || ' ' || per.apellidos, emp.razon_social) as pagador_nombre,
                   COALESCE(per.cedula, emp.rif_numero) as pagador_identificacion,
                   COALESCE(per.email, emp.email) as pagador_email,
                   u_admin.email as admin_verificador_email
            FROM pagos p
            JOIN afiliados a ON p.id_afiliado = a.id_afiliado
            LEFT JOIN personas per ON a.id_persona = per.id
            LEFT JOIN empresas emp ON a.id_empresa = emp.id_empresa
            LEFT JOIN users u_admin ON p.verificado_por = u_admin.id
            WHERE ${whereClause}
            ORDER BY p.id_pago DESC
            LIMIT ? OFFSET ?`,
      args: [...args, Number(limit), Number(offset)]
    });

    res.json({
      success: true,
      data: dataRes.rows,
      pagination: {
        total,
        limit: Number(limit),
        offset: Number(offset)
      }
    });
  } catch (error) {
    console.error('adminListPagos error:', error);
    res.status(500).json({ success: false, message: 'Error al listar pagos' });
  }
};

/**
 * POST /api/admin/pagos/cobro-taquilla
 * Registrar cobro directo en taquilla/caja (Efectivo USD/Bs, POS, etc.)
 */
export const adminCobroTaquilla = async (req: Request, res: Response): Promise<void> => {
  try {
    const adminId = req.user?.id;
    if (!adminId) {
      res.status(401).json({ success: false, message: 'Usuario administrador no autenticado' });
      return;
    }

    const {
      id_afiliado,
      id_inscripcion_curso,
      id_edicion_cibir,
      tipo_concepto,
      descripcion_concepto,
      metodo_pago,
      moneda,
      monto,
      monto_usd_equivalente,
      tasa_bcv,
      banco_origen,
      banco_destino,
      referencia,
      titular_origen,
      telefono_origen,
      notas,
      periodo,
      meses_cubiertos
    } = req.body;

    if (!id_afiliado || !metodo_pago || !monto) {
      res.status(400).json({
        success: false,
        message: 'Campos requeridos: id_afiliado, metodo_pago, monto'
      });
      return;
    }

    const pago = await pagosService.registrarCobroTaquilla({
      id_afiliado: Number(id_afiliado),
      id_inscripcion_curso: id_inscripcion_curso ? Number(id_inscripcion_curso) : null,
      id_edicion_cibir: id_edicion_cibir ? Number(id_edicion_cibir) : null,
      tipo_concepto: tipo_concepto || 'formalizacion_afiliacion',
      descripcion_concepto: descripcion_concepto || 'Cobro de Formalización en Taquilla',
      metodo_pago,
      moneda: moneda || 'USD',
      monto: Number(monto),
      monto_usd_equivalente: Number(monto_usd_equivalente || monto),
      tasa_bcv: tasa_bcv ? Number(tasa_bcv) : null,
      banco_origen,
      banco_destino,
      referencia,
      titular_origen,
      telefono_origen,
      registrado_por: adminId,
      notas,
      periodo,
      meses_cubiertos
    });

    res.status(201).json({
      success: true,
      message: 'Cobro registrado y formalizado exitosamente.',
      data: pago
    });
  } catch (error: any) {
    console.error('adminCobroTaquilla error:', error);
    res.status(500).json({ success: false, message: error.message || 'Error al procesar cobro en taquilla' });
  }
};

/**
 * PATCH /api/admin/pagos/:id/verificar
 * Validar un pago reportado por aspirante
 */
export const adminVerificarPago = async (req: Request, res: Response): Promise<void> => {
  try {
    const adminId = req.user?.id;
    const idPago = Number(req.params.id);

    if (!adminId || !Number.isFinite(idPago)) {
      res.status(400).json({ success: false, message: 'ID de pago o usuario inválido' });
      return;
    }

    const pago = await pagosService.verificarPagoDigital(idPago, adminId);
    res.json({
      success: true,
      message: 'Pago verificado exitosamente y formalización completada.',
      data: pago
    });
  } catch (error: any) {
    console.error('adminVerificarPago error:', error);
    res.status(500).json({ success: false, message: error.message || 'Error al verificar pago' });
  }
};

/**
 * PATCH /api/admin/pagos/:id/rechazar
 * Rechazar un pago reportado con motivo
 */
export const adminRechazarPago = async (req: Request, res: Response): Promise<void> => {
  try {
    const adminId = req.user?.id;
    const idPago = Number(req.params.id);
    const { motivo } = req.body;

    if (!adminId || !Number.isFinite(idPago)) {
      res.status(400).json({ success: false, message: 'ID de pago inválido' });
      return;
    }

    if (!motivo || motivo.trim() === '') {
      res.status(400).json({ success: false, message: 'Debe especificar el motivo del rechazo' });
      return;
    }

    const pago = await pagosService.rechazarPagoDigital(idPago, motivo.trim(), adminId);
    res.json({
      success: true,
      message: 'Pago rechazado. El aspirante ha sido notificado.',
      data: pago
    });
  } catch (error: any) {
    console.error('adminRechazarPago error:', error);
    res.status(500).json({ success: false, message: error.message || 'Error al rechazar pago' });
  }
};

// ============================================================
// CRUD CUENTAS BANCARIAS
// ============================================================

export const adminListCuentas = async (req: Request, res: Response): Promise<void> => {
  try {
    const cuentas = await pagosService.getCuentasBancarias(false);
    res.json({ success: true, data: cuentas });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al listar cuentas' });
  }
};

export const adminCreateCuenta = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tipo, banco, beneficiario, identificacion, numero_cuenta, telefono, email, instrucciones, orden } = req.body;

    if (!tipo || !banco || !beneficiario || !identificacion) {
      res.status(400).json({ success: false, message: 'Faltan campos obligatorios' });
      return;
    }

    const now = new Date().toISOString();
    const result = await db.execute({
      sql: `INSERT INTO cuentas_bancarias_camara (
              tipo, banco, beneficiario, identificacion, numero_cuenta, telefono, email, instrucciones, activo, orden, creado_en
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?) RETURNING *`,
      args: [tipo, banco, beneficiario, identificacion, numero_cuenta || null, telefono || null, email || null, instrucciones || null, Number(orden || 0), now]
    });

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Error al crear cuenta bancaria' });
  }
};

export const adminUpdateCuenta = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const { tipo, banco, beneficiario, identificacion, numero_cuenta, telefono, email, instrucciones, activo, orden } = req.body;

    const now = new Date().toISOString();
    const result = await db.execute({
      sql: `UPDATE cuentas_bancarias_camara 
            SET tipo = COALESCE(?, tipo),
                banco = COALESCE(?, banco),
                beneficiario = COALESCE(?, beneficiario),
                identificacion = COALESCE(?, identificacion),
                numero_cuenta = ?,
                telefono = ?,
                email = ?,
                instrucciones = ?,
                activo = COALESCE(?, activo),
                orden = COALESCE(?, orden),
                actualizado_en = ?
            WHERE id_cuenta = ? RETURNING *`,
      args: [
        tipo || null,
        banco || null,
        beneficiario || null,
        identificacion || null,
        numero_cuenta ?? null,
        telefono ?? null,
        email ?? null,
        instrucciones ?? null,
        activo !== undefined ? Number(activo) : null,
        orden !== undefined ? Number(orden) : null,
        now,
        id
      ]
    });

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Cuenta no encontrada' });
      return;
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Error al actualizar cuenta bancaria' });
  }
};

export const adminDeleteCuenta = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    await db.execute({
      sql: `UPDATE cuentas_bancarias_camara SET activo = 0 WHERE id_cuenta = ?`,
      args: [id]
    });
    res.json({ success: true, message: 'Cuenta desactivada' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al desactivar cuenta' });
  }
};

// ============================================================
// CRUD ARANCELES
// ============================================================

export const adminUpdateArancel = async (req: Request, res: Response): Promise<void> => {
  try {
    const { codigo } = req.params;
    const { nombre, descripcion, monto_usd, activo } = req.body;

    const now = new Date().toISOString();
    const result = await db.execute({
      sql: `UPDATE aranceles_config 
            SET nombre = COALESCE(?, nombre),
                descripcion = COALESCE(?, descripcion),
                monto_usd = COALESCE(?, monto_usd),
                activo = COALESCE(?, activo),
                actualizado_en = ?
            WHERE codigo = ? RETURNING *`,
      args: [
        nombre || null,
        descripcion || null,
        monto_usd !== undefined ? Number(monto_usd) : null,
        activo !== undefined ? Number(activo) : null,
        now,
        codigo
      ]
    });

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Arancel no encontrado' });
      return;
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Error al actualizar arancel' });
  }
};
