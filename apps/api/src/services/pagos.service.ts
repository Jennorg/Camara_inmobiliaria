import { db } from '../lib/db.js';
import { obtenerSiguienteCodigoAfiliado } from '../lib/afiliados.js';
import { NotificationService } from './notification.service.js';
import { mesMasAntiguoImpago } from './cobranza.service.js';
import { esCupoIlimitado, sqlOcupaCupo } from '../lib/cursos-pago.js';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';

/** Roles que verifican pagos (mismos que protegen /api/pagos/admin y /api/finanzas). */
export const ROLES_FINANZAS = ['admin', 'super_admin', 'asistente', 'administrativo', 'personal_admin'];

export type TipoConcepto = 'formalizacion_afiliacion' | 'curso_cibir' | 'mensualidad' | 'curso' | 'programa' | 'otro';

export interface RegistrarCobroTaquillaParams {
  /** Pagador: un afiliado o, en cursos, un estudiante sin afiliación (al menos uno). */
  id_afiliado?: number | null;
  id_estudiante?: number | null;
  id_inscripcion_curso?: number | null;
  id_edicion_cibir?: number | null;
  tipo_concepto: TipoConcepto;
  codigo_arancel?: string | null;
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
  tipo_concepto: TipoConcepto;
  codigo_arancel?: string | null;
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

/** Arancel que identifica el concepto en los reportes cuando quien cobra no lo indica. */
function codigoArancelPorDefecto(tipo: TipoConcepto): string | null {
  if (tipo === 'mensualidad') return 'mensualidad_base';
  if (tipo === 'curso_cibir') return 'curso_cibir';
  return null;
}

/**
 * JOINs que resuelven los datos del pagador (alias `per` / `emp`) tanto si el pago es de un
 * afiliado como de un estudiante sin afiliación. Requiere `pagos p`.
 */
export const SQL_JOIN_PAGADOR = `
    LEFT JOIN afiliados a ON p.id_afiliado = a.id_afiliado
    LEFT JOIN estudiantes est ON p.id_estudiante = est.id_estudiante
    LEFT JOIN personas per ON per.id = COALESCE(a.id_persona, est.id_persona)
    LEFT JOIN empresas emp ON emp.id_empresa = COALESCE(a.id_empresa, est.id_empresa)`;

/**
 * Un pago verificado de un curso confirma la inscripción: pasa a 'Pagado' y deja de tener reserva.
 * Si el curso exige aprobación manual, el pago solo asegura el cupo y la aprobación sigue pendiente.
 */
async function confirmarInscripcionPagada(idInscripcion: number) {
  await db.execute({
    sql: `UPDATE inscripciones_cursos
          SET estatus = CASE
                WHEN (SELECT requiere_aprobacion FROM cursos c WHERE c.id_curso = inscripciones_cursos.id_curso) = 1
                     AND estatus IN ('Preinscrito', 'Entrevista') THEN estatus
                ELSE 'Pagado' END,
              reserva_vence_en = NULL,
              actualizado_en = ?
          WHERE id_inscripcion = ? AND id_curso IS NOT NULL AND estatus IN ('Preinscrito', 'Entrevista', 'Inscrito')`,
    args: [new Date().toISOString(), idInscripcion]
  });
}

/** Al rechazar un pago: si la reserva ya venció y no queda otro pago por verificar, se libera el cupo. */
async function liberarReservaVencida(idInscripcion: number) {
  await db.execute({
    sql: `UPDATE inscripciones_cursos
          SET estatus = 'Cancelado', nota_admin = COALESCE(nota_admin || ' · ', '') || 'Reserva vencida sin pago verificado', actualizado_en = ?
          WHERE id_inscripcion = ? AND estatus = 'Preinscrito'
            AND reserva_vence_en IS NOT NULL AND reserva_vence_en <= strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
            AND NOT EXISTS (SELECT 1 FROM pagos pg WHERE pg.id_inscripcion_curso = ? AND pg.estatus = 'Pendiente' AND pg.eliminado_en IS NULL)`,
    args: [new Date().toISOString(), idInscripcion, idInscripcion]
  });
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
 * Ejecuta un INSERT con un número de recibo nuevo. Si dos cobros simultáneos obtienen el mismo
 * correlativo, el UNIQUE de `numero_recibo` rechaza uno y aquí se reintenta con el siguiente.
 */
export async function conNumeroRecibo<T>(insertar: (numeroRecibo: string) => Promise<T>, intentos = 3): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await insertar(await generarNumeroRecibo());
    } catch (err) {
      const msg = String((err as Error)?.message ?? err);
      if (i >= intentos || !/UNIQUE/i.test(msg) || !msg.includes('numero_recibo')) throw err;
    }
  }
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

/** Tolerancia (USD) para el redondeo al convertir bolívares con la tasa del día */
const TOLERANCIA_USD = 0.5;

/**
 * Monto mínimo que debe cubrir un pago según su concepto (formalización, CIBIR o mensualidades). Devuelve null si el
 * concepto no tiene un monto fijo por afiliado (cursos, programas, otros).
 */
export async function montoEsperadoUsd(params: { tipo_concepto: string; id_afiliado?: number | null; meses_cubiertos?: number | null }): Promise<number | null> {
  if (!params.id_afiliado) return null;
  if (params.tipo_concepto === 'formalizacion_afiliacion') {
    const a = await db.execute({ sql: `SELECT tipo_afiliado FROM afiliados WHERE id_afiliado = ?`, args: [params.id_afiliado] });
    return (await calcularMontoFormalizacion(String(a.rows[0]?.tipo_afiliado || 'Natural'))).totalUSD;
  }
  const aranceles = await getAranceles();
  const monto = (codigo: string) => Number((aranceles.find((x: any) => x.codigo === codigo) as any)?.monto_usd ?? 0);
  if (params.tipo_concepto === 'curso_cibir') return monto('curso_cibir') || null;
  if (params.tipo_concepto === 'mensualidad') {
    const meses = Math.max(1, Math.trunc(Number(params.meses_cubiertos) || 1));
    return monto('mensualidad_base') * meses || null;
  }
  return null;
}

/** Mensaje de error si el pago no cubre el arancel de su concepto; null si está bien. */
export async function validarMontoArancel(params: { tipo_concepto: string; id_afiliado?: number | null; meses_cubiertos?: number | null; monto_usd: number }): Promise<{ esperado: number } | null> {
  const esperado = await montoEsperadoUsd(params);
  return esperado !== null && params.monto_usd + TOLERANCIA_USD < esperado ? { esperado } : null;
}

export const MENSAJE_PAGO_CIBIR_REQUERIDO =
  'No se puede mover a la etapa CIBIR hasta registrar el pago del arancel CIBIR. Regístralo en Finanzas → Registrar cobro (o verifica el pago reportado) y vuelve a intentarlo.';

/**
 * ¿Hay un pago verificado del arancel CIBIR de esta persona? Se busca por el afiliado, por su estudiante o por el
 * afiliado vinculado al estudiante (una persona puede tener las tres identidades).
 */
export async function pagoCibirRegistrado(params: { idAfiliado?: number | null; idEstudiante?: number | null }): Promise<boolean> {
  const r = await db.execute({
    sql: `SELECT 1 FROM pagos pg
          WHERE pg.tipo_concepto = 'curso_cibir' AND pg.estatus = 'Verificado' AND pg.eliminado_en IS NULL
            AND (pg.id_afiliado = ?1
                 OR pg.id_estudiante = ?2
                 OR pg.id_afiliado IN (SELECT a.id_afiliado FROM afiliados a JOIN estudiantes e ON (a.id_persona = e.id_persona OR (a.id_empresa IS NOT NULL AND a.id_empresa = e.id_empresa))
                                       WHERE e.id_estudiante = ?2)
                 OR pg.id_estudiante IN (SELECT e.id_estudiante FROM estudiantes e JOIN afiliados a ON (a.id_persona = e.id_persona OR (a.id_empresa IS NOT NULL AND a.id_empresa = e.id_empresa))
                                         WHERE a.id_afiliado = ?1))
          LIMIT 1`,
    args: [params.idAfiliado ?? null, params.idEstudiante ?? null],
  });
  return r.rows.length > 0;
}

/** Puede entrar a la etapa CIBIR quien ya está en ella (no se le vuelve a exigir) o tiene el pago del arancel registrado. */
export async function puedeEntrarACibir(params: { idAfiliado?: number | null; idEstudiante?: number | null }): Promise<boolean> {
  if (await pagoCibirRegistrado(params)) return true;
  const r = await db.execute({
    sql: `SELECT 1 FROM afiliados a
          WHERE a.estatus = '5_CIBIR'
            AND (a.id_afiliado = ?1
                 OR a.id_afiliado IN (SELECT a2.id_afiliado FROM afiliados a2 JOIN estudiantes e ON (a2.id_persona = e.id_persona OR (a2.id_empresa IS NOT NULL AND a2.id_empresa = e.id_empresa))
                                      WHERE e.id_estudiante = ?2))
          LIMIT 1`,
    args: [params.idAfiliado ?? null, params.idEstudiante ?? null],
  });
  return r.rows.length > 0;
}

export type EstadoCobro = 'pagado' | 'por_verificar' | 'pendiente' | 'no_aplica';

/**
 * Cobros del proceso de afiliación de una persona y en qué estado está cada uno:
 *  - Formalización (inscripción + primera cuota): pendiente mientras no sea afiliada; al verificarse el pago pasa a Afiliado.
 *  - CIBIR: pendiente en las etapas 5_CIBIR y 6_INSCRIPCION si no está acreditado ni hay un pago verificado.
 * El resto de estatus (afiliados, morosos, suspendidos, rechazados) no tiene cobros de ingreso.
 */
export async function cobrosAfiliacion(idAfiliado: number) {
  const [afi, pagos, aranceles] = await Promise.all([
    db.execute({ sql: `SELECT estatus, tipo_afiliado, cibir_acreditado FROM afiliados WHERE id_afiliado = ?`, args: [idAfiliado] }),
    db.execute({
      sql: `SELECT tipo_concepto, estatus FROM pagos
            WHERE id_afiliado = ? AND tipo_concepto IN ('formalizacion_afiliacion', 'curso_cibir') AND estatus IN ('Verificado', 'Pendiente') AND eliminado_en IS NULL`,
      args: [idAfiliado],
    }),
    getAranceles(),
  ]);
  const a = afi.rows[0] as any;
  if (!a) throw new Error('Afiliado no encontrado');
  const estadoDePagos = (concepto: string): EstadoCobro | null => {
    const filas = (pagos.rows as any[]).filter(p => p.tipo_concepto === concepto);
    if (filas.some(p => p.estatus === 'Verificado')) return 'pagado';
    return filas.length ? 'por_verificar' : null;
  };
  const enProceso = ['1_PREINSCRIPCION', '2_EXPEDIENTE', '3_ENTREVISTA', '4_VERIFICACION', '5_CIBIR', '6_INSCRIPCION'].includes(String(a.estatus));
  const formalizacion = await calcularMontoFormalizacion(String(a.tipo_afiliado || 'Natural'));
  const cibirMonto = Number((aranceles.find((x: any) => x.codigo === 'curso_cibir') as any)?.monto_usd ?? 0);

  return [
    {
      concepto: 'formalizacion_afiliacion' as const,
      etiqueta: 'Formalización de afiliación',
      detalle: `Cuota de inscripción $${formalizacion.cuotaInscripcion.toFixed(2)} + primera cuota de sostenimiento $${formalizacion.primeraMensualidad.toFixed(2)}`,
      monto_usd: formalizacion.totalUSD,
      estado: (enProceso ? (estadoDePagos('formalizacion_afiliacion') ?? 'pendiente') : (estadoDePagos('formalizacion_afiliacion') ?? 'no_aplica')) as EstadoCobro,
    },
    {
      concepto: 'curso_cibir' as const,
      etiqueta: 'CIBIR',
      detalle: 'Arancel del Curso de Iniciación en Bienes Raíces',
      monto_usd: cibirMonto,
      estado: (estadoDePagos('curso_cibir') ?? (['5_CIBIR', '6_INSCRIPCION'].includes(String(a.estatus)) && Number(a.cibir_acreditado) !== 1 && cibirMonto > 0 ? 'pendiente' : 'no_aplica')) as EstadoCobro,
    },
  ];
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

  // Una mensualidad siempre se aplica al mes impago más antiguo, no al mes elegido
  if (params.tipo_concepto === 'mensualidad' && params.id_afiliado) {
    params = { ...params, periodo: await mesMasAntiguoImpago(params.id_afiliado) };
  }

  // El cobro de un curso al público general se asocia al estudiante de la inscripción
  if (params.id_inscripcion_curso && !params.id_afiliado && !params.id_estudiante) {
    const insc = await db.execute({
      sql: `SELECT id_estudiante FROM inscripciones_cursos WHERE id_inscripcion = ?`,
      args: [params.id_inscripcion_curso]
    });
    params = { ...params, id_estudiante: insc.rows[0] ? Number(insc.rows[0].id_estudiante) : null };
  }
  if (!params.id_afiliado && !params.id_estudiante) {
    throw new Error('El cobro necesita un afiliado o una inscripción de curso');
  }

  // Una reserva vencida ya liberó su cupo: solo se cobra si el curso aún tiene lugar
  if (params.id_inscripcion_curso) {
    const r = await db.execute({
      sql: `SELECT ${sqlOcupaCupo('ic')} AS ocupa, c.cupos_totales,
                   (SELECT COUNT(*) FROM inscripciones_cursos o WHERE o.id_curso = ic.id_curso AND ${sqlOcupaCupo('o')}) AS ocupados
            FROM inscripciones_cursos ic JOIN cursos c ON c.id_curso = ic.id_curso
            WHERE ic.id_inscripcion = ?`,
      args: [params.id_inscripcion_curso]
    });
    const insc = r.rows[0] as any;
    // Las inscripciones a programas (CIBIR, PREANI…) no son cursos: se cobran con su propio concepto
    if (!insc) throw new Error('La inscripción indicada no es de un curso');
    if (!Number(insc.ocupa) && !esCupoIlimitado(insc.cupos_totales) && Number(insc.ocupados) >= Number(insc.cupos_totales)) {
      throw new Error('La reserva de esta inscripción venció y el curso ya no tiene cupos disponibles');
    }
  }

  const insertRes = await conNumeroRecibo(numeroRecibo => db.execute({
    sql: `INSERT INTO pagos (
            numero_recibo, id_afiliado, id_inscripcion_curso, id_edicion_cibir,
            tipo_concepto, descripcion_concepto, metodo_pago, moneda,
            monto, monto_usd_equivalente, tasa_bcv, banco_origen,
            banco_destino, referencia, titular_origen, telefono_origen,
            comprobante_url, estatus, origen_registro, registrado_por,
            verificado_por, fecha_pago, fecha_verificacion, notas, creado_en,
            periodo, meses_cubiertos, id_estudiante, codigo_arancel
          ) VALUES (
            ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?,
            NULL, 'Verificado', 'admin', ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?
          ) RETURNING *`,
    args: [
      numeroRecibo,
      params.id_afiliado ?? null,
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
      ...periodoArgs(params, now),
      params.id_estudiante ?? null,
      params.codigo_arancel ?? codigoArancelPorDefecto(params.tipo_concepto)
    ]
  }));

  const pagoCreado = insertRes.rows[0] as any;

  // Si es formalización de afiliación, activar automáticamente
  if (params.tipo_concepto === 'formalizacion_afiliacion' && params.id_afiliado) {
    await formalizarAfiliado(params.id_afiliado, pagoCreado.id_pago);
  }

  if (params.id_inscripcion_curso) {
    await confirmarInscripcionPagada(params.id_inscripcion_curso);
  }

  // Si es cobro de curso CIBIR
  if (params.tipo_concepto === 'curso_cibir' && params.id_edicion_cibir) {
    try {
      await db.execute({
        sql: `UPDATE inscripciones_edicion_cibir 
              SET actualizado_en = ? 
              WHERE id_edicion = ? AND id_afiliado = ?`,
        args: [now, params.id_edicion_cibir, params.id_afiliado ?? null]
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

  // Una mensualidad siempre se aplica al mes impago más antiguo, no al mes elegido
  if (params.tipo_concepto === 'mensualidad' && params.id_afiliado) {
    params = { ...params, periodo: await mesMasAntiguoImpago(params.id_afiliado) };
  }

  const insertRes = await conNumeroRecibo(numeroRecibo => db.execute({
    sql: `INSERT INTO pagos (
            numero_recibo, id_afiliado, id_inscripcion_curso, id_edicion_cibir,
            tipo_concepto, descripcion_concepto, metodo_pago, moneda,
            monto, monto_usd_equivalente, tasa_bcv, banco_origen,
            banco_destino, referencia, titular_origen, telefono_origen,
            comprobante_url, estatus, origen_registro, registrado_por,
            verificado_por, fecha_pago, fecha_verificacion, notas, creado_en,
            periodo, meses_cubiertos, id_estudiante, codigo_arancel
          ) VALUES (
            ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, 'Pendiente', 'afiliado', ?,
            NULL, ?, NULL, ?, ?,
            ?, ?, ?, ?
          ) RETURNING *`,
    args: [
      numeroRecibo,
      params.id_afiliado ?? null,
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
      ...periodoArgs(params, now),
      null, // id_estudiante: el reporte en línea es solo de afiliados
      params.codigo_arancel ?? codigoArancelPorDefecto(params.tipo_concepto)
    ]
  }));

  const pagoCreado = insertRes.rows[0] as any;
  const numeroRecibo = pagoCreado.numero_recibo as string;

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
      roles: ROLES_FINANZAS,
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

  if (pago.id_inscripcion_curso) {
    await confirmarInscripcionPagada(Number(pago.id_inscripcion_curso));
  }

  // Notificar al usuario que su pago fue verificado
  try {
    NotificationService.notify({
      userId: pago.registrado_por,
      title: `Pago Verificado (${pago.numero_recibo})`,
      message: `Tu pago de ${pago.monto} ${pago.moneda} ha sido verificado satisfactoriamente por la administración.`,
      type: 'PAGO_VERIFICADO',
      channels: ['IN_APP', 'EMAIL']
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

  if (pago.id_inscripcion_curso) {
    await liberarReservaVencida(Number(pago.id_inscripcion_curso));
  }

  // Notificar al usuario del rechazo
  try {
    NotificationService.notify({
      userId: pago.registrado_por,
      title: `Pago No Aprobado (${pago.numero_recibo})`,
      message: `Tu pago no pudo ser verificado. Motivo: ${motivoRechazo}. Por favor revisa y vuelve a reportar el comprobante.`,
      type: 'PAGO_RECHAZADO',
      channels: ['IN_APP', 'EMAIL']
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
           COALESCE(per.telefono, emp.telefono) as pagador_telefono,
           u_admin.email as admin_verificador_email
    FROM pagos p
    ${SQL_JOIN_PAGADOR}
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

// ─────────────────────────────────────────────────────────────────────────────
// Correcciones del superadmin
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Anula un pago verificado o reportado. Deja de contar en los libros, el dashboard y la solvencia. No revierte efectos
 * ya aplicados (afiliado formalizado, inscripción a un curso marcada como pagada).
 */
export async function anularPago(idPago: number, motivo: string, userId: number, emailUsuario: string) {
  const r = await db.execute({ sql: `SELECT estatus, numero_recibo, notas FROM pagos WHERE id_pago = ? AND eliminado_en IS NULL`, args: [idPago] });
  const pago = r.rows[0] as any;
  if (!pago) throw Object.assign(new Error('Pago no encontrado'), { status: 404 });
  if (!['Verificado', 'Pendiente'].includes(pago.estatus)) {
    throw Object.assign(new Error(`El pago ya está "${pago.estatus}" y no se puede anular`), { status: 409 });
  }
  const ahora = new Date().toISOString();
  const u = await db.execute({
    sql: `UPDATE pagos
          SET estatus = 'Anulado', motivo_rechazo = ?, actualizado_en = ?,
              notas = COALESCE(notas || ' | ', '') || ?
          WHERE id_pago = ? RETURNING *`,
    args: [motivo, ahora, `Anulado por ${emailUsuario} (usuario ${userId}) el ${ahora.slice(0, 10)}: ${motivo}`, idPago],
  });
  return u.rows[0];
}

/**
 * Marca (o desmarca) un mes de la solvencia de un afiliado como pagado sin recibo. Va al historial de solvencia, que es
 * lo que ya leen la línea de tiempo, el bloqueo por mora y los libros. Un mes cubierto por un pago real no se toca aquí:
 * ese pago se anula.
 */
export async function marcarMesSolvencia(idAfiliado: number, periodo: string, pagado: boolean, userId: number) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodo)) throw Object.assign(new Error('periodo debe tener el formato AAAA-MM'), { status: 400 });
  if (pagado) {
    await db.execute({
      sql: `INSERT INTO solvencia_historial (id_afiliado, periodo, estado, fuente) VALUES (?, ?, 'pagado', ?)
            ON CONFLICT (id_afiliado, periodo) DO UPDATE SET estado = 'pagado', fuente = excluded.fuente, importado_en = strftime('%Y-%m-%dT%H:%M:%SZ','now')`,
      args: [idAfiliado, periodo, `manual:${userId}`],
    });
    return;
  }
  const real = await db.execute({
    sql: `SELECT 1 FROM pagos
          WHERE id_afiliado = ? AND tipo_concepto IN ('mensualidad', 'formalizacion_afiliacion') AND estatus IN ('Verificado', 'Pendiente')
            AND eliminado_en IS NULL AND periodo IS NOT NULL AND periodo <= ?
            AND strftime('%Y-%m', date(periodo || '-01', '+' || (COALESCE(meses_cubiertos, 1) - 1) || ' months')) >= ?
          LIMIT 1`,
    args: [idAfiliado, periodo, periodo],
  });
  if (real.rows.length) throw Object.assign(new Error('Ese mes está cubierto por un pago con recibo: anula el pago para dejarlo sin pagar'), { status: 409 });
  await db.execute({ sql: `DELETE FROM solvencia_historial WHERE id_afiliado = ? AND periodo = ? AND estado = 'pagado'`, args: [idAfiliado, periodo] });
}
