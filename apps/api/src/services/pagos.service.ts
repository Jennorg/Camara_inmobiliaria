import { db } from '../lib/db.js';
import { obtenerSiguienteCodigoAfiliado } from '../lib/afiliados.js';
import { NotificationService } from './notification.service.js';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';

export interface RegistrarCobroTaquillaParams {
  id_afiliado: number;
  id_inscripcion_curso?: number | null;
  id_edicion_cibir?: number | null;
  tipo_concepto: 'formalizacion_afiliacion' | 'curso_cibir' | 'mensualidad' | 'curso' | 'otro';
  descripcion_concepto: string;
  metodo_pago: 'efectivo_usd' | 'efectivo_bs' | 'pago_movil' | 'transferencia_bs' | 'zelle' | 'pos_debito' | 'binance_usdt' | 'otro';
  moneda: 'USD' | 'VES';
  monto: number;
  monto_usd_equivalente: number;
  tasa_bcv?: number | null;
  banco_origen?: string | null;
  banco_destino?: string | null;
  referencia?: string | null;
  titular_origen?: string | null;
  telefono_origen?: string | null;
  registrado_por: number;
  notas?: string | null;
  /** Mes que cubre una mensualidad (YYYY-MM) y cuántos meses seguidos cubre */
  periodo?: string | null;
  meses_cubiertos?: number | null;
}

export interface ReportarPagoDigitalParams {
  id_afiliado: number;
  id_inscripcion_curso?: number | null;
  id_edicion_cibir?: number | null;
  tipo_concepto: 'formalizacion_afiliacion' | 'curso_cibir' | 'mensualidad' | 'curso' | 'otro';
  descripcion_concepto: string;
  metodo_pago: 'pago_movil' | 'transferencia_bs' | 'zelle' | 'binance_usdt' | 'otro';
  moneda: 'USD' | 'VES';
  monto: number;
  monto_usd_equivalente: number;
  tasa_bcv?: number | null;
  banco_origen?: string | null;
  banco_destino?: string | null;
  referencia: string;
  titular_origen?: string | null;
  telefono_origen?: string | null;
  comprobante_url?: string | null;
  registrado_por: number;
  notas?: string | null;
  /** Mes que cubre una mensualidad (YYYY-MM) y cuántos meses seguidos cubre */
  periodo?: string | null;
  meses_cubiertos?: number | null;
}

const PERIODO_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * [periodo, meses_cubiertos] a guardar en el pago. La mensualidad lleva el mes elegido
 * (por defecto el actual); la formalización cubre su primera mensualidad, el mes del pago.
 */
function periodoArgs(
  params: { tipo_concepto: string; periodo?: string | null; meses_cubiertos?: number | null },
  now: string
): [string | null, number] {
  if (params.tipo_concepto === 'formalizacion_afiliacion') return [now.slice(0, 7), 1];
  if (params.tipo_concepto !== 'mensualidad') return [null, 1];
  const periodo = params.periodo && PERIODO_RE.test(params.periodo) ? params.periodo : now.slice(0, 7);
  const meses = Math.min(24, Math.max(1, Math.trunc(Number(params.meses_cubiertos) || 1)));
  return [periodo, meses];
}

/**
 * Genera el siguiente número correlativo de recibo en formato REC-YYYY-XXXX (ej. REC-2026-0001)
 */
export async function generarNumeroRecibo(): Promise<string> {
  const currentYear = new Date().getFullYear();
  const prefix = `REC-${currentYear}-`;

  const result = await db.execute({
    sql: `SELECT numero_recibo FROM pagos 
          WHERE numero_recibo LIKE ? 
          ORDER BY id_pago DESC LIMIT 1`,
    args: [`${prefix}%`]
  });

  let nextCorrelativo = 1;
  if (result.rows.length > 0 && result.rows[0].numero_recibo) {
    const rawNumber = (result.rows[0].numero_recibo as string).replace(prefix, '');
    const parsed = parseInt(rawNumber, 10);
    if (!isNaN(parsed)) {
      nextCorrelativo = parsed + 1;
    }
  }

  return `${prefix}${nextCorrelativo.toString().padStart(4, '0')}`;
}

/**
 * Obtiene la lista de aranceles configurados
 */
export async function getAranceles() {
  const res = await db.execute({
    sql: `SELECT * FROM aranceles_config WHERE activo = 1 ORDER BY categoria, codigo`,
    args: []
  });
  return res.rows;
}

/**
 * Obtiene las cuentas bancarias oficiales de la Cámara
 */
export async function getCuentasBancarias(soloActivas: boolean = true) {
  const res = await db.execute({
    sql: `SELECT * FROM cuentas_bancarias_camara 
          ${soloActivas ? 'WHERE activo = 1' : ''} 
          ORDER BY orden ASC, id_cuenta ASC`,
    args: []
  });
  return res.rows;
}

/**
 * Calcula el desglose de cobro para formalización de afiliación
 */
export async function calcularMontoFormalizacion(tipoAfiliado: string = 'Natural') {
  const aranceles = await getAranceles();
  const arancelInscripcionKey = tipoAfiliado === 'Corporativo'
    ? 'inscripcion_corporativo'
    : tipoAfiliado === 'Agente Corporativo'
      ? 'inscripcion_agente'
      : 'inscripcion_natural';

  const arancelInscripcion = aranceles.find((a: any) => a.codigo === arancelInscripcionKey) as any;
  const arancelMensualidad = aranceles.find((a: any) => a.codigo === 'mensualidad_base') as any;

  const montoInscripcion = arancelInscripcion ? Number(arancelInscripcion.monto_usd) : 25.0;
  const montoMensualidad = arancelMensualidad ? Number(arancelMensualidad.monto_usd) : 5.0;
  const totalUSD = montoInscripcion + montoMensualidad;

  return {
    tipoAfiliado,
    cuotaInscripcion: montoInscripcion,
    primeraMensualidad: montoMensualidad,
    totalUSD,
    conceptoDetallado: `Formalización de Afiliación (Cuota de Inscripción $${montoInscripcion.toFixed(2)} + Primera Mensualidad $${montoMensualidad.toFixed(2)})`
  };
}

/**
 * Formaliza a un aspirante en 6_INSCRIPCION a estatus 'Afiliado'
 */
export async function formalizarAfiliado(idAfiliado: number, idPago?: number) {
  const now = new Date().toISOString();

  // 1. Obtener datos del afiliado
  const afRes = await db.execute({
    sql: `SELECT a.*, 
                 COALESCE(p.nombres || ' ' || p.apellidos, emp.razon_social) as nombre_completo,
                 COALESCE(p.email, emp.email) as email,
                 COALESCE(p.id, emp.id_empresa) as id_entidad
          FROM afiliados a
          LEFT JOIN personas p ON a.id_persona = p.id
          LEFT JOIN empresas emp ON a.id_empresa = emp.id_empresa
          WHERE a.id_afiliado = ?`,
    args: [idAfiliado]
  });

  if (afRes.rows.length === 0) {
    throw new Error('Afiliado no encontrado');
  }

  const afiliado = afRes.rows[0] as any;

  // Si ya es Afiliado, sólo asegurarse de que esté registrado
  let codigoAfiliado = afiliado.codigo;
  if (!codigoAfiliado || codigoAfiliado.trim() === '') {
    codigoAfiliado = await obtenerSiguienteCodigoAfiliado();
  }

  // 2. Actualizar estatus a Afiliado
  await db.execute({
    sql: `UPDATE afiliados 
          SET estatus = 'Afiliado', 
              codigo = ?, 
              fecha_afiliacion = COALESCE(fecha_afiliacion, ?), 
              fecha_ultimo_cambio_estatus = ?, 
              actualizado_en = ?
          WHERE id_afiliado = ?`,
    args: [codigoAfiliado, now, now, now, idAfiliado]
  });

  // 3. Sincronizar inscripciones_cursos (programa AFILIACION)
  try {
    const estQuery = await db.execute({
      sql: `SELECT id_estudiante FROM estudiantes WHERE id_persona = ? OR id_empresa = ? LIMIT 1`,
      args: [afiliado.id_persona || null, afiliado.id_empresa || null]
    });
    if (estQuery.rows.length > 0) {
      const idEstudiante = estQuery.rows[0].id_estudiante;
      await db.execute({
        sql: `UPDATE inscripciones_cursos 
              SET estatus = 'Inscrito', actualizado_en = ?
              WHERE id_estudiante = ? AND programa_codigo = 'AFILIACION' AND id_curso IS NULL`,
        args: [now, idEstudiante]
      });
    }
  } catch (errSync) {
    console.error('[PagosService] Error sincronizando inscripciones_cursos:', errSync);
  }

  // 4. Preparar/asegurar acceso al usuario con rol 'afiliado'
  try {
    if (afiliado.email) {
      const uRes = await db.execute({
        sql: `SELECT id, roles FROM users WHERE email = ?`,
        args: [afiliado.email]
      });

      if (uRes.rows.length > 0) {
        const userRow = uRes.rows[0] as any;
        let currentRoles: string[] = [];
        try {
          currentRoles = typeof userRow.roles === 'string' ? JSON.parse(userRow.roles) : (userRow.roles || []);
        } catch {
          currentRoles = [userRow.roles || 'afiliado'];
        }
        if (!currentRoles.includes('afiliado')) {
          currentRoles.push('afiliado');
          await db.execute({
            sql: `UPDATE users SET roles = ?, actualizado_en = ? WHERE id = ?`,
            args: [JSON.stringify(currentRoles), now, userRow.id]
          });
        }
      }
    }
  } catch (errUser) {
    console.error('[PagosService] Error asegurando rol de usuario:', errUser);
  }

  return {
    id_afiliado: idAfiliado,
    codigo: codigoAfiliado,
    nombre_completo: afiliado.nombre_completo,
    email: afiliado.email
  };
}

/**
 * Registra un cobro directo en taquilla/caja realizado por un administrador
 */
export async function registrarCobroTaquilla(params: RegistrarCobroTaquillaParams) {
  const now = new Date().toISOString();
  const numeroRecibo = await generarNumeroRecibo();

  const insertRes = await db.execute({
    sql: `INSERT INTO pagos (
            numero_recibo, id_afiliado, id_inscripcion_curso, id_edicion_cibir,
            tipo_concepto, descripcion_concepto, metodo_pago, moneda,
            monto, monto_usd_equivalente, tasa_bcv, banco_origen,
            banco_destino, referencia, titular_origen, telefono_origen,
            comprobante_url, estatus, origen_registro, registrado_por,
            verificado_por, fecha_pago, fecha_verificacion, notas, creado_en,
            periodo, meses_cubiertos
          ) VALUES (
            ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?,
            NULL, 'Verificado', 'admin', ?,
            ?, ?, ?, ?, ?,
            ?, ?
          ) RETURNING *`,
    args: [
      numeroRecibo,
      params.id_afiliado,
      params.id_inscripcion_curso || null,
      params.id_edicion_cibir || null,
      params.tipo_concepto,
      params.descripcion_concepto,
      params.metodo_pago,
      params.moneda,
      params.monto,
      params.monto_usd_equivalente,
      params.tasa_bcv || null,
      params.banco_origen || null,
      params.banco_destino || null,
      params.referencia || null,
      params.titular_origen || null,
      params.telefono_origen || null,
      params.registrado_por,
      params.registrado_por, // verificado_por
      now, // fecha_pago
      now, // fecha_verificacion
      params.notas || null,
      now,
      ...periodoArgs(params, now)
    ]
  });

  const pagoCreado = insertRes.rows[0] as any;

  // Si es formalización de afiliación, activar automáticamente
  if (params.tipo_concepto === 'formalizacion_afiliacion') {
    await formalizarAfiliado(params.id_afiliado, pagoCreado.id_pago);
  }

  // Si es cobro de curso CIBIR
  if (params.tipo_concepto === 'curso_cibir' && params.id_edicion_cibir) {
    try {
      await db.execute({
        sql: `UPDATE inscripciones_edicion_cibir 
              SET actualizado_en = ? 
              WHERE id_edicion = ? AND id_afiliado = ?`,
        args: [now, params.id_edicion_cibir, params.id_afiliado]
      });
    } catch (errCibir) {
      console.error('[PagosService] Error vinculando pago a edicion CIBIR:', errCibir);
    }
  }

  return pagoCreado;
}

/**
 * Reportar un pago digital por parte del aspirante/afiliado (queda en estatus 'Pendiente')
 */
export async function reportarPagoDigital(params: ReportarPagoDigitalParams) {
  const now = new Date().toISOString();
  const numeroRecibo = await generarNumeroRecibo();

  const insertRes = await db.execute({
    sql: `INSERT INTO pagos (
            numero_recibo, id_afiliado, id_inscripcion_curso, id_edicion_cibir,
            tipo_concepto, descripcion_concepto, metodo_pago, moneda,
            monto, monto_usd_equivalente, tasa_bcv, banco_origen,
            banco_destino, referencia, titular_origen, telefono_origen,
            comprobante_url, estatus, origen_registro, registrado_por,
            verificado_por, fecha_pago, fecha_verificacion, notas, creado_en,
            periodo, meses_cubiertos
          ) VALUES (
            ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, 'Pendiente', 'afiliado', ?,
            NULL, ?, NULL, ?, ?,
            ?, ?
          ) RETURNING *`,
    args: [
      numeroRecibo,
      params.id_afiliado,
      params.id_inscripcion_curso || null,
      params.id_edicion_cibir || null,
      params.tipo_concepto,
      params.descripcion_concepto,
      params.metodo_pago,
      params.moneda,
      params.monto,
      params.monto_usd_equivalente,
      params.tasa_bcv || null,
      params.banco_origen || null,
      params.banco_destino || null,
      params.referencia,
      params.titular_origen || null,
      params.telefono_origen || null,
      params.comprobante_url || null,
      params.registrado_por,
      now, // fecha_pago
      params.notas || null,
      now,
      ...periodoArgs(params, now)
    ]
  });

  const pagoCreado = insertRes.rows[0] as any;

  // Notificar a los administradores
  try {
    const afRes = await db.execute({
      sql: `SELECT COALESCE(p.nombres || ' ' || p.apellidos, emp.razon_social) as nombre
            FROM afiliados a
            LEFT JOIN personas p ON a.id_persona = p.id
            LEFT JOIN empresas emp ON a.id_empresa = emp.id_empresa
            WHERE a.id_afiliado = ?`,
      args: [params.id_afiliado]
    });
    const nombre = afRes.rows[0]?.nombre || 'Aspirante';

    NotificationService.notifyAdmins({
      title: `Nuevo Pago Reportado: ${numeroRecibo}`,
      message: `${nombre} ha reportado un pago de ${params.monto} ${params.moneda} (${params.metodo_pago.toUpperCase()}, Ref: ${params.referencia}) por concepto de ${params.descripcion_concepto}.`,
      type: 'PAGO_REGISTRADO',
      priority: 'ALTA',
      data: {
        id_pago: pagoCreado.id_pago,
        id_afiliado: params.id_afiliado,
        numero_recibo: numeroRecibo,
        referencia: params.referencia,
        monto: params.monto,
        moneda: params.moneda
      }
    }).catch(e => console.error('[PagosService] Error enviando notificación in-app:', e));
  } catch (errNotif) {
    console.error('[PagosService] Error preparando notificación:', errNotif);
  }

  return pagoCreado;
}

/**
 * Validar y aprobar un pago reportado (por admin)
 */
export async function verificarPagoDigital(idPago: number, adminUserId: number) {
  const now = new Date().toISOString();

  const check = await db.execute({
    sql: `SELECT * FROM pagos WHERE id_pago = ?`,
    args: [idPago]
  });

  if (check.rows.length === 0) {
    throw new Error('Pago no encontrado');
  }

  const pago = check.rows[0] as any;
  if (pago.estatus === 'Verificado') {
    return pago;
  }

  const updateRes = await db.execute({
    sql: `UPDATE pagos 
          SET estatus = 'Verificado', 
              verificado_por = ?, 
              fecha_verificacion = ?, 
              actualizado_en = ?
          WHERE id_pago = ? 
          RETURNING *`,
    args: [adminUserId, now, now, idPago]
  });

  const pagoActualizado = updateRes.rows[0] as any;

  // Si es formalización de afiliación, activar automáticamente
  if (pago.tipo_concepto === 'formalizacion_afiliacion') {
    await formalizarAfiliado(pago.id_afiliado, pago.id_pago);
  }

  // Notificar al usuario que su pago fue verificado
  try {
    NotificationService.notify({
      userId: pago.registrado_por,
      title: `Pago Verificado (${pago.numero_recibo})`,
      message: `Tu pago de ${pago.monto} ${pago.moneda} ha sido verificado satisfactoriamente por la administración.`,
      type: 'PAGO_VERIFICADO',
      channels: ['IN_APP']
    }).catch(() => {});
  } catch (e) {
    console.error('[PagosService] Error enviando notificación de verificación al usuario:', e);
  }

  return pagoActualizado;
}

/**
 * Rechazar un pago reportado con motivo (por admin)
 */
export async function rechazarPagoDigital(idPago: number, motivoRechazo: string, adminUserId: number) {
  const now = new Date().toISOString();

  const check = await db.execute({
    sql: `SELECT * FROM pagos WHERE id_pago = ?`,
    args: [idPago]
  });

  if (check.rows.length === 0) {
    throw new Error('Pago no encontrado');
  }

  const pago = check.rows[0] as any;

  const updateRes = await db.execute({
    sql: `UPDATE pagos 
          SET estatus = 'Rechazado', 
              motivo_rechazo = ?, 
              verificado_por = ?, 
              actualizado_en = ?
          WHERE id_pago = ? 
          RETURNING *`,
    args: [motivoRechazo, adminUserId, now, idPago]
  });

  const pagoActualizado = updateRes.rows[0] as any;

  // Notificar al usuario del rechazo
  try {
    NotificationService.notify({
      userId: pago.registrado_por,
      title: `Pago No Aprobado (${pago.numero_recibo})`,
      message: `Tu pago no pudo ser verificado. Motivo: ${motivoRechazo}. Por favor revisa y vuelve a reportar el comprobante.`,
      type: 'PAGO_RECHAZADO',
      channels: ['IN_APP']
    }).catch(() => {});
  } catch (e) {
    console.error('[PagosService] Error enviando notificación de rechazo:', e);
  }

  return pagoActualizado;
}

/**
 * Obtener los datos completos de un recibo para su emisión/PDF
 */
export async function getReciboDetalle(idPagoOrNumeroRecibo: number | string) {
  const isNumber = typeof idPagoOrNumeroRecibo === 'number' || /^\d+$/.test(String(idPagoOrNumeroRecibo));
  
  const query = `
    SELECT p.*,
           a.codigo as afiliado_codigo,
           a.tipo_afiliado,
           a.estatus as afiliado_estatus,
           COALESCE(per.nombres || ' ' || per.apellidos, emp.razon_social) as pagador_nombre,
           COALESCE(per.cedula, emp.rif_numero) as pagador_identificacion,
           COALESCE(per.email, emp.email) as pagador_email,
           COALESCE(per.telefono_principal, emp.telefono_principal) as pagador_telefono,
           u_admin.email as admin_verificador_email
    FROM pagos p
    JOIN afiliados a ON p.id_afiliado = a.id_afiliado
    LEFT JOIN personas per ON a.id_persona = per.id
    LEFT JOIN empresas emp ON a.id_empresa = emp.id_empresa
    LEFT JOIN users u_admin ON p.verificado_por = u_admin.id
    WHERE ${isNumber ? 'p.id_pago = ?' : 'p.numero_recibo = ?'}
    LIMIT 1
  `;

  const res = await db.execute({
    sql: query,
    args: [idPagoOrNumeroRecibo]
  });

  if (res.rows.length === 0) {
    return null;
  }

  return res.rows[0];
}
