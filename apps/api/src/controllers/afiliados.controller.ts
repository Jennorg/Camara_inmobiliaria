import { Request, Response } from 'express';
import { randomUUID, createHash } from 'crypto';
import { db } from '../lib/db.js';

const sha256 = (raw: string) => createHash('sha256').update(raw).digest('hex');

import {
  enviarCorreoVerificacion,
  enviarCorreoAprobacion,
  notificarAdminNuevaAfiliacion,
  enviarCorreoInvitacionCorporativa
} from '../lib/email.js';
import { crearVerificacionPreinscripcionPrograma } from './academia.controller.js';
import bcrypt from 'bcryptjs';

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
          cu.nombre AS curso_nombre,
          e.nombre_completo AS estudiante_nombre
        FROM certificados c
        JOIN inscripciones_cursos ic ON ic.id_inscripcion = c.id_inscripcion
        JOIN estudiantes e ON e.id_estudiante = ic.id_estudiante
        LEFT JOIN cursos cu ON cu.id_curso = ic.id_curso
        WHERE (
          (? <> '' AND LOWER(TRIM(e.email)) = ?)
          OR (? IS NOT NULL AND e.id_afiliado = ?)
          OR (? IS NOT NULL AND EXISTS (
            SELECT 1 FROM afiliados af
            JOIN personas p_af ON af.id_persona = p_af.id
            WHERE af.id_afiliado = ? AND LOWER(TRIM(p_af.email)) = LOWER(TRIM(e.email))
          ))
        )
        ORDER BY c.fecha_emision DESC
      `,
      args: [userEmail, userEmail, idAfiliado, idAfiliado, idAfiliado, idAfiliado],
    })

    res.json({ success: true, data: result.rows })
  } catch (error) {
    console.error('getMisCertificados:', error)
    res.status(500).json({ success: false, message: 'Error al obtener certificados' })
  }
}

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
                   p.nombres, p.apellidos, p.cedula, p.email, p.telefono, p.direccion, 
                   p.fecha_nacimiento, p.nivel_academico, p.profesion,
                   e.razon_social as empresa_razon_social, 
                   e.rif_tipo as empresa_rif_tipo,
                   e.rif_numero as empresa_rif_numero,
                   e.logo_url as empresa_logo_url,
                   e.website as empresa_website,
                   e.email as empresa_email,
                   e.telefono as empresa_telefono,
                   json_extract(a.redes_sociales, '$.instagram') as instagram,
                   json_extract(a.redes_sociales, '$.facebook') as facebook,
                   json_extract(a.redes_sociales, '$.linkedin') as linkedin,
                   json_extract(a.redes_sociales, '$.twitter') as twitter,
                   json_extract(e.redes_sociales, '$.instagram') as empresa_instagram,
                   json_extract(e.redes_sociales, '$.facebook') as empresa_facebook,
                   json_extract(e.redes_sociales, '$.linkedin') as empresa_linkedin,
                   json_extract(e.redes_sociales, '$.twitter') as empresa_twitter,
                   CASE 
                     WHEN a.tipo_afiliado = 'Corporativo' THEN COALESCE(e.razon_social, p.nombres || ' ' || p.apellidos)
                     ELSE p.nombres || ' ' || p.apellidos 
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
               OR (entidad_tipo = 'estudiante' AND entidad_id = (SELECT id_estudiante FROM estudiantes WHERE id_persona = ?))
            ORDER BY creado_en ASC`,
      args: [afiliado.id_afiliado, afiliado.id_empresa || -1, afiliado.id_persona]
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

    // Verificar si ya existe en personas o empresas
    const existePersona = await db.execute({
      sql: `SELECT id FROM personas WHERE email = ? OR cedula = ?`,
      args: [email, cedulaRif]
    });

    const existeEmpresa = await db.execute({
      sql: `SELECT id_empresa FROM empresas WHERE email = ? OR rif_numero = ?`,
      args: [email, cedulaRif]
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
      args: [email, cedulaRif]
    });

    if (existeVerificacion.rows.length > 0) {
      await db.execute({
        sql: `DELETE FROM verificaciones_email WHERE email = ? OR cedula_rif = ?`,
        args: [email, cedulaRif]
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
      args: [token, nombreCompleto, cedulaRif, email, telefono, fechaExpiracionStr]
    });

    // NOTA: Para no romper el esquema de verificaciones_email (que es temporal), 
    // podríamos guardar el resto en una tabla meta o simplemente permitir que se completen después.
    // Por ahora, asumiremos que los campos extra se guardan si existen en req.body para el paso final.

    // 4. Enviar email con Resend
    await enviarCorreoVerificacion(nombreCompleto, email, token);

    return res.status(201).json({
      success: true,
      message: 'Te hemos enviado un correo de comprobación. Por favor revisa tu bandeja de entrada o SPAM.'
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

      // Insertar en personas
      const insertPersona = await db.execute({
        sql: `INSERT INTO personas (
                nombres,
                apellidos,
                email, 
                cedula, 
                telefono
              ) VALUES (?, ?, ?, ?, ?) RETURNING id`,
        args: [nombres || fullName, apellidos, registro.email, registro.cedula_rif, registro.telefono]
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

      if (newAfiliado?.id_afiliado) {
        await db.execute({
          sql: `UPDATE afiliados SET codigo_cibir = CAST(id_afiliado AS TEXT) WHERE id_afiliado = ?`,
          args: [newAfiliado.id_afiliado]
        });
      }

      // Eliminar el token usado
      await db.execute({
        sql: `DELETE FROM verificaciones_email WHERE token_verificacion = ?`,
        args: [token]
      });

      // Notificar al admin
      notificarAdminNuevaAfiliacion({
        nombre: registro.nombre_completo as string,
        email: registro.email as string,
        cedulaRif: registro.cedula_rif as string,
        telefono: registro.telefono as string
      }).catch(e => console.error('Error notificando admin (afiliación):', e));

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
      SELECT a.*, 
             p.nombres, p.apellidos, 
             p.cedula, p.email, p.telefono, p.direccion, p.fecha_nacimiento, p.nivel_academico,
             e.razon_social as empresa_razon_social, 
             e.rif_tipo as empresa_rif_tipo,
             e.rif_numero as empresa_rif_numero,
             e.logo_url as empresa_logo_url,
             e.website as empresa_website,
             e.email as empresa_email,
             e.telefono as empresa_telefono,
             COALESCE(e_redes.instagram, json_extract(a.redes_sociales, '$.instagram')) as instagram,
             COALESCE(e_redes.facebook, json_extract(a.redes_sociales, '$.facebook')) as facebook,
             COALESCE(e_redes.linkedin, json_extract(a.redes_sociales, '$.linkedin')) as linkedin,
             COALESCE(e_redes.twitter, json_extract(a.redes_sociales, '$.twitter')) as twitter,
             CASE 
               WHEN a.tipo_afiliado = 'Corporativo' THEN COALESCE(e.razon_social, p.nombres || ' ' || p.apellidos)
               ELSE p.nombres || ' ' || p.apellidos 
             END as nombre_completo
      FROM afiliados a
      JOIN personas p ON a.id_persona = p.id
      LEFT JOIN empresas e ON a.id_empresa = e.id_empresa
      LEFT JOIN (
        SELECT id_empresa, 
               json_extract(redes_sociales, '$.instagram') as instagram,
               json_extract(redes_sociales, '$.facebook') as facebook,
               json_extract(redes_sociales, '$.linkedin') as linkedin,
               json_extract(redes_sociales, '$.twitter') as twitter
        FROM empresas
      ) e_redes ON a.id_empresa = e_redes.id_empresa
      WHERE a.eliminado_en IS NULL
        AND p.eliminado_en IS NULL
        AND (e.eliminado_en IS NULL OR e.eliminado_en IS NULL)  -- empresas puede no existir
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
      sql: `SELECT a.*, p.nombres || ' ' || p.apellidos as nombre_completo, p.email as email 
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
    // Buscamos el último código numérico asignado
    const resultUltimoCode = await db.execute({
      sql: `SELECT codigo_cibir FROM afiliados 
            WHERE codigo_cibir GLOB '[0-9]*' 
            ORDER BY CAST(codigo_cibir AS INTEGER) DESC LIMIT 1`,
      args: []
    });

    let correlativo = 1;
    if (resultUltimoCode.rows.length > 0 && resultUltimoCode.rows[0].codigo_cibir) {
      const lastCode = parseInt(resultUltimoCode.rows[0].codigo_cibir as string, 10);
      if (!isNaN(lastCode)) {
        correlativo = lastCode + 1;
      }
    }

    const codigoAfiliado = correlativo.toString();

    // 3. Actualizar a estatus Afiliado (aprobado final)
    const fechaCambio = new Date().toISOString();

    const updateResult = await db.execute({
      sql: `UPDATE afiliados 
            SET estatus = 'Afiliado', inscripcion_pagada = 1, codigo_cibir = ?, fecha_ultimo_cambio_estatus = ?, actualizado_en = ?
            WHERE id_afiliado = ? RETURNING *`,
      args: [codigoAfiliado, fechaCambio, fechaCambio, id]
    });

    const afiliadoActualizado = updateResult.rows[0];

    // 4. Preparar acceso (Usuario + Token de Seguridad)
    try {
      if (afiliado.email) {
        const resetToken = randomUUID();
        const expiracion = new Date();
        expiracion.setHours(expiracion.getHours() + 48);
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

    // 1. Verificar si existe y si su estatus es Preinscrito
    const resultAfiliado = await db.execute({
      sql: 'SELECT * FROM afiliados WHERE id_afiliado = ?',
      args: [id]
    });

    const afiliado = resultAfiliado.rows[0];

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
    // REGLA CRÍTICA: Añadida cedula_rif pública
    // REGLA DE FILTRO: Solo afiliados con estatus = 'Afiliado'.
    // Retornamos hasta 1000 afiliados (o todos) para que fuse.js en el frontend haga la búsqueda fuzzy y filtrado local sin saturar DB
    const result = await db.execute({
      sql: `
      SELECT a.id_afiliado, 
             CASE 
               WHEN a.tipo_afiliado = 'Corporativo' THEN COALESCE(e.razon_social, p.nombres || ' ' || p.apellidos)
               ELSE p.nombres || ' ' || p.apellidos 
             END as nombre_completo, 
             p.nombres || ' ' || p.apellidos as representante_nombre,
             p.nombres, p.apellidos, a.codigo_cibir, 
             p.cedula, e.rif_numero as empresa_rif_numero, e.rif_tipo as empresa_rif_tipo,
             a.tipo_afiliado,
             e.razon_social as empresa_razon_social,
             e.logo_url as empresa_logo_url, e.website as empresa_website,
             json_extract(a.redes_sociales, '$.instagram') as instagram,
             json_extract(a.redes_sociales, '$.facebook') as facebook,
             json_extract(a.redes_sociales, '$.linkedin') as linkedin,
             json_extract(a.redes_sociales, '$.twitter') as twitter
      FROM afiliados a 
      JOIN personas p ON a.id_persona = p.id
      LEFT JOIN empresas e ON a.id_empresa = e.id_empresa
      WHERE a.estatus = 'Afiliado' AND a.activo = 1
      ORDER BY nombre_completo ASC
    `,
      args: []
    });

    console.log(`[DEBUG] buscarAfiliadosPublic: Encontrados ${result.rows.length} afiliados activos.`);
    if (result.rows.length > 0) {
      console.log(`[DEBUG] Tipos encontrados:`, [...new Set(result.rows.map(r => r.tipo_afiliado))]);
    }

    // Usamos logo_url real si existe, sino ui-avatars como fallback
    const mappedData = result.rows.map((row) => ({
      ...row,
      foto_url: (row.empresa_logo_url as string) || `https://ui-avatars.com/api/?name=${encodeURIComponent(row.nombre_completo as string)}&background=047857&color=fff&size=200`,
      redes_sociales: {
        instagram: row.instagram || '',
        linkedin: row.linkedin || '',
        facebook: row.facebook || '',
        twitter: row.twitter || '',
        website: row.website || ''
      }
    }));

    return res.status(200).json({
      success: true,
      data: mappedData
    });
  } catch (error) {
    console.error('Error en buscarAfiliadosPublic:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor al realizar la búsqueda pública'
    });
  }
};

export const getAfiliadoPublicById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await db.execute({
      sql: `
        SELECT a.*, 
               CASE 
                 WHEN a.tipo_afiliado = 'Corporativo' THEN COALESCE(e.razon_social, p.nombres || ' ' || p.apellidos)
                 ELSE p.nombres || ' ' || p.apellidos 
               END as nombre_completo, 
               p.nombres, p.apellidos, p.cedula, p.email, p.telefono, p.direccion, 
               p.fecha_nacimiento, p.nivel_academico, p.profesion,
               e.razon_social as empresa_razon_social, 
               e.rif_tipo as empresa_rif_tipo,
               e.rif_numero as empresa_rif_numero,
               e.logo_url as empresa_logo_url,
               e.website as empresa_website,
               e.email as empresa_email,
               e.telefono as empresa_telefono,
               COALESCE(e_redes.instagram, json_extract(a.redes_sociales, '$.instagram')) as instagram,
               COALESCE(e_redes.facebook, json_extract(a.redes_sociales, '$.facebook')) as facebook,
               COALESCE(e_redes.linkedin, json_extract(a.redes_sociales, '$.linkedin')) as linkedin,
               COALESCE(e_redes.twitter, json_extract(a.redes_sociales, '$.twitter')) as twitter,
               e.banner_url as empresa_banner_url
        FROM afiliados a
        JOIN personas p ON a.id_persona = p.id
        LEFT JOIN empresas e ON a.id_empresa = e.id_empresa
        LEFT JOIN (
          SELECT id_empresa, 
                 json_extract(redes_sociales, '$.instagram') as instagram,
                 json_extract(redes_sociales, '$.facebook') as facebook,
                 json_extract(redes_sociales, '$.linkedin') as linkedin,
                 json_extract(redes_sociales, '$.twitter') as twitter
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
      foto_url: (row.empresa_logo_url as string) || `https://ui-avatars.com/api/?name=${encodeURIComponent(row.nombre_completo as string)}&background=047857&color=fff&size=200`,
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
          SELECT a.id_afiliado, p.nombres || ' ' || p.apellidos as nombre_completo, a.codigo_cibir, p.cedula, a.tipo_afiliado
          FROM afiliados a
          JOIN personas p ON a.id_persona = p.id
          WHERE a.id_empresa = ? AND a.estatus = 'Afiliado' AND a.activo = 1
        `,
        args: [row.id_empresa]
      });
      mappedData.afiliados_asociados = assocResult.rows.map((r: any) => ({
        ...r,
        foto_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(r.nombre_completo)}&background=047857&color=fff&size=200`
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
        COUNT(*) as todos,
        SUM(CASE WHEN estatus IN ('1_PREINSCRIPCION','2_EXPEDIENTE','3_ENTREVISTA','4_VERIFICACION','5_CIBIR','6_INSCRIPCION') THEN 1 ELSE 0 END) as pendiente,
        SUM(CASE WHEN estatus = 'Afiliado' THEN 1 ELSE 0 END) as aprobado,
        SUM(CASE WHEN estatus IN ('Suspendido', 'Rechazado', 'Moroso') THEN 1 ELSE 0 END) as rechazado
      FROM afiliados
    `;
    const countResult = await db.execute({ sql: countSql, args: [] });
    const counts = countResult.rows[0];

    let sql = `
      SELECT a.*, 
             p.nombres, p.apellidos, 
             p.nombres || ' ' || p.apellidos as nombre_completo, 
             p.cedula, p.email, p.telefono,
             e.razon_social as empresa_razon_social
      FROM afiliados a 
      JOIN personas p ON a.id_persona = p.id
      LEFT JOIN empresas e ON a.id_empresa = e.id_empresa
    `;
    const args: any[] = [];
    const whereConditions: Record<string, string> = {
      pendiente: `estatus IN ('1_PREINSCRIPCION','2_EXPEDIENTE','3_ENTREVISTA','4_VERIFICACION','5_CIBIR','6_INSCRIPCION')`,
      aprobado: `estatus = 'Afiliado'`,
      rechazado: `estatus IN ('Suspendido','Rechazado','Moroso')`,
    };
    if (tab in whereConditions) {
      sql += ` WHERE ${whereConditions[tab]}`;
    }

    sql += ' ORDER BY fecha_registro DESC';

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

    // Si el estatus cambia a 'Afiliado', nos aseguramos de que tenga un código de afiliado
    if (estatus === 'Afiliado') {
      const currentRes = await db.execute({
        sql: 'SELECT codigo_cibir FROM afiliados WHERE id_afiliado = ?',
        args: [Number(id)]
      });
      const current = currentRes.rows[0];
      if (!current || !current.codigo_cibir) {
        // Generar nuevo código correlativo
        const resultUltimoCode = await db.execute({
          sql: `SELECT codigo_cibir FROM afiliados 
                WHERE codigo_cibir GLOB '[0-9]*' 
                ORDER BY CAST(codigo_cibir AS INTEGER) DESC LIMIT 1`,
          args: []
        });
        let correlativo = 1;
        if (resultUltimoCode.rows.length > 0 && resultUltimoCode.rows[0].codigo_cibir) {
          const lastCode = parseInt(resultUltimoCode.rows[0].codigo_cibir as string, 10);
          if (!isNaN(lastCode)) correlativo = lastCode + 1;
        }
        setParts.push('codigo_cibir = ?');
        args.splice(args.length - 1, 0, correlativo.toString()); // Insertar antes del ID
      }
    }

    const result = await db.execute({
      sql: `UPDATE afiliados SET ${setParts.join(', ')} WHERE id_afiliado = ? RETURNING *`,
      args
    });

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Afiliado no encontrado' });
    }

    return res.json({ success: true, data: result.rows[0] });
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
    const personaFields = ['nombres', 'apellidos', 'cedula', 'email', 'telefono', 'fecha_nacimiento', 'nivel_academico', 'direccion', 'profesion'];
    const adminOnlyFields = ['estatus', 'cibir_convalidado', 'inscripcion_pagada', 'codigo_cibir', 'id_empresa', 'activo'];
    const afiliadoFields = [
      'estatus', 'cibir_convalidado', 'inscripcion_pagada', 'tipo_afiliado',
      'codigo_cibir', 'id_empresa', 'notas', 'activo', 'redes_sociales'
    ];
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
      args: [id]
    });

    if (current.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Afiliado no encontrado' });
    }
    const { id_persona: idPersona, id_empresa: idEmpresa } = current.rows[0] as any;

    // 2. Preparar actualizaciones
    const pUpdates: string[] = [];
    const pArgs: any[] = [];
    const aUpdates: string[] = [];
    const aArgs: any[] = [];
    const eUpdates: string[] = [];
    const eArgs: any[] = [];

    const socialFields = ['instagram', 'facebook', 'linkedin', 'twitter'];

    Object.keys(fields).forEach(key => {
      if (personaFields.includes(key)) {
        pUpdates.push(`${key} = ?`);
        pArgs.push(fields[key]);
      } else if (afiliadoFields.includes(key)) {
        let val = fields[key];
        if (key === 'redes_sociales' && typeof val === 'object') val = JSON.stringify(val);
        aUpdates.push(`${key} = ?`);
        aArgs.push(val);
      } else if (empresaFieldsMap[key]) {
        eUpdates.push(`${empresaFieldsMap[key]} = ?`);
        eArgs.push(fields[key]);
      } else if (socialFields.includes(key)) {
        // Manejo especial para campos de redes sociales sueltos
        // En lugar de actualizar el JSON entero (que requeriría leerlo primero), 
        // los guardamos para procesarlos después si es necesario.
        // Pero para simplificar, el frontend debería enviar el objeto completo o manejamos el merge aquí.
        // Optamos por soportar el envío directo de instagram, facebook, etc.
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
        args: [id]
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

    if (pUpdates.length === 0 && aUpdates.length === 0 && eUpdates.length === 0) {
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
              p.nombres || ' ' || p.apellidos as nombre_completo, 
              p.cedula, 
              p.email, 
              p.telefono, 
              a.estatus, 
              a.fecha_registro,
              'Aprobado' as fase
            FROM afiliados a
            JOIN personas p ON a.id_persona = p.id
            WHERE a.id_empresa = ?
            
            UNION ALL
            
            SELECT 
              NULL as id_afiliado,
              e.nombre_completo,
              e.cedula_rif,
              e.email,
              e.telefono,
              ic.estatus,
              ic.creado_en as fecha_registro,
              'Solicitud' as fase
            FROM inscripciones_cursos ic
            JOIN estudiantes e ON e.id_estudiante = ic.id_estudiante
            WHERE ic.id_empresa = ? AND ic.programa_codigo = 'AFILIACION'
              AND NOT EXISTS (SELECT 1 FROM afiliados a2 JOIN personas p2 ON a2.id_persona = p2.id WHERE p2.email = e.email)
            
            ORDER BY fecha_registro DESC`,
      args: [id, id]
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

    const NIVELES_VALIDOS = new Set(['Bachiller', 'TSU', 'Universitario', 'Postgrado'])
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
 * Elimina un registro de afiliado.
 */
export const deleteAfiliado = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Primero verificar si existe
    const check = await db.execute({
      sql: 'SELECT id_persona FROM afiliados WHERE id_afiliado = ?',
      args: [id]
    });

    if (check.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Afiliado no encontrado' });
      return;
    }
    const idPersona = check.rows[0].id_persona;

    // Borrar de afiliados (cascade borrará de personas si está configurado, 
    // pero si no, borramos personas también para no dejar huérfanos)
    await db.execute({
      sql: 'DELETE FROM afiliados WHERE id_afiliado = ?',
      args: [id]
    });

    // Opcional: borrar de personas si no tiene otras relaciones (estudiante, etc.)
    // Por ahora lo dejamos así para simplificar.

    res.json({ success: true, message: 'Afiliado eliminado correctamente' });
  } catch (error) {
    console.error('Error en deleteAfiliado:', error);
    res.status(500).json({ success: false, message: 'Error interno al eliminar afiliado' });
  }
};

/**
 * POST /api/afiliados
 * Creación directa de un afiliado por parte del administrador.
 */
export const createAfiliado = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      nombres, apellidos, empresa_razon_social,
      cedula, email, tipo_afiliado, estatus,
      telefono, direccion, codigo_cibir,
      id_empresa, instagram, facebook, linkedin
    } = req.body;

    if (!cedula || !email) {
      res.status(400).json({ success: false, message: 'Cédula/RIF y Email son obligatorios.' });
      return;
    }
    const tipoFinal = tipo_afiliado || 'Natural'

    // Verificar duplicados en personas
    const existing = await db.execute({
      sql: 'SELECT id FROM personas WHERE email = ? OR cedula = ?',
      args: [email, cedula]
    });

    if (existing.rows.length > 0) {
      res.status(400).json({ success: false, message: 'Ya existe un registro con ese email o Cédula.' });
      return;
    }

    // 1. Insertar Persona
    const resultP = await db.execute({
      sql: `INSERT INTO personas (nombres, apellidos, cedula, email, telefono, direccion)
            VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
      args: [nombres || '', apellidos || '', cedula, email, telefono || null, direccion || null]
    });
    const idPersona = resultP.rows[0].id;

    // 2. Manejar Empresa
    let finalIdEmpresa: number | null = id_empresa || null;

    // Si es corporativo y NO se pasó un id_empresa, creamos la empresa
    if (tipoFinal === 'Corporativo' && !finalIdEmpresa) {
      const resultE = await db.execute({
        sql: `INSERT INTO empresas (razon_social, rif_numero, email, telefono)
              VALUES (?, ?, ?, ?) RETURNING id_empresa`,
        args: [empresa_razon_social || '', cedula, email, telefono || null]
      });
      finalIdEmpresa = resultE.rows[0].id_empresa;
    }

    // 3. Insertar Afiliado
    const redes_sociales = JSON.stringify({ instagram, facebook, linkedin });
    const resultA = await db.execute({
      sql: `INSERT INTO afiliados (
        id_persona, id_empresa, tipo_afiliado, estatus, codigo_cibir, redes_sociales, activo
      ) VALUES (?, ?, ?, ?, ?, ?, 1) RETURNING *`,
      args: [idPersona, finalIdEmpresa, tipoFinal, estatus || 'Afiliado', codigo_cibir || null, redes_sociales]
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
      args: [id]
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
      args: [id]
    });

    res.json({ success: true, message: 'Conversión a Afiliado Natural exitosa' });
  } catch (error) {
    console.error('convertirAgenteANatural:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};
