import { puedeAccederAfiliado } from '../middlewares/auth.middleware.js';
import { Request, Response } from 'express';
import { db } from '../lib/db.js';
import * as pagosService from '../services/pagos.service.js';
import { MENSAJE_SOLO_ADMINISTRACION, pagosElectronicosHabilitados, setPagosElectronicos } from '../services/config-pagos.service.js';
import { precioCurso } from '../lib/cursos-pago.js';
import { TIPOS_CUENTA, asegurarTiposCuenta } from '../lib/cuentas.js';

// ============================================================
// PÚBLICO / USUARIO AUTENTICADO
// ============================================================

/**
 * GET /api/pagos/cuentas
 * Listado de cuentas bancarias receptoras oficiales
 */
export const getCuentas = async (req: Request, res: Response): Promise<void> => {
  try {
    // Sin pagos electrónicos no se publican las cuentas receptoras
    const cuentas = (await pagosElectronicosHabilitados()) ? await pagosService.getCuentasBancarias(true) : [];
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

    if (!(await pagosElectronicosHabilitados())) {
      res.status(403).json({ success: false, code: 'PAGOS_ELECTRONICOS_DESHABILITADOS', message: MENSAJE_SOLO_ADMINISTRACION });
      return;
    }

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

    const insuficiente = await pagosService.validarMontoArancel({
      tipo_concepto: tipo_concepto || 'formalizacion_afiliacion', id_afiliado: Number(id_afiliado), meses_cubiertos: meses_cubiertos ? Number(meses_cubiertos) : null,
      monto_usd: Number(monto_usd_equivalente || monto),
    });
    if (insuficiente) {
      res.status(400).json({ success: false, code: 'MONTO_MENOR_ARANCEL', esperado: insuficiente.esperado, message: `El monto no cubre el arancel: corresponden $${insuficiente.esperado.toFixed(2)}.` });
      return;
    }

    if (id_inscripcion_curso) {
      // La inscripción debe ser del propio afiliado (su persona o su empresa) y seguir activa
      const insc = await db.execute({
        sql: `SELECT ic.estatus
              FROM inscripciones_cursos ic
              JOIN estudiantes e ON e.id_estudiante = ic.id_estudiante
              JOIN afiliados a ON a.id_afiliado = ?
              WHERE ic.id_inscripcion = ? AND ic.id_curso IS NOT NULL
                AND (e.id_persona = a.id_persona OR (a.id_empresa IS NOT NULL AND e.id_empresa = a.id_empresa))`,
        args: [Number(id_afiliado), Number(id_inscripcion_curso)]
      });
      const estatus = insc.rows[0]?.estatus as string | undefined;
      if (!estatus) {
        res.status(403).json({ success: false, message: 'La inscripción no pertenece a este afiliado' });
        return;
      }
      if (!['Preinscrito', 'Entrevista', 'Inscrito'].includes(estatus)) {
        res.status(409).json({ success: false, message: `La inscripción está "${estatus}" y no admite pagos` });
        return;
      }
    }

    const pago = await pagosService.reportarPagoDigital({
      id_afiliado: Number(id_afiliado),
      id_inscripcion_curso: id_inscripcion_curso ? Number(id_inscripcion_curso) : null,
      id_edicion_cibir: id_edicion_cibir ? Number(id_edicion_cibir) : null,
      tipo_concepto: tipo_concepto || 'formalizacion_afiliacion',
      codigo_arancel: req.body.codigo_arancel || null,
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
            ${pagosService.SQL_JOIN_PAGADOR}
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
            ${pagosService.SQL_JOIN_PAGADOR}
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
 * GET /api/pagos/admin/cursos-por-cobrar?q=
 * Inscripciones a cursos de pago sin pago verificado, para cobrarlas en taquilla.
 * `precio_actual` se recalcula según la afiliación real de la persona: si difiere de `monto_usd`
 * (el precio congelado al reservar), la caja debe revisarlo antes de cobrar.
 */
export const adminCursosPorCobrar = async (req: Request, res: Response): Promise<void> => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const term = `%${q}%`;
    const r = await db.execute({
      sql: `SELECT ic.id_inscripcion, ic.id_estudiante, ic.estatus, ic.reserva_vence_en, ic.monto_usd,
                   c.id_curso, c.titulo AS curso, c.precio_afiliado_usd, c.precio_publico_usd,
                   COALESCE(per.nombres || ' ' || per.apellidos, emp.razon_social) AS nombre,
                   COALESCE(per.cedula, emp.rif_numero) AS identificacion,
                   COALESCE(per.email, emp.email) AS email,
                   (SELECT a.id_afiliado FROM afiliados a
                     WHERE a.estatus = 'Afiliado' AND a.activo = 1 AND a.eliminado_en IS NULL
                       AND (a.id_persona = est.id_persona OR (est.id_empresa IS NOT NULL AND a.id_empresa = est.id_empresa))
                     LIMIT 1) AS id_afiliado,
                   EXISTS (SELECT 1 FROM pagos pg WHERE pg.id_inscripcion_curso = ic.id_inscripcion
                            AND pg.estatus = 'Pendiente' AND pg.eliminado_en IS NULL) AS pago_pendiente
            FROM inscripciones_cursos ic
            JOIN cursos c ON c.id_curso = ic.id_curso
            JOIN estudiantes est ON est.id_estudiante = ic.id_estudiante
            LEFT JOIN personas per ON per.id = est.id_persona
            LEFT JOIN empresas emp ON emp.id_empresa = est.id_empresa
            WHERE ic.estatus IN ('Preinscrito', 'Entrevista', 'Inscrito')
              AND (COALESCE(c.precio_afiliado_usd, 0) > 0 OR COALESCE(c.precio_publico_usd, 0) > 0)
              AND NOT EXISTS (SELECT 1 FROM pagos pg WHERE pg.id_inscripcion_curso = ic.id_inscripcion
                               AND pg.estatus = 'Verificado' AND pg.eliminado_en IS NULL)
              AND (? = '' OR per.nombres LIKE ? OR per.apellidos LIKE ? OR emp.razon_social LIKE ?
                   OR per.cedula LIKE ? OR emp.rif_numero LIKE ? OR per.email LIKE ? OR c.titulo LIKE ?)
            ORDER BY ic.reserva_vence_en IS NULL, ic.reserva_vence_en
            LIMIT 50`,
      args: [q, term, term, term, term, term, term, term],
    });
    const ahora = new Date().toISOString();
    res.json({
      success: true,
      data: r.rows.map((row: any) => ({
        ...row,
        precio_actual: precioCurso(row, row.id_afiliado != null),
        reserva_vencida: !!row.reserva_vence_en && row.reserva_vence_en <= ahora && !row.pago_pendiente,
      })),
    });
  } catch (error) {
    console.error('adminCursosPorCobrar error:', error);
    res.status(500).json({ success: false, message: 'Error al listar cursos por cobrar' });
  }
};

/**
 * GET /api/pagos/admin/pagadores?campo=nombre|cedula|codigo&q=
 * Afiliados a quienes la caja puede cobrar un concepto (afiliación, CIBIR o cuota de sostenimiento).
 */
const CAMPOS_PAGADOR: Record<string, string> = {
  nombre: `COALESCE(NULLIF(TRIM(COALESCE(p.nombres, '') || ' ' || COALESCE(p.apellidos, '')), ''), e.razon_social, '')`,
  cedula: `COALESCE(p.cedula, e.rif_numero, '')`,
  codigo: `COALESCE(a.codigo, '')`,
};

export const adminBuscarPagadores = async (req: Request, res: Response): Promise<void> => {
  try {
    const campo = typeof req.query.campo === 'string' && req.query.campo in CAMPOS_PAGADOR ? req.query.campo : 'nombre';
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (q.length < 2) {
      res.json({ success: true, data: [] });
      return;
    }
    // Cada palabra debe aparecer (en el nombre se busca por partes; en cédula y código, el texto tal cual)
    const terminos = campo === 'nombre' ? q.split(/\s+/) : [q.replace(/[^\w-]/g, '')];
    const r = await db.execute({
      sql: `SELECT a.id_afiliado, a.codigo, a.tipo_afiliado, a.estatus,
                   (a.estatus IN ('1_PREINSCRIPCION','2_EXPEDIENTE','3_ENTREVISTA','4_VERIFICACION','5_CIBIR','6_INSCRIPCION')) AS formalizacion_pendiente,
                   (a.estatus IN ('5_CIBIR','6_INSCRIPCION') AND a.cibir_acreditado = 0 AND NOT EXISTS (
                      SELECT 1 FROM pagos pg WHERE pg.id_afiliado = a.id_afiliado AND pg.tipo_concepto = 'curso_cibir'
                        AND pg.estatus = 'Verificado' AND pg.eliminado_en IS NULL)) AS cibir_pendiente,
                   CASE WHEN a.tipo_afiliado = 'Corporativo'
                        THEN COALESCE(NULLIF(TRIM(e.razon_social), ''), TRIM(COALESCE(p.nombres, '') || ' ' || COALESCE(p.apellidos, '')))
                        ELSE TRIM(COALESCE(p.nombres, '') || ' ' || COALESCE(p.apellidos, '')) END AS nombre,
                   COALESCE(p.cedula_tipo || '-' || p.cedula, e.rif_tipo || '-' || e.rif_numero) AS identificacion
            FROM afiliados a
            LEFT JOIN personas p ON p.id = a.id_persona
            LEFT JOIN empresas e ON e.id_empresa = a.id_empresa
            WHERE a.eliminado_en IS NULL AND a.activo = 1
              ${terminos.map(() => `AND ${CAMPOS_PAGADOR[campo]} LIKE ?`).join(' ')}
            ORDER BY nombre
            LIMIT 15`,
      args: terminos.map(t => `%${t}%`),
    });
    res.json({ success: true, data: r.rows });
  } catch (error) {
    console.error('adminBuscarPagadores error:', error);
    res.status(500).json({ success: false, message: 'Error al buscar pagadores' });
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
      id_estudiante,
      id_inscripcion_curso,
      id_edicion_cibir,
      tipo_concepto,
      codigo_arancel,
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

    if (!(id_afiliado || id_estudiante || id_inscripcion_curso) || !metodo_pago || !monto) {
      res.status(400).json({
        success: false,
        message: 'Campos requeridos: id_afiliado (o la inscripción del curso), metodo_pago, monto'
      });
      return;
    }

    // El cobro debe cubrir el arancel de su concepto; la caja puede autorizar un monto menor de forma explícita
    if (!req.body.autorizar_monto_menor) {
      const insuficiente = await pagosService.validarMontoArancel({
        tipo_concepto: tipo_concepto || 'formalizacion_afiliacion', id_afiliado: id_afiliado ? Number(id_afiliado) : null,
        meses_cubiertos: meses_cubiertos ? Number(meses_cubiertos) : null, monto_usd: Number(monto_usd_equivalente || monto),
      });
      if (insuficiente) {
        res.status(409).json({ success: false, code: 'MONTO_MENOR_ARANCEL', esperado: insuficiente.esperado, message: `El monto es menor al arancel ($${insuficiente.esperado.toFixed(2)}).` });
        return;
      }
    }

    const pago = await pagosService.registrarCobroTaquilla({
      id_afiliado: id_afiliado ? Number(id_afiliado) : null,
      id_estudiante: id_estudiante ? Number(id_estudiante) : null,
      codigo_arancel: codigo_arancel || null,
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
    if (!(TIPOS_CUENTA as readonly string[]).includes(tipo)) {
      res.status(400).json({ success: false, message: 'Tipo de cuenta no válido' });
      return;
    }

    await asegurarTiposCuenta(db);
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

    if (tipo !== undefined && tipo !== null && !(TIPOS_CUENTA as readonly string[]).includes(tipo)) {
      res.status(400).json({ success: false, message: 'Tipo de cuenta no válido' });
      return;
    }
    await asegurarTiposCuenta(db);
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
    // Los pagos guardan el banco de destino como texto, no apuntan a la cuenta: se puede borrar sin afectar el historial
    const r = await db.execute({ sql: `DELETE FROM cuentas_bancarias_camara WHERE id_cuenta = ?`, args: [id] });
    if (!r.rowsAffected) {
      res.status(404).json({ success: false, message: 'Cuenta no encontrada' });
      return;
    }
    res.json({ success: true, message: 'Cuenta eliminada' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al eliminar la cuenta' });
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

/**
 * GET /api/pagos/modalidad
 * Si se reciben pagos electrónicos o todos se canalizan por la administración (lo consultan los afiliados).
 */
export const getModalidadPagos = async (_req: Request, res: Response): Promise<void> => {
  try {
    const electronicos = await pagosElectronicosHabilitados();
    res.json({ success: true, data: { electronicos, mensaje: electronicos ? null : MENSAJE_SOLO_ADMINISTRACION } });
  } catch (error) {
    console.error('getModalidadPagos error:', error);
    res.status(500).json({ success: false, message: 'Error al consultar la modalidad de pagos' });
  }
};

/** PUT /api/pagos/admin/modalidad  { electronicos: boolean } */
export const adminSetModalidadPagos = async (req: Request, res: Response): Promise<void> => {
  try {
    if (typeof req.body?.electronicos !== 'boolean') {
      res.status(400).json({ success: false, message: 'electronicos debe ser verdadero o falso' });
      return;
    }
    await setPagosElectronicos(req.body.electronicos);
    res.json({ success: true, data: { electronicos: req.body.electronicos } });
  } catch (error) {
    console.error('adminSetModalidadPagos error:', error);
    res.status(500).json({ success: false, message: 'Error al guardar la modalidad de pagos' });
  }
};

/** GET /api/pagos/afiliado/:idAfiliado/cobros — cobros del proceso de afiliación y su estado */
export const getCobrosAfiliacion = async (req: Request, res: Response): Promise<void> => {
  try {
    const idAfiliado = Number(req.params.idAfiliado);
    if (!Number.isFinite(idAfiliado) || !(await puedeAccederAfiliado(req.user!, idAfiliado))) {
      res.status(403).json({ success: false, message: 'No tienes acceso a este afiliado' });
      return;
    }
    res.json({ success: true, data: await pagosService.cobrosAfiliacion(idAfiliado) });
  } catch (error: any) {
    console.error('getCobrosAfiliacion error:', error);
    res.status(500).json({ success: false, message: error.message || 'Error al consultar los cobros' });
  }
};

/** PATCH /api/pagos/admin/:id/anular  { motivo } — solo superadmin */
export const adminAnularPago = async (req: Request, res: Response): Promise<void> => {
  try {
    const idPago = Number(req.params.id);
    const motivo = typeof req.body?.motivo === 'string' ? req.body.motivo.trim() : '';
    if (!Number.isFinite(idPago) || motivo.length < 3) {
      res.status(400).json({ success: false, message: 'Indica el motivo de la anulación' });
      return;
    }
    const pago = await pagosService.anularPago(idPago, motivo, req.user!.id, String((req.user as any).email ?? ''));
    res.json({ success: true, message: 'Pago anulado', data: pago });
  } catch (error: any) {
    if (error.status) { res.status(error.status).json({ success: false, message: error.message }); return; }
    console.error('adminAnularPago error:', error);
    res.status(500).json({ success: false, message: 'Error al anular el pago' });
  }
};

/** PUT /api/pagos/admin/solvencia/afiliado/:idAfiliado/mes  { periodo: 'AAAA-MM', pagado: boolean } — solo superadmin */
export const adminMarcarMesSolvencia = async (req: Request, res: Response): Promise<void> => {
  try {
    const idAfiliado = Number(req.params.idAfiliado);
    const { periodo, pagado } = req.body ?? {};
    if (!Number.isFinite(idAfiliado) || typeof periodo !== 'string' || typeof pagado !== 'boolean') {
      res.status(400).json({ success: false, message: 'Faltan periodo (AAAA-MM) y pagado (verdadero/falso)' });
      return;
    }
    const existe = await db.execute({ sql: `SELECT 1 FROM afiliados WHERE id_afiliado = ? AND eliminado_en IS NULL`, args: [idAfiliado] });
    if (!existe.rows.length) { res.status(404).json({ success: false, message: 'Afiliado no encontrado' }); return; }
    await pagosService.marcarMesSolvencia(idAfiliado, periodo, pagado, req.user!.id);
    res.json({ success: true, data: { idAfiliado, periodo, pagado } });
  } catch (error: any) {
    if (error.status) { res.status(error.status).json({ success: false, message: error.message }); return; }
    console.error('adminMarcarMesSolvencia error:', error);
    res.status(500).json({ success: false, message: 'Error al actualizar la solvencia' });
  }
};
