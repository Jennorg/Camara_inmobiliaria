import { db } from '../lib/db.js';
import { NotificationService } from './notification.service.js';

export type TipoDenunciante = 'afiliado' | 'no_afiliado';
export type TipoFalta =
  | 'incumplimiento_contrato'
  | 'comisiones_indebidas'
  | 'publicidad_enganosa'
  | 'falta_etica'
  | 'retencion_documentos'
  | 'fraude_estafa'
  | 'otro';

export type EstatusDenuncia =
  | 'recibida'
  | 'en_revision'
  | 'en_descargos'
  | 'en_mediacion'
  | 'resuelta'
  | 'desestimada'
  | 'archivada';

export type TipoResolucion =
  | 'conciliacion_acuerdo'
  | 'amonestacion_privada'
  | 'amonestacion_publica'
  | 'suspension_temporal'
  | 'expulsion_definitiva'
  | 'desestimacion_sin_lugar'
  | 'otro';

export type PrioridadDenuncia = 'baja' | 'media' | 'alta' | 'urgente';

export interface CrearDenunciaInput {
  tipo_denunciante: TipoDenunciante;
  id_afiliado_denunciante?: number | null;
  id_user_denunciante?: number | null;
  nombre_denunciante: string;
  cedula_rif_denunciante: string;
  email_denunciante: string;
  telefono_denunciante: string;
  direccion_denunciante?: string | null;
  id_afiliado_denunciado: number;
  tipo_falta: TipoFalta;
  titulo: string;
  descripcion_hechos: string;
  inmueble_referencia?: string | null;
  monto_involucrado?: number;
  moneda_monto?: 'USD' | 'VES';
  prioridad?: PrioridadDenuncia;
  documentos?: { nombre_archivo: string; url: string }[];
}

export interface FiltrosDenunciasAdmin {
  estatus?: string;
  tipo_falta?: string;
  prioridad?: string;
  search?: string;
  id_afiliado_denunciado?: number;
}

export const denunciasService = {
  /**
   * Genera el siguiente correlativo secuencial DEN-YYYY-XXXX
   */
  async generarCodigoDenuncia(): Promise<string> {
    const anio = new Date().getFullYear();
    const prefix = `DEN-${anio}-`;

    const res = await db.execute({
      sql: `SELECT codigo FROM denuncias WHERE codigo LIKE ? ORDER BY id_denuncia DESC LIMIT 1`,
      args: [`${prefix}%`]
    });

    let seq = 1;
    if (res.rows.length > 0) {
      const lastCode = String(res.rows[0].codigo);
      const parts = lastCode.split('-');
      if (parts.length === 3) {
        const parsed = parseInt(parts[2], 10);
        if (!isNaN(parsed)) seq = parsed + 1;
      }
    }

    return `${prefix}${String(seq).padStart(4, '0')}`;
  },

  /**
   * Genera un PIN alfanumérico aleatorio de 6 caracteres para seguimiento público
   */
  generarPinSeguimiento(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let pin = '';
    for (let i = 0; i < 6; i++) {
      pin += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pin;
  },

  /**
   * Registra una nueva denuncia (Pública o de Afiliado)
   */
  async crearDenuncia(input: CrearDenunciaInput) {
    // 1. Obtener datos del afiliado denunciado
    const afilRes = await db.execute({
      sql: `SELECT 
              a.id_afiliado, 
              a.codigo as codigo_afiliado,
              a.tipo_afiliado as tipo_persona,
              per.nombres || ' ' || COALESCE(per.apellidos, '') as nombre_persona,
              emp.razon_social as razon_social_empresa
            FROM afiliados a
            LEFT JOIN personas per ON a.id_persona = per.id
            LEFT JOIN empresas emp ON a.id_empresa = emp.id_empresa
            WHERE a.id_afiliado = ? AND a.eliminado_en IS NULL`,
      args: [input.id_afiliado_denunciado]
    });

    if (!afilRes.rows.length) {
      throw new Error('El afiliado denunciado seleccionado no existe en el registro gremial.');
    }

    const rowAfil = afilRes.rows[0] as any;
    const nombreSnapshot = rowAfil.tipo_persona === 'Corporativo' || rowAfil.razon_social_empresa
      ? String(rowAfil.razon_social_empresa || rowAfil.nombre_persona)
      : String(rowAfil.nombre_persona || 'Afiliado');
    const codigoAfiliado = rowAfil.codigo_afiliado ? String(rowAfil.codigo_afiliado) : null;

    // 2. Generar Código y PIN
    const codigo = await this.generarCodigoDenuncia();
    const pin = this.generarPinSeguimiento();

    // 3. Insertar Denuncia
    const insertRes = await db.execute({
      sql: `INSERT INTO denuncias (
              codigo, pin_seguimiento, tipo_denunciante, id_afiliado_denunciante,
              id_user_denunciante, nombre_denunciante, cedula_rif_denunciante,
              email_denunciante, telefono_denunciante, direccion_denunciante,
              id_afiliado_denunciado, nombre_denunciado_snapshot, codigo_afiliado_denunciado,
              tipo_falta, titulo, descripcion_hechos, inmueble_referencia,
              monto_involucrado, moneda_monto, prioridad, estatus
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'recibida')`,
      args: [
        codigo,
        pin,
        input.tipo_denunciante,
        input.id_afiliado_denunciante || null,
        input.id_user_denunciante || null,
        input.nombre_denunciante.trim(),
        input.cedula_rif_denunciante.trim().toUpperCase(),
        input.email_denunciante.trim().toLowerCase(),
        input.telefono_denunciante.trim(),
        input.direccion_denunciante?.trim() || null,
        input.id_afiliado_denunciado,
        nombreSnapshot,
        codigoAfiliado,
        input.tipo_falta,
        input.titulo.trim(),
        input.descripcion_hechos.trim(),
        input.inmueble_referencia?.trim() || null,
        Number(input.monto_involucrado || 0),
        input.moneda_monto || 'USD',
        input.prioridad || 'media'
      ]
    });

    const idDenuncia = Number(insertRes.lastInsertRowid);

    // 4. Guardar Documentos probatorios
    if (input.documentos && input.documentos.length > 0) {
      for (const doc of input.documentos) {
        if (doc.url && doc.nombre_archivo) {
          await db.execute({
            sql: `INSERT INTO documentos_denuncia (id_denuncia, tipo_origen, nombre_archivo, url)
                  VALUES (?, 'denunciante', ?, ?)`,
            args: [idDenuncia, doc.nombre_archivo, doc.url]
          });
        }
      }
    }

    // 5. Registrar Hito inicial en Historial
    await db.execute({
      sql: `INSERT INTO historial_denuncia (id_denuncia, estatus_anterior, estatus_nuevo, accion, comentario, es_visible_partes)
            VALUES (?, NULL, 'recibida', 'Radicación de Denuncia', 'Denuncia formal presentada exitosamente ante la Cámara Inmobiliaria.', 1)`,
      args: [idDenuncia]
    });

    // 6. Notificar a administradores / directiva
    try {
      await NotificationService.notifyAdmins({
        title: 'Nueva Denuncia Gremial Radicada',
        message: `Se ha recibido la denuncia ${codigo} contra el afiliado ${nombreSnapshot} (${codigoAfiliado || 'Sin código'}).`,
        type: 'DENUNCIA_NUEVA',
        priority: 'ALTA',
        data: { id_denuncia: idDenuncia, codigo, id_afiliado_denunciado: input.id_afiliado_denunciado }
      });
    } catch (e) {
      console.error('[Denuncias] Error al notificar admins:', e);
    }

    return {
      id_denuncia: idDenuncia,
      codigo,
      pin_seguimiento: pin,
      nombre_denunciado: nombreSnapshot,
      fecha_presentacion: new Date().toISOString()
    };
  },

  /**
   * Consulta pública de estado para el denunciante mediante Código y PIN
   */
  async consultarDenunciaPublica(codigo: string, pin: string) {
    const cleanCodigo = codigo.trim().toUpperCase();
    const cleanPin = pin.trim().toUpperCase();

    const res = await db.execute({
      sql: `SELECT 
              d.id_denuncia,
              d.codigo,
              d.tipo_denunciante,
              d.nombre_denunciante,
              d.nombre_denunciado_snapshot as nombre_denunciado,
              d.codigo_afiliado_denunciado,
              d.tipo_falta,
              d.titulo,
              d.descripcion_hechos,
              d.inmueble_referencia,
              d.estatus,
              d.prioridad,
              d.fecha_presentacion,
              d.fecha_admisibilidad,
              d.fecha_audiencia_mediacion,
              d.lugar_modalidad_audiencia,
              d.tipo_resolucion,
              d.dictamen_resolucion,
              d.acta_resolucion_url,
              d.fecha_resolucion
            FROM denuncias d
            WHERE d.codigo = ? AND UPPER(d.pin_seguimiento) = ? AND d.eliminado_en IS NULL`,
      args: [cleanCodigo, cleanPin]
    });

    if (!res.rows.length) {
      throw new Error('No se encontró ninguna denuncia con el código y PIN ingresados. Verifique los datos.');
    }

    const denuncia = res.rows[0] as any;

    // Obtener historial visible para las partes
    const histRes = await db.execute({
      sql: `SELECT id_historial, estatus_anterior, estatus_nuevo, accion, comentario, fecha
            FROM historial_denuncia
            WHERE id_denuncia = ? AND es_visible_partes = 1
            ORDER BY fecha ASC, id_historial ASC`,
      args: [denuncia.id_denuncia]
    });

    // Obtener documentos subidos por el tribunal / resolución
    const docsRes = await db.execute({
      sql: `SELECT id_documento_denuncia, tipo_origen, nombre_archivo, url, creado_en
            FROM documentos_denuncia
            WHERE id_denuncia = ?
            ORDER BY id_documento_denuncia ASC`,
      args: [denuncia.id_denuncia]
    });

    return {
      ...denuncia,
      historial: histRes.rows,
      documentos: docsRes.rows
    };
  },

  /**
   * Listar denuncias en el Panel Administrativo / Tribunal de Ética
   */
  async listarDenunciasAdmin(filtros: FiltrosDenunciasAdmin = {}) {
    const conditions: string[] = ['d.eliminado_en IS NULL'];
    const args: any[] = [];

    if (filtros.estatus) {
      conditions.push('d.estatus = ?');
      args.push(filtros.estatus);
    }
    if (filtros.tipo_falta) {
      conditions.push('d.tipo_falta = ?');
      args.push(filtros.tipo_falta);
    }
    if (filtros.prioridad) {
      conditions.push('d.prioridad = ?');
      args.push(filtros.prioridad);
    }
    if (filtros.id_afiliado_denunciado) {
      conditions.push('d.id_afiliado_denunciado = ?');
      args.push(filtros.id_afiliado_denunciado);
    }
    if (filtros.search) {
      const q = `%${filtros.search.trim().toLowerCase()}%`;
      conditions.push(`(
        LOWER(d.codigo) LIKE ? OR
        LOWER(d.nombre_denunciante) LIKE ? OR
        LOWER(d.nombre_denunciado_snapshot) LIKE ? OR
        LOWER(d.titulo) LIKE ? OR
        LOWER(d.cedula_rif_denunciante) LIKE ?
      )`);
      args.push(q, q, q, q, q);
    }

    const whereSql = conditions.join(' AND ');

    // 1. Obtener lista de denuncias
    const listRes = await db.execute({
      sql: `SELECT 
              d.id_denuncia,
              d.codigo,
              d.pin_seguimiento,
              d.tipo_denunciante,
              d.nombre_denunciante,
              d.cedula_rif_denunciante,
              d.email_denunciante,
              d.telefono_denunciante,
              d.id_afiliado_denunciado,
              d.nombre_denunciado_snapshot as nombre_denunciado,
              d.codigo_afiliado_denunciado,
              d.tipo_falta,
              d.titulo,
              d.prioridad,
              d.estatus,
              d.monto_involucrado,
              d.moneda_monto,
              d.tipo_resolucion,
              d.fecha_presentacion,
              d.fecha_audiencia_mediacion,
              d.fecha_resolucion,
              (SELECT COUNT(*) FROM documentos_denuncia doc WHERE doc.id_denuncia = d.id_denuncia) as total_archivos
            FROM denuncias d
            WHERE ${whereSql}
            ORDER BY d.id_denuncia DESC`,
      args
    });

    // 2. Métricas / KPIs generales
    const kpisRes = await db.execute(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN estatus = 'recibida' THEN 1 END) as recibidas,
        COUNT(CASE WHEN estatus = 'en_revision' THEN 1 END) as en_revision,
        COUNT(CASE WHEN estatus = 'en_mediacion' THEN 1 END) as en_mediacion,
        COUNT(CASE WHEN estatus = 'resuelta' THEN 1 END) as resueltas,
        COUNT(CASE WHEN estatus = 'desestimada' THEN 1 END) as desestimadas
      FROM denuncias
      WHERE eliminado_en IS NULL
    `);

    const kpiRow = kpisRes.rows[0] as any;

    return {
      kpis: {
        total: Number(kpiRow?.total || 0),
        recibidas: Number(kpiRow?.recibidas || 0),
        enRevision: Number(kpiRow?.en_revision || 0),
        enMediacion: Number(kpiRow?.en_mediacion || 0),
        resueltas: Number(kpiRow?.resueltas || 0),
        desestimadas: Number(kpiRow?.desestimadas || 0)
      },
      denuncias: listRes.rows
    };
  },

  /**
   * Obtener expediente completo para el panel administrativo
   */
  async getDetalleDenunciaAdmin(id: number) {
    const res = await db.execute({
      sql: `SELECT 
              d.*,
              a.tipo_afiliado as denunciado_tipo_persona,
              a.estatus as denunciado_estatus_afiliado,
              per.email as denunciado_email_persona,
              per.telefono as denunciado_telefono_persona,
              emp.email as denunciado_email_empresa,
              emp.telefono as denunciado_telefono_empresa,
              (emp.rif_tipo || '-' || emp.rif_numero) as denunciado_rif_empresa,
              u.email as resuelto_por_email
            FROM denuncias d
            LEFT JOIN afiliados a ON d.id_afiliado_denunciado = a.id_afiliado
            LEFT JOIN personas per ON a.id_persona = per.id
            LEFT JOIN empresas emp ON a.id_empresa = emp.id_empresa
            LEFT JOIN users u ON d.resuelto_por = u.id
            WHERE d.id_denuncia = ? AND d.eliminado_en IS NULL`,
      args: [id]
    });

    if (!res.rows.length) {
      throw new Error('Denuncia no encontrada');
    }

    const denuncia = res.rows[0] as any;

    // Documentos adjuntos
    const docsRes = await db.execute({
      sql: `SELECT * FROM documentos_denuncia WHERE id_denuncia = ? ORDER BY id_documento_denuncia ASC`,
      args: [id]
    });

    // Historial completo
    const histRes = await db.execute({
      sql: `SELECT h.*, u.email as usuario_email, u.role as usuario_rol
            FROM historial_denuncia h
            LEFT JOIN users u ON h.usuario_id = u.id
            WHERE h.id_denuncia = ?
            ORDER BY h.fecha ASC, h.id_historial ASC`,
      args: [id]
    });

    return {
      ...denuncia,
      documentos: docsRes.rows,
      historial: histRes.rows
    };
  },

  /**
   * Cambiar estatus de la denuncia con registro en historial
   */
  async cambiarEstatus(id: number, estatusNuevo: EstatusDenuncia, comentario?: string, userId?: number) {
    const currRes = await db.execute({
      sql: `SELECT estatus, codigo FROM denuncias WHERE id_denuncia = ? AND eliminado_en IS NULL`,
      args: [id]
    });

    if (!currRes.rows.length) throw new Error('Denuncia no encontrada');
    const estatusAnterior = String(currRes.rows[0].estatus);
    const codigo = String(currRes.rows[0].codigo);

    await db.execute({
      sql: `UPDATE denuncias SET estatus = ?, actualizado_en = datetime('now') WHERE id_denuncia = ?`,
      args: [estatusNuevo, id]
    });

    await db.execute({
      sql: `INSERT INTO historial_denuncia (id_denuncia, estatus_anterior, estatus_nuevo, accion, comentario, usuario_id, es_visible_partes)
            VALUES (?, ?, ?, 'Cambio de Estatus', ?, ?, 1)`,
      args: [id, estatusAnterior, estatusNuevo, comentario || `Estatus actualizado a ${estatusNuevo}`, userId || null]
    });

    return { message: `Denuncia ${codigo} actualizada a ${estatusNuevo}` };
  },

  /**
   * Convocar a Mediación y Conciliación
   */
  async convocarMediacion(id: number, data: { fechaAudiencia: string; lugarModalidad: string; notas?: string }, userId?: number) {
    const currRes = await db.execute({
      sql: `SELECT estatus, codigo, nombre_denunciante, email_denunciante FROM denuncias WHERE id_denuncia = ? AND eliminado_en IS NULL`,
      args: [id]
    });
    if (!currRes.rows.length) throw new Error('Denuncia no encontrada');
    const estatusAnterior = String(currRes.rows[0].estatus);
    const codigo = String(currRes.rows[0].codigo);

    await db.execute({
      sql: `UPDATE denuncias 
            SET estatus = 'en_mediacion',
                fecha_audiencia_mediacion = ?,
                lugar_modalidad_audiencia = ?,
                actualizado_en = datetime('now')
            WHERE id_denuncia = ?`,
      args: [data.fechaAudiencia, data.lugarModalidad, id]
    });

    const comentarioHistorial = `Audiencia de mediación pautada para el ${new Date(data.fechaAudiencia).toLocaleString('es-VE')}. Modalidad / Lugar: ${data.lugarModalidad}. ${data.notas ? `Notas: ${data.notas}` : ''}`;

    await db.execute({
      sql: `INSERT INTO historial_denuncia (id_denuncia, estatus_anterior, estatus_nuevo, accion, comentario, usuario_id, es_visible_partes)
            VALUES (?, ?, 'en_mediacion', 'Convocatoria a Audiencia de Mediación', ?, ?, 1)`,
      args: [id, estatusAnterior, comentarioHistorial, userId || null]
    });

    return { message: `Audiencia de mediación agendada para el caso ${codigo}` };
  },

  /**
   * Registrar descargos / alegatos del afiliado denunciado
   */
  async registrarDescargos(id: number, data: { descargoTexto: string; documentos?: { nombre_archivo: string; url: string }[] }, userId?: number) {
    await db.execute({
      sql: `UPDATE denuncias 
            SET descargo_afiliado = ?,
                fecha_descargo = datetime('now'),
                estatus = CASE WHEN estatus = 'recibida' THEN 'en_descargos' ELSE estatus END,
                actualizado_en = datetime('now')
            WHERE id_denuncia = ?`,
      args: [data.descargoTexto, id]
    });

    if (data.documentos && data.documentos.length > 0) {
      for (const doc of data.documentos) {
        if (doc.url && doc.nombre_archivo) {
          await db.execute({
            sql: `INSERT INTO documentos_denuncia (id_denuncia, tipo_origen, nombre_archivo, url)
                  VALUES (?, 'denunciado', ?, ?)`,
            args: [id, doc.nombre_archivo, doc.url]
          });
        }
      }
    }

    await db.execute({
      sql: `INSERT INTO historial_denuncia (id_denuncia, estatus_anterior, estatus_nuevo, accion, comentario, usuario_id, es_visible_partes)
            VALUES (?, 'en_descargos', 'en_descargos', 'Consignación de Descargos', 'El afiliado denunciado ha consignado formalmente sus descargos y alegatos de defensa.', ?, 1)`,
      args: [id, userId || null]
    });

    return { message: 'Descargos del afiliado registrados exitosamente' };
  },

  /**
   * Emitir la resolución final del caso ("determinar el fin al problema")
   */
  async resolverDenuncia(id: number, data: {
    tipoResolucion: TipoResolucion;
    dictamen: string;
    actaUrl?: string | null;
  }, userId?: number) {
    const currRes = await db.execute({
      sql: `SELECT estatus, codigo FROM denuncias WHERE id_denuncia = ? AND eliminado_en IS NULL`,
      args: [id]
    });
    if (!currRes.rows.length) throw new Error('Denuncia no encontrada');
    const estatusAnterior = String(currRes.rows[0].estatus);
    const codigo = String(currRes.rows[0].codigo);

    const estatusFinal: EstatusDenuncia = data.tipoResolucion === 'desestimacion_sin_lugar' ? 'desestimada' : 'resuelta';
    const fechaResolucion = new Date().toISOString();

    await db.execute({
      sql: `UPDATE denuncias 
            SET estatus = ?,
                tipo_resolucion = ?,
                dictamen_resolucion = ?,
                acta_resolucion_url = ?,
                resuelto_por = ?,
                fecha_resolucion = ?,
                actualizado_en = datetime('now')
            WHERE id_denuncia = ?`,
      args: [
        estatusFinal,
        data.tipoResolucion,
        data.dictamen.trim(),
        data.actaUrl || null,
        userId || null,
        fechaResolucion,
        id
      ]
    });

    if (data.actaUrl) {
      await db.execute({
        sql: `INSERT INTO documentos_denuncia (id_denuncia, tipo_origen, nombre_archivo, url)
              VALUES (?, 'camara_resolucion', 'Acta_Resolucion_Oficial.pdf', ?)`,
        args: [id, data.actaUrl]
      });
    }

    const accionTitulo = data.tipoResolucion === 'conciliacion_acuerdo'
      ? 'Resolución por Conciliación y Acuerdo'
      : (data.tipoResolucion === 'desestimacion_sin_lugar' ? 'Desestimación del Caso' : 'Resolución con Sanción Disciplinaria');

    await db.execute({
      sql: `INSERT INTO historial_denuncia (id_denuncia, estatus_anterior, estatus_nuevo, accion, comentario, usuario_id, es_visible_partes)
            VALUES (?, ?, ?, ?, ?, ?, 1)`,
      args: [
        id,
        estatusAnterior,
        estatusFinal,
        accionTitulo,
        `Dictamen final emitido: ${data.dictamen.slice(0, 200)}...`,
        userId || null
      ]
    });

    return {
      message: `Caso ${codigo} resuelto formalmente. Fin del procedimiento registrado.`,
      estatus: estatusFinal,
      fecha_resolucion: fechaResolucion
    };
  },

  /**
   * Actualizar notas internas del expediente
   */
  async guardarNotasInternas(id: number, notas: string) {
    await db.execute({
      sql: `UPDATE denuncias SET notas_internas = ?, actualizado_en = datetime('now') WHERE id_denuncia = ?`,
      args: [notas, id]
    });
    return { message: 'Notas internas guardadas' };
  }
};
