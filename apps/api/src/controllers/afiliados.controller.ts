import { Request, Response } from 'express';
import { randomUUID, createHash } from 'crypto';
import { db } from '../lib/db.js';
import { env } from '../config/env.js';

const sha256 = (raw: string) => createHash('sha256').update(raw).digest('hex');

const avatarFallback = (name: string) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=047857&color=fff&size=200`;

import {
  enviarCorreoVerificacion,
  enviarCorreoAprobacion,
  notificarAdminNuevaAfiliacion,
  enviarCorreoInvitacionCorporativa,
  enviarCorreoVinculacionCorporativa,
  enviarCorreoRechazo
} from '../lib/email.js';
import { obtenerSiguienteCodigoAfiliado } from '../lib/afiliados.js';
import { crearVerificacionPreinscripcionPrograma } from './academia.controller.js';
import bcrypt from 'bcryptjs';
import { NotificationService } from '../services/notification.service.js';
import { ensureCibirCertificate } from '../lib/certificados.js';

/**
 * GET /api/afiliados/:id
 * Obtiene un afiliado por ID. Protegido por auth.
 * Un afiliado solo puede ver sus propios datos; los admins pueden ver cualquiera.
 */
/**
 * GET /api/afiliados/me/certificados
 * Lista comprobantes digitales del afiliado autenticado (vinculación por id_afiliado o email).
 */
export const getMisCertificados = async (req: Request, res: Response): Promise<void> => {
  try {
    const idAfiliado = req.user!.id_afiliado
    const userEmail = (req.user!.email ?? '').trim().toLowerCase()

    if (idAfiliado == null && !userEmail) {
      res.json({ success: true, data: [] })
      return
    }

    if (idAfiliado != null) {
      await ensureCibirCertificate(Number(idAfiliado))
    } else if (userEmail) {
      const afiRes = await db.execute({
        sql: `SELECT a.id_afiliado FROM afiliados a
              LEFT JOIN personas p ON a.id_persona = p.id
              LEFT JOIN empresas emp ON a.id_empresa = emp.id_empresa
              WHERE LOWER(TRIM(p.email)) = ? OR LOWER(TRIM(emp.email)) = ?`,
        args: [userEmail, userEmail]
      })
      if (afiRes.rows.length > 0) {
        const idAfi = (afiRes.rows[0] as any).id_afiliado
        await ensureCibirCertificate(Number(idAfi))
      }
    }

    const result = await db.execute({
      sql: `
        SELECT
          c.id_certificado,
          c.codigo_validacion,
          c.fecha_emision,
          ic.id_inscripcion,
          ic.programa_codigo,
          ic.tipo_inscripcion,
          ic.estatus AS inscripcion_estatus,
          ic.completado,
          cu.titulo AS curso_nombre,
          COALESCE(NULLIF(TRIM(COALESCE(p.nombres, '') || ' ' || COALESCE(p.apellidos, '')), ''), emp.razon_social) as estudiante_nombre
        FROM certificados c
        JOIN inscripciones_cursos ic ON ic.id_inscripcion = c.id_inscripcion
        JOIN estudiantes e ON e.id_estudiante = ic.id_estudiante
        LEFT JOIN personas p ON e.id_persona = p.id
        LEFT JOIN empresas emp ON e.id_empresa = emp.id_empresa
        LEFT JOIN cursos cu ON cu.id_curso = ic.id_curso
        WHERE (
          (? <> '' AND (LOWER(TRIM(p.email)) = ? OR LOWER(TRIM(emp.email)) = ?))
          OR (? IS NOT NULL AND EXISTS (
            SELECT 1 FROM afiliados af
            WHERE af.id_afiliado = ? AND (af.id_persona = e.id_persona OR af.id_empresa = e.id_empresa)
          ))
          OR (? IS NOT NULL AND EXISTS (
            SELECT 1 FROM afiliados af
            JOIN personas p_af ON af.id_persona = p_af.id
            WHERE af.id_afiliado = ? AND LOWER(TRIM(p_af.email)) = LOWER(TRIM(p.email))
          ))
        )
        ORDER BY c.fecha_emision DESC
      `,
      args: [userEmail, userEmail, userEmail, idAfiliado ?? null, idAfiliado ?? null, idAfiliado ?? null, idAfiliado ?? null],
    })

    res.json({ success: true, data: result.rows })
  } catch (error) {
    console.error('getMisCertificados:', error)
    res.status(500).json({ success: false, message: 'Error al obtener certificados' })
  }
}

/**
 * GET /api/afiliados/me/cursos
 * Lista los cursos en los que el usuario autenticado está inscrito y el progreso de sus módulos si aplica.
 */
export const getMisCursos = async (req: Request, res: Response): Promise<void> => {
  try {
    const { enrichUserPayload } = await import('../middlewares/auth.middleware.js');
    const enrichedUser = await enrichUserPayload(req.user!);

    const idEstudiante = enrichedUser.id_estudiante;
    const idAfiliado = enrichedUser.id_afiliado;
    const userEmail = (enrichedUser.email ?? '').trim().toLowerCase();

    const inscripciones = await db.execute({
      sql: `
        SELECT 
          ic.id_inscripcion,
          ic.programa_codigo,
          ic.tipo_inscripcion,
          ic.estatus,
          ic.estatus_academico,
          ic.creado_en as fecha_inscripcion,
          cu.titulo as curso_nombre,
          cu.categoria as nivel_academico,
          cu.imagen_url,
          a.estatus as afiliado_estatus,
          a.id_afiliado
        FROM inscripciones_cursos ic
        LEFT JOIN cursos cu ON ic.id_curso = cu.id_curso
        LEFT JOIN estudiantes e ON ic.id_estudiante = e.id_estudiante
        LEFT JOIN personas p ON e.id_persona = p.id
        LEFT JOIN afiliados a ON (e.id_persona = a.id_persona OR (e.id_empresa IS NOT NULL AND e.id_empresa = a.id_empresa))
        WHERE ((e.id_estudiante = ? AND ? IS NOT NULL)
           OR (? <> '' AND LOWER(TRIM(p.email)) = ?)
           OR (? <> '' AND EXISTS (
                SELECT 1 FROM personas p_inner 
                WHERE p_inner.id = e.id_persona 
                AND LOWER(TRIM(p_inner.email)) = ?
              )))
           AND (ic.programa_codigo IS NULL OR ic.programa_codigo <> 'AFILIACION' OR a.estatus = '5_CIBIR')
        ORDER BY ic.creado_en DESC
      `,
      args: [
        idEstudiante || null, idEstudiante || null, 
        userEmail, userEmail, 
        userEmail, userEmail
      ]
    });

    console.log('getMisCursos DEBUG ->', {
      idEstudiante, idAfiliado, userEmail, inscripcionesCount: inscripciones.rows.length
    });

    const cursosConModulos = [];

    for (const row of inscripciones.rows) {
      const cursoData: any = { ...row };
      
      // Si es de AFILIACION, pero el estatus del afiliado es '5_CIBIR'
      // lo convertimos visualmente en el programa CIBIR para el estudiante
      if (row.programa_codigo === 'AFILIACION') {
        if (row.afiliado_estatus === '5_CIBIR') {
          cursoData.programa_codigo = 'CIBIR';
          cursoData.curso_nombre = 'Programa CIBIR';
          cursoData.nivel_academico = 'Profesional';
          cursoData.estatus_academico = 'Cursando'; // forzar cursando mientras hace CIBIR
        } else {
          // Si es AFILIACION pero no está en etapa CIBIR, no lo mostramos en sus cursos
          continue;
        }
      }

      // Ajuste para nombre del programa (cuando no hay id_curso)
      if (!cursoData.curso_nombre && cursoData.programa_codigo) {
        cursoData.curso_nombre = cursoData.programa_codigo === 'CIBIR' ? 'Programa CIBIR' : cursoData.programa_codigo;
        cursoData.nivel_academico = 'Profesional'; // default fallback
      }
      
      const finalIdAfiliado = row.id_afiliado || idAfiliado;
      if (cursoData.programa_codigo === 'CIBIR' && finalIdAfiliado) {
        const modulos = await db.execute({
          sql: `
            SELECT modulo, estatus, fecha_evaluacion 
            FROM convalidaciones_cibir 
            WHERE id_afiliado = ?
            ORDER BY modulo ASC
          `,
          args: [finalIdAfiliado]
        });
        cursoData.modulos = modulos.rows;
      }
      
      cursosConModulos.push(cursoData);
    }

    res.json({ success: true, data: cursosConModulos });
  } catch (error) {
    console.error('getMisCursos:', error);
    res.status(500).json({ success: false, message: 'Error al obtener los cursos inscritos' });
  }
};

export const getAfiliadoById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const requesterId = req.user!.id_afiliado
    const requesterRoles = req.user!.roles ?? [req.user!.rol]

    // Afiliados solo pueden consultar su propio registro
    if (!requesterRoles.some(r => ['admin', 'super_admin'].includes(r)) && requesterId !== Number(id)) {
      res.status(403).json({ success: false, message: 'Acceso denegado' })
      return
    }

    const result = await db.execute({
      sql: `SELECT a.*, 
                   p.nombres, p.apellidos, (p.cedula_tipo || '-' || p.cedula) as cedula, p.email, p.telefono, p.direccion, 
                   p.fecha_nacimiento, p.nivel_academico, p.profesion, p.foto_url,
                   e.razon_social as empresa_razon_social, 
                   e.rif_tipo as empresa_rif_tipo,
                   e.rif_numero as empresa_rif_numero,
                   e.logo_url as empresa_logo_url,
                   e.website as empresa_website,
                   e.email as empresa_email,
                   e.telefono as empresa_telefono,
                   CASE WHEN json_valid(a.redes_sociales) = 1 THEN json_extract(a.redes_sociales, '$.instagram') ELSE NULL END as instagram,
                   CASE WHEN json_valid(a.redes_sociales) = 1 THEN json_extract(a.redes_sociales, '$.facebook') ELSE NULL END as facebook,
                   CASE WHEN json_valid(a.redes_sociales) = 1 THEN json_extract(a.redes_sociales, '$.linkedin') ELSE NULL END as linkedin,
                   CASE WHEN json_valid(a.redes_sociales) = 1 THEN json_extract(a.redes_sociales, '$.twitter') ELSE NULL END as twitter,
                   CASE WHEN json_valid(a.redes_sociales) = 1 THEN json_extract(a.redes_sociales, '$.tiktok') ELSE NULL END as tiktok,
                   CASE WHEN json_valid(a.redes_sociales) = 1 THEN json_extract(a.redes_sociales, '$.website') ELSE NULL END as website,
                   CASE WHEN json_valid(e.redes_sociales) = 1 THEN json_extract(e.redes_sociales, '$.instagram') ELSE NULL END as empresa_instagram,
                   CASE WHEN json_valid(e.redes_sociales) = 1 THEN json_extract(e.redes_sociales, '$.facebook') ELSE NULL END as empresa_facebook,
                   CASE WHEN json_valid(e.redes_sociales) = 1 THEN json_extract(e.redes_sociales, '$.linkedin') ELSE NULL END as empresa_linkedin,
                   CASE WHEN json_valid(e.redes_sociales) = 1 THEN json_extract(e.redes_sociales, '$.twitter') ELSE NULL END as empresa_twitter,
                   CASE WHEN json_valid(e.redes_sociales) = 1 THEN json_extract(e.redes_sociales, '$.tiktok') ELSE NULL END as empresa_tiktok,
                   CASE 
                     WHEN a.tipo_afiliado = 'Corporativo' THEN COALESCE(e.razon_social, COALESCE(p.nombres, '') || ' ' || COALESCE(p.apellidos, ''))
                     ELSE COALESCE(p.nombres, '') || ' ' || COALESCE(p.apellidos, '') 
                   END as nombre_completo
            FROM afiliados a
            JOIN personas p ON a.id_persona = p.id
            LEFT JOIN empresas e ON a.id_empresa = e.id_empresa
            WHERE a.id_afiliado = ?`,
      args: [Number(id)],
    })

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Afiliado no encontrado' })
      return
    }

    const afiliado = result.rows[0]

    // Buscar documentos adjuntos
    const docsResult = await db.execute({
      sql: `SELECT id_documento, tipo_doc, url, nombre_archivo, creado_en
            FROM documentos_adjuntos
            WHERE (entidad_tipo = 'afiliado' AND entidad_id = ?)
               OR (entidad_tipo = 'empresa' AND entidad_id = ?)
               OR (entidad_tipo = 'estudiante' AND entidad_id = (
                 SELECT id_estudiante FROM estudiantes 
                 WHERE id_persona = ? OR (id_empresa = ? AND id_empresa IS NOT NULL)
               ))
            ORDER BY creado_en ASC`,
      args: [
        afiliado.id_afiliado, 
        afiliado.id_empresa || -1, 
        afiliado.id_persona, 
        afiliado.id_empresa || -1
      ]
    })

    res.status(200).json({
      success: true,
      data: {
        ...afiliado,
        documentos: docsResult.rows
      }
    })
  } catch (error) {
    console.error('Error en getAfiliadoById:', error)
    res.status(500).json({ success: false, message: 'Error interno del servidor' })
  }
};



export const registerAfiliado = async (req: Request, res: Response) => {
  try {
    const {
      nombreCompleto,
      email,
      cedulaRif,
      telefono,
      razonSocial,
      nombres,
      apellidos,
      cedulaPersonal,
      direccion,
      fechaNacimiento,
      nivelAcademico,
      notas
    } = req.body;

    // Validación básica (nombre_completo es generado, no se necesita)
    if (!email || !cedulaRif || !telefono) {
      return res.status(400).json({
        success: false,
        message: 'Los campos básicos son requeridos (email, cedulaRif, telefono)'
      });
    }

    // Sanitizar cedulaRif (solo números para evitar errores con puntos o guiones)
    const cleanedCedulaRif = (cedulaRif || '').replace(/\D/g, '');

    // Verificar si ya existe en personas o empresas
    const existePersona = await db.execute({
      sql: `SELECT id FROM personas WHERE email = ? OR cedula = ?`,
      args: [email, cleanedCedulaRif]
    });

    const existeEmpresa = await db.execute({
      sql: `SELECT id_empresa FROM empresas WHERE email = ? OR rif_numero = ?`,
      args: [email, cleanedCedulaRif]
    });

    if (existePersona.rows.length > 0 || existeEmpresa.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'El email o la cédula/RIF ya se encuentran registrados en el sistema.'
      });
    }

    // Verificar si ya tiene una verificación pendiente y eliminarla para usar una nueva
    const existeVerificacion = await db.execute({
      sql: `SELECT token_verificacion, fecha_expiracion FROM verificaciones_email WHERE email = ? OR cedula_rif = ?`,
      args: [email, cleanedCedulaRif]
    });

    if (existeVerificacion.rows.length > 0) {
      await db.execute({
        sql: `DELETE FROM verificaciones_email WHERE email = ? OR cedula_rif = ?`,
        args: [email, cleanedCedulaRif]
      });
    }

    // Crear token de validación
    const token = randomUUID();
    const expiracion = new Date();
    expiracion.setHours(expiracion.getHours() + 24);
    const fechaExpiracionStr = expiracion.toISOString();

    // Insertar en tabla de verificaciones
    await db.execute({
      sql: `INSERT INTO verificaciones_email (
              token_verificacion, 
              nombre_completo, 
              cedula_rif, 
              email, 
              telefono, 
              fecha_expiracion
            ) VALUES (?, ?, ?, ?, ?, ?)`,
      args: [token, nombreCompleto, cleanedCedulaRif, email, telefono, fechaExpiracionStr]
    });

    // NOTA: Para no romper el esquema de verificaciones_email (que es temporal), 
    // podríamos guardar el resto en una tabla meta o simplemente permitir que se completen después.
    // Por ahora, asumiremos que los campos extra se guardan si existen en req.body para el paso final.

    // 4. Enviar email con Resend
    if (env.NODE_ENV !== 'development') {
      await enviarCorreoVerificacion(nombreCompleto, email, token);
    }

    return res.status(201).json({
      success: true,
      message: env.NODE_ENV === 'development'
        ? 'Modo desarrollo: Redirigiendo automáticamente...'
        : 'Te hemos enviado un correo de comprobación. Por favor revisa tu bandeja de entrada o SPAM.',
      data: { token }
    });

  } catch (error) {
    console.error('Error en registerAfiliado:', error);
    if (res.headersSent) return;
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor al procesar el registro'
    });
  }
};

export const verificarEmail = async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, message: 'Token es requerido' });
    }

    // Buscar token en verificaciones_email
    const verificacion = await db.execute({
      sql: `SELECT * FROM verificaciones_email WHERE token_verificacion = ?`,
      args: [token]
    });

    if (verificacion.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Token inválido o no encontrado' });
    }

    const registro = verificacion.rows[0];
    const fechaExpiracion = new Date(registro.fecha_expiracion as string);

    if (fechaExpiracion < new Date()) {
      return res.status(400).json({ success: false, message: 'El token ha expirado. Debes registrarte nuevamente.' });
    }

    // Idempotencia: si el afiliado ya existe (por intento previo o doble request),
    // consideramos la verificación exitosa y limpiamos el token.
    const yaExiste = await db.execute({
      sql: `SELECT p.*, a.id_afiliado FROM personas p JOIN afiliados a ON a.id_persona = p.id WHERE p.email = ? OR p.cedula = ? LIMIT 1`,
      args: [registro.email, registro.cedula_rif],
    });
    if (yaExiste.rows.length > 0) {
      await db.execute({
        sql: `DELETE FROM verificaciones_email WHERE token_verificacion = ?`,
        args: [token]
      });
      return res.status(200).json({
        success: true,
        message: 'El correo ya había sido verificado previamente',
        data: {
          ...yaExiste.rows[0],
          nombre_completo: yaExiste.rows[0].nombres + ' ' + yaExiste.rows[0].apellidos
        },
      });
    }

    // Insertar en afiliados — nombre_completo es columna VIRTUAL GENERATED, NO se inserta
    const estatus = '1_PREINSCRIPCION';

    try {
      // Intentamos parsear nombres/apellidos del nombre_completo almacenado en la verificación
      const fullName = String(registro.nombre_completo || '').trim()
      const parts = fullName.split(' ')
      const apellidos = parts.length > 1 ? parts.slice(Math.ceil(parts.length / 2)).join(' ') : ''
      const nombres = parts.length > 1 ? parts.slice(0, Math.ceil(parts.length / 2)).join(' ') : fullName

      const cedulaInput = String(registro.cedula_rif || '').trim()
      const cedulaMatch = cedulaInput.match(/^([VEP])?-?(.+)$/i)
      const cedulaTipo = cedulaMatch && cedulaMatch[1] ? cedulaMatch[1].toUpperCase() : 'V'
      const cedulaNumero = cedulaMatch ? cedulaMatch[2].replace(/\D/g, '') : cedulaInput.replace(/\D/g, '')

      // Insertar en personas
      const insertPersona = await db.execute({
        sql: `INSERT INTO personas (
                nombres,
                apellidos,
                email, 
                cedula_tipo,
                cedula, 
                telefono
              ) VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
        args: [nombres || fullName, apellidos, registro.email, cedulaTipo, cedulaNumero, registro.telefono]
      });

      const idPersona = insertPersona.rows[0].id;

      // Insertar en afiliados
      const insertAfiliado = await db.execute({
        sql: `INSERT INTO afiliados (
                id_persona,
                tipo_afiliado,
                estatus
              ) VALUES (?, 'Natural', ?) RETURNING *`,
        args: [idPersona, estatus]
      });

      const newAfiliado = insertAfiliado.rows[0] as any;

      // Eliminar el token usado
      await db.execute({
        sql: `DELETE FROM verificaciones_email WHERE token_verificacion = ?`,
        args: [token]
      });

      return res.status(201).json({
        success: true,
        message: 'Correo verificado y candidato registrado exitosamente',
        data: newAfiliado
      });

    } catch (dbError: any) {
      const errorMsg = dbError.message || '';
      if (errorMsg.includes('UNIQUE constraint failed')) {
        return res.status(409).json({ success: false, message: 'El email o la cédula ya han sido registrados.' });
      }
      throw dbError;
    }

  } catch (error) {
    console.error('Error en verificarEmail:', error);
    if (res.headersSent) return;
    return res.status(500).json({ success: false, message: 'Error interno al verificar correo' });
  }
};

export const getAfiliados = async (req: Request, res: Response) => {
  try {
    const { estatus, tipo_afiliado } = req.query;

    let sql = `
      SELECT a.*, (strftime('%Y', 'now') - a.ano_inicio_servicio) as anos_servicio,
             p.nombres, p.apellidos, 
             (p.cedula_tipo || '-' || p.cedula) as cedula, p.email, p.telefono, p.direccion, p.fecha_nacimiento, p.nivel_academico, p.foto_url,
             e.razon_social as empresa_razon_social, 
             e.rif_tipo as empresa_rif_tipo,
             e.rif_numero as empresa_rif_numero,
             e.logo_url as empresa_logo_url,
             e.website as empresa_website,
             e.email as empresa_email,
             e.telefono as empresa_telefono,
             COALESCE(e_redes.instagram, CASE WHEN json_valid(a.redes_sociales) = 1 THEN json_extract(a.redes_sociales, '$.instagram') ELSE NULL END) as instagram,
             COALESCE(e_redes.facebook, CASE WHEN json_valid(a.redes_sociales) = 1 THEN json_extract(a.redes_sociales, '$.facebook') ELSE NULL END) as facebook,
             COALESCE(e_redes.linkedin, CASE WHEN json_valid(a.redes_sociales) = 1 THEN json_extract(a.redes_sociales, '$.linkedin') ELSE NULL END) as linkedin,
             COALESCE(e_redes.twitter, CASE WHEN json_valid(a.redes_sociales) = 1 THEN json_extract(a.redes_sociales, '$.twitter') ELSE NULL END) as twitter,
             CASE 
               WHEN a.tipo_afiliado = 'Corporativo' THEN COALESCE(NULLIF(TRIM(e.razon_social), ''), NULLIF(TRIM(COALESCE(p.nombres, '') || ' ' || COALESCE(p.apellidos, '')), ''))
               ELSE NULLIF(TRIM(COALESCE(p.nombres, '') || ' ' || COALESCE(p.apellidos, '')), '')
             END as nombre_completo
      FROM afiliados a
      JOIN personas p ON a.id_persona = p.id
      LEFT JOIN empresas e ON a.id_empresa = e.id_empresa
      LEFT JOIN (
        SELECT id_empresa, 
               CASE WHEN json_valid(redes_sociales) = 1 THEN json_extract(redes_sociales, '$.instagram') ELSE NULL END as instagram,
               CASE WHEN json_valid(redes_sociales) = 1 THEN json_extract(redes_sociales, '$.facebook') ELSE NULL END as facebook,
               CASE WHEN json_valid(redes_sociales) = 1 THEN json_extract(redes_sociales, '$.linkedin') ELSE NULL END as linkedin,
               CASE WHEN json_valid(redes_sociales) = 1 THEN json_extract(redes_sociales, '$.twitter') ELSE NULL END as twitter
        FROM empresas
      ) e_redes ON a.id_empresa = e_redes.id_empresa
      WHERE a.eliminado_en IS NULL
        AND p.eliminado_en IS NULL
        AND e.eliminado_en IS NULL
    `;

    const args: any[] = [];

    if (estatus) {
      sql += ' AND a.estatus = ?';
      args.push(estatus as string);
    }

    if (tipo_afiliado) {
      sql += ' AND a.tipo_afiliado = ?';
      args.push(tipo_afiliado as string);
    }

    const idEmpresa = Number(req.query.id_empresa)
    if (!Number.isNaN(idEmpresa) && idEmpresa > 0) {
      sql += ' AND a.id_empresa = ?';
      args.push(idEmpresa);
    }

    sql += ' ORDER BY a.fecha_registro DESC';

    const result = await db.execute({ sql, args });

    return res.status(200).json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error en getAfiliados:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor al obtener la lista de afiliados'
    });
  }
};

export const aprobarAfiliado = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    // 1. Verificar si existe y si su estatus es Preinscrito
    const resultAfiliado = await db.execute({
      sql: `SELECT a.*, COALESCE(p.nombres, '') || ' ' || COALESCE(p.apellidos, '') as nombre_completo, p.email as email 
            FROM afiliados a 
            JOIN personas p ON a.id_persona = p.id 
            WHERE a.id_afiliado = ?`,
      args: [id]
    });

    const afiliado = resultAfiliado.rows[0];

    if (!afiliado) {
      return res.status(404).json({
        success: false,
        message: 'El candidato no fue encontrado'
      });
    }

    if (['Afiliado', 'Moroso', 'Suspendido', 'Rechazado'].includes(afiliado.estatus as string)) {
      return res.status(400).json({
        success: false,
        message: 'El candidato ya tiene un estatus final y no puede ser aprobado nuevamente'
      });
    }

    // 2. Generar el código de Afiliado (Secuencial Numérico)
    // Buscamos el último código numérico asignado usando el helper
    const codigoAfiliado = await obtenerSiguienteCodigoAfiliado();

    // 3. Actualizar a estatus Afiliado (aprobado final)
    const fechaCambio = new Date().toISOString();

    const updateResult = await db.execute({
      sql: `UPDATE afiliados 
            SET estatus = 'Afiliado', 
                inscripcion_pagada = 1, 
                codigo = ?, 
                fecha_ultimo_cambio_estatus = ?, 
                fecha_afiliacion = COALESCE(fecha_afiliacion, ?),
                actualizado_en = ?
            WHERE id_afiliado = ? RETURNING *`,
      args: [codigoAfiliado, fechaCambio, fechaCambio, fechaCambio, id]
    });

    const afiliadoActualizado = updateResult.rows[0];

    // 4. Preparar acceso (Usuario + Token de Seguridad)
    try {
      if (afiliado.email) {
        const resetToken = randomUUID();
        const expiracion = new Date();
        expiracion.setDate(expiracion.getDate() + 7);
        const expStr = expiracion.toISOString();

        // Crear el usuario en estado "por configurar" (password aleatorio inútil)
        const placeholderPass = await bcrypt.hash(randomUUID(), 10);

        // Insertar o actualizar usuario con el token hasheado
        const resetTokenHash = sha256(resetToken)
        const insertUser = await db.execute({
          sql: `INSERT INTO users (email, password_hash, roles, reset_token_hash, reset_token_expira)
                VALUES (?, ?, '["afiliado"]', ?, ?)
                ON CONFLICT(email) DO UPDATE SET 
                  reset_token_hash = excluded.reset_token_hash, 
                  reset_token_expira = excluded.reset_token_expira,
                  actualizado_en = strftime('%Y-%m-%dT%H:%M:%SZ','now')
                RETURNING id`,
          args: [afiliado.email, placeholderPass, resetTokenHash, expStr]
        });

        const newUserId = insertUser.rows[0].id;

        await db.execute({
          sql: `UPDATE afiliados SET id_user = ? WHERE id_afiliado = ?`,
          args: [newUserId, id]
        });

        // Enviar Correo de Aprobación
        await enviarCorreoAprobacion(afiliado.nombre_completo as string, afiliado.email as string, resetToken);
      }
    } catch (err) {
      console.error('Error preparando acceso para afiliado:', err);
    }

    return res.status(200).json({
      success: true,
      message: 'Candidato aprobado y correo de bienvenida enviado',
      data: afiliadoActualizado
    });

  } catch (error) {
    console.error('Error al aprobar candidato:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor al aprobar al candidato'
    });
  }
};

export const rechazarAfiliado = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    // 1. Verificar si existe y si su estatus es Preinscrito, obteniendo email y nombre
    const resultAfiliado = await db.execute({
      sql: `SELECT a.*, p.nombres, p.apellidos, p.email,
                   e.razon_social, e.email as empresa_email
            FROM afiliados a
            JOIN personas p ON a.id_persona = p.id
            LEFT JOIN empresas e ON a.id_empresa = e.id_empresa
            WHERE a.id_afiliado = ?`,
      args: [id]
    });

    const afiliado = resultAfiliado.rows[0] as any;

    if (!afiliado) {
      return res.status(404).json({
        success: false,
        message: 'El candidato no fue encontrado'
      });
    }

    if (afiliado.estatus === 'Afiliado') {
      return res.status(400).json({
        success: false,
        message: 'No se puede rechazar a un afiliado activo'
      });
    }

    const fechaCambio = new Date().toISOString();
    const updateResult = await db.execute({
      sql: `UPDATE afiliados 
            SET estatus = 'Rechazado', fecha_ultimo_cambio_estatus = ?, actualizado_en = ?
            WHERE id_afiliado = ? RETURNING *`,
      args: [fechaCambio, fechaCambio, id]
    });

    // Enviar correo de rechazo
    try {
      const isCorp = afiliado.tipo_afiliado === 'Corporativo';
      const emailOriginal = isCorp ? (afiliado.empresa_email || afiliado.email) : afiliado.email;
      const nombre = isCorp 
        ? (afiliado.razon_social || `${afiliado.nombres || ''} ${afiliado.apellidos || ''}`.trim())
        : `${afiliado.nombres || ''} ${afiliado.apellidos || ''}`.trim();

      await enviarCorreoRechazo({
        nombre,
        emailOriginal,
        programaCodigo: 'AFILIACION',
        motivo: req.body?.motivo || req.body?.notaAdmin || null
      });
    } catch (err) {
      console.error('Error enviando correo de rechazo de afiliación:', err);
    }

    return res.status(200).json({
      success: true,
      message: 'Candidato ha sido rechazado exitosamente',
      data: updateResult.rows[0]
    });

  } catch (error) {
    console.error('Error al rechazar candidato:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor al rechazar al candidato'
    });
  }
};

// ==========================================
// RUTAS PÚBLICAS
// ==========================================

export const buscarAfiliadosPublic = async (req: Request, res: Response) => {
  try {
    // ──────────────────────────────────────────────────────────────────────────
    // Query params:
    //   ?q=<digits>  → exact-match search value (stripped of non-digits)
    //   ?tipo=cedula → match against personas.cedula  (all active affiliates)
    //   ?tipo=rif    → match against empresas.rif_numero (Corporativos only)
    //
    // When ?q is absent the full list is returned (backward compat for Fuse.js).
    // ──────────────────────────────────────────────────────────────────────────
    const rawQ  = String(req.query.q  ?? '').trim()
    const tipo  = String(req.query.tipo ?? '').toLowerCase() // 'cedula' | 'rif' | ''
    const q     = rawQ.replace(/\D/g, '') // only digits

    const BASE_SELECT = `
      SELECT a.id_afiliado, a.id_empresa,
             CASE
               WHEN a.tipo_afiliado = 'Corporativo' THEN COALESCE(NULLIF(TRIM(e.razon_social), ''), NULLIF(TRIM(COALESCE(p.nombres, '') || ' ' || COALESCE(p.apellidos, '')), ''))
               ELSE NULLIF(TRIM(COALESCE(p.nombres, '') || ' ' || COALESCE(p.apellidos, '')), '')
             END as nombre_completo,
             NULLIF(TRIM(COALESCE(p.nombres, '') || ' ' || COALESCE(p.apellidos, '')), '') as representante_nombre,
             p.nombres, p.apellidos, a.codigo, p.foto_url,
             (strftime('%Y', 'now') - a.ano_inicio_servicio) as anos_servicio, a.fecha_afiliacion,
             (p.cedula_tipo || '-' || p.cedula) as cedula,
             e.rif_numero as empresa_rif_numero, e.rif_tipo as empresa_rif_tipo,
             a.tipo_afiliado,
             e.razon_social as empresa_razon_social,
             e.logo_url as empresa_logo_url, e.website as empresa_website,
             p.email as email,
             e.email as empresa_email,
             CASE WHEN json_valid(a.redes_sociales) = 1 THEN json_extract(a.redes_sociales, '$.instagram') ELSE NULL END as instagram,
             CASE WHEN json_valid(a.redes_sociales) = 1 THEN json_extract(a.redes_sociales, '$.facebook')  ELSE NULL END as facebook,
             CASE WHEN json_valid(a.redes_sociales) = 1 THEN json_extract(a.redes_sociales, '$.linkedin')  ELSE NULL END as linkedin,
             CASE WHEN json_valid(a.redes_sociales) = 1 THEN json_extract(a.redes_sociales, '$.twitter')   ELSE NULL END as twitter
      FROM afiliados a
      JOIN personas p ON a.id_persona = p.id
      LEFT JOIN empresas e ON a.id_empresa = e.id_empresa
    `

    const BASE_WHERE = `
      WHERE a.estatus = 'Afiliado'
        AND a.activo = 1
        AND a.eliminado_en IS NULL
        AND p.eliminado_en IS NULL
        AND p.foto_url IS NOT NULL
        AND p.foto_url <> ''
    `

    let sql: string
    let args: any[]

    if (q && q.length >= 5) {
      const upperTipo = tipo.toUpperCase()
      if (['J', 'G', 'C'].includes(upperTipo)) {
        // ── Búsqueda por RIF de empresa (Corporativos) ─────────────────
        sql = `${BASE_SELECT} ${BASE_WHERE}
               AND e.rif_numero = ?
               AND UPPER(e.rif_tipo) = ?
               LIMIT 5`
        args = [q, upperTipo]
      } else if (['V', 'E', 'P'].includes(upperTipo)) {
        // ── Búsqueda por cédula personal (todos los afiliados activos) ─────────────
        sql = `${BASE_SELECT} ${BASE_WHERE}
               AND p.cedula = ?
               AND UPPER(p.cedula_tipo) = ?
               LIMIT 5`
        args = [q, upperTipo]
      } else {
        // Fallback backward compatibility for 'cedula' or 'rif'
        if (tipo === 'rif') {
          sql = `${BASE_SELECT} ${BASE_WHERE}
                 AND a.tipo_afiliado = 'Corporativo'
                 AND e.rif_numero = ?
                 LIMIT 5`
          args = [q]
        } else {
          sql = `${BASE_SELECT} ${BASE_WHERE}
                 AND p.cedula = ?
                 LIMIT 5`
          args = [q]
        }
      }
    } else {
      // ── Sin q → lista completa para compatibilidad ──────────────────────
      sql = `${BASE_SELECT} ${BASE_WHERE}
             ORDER BY CASE WHEN a.estatus = 'Afiliado' THEN 0 ELSE 1 END ASC,
                      CAST(a.codigo AS INTEGER) ASC`
      args = []
    }

    const result = await db.execute({ sql, args })

    console.log(`[DEBUG] buscarAfiliadosPublic: q="${q}" tipo="${tipo}" → ${result.rows.length} resultado(s)`)

    const mappedData = result.rows.map((row) => ({
      ...row,
      foto_url: (row.foto_url as string) || avatarFallback(row.nombre_completo as string),
      redes_sociales: {
        instagram: row.instagram || '',
        linkedin:  row.linkedin  || '',
        facebook:  row.facebook  || '',
        twitter:   row.twitter   || '',
        website:   row.website   || ''
      }
    }))

    return res.status(200).json({ success: true, data: mappedData })
  } catch (error) {
    console.error('Error en buscarAfiliadosPublic:', error)
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor al realizar la búsqueda pública'
    })
  }
}


export const getAfiliadoPublicById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await db.execute({
      sql: `
        SELECT a.*, (strftime('%Y', 'now') - a.ano_inicio_servicio) as anos_servicio,
               CASE 
                 WHEN a.tipo_afiliado = 'Corporativo' THEN COALESCE(e.razon_social, COALESCE(p.nombres, '') || ' ' || COALESCE(p.apellidos, ''))
                 ELSE COALESCE(p.nombres, '') || ' ' || COALESCE(p.apellidos, '') 
               END as nombre_completo, 
               p.nombres, p.apellidos, (p.cedula_tipo || '-' || p.cedula) as cedula, p.email, p.telefono, p.direccion, 
               p.fecha_nacimiento, p.nivel_academico, p.profesion, p.foto_url,
               e.razon_social as empresa_razon_social, 
               e.rif_tipo as empresa_rif_tipo,
               e.rif_numero as empresa_rif_numero,
               e.logo_url as empresa_logo_url,
               e.website as empresa_website,
               e.email as empresa_email,
               e.telefono as empresa_telefono,
               COALESCE(e_redes.instagram, CASE WHEN json_valid(a.redes_sociales) = 1 THEN json_extract(a.redes_sociales, '$.instagram') ELSE NULL END) as instagram,
               COALESCE(e_redes.facebook, CASE WHEN json_valid(a.redes_sociales) = 1 THEN json_extract(a.redes_sociales, '$.facebook') ELSE NULL END) as facebook,
               COALESCE(e_redes.linkedin, CASE WHEN json_valid(a.redes_sociales) = 1 THEN json_extract(a.redes_sociales, '$.linkedin') ELSE NULL END) as linkedin,
               COALESCE(e_redes.twitter, CASE WHEN json_valid(a.redes_sociales) = 1 THEN json_extract(a.redes_sociales, '$.twitter') ELSE NULL END) as twitter,
               e.banner_url as empresa_banner_url
        FROM afiliados a
        JOIN personas p ON a.id_persona = p.id
        LEFT JOIN empresas e ON a.id_empresa = e.id_empresa
        LEFT JOIN (
          SELECT id_empresa, 
                 CASE WHEN json_valid(redes_sociales) = 1 THEN json_extract(redes_sociales, '$.instagram') ELSE NULL END as instagram,
                 CASE WHEN json_valid(redes_sociales) = 1 THEN json_extract(redes_sociales, '$.facebook') ELSE NULL END as facebook,
                 CASE WHEN json_valid(redes_sociales) = 1 THEN json_extract(redes_sociales, '$.linkedin') ELSE NULL END as linkedin,
                 CASE WHEN json_valid(redes_sociales) = 1 THEN json_extract(redes_sociales, '$.twitter') ELSE NULL END as twitter
          FROM empresas
        ) e_redes ON a.id_empresa = e_redes.id_empresa
        WHERE a.id_afiliado = ? AND a.estatus = 'Afiliado' AND a.activo = 1
      `,
      args: [Number(id)]
    });

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Miembro no encontrado o no activo' });
    }

    const row = result.rows[0];

    const mappedData: any = {
      ...row,
      foto_url: (row.foto_url as string) || avatarFallback(row.nombre_completo as string),
      redes_sociales: {
        instagram: row.instagram || '',
        linkedin: row.linkedin || '',
        facebook: row.facebook || '',
        twitter: row.twitter || '',
        website: row.website || ''
      }
    };

    if (row.tipo_afiliado === 'Corporativo') {
      const assocResult = await db.execute({
        sql: `
          SELECT a.id_afiliado, COALESCE(p.nombres, '') || ' ' || COALESCE(p.apellidos, '') as nombre_completo, a.codigo, (p.cedula_tipo || '-' || p.cedula) as cedula, a.tipo_afiliado, p.foto_url
          FROM afiliados a
          JOIN personas p ON a.id_persona = p.id
          WHERE a.id_empresa = ? AND a.estatus = 'Afiliado' AND a.activo = 1
        `,
        args: [row.id_empresa]
      });
      mappedData.afiliados_asociados = assocResult.rows.map((r: any) => ({
        ...r,
        foto_url: (r.foto_url as string) || avatarFallback(r.nombre_completo)
      }));
    }

    return res.status(200).json({
      success: true,
      data: mappedData
    });
  } catch (error) {
    console.error('Error en getAfiliadoPublicById:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener el perfil público' });
  }
};

// ==========================================
// NUEVO ENDPOINT PARA LA UI DE CIBIR (Tabs)
// ==========================================

export const getSolicitudesCibir = async (req: Request, res: Response) => {
  try {
    const tab = (req.query.tab as string) || 'todos'; // todos | pendiente | aprobado | rechazado

    // Nuevo flujo de 6 pasos: 1_PREINSCRIPCION … 6_INSCRIPCION → Afiliado / Moroso / Suspendido / Rechazado
    const countSql = `
      SELECT 
        SUM(CASE WHEN NOT (tipo_afiliado = 'Agente Corporativo' AND estatus = '1_PREINSCRIPCION') THEN 1 ELSE 0 END) as todos,
        SUM(CASE WHEN estatus IN ('1_PREINSCRIPCION','2_EXPEDIENTE','3_ENTREVISTA','4_VERIFICACION','5_CIBIR','6_INSCRIPCION') AND NOT (tipo_afiliado = 'Agente Corporativo' AND estatus = '1_PREINSCRIPCION') THEN 1 ELSE 0 END) as pendiente,
        SUM(CASE WHEN estatus = 'Afiliado' THEN 1 ELSE 0 END) as aprobado,
        SUM(CASE WHEN estatus IN ('Suspendido', 'Rechazado', 'Moroso') THEN 1 ELSE 0 END) as rechazado
      FROM afiliados
    `;
    const countResult = await db.execute({ sql: countSql, args: [] });
    const counts = countResult.rows[0];

    let sql = `
      SELECT a.*, 
             p.nombres, p.apellidos, 
             COALESCE(p.nombres, '') || ' ' || COALESCE(p.apellidos, '') as nombre_completo, 
             p.cedula, p.email, p.telefono, (strftime('%Y', 'now') - a.ano_inicio_servicio) as anos_servicio,
             e.razon_social as empresa_razon_social
      FROM afiliados a 
      JOIN personas p ON a.id_persona = p.id
      LEFT JOIN empresas e ON a.id_empresa = e.id_empresa
    `;
    const args: any[] = [];
    const whereConditions: Record<string, string> = {
      todos: `NOT (a.tipo_afiliado = 'Agente Corporativo' AND a.estatus = '1_PREINSCRIPCION')`,
      pendiente: `a.estatus IN ('1_PREINSCRIPCION','2_EXPEDIENTE','3_ENTREVISTA','4_VERIFICACION','5_CIBIR','6_INSCRIPCION') AND NOT (a.tipo_afiliado = 'Agente Corporativo' AND a.estatus = '1_PREINSCRIPCION')`,
      aprobado: `a.estatus = 'Afiliado'`,
      rechazado: `a.estatus IN ('Suspendido','Rechazado','Moroso')`,
    };
    if (tab in whereConditions) {
      sql += ` WHERE ${whereConditions[tab]}`;
    } else {
      sql += ` WHERE NOT (a.tipo_afiliado = 'Agente Corporativo' AND a.estatus = '1_PREINSCRIPCION')`;
    }

    sql += ' ORDER BY a.fecha_registro DESC';

    const listResult = await db.execute({ sql, args });

    return res.status(200).json({
      success: true,
      meta: {
        counts: {
          todos: counts.todos || 0,
          pendiente: counts.pendiente || 0,
          aprobado: counts.aprobado || 0,
          rechazado: counts.rechazado || 0,
        }
      },
      data: listResult.rows
    });
  } catch (error) {
    console.error('Error al obtener solicitudes CIBIR:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor al obtener las solicitudes CIBIR'
    });
  }
};

// ==========================================
// FORMALIZACIÓN (PAGO) DE INSCRIPCIÓN CIBIR
// ==========================================

export const formalizarInscripcion = async (req: Request, res: Response) => {
  try {
    const requesterId = req.user!.id_afiliado;
    const { banco, referencia, monto } = req.body;

    if (!requesterId) {
      return res.status(403).json({ success: false, message: 'Usuario no autenticado o sin perfil de afiliado' });
    }

    if (!banco || !referencia || !monto) {
      return res.status(400).json({ success: false, message: 'Todos los campos financieros son requeridos' });
    }

    // Actualizar afiliados para marcar inscripcion_pagada = 1
    await db.execute({
      sql: `UPDATE afiliados SET inscripcion_pagada = 1 WHERE id_afiliado = ?`,
      args: [requesterId]
    });

    const userDisplayName = req.user!.nombre_completo || req.user!.email || 'Afiliado';
    NotificationService.notifyAdmins({
      title: `Pago de Inscripción Registrado`,
      message: `El afiliado ${userDisplayName} ha registrado un pago de ${monto} en ${banco} (Ref: ${referencia}).`,
      type: 'PAGO_REGISTRADO',
      priority: 'ALTA',
      data: {
        id_afiliado: requesterId,
        nombre: userDisplayName,
        email: req.user!.email,
        banco,
        referencia,
        monto
      }
    }).catch(e => console.error('Error enviando notificación In-App a admins (pago):', e));

    return res.status(200).json({
      success: true,
      message: 'Inscripción formalizada exitosamente. El portal ha sido desbloqueado.'
    });
  } catch (error) {
    console.error('Error al formalizar la inscripción:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor al intentar formalizar el pago'
    });
  }
};

export const updateEstatusAfiliado = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { estatus, cibir_convalidado } = req.body;

    // Estados válidos del nuevo flujo de 6 pasos
    const allowedStatuses = [
      '1_PREINSCRIPCION', '2_EXPEDIENTE', '3_ENTREVISTA',
      '4_VERIFICACION', '5_CIBIR', '6_INSCRIPCION',
      'Afiliado', 'Moroso', 'Suspendido', 'Rechazado'
    ];

    if (estatus && !allowedStatuses.includes(estatus)) {
      return res.status(400).json({ success: false, message: 'Estado no válido' });
    }

    const setParts: string[] = [];
    const args: any[] = [];

    if (estatus) {
      setParts.push('estatus = ?');
      args.push(estatus);
      setParts.push('fecha_ultimo_cambio_estatus = ?');
      args.push(new Date().toISOString());
    }

    if (cibir_convalidado !== undefined) {
      setParts.push('cibir_convalidado = ?');
      args.push(cibir_convalidado ? 1 : 0);
    }

    if (setParts.length === 0) {
      return res.status(400).json({ success: false, message: 'Nada que actualizar' });
    }

    args.push(Number(id));

    // Si el estatus cambia a 'Afiliado', nos aseguramos de que tenga un código de afiliado y fecha de afiliación
    if (estatus === 'Afiliado') {
      setParts.push('fecha_afiliacion = COALESCE(fecha_afiliacion, ?)');
      args.splice(args.length - 1, 0, new Date().toISOString());

      const currentRes = await db.execute({
        sql: 'SELECT codigo FROM afiliados WHERE id_afiliado = ?',
        args: [Number(id)]
      });
      const current = currentRes.rows[0];
      if (!current || !current.codigo) {
        // Generar nuevo código correlativo usando el helper
        const nextCode = await obtenerSiguienteCodigoAfiliado();
        setParts.push('codigo = ?');
        args.splice(args.length - 1, 0, nextCode); // Insertar antes del ID
      }
    }

    const result = await db.execute({
      sql: `UPDATE afiliados SET ${setParts.join(', ')} WHERE id_afiliado = ? RETURNING *`,
      args
    });

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Afiliado no encontrado' });
    }

    const afi = result.rows[0] as any;
    if (Number(afi.cibir_convalidado) === 1) {
      await ensureCibirCertificate(Number(id));
    }

    return res.json({ success: true, data: afi });
  } catch (error) {
    console.error('Error en updateEstatusAfiliado:', error);
    return res.status(500).json({ success: false, message: 'Error al actualizar estado' });
  }
};

export const updateAfiliado = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const fields = req.body;
    const requesterId = req.user!.id_afiliado;
    const requesterRoles = req.user!.roles ?? [req.user!.rol];
    const isAdmin = requesterRoles.some(r => ['admin', 'super_admin'].includes(r));

    // 1. Autorización: Solo el dueño o un admin
    if (!isAdmin && requesterId !== Number(id)) {
      return res.status(403).json({ success: false, message: 'No tienes permiso para actualizar este perfil.' });
    }

    // Campos permitidos por entidad
    const personaFields = ['nombres', 'apellidos', 'cedula', 'email', 'telefono', 'fecha_nacimiento', 'nivel_academico', 'direccion', 'profesion', 'foto_url'];
    const adminOnlyFields = ['estatus', 'cibir_convalidado', 'inscripcion_pagada', 'codigo', 'id_empresa', 'activo', 'foto_url'];
    const afiliadoFields = [
      'estatus', 'cibir_convalidado', 'inscripcion_pagada', 'tipo_afiliado',
      'codigo', 'id_empresa', 'notas', 'activo', 'redes_sociales', 'ano_inicio_servicio', 'descripcion'
    ];
    const estudianteFields = ['es_corredor_inmobiliario'];
    const empresaFieldsMap: Record<string, string> = {
      empresa_razon_social: 'razon_social',
      empresa_rif_tipo: 'rif_tipo',
      empresa_rif_numero: 'rif_numero',
      empresa_email: 'email',
      empresa_telefono: 'telefono',
      empresa_website: 'website',
      empresa_logo_url: 'logo_url'
    };

    // Si no es admin, limpiar campos restringidos
    if (!isAdmin) {
      adminOnlyFields.forEach(f => delete fields[f]);
    }

    // 1. Obtener el registro actual para saber qué id_persona e id_empresa tiene
    const current = await db.execute({
      sql: `SELECT id_persona, id_empresa FROM afiliados WHERE id_afiliado = ?`,
      args: [id as string]
    });

    if (current.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Afiliado no encontrado' });
    }
    const { id_persona: idPersona, id_empresa: idEmpresa } = current.rows[0] as any;

    if (fields.cedula) {
      const cedulaInput = String(fields.cedula).trim();
      const cedulaMatch = cedulaInput.match(/^([VEP])?-?(.+)$/i);
      const newCedulaTipo = cedulaMatch && cedulaMatch[1] ? cedulaMatch[1].toUpperCase() : 'V';
      const newCedulaNumero = cedulaMatch ? cedulaMatch[2].replace(/\D/g, '') : cedulaInput.replace(/\D/g, '');

      fields.cedula_tipo = newCedulaTipo;
      fields.cedula = newCedulaNumero;

      const cedulaCheck = await db.execute({
        sql: `SELECT id FROM personas WHERE cedula = ? AND id <> ?`,
        args: [newCedulaNumero, idPersona]
      });
      if (cedulaCheck.rows.length > 0) {
        return res.status(400).json({ success: false, message: 'La cédula ingresada ya está registrada por otro usuario.' });
      }
    }

    // 2. Preparar actualizaciones
    const pUpdates: string[] = [];
    const pArgs: any[] = [];
    const aUpdates: string[] = [];
    const aArgs: any[] = [];
    const eUpdates: string[] = [];
    const eArgs: any[] = [];
    const stUpdates: string[] = [];
    const stArgs: any[] = [];

    const socialFields = ['instagram', 'facebook', 'linkedin', 'twitter', 'tiktok', 'website'];

    Object.keys(fields).forEach(key => {
      if (personaFields.includes(key) || key === 'cedula_tipo') {
        pUpdates.push(`${key} = ?`);
        pArgs.push(fields[key]);
      } else if (afiliadoFields.includes(key)) {
        let val = fields[key];
        if (key === 'redes_sociales' && typeof val === 'object') val = JSON.stringify(val);
        const dbKey = key === 'descripcion' ? 'notas' : key;
        aUpdates.push(`${dbKey} = ?`);
        aArgs.push(val);
      } else if (estudianteFields.includes(key)) {
        stUpdates.push(`${key} = ?`);
        stArgs.push(fields[key] === true || fields[key] === 1 ? 1 : 0);
      } else if (empresaFieldsMap[key]) {
        eUpdates.push(`${empresaFieldsMap[key]} = ?`);
        eArgs.push(fields[key]);
      }
    });

    // Re-procesar redes sociales si se enviaron campos individuales
    const socialsToUpdate: Record<string, any> = {};
    socialFields.forEach(sf => {
      if (fields[sf] !== undefined) socialsToUpdate[sf] = fields[sf];
    });

    if (Object.keys(socialsToUpdate).length > 0) {
      // Leer redes actuales
      const curr = await db.execute({
        sql: `SELECT redes_sociales FROM afiliados WHERE id_afiliado = ?`,
        args: [id as string]
      });
      let currentRedes: Record<string, any> = {};
      try {
        currentRedes = JSON.parse(curr.rows[0].redes_sociales as string || '{}');
      } catch (e) { currentRedes = {}; }

      const newRedes = { ...currentRedes, ...socialsToUpdate };
      if (!aUpdates.some(u => u.startsWith('redes_sociales'))) {
        aUpdates.push('redes_sociales = ?');
        aArgs.push(JSON.stringify(newRedes));
      } else {
        // Si ya estaba redes_sociales en los campos, priorizamos el merge
        const idx = aUpdates.findIndex(u => u.startsWith('redes_sociales'));
        aArgs[idx] = JSON.stringify(newRedes);
      }
    }

    // Re-procesar redes sociales de la EMPRESA if any
    const empresaSocialsToUpdate: Record<string, any> = {};
    socialFields.forEach(sf => {
      const key = `empresa_${sf}`;
      if (fields[key] !== undefined) empresaSocialsToUpdate[sf] = fields[key];
    });

    if (Object.keys(empresaSocialsToUpdate).length > 0 && idEmpresa) {
      // Leer redes actuales de la empresa
      const currE = await db.execute({
        sql: `SELECT redes_sociales FROM empresas WHERE id_empresa = ?`,
        args: [idEmpresa]
      });
      let currentERedes: Record<string, any> = {};
      if (currE.rows.length > 0) {
        try {
          currentERedes = JSON.parse(currE.rows[0].redes_sociales as string || '{}');
        } catch (e) { currentERedes = {}; }
      }

      const newERedes = { ...currentERedes, ...empresaSocialsToUpdate };
      if (!eUpdates.some(u => u.startsWith('redes_sociales'))) {
        eUpdates.push('redes_sociales = ?');
        eArgs.push(JSON.stringify(newERedes));
      } else {
        const idx = eUpdates.findIndex(u => u.startsWith('redes_sociales'));
        eArgs[idx] = JSON.stringify(newERedes);
      }
    }

    const hasDocs = fields.documentos && Array.isArray(fields.documentos);

    if (pUpdates.length === 0 && aUpdates.length === 0 && eUpdates.length === 0 && stUpdates.length === 0 && !hasDocs) {
      return res.status(400).json({ success: false, message: 'Nada que actualizar' });
    }

    // 3. Ejecutar actualizaciones
    const now = new Date().toISOString();

    if (pUpdates.length > 0) {
      pUpdates.push('actualizado_en = ?');
      pArgs.push(now);
      pArgs.push(idPersona);
      await db.execute({
        sql: `UPDATE personas SET ${pUpdates.join(', ')} WHERE id = ?`,
        args: pArgs
      });
    }

    if (aUpdates.length > 0) {
      aUpdates.push('actualizado_en = ?');
      aArgs.push(now);
      aArgs.push(id);
      await db.execute({
        sql: `UPDATE afiliados SET ${aUpdates.join(', ')} WHERE id_afiliado = ?`,
        args: aArgs
      });
    }

    if (eUpdates.length > 0 && idEmpresa) {
      eUpdates.push('actualizado_en = ?');
      eArgs.push(now);
      eArgs.push(idEmpresa);
      await db.execute({
        sql: `UPDATE empresas SET ${eUpdates.join(', ')} WHERE id_empresa = ?`,
        args: eArgs
      });
    }

    if (stUpdates.length > 0) {
      stUpdates.push('actualizado_en = ?');
      stArgs.push(now);
      // Necesitamos el id_estudiante
      const stCheck = await db.execute({
        sql: `SELECT id_estudiante FROM estudiantes WHERE id_persona = ?`,
        args: [idPersona]
      });
      if (stCheck.rows.length > 0) {
        const idEstudiante = stCheck.rows[0].id_estudiante;
        stArgs.push(idEstudiante);
        await db.execute({
          sql: `UPDATE estudiantes SET ${stUpdates.join(', ')} WHERE id_estudiante = ?`,
          args: stArgs
        });
      }
    }

    if (hasDocs) {
      const stCheck = await db.execute({
        sql: `SELECT id_estudiante FROM estudiantes 
              WHERE id_persona = ? OR (id_empresa = ? AND id_empresa IS NOT NULL)`,
        args: [idPersona, idEmpresa || -1]
      });
      const idEstudiante = stCheck.rows[0]?.id_estudiante || null;

      for (const doc of fields.documentos) {
        const { tipo_doc, url, nombre_archivo } = doc;
        if (!tipo_doc) continue;

        // Determine which entity to link the document to:
        let entidadTipo = 'afiliado';
        let entidadId = Number(id);

        if (['registro_mercantil', 'rif_empresa', 'cedula_representante'].includes(tipo_doc) && idEmpresa) {
          entidadTipo = 'empresa';
          entidadId = Number(idEmpresa);
        } else if (['titulo', 'cv', 'curso_extra', 'diplomado', 'especializacion'].includes(tipo_doc)) {
          if (idEstudiante) {
            entidadTipo = 'estudiante';
            entidadId = Number(idEstudiante);
          } else {
            entidadTipo = 'afiliado';
            entidadId = Number(id);
          }
        }

        // Delete previous document of the same type across all associated entities to prevent duplicates
        await db.execute({
          sql: `DELETE FROM documentos_adjuntos 
                WHERE ((entidad_tipo = 'afiliado' AND entidad_id = ?)
                   OR (entidad_tipo = 'empresa' AND entidad_id = ?)
                   OR (entidad_tipo = 'estudiante' AND entidad_id = ?))
                  AND tipo_doc = ?`,
          args: [Number(id), idEmpresa || -1, idEstudiante || -1, tipo_doc]
        });

        // Insert new one if URL is provided
        if (url) {
          await db.execute({
            sql: `INSERT INTO documentos_adjuntos (entidad_tipo, entidad_id, tipo_doc, url, nombre_archivo)
                  VALUES (?, ?, ?, ?, ?)`,
            args: [entidadTipo, entidadId, tipo_doc, url, nombre_archivo || null]
          });
        }
      }
    }

    return res.json({ success: true, message: 'Afiliado actualizado correctamente' });
  } catch (error) {
    console.error('Error en updateAfiliado:', error);
    return res.status(500).json({ success: false, message: 'Error al actualizar afiliado' });
  }
};

// ═══════════════════════════════════════════════════════════════════
// SISTEMA DE INVITACIONES CORPORATIVAS
// ═══════════════════════════════════════════════════════════════════

/**
 * POST /api/afiliados/:id/invitacion
 * Genera un link reutilizable de invitación para un afiliado corporativo.
 * Puede ser llamado por admin o por el propio afiliado corporativo.
 */
export const generarInvitacionCorporativa = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id) // This is id_empresa now
    const requesterId = req.user?.id_empresa
    const requesterRole = req.user?.rol

    if (requesterRole !== 'admin' && requesterRole !== 'super_admin' && requesterId !== id) {
      res.status(403).json({ success: false, message: 'No tienes permiso para generar invitaciones para esta empresa.' }); return
    }

    if (!Number.isFinite(id)) {
      res.status(400).json({ success: false, message: 'ID inválido' }); return
    }

    // Verificar que la empresa existe
    const corp = await db.execute({
      sql: `SELECT id_empresa, razon_social, estatus FROM empresas WHERE id_empresa = ? LIMIT 1`,
      args: [id]
    })
    if (corp.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Empresa no encontrada' }); return
    }
    const empresa = corp.rows[0] as any

    const token = randomUUID()
    const nombreEmpresa = empresa.razon_social || empresa.nombre_completo
    const diasExpiracion = req.body?.diasExpiracion ? Number(req.body.diasExpiracion) : null
    const fechaExpiracion = diasExpiracion
      ? new Date(Date.now() + diasExpiracion * 86400000).toISOString()
      : null

    await db.execute({
      sql: `INSERT INTO invitaciones_empresa (id_empresa, token, nombre_empresa, activo, fecha_expiracion)
            VALUES (?, ?, ?, 1, ?)`,
      args: [id, token, nombreEmpresa, fechaExpiracion]
    })

    res.status(201).json({
      success: true,
      message: 'Link de invitación generado correctamente.',
      data: { token, nombreEmpresa, fechaExpiracion }
    })
  } catch (error) {
    console.error('generarInvitacionCorporativa:', error)
    res.status(500).json({ success: false, message: 'Error al generar invitación' })
  }
}

/**
 * GET /api/afiliados/:id/invitaciones
 * Lista todos los links de invitación de un afiliado corporativo.
 */
export const listarInvitacionesCorporativas = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id)
    const requesterId = req.user?.id_empresa
    const requesterRole = req.user?.rol

    if (requesterRole !== 'admin' && requesterRole !== 'super_admin' && requesterId !== id) {
      res.status(403).json({ success: false, message: 'Acceso denegado.' }); return
    }

    const result = await db.execute({
      sql: `SELECT ic.*, 
              (SELECT COUNT(*) FROM afiliados WHERE id_empresa = ic.id_empresa) as total_afiliados
            FROM invitaciones_empresa ic
            WHERE ic.id_empresa = ?
            ORDER BY ic.creado_en DESC`,
      args: [id]
    })
    res.json({ success: true, data: result.rows })
  } catch (error) {
    console.error('listarInvitacionesCorporativas:', error)
    res.status(500).json({ success: false, message: 'Error al listar invitaciones' })
  }
}

/**
 * DELETE /api/afiliados/:id/invitaciones/:tokenId
 * Desactiva (revoca) un link de invitación.
 */
export const revocarInvitacionCorporativa = async (req: Request, res: Response): Promise<void> => {
  try {
    const tokenId = Number(req.params.tokenId)
    await db.execute({
      sql: `UPDATE invitaciones_empresa SET activo = 0 WHERE id_invitacion = ?`,
      args: [tokenId]
    })
    res.json({ success: true, message: 'Invitación revocada.' })
  } catch (error) {
    console.error('revocarInvitacionCorporativa:', error)
    res.status(500).json({ success: false, message: 'Error al revocar invitación' })
  }
}

/**
 * GET /api/afiliados/:id/afiliados-corp
 * Lista los afiliados individuales vinculados a un afiliado corporativo.
 */
export const listarAfiliadosCorporativos = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id) // id_empresa
    const requesterId = req.user?.id_empresa
    const requesterRole = req.user?.rol

    if (requesterRole !== 'admin' && requesterRole !== 'super_admin' && requesterId !== id) {
      res.status(403).json({ success: false, message: 'Acceso denegado.' }); return
    }

    const result = await db.execute({
      sql: `SELECT 
              a.id_afiliado, 
              COALESCE(p.nombres, '') || ' ' || COALESCE(p.apellidos, '') as nombre_completo, 
              p.cedula, 
              p.email, 
              p.telefono, 
              a.estatus, 
              a.fecha_registro,
              CASE 
                WHEN a.tipo_afiliado = 'Agente Corporativo' AND a.estatus = '1_PREINSCRIPCION' THEN 'Solicitud'
                WHEN a.estatus = 'Afiliado' THEN 'Aprobado'
                WHEN a.estatus = 'Rechazado' THEN 'Rechazado'
                ELSE 'En Proceso'
              END as fase
            FROM afiliados a
            JOIN personas p ON a.id_persona = p.id
            WHERE a.id_empresa = ? AND a.eliminado_en IS NULL AND a.activo = 1
              AND a.tipo_afiliado = 'Agente Corporativo'
            
            UNION ALL
            
            SELECT 
              NULL as id_afiliado,
              COALESCE(p.nombres, '') || ' ' || COALESCE(p.apellidos, '') as nombre_completo,
              p.cedula,
              p.email,
              p.telefono,
              ic.estatus,
              ic.creado_en as fecha_registro,
              'Solicitud' as fase
            FROM inscripciones_cursos ic
            JOIN estudiantes e ON e.id_estudiante = ic.id_estudiante
            LEFT JOIN personas p ON e.id_persona = p.id
            WHERE ic.id_empresa = ? AND ic.programa_codigo = 'AFILIACION'
              AND NOT EXISTS (SELECT 1 FROM afiliados a2 JOIN personas p2 ON a2.id_persona = p2.id WHERE LOWER(TRIM(p2.email)) = LOWER(TRIM(p.email)))

            UNION ALL
            
            SELECT 
              NULL as id_afiliado,
              COALESCE(vp.nombres, '') || ' ' || COALESCE(vp.apellidos, '') as nombre_completo,
              vp.cedula,
              vp.email,
              vp.telefono,
              'Pendiente' as estatus,
              vp.creado_en as fecha_registro,
              'Solicitud' as fase
            FROM verificaciones_preinscripciones vp
            WHERE vp.id_empresa = ? AND vp.programa_interes = 'AFILIACION'
              AND NOT EXISTS (SELECT 1 FROM inscripciones_cursos ic2 JOIN estudiantes e2 ON ic2.id_estudiante = e2.id_estudiante LEFT JOIN personas p3 ON e2.id_persona = p3.id WHERE LOWER(TRIM(p3.email)) = LOWER(TRIM(vp.email)))
              AND NOT EXISTS (SELECT 1 FROM afiliados a3 JOIN personas p4 ON a3.id_persona = p4.id WHERE LOWER(TRIM(p4.email)) = LOWER(TRIM(vp.email)))
            
            ORDER BY fecha_registro DESC`,
      args: [id, id, id]
    })
    res.json({ success: true, data: result.rows })
  } catch (error) {
    console.error('listarAfiliadosCorporativos:', error)
    res.status(500).json({ success: false, message: 'Error al listar afiliados' })
  }
}

/**
 * POST /api/afiliados/:id/registrar-miembro
 * Registro directo de un miembro por parte de su empresa.
 */
export const registrarMiembroDirecto = async (req: Request, res: Response): Promise<void> => {
  try {
    const idEmpresa = Number(req.params.id)
    const requesterId = req.user?.id_empresa
    const requesterRole = req.user?.rol

    if (requesterRole !== 'admin' && requesterRole !== 'super_admin' && requesterId !== idEmpresa) {
      res.status(403).json({ success: false, message: 'Acceso denegado.' }); return
    }

    const { nombreCompleto, cedulaRif, email, telefono, nivelProfesional, esCorredorInmobiliario } = req.body

    if (!nombreCompleto || !cedulaRif || !email) {
      res.status(400).json({ success: false, message: 'Nombre, Cédula y Email son requeridos.' }); return
    }

    // Obtener info de la empresa
    const corp = await db.execute({
      sql: `SELECT razon_social FROM empresas WHERE id_empresa = ? LIMIT 1`,
      args: [idEmpresa]
    })
    if (corp.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Empresa no encontrada.' }); return
    }
    const empresa = corp.rows[0] as any

    // Verificar si ya existe en personas
    const existing = await db.execute({
      sql: `SELECT id FROM personas WHERE email = ? OR cedula = ? LIMIT 1`,
      args: [email, cedulaRif]
    })
    if (existing.rows.length > 0) {
      res.status(400).json({ success: false, message: 'Ya existe un registro con ese email o cédula.' }); return
    }

    // 3. Crear Verificación de Preinscripción ( Academy Flow )
    const { token: tokenVerif } = await crearVerificacionPreinscripcionPrograma({
      nombreCompleto,
      cedulaRif,
      email,
      telefono: telefono || null,
      programaCodigo: 'AFILIACION',
      tipoAfiliado: 'Agente Corporativo',
      nivelProfesional: nivelProfesional || null,
      esCorredorInmobiliario: !!esCorredorInmobiliario,
      id_empresa: idEmpresa
    });

    // 4. Enviar Email con link a Academia
    const nombreEmpresa = empresa.razon_social
    await enviarCorreoInvitacionCorporativa({
      nombre: nombreCompleto,
      emailOriginal: email,
      nombreEmpresa,
      token: tokenVerif
    })

    res.status(201).json({ success: true, message: 'Miembro registrado correctamente. Se ha enviado un correo de invitación.' })
  } catch (error) {
    console.error('registrarMiembroDirecto:', error)
    res.status(500).json({ success: false, message: 'Error interno al registrar miembro.' })
  }
}

/**
 * GET /api/public/invitaciones/:token
 * Valida un token de invitación y devuelve info de la empresa.
 */
export const publicValidarInvitacion = async (req: Request, res: Response): Promise<void> => {
  try {
    const token = String(req.params.token ?? '').trim()
    const result = await db.execute({
      sql: `SELECT ic.*, e.estatus as estatus_empresa
            FROM invitaciones_empresa ic
            JOIN empresas e ON e.id_empresa = ic.id_empresa
            WHERE ic.token = ? AND ic.activo = 1 LIMIT 1`,
      args: [token]
    })
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Link de invitación inválido o desactivado.' }); return
    }
    const inv = result.rows[0] as any
    if (inv.fecha_expiracion && new Date(inv.fecha_expiracion) < new Date()) {
      res.status(400).json({ success: false, message: 'Este link de invitación ha expirado.' }); return
    }
    res.json({
      success: true,
      data: {
        nombreEmpresa: inv.nombre_empresa,
        idEmpresa: inv.id_empresa,
        token: inv.token
      }
    })
  } catch (error) {
    console.error('publicValidarInvitacion:', error)
    res.status(500).json({ success: false, message: 'Error al validar invitación' })
  }
}

/**
 * POST /api/public/invitaciones/:token/registrar
 * Registra un afiliado individual a través de un link corporativo.
 */
export const publicRegistrarPorInvitacion = async (req: Request, res: Response): Promise<void> => {
  try {
    const token = String(req.params.token ?? '').trim()

    // Validar token
    const invRes = await db.execute({
      sql: `SELECT * FROM invitaciones_empresa WHERE token = ? AND activo = 1 LIMIT 1`,
      args: [token]
    })
    if (invRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Link de invitación inválido o desactivado.' }); return
    }
    const inv = invRes.rows[0] as any
    if (inv.fecha_expiracion && new Date(inv.fecha_expiracion) < new Date()) {
      res.status(400).json({ success: false, message: 'Este link de invitación ha expirado.' }); return
    }

    const nombreCompleto = typeof req.body?.nombreCompleto === 'string' ? req.body.nombreCompleto.trim() : ''
    const cedulaRif = typeof req.body?.cedulaRif === 'string' ? req.body.cedulaRif.trim() : null
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : ''
    const telefono = typeof req.body?.telefono === 'string' ? req.body.telefono.trim() : null
    const nivelProfesional = typeof req.body?.nivelProfesional === 'string' ? req.body.nivelProfesional.trim() : null
    const esCorredorInmobiliario = req.body?.esCorredorInmobiliario === true || req.body?.esCorredorInmobiliario === 'si' ? 1 : 0

    const NIVELES_VALIDOS = new Set(['Bachiller', 'TSU', 'Nivel Profesional', 'Postgrado'])
    if (!nombreCompleto || !email || !cedulaRif) {
      res.status(400).json({ success: false, message: 'Nombre completo, cédula y email son obligatorios.' }); return
    }
    if (nivelProfesional && !NIVELES_VALIDOS.has(nivelProfesional)) {
      res.status(400).json({ success: false, message: 'Nivel profesional inválido.' }); return
    }

    // Verificar duplicados en personas
    const dup = await db.execute({
      sql: `SELECT id FROM personas WHERE email = ? OR cedula = ? LIMIT 1`,
      args: [email, cedulaRif]
    })
    if (dup.rows.length > 0) {
      res.status(409).json({ success: false, message: 'Ya existe un registro con ese email o cédula.' }); return
    }

    // 3. Crear Verificación de Preinscripción ( Academy Flow )
    const { token: tokenVerif } = await crearVerificacionPreinscripcionPrograma({
      nombreCompleto,
      cedulaRif,
      email,
      telefono: telefono || null,
      programaCodigo: 'AFILIACION',
      tipoAfiliado: 'Agente Corporativo',
      nivelProfesional: nivelProfesional || null,
      esCorredorInmobiliario: !!esCorredorInmobiliario,
      id_empresa: inv.id_empresa
    });

    // 4. Enviar Email con link a Academia
    await enviarCorreoInvitacionCorporativa({
      nombre: nombreCompleto,
      emailOriginal: email,
      nombreEmpresa: inv.nombre_empresa,
      token: tokenVerif
    })

    res.status(201).json({
      success: true,
      message: `Tu solicitud de afiliación a ${inv.nombre_empresa} fue recibida. Revisa tu correo para completar tu perfil y cargar documentos.`,
      data: { email, token: tokenVerif }
    })
  } catch (error) {
    console.error('publicRegistrarPorInvitacion:', error)
    res.status(500).json({ success: false, message: 'Error al procesar el registro' })
  }
}
/**
 * DELETE /api/afiliados/:id
 * Elimina un registro de afiliado de forma permanente, incluyendo sus datos relacionados
 * en personas, usuarios, empresas (si es el dueño) y documentos.
 */
export const deleteAfiliado = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // 1. Obtener toda la información relacionada antes de borrar nada
    const check = await db.execute({
      sql: `SELECT a.id_afiliado, a.id_persona, a.id_user, a.id_empresa, a.tipo_afiliado,
                   p.email, p.cedula, e.rif_numero as empresa_rif
            FROM afiliados a
            JOIN personas p ON a.id_persona = p.id
            LEFT JOIN empresas e ON a.id_empresa = e.id_empresa
            WHERE a.id_afiliado = ?`,
      args: [id as string]
    });

    if (check.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Afiliado no encontrado' });
      return;
    }

    const { id_persona, id_user, id_empresa, tipo_afiliado, email, cedula, empresa_rif } = check.rows[0] as any;

    // 2. Preparar lote de borrado
    const batch: any[] = [];

    // A. Borrar documentos adjuntos (No tienen FK formal con CASCADE en todos los casos)
    batch.push({
      sql: "DELETE FROM documentos_adjuntos WHERE entidad_tipo = 'afiliado' AND entidad_id = ?",
      args: [id]
    });

    if (id_empresa && tipo_afiliado === 'Corporativo') {
      batch.push({
        sql: "DELETE FROM documentos_adjuntos WHERE entidad_tipo = 'empresa' AND entidad_id = ?",
        args: [id_empresa]
      });
      batch.push({
        sql: "DELETE FROM documentos_empresa WHERE id_empresa = ?",
        args: [id_empresa]
      });
    }

    // B. Borrar historial académico y estudiante
    if (id_persona) {
      const estCheck = await db.execute({
        sql: 'SELECT id_estudiante FROM estudiantes WHERE id_persona = ? OR (id_empresa = ? AND id_empresa IS NOT NULL)',
        args: [id_persona, id_empresa || -1]
      });
      if (estCheck.rows.length > 0) {
        const idEst = estCheck.rows[0].id_estudiante;
        batch.push({
          sql: "DELETE FROM documentos_adjuntos WHERE entidad_tipo = 'estudiante' AND entidad_id = ?",
          args: [idEst]
        });
        // inscripciones_cursos y certificados tienen ON DELETE CASCADE con estudiante/inscripcion
        batch.push({
          sql: 'DELETE FROM estudiantes WHERE id_estudiante = ?',
          args: [idEst]
        });
      }
    }

    // C. Borrar transacciones y usuario
    if (id_user) {
      batch.push({
        sql: 'DELETE FROM transacciones WHERE id_user = ?',
        args: [id_user]
      });
      // notificaciones y refresh_tokens tienen ON DELETE CASCADE
      batch.push({
        sql: 'DELETE FROM users WHERE id = ?',
        args: [id_user]
      });
    }

    // D. Borrar la empresa si es el afiliado corporativo principal
    if (id_empresa && tipo_afiliado === 'Corporativo') {
      batch.push({
        sql: 'DELETE FROM empresas WHERE id_empresa = ?',
        args: [id_empresa]
      });
    }

    // E. Borrar el afiliado y la persona
    // (Borrar la persona disparará el CASCADE en la tabla afiliados)
    batch.push({
      sql: 'DELETE FROM personas WHERE id = ?',
      args: [id_persona]
    });

    // F. Limpiar posibles preinscripciones o verificaciones pendientes con esos datos
    batch.push({
      sql: 'DELETE FROM verificaciones_preinscripciones WHERE email = ? OR cedula = ? OR rif_numero = ?',
      args: [email, cedula, empresa_rif || cedula]
    });
    batch.push({
      sql: 'DELETE FROM verificaciones_email WHERE email = ? OR cedula_rif = ?',
      args: [email, cedula]
    });

    // 3. Ejecutar todo en una transacción atómica
    await db.batch(batch, 'write');

    res.json({ 
      success: true, 
      message: 'Afiliado y todos sus registros asociados han sido eliminados. Ahora puede volver a registrarlo con los mismos datos si lo desea.' 
    });

  } catch (error) {
    console.error('Error en deleteAfiliado (Hard Delete):', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error interno al intentar realizar el borrado completo del afiliado.' 
    });
  }
};

/**
 * POST /api/afiliados
 * Creación directa de un afiliado por parte del administrador.
 */
export const createAfiliado = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      nombres, apellidos, empresa_razon_social, empresa_rif_tipo,
      cedula, email, tipo_afiliado, estatus,
      telefono, direccion, codigo, nivel_academico,
      id_empresa, instagram, facebook, linkedin, twitter, tiktok, website,
      empresa_direccion, empresa_email, empresa_telefono, empresa_website,
      empresa_instagram, empresa_facebook, empresa_linkedin, empresa_twitter, empresa_tiktok
    } = req.body;

    if (!cedula || !email) {
      res.status(400).json({ success: false, message: 'Cédula/RIF y Email son obligatorios.' });
      return;
    }
    const tipoFinal = tipo_afiliado || 'Natural'

    if (tipoFinal === 'Agente Corporativo' && !id_empresa) {
      res.status(400).json({ success: false, message: 'La empresa es obligatoria para un Agente Corporativo.' });
      return;
    }

    // Verificar duplicados en personas
    const cedulaInput = String(cedula || '').trim();
    const cedulaMatch = cedulaInput.match(/^([VEP])?-?(.+)$/i);
    const cedulaTipo = cedulaMatch && cedulaMatch[1] ? cedulaMatch[1].toUpperCase() : 'V';
    const cedulaNumero = cedulaMatch ? cedulaMatch[2].replace(/\D/g, '') : cedulaInput.replace(/\D/g, '');

    const existing = await db.execute({
      sql: 'SELECT id FROM personas WHERE email = ? OR cedula = ?',
      args: [email, cedulaNumero]
    });

    if (existing.rows.length > 0) {
      res.status(400).json({ success: false, message: 'Ya existe un registro con ese email o Cédula.' });
      return;
    }

    // 1. Insertar Persona
    const resultP = await db.execute({
      sql: `INSERT INTO personas (nombres, apellidos, cedula_tipo, cedula, email, telefono, direccion, nivel_academico)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      args: [nombres || '', apellidos || '', cedulaTipo, cedulaNumero, email, telefono || null, direccion || null, nivel_academico || null]
    });
    const idPersona = resultP.rows[0].id;

    // 2. Manejar Empresa
    let finalIdEmpresa: number | null = id_empresa || null;

    // Si es corporativo y NO se pasó un id_empresa, creamos la empresa
    if (tipoFinal === 'Corporativo' && !finalIdEmpresa) {
      const empresa_redes = JSON.stringify({
        instagram: empresa_instagram,
        facebook: empresa_facebook,
        linkedin: empresa_linkedin,
        twitter: empresa_twitter,
        tiktok: empresa_tiktok,
        website: empresa_website
      });
      const resultE = await db.execute({
        sql: `INSERT INTO empresas (razon_social, rif_tipo, rif_numero, email, telefono, direccion, website, redes_sociales)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id_empresa`,
        args: [
          empresa_razon_social || '', 
          empresa_rif_tipo || 'J', 
          cedulaNumero, 
          empresa_email || email, 
          empresa_telefono || telefono || null, 
          empresa_direccion || direccion || null, 
          empresa_website || website || null, 
          empresa_redes
        ]
      });
      finalIdEmpresa = resultE.rows[0].id_empresa as number;
    }

    // 3. Generar Código si es necesario
    const estatusFinal = estatus || 'Afiliado';
    let finalCodigo = codigo || null;
    if (!finalCodigo && estatusFinal === 'Afiliado') {
      finalCodigo = await obtenerSiguienteCodigoAfiliado();
    }

    // 4. Insertar Afiliado
    const redes_sociales = JSON.stringify({ instagram, facebook, linkedin, twitter, tiktok, website });
    const resultA = await db.execute({
      sql: `INSERT INTO afiliados (
        id_persona, id_empresa, tipo_afiliado, estatus, codigo, redes_sociales, activo
      ) VALUES (?, ?, ?, ?, ?, ?, 1) RETURNING *`,
      args: [idPersona, finalIdEmpresa, tipoFinal, estatusFinal, finalCodigo, redes_sociales]
    });

    res.status(201).json({
      success: true,
      message: 'Afiliado creado correctamente',
      data: resultA.rows[0]
    });
  } catch (error) {
    console.error('Error en createAfiliado:', error);
    res.status(500).json({ success: false, message: 'Error interno al crear afiliado' });
  }
};

/**
 * POST /api/afiliados/:id/convertir-natural
 * Permite que un Agente Corporativo abandone su empresa y se convierta en Afiliado Natural.
 */
export const convertirAgenteANatural = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const requesterId = req.user!.id_afiliado;
    const requesterRoles = req.user!.roles ?? [req.user!.rol];

    // Solo el propio afiliado o un admin puede hacerlo
    if (!requesterRoles.some(r => ['admin', 'super_admin'].includes(r)) && requesterId !== Number(id)) {
      res.status(403).json({ success: false, message: 'Acceso denegado' });
      return;
    }

    // Verificar que sea un Agente Corporativo
    const current = await db.execute({
      sql: 'SELECT tipo_afiliado FROM afiliados WHERE id_afiliado = ?',
      args: [id as string]
    });

    if (current.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Afiliado no encontrado' });
      return;
    }

    if (current.rows[0].tipo_afiliado !== 'Agente Corporativo') {
      res.status(400).json({ success: false, message: 'Solo los Agentes Corporativos pueden realizar esta acción' });
      return;
    }

    // Realizar la conversión
    await db.execute({
      sql: "UPDATE afiliados SET tipo_afiliado = 'Natural', id_empresa = NULL WHERE id_afiliado = ?",
      args: [id as string]
    });

    res.json({ success: true, message: 'Conversión a Afiliado Natural exitosa' });
  } catch (error) {
    console.error('convertirAgenteANatural:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

/**
 * PATCH /api/afiliados/:id/acceso-panel
 * Crea o actualiza la contraseña de acceso al panel para un afiliado (solo admin).
 * Body: { password: string, email?: string }
 */
export const establecerAccesoPanel = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id)
    const { password, email } = req.body as { password?: string; email?: string }

    if (!password || password.length < 8) {
      res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 8 caracteres' })
      return
    }

    const { establecerAccesoPanelAfiliado } = await import('../lib/credentials.js')
    const result = await establecerAccesoPanelAfiliado(id, password, email)

    res.status(200).json({
      success: true,
      message: result.created
        ? 'Cuenta de acceso creada y vinculada al afiliado'
        : 'Contraseña de acceso actualizada',
      data: result,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : ''
    if (msg === 'AFILIADO_NO_ENCONTRADO') {
      res.status(404).json({ success: false, message: 'Afiliado no encontrado' })
      return
    }
    if (msg === 'EMAIL_REQUERIDO') {
      res.status(400).json({
        success: false,
        message: 'El afiliado no tiene email registrado. Indique un correo de acceso.',
      })
      return
    }
    if (msg === 'EMAIL_EN_USO') {
      res.status(409).json({ success: false, message: 'Ese correo ya está registrado para otro usuario' })
      return
    }
    if (msg.includes('UNIQUE constraint failed: users.email')) {
      res.status(409).json({ success: false, message: 'El email ya está registrado para otro usuario' })
      return
    }
    console.error('establecerAccesoPanel:', error)
    res.status(500).json({ success: false, message: 'Error interno del servidor' })
  }
}

/**
 * POST /api/afiliados/:id/afiliados-corp/:idAfiliado/aprobar
 * Permite a la empresa (o admin) aprobar a un Agente Corporativo.
 */
export const aprobarAfiliadoCorporativo = async (req: Request, res: Response): Promise<void> => {
  try {
    const idEmpresa = Number(req.params.id) // id_empresa de la URL
    const idAfiliado = Number(req.params.idAfiliado)
    const requesterId = req.user?.id_empresa
    const requesterRole = req.user?.rol

    // Validar permisos
    if (requesterRole !== 'admin' && requesterRole !== 'super_admin' && requesterId !== idEmpresa) {
      res.status(403).json({ success: false, message: 'Acceso denegado.' }); return
    }

    // Verificar que el afiliado existe, pertenece a la empresa y está en estatus '1_PREINSCRIPCION'
    const queryAf = await db.execute({
      sql: `SELECT id_persona, id_empresa, tipo_afiliado, estatus FROM afiliados WHERE id_afiliado = ? AND eliminado_en IS NULL`,
      args: [idAfiliado]
    })

    if (queryAf.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Afiliado no encontrado.' }); return
    }

    const af = queryAf.rows[0] as any
    if (af.id_empresa !== idEmpresa) {
      res.status(400).json({ success: false, message: 'El afiliado no pertenece a la empresa indicada.' }); return
    }

    if (af.tipo_afiliado !== 'Agente Corporativo') {
      res.status(400).json({ success: false, message: 'El afiliado no es un Agente Corporativo.' }); return
    }

    if (af.estatus !== '1_PREINSCRIPCION') {
      res.status(400).json({ success: false, message: `El afiliado no está pendiente de aprobación (estatus actual: ${af.estatus}).` }); return
    }

    const now = new Date().toISOString()

    // 1. Actualizar estatus del afiliado a '2_EXPEDIENTE'
    await db.execute({
      sql: `UPDATE afiliados 
            SET estatus = '2_EXPEDIENTE', actualizado_en = ?, fecha_ultimo_cambio_estatus = ?
            WHERE id_afiliado = ?`,
      args: [now, now, idAfiliado]
    })

    // 2. Buscar la inscripción al programa 'AFILIACION' de esta persona
    // Primero, obtener su id_estudiante
    const queryEst = await db.execute({
      sql: `SELECT id_estudiante FROM estudiantes WHERE id_persona = ? LIMIT 1`,
      args: [af.id_persona]
    })

    if (queryEst.rows.length > 0) {
      const idEstudiante = queryEst.rows[0].id_estudiante as number
      // Actualizar la inscripción a 'Preinscrito' (para asegurarnos)
      await db.execute({
        sql: `UPDATE inscripciones_cursos 
              SET estatus = 'Preinscrito', actualizado_en = ?
              WHERE id_estudiante = ? AND programa_codigo = 'AFILIACION' AND id_curso IS NULL`,
        args: [now, idEstudiante]
      })
    }

    res.json({ success: true, message: 'Afiliado aprobado con éxito.' })
  } catch (error) {
    console.error('aprobarAfiliadoCorporativo:', error)
    res.status(500).json({ success: false, message: 'Error interno del servidor.' })
  }
}

/**
 * POST /api/afiliados/:id/afiliados-corp/:idAfiliado/rechazar
 * Permite a la empresa (o admin) rechazar a un Agente Corporativo.
 */
export const rechazarAfiliadoCorporativo = async (req: Request, res: Response): Promise<void> => {
  try {
    const idEmpresa = Number(req.params.id) // id_empresa de la URL
    const idAfiliado = Number(req.params.idAfiliado)
    const requesterId = req.user?.id_empresa
    const requesterRole = req.user?.rol

    // Validar permisos
    if (requesterRole !== 'admin' && requesterRole !== 'super_admin' && requesterId !== idEmpresa) {
      res.status(403).json({ success: false, message: 'Acceso denegado.' }); return
    }

    // Verificar que el afiliado existe, pertenece a la empresa y está en estatus '1_PREINSCRIPCION'
    const queryAf = await db.execute({
      sql: `SELECT id_persona, id_empresa, tipo_afiliado, estatus FROM afiliados WHERE id_afiliado = ? AND eliminado_en IS NULL`,
      args: [idAfiliado]
    })

    if (queryAf.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Afiliado no encontrado.' }); return
    }

    const af = queryAf.rows[0] as any
    if (af.id_empresa !== idEmpresa) {
      res.status(400).json({ success: false, message: 'El afiliado no pertenece a la empresa indicada.' }); return
    }

    if (af.tipo_afiliado !== 'Agente Corporativo') {
      res.status(400).json({ success: false, message: 'El afiliado no es un Agente Corporativo.' }); return
    }

    if (af.estatus !== '1_PREINSCRIPCION') {
      res.status(400).json({ success: false, message: `El afiliado no está pendiente de aprobación (estatus actual: ${af.estatus}).` }); return
    }

    const now = new Date().toISOString()

    // 1. Actualizar estatus del afiliado a 'Rechazado' y poner activo = 0
    await db.execute({
      sql: `UPDATE afiliados 
            SET estatus = 'Rechazado', activo = 0, actualizado_en = ?, fecha_ultimo_cambio_estatus = ?
            WHERE id_afiliado = ?`,
      args: [now, now, idAfiliado]
    })

    // 2. Buscar la inscripción al programa 'AFILIACION' de esta persona y marcarla como 'Rechazado'
    const queryEst = await db.execute({
      sql: `SELECT id_estudiante FROM estudiantes WHERE id_persona = ? LIMIT 1`,
      args: [af.id_persona]
    })

    if (queryEst.rows.length > 0) {
      const idEstudiante = queryEst.rows[0].id_estudiante as number
      await db.execute({
        sql: `UPDATE inscripciones_cursos 
              SET estatus = 'Rechazado', actualizado_en = ?
              WHERE id_estudiante = ? AND programa_codigo = 'AFILIACION' AND id_curso IS NULL`,
        args: [now, idEstudiante]
      })
    }

    res.json({ success: true, message: 'Afiliado rechazado con éxito.' })
  } catch (error) {
    console.error('rechazarAfiliadoCorporativo:', error)
    res.status(500).json({ success: false, message: 'Error interno del servidor.' })
  }
}

/**
 * POST /api/afiliados/:id/afiliados-corp/crear-solicitud
 * Permite a la empresa (o admin) crear directamente una solicitud (pendiente) para un Agente Corporativo.
 */
export const crearSolicitudAgenteCorporativo = async (req: Request, res: Response): Promise<void> => {
  try {
    const idEmpresa = Number(req.params.id)
    const requesterId = req.user?.id_empresa
    const requesterRole = req.user?.rol

    if (requesterRole !== 'admin' && requesterRole !== 'super_admin' && requesterId !== idEmpresa) {
      res.status(403).json({ success: false, message: 'Acceso denegado.' }); return
    }

    const { nombreCompleto, cedulaRif, email, telefono, nivelProfesional, esCorredorInmobiliario } = req.body

    if (!nombreCompleto || !cedulaRif || !email) {
      res.status(400).json({ success: false, message: 'Nombre, Cédula y Email son requeridos.' }); return
    }

    // Verificar si ya existe en personas
    const cedulaInput = String(cedulaRif || '').trim();
    const cedulaMatch = cedulaInput.match(/^([VEP])?-?(.+)$/i);
    const cedulaTipo = cedulaMatch && cedulaMatch[1] ? cedulaMatch[1].toUpperCase() : 'V';
    const cedulaNumero = cedulaMatch ? cedulaMatch[2].replace(/\D/g, '') : cedulaInput.replace(/\D/g, '');

    const existing = await db.execute({
      sql: `SELECT id FROM personas WHERE email = ? OR cedula = ? LIMIT 1`,
      args: [email, cedulaNumero]
    })
    if (existing.rows.length > 0) {
      res.status(400).json({ success: false, message: 'Ya existe un registro con ese email o cédula.' }); return
    }

    const now = new Date().toISOString()

    // 1. Crear Persona
    const nameParts = nombreCompleto.trim().split(' ')
    const mid = Math.ceil(nameParts.length / 2)
    const nombres = nameParts.slice(0, mid).join(' ')
    const apellidos = nameParts.length > 1 ? nameParts.slice(mid).join(' ') : ''

    const resP = await db.execute({
      sql: `INSERT INTO personas (nombres, apellidos, cedula_tipo, cedula, email, telefono, nivel_academico, creado_en, actualizado_en)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING id`,
      args: [nombres, apellidos, cedulaTipo, cedulaNumero, email, telefono || null, nivelProfesional || null, now, now]
    })
    const idPersona = Number(resP.rows[0].id)

    // 2. Crear Estudiante
    const resEst = await db.execute({
      sql: `INSERT INTO estudiantes (id_persona, tipo, es_corredor_inmobiliario, programa_interes, creado_en, actualizado_en)
            VALUES (?, 'Afiliado', ?, 'AFILIACION', ?, ?)
            RETURNING id_estudiante`,
      args: [idPersona, esCorredorInmobiliario ? 1 : 0, now, now]
    })
    const idEstudiante = Number(resEst.rows[0].id_estudiante)

    // 3. Crear Inscripción
    await db.execute({
      sql: `INSERT INTO inscripciones_cursos (id_estudiante, programa_codigo, tipo_inscripcion, estatus, creado_en, actualizado_en, id_empresa)
            VALUES (?, 'AFILIACION', 'programa', 'Preinscrito', ?, ?, ?)`,
      args: [idEstudiante, now, now, idEmpresa]
    })

    // 4. Crear Afiliado en 1_PREINSCRIPCION
    await db.execute({
      sql: `INSERT INTO afiliados (id_persona, id_empresa, tipo_afiliado, estatus, creado_en, actualizado_en)
            VALUES (?, ?, 'Agente Corporativo', '1_PREINSCRIPCION', ?, ?)`,
      args: [idPersona, idEmpresa, now, now]
    })

    res.status(201).json({ success: true, message: 'Solicitud de agente creada con éxito.' })
  } catch (error) {
    console.error('crearSolicitudAgenteCorporativo:', error)
    res.status(500).json({ success: false, message: 'Error interno al crear la solicitud.' })
  }
}




/**
 * GET /api/afiliados/:id/independientes-disponibles
 */
export const listarIndependientesDisponibles = async (req: Request, res: Response): Promise<void> => {
  try {
    const idEmpresa = Number(req.params.id)
    const requesterId = req.user?.id_empresa
    const requesterRole = req.user?.rol
    if (requesterRole !== 'admin' && requesterRole !== 'super_admin' && requesterId !== idEmpresa) {
      res.status(403).json({ success: false, message: 'Acceso denegado.' }); return
    }
    const busqueda = String(req.query.q || '').trim().toLowerCase()
    const searchField = String(req.query.field || '').trim().toLowerCase()
    let sql = `
      SELECT a.id_afiliado, a.codigo, a.estatus, a.tipo_afiliado, a.fecha_registro,
        COALESCE(NULLIF(TRIM(COALESCE(p.nombres,'') || ' ' || COALESCE(p.apellidos,'')), ''), p.email) as nombre_completo,
        p.nombres, p.apellidos, (p.cedula_tipo || '-' || p.cedula) as cedula,
        p.email, p.telefono, p.foto_url
      FROM afiliados a JOIN personas p ON a.id_persona = p.id
      WHERE a.eliminado_en IS NULL AND p.eliminado_en IS NULL
        AND a.tipo_afiliado = 'Natural' AND a.estatus = 'Afiliado' AND a.activo = 1
        AND (a.id_empresa IS NULL OR a.id_empresa = 0)
        AND p.email <> 'admin@ciebo.com'`
    const args: any[] = []
    if (busqueda) {
      const like = '%' + busqueda + '%'
      if (searchField === 'cedula') {
        sql += ` AND LOWER(p.cedula) LIKE ?`
        args.push(like)
      } else if (searchField === 'codigo') {
        sql += ` AND LOWER(COALESCE(a.codigo,'')) LIKE ?`
        args.push(like)
      } else { // default to 'nombre'
        sql += ` AND LOWER(COALESCE(p.nombres,'') || ' ' || COALESCE(p.apellidos,'')) LIKE ?`
        args.push(like)
      }
    }
    sql += ' ORDER BY nombre_completo ASC LIMIT 50'
    const result = await db.execute({ sql, args })
    res.json({ success: true, data: result.rows })
  } catch (error) {
    console.error('listarIndependientesDisponibles:', error)
    res.status(500).json({ success: false, message: 'Error al listar afiliados disponibles.' })
  }
}


/**
 * POST /api/afiliados/:id/afiliados-corp/vincular
 * Vincula un afiliado Natural existente como Agente Corporativo. Aprobacion directa.
 */
export const vincularAfiliadoIndependiente = async (req: Request, res: Response): Promise<void> => {
  try {
    const idEmpresa = Number(req.params.id)
    const requesterId = req.user?.id_empresa
    const requesterRole = req.user?.rol
    if (requesterRole !== 'admin' && requesterRole !== 'super_admin' && requesterId !== idEmpresa) {
      res.status(403).json({ success: false, message: 'Acceso denegado.' }); return
    }
    const { id_afiliado } = req.body
    if (!id_afiliado || isNaN(Number(id_afiliado))) {
      res.status(400).json({ success: false, message: 'El campo id_afiliado es requerido.' }); return
    }
    const idAfiliado = Number(id_afiliado)
    const resAfiliado = await db.execute({
      sql: `SELECT a.id_afiliado, a.id_persona, a.id_user, a.tipo_afiliado, a.estatus, a.id_empresa,
                   COALESCE(NULLIF(TRIM(COALESCE(p.nombres,'') || ' ' || COALESCE(p.apellidos,'')), ''), p.email) as nombre_completo,
                   p.nombres, p.apellidos, p.email
            FROM afiliados a JOIN personas p ON a.id_persona = p.id
            WHERE a.id_afiliado = ? AND a.eliminado_en IS NULL`,
      args: [idAfiliado]
    })
    if (resAfiliado.rows.length === 0) { res.status(404).json({ success: false, message: 'Afiliado no encontrado.' }); return }
    const af = resAfiliado.rows[0] as any
    if (af.tipo_afiliado !== 'Natural') { res.status(400).json({ success: false, message: `Solo se pueden vincular afiliados de tipo Natural. Tipo actual: ${af.tipo_afiliado}.` }); return }
    if (af.estatus !== 'Afiliado') { res.status(400).json({ success: false, message: `El afiliado debe tener estatus Afiliado para ser vinculado. Estatus actual: ${af.estatus}.` }); return }
    if (af.id_empresa && af.id_empresa !== 0) { res.status(409).json({ success: false, message: 'Este afiliado ya esta vinculado a otra empresa corporativa.' }); return }
    const resEmpresa = await db.execute({ sql: `SELECT razon_social FROM empresas WHERE id_empresa = ? LIMIT 1`, args: [idEmpresa] })
    if (resEmpresa.rows.length === 0) { res.status(404).json({ success: false, message: 'Empresa no encontrada.' }); return }
    const empresa = resEmpresa.rows[0] as any
    const nombreEmpresa = empresa.razon_social || 'la empresa'
    const now = new Date().toISOString()
    await db.execute({
      sql: `UPDATE afiliados SET tipo_afiliado = 'Agente Corporativo', id_empresa = ?, actualizado_en = ? WHERE id_afiliado = ?`,
      args: [idEmpresa, now, idAfiliado]
    })
    if (af.id_user) {
      NotificationService.notify({
        userId: af.id_user, title: 'Ahora eres Agente Corporativo',
        message: `La empresa ${nombreEmpresa} te ha vinculado como Agente Corporativo. Tu perfil fue actualizado.`,
        type: 'VINCULACION_CORPORATIVA', priority: 'ALTA', channels: ['IN_APP'],
        data: { id_empresa: idEmpresa, nombre_empresa: nombreEmpresa }
      }).catch(err => console.error('vincular [IN_APP]:', err))
    }
    NotificationService.notifyAdmins({
      title: 'Nuevo agente corporativo vinculado',
      message: `${af.nombre_completo} fue vinculado como Agente Corporativo de ${nombreEmpresa}.`,
      type: 'VINCULACION_CORPORATIVA', priority: 'NORMAL', channels: ['IN_APP'],
      data: { id_afiliado: idAfiliado, id_empresa: idEmpresa }
    }).catch(err => console.error('vincular [ADMIN IN_APP]:', err))
    if (af.email) {
      enviarCorreoVinculacionCorporativa({
        nombre: af.nombre_completo || af.nombres || 'Afiliado',
        emailOriginal: af.email, nombreEmpresa
      }).catch(err => console.error('vincular [EMAIL]:', err))
    }
    res.status(200).json({ success: true, message: `${af.nombre_completo} ha sido vinculado exitosamente como Agente Corporativo de ${nombreEmpresa}.` })
  } catch (error) {
    console.error('vincularAfiliadoIndependiente:', error)
    res.status(500).json({ success: false, message: 'Error interno al vincular el afiliado.' })
  }
}
