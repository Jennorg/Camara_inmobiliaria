import { Request, Response } from 'express'
import { requireAuth, requireRole } from '../middlewares/auth.middleware.js'
import { randomUUID, createHash } from 'crypto'
import { db } from '../lib/db.js'
import { env } from '../config/env.js'
import { obtenerSiguienteCodigoAfiliado } from '../lib/afiliados.js'

const sha256 = (raw: string) => createHash('sha256').update(raw).digest('hex')
const generateSlug = (str: string) => {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '') + '-' + Date.now();
}
import { emitirComprobanteSiCompleto, ensureCibirCertificate } from '../lib/certificados.js'
import {
  enviarCorreoConfirmacionPreinscripcionPrograma,
  notificarAdminNuevaPreinscripcion,
  enviarCorreoAprobacionEstudiante,
  enviarCorreoSetPasswordEstudiante,
  enviarCorreoResultadoEntrevista,
  enviarCorreoInvitacionCibir,
  enviarCorreoRechazo,
} from '../lib/email.js'
import bcrypt from 'bcryptjs'
import { NotificationService } from '../services/notification.service.js'

function getCookie(req: Request, name: string): string | undefined {
  const raw = req.headers.cookie
  if (!raw) return undefined
  const cookies = raw.split(';').map(c => c.trim())
  for (const cookie of cookies) {
    const [key, ...valParts] = cookie.split('=')
    if (key === name) {
      return decodeURIComponent(valParts.join('='))
    }
  }
  return undefined
}

const MAIN_PROGRAM_CODES = new Set(['PADI', 'PEGI', 'PREANI', 'CIBIR', 'AFILIACION'])
const PROFESSIONAL_LEVELS = new Set(['Bachiller', 'TSU', 'Nivel Profesional', 'Postgrado'])

function normalizeProgramaCodigo(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const code = value.trim().toUpperCase()
  return MAIN_PROGRAM_CODES.has(code) ? code : null
}

function normalizeNivelProfesional(value: unknown): 'Bachiller' | 'TSU' | 'Nivel Profesional' | 'Postgrado' | null {
  if (typeof value !== 'string') return null
  const cleaned = value.trim()
  if (cleaned === 'No especificado') return null
  return PROFESSIONAL_LEVELS.has(cleaned) ? (cleaned as 'Bachiller' | 'TSU' | 'Nivel Profesional' | 'Postgrado') : null
}

function normalizeEsCorredorInmobiliario(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const cleaned = value.trim().toLowerCase()
    if (['si', 'sí', 'true', '1'].includes(cleaned)) return true
    if (['no', 'false', '0'].includes(cleaned)) return false
  }
  if (typeof value === 'number') {
    if (value === 1) return true
    if (value === 0) return false
  }
  return null
}

export async function upsertEstudianteByEmail(params: {
  nombreCompleto: string
  nombres?: string | null
  apellidos?: string | null
  razonSocial?: string | null
  email: string
  cedulaRif?: string | null
  telefono?: string | null
  tipo?: string | null
  nivelProfesional?: 'Bachiller' | 'TSU' | 'Nivel Profesional' | 'Postgrado' | null
  profesion?: string | null
  esCorredorInmobiliario?: boolean | null
  anoInicioServicio?: number | null
  website?: string | null
  descripcion?: string | null
}): Promise<{ id_estudiante: number }> {
  const { nombres, apellidos, razonSocial, cedulaRif, email, telefono, tipo, nivelProfesional, profesion, esCorredorInmobiliario, anoInicioServicio, website, descripcion } = params

  // 1. Buscar si es Empresa o Persona
  let idPersona: number | null = null
  let idEmpresa: number | null = null

  if (razonSocial) {
    const cleanedRif = (cedulaRif || '').replace(/\D/g, '');
    const resE = await db.execute({
      sql: `SELECT id_empresa FROM empresas WHERE email = ? OR (rif_numero = ? AND ? != '') LIMIT 1`,
      args: [email, cleanedRif, cleanedRif]
    })
    if (resE.rows.length > 0) {
      idEmpresa = resE.rows[0].id_empresa as number
      await db.execute({
        sql: `UPDATE empresas SET 
                razon_social = COALESCE(NULLIF(TRIM(?), ''), razon_social),
                telefono = COALESCE(NULLIF(TRIM(?), ''), telefono),
                email = COALESCE(NULLIF(TRIM(?), ''), email),
                rif_numero = CASE WHEN ? != '' THEN ? ELSE rif_numero END
              WHERE id_empresa = ?`,
        args: [
          razonSocial || null,
          telefono || null,
          email || null,
          cleanedRif, cleanedRif,
          idEmpresa
        ]
      })
    } else {
      const finalRif = cleanedRif || `TEMP-J-${Date.now()}`;
      const insE = await db.execute({
        sql: `INSERT INTO empresas (razon_social, rif_numero, email, telefono) VALUES (?, ?, ?, ?) RETURNING id_empresa`,
        args: [razonSocial, finalRif, email, telefono || null]
      })
      idEmpresa = insE.rows[0].id_empresa as number
    }
  } else {
    const cedulaInput = String(cedulaRif || '').trim();
    const cedulaMatch = cedulaInput.match(/^([VEP])?-?(.+)$/i);
    const cedulaTipo = cedulaMatch && cedulaMatch[1] ? cedulaMatch[1].toUpperCase() : 'V';
    const cedulaNumero = cedulaMatch ? cedulaMatch[2].replace(/\D/g, '') : cedulaInput.replace(/\D/g, '');

    const resP = await db.execute({
      sql: `SELECT id FROM personas WHERE email = ? OR (cedula = ? AND ? != '') LIMIT 1`,
      args: [email, cedulaNumero, cedulaNumero]
    })
    if (resP.rows.length > 0) {
      idPersona = resP.rows[0].id as number
      const parsedNombres = nombres || (params.nombreCompleto ? (params.nombreCompleto.trim().split(/\s+/).length > 1 ? params.nombreCompleto.trim().split(/\s+/).slice(0, -1).join(' ') : params.nombreCompleto.trim()) : null);
      const parsedApellidos = apellidos || (params.nombreCompleto && params.nombreCompleto.trim().split(/\s+/).length > 1 ? params.nombreCompleto.trim().split(/\s+/).slice(-1)[0] : null);

      await db.execute({
        sql: `UPDATE personas SET 
                nombres = COALESCE(NULLIF(TRIM(?), ''), nombres),
                apellidos = COALESCE(NULLIF(TRIM(?), ''), apellidos),
                telefono = COALESCE(NULLIF(TRIM(?), ''), telefono),
                cedula = CASE WHEN ? != '' THEN ? ELSE cedula END,
                cedula_tipo = CASE WHEN ? != '' THEN ? ELSE cedula_tipo END,
                email = COALESCE(NULLIF(TRIM(?), ''), email),
                nivel_academico = COALESCE(?, nivel_academico),
                profesion = COALESCE(?, profesion)
              WHERE id = ?`,
        args: [
          parsedNombres,
          parsedApellidos,
          telefono || null,
          cedulaNumero, cedulaNumero,
          cedulaTipo, cedulaTipo,
          email || null,
          nivelProfesional || null,
          profesion || null,
          idPersona
        ]
      })
      if (anoInicioServicio !== undefined && anoInicioServicio !== null) {
        await db.execute({
          sql: `UPDATE afiliados SET ano_inicio_servicio = COALESCE(?, ano_inicio_servicio) WHERE id_persona = ?`,
          args: [anoInicioServicio, idPersona]
        })
      }
    } else {
      const finalCedulaNumero = cedulaNumero || `TEMP-V-${Date.now()}`;
      const insP = await db.execute({
        sql: `INSERT INTO personas (nombres, apellidos, cedula_tipo, cedula, email, telefono, nivel_academico, profesion) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
        args: [nombres || params.nombreCompleto || '', apellidos || '', cedulaTipo, finalCedulaNumero, email, telefono || null, nivelProfesional || null, profesion || null]
      })
      idPersona = insP.rows[0].id as number
      if (anoInicioServicio !== undefined && anoInicioServicio !== null) {
        await db.execute({
          sql: `UPDATE afiliados SET ano_inicio_servicio = COALESCE(?, ano_inicio_servicio) WHERE id_persona = ?`,
          args: [anoInicioServicio, idPersona]
        })
      }
    }
  }

  // 2. Upsert Estudiante
  const existing = await db.execute({
    sql: `SELECT id_estudiante FROM estudiantes WHERE (id_persona = ? AND ? IS NOT NULL) OR (id_empresa = ? AND ? IS NOT NULL) LIMIT 1`,
    args: [idPersona, idPersona, idEmpresa, idEmpresa],
  })

  if (existing.rows.length > 0) {
    const id = existing.rows[0].id_estudiante as number
    await db.execute({
      sql: `UPDATE estudiantes
            SET es_corredor_inmobiliario = COALESCE(?, es_corredor_inmobiliario),
                tipo = ?,
                actualizado_en = ?
            WHERE id_estudiante = ?`,
      args: [
        esCorredorInmobiliario == null ? null : Number(esCorredorInmobiliario),
        tipo ?? 'Regular',
        new Date().toISOString(),
        id,
      ],
    })
    return { id_estudiante: id }
  }

  const inserted = await db.execute({
    sql: `INSERT INTO estudiantes
            (id_persona, id_empresa, es_corredor_inmobiliario, tipo)
          VALUES (?, ?, ?, ?) RETURNING id_estudiante`,
    args: [
      idPersona,
      idEmpresa,
      Number(esCorredorInmobiliario ?? false),
      tipo ?? 'Regular'
    ],
  })
  return { id_estudiante: inserted.rows[0].id_estudiante as number }
}

export async function crearVerificacionPreinscripcionPrograma(params: {
  nombreCompleto: string
  nombres?: string | null
  apellidos?: string | null
  cedulaRif?: string | null
  email: string
  telefono?: string | null
  programaCodigo: string
  tipoAfiliado?: string | null
  nivelProfesional?: string | null
  profesion?: string | null
  esCorredorInmobiliario?: boolean | string | null
  razonSocial?: string | null
  representanteLegal?: string | null
  cedulaRepresentante?: string | null
  emailRepresentante?: string | null
  empresaTelefono?: string | null
  id_empresa?: number | null
  aprobadoPorEmpresa?: boolean
}): Promise<{ token: string, fechaExpiracion: string }> {
  const {
    nombreCompleto, nombres, apellidos, cedulaRif, email, telefono, programaCodigo,
    tipoAfiliado, nivelProfesional, profesion, esCorredorInmobiliario,
    razonSocial, representanteLegal, cedulaRepresentante, emailRepresentante, empresaTelefono, id_empresa,
    aprobadoPorEmpresa
  } = params

  let finalNombres = nombres;
  let finalApellidos = apellidos;
  if (!finalNombres && nombreCompleto) {
    const parts = nombreCompleto.trim().split(' ');
    const mid = Math.ceil(parts.length / 2);
    finalNombres = parts.slice(0, mid).join(' ');
    finalApellidos = parts.length > 1 ? parts.slice(mid).join(' ') : '';
  }

  const expiracion = new Date()
  expiracion.setDate(expiracion.getDate() + 30) // 30 días de validez
  const fechaExpiracion = expiracion.toISOString()
  const token = randomUUID()

  // Sanitizar campos numéricos
  const cleanedCedulaRif = (cedulaRif || '').replace(/\D/g, '')
  const cleanedCedulaRep = (cedulaRepresentante || '').replace(/\D/g, '')

  const repNombre = representanteLegal || ''
  const repParts = repNombre.trim().split(' ')
  const repMid = Math.ceil(repParts.length / 2)
  const repNombres = repParts.slice(0, repMid).join(' ')
  const repApellidos = repParts.length > 1 ? repParts.slice(repMid).join(' ') : ''

  await db.execute({
    sql: `DELETE FROM tokens_accion 
          WHERE tipo = 'preinscripcion' AND (lower(trim(email)) = lower(trim(?)) OR (json_extract(data_json, '$.cedula') = ? AND ? != ''))`,
    args: [email, cleanedCedulaRif, cleanedCedulaRif],
  })

  const dataJson = JSON.stringify({
    nombres: finalNombres || null,
    apellidos: finalApellidos || null,
    cedula: cleanedCedulaRif || null,
    telefono: telefono || null,
    programa_interes: programaCodigo,
    tipo_afiliado: tipoAfiliado || 'Natural',
    nivel_academico: nivelProfesional || null,
    profesion: profesion || null,
    es_corredor_inmobiliario: esCorredorInmobiliario === null ? null : (esCorredorInmobiliario === 'si' || esCorredorInmobiliario === true ? 1 : 0),
    razon_social: razonSocial ?? null,
    representante_legal_nombres: repNombres || null,
    representante_legal_apellidos: repApellidos || null,
    representante_legal_cedula: cleanedCedulaRep ?? null,
    representante_legal_email: emailRepresentante ?? null,
    empresa_telefono: empresaTelefono ?? null,
    id_empresa: id_empresa ?? null,
    aprobado_por_empresa: aprobadoPorEmpresa || false
  })

  await db.execute({
    sql: `INSERT INTO tokens_accion (token, tipo, email, data_json, usado, fecha_expiracion)
          VALUES (?, 'preinscripcion', ?, ?, 0, ?)`,
    args: [token, email, dataJson, fechaExpiracion],
  })

  return { token, fechaExpiracion }
}

/**
 * POST /api/public/preinscripciones
 * Preinscripción pública obligatoria para programas principales (PADI/PEGI/PREANI/CIBIR).
 * - Crea o actualiza el estudiante por email (upsert)
 * - Crea la inscripción con estatus 'Preinscrito' y tipo_inscripcion='programa'
 * - Si ya existe una preinscripción activa (no rechazada/cancelada), informa al usuario
 */
export const publicPreinscribirProgramaPrincipal = async (req: Request, res: Response): Promise<void> => {
  try {
    const programaCodigo = normalizeProgramaCodigo(req.body?.programaCodigo)
    const nombreCompleto = typeof req.body?.nombreCompleto === 'string' ? req.body.nombreCompleto.trim() : ''
    const cedulaRif = typeof req.body?.cedulaRif === 'string' ? req.body.cedulaRif.trim() : null
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : ''
    const telefono = typeof req.body?.telefono === 'string' ? req.body.telefono.trim() : null
    const empresaTelefono = typeof req.body?.empresaTelefono === 'string' ? req.body.empresaTelefono.trim() : null
    const profesion = typeof req.body?.profesion === 'string' ? req.body.profesion.trim() : null
    const url_titulo = typeof req.body?.url_titulo === 'string' ? req.body.url_titulo.trim() : null
    const url_cv = typeof req.body?.url_cv === 'string' ? req.body.url_cv.trim() : null
    const url_especializaciones = typeof req.body?.url_especializaciones === 'string' ? req.body.url_especializaciones.trim() : null
    const url_cursos_extras = typeof req.body?.url_cursos_extras === 'string' ? req.body.url_cursos_extras.trim() : null

    if (!programaCodigo) {
      res.status(400).json({ success: false, message: 'programaCodigo inválido. Use PADI/PEGI/PREANI/CIBIR/AFILIACION.' })
      return
    }
    if (!nombreCompleto || !email) {
      res.status(400).json({ success: false, message: 'nombreCompleto y email son requeridos' })
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ success: false, message: 'El formato del email no es válido' })
      return
    }

    // --- CONTROL DE ESTADO DE AFILIACIÓN ---
    if (programaCodigo === 'AFILIACION') {
      const activeAfiliado = await db.execute({
        sql: `SELECT a.estatus FROM afiliados a
              JOIN personas p ON a.id_persona = p.id
              WHERE p.email = ? OR (p.cedula = ? AND p.cedula IS NOT NULL) 
              LIMIT 1`,
        args: [email, cedulaRif],
      })

      if (activeAfiliado.rows.length > 0) {
        const row = activeAfiliado.rows[0] as any
        if (['1_PREINSCRIPCION', '2_EXPEDIENTE', '3_ENTREVISTA'].includes(row.estatus)) {
          res.status(409).json({
            success: false,
            message: 'Ya posees una solicitud de afiliación en proceso de revisión administrativa.'
          })
          return
        }
        if (row.estatus === 'Requiere Acción') {
          res.status(200).json({
            success: true,
            message: 'Ya posees una solicitud de afiliación activa que requiere correcciones. Por favor, revisa tu correo electrónico para encontrar el enlace de edición y completar tu registro.'
          })
          return
        }
        if (['Afiliado', 'CIBIR', 'Aprobado'].includes(row.estatus)) {
          res.status(409).json({
            success: false,
            message: 'Ya eres un miembro afiliado activo de la Cámara Inmobiliaria.'
          })
          return
        }
      }
    }

    // Si ya existe estudiante por email o cédula/RIF, lo buscamos para ver si ya tiene inscripción.
    const cleanCed = cedulaRif ? String(cedulaRif).replace(/\D/g, '') : '';
    const existingInscripcion = await db.execute({
      sql: `SELECT ic.id_inscripcion, ic.estatus, ic.estatus_academico 
            FROM inscripciones_cursos ic
            JOIN estudiantes e ON ic.id_estudiante = e.id_estudiante
            LEFT JOIN personas p ON e.id_persona = p.id
            LEFT JOIN empresas emp ON e.id_empresa = emp.id_empresa
            WHERE ic.programa_codigo = ? AND ic.id_curso IS NULL
              AND (
                p.email = ? OR emp.email = ? 
                OR (? != '' AND (p.cedula = ? OR emp.rif_numero = ?))
              )
            LIMIT 1`,
      args: [programaCodigo, email, email, cleanCed, cleanCed, cleanCed]
    })

    if (existingInscripcion.rows.length > 0) {
      const prev = existingInscripcion.rows[0] as any
      const isFinalState = prev.estatus === 'Rechazado' || 
                           prev.estatus === 'Cancelado' || 
                           ['Aprobado', 'Reprobado', 'Retirado'].includes(prev.estatus_academico);
      if (!isFinalState) {
        if (programaCodigo === 'AFILIACION') {
          if (prev.estatus === 'Preinscrito') {
            res.status(409).json({
              success: false,
              message: 'Ya posees una solicitud de afiliación en proceso de revisión administrativa.',
            })
            return
          }
          if (prev.estatus === 'Inscrito') {
            res.status(409).json({
              success: false,
              message: 'Ya eres un miembro afiliado activo de la Cámara Inmobiliaria.',
            })
            return
          }
          if (prev.estatus === 'Entrevista') {
            res.status(409).json({
              success: false,
              message: 'Tu solicitud de afiliación se encuentra actualmente en fase de entrevista.',
            })
            return
          }
          res.status(409).json({
            success: false,
            message: `Ya tienes una solicitud de afiliación en estado "${prev.estatus}".`,
          })
          return
        } else {
          if (prev.estatus === 'Preinscrito') {
            res.status(409).json({
              success: false,
              message: `Ya tienes una solicitud de preinscripción para el programa ${programaCodigo} en espera de revisión.`,
            })
            return
          }
          if (prev.estatus === 'Inscrito') {
            res.status(409).json({
              success: false,
              message: `Ya te encuentras oficialmente inscrito y admitido en el programa ${programaCodigo}.`,
            })
            return
          }
          if (prev.estatus === 'Entrevista') {
            res.status(409).json({
              success: false,
              message: `Tu postulación al programa ${programaCodigo} se encuentra en fase de entrevista.`,
            })
            return
          }
          res.status(409).json({
            success: false,
            message: `Ya tienes un registro para el programa ${programaCodigo} en estado "${prev.estatus}".`,
          })
          return
        }
      }
    }

    // --- RESTRICCIÓN DE CIBIR (SIN PREINSCRIPCIONES PENDIENTES) ---
    if (programaCodigo === 'CIBIR') {
      const pendingOther = await db.execute({
        sql: `SELECT ic.id_inscripcion, ic.programa_codigo, c.nombre as curso_nombre, ic.estatus 
              FROM inscripciones_cursos ic
              JOIN estudiantes e ON ic.id_estudiante = e.id_estudiante
              LEFT JOIN personas p ON e.id_persona = p.id
              LEFT JOIN empresas emp ON e.id_empresa = emp.id_empresa
              LEFT JOIN cursos c ON ic.id_curso = c.id_curso
              WHERE ic.estatus IN ('Preinscrito', 'Entrevista')
                AND (
                  p.email = ? OR emp.email = ? 
                  OR (? != '' AND (p.cedula = ? OR emp.rif_numero = ?))
                )
              LIMIT 1`,
        args: [email, email, cleanCed, cleanCed, cleanCed]
      })

      if (pendingOther.rows.length > 0) {
        const row = pendingOther.rows[0] as any
        const targetName = row.programa_codigo === 'AFILIACION'
          ? 'Afiliación'
          : (row.programa_codigo || row.curso_nombre || 'otro programa/curso');
        res.status(400).json({
          success: false,
          message: `No puedes preinscribirte al programa CIBIR porque tienes una solicitud de ${targetName} pendiente en estado "${row.estatus}". Por favor, espera a que finalice dicho proceso para postularte.`
        })
        return
      }
    }

    const rawTipoAfiliado = req.body?.tipoAfiliado
    const tipoAfiliado = programaCodigo === 'AFILIACION'
      ? (['Juridico', 'Corporativo'].includes(rawTipoAfiliado) ? 'Corporativo'
        : rawTipoAfiliado === 'Agente Corporativo' ? 'Agente Corporativo'
          : 'Natural')
      : null
    const isCorporativo = tipoAfiliado === 'Corporativo'
    const isAgenteCorporativo = tipoAfiliado === 'Agente Corporativo'

    // Campos para Natural / Agente Corporativo / todos los programas académicos
    const nivelProfesional = isCorporativo ? null : normalizeNivelProfesional(req.body?.nivelProfesional)
    const esCorredorInmobiliario = isCorporativo ? null : normalizeEsCorredorInmobiliario(req.body?.esCorredorInmobiliario)

    // Campos exclusivos para Corporativo
    const razonSocial = isCorporativo ? (typeof req.body?.razonSocial === 'string' ? req.body.razonSocial.trim() : null) : null
    const representanteLegal = isCorporativo ? (typeof req.body?.representanteLegal === 'string' ? req.body.representanteLegal.trim() : null) : null
    const cedulaRepresentante = isCorporativo ? (typeof req.body?.cedulaRepresentante === 'string' ? req.body.cedulaRepresentante.trim() : null) : null
    const emailRepresentante = isCorporativo ? (typeof req.body?.emailRepresentante === 'string' ? req.body.emailRepresentante.trim().toLowerCase() : null) : null

    // id_empresa para Agente Corporativo (debe ser empresa ya afiliada)
    let idEmpresaAgente: number | null = null
    if (isAgenteCorporativo) {
      const rawIdEmpresa = req.body?.id_empresa
      const parsedId = rawIdEmpresa ? parseInt(String(rawIdEmpresa), 10) : NaN
      if (!rawIdEmpresa || isNaN(parsedId)) {
        res.status(400).json({ success: false, message: 'Para afiliación como Agente Corporativo debes seleccionar la empresa a la que perteneces.' })
        return
      }
      // Verificar que la empresa exista y esté activa
      const empCheck = await db.execute({
        sql: `SELECT id_empresa FROM empresas WHERE id_empresa = ? LIMIT 1`,
        args: [parsedId]
      })
      if (empCheck.rows.length === 0) {
        res.status(400).json({ success: false, message: 'La empresa seleccionada no se encontró en nuestros registros.' })
        return
      }
      idEmpresaAgente = parsedId
    }

    // Validaciones específicas por tipo
    if (isCorporativo && (!razonSocial || !representanteLegal || !cedulaRepresentante || !emailRepresentante)) {
      res.status(400).json({ success: false, message: 'Para afiliación corporativa se requiere Razón Social, Representante Legal, su Cédula y su Correo.' })
      return
    }

    const nombreParts = nombreCompleto.trim().split(' ')
    const mid = Math.ceil(nombreParts.length / 2)
    const nombres = isCorporativo ? null : nombreParts.slice(0, mid).join(' ')
    const apellidos = isCorporativo ? null : (nombreParts.length > 1 ? nombreParts.slice(mid).join(' ') : '')

    const { token } = await crearVerificacionPreinscripcionPrograma({
      nombreCompleto,
      nombres,
      apellidos,
      cedulaRif,
      email,
      telefono,
      programaCodigo,
      tipoAfiliado,
      nivelProfesional,
      profesion,
      esCorredorInmobiliario,
      razonSocial,
      representanteLegal,
      cedulaRepresentante,
      emailRepresentante,
      empresaTelefono,
      id_empresa: idEmpresaAgente,
    })

    if (env.NODE_ENV !== 'development') {
      await enviarCorreoConfirmacionPreinscripcionPrograma({
        nombre: nombreCompleto,
        emailOriginal: email,
        programaCodigo,
        token,
      })
    }

    res.status(201).json({
      success: true,
      message: env.NODE_ENV === 'development' 
        ? 'Modo desarrollo: Redirigiendo automáticamente...' 
        : 'Te enviamos un correo para confirmar tu preinscripción. Revisa tu bandeja de entrada o SPAM.',
      data: { token }
    })
  } catch (error) {
    console.error('publicPreinscribirProgramaPrincipal:', error)
    res.status(500).json({ success: false, message: 'Error al procesar la preinscripción' })
  }
}

const checkValidAffiliate = async (nombreRef: string): Promise<boolean> => {
  const rawNombre = nombreRef.trim()
  if (!rawNombre) return false

  // 1. Intentar extraer cédula/RIF y nombre limpio
  let docMatch = rawNombre.match(/(?:C\.I\.\s*\/)?\s*(?:RIF|C\.I\.):\s*([A-Z0-9-]{5,15})/i)
  if (!docMatch) {
    docMatch = rawNombre.match(/\b([VJEG]-[0-9]{5,10}-[0-9]|[VJEG][0-9]{5,10})\b/i)
  }
  if (!docMatch) {
    docMatch = rawNombre.match(/\b([0-9]{6,10})\b/)
  }
  const extractedDoc = docMatch ? docMatch[1].trim() : null

  // Nombre limpio (quitando los paréntesis y el RIF)
  let nombreLimpio = rawNombre
  const parenIndex = rawNombre.indexOf('(')
  if (parenIndex !== -1) {
    nombreLimpio = rawNombre.substring(0, parenIndex).trim()
  }

  const nameSearch = `%${nombreLimpio}%`

  if (extractedDoc) {
    const cleanDoc = extractedDoc.replace(/[^a-zA-Z0-9]/g, '')
    const docSearchLike = `%${cleanDoc}%`
    const res = await db.execute({
      sql: `
        SELECT a.id_afiliado 
        FROM afiliados a
        JOIN personas p ON a.id_persona = p.id
        LEFT JOIN empresas e ON a.id_empresa = e.id_empresa
        WHERE a.estatus = 'Afiliado' AND a.activo = 1 AND a.eliminado_en IS NULL
          AND (
            p.cedula = ?
            OR e.rif_numero = ?
            OR REPLACE(REPLACE(p.cedula, '-', ''), ' ', '') LIKE ?
            OR REPLACE(REPLACE(e.rif_numero, '-', ''), ' ', '') LIKE ?
            OR (COALESCE(p.nombres, '') || ' ' || COALESCE(p.apellidos, '') LIKE ?)
            OR (e.razon_social LIKE ?)
          )
        LIMIT 1
      `,
      args: [extractedDoc, extractedDoc, docSearchLike, docSearchLike, nameSearch, nameSearch]
    })
    return res.rows.length > 0
  } else {
    const res = await db.execute({
      sql: `
        SELECT a.id_afiliado 
        FROM afiliados a
        JOIN personas p ON a.id_persona = p.id
        LEFT JOIN empresas e ON a.id_empresa = e.id_empresa
        WHERE a.estatus = 'Afiliado' AND a.activo = 1 AND a.eliminado_en IS NULL
          AND (
            (COALESCE(p.nombres, '') || ' ' || COALESCE(p.apellidos, '') LIKE ?)
            OR (e.razon_social LIKE ?)
          )
        LIMIT 1
      `,
      args: [nameSearch, nameSearch]
    })
    return res.rows.length > 0
  }
}

/**
 * POST /api/public/preinscripciones/confirmar
 * Confirma el email y crea la preinscripción real en `inscripciones_cursos`.
 */
export const publicConfirmarPreinscripcionPrograma = async (req: Request, res: Response): Promise<void> => {
  try {
    let token = typeof req.body?.token === 'string' ? req.body.token.trim() : ''
    if (!token) {
      token = getCookie(req, 'auth_expediente') ?? ''
    }
    if (!token) {
      res.status(400).json({ success: false, message: 'Token es requerido o sesión expirada' })
      return
    }

    const ver = await db.execute({
      sql: `SELECT token, email, data_json, fecha_expiracion FROM tokens_accion WHERE token = ? AND tipo = 'preinscripcion' AND usado = 0 LIMIT 1`,
      args: [token],
    })
    if (ver.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Token inválido o no encontrado' })
      return
    }

    const tokenRow = ver.rows[0] as any
    const registro = JSON.parse(tokenRow.data_json || '{}')
    registro.email = tokenRow.email
    registro.fecha_expiracion = tokenRow.fecha_expiracion

    const programaCodigo = normalizeProgramaCodigo(registro.programa_interes)

    // Validar referencias del afiliado si vienen en el body (solo para AFILIACION)
    if (programaCodigo === 'AFILIACION') {
      const ref1Url = typeof req.body?.url_referencia1 === 'string' ? req.body.url_referencia1.trim() : ''
      const ref1Nombre = typeof req.body?.nombre_referencia1 === 'string' ? req.body.nombre_referencia1.trim() : ''
      const ref2Url = typeof req.body?.url_referencia2 === 'string' ? req.body.url_referencia2.trim() : ''
      const ref2Nombre = typeof req.body?.nombre_referencia2 === 'string' ? req.body.nombre_referencia2.trim() : ''

      if (ref1Url) {
        const isValid = await checkValidAffiliate(ref1Nombre)
        if (!isValid) {
          res.status(400).json({ success: false, message: 'La primera referencia no corresponde a un afiliado activo válido.' })
          return
        }
      }

      if (ref2Url) {
        const isValid = await checkValidAffiliate(ref2Nombre)
        if (!isValid) {
          res.status(400).json({ success: false, message: 'La segunda referencia no corresponde a un afiliado activo válido.' })
          return
        }
      }
    }

    const email = String(registro.email ?? '').trim().toLowerCase()

    const nombres = String(registro.nombres ?? '').trim()
    const apellidos = String(registro.apellidos ?? '').trim()
    const nombrePersona = `${nombres} ${apellidos}`.trim()
    const repNombreFull = `${registro.representante_legal_nombres || ''} ${registro.representante_legal_apellidos || ''}`.trim()
    const nombreCompleto = registro.razon_social || nombrePersona || repNombreFull || 'Aspirante'

    const cedulaRif = registro.cedula ? String(registro.cedula).trim() : null
    const telefono = registro.telefono ? String(registro.telefono).trim() : null
    const empresaTelefono = registro.empresa_telefono ? String(registro.empresa_telefono).trim() : null
    const nivelProfesional = normalizeNivelProfesional(registro.nivel_academico)
    const esCorredorInmobiliario = normalizeEsCorredorInmobiliario(registro.es_corredor_inmobiliario)
    const isAfiliacion = programaCodigo === 'AFILIACION'
    const isCorporativo = isAfiliacion && ['Juridico', 'Corporativo'].includes(registro.tipo_afiliado)
    const isAgenteCorporativo = isAfiliacion && registro.tipo_afiliado === 'Agente Corporativo'

    const optarAcreditacion = req.body?.optarAcreditacion === true || req.body?.optarAcreditacion === 'true' || req.body?.optarAcreditacion === 1 || req.body?.optarAcreditacion === '1' ? 1 : 0
    const fechaNacimiento = typeof req.body?.fecha_nacimiento === 'string' ? req.body.fecha_nacimiento.trim() : null

    if (!programaCodigo || !email || !nombreCompleto) {
      res.status(400).json({ success: false, message: 'Registro de verificación incompleto' })
      return
    }

    // Para AFILIACION, nivelProfesional y esCorredorInmobiliario son opcionales
    if (!isAfiliacion && (esCorredorInmobiliario === null)) {
      res.status(400).json({ success: false, message: 'Registro de verificación incompleto' })
      return
    }

    // --- VALIDACIÓN DE DOCUMENTOS OBLIGATORIOS EN EL BACKEND ---
    const mainPrograms = ['AFILIACION', 'CIBIR', 'PREANI', 'PEGI', 'PADI']
    if (mainPrograms.includes(programaCodigo)) {
      const urlCv = typeof req.body?.url_cv === 'string' ? req.body.url_cv.trim() : ''
      if (!urlCv) {
        res.status(400).json({ success: false, message: 'El Currículum/Síntesis Curricular es obligatorio para continuar con el expediente.' })
        return
      }

      if (!fechaNacimiento) {
        res.status(400).json({ success: false, message: 'La Fecha de Nacimiento es obligatoria para continuar con el expediente.' })
        return
      }

      if (isCorporativo) {
        const urlRif = typeof req.body?.url_titulo === 'string' ? req.body.url_titulo.trim() : ''
        const urlReg = typeof req.body?.url_registro_mercantil === 'string' ? req.body.url_registro_mercantil.trim() : ''
        const urlRep = typeof req.body?.url_titulo_representante === 'string' ? req.body.url_titulo_representante.trim() : ''

        if (!urlRif) {
          res.status(400).json({ success: false, message: 'El RIF de la Empresa es obligatorio.' })
          return
        }
        if (!urlReg) {
          res.status(400).json({ success: false, message: 'El Acta Constitutiva/Registro Mercantil es obligatorio.' })
          return
        }
        const nivel = req.body?.nivelProfesional ? normalizeNivelProfesional(req.body.nivelProfesional) : nivelProfesional;
        if (nivel !== 'Bachiller' && !urlRep) {
          res.status(400).json({ success: false, message: 'El Título Académico del Representante Legal es obligatorio.' })
          return
        }
      } else {
        const nivel = req.body?.nivelProfesional ? normalizeNivelProfesional(req.body.nivelProfesional) : nivelProfesional
        const urlTitulo = typeof req.body?.url_titulo === 'string' ? req.body.url_titulo.trim() : ''
        if (nivel !== 'Bachiller' && !urlTitulo) {
          res.status(400).json({ success: false, message: 'El Título Académico es obligatorio para los niveles profesionales declarados.' })
          return
        }
      }
    }

    // El estudiante debe ser registrado con la información del solicitante principal (la empresa si razonSocial existe, o la persona natural)
    const finalEmail = email
    const finalNombre = nombreCompleto
    const finalCedula = cedulaRif
    const finalTipo = isAfiliacion ? (isCorporativo ? 'Corporativo' : 'Afiliado') : 'Regular'

    const anoInicioServicio = req.body?.ano_inicio_servicio !== undefined ? Number(req.body.ano_inicio_servicio) : null
    const website = typeof req.body?.website === 'string' ? req.body.website.trim() : null
    const descripcion = typeof req.body?.descripcion === 'string' ? req.body.descripcion.trim() : null

    const { id_estudiante } = await upsertEstudianteByEmail({
      nombreCompleto: finalNombre,
      nombres: isCorporativo ? null : registro.nombres,
      apellidos: isCorporativo ? null : registro.apellidos,
      razonSocial: isCorporativo ? registro.razon_social : null,
      cedulaRif: finalCedula,
      email: finalEmail,
      telefono: isCorporativo ? empresaTelefono : telefono,
      tipo: finalTipo,
      nivelProfesional: req.body?.nivelProfesional ? normalizeNivelProfesional(req.body.nivelProfesional) : nivelProfesional,
      profesion: typeof req.body?.profesion === 'string' ? req.body.profesion.trim() : (registro.profesion || null),
      esCorredorInmobiliario: req.body?.esCorredorInmobiliario !== undefined ? normalizeEsCorredorInmobiliario(req.body.esCorredorInmobiliario) : esCorredorInmobiliario,
      anoInicioServicio,
      website,
      descripcion
    })

    // Nota: para Agente Corporativo, la vinculación a la empresa se hace en la tabla
    // afiliados (no en estudiantes), ya que chk_tipo_estudiante impide tener
    // id_persona e id_empresa simultáneamente en el mismo registro.

    // Si es corporativo, crear el representante y vincularlo a la empresa
    if (isCorporativo) {
      const est = await db.execute({
        sql: `SELECT id_empresa FROM estudiantes WHERE id_estudiante = ?`,
        args: [id_estudiante]
      })
      const idEmpresa = est.rows[0]?.id_empresa as number | null

      if (idEmpresa) {
        let idRepPersona: number | null = null
        if (registro.representante_legal_email) {
          const resP = await db.execute({
            sql: `SELECT id FROM personas WHERE email = ? LIMIT 1`,
            args: [registro.representante_legal_email]
          })
          if (resP.rows.length > 0) {
            idRepPersona = resP.rows[0].id as number
          }
        }

        if (!idRepPersona) {
          const cedulaRepInput = String(registro.representante_legal_cedula || `TEMP-V-${Date.now()}`).trim();
          const cedulaRepMatch = cedulaRepInput.match(/^([VEP])?-?(.+)$/i);
          const cedulaRepTipo = cedulaRepMatch && cedulaRepMatch[1] ? cedulaRepMatch[1].toUpperCase() : 'V';
          const cedulaRepNumero = cedulaRepMatch ? cedulaRepMatch[2].replace(/\D/g, '') : cedulaRepInput.replace(/\D/g, '');

          const insP = await db.execute({
            sql: `INSERT INTO personas (nombres, apellidos, cedula_tipo, cedula, email, telefono) VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
            args: [
              registro.representante_legal_nombres || '',
              registro.representante_legal_apellidos || '',
              cedulaRepTipo,
              cedulaRepNumero,
              registro.representante_legal_email || null,
              registro.telefono || null
            ]
          })
          idRepPersona = insP.rows[0].id as number
        }

        let idRepAfiliado: number | null = null
        const resA = await db.execute({
          sql: `SELECT id_afiliado FROM afiliados WHERE id_persona = ? LIMIT 1`,
          args: [idRepPersona]
        })
        if (resA.rows.length > 0) {
          idRepAfiliado = resA.rows[0].id_afiliado as number
        } else {
          const insA = await db.execute({
            sql: `INSERT INTO afiliados (id_persona, tipo_afiliado, id_empresa) VALUES (?, 'Corporativo', ?) RETURNING id_afiliado`,
            args: [idRepPersona, idEmpresa]
          })
          idRepAfiliado = insA.rows[0].id_afiliado as number
        }

        await db.execute({
          sql: `UPDATE empresas SET id_representante_legal = ? WHERE id_empresa = ?`,
          args: [idRepAfiliado, idEmpresa]
        })
      }
    }

    // Si ya existe preinscripción/inscripción, marcar como éxito idempotente.
    const cleanCed = cedulaRif ? String(cedulaRif).replace(/\D/g, '') : '';
    const existing = await db.execute({
      sql: `SELECT ic.id_inscripcion, ic.estatus, ic.estatus_academico 
            FROM inscripciones_cursos ic
            JOIN estudiantes e ON ic.id_estudiante = e.id_estudiante
            LEFT JOIN personas p ON e.id_persona = p.id
            LEFT JOIN empresas emp ON e.id_empresa = emp.id_empresa
            WHERE ic.programa_codigo = ? AND ic.id_curso IS NULL
              AND (
                p.email = ? OR emp.email = ? 
                OR (? != '' AND (p.cedula = ? OR emp.rif_numero = ?))
              )
            LIMIT 1`,
      args: [programaCodigo, email, email, cleanCed, cleanCed, cleanCed],
    })
    if (existing.rows.length > 0) {
      const prev = existing.rows[0] as any
      const isFinalState = prev.estatus === 'Rechazado' || 
                           prev.estatus === 'Cancelado' || 
                           ['Aprobado', 'Reprobado', 'Retirado'].includes(prev.estatus_academico);
      if (!isFinalState) {
        await db.execute({
          sql: `UPDATE tokens_accion SET usado = 1 WHERE token = ? AND tipo = 'preinscripcion'`,
          args: [token],
        })
        res.clearCookie('auth_expediente', {
          httpOnly: true,
          secure: env.NODE_ENV === 'production',
          sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
          path: '/'
        })
        res.status(200).json({
          success: true,
          message: 'Tu preinscripción ya había sido confirmada previamente.',
          data: existing.rows[0],
        })
        return
      }
    }

    const now = new Date().toISOString()
    const result = await db.execute({
      sql: `INSERT INTO inscripciones_cursos
              (id_estudiante, id_curso, programa_codigo, tipo_inscripcion, estatus, creado_en, actualizado_en, id_empresa)
            VALUES (?, NULL, ?, 'programa', 'Preinscrito', ?, ?, ?)
            ON CONFLICT DO UPDATE SET
              estatus = 'Preinscrito',
              estatus_academico = 'Inscrito',
              completado = 0,
              tipo_inscripcion = 'programa',
              actualizado_en = excluded.actualizado_en,
              id_empresa = excluded.id_empresa
            RETURNING *`,
      args: [id_estudiante, programaCodigo, now, now, registro.id_empresa || null],
    })

    await db.execute({
      sql: `UPDATE tokens_accion SET usado = 1 WHERE token = ? AND tipo = 'preinscripcion'`,
      args: [token],
    })

    // Acceso al portal (Usuario + Token) y correo de bienvenida se crean únicamente tras la aprobación administrativa.

    // Guardar documentos en documentos
    const docsToInsert: { tipo: string; url: string; nombre?: string; fecha?: string }[] = []
    try {


      if (typeof req.body?.url_titulo === 'string' && req.body.url_titulo) {
        docsToInsert.push({ tipo: isCorporativo ? 'rif_empresa' : 'titulo', url: req.body.url_titulo })
      }
      if (typeof req.body?.url_cv === 'string' && req.body.url_cv) {
        docsToInsert.push({ tipo: 'cv', url: req.body.url_cv })
      }
      if (typeof req.body?.url_registro_mercantil === 'string' && req.body.url_registro_mercantil) {
        docsToInsert.push({ tipo: 'registro_mercantil', url: req.body.url_registro_mercantil })
      }
      if (typeof req.body?.url_titulo_representante === 'string' && req.body.url_titulo_representante) {
        docsToInsert.push({ tipo: 'titulo_representante', url: req.body.url_titulo_representante })
      }
      if (typeof req.body?.url_referencia1 === 'string' && req.body.url_referencia1) {
        docsToInsert.push({ tipo: 'referencia_afiliado_1', url: req.body.url_referencia1, nombre: req.body.nombre_referencia1 || '' })
      }
      if (typeof req.body?.url_referencia2 === 'string' && req.body.url_referencia2) {
        docsToInsert.push({ tipo: 'referencia_afiliado_2', url: req.body.url_referencia2, nombre: req.body.nombre_referencia2 || '' })
      }

      const especializacionesRaw = req.body?.especializaciones
      if (especializacionesRaw) {
        try {
          const list: { nombre?: string; url: string; fecha?: string }[] = JSON.parse(especializacionesRaw)
          list.forEach(item => {
            if (item.url) docsToInsert.push({ tipo: 'especializacion', url: item.url, nombre: item.nombre, fecha: item.fecha })
          })
        } catch (e) { console.error('Error parsing especializaciones:', e) }
      }

      const cursosExtrasRaw = req.body?.cursos_extras
      if (cursosExtrasRaw) {
        try {
          const list: { nombre?: string; url: string; fecha?: string }[] = JSON.parse(cursosExtrasRaw)
          list.forEach(c => { if (c.url) docsToInsert.push({ tipo: 'curso_extra', url: c.url, nombre: c.nombre, fecha: c.fecha }) })
        } catch (e) { console.error('Error parsing cursos_extras:', e) }
      }

      const diplomadosRaw = req.body?.diplomados
      if (diplomadosRaw) {
        try {
          const list: { nombre?: string; url: string; fecha?: string }[] = JSON.parse(diplomadosRaw)
          list.forEach(d => { if (d.url) docsToInsert.push({ tipo: 'diplomado', url: d.url, nombre: d.nombre, fecha: d.fecha }) })
        } catch (e) { console.error('Error parsing diplomados:', e) }
      }

      const otrosDocsRaw = req.body?.otros_docs
      if (otrosDocsRaw) {
        try {
          const list: { nombre?: string; url: string; fecha?: string }[] = JSON.parse(otrosDocsRaw)
          list.forEach(o => { if (o.url) docsToInsert.push({ tipo: 'otro_documento', url: o.url, nombre: o.nombre, fecha: o.fecha }) })
        } catch (e) { console.error('Error parsing otros_docs:', e) }
      }

      if (docsToInsert.length > 0) {
        const tipos = [
          'titulo', 'cv', 'especializacion', 'curso_extra', 'registro_mercantil',
          'titulo_representante', 'referencia_afiliado_1', 'referencia_afiliado_2',
          'diplomado', 'otro_documento'
        ]
        await db.execute({
          sql: `DELETE FROM documentos 
                WHERE entidad_tipo = 'estudiante' AND entidad_id = ? 
                AND tipo_archivo IN (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [id_estudiante, ...tipos]
        })

        for (const doc of docsToInsert) {
          // Obtener un nombre por defecto amigable según el tipo de documento
          let defaultName = 'Documento Adjunto'
          if (doc.tipo === 'cv') defaultName = 'Currículum Vitae'
          else if (doc.tipo === 'titulo') defaultName = 'Título Académico'
          else if (doc.tipo === 'registro_mercantil') defaultName = 'Registro Mercantil / RIF'
          else if (doc.tipo === 'titulo_representante') defaultName = 'Título Académico del Representante'
          else if (doc.tipo === 'referencia_afiliado_1') defaultName = `Referencia Gremial 1 - ${doc.nombre || ''}`.trim()
          else if (doc.tipo === 'referencia_afiliado_2') defaultName = `Referencia Gremial 2 - ${doc.nombre || ''}`.trim()
          else if (doc.nombre) defaultName = doc.nombre

          await db.execute({
            sql: `INSERT INTO documentos (entidad_tipo, entidad_id, tipo_archivo, url, nombre_archivo, fecha_subida)
                  VALUES ('estudiante', ?, ?, ?, ?, ?)`,
            args: [
              id_estudiante, 
              doc.tipo, 
              doc.url, 
              doc.nombre?.trim() || defaultName, 
              doc.fecha || now
            ]
          })
        }
      }
    } catch (err) {
      console.error('Error guardando documentos adjuntos:', err)
    }

    // ── PUENTE HACIA AFILIADOS (solo para AFILIACION) ────────────────────
    // Al confirmar el formulario, el aspirante queda inmediatamente registrado
    // en la tabla de afiliados con estatus 2_EXPEDIENTE (documentos recibidos).
    if (isAfiliacion) {
      try {
        const tipoAfiliado = String(registro.tipo_afiliado || 'Natural')
        const isCorporativoReg = ['Juridico', 'Corporativo'].includes(tipoAfiliado)
        const isAgenteCorporativoReg = tipoAfiliado === 'Agente Corporativo'
        const nivelAcademico = req.body?.nivelProfesional
          ? normalizeNivelProfesional(req.body.nivelProfesional)
          : normalizeNivelProfesional(registro.nivel_profesional)

        if (isCorporativoReg) {
          // 1. Crear/Upsert EMPRESA
          const resE = await db.execute({
            sql: `INSERT INTO empresas (razon_social, rif_numero, email, telefono, actualizado_en)
                  VALUES (?, ?, ?, ?, ?)
                  ON CONFLICT(email) DO UPDATE SET
                    razon_social = excluded.razon_social,
                    rif_numero = excluded.rif_numero,
                    telefono = excluded.telefono,
                    actualizado_en = excluded.actualizado_en
                  RETURNING id_empresa`,
            args: [
              String(registro.razon_social || registro.nombres || ''),
              String(registro.rif_numero || registro.cedula || `TEMP-J-${Date.now()}`),
              String(registro.email || '').trim().toLowerCase(),
              registro.telefono || telefono,
              now
            ]
          })
          const idEmpresa = resE.rows[0].id_empresa as number

          // 2. Crear/Upsert PERSONA (Representante)
          const repNombres = String(registro.representante_legal_nombres || '').trim()
          const repApellidos = String(registro.representante_legal_apellidos || '').trim()
          const repEmail = String(registro.representante_legal_email || '').trim().toLowerCase() || `rep-${idEmpresa}@placeholder.com`
          
          const repCedulaInput = String(registro.representante_legal_cedula || '').trim() || `TEMP-R-${idEmpresa}`
          const repCedulaMatch = repCedulaInput.match(/^([VEP])?-?(.+)$/i)
          const repCedulaTipo = repCedulaMatch && repCedulaMatch[1] ? repCedulaMatch[1].toUpperCase() : 'V'
          const repCedulaNumero = repCedulaMatch ? repCedulaMatch[2].replace(/\D/g, '') : repCedulaInput.replace(/\D/g, '')

          const resP = await db.execute({
            sql: `INSERT INTO personas (nombres, apellidos, cedula_tipo, cedula, email, telefono, nivel_academico, fecha_nacimiento, actualizado_en)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                  ON CONFLICT(email) DO UPDATE SET
                    nombres = excluded.nombres,
                    apellidos = excluded.apellidos,
                    cedula_tipo = excluded.cedula_tipo,
                    cedula = excluded.cedula,
                    telefono = COALESCE(excluded.telefono, personas.telefono),
                    nivel_academico = COALESCE(excluded.nivel_academico, personas.nivel_academico),
                    fecha_nacimiento = COALESCE(excluded.fecha_nacimiento, personas.fecha_nacimiento),
                    actualizado_en = excluded.actualizado_en
                  RETURNING id`,
            args: [repNombres, repApellidos, repCedulaTipo, repCedulaNumero, repEmail, registro.telefono || null, nivelAcademico, fechaNacimiento, now]
          })
          const idPersona = resP.rows[0].id as number

          // 3. Crear/Upsert AFILIADO
          const resA = await db.execute({
            sql: `INSERT INTO afiliados (id_persona, id_empresa, tipo_afiliado, estatus, ano_inicio_servicio, optar_acreditacion, actualizado_en)
                  VALUES (?, ?, 'Corporativo', '2_EXPEDIENTE', ?, ?, ?)
                  ON CONFLICT(id_persona) DO UPDATE SET
                    id_empresa = excluded.id_empresa,
                    tipo_afiliado = 'Corporativo',
                    estatus = CASE WHEN afiliados.estatus IN ('Afiliado', 'Aprobado', 'CIBIR') THEN afiliados.estatus ELSE '2_EXPEDIENTE' END,
                    ano_inicio_servicio = COALESCE(excluded.ano_inicio_servicio, afiliados.ano_inicio_servicio),
                    optar_acreditacion = excluded.optar_acreditacion,
                    actualizado_en = excluded.actualizado_en
                  RETURNING id_afiliado`,
            args: [idPersona, idEmpresa, anoInicioServicio, optarAcreditacion, now]
          })
          const idAfiliado = resA.rows[0].id_afiliado as number

          // Vincular el id_representante_legal a la empresa
          await db.execute({
            sql: `UPDATE empresas SET id_representante_legal = ? WHERE id_empresa = ?`,
            args: [idAfiliado, idEmpresa]
          })

          // Vincular el id_empresa al estudiante
          await db.execute({
            sql: `UPDATE estudiantes SET id_empresa = ? WHERE id_estudiante = ?`,
            args: [idEmpresa, id_estudiante]
          })

        } else if (isAgenteCorporativoReg) {
          // AFILIACION AGENTE CORPORATIVO
          // Igual que Natural pero vinculado a una empresa existente (id_empresa del registro de verificación)
          const empresaId = registro.id_empresa as number | null

          const acCedulaInput = String(registro.cedula || `TEMP-V-${Date.now()}`).trim();
          const acCedulaMatch = acCedulaInput.match(/^([VEP])?-?(.+)$/i);
          const acCedulaTipo = acCedulaMatch && acCedulaMatch[1] ? acCedulaMatch[1].toUpperCase() : 'V';
          const acCedulaNumero = acCedulaMatch ? acCedulaMatch[2].replace(/\D/g, '') : acCedulaInput.replace(/\D/g, '');

          // 1. Upsert Persona
          const resP = await db.execute({
            sql: `INSERT INTO personas (nombres, apellidos, cedula_tipo, cedula, email, telefono, nivel_academico, fecha_nacimiento, actualizado_en)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                  ON CONFLICT(email) DO UPDATE SET
                    nombres = excluded.nombres,
                    apellidos = excluded.apellidos,
                    cedula_tipo = excluded.cedula_tipo,
                    cedula = excluded.cedula,
                    telefono = excluded.telefono,
                    nivel_academico = COALESCE(excluded.nivel_academico, personas.nivel_academico),
                    fecha_nacimiento = COALESCE(excluded.fecha_nacimiento, personas.fecha_nacimiento),
                    actualizado_en = excluded.actualizado_en
                  RETURNING id`,
            args: [
              registro.nombres || '',
              registro.apellidos || '',
              acCedulaTipo,
              acCedulaNumero,
              registro.email,
              registro.telefono || telefono,
              nivelAcademico,
              fechaNacimiento,
              now
            ]
          })
          const idPersonaAC = resP.rows[0].id as number

          // 2. Upsert Afiliado con tipo 'Agente Corporativo' y la empresa vinculada
          const aprobadoPorEmpresa = !!registro.aprobado_por_empresa;
          const initialEstatus = aprobadoPorEmpresa ? '2_EXPEDIENTE' : '1_PREINSCRIPCION';

          const resA = await db.execute({
            sql: `INSERT INTO afiliados (id_persona, id_empresa, tipo_afiliado, estatus, ano_inicio_servicio, optar_acreditacion, actualizado_en, fecha_ultimo_cambio_estatus)
                  VALUES (?, ?, 'Agente Corporativo', ?, ?, ?, ?, ?)
                  ON CONFLICT(id_persona) DO UPDATE SET
                    id_empresa = COALESCE(excluded.id_empresa, afiliados.id_empresa),
                    tipo_afiliado = 'Agente Corporativo',
                    estatus = CASE WHEN afiliados.estatus = 'Requiere Acción' THEN afiliados.estatus ELSE excluded.estatus END,
                    ano_inicio_servicio = COALESCE(excluded.ano_inicio_servicio, afiliados.ano_inicio_servicio),
                    optar_acreditacion = excluded.optar_acreditacion,
                    actualizado_en = excluded.actualizado_en,
                    fecha_ultimo_cambio_estatus = COALESCE(excluded.fecha_ultimo_cambio_estatus, afiliados.fecha_ultimo_cambio_estatus)
                  RETURNING id_afiliado`,
            args: [idPersonaAC, empresaId, initialEstatus, anoInicioServicio, optarAcreditacion, now, now]
          })
          const idAfiliadoAC = resA.rows[0].id_afiliado as number

          // Vincular id_persona al estudiante (la empresa se guarda en afiliados, no en estudiantes)
          await db.execute({
            sql: `UPDATE estudiantes SET id_persona = ? WHERE id_estudiante = ?`,
            args: [idPersonaAC, id_estudiante]
          })

        } else {
          // AFILIACION NATURAL
          const natCedulaInput = String(registro.cedula || `TEMP-V-${Date.now()}`).trim();
          const natCedulaMatch = natCedulaInput.match(/^([VEP])?-?(.+)$/i);
          const natCedulaTipo = natCedulaMatch && natCedulaMatch[1] ? natCedulaMatch[1].toUpperCase() : 'V';
          const natCedulaNumero = natCedulaMatch ? natCedulaMatch[2].replace(/\D/g, '') : natCedulaInput.replace(/\D/g, '');

          // 1. Upsert Persona
          const resP = await db.execute({
            sql: `INSERT INTO personas (nombres, apellidos, cedula_tipo, cedula, email, telefono, nivel_academico, fecha_nacimiento, actualizado_en)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                  ON CONFLICT(email) DO UPDATE SET
                    nombres = excluded.nombres,
                    apellidos = excluded.apellidos,
                    cedula_tipo = excluded.cedula_tipo,
                    cedula = excluded.cedula,
                    telefono = excluded.telefono,
                    nivel_academico = COALESCE(excluded.nivel_academico, personas.nivel_academico),
                    fecha_nacimiento = COALESCE(excluded.fecha_nacimiento, personas.fecha_nacimiento),
                    actualizado_en = excluded.actualizado_en
                  RETURNING id`,
            args: [
              registro.nombres || '',
              registro.apellidos || '',
              natCedulaTipo,
              natCedulaNumero,
              registro.email,
              registro.telefono || telefono,
              nivelAcademico,
              fechaNacimiento,
              now
            ]
          })
          const idPersona = resP.rows[0].id as number

          // 2. Upsert Afiliado
          const resA = await db.execute({
            sql: `INSERT INTO afiliados (id_persona, id_empresa, tipo_afiliado, estatus, ano_inicio_servicio, optar_acreditacion, actualizado_en)
                  VALUES (?, NULL, 'Natural', '2_EXPEDIENTE', ?, ?, ?)
                  ON CONFLICT(id_persona) DO UPDATE SET
                    id_empresa = NULL,
                    estatus = CASE WHEN afiliados.estatus IN ('Afiliado', 'Aprobado', 'CIBIR') THEN afiliados.estatus ELSE '2_EXPEDIENTE' END,
                    ano_inicio_servicio = COALESCE(excluded.ano_inicio_servicio, afiliados.ano_inicio_servicio),
                    optar_acreditacion = excluded.optar_acreditacion,
                    actualizado_en = excluded.actualizado_en
                  RETURNING id_afiliado`,
            args: [idPersona, anoInicioServicio, optarAcreditacion, now]
          })
          const idAfiliado = resA.rows[0].id_afiliado as number

          // Vincular el id_persona al estudiante
          await db.execute({
            sql: `UPDATE estudiantes SET id_persona = ? WHERE id_estudiante = ?`,
            args: [idPersona, id_estudiante]
          })
        }
      } catch (err) {
        console.error('Error creando afiliado desde preinscripción AFILIACION:', err)
      }
    }

    // Notificar al admin (Deshabilitado para AFILIACION temporalmente por solicitud del usuario)
    if (programaCodigo !== 'AFILIACION') {
      notificarAdminNuevaPreinscripcion({
        idInscripcion: Number(result.rows[0].id_inscripcion),
        nombre: nombreCompleto,
        email: email,
        programaCodigo: programaCodigo,
        cedulaRif: cedulaRif,
        telefono: telefono
      }).catch(e => console.error('Error notificando admin (programa):', e))
    }

    NotificationService.notifyAdmins({
      title: `Expediente Recibido: ${programaCodigo}`,
      message: `El aspirante ${nombreCompleto} (${email}) ha enviado su expediente para ${programaCodigo}.`,
      type: 'PREINSCRIPCION',
      priority: 'NORMAL',
      data: {
        idInscripcion: Number(result.rows[0].id_inscripcion),
        nombre: nombreCompleto,
        email: email,
        programaCodigo: programaCodigo,
        cedulaRif: cedulaRif,
        telefono: telefono
      }
    }).catch(e => console.error('Error enviando notificación In-App a admins (programa):', e))

    res.clearCookie('auth_expediente', {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/'
    })

    res.status(201).json({
      success: true,
      message: programaCodigo === 'AFILIACION'
        ? 'Correo confirmado. Tu solicitud de afiliación está siendo revisada por la administración. Pronto nos pondremos en contacto contigo.'
        : 'Preinscripción confirmada correctamente. La coordinación de formación revisará tu expediente.',
      data: {
        ...result.rows[0],
        programa_codigo: programaCodigo
      },
    })
  } catch (error) {
    console.error('publicConfirmarPreinscripcionPrograma:', error)
    res.status(500).json({ success: false, message: 'Error al confirmar la preinscripción' })
  }
}

let cursosSchemaEnsured = false
const ensureCursosTableSchema = async (): Promise<void> => {
  if (cursosSchemaEnsured) return
  try {
    const tableInfo = await db.execute(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'cursos'`)
    const tableSql = String(tableInfo.rows?.[0]?.sql || '')

    if (
      tableSql.includes('CHECK (estatus') ||
      tableSql.includes('CHECK(estatus') ||
      tableSql.includes('CHECK (categoria') ||
      tableSql.includes('CHECK(categoria') ||
      tableSql.includes('CHECK (modalidad') ||
      tableSql.includes('CHECK(modalidad')
    ) {
      console.log('[Schema Migration] Removing restrictive CHECK constraints from cursos table...')
      await db.execute('PRAGMA foreign_keys = OFF')
      await db.execute(`CREATE TABLE IF NOT EXISTS cursos_schema_fix (
        id_curso          INTEGER     PRIMARY KEY,
        titulo            TEXT        NOT NULL,
        slug              TEXT        UNIQUE NOT NULL,
        descripcion       TEXT,
        contenido         TEXT,
        categoria         TEXT,
        fecha_inicio      TEXT,
        fecha_fin         TEXT,
        modalidad         TEXT,
        estatus           TEXT        DEFAULT 'Abierto',
        solo_informativo  INTEGER     DEFAULT 0,
        imagen_url        TEXT,
        banner_url        TEXT,
        cupos_totales     INTEGER,
        creado_en         TEXT        NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
        actualizado_en    TEXT,
        eliminado_en      TEXT
      )`)

      await db.execute(`INSERT OR IGNORE INTO cursos_schema_fix (
        id_curso, titulo, slug, descripcion, contenido, categoria,
        fecha_inicio, fecha_fin, modalidad, estatus, solo_informativo,
        imagen_url, banner_url, cupos_totales, creado_en, actualizado_en, eliminado_en
      ) SELECT
        id_curso, titulo, slug, descripcion, contenido, categoria,
        fecha_inicio, fecha_fin, modalidad,
        CASE
          WHEN estatus = 'Publicado' THEN 'Abierto'
          WHEN estatus = 'Borrador' THEN 'Cerrado'
          WHEN estatus = 'Finalizado' THEN 'Cerrado'
          WHEN estatus = 'Cancelado' THEN 'Cerrado'
          ELSE COALESCE(estatus, 'Abierto')
        END,
        COALESCE(solo_informativo, 0),
        imagen_url, banner_url, cupos_totales,
        creado_en, actualizado_en, eliminado_en
      FROM cursos`)

      await db.execute('DROP TABLE cursos')
      await db.execute('ALTER TABLE cursos_schema_fix RENAME TO cursos')
      await db.execute('CREATE INDEX IF NOT EXISTS idx_cursos_activos ON cursos(eliminado_en) WHERE eliminado_en IS NULL')
      await db.execute('PRAGMA foreign_keys = ON')
      console.log('[Schema Migration] Successfully upgraded cursos table schema.')
    } else if (!tableSql.includes('solo_informativo')) {
      try {
        await db.execute(`ALTER TABLE cursos ADD COLUMN solo_informativo INTEGER DEFAULT 0`)
      } catch (_e) {
        // Column already exists
      }
    }
  } catch (err) {
    console.error('ensureCursosTableSchema error:', err)
  }
  cursosSchemaEnsured = true
}

/**
 * GET /api/public/cursos
 * Lista pública de todos los cursos disponibles o próximos.
 */
export const publicListCursos = async (req: Request, res: Response): Promise<void> => {
  try {
    await ensureCursosTableSchema()
    const result = await db.execute({
      sql: `SELECT c.*,
                   c.titulo AS nombre,
                   (SELECT p.nombres || ' ' || p.apellidos 
                    FROM modulos_curso mc
                    JOIN profesores pr ON mc.id_profesor = pr.id_profesor
                    JOIN personas p ON pr.id_persona = p.id
                    WHERE mc.id_curso = c.id_curso
                    ORDER BY mc.orden ASC
                    LIMIT 1) as instructor_nombre
            FROM cursos c
            WHERE c.eliminado_en IS NULL
              AND c.estatus NOT IN ('Borrador', 'Cerrado')
            ORDER BY c.id_curso DESC`,
      args: [],
    })
    res.json({ success: true, data: result.rows })
  } catch (error) {
    console.error('publicListCursos:', error)
    res.status(500).json({ success: false, message: 'Error al obtener el catálogo de cursos' })
  }
}

/**
 * POST /api/public/cursos/:id/preinscribir
 * Preinscripción a un curso o taller específico.
 */
export const publicPreinscribirCurso = async (req: Request, res: Response): Promise<void> => {
  try {
    await ensureCursosTableSchema()
    const idCurso = Number(req.params.id)
    if (!Number.isFinite(idCurso)) {
      res.status(400).json({ success: false, message: 'id de curso inválido' })
      return
    }

    const nombreCompleto = typeof req.body?.nombreCompleto === 'string' ? req.body.nombreCompleto.trim() : ''
    const cedulaRif = typeof req.body?.cedulaRif === 'string' ? req.body.cedulaRif.trim() : null
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : ''
    const telefono = typeof req.body?.telefono === 'string' ? req.body.telefono.trim() : null

    if (!nombreCompleto || !email) {
      res.status(400).json({ success: false, message: 'nombreCompleto y email son requeridos' })
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ success: false, message: 'El formato del email no es válido' })
      return
    }

    // Verificar que el curso exista y esté Abierto o Próximamente
    const cursoRes = await db.execute({
      sql: `SELECT id_curso, nombre, estatus, solo_informativo FROM cursos WHERE id_curso = ? LIMIT 1`,
      args: [idCurso],
    })
    if (cursoRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Curso no encontrado' })
      return
    }
    const curso = cursoRes.rows[0] as any

    if (curso.solo_informativo === 1 || curso.estatus === 'Solo Informativo') {
      res.status(403).json({
        success: false,
        message: 'Este curso es únicamente informativo. Las inscripciones son gestionadas exclusivamente por un administrador.'
      })
      return
    }

    if (curso.estatus !== 'Abierto' && curso.estatus !== 'Próximamente') {
      res.status(400).json({ success: false, message: 'El curso no está disponible para inscripciones' })
      return
    }

    // Verificar si ya tiene una inscripción a este curso (por email o cédula/RIF)
    const cleanCed = cedulaRif ? String(cedulaRif).replace(/\D/g, '') : '';
    const existing = await db.execute({
      sql: `SELECT ic.id_inscripcion, ic.estatus, ic.estatus_academico 
            FROM inscripciones_cursos ic
            JOIN estudiantes e ON ic.id_estudiante = e.id_estudiante
            LEFT JOIN personas p ON e.id_persona = p.id
            LEFT JOIN empresas emp ON e.id_empresa = emp.id_empresa
            WHERE ic.id_curso = ? 
              AND (
                p.email = ? OR emp.email = ? 
                OR (? != '' AND (p.cedula = ? OR emp.rif_numero = ?))
              )
            LIMIT 1`,
      args: [idCurso, email, email, cleanCed, cleanCed, cleanCed],
    })

    if (existing.rows.length > 0) {
      const prev = existing.rows[0] as any
      const isFinalState = prev.estatus === 'Rechazado' || 
                           prev.estatus === 'Cancelado' || 
                           ['Aprobado', 'Reprobado', 'Retirado'].includes(prev.estatus_academico);
      if (!isFinalState) {
        if (prev.estatus === 'Preinscrito') {
          res.status(409).json({ success: false, message: 'Ya has enviado una solicitud de preinscripción para este curso y se encuentra pendiente de aprobación.' })
          return
        }
        if (prev.estatus === 'Inscrito') {
          res.status(409).json({ success: false, message: 'Ya te encuentras formalmente inscrito y admitido en este curso.' })
          return
        }
        res.status(409).json({ success: false, message: `Ya tienes una solicitud de inscripción para este curso en estado "${prev.estatus}".` })
        return
      }
    }

    // Upsert estudiante por email o cédula/RIF
    const { id_estudiante } = await upsertEstudianteByEmail({
      nombreCompleto,
      cedulaRif,
      email,
      telefono,
      tipo: 'Regular',
    })

    const now = new Date().toISOString()
    const result = await db.execute({
      sql: `INSERT INTO inscripciones_cursos
              (id_estudiante, id_curso, programa_codigo, tipo_inscripcion, estatus, creado_en, actualizado_en)
            VALUES (?, ?, NULL, 'curso', 'Preinscrito', ?, ?)
            ON CONFLICT (id_estudiante, id_curso) DO UPDATE SET
              estatus = 'Preinscrito',
              estatus_academico = 'Inscrito',
              completado = 0,
              tipo_inscripcion = 'curso',
              actualizado_en = excluded.actualizado_en
            RETURNING *`,
      args: [id_estudiante, idCurso, now, now],
    })

    res.status(201).json({
      success: true,
      message: 'Inscripción procesada. Pronto nos pondremos en contacto.',
      data: result.rows[0],
    })
  } catch (error) {
    console.error('publicPreinscribirCurso:', error)
    res.status(500).json({ success: false, message: 'Error al procesar la inscripción' })
  }
}


/**
 * GET /api/academia/cursos?estatus=Abierto&programaCodigo=PADI
 * Lista cursos/cohortes académicos — panel admin.
 */
export const adminListCursos = async (req: Request, res: Response): Promise<void> => {
  try {
    const estatus = typeof req.query?.estatus === 'string' ? req.query.estatus : undefined
    const programaCodigo = typeof req.query?.programaCodigo === 'string' ? req.query.programaCodigo.toUpperCase() : undefined
    const allowedEstatus = new Set(['Abierto', 'Cerrado', 'En curso'])

    const whereParts: string[] = []
    const args: any[] = []

    if (estatus && allowedEstatus.has(estatus)) {
      whereParts.push('c.estatus = ?')
      args.push(estatus)
    }
    if (programaCodigo) {
      whereParts.push('c.programa_codigo = ?')
      args.push(programaCodigo)
    }

    const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : ''

    const result = await db.execute({
      sql: `SELECT c.*, NULL as instructor_nombre
            FROM cursos c
            ${where}
            ORDER BY c.id_curso DESC`,
      args,
    })

    const courses = []
    for (const r of result.rows) {
      const modulosResult = await db.execute({
        sql: `SELECT mc.nombre_modulo, mc.orden, mc.id_profesor,
                     (p.nombres || ' ' || p.apellidos) AS profesor
              FROM modulos_curso mc
              LEFT JOIN profesores prof ON mc.id_profesor = prof.id_profesor
              LEFT JOIN personas p ON prof.id_persona = p.id
              WHERE mc.id_curso = ?
              ORDER BY mc.orden ASC`,
        args: [r.id_curso]
      })
      courses.push({ ...r, modulos: modulosResult.rows })
    }

    res.json({ success: true, data: courses })
  } catch (error) {
    console.error('adminListCursos:', error)
    res.status(500).json({ success: false, message: 'Error al obtener cursos' })
  }
}

/**
 * POST /api/academia/cursos
 * Crea un nuevo curso/cohorte desde el panel admin.
 */
export const adminCreateCurso = async (req: Request, res: Response): Promise<void> => {
  try {
    await ensureCursosTableSchema()
    const {
      nombre,
      titulo,
      descripcion,
      contenido,
      categoria,
      modalidad,
      cupos_totales,
      fecha_inicio,
      fecha_fin,
      imagen_url,
      banner_url,
      estatus,
      solo_informativo,
    } = req.body

    const courseTitle = (titulo || nombre || '').trim()
    if (!courseTitle || !cupos_totales) {
      res.status(400).json({ success: false, message: 'titulo y cupos_totales son requeridos' })
      return
    }

    const cupos = Number(cupos_totales)
    if (!Number.isFinite(cupos) || cupos <= 0) {
      res.status(400).json({ success: false, message: 'cupos_totales debe ser un número positivo' })
      return
    }

    const slug = generateSlug(courseTitle)
    const now = new Date().toISOString()
    const isSoloInformativo = solo_informativo ? 1 : 0

    const result = await db.execute({
      sql: `INSERT INTO cursos (
              titulo, slug, descripcion, contenido, categoria, modalidad,
              cupos_totales, fecha_inicio, fecha_fin, imagen_url, banner_url,
              estatus, solo_informativo, creado_en, actualizado_en
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING *`,
      args: [
        courseTitle,
        slug,
        descripcion ?? null,
        contenido ?? null,
        categoria ?? null,
        modalidad ?? null,
        cupos,
        fecha_inicio ?? null,
        fecha_fin ?? null,
        imagen_url ?? null,
        banner_url ?? null,
        estatus ?? 'Abierto',
        isSoloInformativo,
        now,
        now,
      ],
    })

    const courseId = Number(result.rows[0].id_curso)
    
    // Parse modules if any
    const modulosList = Array.isArray(req.body.modulos) ? req.body.modulos : []
    if (modulosList.length === 0) {
      await db.execute({
        sql: `INSERT OR IGNORE INTO modulos_curso (id_curso, nombre_modulo, orden, id_profesor) VALUES (?, ?, 0, NULL)`,
        args: [courseId, 'Módulo General']
      })
    } else {
      for (const m of modulosList) {
        const name = (m.nombre_modulo || '').trim()
        const ord = Number(m.orden) || 0
        const idProf = m.id_profesor ? Number(m.id_profesor) : null
        if (name) {
          await db.execute({
            sql: `INSERT INTO modulos_curso (id_curso, nombre_modulo, orden, id_profesor) VALUES (?, ?, ?, ?)`,
            args: [courseId, name, ord, idProf]
          })
        }
      }
    }

    const modulosResult = await db.execute({
      sql: `SELECT mc.nombre_modulo, mc.orden, mc.id_profesor,
                   (p.nombres || ' ' || p.apellidos) AS profesor
            FROM modulos_curso mc
            LEFT JOIN profesores prof ON mc.id_profesor = prof.id_profesor
            LEFT JOIN personas p ON prof.id_persona = p.id
            WHERE mc.id_curso = ?
            ORDER BY mc.orden ASC`,
      args: [courseId]
    })

    const courseData = { ...result.rows[0], modulos: modulosResult.rows }
    res.status(201).json({ success: true, data: courseData })
  } catch (error) {
    console.error('adminCreateCurso:', error)
    res.status(500).json({ success: false, message: 'Error al crear curso' })
  }
}

/**
 * PUT /api/academia/cursos/:id
 * Actualiza un curso/cohorte existente.
 */
export const adminUpdateCurso = async (req: Request, res: Response): Promise<void> => {
  try {
    await ensureCursosTableSchema()
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) {
      res.status(400).json({ success: false, message: 'id inválido' })
      return
    }

    const {
      nombre,
      titulo,
      descripcion,
      contenido,
      categoria,
      modalidad,
      cupos_totales,
      fecha_inicio,
      fecha_fin,
      imagen_url,
      banner_url,
      estatus,
      solo_informativo,
    } = req.body

    const courseTitle = (titulo || nombre || '').trim()
    const now = new Date().toISOString()
    const isSoloInformativo = solo_informativo !== undefined ? (solo_informativo ? 1 : 0) : null

    const result = await db.execute({
      sql: `UPDATE cursos SET
              titulo = COALESCE(NULLIF(?, ''), titulo),
              descripcion = ?,
              contenido = ?,
              categoria = ?,
              modalidad = ?,
              cupos_totales = COALESCE(?, cupos_totales),
              fecha_inicio = ?,
              fecha_fin = ?,
              imagen_url = COALESCE(?, imagen_url),
              banner_url = ?,
              estatus = COALESCE(?, estatus),
              solo_informativo = COALESCE(?, solo_informativo),
              actualizado_en = ?
            WHERE id_curso = ?
            RETURNING *`,
      args: [
        courseTitle || null,
        descripcion ?? null,
        contenido ?? null,
        categoria ?? null,
        modalidad ?? null,
        cupos_totales != null ? Number(cupos_totales) : null,
        fecha_inicio ?? null,
        fecha_fin ?? null,
        imagen_url ?? null,
        banner_url ?? null,
        estatus ?? null,
        isSoloInformativo,
        now,
        id,
      ],
    })

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Curso no encontrado' })
      return
    }

    // Sync modules if provided
    if (Array.isArray(req.body.modulos)) {
      await db.execute({
        sql: `DELETE FROM modulos_curso WHERE id_curso = ?`,
        args: [id]
      })

      const modulosList = req.body.modulos
      if (modulosList.length === 0) {
        await db.execute({
          sql: `INSERT OR IGNORE INTO modulos_curso (id_curso, nombre_modulo, orden, id_profesor) VALUES (?, ?, 0, NULL)`,
          args: [id, 'Módulo General']
        })
      } else {
        for (const m of modulosList) {
          const name = (m.nombre_modulo || '').trim()
          const ord = Number(m.orden) || 0
          const idProf = m.id_profesor ? Number(m.id_profesor) : null
          if (name) {
            await db.execute({
              sql: `INSERT OR REPLACE INTO modulos_curso (id_curso, nombre_modulo, orden, id_profesor) VALUES (?, ?, ?, ?)`,
              args: [id, name, ord, idProf]
            })
          }
        }
      }
    }

    const modulosResult = await db.execute({
      sql: `SELECT mc.nombre_modulo, mc.orden, mc.id_profesor,
                   (p.nombres || ' ' || p.apellidos) AS profesor
            FROM modulos_curso mc
            LEFT JOIN profesores prof ON mc.id_profesor = prof.id_profesor
            LEFT JOIN personas p ON prof.id_persona = p.id
            WHERE mc.id_curso = ?
            ORDER BY mc.orden ASC`,
      args: [id]
    })

    const courseData = { ...result.rows[0], modulos: modulosResult.rows }
    res.json({ success: true, data: courseData })
  } catch (error) {
    console.error('adminUpdateCurso:', error)
    res.status(500).json({ success: false, message: 'Error al actualizar curso' })
  }
}

/**
 * DELETE /api/academia/cursos/:id
 * Soft-delete: marca el curso como 'Cerrado'. Preserva inscripciones históricas.
 */
export const adminDeleteCurso = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) {
      res.status(400).json({ success: false, message: 'id inválido' })
      return
    }

    await db.execute({
      sql: `DELETE FROM modulos_inscripcion WHERE id_inscripcion IN (SELECT id_inscripcion FROM inscripciones_cursos WHERE id_curso = ?)`,
      args: [id],
    })
    await db.execute({
      sql: `DELETE FROM inscripciones_cursos WHERE id_curso = ?`,
      args: [id],
    })
    await db.execute({
      sql: `DELETE FROM modulos_curso WHERE id_curso = ?`,
      args: [id],
    })
    await db.execute({
      sql: `DELETE FROM cursos WHERE id_curso = ?`,
      args: [id],
    })

    res.json({ success: true, message: 'Curso eliminado permanentemente.' })
  } catch (error) {
    console.error('adminDeleteCurso:', error)
    res.status(500).json({ success: false, message: 'Error al eliminar el curso' })
  }
}



/**
 * GET /api/public/preinscripciones/token/:token
 * Verifica si un token es válido y devuelve la info básica para el formulario de confirmación.
 */
export const publicGetVerificacionPreinscripcionByToken = async (req: Request, res: Response): Promise<void> => {
  try {
    let token = String(req.params.token ?? '')
    if (token === 'session') {
      token = getCookie(req, 'auth_expediente') ?? ''
    }

    if (!token) {
      res.status(400).json({ success: false, message: 'Token no especificado o sesión expirada' })
      return
    }

    const ver = await db.execute({
      sql: `SELECT token, email, data_json, fecha_expiracion, usado FROM tokens_accion WHERE token = ? AND tipo = 'preinscripcion' LIMIT 1`,
      args: [token],
    })
    if (ver.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Token inválido o no encontrado' })
      return
    }

    const tokenRow = ver.rows[0] as any

    // Check if already used
    if (tokenRow.usado === 1) {
      res.status(400).json({ success: false, message: 'Este enlace de preinscripción ya fue utilizado.' })
      return
    }

    // Check expiration
    const exp = new Date(String(tokenRow.fecha_expiracion))
    if (exp < new Date()) {
      res.status(400).json({ success: false, message: 'El enlace de preinscripción ha expirado. Por favor, realiza la preinscripción nuevamente.' })
      return
    }

    // Parse the data stored in data_json
    const registro = JSON.parse(tokenRow.data_json || '{}')
    registro.email = tokenRow.email

    const nombreCompleto = (
      registro.razon_social ||
      `${registro.nombres || ''} ${registro.apellidos || ''}`.trim() ||
      `${registro.representante_legal_nombres || ''} ${registro.representante_legal_apellidos || ''}`.trim() ||
      'Aspirante'
    ).trim()

    const email = registro.email ? String(registro.email).trim().toLowerCase() : ''
    const cedula = registro.cedula ? String(registro.cedula).replace(/\D/g, '') : ''

    let existingEstId: number | null = null
    let prevNivelAcademico: string | null = null
    let prevProfesion: string | null = null
    let prevAnoInicio: number | null = null
    let prevEsCorredor: number | null = null
    let documentos: any[] = []

    if (email || cedula) {
      const existingEst = await db.execute({
        sql: `SELECT e.id_estudiante, e.es_corredor_inmobiliario, 
                     p.nivel_academico, p.profesion, 
                     a.ano_inicio_servicio
              FROM estudiantes e
              LEFT JOIN personas p ON e.id_persona = p.id
              LEFT JOIN empresas emp ON e.id_empresa = emp.id_empresa
              LEFT JOIN afiliados a ON a.id_persona = p.id
              WHERE (p.email = ? OR (? != '' AND p.cedula = ?))
                 OR (emp.email = ? OR (? != '' AND emp.rif_numero = ?))
              LIMIT 1`,
        args: [email, cedula, cedula, email, cedula, cedula]
      })

      if (existingEst.rows.length > 0) {
        const row = existingEst.rows[0] as any
        existingEstId = row.id_estudiante as number
        prevEsCorredor = row.es_corredor_inmobiliario
        prevNivelAcademico = row.nivel_academico
        prevProfesion = row.profesion
        prevAnoInicio = row.ano_inicio_servicio

        const docsRes = await db.execute({
          sql: `SELECT tipo_archivo as tipo_doc, url, nombre_archivo, fecha_subida as fecha_documento 
                FROM documentos 
                WHERE entidad_tipo = 'estudiante' AND entidad_id = ? AND eliminado_en IS NULL`,
          args: [existingEstId]
        })
        documentos = docsRes.rows
      }
    }

    // Establecer o renovar la cookie por 24 horas (1 día)
    res.cookie('auth_expediente', token, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 días
      sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/'
    })

    res.json({
      success: true,
      data: {
        token,
        nombreCompleto,
        email: registro.email,
        programaCodigo: registro.programa_interes,
        tipoAfiliado: registro.tipo_afiliado ?? 'Natural',
        razonSocial: registro.razon_social,
        cedulaRif: registro.cedula,
        telefono: registro.telefono,
        nivelProfesional: registro.nivel_academico || prevNivelAcademico || null,
        profesion: registro.profesion || prevProfesion || null,
        esCorredorInmobiliario: registro.es_corredor_inmobiliario !== null ? registro.es_corredor_inmobiliario : prevEsCorredor,
        ano_inicio_servicio: registro.ano_inicio_servicio || prevAnoInicio || null,
        url_titulo: registro.url_titulo,
        url_cv: registro.url_cv,
        url_especializaciones: registro.url_especializaciones,
        url_cursos_extras: registro.url_cursos_extras,
        documentos
      }
    })
  } catch (error) {
    console.error('publicGetVerificacionPreinscripcionByToken:', error)
    res.status(500).json({ success: false, message: 'Error al verificar token' })
  }
}

export const adminListPreinscripciones = async (req: Request, res: Response): Promise<void> => {
  try {
    // Auto-curación: si hay inscripciones de 'AFILIACION' o 'CIBIR' como 'Preinscrito'/'Entrevista' pero el afiliado ya está como 'Afiliado' o 'Rechazado',
    // actualizamos la inscripción correspondientemente.
    try {
      await db.execute({
        sql: `UPDATE inscripciones_cursos 
              SET estatus = 'Inscrito', completado = 1, actualizado_en = strftime('%Y-%m-%dT%H:%M:%SZ','now')
              WHERE programa_codigo IN ('AFILIACION', 'CIBIR') 
                AND id_curso IS NULL 
                AND estatus IN ('Preinscrito', 'Entrevista')
                AND id_estudiante IN (
                  SELECT e.id_estudiante 
                  FROM estudiantes e
                  JOIN afiliados af ON (e.id_persona = af.id_persona OR (e.id_empresa IS NOT NULL AND e.id_empresa = af.id_empresa))
                  WHERE af.estatus = 'Afiliado'
                )`,
        args: []
      })
      await db.execute({
        sql: `UPDATE inscripciones_cursos 
              SET estatus = 'Rechazado', actualizado_en = strftime('%Y-%m-%dT%H:%M:%SZ','now')
              WHERE programa_codigo IN ('AFILIACION', 'CIBIR') 
                AND id_curso IS NULL 
                AND estatus IN ('Preinscrito', 'Entrevista')
                AND id_estudiante IN (
                  SELECT e.id_estudiante 
                  FROM estudiantes e
                  JOIN afiliados af ON (e.id_persona = af.id_persona OR (e.id_empresa IS NOT NULL AND e.id_empresa = af.id_empresa))
                  WHERE af.estatus = 'Rechazado'
                )`,
        args: []
      })
    } catch (e) {
      console.error('Error in preinscripciones healing query:', e)
    }
    const programaCodigo = normalizeProgramaCodigo(req.query?.programaCodigo)
    const cursoId = req.query?.cursoId ? Number(req.query.cursoId) : null
    const estatus = typeof req.query?.estatus === 'string' ? req.query.estatus : 'Preinscrito'
    const allowedStatus = new Set(['Todos', 'Preinscrito', 'Entrevista', 'Inscrito', 'Rechazado', 'Cancelado'])
    if (!allowedStatus.has(estatus)) {
      res.status(400).json({ success: false, message: 'estatus inválido' })
      return
    }

    const onlyCursos = req.query?.onlyCursos === 'true'
    const baseWhere: string[] = []
    const countArgs: any[] = []

    // Excluir preinscripciones de afiliación/CIBIR de personas/empresas que ya tienen un estatus final en afiliados (Afiliado, Rechazado, etc.)
    baseWhere.push("NOT (COALESCE(ic.programa_codigo, '') IN ('AFILIACION', 'CIBIR') AND COALESCE(af.estatus, '') IN ('Afiliado', 'Rechazado', 'Moroso', 'Suspendido'))")

    if (onlyCursos) {
      // Formación = Cursos + Programas (CIBIR/PADI/PEGI/PREANI), excepto AFILIACION que va por panel de Afiliados o si es 5_CIBIR
      baseWhere.push("(ic.id_curso IS NOT NULL OR (ic.programa_codigo IS NOT NULL AND (ic.programa_codigo <> 'AFILIACION' OR af.estatus = '5_CIBIR')))")
    } else if (cursoId) {
      baseWhere.push('ic.id_curso = ?')
      countArgs.push(cursoId)
    } else if (programaCodigo && programaCodigo !== 'Todos') {
      baseWhere.push('ic.programa_codigo = ? AND ic.id_curso IS NULL')
      countArgs.push(programaCodigo)
    } else {
      // Si no hay curso ni programa específico, mostrar todos
      baseWhere.push('1=1')
    }

    // Get counts
    const countsResult = await db.execute({
      sql: `SELECT ic.estatus as estatus, COUNT(*) as c 
            FROM inscripciones_cursos ic 
            JOIN estudiantes e ON e.id_estudiante = ic.id_estudiante
            LEFT JOIN afiliados af ON (e.id_persona = af.id_persona OR (e.id_empresa IS NOT NULL AND e.id_empresa = af.id_empresa))
            WHERE ${baseWhere.join(' AND ')}
              AND (af.tipo_afiliado IS NULL OR NOT (af.tipo_afiliado = 'Agente Corporativo' AND af.estatus = '1_PREINSCRIPCION'))
            GROUP BY ic.estatus`,
      args: countArgs,
    })

    const counts = { Todos: 0, Pendiente: 0, Entrevista: 0, Aprobado: 0, Rechazado: 0, Cancelado: 0 }
    countsResult.rows.forEach((r: any) => {
      const c = Number(r.c)
      counts.Todos += c
      if (r.estatus === 'Preinscrito') counts.Pendiente += c
      else if (r.estatus === 'Entrevista') counts.Entrevista += c
      else if (r.estatus === 'Inscrito' || r.estatus === 'Pagado') counts.Aprobado += c
      else if (r.estatus === 'Rechazado') counts.Rechazado += c
      else if (r.estatus === 'Cancelado') counts.Cancelado += c
    })

    const whereParts = [...baseWhere]
    whereParts.push("(af.tipo_afiliado IS NULL OR NOT (af.tipo_afiliado = 'Agente Corporativo' AND af.estatus = '1_PREINSCRIPCION'))")
    const args = [...countArgs]
    if (estatus !== 'Todos') {
      whereParts.push('ic.estatus = ?')
      args.push(estatus)
    }

    const result = await db.execute({
      sql: `
        SELECT
          ic.*,
          cur.titulo as curso_nombre,
          CASE 
            WHEN ic.programa_codigo = 'CIBIR' OR af.estatus = '5_CIBIR' THEN 5 
            ELSE COALESCE((SELECT COUNT(*) FROM modulos_curso mc WHERE mc.id_curso = ic.id_curso), 1)
          END as num_modulos,
          CASE
            WHEN ic.programa_codigo = 'CIBIR' OR af.estatus = '5_CIBIR' THEN (SELECT COUNT(*) FROM acreditaciones_cibir ac WHERE ac.id_afiliado = af.id_afiliado AND ac.estatus = 'aprobado')
            ELSE (SELECT COUNT(*) FROM modulos_inscripcion mi WHERE mi.id_inscripcion = ic.id_inscripcion AND mi.estatus = 'Aprobado')
          END as modulos_aprobados,
          (SELECT COUNT(*) FROM documentos d_count WHERE d_count.entidad_tipo = 'estudiante' AND d_count.entidad_id = e.id_estudiante AND d_count.eliminado_en IS NULL) as num_documentos,
          e.id_estudiante,
          COALESCE(NULLIF(TRIM(COALESCE(p.nombres, '') || ' ' || COALESCE(p.apellidos, '')), ''), emp.razon_social) as estudiante_nombre,
          COALESCE(p.email, emp.email) as estudiante_email,
          COALESCE(p.telefono, emp.telefono) as estudiante_telefono,
          COALESCE(p.cedula_tipo || '-' || p.cedula, 'J-' || REPLACE(emp.rif_numero, 'J-', '')) as estudiante_cedula,
          p.nivel_academico as estudiante_nivel_profesional,
          p.profesion as estudiante_profesion,
          e.es_corredor_inmobiliario as estudiante_es_corredor_inmobiliario,
          e.tipo as tipo_estudiante,
          COALESCE(p_rep.nombres, '') || ' ' || COALESCE(p_rep.apellidos, '') as representante_nombre,
          p_rep.cedula as representante_cedula,
          p_rep.email as representante_email,
          p_rep.telefono as representante_telefono,
          af.estatus as afiliado_estatus,
          af.tipo_afiliado as afiliado_tipo,
          emp_vinc.razon_social as empresa_vinculada_nombre,
          af.ano_inicio_servicio as ano_inicio_servicio,
          entr.fecha as entrevista_fecha,
          entr.hora as entrevista_hora,
          entr.lugar as entrevista_lugar,
          entr.estatus as entrevista_estatus,
          COALESCE(af.optar_acreditacion, 0) as apto_acreditacion
        FROM inscripciones_cursos ic
        JOIN estudiantes e ON e.id_estudiante = ic.id_estudiante
        LEFT JOIN personas p ON e.id_persona = p.id
        LEFT JOIN empresas emp ON e.id_empresa = emp.id_empresa
        LEFT JOIN afiliados a_rep ON emp.id_representante_legal = a_rep.id_afiliado
        LEFT JOIN personas p_rep ON a_rep.id_persona = p_rep.id
        LEFT JOIN afiliados af ON (e.id_persona = af.id_persona OR (e.id_empresa IS NOT NULL AND e.id_empresa = af.id_empresa))
        LEFT JOIN empresas emp_vinc ON ic.id_empresa = emp_vinc.id_empresa
        LEFT JOIN cursos cur ON ic.id_curso = cur.id_curso
        LEFT JOIN entrevistas entr ON (entr.id_inscripcion = ic.id_inscripcion AND entr.eliminado_en IS NULL)
        WHERE ${whereParts.join(' AND ')}
        ORDER BY ic.fecha_inscripcion DESC
      `,
      args,
    })

    const mappedRows = result.rows.map((row: any) => {
      const r = { ...row }
      if (r.programa_codigo === 'AFILIACION' && r.afiliado_estatus === '5_CIBIR') {
        r.programa_codigo = 'CIBIR'
        r.curso_nombre = 'Programa CIBIR'
      }
      return r
    })

    res.json({ success: true, data: mappedRows, meta: { counts } })
  } catch (error) {
    console.error('adminListPreinscripciones:', error)
    res.status(500).json({ success: false, message: 'Error al obtener preinscripciones' })
  }
}

/**
 * POST /api/academia/cursos/:id_curso/asignar
 * Carga/Asignación manual: el admin asigna un estudiante a un curso abierto.
 */
export const adminAsignarEstudianteACurso = async (req: Request, res: Response): Promise<void> => {
  try {
    const idCurso = Number(req.params.id_curso)
    if (!Number.isFinite(idCurso)) {
      res.status(400).json({ success: false, message: 'id_curso inválido' })
      return
    }

    const nombreCompleto = typeof req.body?.nombreCompleto === 'string' ? req.body.nombreCompleto.trim() : ''
    const cedulaRif = typeof req.body?.cedulaRif === 'string' ? req.body.cedulaRif.trim() : null
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : ''
    const telefono = typeof req.body?.telefono === 'string' ? req.body.telefono.trim() : null
    const nivelProfesional = normalizeNivelProfesional(req.body?.nivelProfesional) || 'Nivel Profesional'
    const esCorredorInmobiliario = normalizeEsCorredorInmobiliario(req.body?.esCorredorInmobiliario) ?? true

    if (!nombreCompleto || !email) {
      res.status(400).json({ success: false, message: 'nombreCompleto y email son requeridos' })
      return
    }

    // validar curso abierto y cupos
    const cursoRes = await db.execute({
      sql: `SELECT id_curso, cupos_totales, estatus,
                   (SELECT COUNT(*) FROM inscripciones_cursos WHERE id_curso = ? AND estatus IN ('Inscrito', 'Pagado')) as inscritos
            FROM cursos WHERE id_curso = ? LIMIT 1`,
      args: [idCurso, idCurso],
    })
    const curso = cursoRes.rows[0] as any
    if (!curso) {
      res.status(404).json({ success: false, message: 'Curso no encontrado' })
      return
    }
    if (curso.estatus !== 'Abierto') {
      res.status(400).json({ success: false, message: 'El curso no está abierto' })
      return
    }
    const cuposDisponibles = (curso.cupos_totales || 0) - (curso.inscritos || 0)
    if (cuposDisponibles <= 0) {
      res.status(400).json({ success: false, message: 'No hay cupos disponibles' })
      return
    }

    // Verificar si ya tiene una inscripción a este curso (por email o cédula/RIF)
    const cleanCed = cedulaRif ? String(cedulaRif).replace(/\D/g, '') : '';
    const existing = await db.execute({
      sql: `SELECT ic.id_inscripcion, ic.estatus, ic.estatus_academico 
            FROM inscripciones_cursos ic
            JOIN estudiantes e ON ic.id_estudiante = e.id_estudiante
            LEFT JOIN personas p ON e.id_persona = p.id
            LEFT JOIN empresas emp ON e.id_empresa = emp.id_empresa
            WHERE ic.id_curso = ? 
              AND (
                p.email = ? OR emp.email = ? 
                OR (? != '' AND (p.cedula = ? OR emp.rif_numero = ?))
              )
            LIMIT 1`,
      args: [idCurso, email, email, cleanCed, cleanCed, cleanCed],
    })

    if (existing.rows.length > 0) {
      const prev = existing.rows[0] as any
      const isFinalState = prev.estatus === 'Rechazado' || 
                           prev.estatus === 'Cancelado' || 
                           ['Aprobado', 'Reprobado', 'Retirado'].includes(prev.estatus_academico);
      if (!isFinalState) {
        if (prev.estatus === 'Inscrito') {
          res.status(409).json({ success: false, message: 'El estudiante ya se encuentra oficialmente inscrito y admitido en este curso.' })
          return
        }
        if (prev.estatus === 'Preinscrito') {
          res.status(409).json({ success: false, message: 'El estudiante ya posee una solicitud de preinscripción registrada y pendiente de aprobación para este curso.' })
          return
        }
        res.status(409).json({ success: false, message: `El estudiante ya tiene un registro en este curso en estado "${prev.estatus}".` })
        return
      }
    }

    const { id_estudiante } = await upsertEstudianteByEmail({
      nombreCompleto,
      cedulaRif,
      email,
      telefono,
      tipo: 'Regular',
      nivelProfesional,
      esCorredorInmobiliario,
    })

    const now = new Date().toISOString()

    const updateRes = await db.execute({
      sql: `UPDATE inscripciones_cursos 
            SET estatus = 'Inscrito',
                estatus_academico = 'Inscrito',
                completado = 0,
                tipo_inscripcion = 'curso',
                aprobado_por = ?,
                actualizado_en = ?
            WHERE id_estudiante = ? AND id_curso = ?`,
      args: [req.user?.id ?? null, now, id_estudiante, idCurso],
    })

    if ((updateRes.rowsAffected ?? 0) === 0) {
      await db.execute({
        sql: `INSERT INTO inscripciones_cursos (id_estudiante, id_curso, tipo_inscripcion, estatus, estatus_academico, aprobado_por, creado_en, actualizado_en)
              VALUES (?, ?, 'curso', 'Inscrito', 'Inscrito', ?, ?, ?)`,
        args: [id_estudiante, idCurso, req.user?.id ?? null, now, now],
      })
    }

    res.status(201).json({ success: true, message: 'Estudiante asignado e inscrito en el curso.' })
  } catch (error) {
    console.error('adminAsignarEstudianteACurso:', error)
    res.status(500).json({ success: false, message: 'Error al asignar estudiante' })
  }
}

/**
 * PATCH /api/academia/inscripciones/:id/agendar-entrevista
 * Cambia el estatus a 'Entrevista' y notifica al estudiante.
 */
export const adminAgendarEntrevista = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) {
      res.status(400).json({ success: false, message: 'id inválido' })
      return
    }

    const { entrevistaFecha, entrevistaHora, entrevistaLugar } = req.body
    if (!entrevistaFecha || !entrevistaHora || !entrevistaLugar) {
      res.status(400).json({ success: false, message: 'Fecha, hora y lugar de entrevista son requeridos.' })
      return
    }

    const now = new Date().toISOString()
    const result = await db.execute({
      sql: `UPDATE inscripciones_cursos 
            SET estatus='Entrevista', actualizado_en=?
            WHERE id_inscripcion=? AND estatus='Preinscrito'
            RETURNING *`,
      args: [now, id],
    })

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Preinscripción no encontrada o ya procesada' })
      return
    }

    const row = result.rows[0] as any

    const existingEnt = await db.execute({
      sql: `SELECT id_entrevista FROM entrevistas WHERE id_inscripcion = ? AND eliminado_en IS NULL LIMIT 1`,
      args: [id]
    })

    if (existingEnt.rows.length > 0) {
      const idEntrevista = existingEnt.rows[0].id_entrevista
      await db.execute({
        sql: `UPDATE entrevistas SET fecha = ?, hora = ?, lugar = ?, estatus = 'Pendiente', actualizado_en = ? WHERE id_entrevista = ?`,
        args: [entrevistaFecha, entrevistaHora, entrevistaLugar, now, idEntrevista]
      })
    } else {
      await db.execute({
        sql: `INSERT INTO entrevistas (id_inscripcion, fecha, hora, lugar, estatus, creado_en) VALUES (?, ?, ?, ?, 'Pendiente', ?)`,
        args: [id, entrevistaFecha, entrevistaHora, entrevistaLugar, now]
      })
    }

    try {
      const estRes = await db.execute({
        sql: `SELECT 
                COALESCE(NULLIF(TRIM(COALESCE(p.nombres, '') || ' ' || COALESCE(p.apellidos, '')), ''), emp.razon_social) as nombre_completo,
                COALESCE(p.email, emp.email) as email
              FROM estudiantes e 
              LEFT JOIN personas p ON e.id_persona = p.id
              LEFT JOIN empresas emp ON e.id_empresa = emp.id_empresa
              WHERE e.id_estudiante = ?`,
        args: [row.id_estudiante]
      })
      const estudiante = estRes.rows[0] as any

      if (estudiante?.email) {
        await enviarCorreoAprobacionEstudiante({
          nombre: estudiante.nombre_completo,
          emailOriginal: estudiante.email,
          programaCodigo: row.programa_codigo || 'Curso',
          entrevistaFecha,
          entrevistaHora,
          entrevistaLugar,
          // No enviamos token todavía, ya que no es el acceso definitivo
        })
      }
    } catch (err) {
      console.error('Error enviando correo de entrevista:', err)
    }

    res.json({ success: true, message: 'Entrevista agendada correctamente.', data: row })
  } catch (error) {
    console.error('adminAgendarEntrevista:', error)
    res.status(500).json({ success: false, message: 'Error al agendar entrevista' })
  }
}

/**
 * Promueve un estudiante aprobado al rol/estatus de Afiliado/Corporativo.
 * Vincula las relaciones de id_user, genera código correlativo, y actualiza roles en users.
 */
async function promocionarYVincularAfiliado(
  idEstudiante: number,
  email: string,
  now: string,
  targetStatus: string = 'Afiliado'
): Promise<number | null> {
  // 1. Obtener datos del estudiante y el representante legal si aplica
  const estRes = await db.execute({
    sql: `SELECT e.id_persona, e.id_empresa, a.id_persona as rep_id_persona
          FROM estudiantes e
          LEFT JOIN empresas emp ON e.id_empresa = emp.id_empresa
          LEFT JOIN afiliados a ON emp.id_representante_legal = a.id_afiliado
          WHERE e.id_estudiante = ?`,
    args: [idEstudiante]
  })
  if (estRes.rows.length === 0) return null
  const est = estRes.rows[0] as any

  const finalIdPersona = est.id_persona || est.rep_id_persona
  if (!finalIdPersona) {
    console.error(`[promocionarYVincularAfiliado] No se encontró id_persona ni rep_id_persona para id_estudiante=${idEstudiante}`)
    return null
  }

  // 2. Obtener el usuario por email
  const userRes = await db.execute({
    sql: `SELECT id, roles FROM users WHERE email = ?`,
    args: [email]
  })
  if (userRes.rows.length === 0) {
    console.error(`[promocionarYVincularAfiliado] No se encontró usuario para email=${email}`)
    return null
  }
  const user = userRes.rows[0] as any
  const userId = user.id

  // 3. Generar el código correlativo de Afiliado usando el helper (solo si es Afiliado aprobado)
  const isTargetAfiliado = targetStatus === 'Afiliado'
  const nextCode = isTargetAfiliado ? await obtenerSiguienteCodigoAfiliado() : null
  const fechaAfiliacionVal = isTargetAfiliado ? now : null

  const convalidadoVal = ['Afiliado', '6_INSCRIPCION'].includes(targetStatus) ? 1 : 0

  const safeEmpresaId = est.id_empresa ?? null
  const safeNextCode = nextCode ?? null
  const safeFechaAfiliacion = fechaAfiliacionVal ?? null
  const safeUserId = userId ?? null

  // Determinar tipo_afiliado consistente con la restricción chk_empresa_asignada
  const existingAf = await db.execute({
    sql: `SELECT tipo_afiliado FROM afiliados WHERE id_persona = ?`,
    args: [finalIdPersona]
  })
  const existingTipo = existingAf.rows[0]?.tipo_afiliado as string | undefined

  let determinedTipoAfiliado = 'Natural'
  if (safeEmpresaId) {
    if (existingTipo === 'Agente Corporativo' || existingTipo === 'Agente') {
      determinedTipoAfiliado = 'Agente Corporativo'
    } else {
      determinedTipoAfiliado = 'Corporativo'
    }
  } else {
    determinedTipoAfiliado = 'Natural'
  }

  // 4. Insertar/Actualizar afiliado en estatus deseado
  const resIns = await db.execute({
    sql: `INSERT INTO afiliados (id_persona, id_empresa, tipo_afiliado, estatus, codigo, fecha_afiliacion, actualizado_en, activo, id_user, cibir_acreditado)
          VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
          ON CONFLICT(id_persona) DO UPDATE SET
            id_empresa = excluded.id_empresa,
            tipo_afiliado = excluded.tipo_afiliado,
            estatus = ?,
            codigo = COALESCE(afiliados.codigo, ?),
            fecha_afiliacion = COALESCE(afiliados.fecha_afiliacion, ?),
            actualizado_en = ?,
            activo = 1,
            id_user = COALESCE(afiliados.id_user, ?),
            cibir_acreditado = ?
          RETURNING id_afiliado`,
    args: [
      finalIdPersona,
      safeEmpresaId,
      determinedTipoAfiliado,
      targetStatus,
      safeNextCode,
      safeFechaAfiliacion,
      now,
      safeUserId,
      convalidadoVal,
      targetStatus,
      safeNextCode,
      safeFechaAfiliacion,
      now,
      safeUserId,
      convalidadoVal
    ]
  })

  const insertedAfiliadoId = resIns.rows[0]?.id_afiliado as number || null

  // 5. Vincular estudiante
  await db.execute({
    sql: `UPDATE estudiantes 
          SET id_user = ?, 
              tipo = ?, 
              actualizado_en = ? 
          WHERE id_estudiante = ?`,
    args: [
      userId,
      est.id_empresa ? 'Corporativo' : 'Afiliado',
      now,
      idEstudiante
    ]
  })

  // 6. Asignar rol 'afiliado' en users
  let roles: string[] = []
  if (typeof user.roles === 'string' && user.roles.startsWith('[')) {
    try {
      roles = JSON.parse(user.roles)
    } catch {
      roles = [user.roles]
    }
  } else if (typeof user.roles === 'string') {
    roles = [user.roles]
  }

  if (!roles.includes('afiliado')) {
    roles.push('afiliado')
  }

  await db.execute({
    sql: `UPDATE users SET roles = ?, actualizado_en = ? WHERE id = ?`,
    args: [JSON.stringify(roles), now, userId]
  })

  if (insertedAfiliadoId) {
    try {
      await ensureCibirCertificate(Number(insertedAfiliadoId))
    } catch (e) {
      console.error('Error ensuring CIBIR certificate in convalidation:', e)
    }
  }

  return insertedAfiliadoId
}

/**
 * PATCH /api/academia/inscripciones/:id/remitir-cibir
 * Redirige a un aspirante que no es apto para acreditación directa hacia el programa CIBIR.
 * Le otorga acceso al sistema con estatus '5_CIBIR' (pendiente).
 */
export const adminRemitirACibir = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) {
      res.status(400).json({ success: false, message: 'id inválido' })
      return
    }

    const now = new Date().toISOString()

    // 1. Obtener datos actuales
    const currentRes = await db.execute({
      sql: `SELECT ic.*, 
                   COALESCE(p.email, emp.email) as email,
                   COALESCE(p.nombres || ' ' || p.apellidos, emp.razon_social) as nombre_completo
            FROM inscripciones_cursos ic
            JOIN estudiantes e ON e.id_estudiante = ic.id_estudiante
            LEFT JOIN personas p ON e.id_persona = p.id
            LEFT JOIN empresas emp ON e.id_empresa = emp.id_empresa
            WHERE ic.id_inscripcion = ?`,
      args: [id]
    })

    if (currentRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Inscripción no encontrada' })
      return
    }

    const row = currentRes.rows[0] as any

    if (row.estatus !== 'Preinscrito') {
      res.status(400).json({ success: false, message: 'La inscripción debe estar en estatus Preinscrito para ser remitida.' })
      return
    }

    // 2. Marcar como 'Inscrito' (o mantener AFILIACION pero procesado)
    // Para simplificar, lo aprobamos como 'Inscrito' sin cambiar el programa_codigo (sigue siendo AFILIACION)
    await db.execute({
      sql: `UPDATE inscripciones_cursos 
            SET estatus='Inscrito', aprobado_por=?, actualizado_en=?, nota_admin='Remitido a CIBIR por falta de requisitos de acreditación directa.'
            WHERE id_inscripcion=?`,
      args: [req.user?.id || null, now, id]
    })

    let tokenToUse = randomUUID()
    let shouldSendToken = false

    // 3. Crear/Verificar Acceso de Usuario
    try {
      const userRes = await db.execute({
        sql: `SELECT id FROM users WHERE email = ?`,
        args: [row.email]
      })
      const existingUser = userRes.rows[0] as any

      if (!existingUser) {
        shouldSendToken = true
        const placeholderPass = await bcrypt.hash(randomUUID(), 10)

        await db.execute({
          sql: `INSERT INTO users (email, password_hash, roles)
                VALUES (?, ?, '["estudiante", "afiliado"]')`,
          args: [row.email, placeholderPass]
        })
      } else {
        // Check if there is an unused reset_password token
        const tokCheck = await db.execute({
          sql: `SELECT id FROM tokens_accion WHERE email = ? AND tipo = 'reset_password' AND usado = 0 AND fecha_expiracion > ? LIMIT 1`,
          args: [row.email, now]
        })
        if (tokCheck.rows.length > 0) {
          shouldSendToken = true
        }
      }

      if (shouldSendToken) {
        const expiracion = new Date()
        expiracion.setDate(expiracion.getDate() + 30) // 30 días de validez
        // clean up old tokens
        await db.execute({
          sql: `DELETE FROM tokens_accion WHERE email = ? AND tipo = 'reset_password'`,
          args: [row.email]
        })
        const tokenHash = sha256(tokenToUse)
        await db.execute({
          sql: `INSERT INTO tokens_accion (token, tipo, email, usado, fecha_expiracion)
                VALUES (?, 'reset_password', ?, 0, ?)`,
          args: [tokenHash, row.email, expiracion.toISOString()]
        })
      }
    } catch (err) {
      console.error('Error preparando acceso para CIBIR:', err)
    }

    // 4. Vincular como Afiliado con estatus '5_CIBIR'
    try {
      await promocionarYVincularAfiliado(row.id_estudiante, row.email, now, '5_CIBIR')
    } catch (err) {
      console.error('Error al mapear preinscripción a CIBIR:', err)
    }

    // 5. Enviar correo de invitación a CIBIR
    try {
      await enviarCorreoInvitacionCibir({
        nombre: row.nombre_completo,
        emailOriginal: row.email,
        token: shouldSendToken ? tokenToUse : undefined
      })
    } catch (err) {
      console.error('Error enviando correo de invitación CIBIR:', err)
    }

    res.json({ success: true, message: 'Aspirante remitido a CIBIR correctamente.' })
  } catch (error) {
    console.error('adminRemitirACibir:', error)
    res.status(500).json({ success: false, message: 'Error al remitir a CIBIR' })
  }
}

/**
 * PATCH /api/academia/inscripciones/:id/finalizar-entrevista
 * Procesa el resultado final de la entrevista (Aprobado, Parcial, Rechazado).
 */
export const adminFinalizarEntrevista = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id)
    const { resultado, modulosConvalidados, notaAdmin } = req.body // resultado: 'Aprobado' | 'Parcial' | 'Rechazado'

    if (!Number.isFinite(id)) {
      res.status(400).json({ success: false, message: 'id inválido' })
      return
    }

    if (!['Aprobado', 'Parcial', 'Rechazado'].includes(resultado)) {
      res.status(400).json({ success: false, message: 'Resultado inválido' })
      return
    }

    const now = new Date().toISOString()

    // Obtener datos actuales
    const currentRes = await db.execute({
      sql: `SELECT ic.*, 
                   COALESCE(p.email, emp.email) as email,
                   COALESCE(p.nombres || ' ' || p.apellidos, emp.razon_social) as nombre_completo
            FROM inscripciones_cursos ic
            JOIN estudiantes e ON e.id_estudiante = ic.id_estudiante
            LEFT JOIN personas p ON e.id_persona = p.id
            LEFT JOIN empresas emp ON e.id_empresa = emp.id_empresa
            WHERE ic.id_inscripcion = ?`,
      args: [id]
    })

    if (currentRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Inscripción no encontrada' })
      return
    }

    const row = currentRes.rows[0] as any

    if (resultado === 'Rechazado') {
      await db.execute({
        sql: `UPDATE inscripciones_cursos 
              SET estatus='Rechazado', nota_admin=?, aprobado_por=?, actualizado_en=?
              WHERE id_inscripcion=?`,
        args: [notaAdmin || null, req.user?.id || null, now, id]
      })

      await db.execute({
        sql: `UPDATE entrevistas SET estatus='Realizada', actualizado_en=? WHERE id_inscripcion=? AND eliminado_en IS NULL`,
        args: [now, id]
      })

      // Notificar por correo
      await enviarCorreoResultadoEntrevista({
        nombre: row.nombre_completo,
        emailOriginal: row.email,
        resultado: 'Rechazado',
        programaCodigo: row.programa_codigo || 'Curso'
      }).catch(e => console.error('Error enviando correo rechazo entrevista:', e))

      res.json({ success: true, message: 'Postulación rechazada.' })
      return
    }

    // Aprobación (Total o Parcial)
    await db.execute({
      sql: `UPDATE inscripciones_cursos 
            SET estatus='Inscrito', aprobado_por=?, actualizado_en=?
            WHERE id_inscripcion=?`,
      args: [req.user?.id || null, now, id]
    })

    await db.execute({
      sql: `UPDATE entrevistas SET estatus='Realizada', actualizado_en=? WHERE id_inscripcion=? AND eliminado_en IS NULL`,
      args: [now, id]
    })

    let insertedAfiliadoId: number | null = null
    let tokenToUse = randomUUID()
    let shouldSendToken = false

    // Crear/Verificar Acceso
    try {
      const userRes = await db.execute({
        sql: `SELECT id FROM users WHERE email = ?`,
        args: [row.email]
      })
      const existingUser = userRes.rows[0] as any

      if (!existingUser) {
        shouldSendToken = true
        const placeholderPass = await bcrypt.hash(randomUUID(), 10)
        const defaultRoles = row.programa_codigo === 'AFILIACION' ? '["estudiante", "afiliado"]' : '["estudiante"]'

        await db.execute({
          sql: `INSERT INTO users (email, password_hash, roles)
                VALUES (?, ?, ?)`,
          args: [row.email, placeholderPass, defaultRoles]
        })
      } else {
        // Check if there is an unused reset_password token
        const tokCheck = await db.execute({
          sql: `SELECT id FROM tokens_accion WHERE email = ? AND tipo = 'reset_password' AND usado = 0 AND fecha_expiracion > ? LIMIT 1`,
          args: [row.email, now]
        })
        if (tokCheck.rows.length > 0) {
          shouldSendToken = true
        }
      }

      if (shouldSendToken) {
        const expiracion = new Date()
        expiracion.setDate(expiracion.getDate() + 30) // 30 días de validez
        // clean up old tokens
        await db.execute({
          sql: `DELETE FROM tokens_accion WHERE email = ? AND tipo = 'reset_password'`,
          args: [row.email]
        })
        const tokenHash = sha256(tokenToUse)
        await db.execute({
          sql: `INSERT INTO tokens_accion (token, tipo, email, usado, fecha_expiracion)
                VALUES (?, 'reset_password', ?, 0, ?)`,
          args: [tokenHash, row.email, expiracion.toISOString()]
        })
      }
    } catch (err) {
      console.error('Error preparando acceso:', err)
    }

    // --- PUENTE HACIA AFILIADOS (Si es AFILIACION) ---
    if (row.programa_codigo === 'AFILIACION') {
      try {
        const targetStatus = resultado === 'Parcial' ? '5_CIBIR' : 'Afiliado'
        insertedAfiliadoId = await promocionarYVincularAfiliado(row.id_estudiante, row.email, now, targetStatus)
      } catch (err) {
        console.error('Error al mapear entrevista aprobada a afiliado:', err)
      }
    }
    // --------------------------------------------------

    // Registrar módulos CIEBO
    if (resultado === 'Aprobado' || (resultado === 'Parcial' && Array.isArray(modulosConvalidados))) {
      const modulos = resultado === 'Aprobado' ? [1, 2, 3, 4, 5] : modulosConvalidados

      const targetAfiliadoId = row.id_afiliado || insertedAfiliadoId
      if (targetAfiliadoId) {
        for (const num of modulos) {
          await db.execute({
            sql: `INSERT INTO acreditaciones_cibir (id_afiliado, modulo, estatus, evaluado_por)
                  VALUES (?, ?, 'aprobado', ?)
                  ON CONFLICT(id_afiliado, modulo) DO UPDATE SET estatus='aprobado', fecha_evaluacion=strftime('%Y-%m-%dT%H:%M:%SZ','now')`,
            args: [targetAfiliadoId, num, req.user?.id || null]
          })
        }
      } else {
        console.warn('adminFinalizarEntrevista: No se encontró id_afiliado para convalidar módulos CIBIR')
      }
    }

    // Correo de bienvenida definitivo
    try {
      await enviarCorreoResultadoEntrevista({
        nombre: row.nombre_completo,
        emailOriginal: row.email,
        resultado: resultado as 'Aprobado' | 'Parcial' | 'Rechazado',
        programaCodigo: row.programa_codigo || 'Curso',
        token: shouldSendToken ? tokenToUse : undefined
      })
    } catch (err) {
      console.error('Error enviando correo de bienvenida:', err)
    }

    res.json({ success: true, message: `Inscripción finalizada como ${resultado}.` })
  } catch (error) {
    console.error('adminFinalizarEntrevista:', error)
    res.status(500).json({ success: false, message: 'Error al finalizar entrevista' })
  }
}

/**
 * PATCH /api/academia/inscripciones/:id/aprobar-directo
 * Aprueba una preinscripción sin pasar por entrevista.
 * Genera acceso al portal y notifica al estudiante.
 */
export const adminAprobarModulo = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) {
      res.status(400).json({ success: false, message: 'id inválido' })
      return
    }

    const now = new Date().toISOString()

    // Obtener datos actuales
    const currentRes = await db.execute({
      sql: `SELECT ic.*, 
                   COALESCE(p.email, emp.email) as email,
                   COALESCE(p.nombres || ' ' || p.apellidos, emp.razon_social) as nombre_completo
            FROM inscripciones_cursos ic
            JOIN estudiantes e ON e.id_estudiante = ic.id_estudiante
            LEFT JOIN personas p ON e.id_persona = p.id
            LEFT JOIN empresas emp ON e.id_empresa = emp.id_empresa
            WHERE ic.id_inscripcion = ?`,
      args: [id]
    })

    if (currentRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Inscripción no encontrada' })
      return
    }

    const row = currentRes.rows[0] as any

    if (row.estatus !== 'Preinscrito') {
      res.status(400).json({ success: false, message: 'La inscripción debe estar en estatus Preinscrito para aprobación directa.' })
      return
    }

    // Aprobación Directa (Completado)
    await db.execute({
      sql: `UPDATE inscripciones_cursos 
            SET estatus='Inscrito', completado=1, aprobado_por=?, actualizado_en=?
            WHERE id_inscripcion=?`,
      args: [req.user?.id || null, now, id]
    })

    let tokenToUse = randomUUID()
    let shouldSendToken = false

    // Crear/Verificar Acceso
    try {
      const userRes = await db.execute({
        sql: `SELECT id FROM users WHERE email = ?`,
        args: [row.email]
      })
      const existingUser = userRes.rows[0] as any

      if (!existingUser) {
        shouldSendToken = true
        const placeholderPass = await bcrypt.hash(randomUUID(), 10)
        const defaultRoles = row.programa_codigo === 'AFILIACION' ? '["estudiante", "afiliado"]' : '["estudiante"]'

        await db.execute({
          sql: `INSERT INTO users (email, password_hash, roles)
                VALUES (?, ?, ?)`,
          args: [row.email, placeholderPass, defaultRoles]
        })
      } else {
        // Check if there is an unused reset_password token
        const tokCheck = await db.execute({
          sql: `SELECT id FROM tokens_accion WHERE email = ? AND tipo = 'reset_password' AND usado = 0 AND fecha_expiracion > ? LIMIT 1`,
          args: [row.email, now]
        })
        if (tokCheck.rows.length > 0) {
          shouldSendToken = true
        }
      }

      if (shouldSendToken) {
        const expiracion = new Date()
        expiracion.setDate(expiracion.getDate() + 30) // 30 días de validez
        const tokenHash = sha256(tokenToUse)
        // clean up old tokens
        await db.execute({
          sql: `DELETE FROM tokens_accion WHERE email = ? AND tipo = 'reset_password'`,
          args: [row.email]
        })
        await db.execute({
          sql: `INSERT INTO tokens_accion (token, tipo, email, usado, fecha_expiracion)
                VALUES (?, 'reset_password', ?, 0, ?)`,
          args: [tokenHash, row.email, expiracion.toISOString()]
        })
      }
    } catch (err) {
      console.error('Error preparando acceso directo:', err)
    }

    // --- PUENTE HACIA AFILIADOS (Si es AFILIACION) ---
    if (row.programa_codigo === 'AFILIACION') {
      try {
        await promocionarYVincularAfiliado(row.id_estudiante, row.email, now, 'Afiliado')
      } catch (err) {
        console.error('Error promocionando afiliado en aprobación directa:', err)
      }
    }

    // Enviar correo de bienvenida/invitación de acceso (mismo correo que botón Invitar del panel)
    try {
      const { enviarCorreoOnboardingMasivo } = await import('../lib/email.js')
      await enviarCorreoOnboardingMasivo(row.nombre_completo, row.email, tokenToUse)
    } catch (err) {
      console.error('Error enviando correo de acceso directo:', err)
    }

    res.json({ success: true, message: 'Inscripción aprobada correctamente.' })
  } catch (error) {
    console.error('adminAprobarPreinscripcionDirecta:', error)
    res.status(500).json({ success: false, message: 'Error al aprobar preinscripción' })
  }
}

/**
 * PATCH /api/academia/inscripciones/:id/rechazar
 */
export const adminRechazarPreinscripcion = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) {
      res.status(400).json({ success: false, message: 'id inválido' })
      return
    }
    const notaAdmin = typeof req.body?.notaAdmin === 'string' ? req.body.notaAdmin.trim() : null
    const now = new Date().toISOString()

    // Primero, obtener el estado actual para ver si estaba 'Inscrito' previamente y devolver cupo
    const current = await db.execute({
      sql: `SELECT estatus, id_curso FROM inscripciones_cursos WHERE id_inscripcion=?`,
      args: [id]
    });

    const result = await db.execute({
      sql: `UPDATE inscripciones_cursos
            SET estatus='Rechazado', nota_admin=COALESCE(?, nota_admin), aprobado_por=?, actualizado_en=?
            WHERE id_inscripcion=? AND estatus IN ('Preinscrito', 'Entrevista', 'Inscrito')
            RETURNING *`,
      args: [notaAdmin, req.user?.id ?? null, now, id],
    })

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Preinscripción no encontrada o ya procesada' })
      return
    }

    // No es necesario actualizar cupos_disponibles (se calculan dinámicamente)

    // Obtener detalles del estudiante para enviar el correo de rechazo
    try {
      const details = await db.execute({
        sql: `SELECT ic.programa_codigo,
                     p.nombres, p.apellidos, p.email,
                     e.razon_social, e.email as empresa_email
              FROM inscripciones_cursos ic
              JOIN estudiantes est ON ic.id_estudiante = est.id_estudiante
              LEFT JOIN personas p ON est.id_persona = p.id
              LEFT JOIN empresas e ON est.id_empresa = e.id_empresa
              WHERE ic.id_inscripcion = ? LIMIT 1`,
        args: [id]
      })

      if (details.rows.length > 0) {
        const row = details.rows[0] as any
        const isCorp = !!row.razon_social
        const emailOriginal = isCorp ? (row.empresa_email || row.email) : row.email
        const nombre = isCorp 
          ? (row.razon_social || `${row.nombres || ''} ${row.apellidos || ''}`.trim())
          : `${row.nombres || ''} ${row.apellidos || ''}`.trim()

        await enviarCorreoRechazo({
          nombre,
          emailOriginal,
          programaCodigo: row.programa_codigo || 'Curso',
          motivo: notaAdmin
        })
      }
    } catch (err) {
      console.error('Error al enviar correo de rechazo de preinscripción:', err)
    }

    res.json({ success: true, message: 'Preinscripción rechazada.', data: result.rows[0] })
  } catch (error) {
    console.error('adminRechazarPreinscripcion:', error)
    res.status(500).json({ success: false, message: 'Error al rechazar preinscripción' })
  }
}

/**
 * DELETE /api/academia/inscripciones/:id
 * Elimina por completo una solicitud de inscripción y limpia datos relacionados si es la única del estudiante.
 */
export const adminDeleteInscripcion = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) {
      res.status(400).json({ success: false, message: 'ID de inscripción inválido' })
      return
    }

    // 1. Obtener la inscripción y sus relaciones
    const insRes = await db.execute({
      sql: `SELECT ic.*, e.id_persona, e.id_empresa, 
                   p.email as persona_email, emp.email as empresa_email
            FROM inscripciones_cursos ic
            JOIN estudiantes e ON e.id_estudiante = ic.id_estudiante
            LEFT JOIN personas p ON e.id_persona = p.id
            LEFT JOIN empresas emp ON e.id_empresa = emp.id_empresa
            WHERE ic.id_inscripcion = ?`,
      args: [id]
    })

    if (insRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Inscripción no encontrada' })
      return
    }

    const ins = insRes.rows[0] as any
    const idEstudiante = ins.id_estudiante
    const idPersona = ins.id_persona
    const idEmpresa = ins.id_empresa
    const email = ins.persona_email || ins.empresa_email

    // 2. Verificar cuántas inscripciones tiene este estudiante
    const otherInsRes = await db.execute({
      sql: `SELECT COUNT(*) as count FROM inscripciones_cursos WHERE id_estudiante = ? AND id_inscripcion != ?`,
      args: [idEstudiante, id]
    })
    const hasOtherInscriptions = Number(otherInsRes.rows[0]?.count ?? 0) > 0

    // 3. Borrar la inscripción actual
    await db.execute({
      sql: `DELETE FROM inscripciones_cursos WHERE id_inscripcion = ?`,
      args: [id]
    })

    // Si es el único registro de este estudiante, podemos hacer una limpieza profunda
    if (!hasOtherInscriptions) {
      // Verificar si ya es un afiliado activo (estatus = 'Afiliado' y activo = 1)
      let esAfiliadoActivo = false
      if (idPersona || idEmpresa) {
        const afCheck = await db.execute({
          sql: `SELECT COUNT(*) as count FROM afiliados 
                WHERE (id_persona = ? OR (id_empresa = ? AND id_empresa IS NOT NULL)) 
                  AND estatus = 'Afiliado' AND activo = 1`,
          args: [idPersona || -1, idEmpresa || -1]
        })
        esAfiliadoActivo = Number(afCheck.rows[0]?.count ?? 0) > 0
      }

      if (!esAfiliadoActivo) {
        // a. Borrar documentos
        await db.execute({
          sql: `DELETE FROM documentos WHERE entidad_tipo = 'estudiante' AND entidad_id = ?`,
          args: [idEstudiante]
        })

        // c. Borrar estudiante (Mantener el afiliado intacto)
        await db.execute({
          sql: `DELETE FROM estudiantes WHERE id_estudiante = ?`,
          args: [idEstudiante]
        })

        // d. Si hay email, buscar y borrar el usuario
        if (email) {
          // Verificar si el usuario está asociado a alguna otra persona o empresa
          const otherUserUsage = await db.execute({
            sql: `SELECT 
                    (SELECT COUNT(*) FROM personas WHERE email = ?) +
                    (SELECT COUNT(*) FROM empresas WHERE email = ?) +
                    (SELECT COUNT(*) FROM estudiantes WHERE id_user = (SELECT id FROM users WHERE email = ?)) as count`,
            args: [email, email, email]
          })
          const isUserUsedElsewhere = Number(otherUserUsage.rows[0]?.count ?? 0) > 0

          if (!isUserUsedElsewhere) {
            await db.execute({
              sql: `DELETE FROM users WHERE email = ?`,
              args: [email]
            })
          }
        }

        // e. Borrar afiliado no activo si aplica
        if (idPersona) {
          await db.execute({
            sql: `DELETE FROM afiliados WHERE id_persona = ? AND estatus <> 'Afiliado' AND estatus <> '5_CIBIR'`,
            args: [idPersona]
          })

          const otherPersonaUsage = await db.execute({
            sql: `SELECT 
                    (SELECT COUNT(*) FROM afiliados WHERE id_persona = ?) +
                    (SELECT COUNT(*) FROM estudiantes WHERE id_persona = ?) as count`,
            args: [idPersona, idPersona]
          })
          const isPersonaUsedElsewhere = Number(otherPersonaUsage.rows[0]?.count ?? 0) > 0

          if (!isPersonaUsedElsewhere) {
            await db.execute({
              sql: `DELETE FROM personas WHERE id = ?`,
              args: [idPersona]
            })
          }
        }

        // f. Borrar empresa (si no está asociada a ningún otro registro)
        if (idEmpresa) {
          const otherEmpresaUsage = await db.execute({
            sql: `SELECT 
                    (SELECT COUNT(*) FROM afiliados WHERE id_empresa = ?) +
                    (SELECT COUNT(*) FROM estudiantes WHERE id_empresa = ?) as count`,
            args: [idEmpresa, idEmpresa]
          })
          const isEmpresaUsedElsewhere = Number(otherEmpresaUsage.rows[0]?.count ?? 0) > 0

          if (!isEmpresaUsedElsewhere) {
            await db.execute({
              sql: `DELETE FROM empresas WHERE id_empresa = ?`,
              args: [idEmpresa]
            })
          }
        }
      }
    }

    res.json({ success: true, message: 'Solicitud e inscripción borradas completamente.' })
  } catch (error) {
    console.error('adminDeleteInscripcion:', error)
    res.status(500).json({ success: false, message: 'Error al borrar la solicitud de inscripción' })
  }
}


/**
 * PATCH /api/academia/inscripciones/:id/completar
 * Marca un curso como completado por el estudiante.
 */
export const adminCompletarCursoEstudiante = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) {
      res.status(400).json({ success: false, message: 'id inválido' })
      return
    }
    const result = await db.execute({
      sql: `UPDATE inscripciones_cursos
            SET completado=1, actualizado_en=?
            WHERE id_inscripcion=? AND estatus='Inscrito'
            RETURNING *`,
      args: [new Date().toISOString(), id],
    })
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Inscripción no encontrada o estudiante no está inscrito' })
      return
    }
    await emitirComprobanteSiCompleto(id)
    res.json({ success: true, message: 'Estudiante marcado como completado.', data: result.rows[0] })
  } catch (error) {
    console.error('adminCompletarCursoEstudiante:', error)
    res.status(500).json({ success: false, message: 'Error al actualizar inscripción' })
  }
}

/**
 * GET /api/academia/estudiantes?query=
 * Lista estudiantes (admin). Pensado para panel "Estudiantes Regulares".
 */
export const adminListEstudiantes = async (req: Request, res: Response): Promise<void> => {
  try {
    const query = typeof req.query?.query === 'string' ? req.query.query.trim().toLowerCase() : ''

    const where = query
      ? `WHERE (tipo NOT IN ('Juridico', 'Afiliado', 'Corporativo')) AND (lower(nombre_completo) LIKE ? OR lower(email) LIKE ? OR lower(COALESCE(cedula,'')) LIKE ?)`
      : `WHERE tipo NOT IN ('Juridico', 'Afiliado', 'Corporativo')`
    const args = query ? [`%${query}%`, `%${query}%`, `%${query}%`] : []

    const result = await db.execute({
      sql: `
        SELECT 
          e.id_estudiante, 
          e.id_persona, 
          e.id_empresa, 
          COALESCE(p.cedula, emp.rif_numero) as cedula, 
          COALESCE(NULLIF(TRIM(COALESCE(p.nombres, '') || ' ' || COALESCE(p.apellidos, '')), ''), emp.razon_social) as nombre_completo, 
          COALESCE(p.email, emp.email) as email, 
          COALESCE(p.telefono, emp.telefono) as telefono, 
          e.tipo, 
          e.creado_en, 
          e.actualizado_en
        FROM estudiantes e
        LEFT JOIN personas p ON e.id_persona = p.id
        LEFT JOIN empresas emp ON e.id_empresa = emp.id_empresa
        ${where.replace(/nombre_completo/g, "COALESCE(p.nombres || ' ' || p.apellidos, emp.razon_social)").replace(/email/g, "COALESCE(p.email, emp.email)").replace(/cedula/g, "COALESCE(p.cedula, emp.rif_numero)")}
        ORDER BY e.creado_en DESC
        LIMIT 250
      `,
      args,
    })

    res.json({ success: true, data: result.rows })
  } catch (error) {
    console.error('adminListEstudiantes:', error)
    res.status(500).json({ success: false, message: 'Error al obtener estudiantes' })
  }
}

/**
 * GET /api/academia/estudiantes/:id
 * Devuelve estudiante + sus inscripciones (programa o curso).
 */
export const adminGetEstudiante = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) {
      res.status(400).json({ success: false, message: 'id inválido' })
      return
    }

    const est = await db.execute({
      sql: `SELECT e.*, 
                   COALESCE(p.cedula, emp.rif_numero) as cedula, 
                   COALESCE(NULLIF(TRIM(COALESCE(p.nombres, '') || ' ' || COALESCE(p.apellidos, '')), ''), emp.razon_social) as nombre_completo, 
                   COALESCE(p.email, emp.email) as email, 
                   COALESCE(p.telefono, emp.telefono) as telefono
            FROM estudiantes e 
            LEFT JOIN personas p ON e.id_persona = p.id
            LEFT JOIN empresas emp ON e.id_empresa = emp.id_empresa
            WHERE e.id_estudiante = ? LIMIT 1`,
      args: [id],
    })
    if (est.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Estudiante no encontrado' })
      return
    }

    const insc = await db.execute({
      sql: `
        SELECT
          ic.*,
          c.nombre as curso_nombre,
          c.estatus as curso_estatus
        FROM inscripciones_cursos ic
        LEFT JOIN cursos c ON c.id_curso = ic.id_curso
        WHERE ic.id_estudiante = ?
        ORDER BY ic.creado_en DESC
      `,
      args: [id],
    })

    res.json({ success: true, data: { estudiante: est.rows[0], inscripciones: insc.rows } })
  } catch (error) {
    console.error('adminGetEstudiante:', error)
    res.status(500).json({ success: false, message: 'Error al obtener estudiante' })
  }
}

/**
 * Helpers re-exported to keep route files small.
 */
export const academiaAdminGuards = [requireAuth, requireRole('admin', 'super_admin', 'asistente', 'administrativo')] as const

/**
 * GET /api/academia/estudiantes/:id/documentos
 * Devuelve todos los documentos adjuntos de un estudiante.
 */
export const adminGetEstudianteDocumentos = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) {
      res.status(400).json({ success: false, message: 'id inválido' })
      return
    }
    const result = await db.execute({
      sql: `SELECT id_documento, tipo_archivo as tipo_doc, url, nombre_archivo, fecha_subida as creado_en
            FROM documentos
            WHERE entidad_tipo = 'estudiante' AND entidad_id = ? AND eliminado_en IS NULL
            ORDER BY tipo_archivo, fecha_subida ASC`,
      args: [id],
    })
    res.json({ success: true, data: result.rows })
  } catch (error) {
    console.error('adminGetEstudianteDocumentos:', error)
    res.status(500).json({ success: false, message: 'Error al obtener documentos' })
  }
}

export const adminCambiarEtapaInscripcion = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id)
    const { etapa } = req.body // etapa: 0 | 1 | 2 | 3 | 4 | 5 | 6
    if (!Number.isFinite(id) || etapa === undefined || etapa < 0 || etapa > 6) {
      res.status(400).json({ success: false, message: 'Parámetros inválidos' })
      return
    }

    const now = new Date().toISOString()

    // 1. Obtener datos de la inscripción
    const currentRes = await db.execute({
      sql: `SELECT ic.*, 
                   COALESCE(p.email, emp.email) as email,
                   COALESCE(p.nombres || ' ' || p.apellidos, emp.razon_social) as nombre_completo
            FROM inscripciones_cursos ic
            JOIN estudiantes e ON e.id_estudiante = ic.id_estudiante
            LEFT JOIN personas p ON e.id_persona = p.id
            LEFT JOIN empresas emp ON e.id_empresa = emp.id_empresa
            WHERE ic.id_inscripcion = ?`,
      args: [id]
    })

    if (currentRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Inscripción no encontrada' })
      return
    }

    const row = currentRes.rows[0] as any

    // Map stage index to inscripciones_cursos.estatus
    let targetInscripcionStatus = 'Preinscrito'
    if (etapa === 2) {
      targetInscripcionStatus = 'Entrevista'
    } else if (etapa >= 3) {
      targetInscripcionStatus = 'Inscrito'
    }

    // Actualizar inscripciones_cursos
    await db.execute({
      sql: `UPDATE inscripciones_cursos 
            SET estatus=?, aprobado_por=?, actualizado_en=?
            WHERE id_inscripcion=?`,
      args: [targetInscripcionStatus, req.user?.id || null, now, id]
    })

    const statusValues: string[] = [
      '1_PREINSCRIPCION',
      '2_EXPEDIENTE',
      '3_ENTREVISTA',
      '4_VERIFICACION',
      '5_CIBIR',
      '6_INSCRIPCION',
      'Afiliado'
    ]
    const targetAfiliadoStatus = statusValues[etapa]

    // 2. Crear acceso al portal si pasa a 'Inscrito' (etapa >= 3)
    if (targetInscripcionStatus === 'Inscrito' && row.email) {
      try {
        const userRes = await db.execute({
          sql: `SELECT id FROM users WHERE email = ?`,
          args: [row.email]
        })
        const existingUser = userRes.rows[0] as any

        let tokenToUse: string | undefined = undefined
        let shouldSendToken = false

        if (!existingUser) {
          shouldSendToken = true
          tokenToUse = randomUUID()
          const placeholderPass = await bcrypt.hash(randomUUID(), 10)
          const defaultRoles = (row.programa_codigo === 'AFILIACION' && targetAfiliadoStatus === 'Afiliado') ? '["estudiante", "afiliado"]' : '["estudiante"]'

          await db.execute({
            sql: `INSERT INTO users (email, password_hash, roles)
                  VALUES (?, ?, ?)`,
            args: [row.email, placeholderPass, defaultRoles]
          })
        } else if (etapa === 5 || etapa === 6) {
          // El usuario ya existe. Check if there is an unused reset_password token (indicating they haven't set their password yet)
          const tokCheck = await db.execute({
            sql: `SELECT id FROM tokens_accion WHERE email = ? AND tipo = 'reset_password' AND usado = 0 AND fecha_expiracion > ? LIMIT 1`,
            args: [row.email, now]
          })
          if (tokCheck.rows.length > 0) {
            shouldSendToken = true
            tokenToUse = randomUUID()
          }
        }

        if (shouldSendToken && tokenToUse) {
          const expiracion = new Date()
          expiracion.setDate(expiracion.getDate() + 30) // 30 días de validez
          
          await db.execute({
            sql: `DELETE FROM tokens_accion WHERE email = ? AND tipo = 'reset_password'`,
            args: [row.email]
          })
          const tokenHash = sha256(tokenToUse)
          await db.execute({
            sql: `INSERT INTO tokens_accion (token, tipo, email, usado, fecha_expiracion)
                  VALUES (?, 'reset_password', ?, 0, ?)`,
            args: [tokenHash, row.email, expiracion.toISOString()]
          })
        }

        // Si se cambia a la etapa 4 (CIBIR), notificar por correo de invitación CIBIR
        if (etapa === 4) {
          try {
            await enviarCorreoInvitacionCibir({
              nombre: row.nombre_completo,
              emailOriginal: row.email,
              token: shouldSendToken ? tokenToUse : undefined
            })
          } catch (mailErr) {
            console.error('Error enviando correo de invitación CIBIR en cambio de etapa:', mailErr)
          }
        } else if (etapa === 5 || etapa === 6) {
          try {
            await enviarCorreoResultadoEntrevista({
              nombre: row.nombre_completo,
              emailOriginal: row.email,
              resultado: 'Aprobado',
              programaCodigo: row.programa_codigo || 'Curso',
              token: shouldSendToken ? tokenToUse : undefined
            })
          } catch (mailErr) {
            console.error('Error enviando correo de aprobación en cambio de etapa:', mailErr)
          }
        }
      } catch (err) {
        console.error('Error preparando acceso etapa:', err)
      }
    }

    // 3. Si es programa de AFILIACION, actualizar/crear afiliado vinculando relaciones correspondientes
    if (row.programa_codigo === 'AFILIACION') {
      if (etapa >= 3 && row.email) {
        try {
          await promocionarYVincularAfiliado(row.id_estudiante, row.email, now, targetAfiliadoStatus)
        } catch (err) {
          console.error('Error al promocionar/vincular afiliado en cambio de etapa:', err)
        }
      } else {
        const estRes = await db.execute({
          sql: `SELECT e.id_persona, e.id_empresa, a.id_persona as rep_id_persona
                FROM estudiantes e
                LEFT JOIN empresas emp ON e.id_empresa = emp.id_empresa
                LEFT JOIN afiliados a ON emp.id_representante_legal = a.id_afiliado
                WHERE e.id_estudiante = ?`,
          args: [row.id_estudiante]
        })
        const est = estRes.rows[0] as any

        if (est) {
          const finalIdPersona = est.id_persona || est.rep_id_persona
          if (finalIdPersona) {
            const safeEmpresaId = est.id_empresa ?? null

            const existingAf = await db.execute({
              sql: `SELECT tipo_afiliado FROM afiliados WHERE id_persona = ?`,
              args: [finalIdPersona]
            })
            const existingTipo = existingAf.rows[0]?.tipo_afiliado as string | undefined

            let determinedTipoAfiliado = 'Natural'
            if (safeEmpresaId) {
              if (existingTipo === 'Agente Corporativo' || existingTipo === 'Agente') {
                determinedTipoAfiliado = 'Agente Corporativo'
              } else {
                determinedTipoAfiliado = 'Corporativo'
              }
            } else {
              determinedTipoAfiliado = 'Natural'
            }

            await db.execute({
              sql: `INSERT INTO afiliados (id_persona, id_empresa, tipo_afiliado, estatus, actualizado_en, activo)
                    VALUES (?, ?, ?, ?, ?, 1)
                    ON CONFLICT(id_persona) DO UPDATE SET
                      id_empresa = excluded.id_empresa,
                      tipo_afiliado = excluded.tipo_afiliado,
                      estatus = ?,
                      actualizado_en = ?,
                      activo = 1`,
              args: [
                finalIdPersona,
                safeEmpresaId,
                determinedTipoAfiliado,
                targetAfiliadoStatus,
                now,
                targetAfiliadoStatus,
                now
              ]
            })
          }
        }
      }
    }

    res.json({ success: true, message: 'Etapa del trámite cambiada correctamente.' })
  } catch (error) {
    console.error('adminCambiarEtapaInscripcion:', error)
    res.status(500).json({ success: false, message: 'Error al cambiar etapa de inscripción' })
  }
}

export const adminBuscarReferenciaAfiliado = async (req: Request, res: Response): Promise<void> => {
  try {
    const { nombre } = req.query
    if (typeof nombre !== 'string' || !nombre.trim()) {
      res.status(400).json({ success: false, message: 'El parámetro nombre es requerido' })
      return
    }

    const rawNombre = nombre.trim()

    // 1. Intentar extraer cédula/RIF y nombre limpio
    // Ej: "Piñango Inmobiliaria C.A. (C.I. / RIF: V87654321)"
    let docMatch = rawNombre.match(/(?:C\.I\.\s*\/)?\s*(?:RIF|C\.I\.):\s*([A-Z0-9-]{5,15})/i)
    if (!docMatch) {
      // Intentar extraer cualquier código que parezca cédula/RIF
      docMatch = rawNombre.match(/\b([VJEG]-[0-9]{5,10}-[0-9]|[VJEG][0-9]{5,10})\b/i)
    }
    if (!docMatch) {
      // Intentar extraer sólo números de 6 a 10 dígitos
      docMatch = rawNombre.match(/\b([0-9]{6,10})\b/)
    }

    const extractedDoc = docMatch ? docMatch[1].trim() : null
    const digitsOnlyDoc = extractedDoc ? extractedDoc.replace(/\D/g, '') : null

    // Nombre limpio (quitando los paréntesis y el RIF)
    let nombreLimpio = rawNombre
    const parenIndex = rawNombre.indexOf('(')
    if (parenIndex !== -1) {
      nombreLimpio = rawNombre.substring(0, parenIndex).trim()
    }

    // Remover acentos comunes para búsquedas más amplias si no se encuentra coincidencia exacta
    const nameSearch = `%${nombreLimpio}%`
    const docSearchLike = extractedDoc ? `%${extractedDoc.replace(/[^a-zA-Z0-9]/g, '')}%` : ''
    const digitsSearchLike = digitsOnlyDoc ? `%${digitsOnlyDoc}%` : ''

    // Buscar en afiliados
    let queryResult;
    if (extractedDoc) {
      queryResult = await db.execute({
        sql: `
          SELECT a.id_afiliado, 
                 a.codigo, 
                 a.tipo_afiliado, 
                 a.estatus,
                 (COALESCE(p.nombres, '') || ' ' || COALESCE(p.apellidos, '')) as nombre_persona,
                 p.email as email_persona,
                 p.telefono as telefono_persona,
                 p.cedula as cedula_persona,
                 e.razon_social as razon_social_empresa,
                 e.email as email_empresa,
                 e.telefono as telefono_empresa,
                 e.rif_numero as rif_empresa
          FROM afiliados a
          JOIN personas p ON a.id_persona = p.id
          LEFT JOIN empresas e ON a.id_empresa = e.id_empresa
          WHERE (p.cedula = ?)
             OR (e.rif_numero = ?)
             OR (REPLACE(REPLACE(p.cedula, '-', ''), ' ', '') LIKE ?)
             OR (REPLACE(REPLACE(e.rif_numero, '-', ''), ' ', '') LIKE ?)
             OR (p.cedula = ?)
             OR (e.rif_numero = ?)
             OR (REPLACE(REPLACE(p.cedula, '-', ''), ' ', '') LIKE ?)
             OR (REPLACE(REPLACE(e.rif_numero, '-', ''), ' ', '') LIKE ?)
             OR (COALESCE(p.nombres, '') || ' ' || COALESCE(p.apellidos, '') LIKE ?)
             OR (e.razon_social LIKE ?)
          LIMIT 1
        `,
        args: [
          extractedDoc, extractedDoc, docSearchLike, docSearchLike,
          digitsOnlyDoc || '', digitsOnlyDoc || '', digitsSearchLike, digitsSearchLike,
          nameSearch, nameSearch
        ]
      })
    } else {
      queryResult = await db.execute({
        sql: `
          SELECT a.id_afiliado, 
                 a.codigo, 
                 a.tipo_afiliado, 
                 a.estatus,
                 (COALESCE(p.nombres, '') || ' ' || COALESCE(p.apellidos, '')) as nombre_persona,
                 p.email as email_persona,
                 p.telefono as telefono_persona,
                 p.cedula as cedula_persona,
                 e.razon_social as razon_social_empresa,
                 e.email as email_empresa,
                 e.telefono as telefono_empresa,
                 e.rif_numero as rif_empresa
          FROM afiliados a
          JOIN personas p ON a.id_persona = p.id
          LEFT JOIN empresas e ON a.id_empresa = e.id_empresa
          WHERE (COALESCE(p.nombres, '') || ' ' || COALESCE(p.apellidos, '') LIKE ?)
             OR (e.razon_social LIKE ?)
          LIMIT 1
        `,
        args: [nameSearch, nameSearch]
      })
    }

    if (queryResult.rows.length === 0) {
      res.json({ success: true, data: null })
      return
    }

    const row = queryResult.rows[0] as any
    const nombreCompleto = row.tipo_afiliado === 'Corporativo' && row.razon_social_empresa
      ? row.razon_social_empresa
      : row.nombre_persona

    const email = row.tipo_afiliado === 'Corporativo' && row.email_empresa
      ? row.email_empresa
      : row.email_persona

    const telefono = row.tipo_afiliado === 'Corporativo' && row.telefono_empresa
      ? row.telefono_empresa
      : row.telefono_persona

    const docIdentidad = row.tipo_afiliado === 'Corporativo'
      ? row.rif_empresa
      : row.cedula_persona

    res.json({
      success: true,
      data: {
        id_afiliado: row.id_afiliado,
        codigo: row.codigo,
        tipo_afiliado: row.tipo_afiliado,
        estatus: row.estatus,
        nombre_completo: nombreCompleto,
        email: email,
        telefono: telefono,
        doc_identidad: docIdentidad
      }
    })
  } catch (error) {
    console.error('adminBuscarReferenciaAfiliado:', error)
    res.status(500).json({ success: false, message: 'Error al buscar referencia de afiliado' })
  }
}

export const adminToggleCorredorStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id)
    const { esCorredor } = req.body
    if (!Number.isFinite(id) || esCorredor === undefined) {
      res.status(400).json({ success: false, message: 'Parámetros inválidos' })
      return
    }

    const ins = await db.execute({
      sql: `SELECT id_estudiante FROM inscripciones_cursos WHERE id_inscripcion = ?`,
      args: [id]
    })
    if (ins.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Inscripción no encontrada' })
      return
    }
    const idEstudiante = ins.rows[0].id_estudiante as number

    await db.execute({
      sql: `UPDATE estudiantes SET es_corredor_inmobiliario = ? WHERE id_estudiante = ?`,
      args: [esCorredor ? 1 : 0, idEstudiante]
    })

    res.json({ success: true, message: 'Estado de corredor inmobiliario actualizado' })
  } catch (error) {
    console.error('adminToggleCorredorStatus:', error)
    res.status(500).json({ success: false, message: 'Error al actualizar estado de corredor' })
  }
}

export const adminGetModulosInscripcion = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) {
      res.status(400).json({ success: false, message: 'id de inscripción inválido' })
      return
    }

    const insRes = await db.execute({
      sql: `SELECT ic.id_inscripcion, ic.id_curso, ic.programa_codigo, ic.id_estudiante, ic.completado,
                   c.titulo as curso_nombre, af.estatus as afiliado_estatus
            FROM inscripciones_cursos ic
            JOIN estudiantes e ON e.id_estudiante = ic.id_estudiante
            LEFT JOIN afiliados af ON (e.id_persona = af.id_persona OR (e.id_empresa IS NOT NULL AND e.id_empresa = af.id_empresa))
            LEFT JOIN cursos c ON ic.id_curso = c.id_curso
            WHERE ic.id_inscripcion = ?`,
      args: [id]
    })

    if (insRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Inscripción no encontrada' })
      return
    }

    const ins = insRes.rows[0] as any
    let templateModulos: any[] = []
    let progressModulos: any[] = []

    const isCibir = ins.programa_codigo === 'CIBIR' || (ins.programa_codigo === 'AFILIACION' && ins.afiliado_estatus === '5_CIBIR')

    if (isCibir) {
      templateModulos = [
        { nombre_modulo: 'Módulo 1: Negocio de Bienes Raíces', obligatorio: 1, profesor: null },
        { nombre_modulo: 'Módulo 2: Nociones Jurídicas', obligatorio: 1, profesor: null },
        { nombre_modulo: 'Módulo 3: Comercialización Inmobiliaria', obligatorio: 1, profesor: null },
        { nombre_modulo: 'Módulo 4: Hábitos y Buenas Prácticas', obligatorio: 1, profesor: null },
        { nombre_modulo: 'Módulo 5: Principios de Valoración', obligatorio: 1, profesor: null }
      ]

      const afRes = await db.execute({
        sql: `SELECT id_afiliado FROM afiliados a
              JOIN estudiantes e ON e.id_persona = a.id_persona OR (e.id_empresa IS NOT NULL AND e.id_empresa = a.id_empresa)
              WHERE e.id_estudiante = ? LIMIT 1`,
        args: [ins.id_estudiante]
      })

      if (afRes.rows.length > 0) {
        const idAfiliado = afRes.rows[0].id_afiliado
        const cibirProgRes = await db.execute({
          sql: `SELECT modulo as num_modulo, estatus, evaluado_por, fecha_evaluacion, observaciones as nota_admin
                FROM acreditaciones_cibir
                WHERE id_afiliado = ?`,
          args: [idAfiliado]
        })
        const cibirNombres = [
          'Negocio de Bienes Raíces',
          'Nociones Jurídicas',
          'Comercialización Inmobiliaria',
          'Hábitos y Buenas Prácticas',
          'Principios de Valoración'
        ]
        progressModulos = cibirProgRes.rows.map((r: any) => ({
          ...r,
          nombre_modulo: `Módulo ${r.num_modulo}: ${cibirNombres[r.num_modulo - 1] || ''}`,
          estatus: r.estatus ? r.estatus.charAt(0).toUpperCase() + r.estatus.slice(1).toLowerCase() : 'Pendiente'
        }))
      }
    } else {
      const mcRes = await db.execute({
        sql: `SELECT mc.nombre_modulo, mc.orden, mc.id_profesor,
                     (p.nombres || ' ' || p.apellidos) AS profesor
              FROM modulos_curso mc
              LEFT JOIN profesores prof ON mc.id_profesor = prof.id_profesor
              LEFT JOIN personas p ON prof.id_persona = p.id
              WHERE mc.id_curso = ?
              ORDER BY mc.orden ASC`,
        args: [ins.id_curso || 0]
      })

      templateModulos = mcRes.rows as any[]
      if (templateModulos.length === 0) {
        templateModulos = [{ nombre_modulo: 'Módulo General', id_profesor: null, profesor: null }]
      }

      const miRes = await db.execute({
        sql: `SELECT nombre_modulo, estatus, aprobado_por, fecha_evaluacion, nota_admin FROM modulos_inscripcion WHERE id_inscripcion = ?`,
        args: [id]
      })
      progressModulos = miRes.rows as any[]
    }

    const modulos = templateModulos.map(tm => {
      const prog = progressModulos.find(pm => pm.nombre_modulo === tm.nombre_modulo)
      return {
        nombre_modulo: tm.nombre_modulo,
        id_profesor: tm.id_profesor || null,
        profesor: tm.profesor || null,
        estatus: prog ? prog.estatus : 'Pendiente',
        aprobado_por: prog ? prog.aprobado_por : null,
        fecha_evaluacion: prog ? prog.fecha_evaluacion : null,
        nota_admin: prog ? prog.nota_admin : null
      }
    })

    res.json({
      success: true,
      data: {
        id_inscripcion: ins.id_inscripcion,
        curso_nombre: isCibir ? 'Programa CIBIR' : (ins.curso_nombre || ins.programa_codigo || 'Curso'),
        programa_codigo: isCibir ? 'CIBIR' : ins.programa_codigo,
        completado: ins.completado,
        modulos
      }
    })
  } catch (error) {
    console.error('adminGetModulosInscripcion:', error)
    res.status(500).json({ success: false, message: 'Error al obtener módulos' })
  }
}

export const adminAprobarModuloInscripcion = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id)
    const nombreModulo = req.params.nombre as string
    if (!Number.isFinite(id) || !nombreModulo) {
      res.status(400).json({ success: false, message: 'id de inscripción o nombre de módulo inválido' })
      return
    }

    const userId = (req.user as any)?.id || null
    const now = new Date().toISOString()

    const insRes = await db.execute({
      sql: `SELECT ic.id_inscripcion, ic.id_curso, ic.programa_codigo, ic.id_estudiante, ic.completado,
                   af.estatus as afiliado_estatus
            FROM inscripciones_cursos ic
            JOIN estudiantes e ON e.id_estudiante = ic.id_estudiante
            LEFT JOIN afiliados af ON (e.id_persona = af.id_persona OR (e.id_empresa IS NOT NULL AND e.id_empresa = af.id_empresa))
            WHERE ic.id_inscripcion = ? AND ic.estatus = 'Inscrito'`,
      args: [id]
    })

    if (insRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Inscripción no encontrada o estudiante no está admitido' })
      return
    }

    const ins = insRes.rows[0] as any

    const isCibir = ins.programa_codigo === 'CIBIR' || (ins.programa_codigo === 'AFILIACION' && ins.afiliado_estatus === '5_CIBIR')

    if (isCibir) {
      const afRes = await db.execute({
        sql: `SELECT id_afiliado FROM afiliados a
              JOIN estudiantes e ON e.id_persona = a.id_persona OR (e.id_empresa IS NOT NULL AND e.id_empresa = a.id_empresa)
              WHERE e.id_estudiante = ? LIMIT 1`,
        args: [ins.id_estudiante]
      })

      if (afRes.rows.length === 0) {
        res.status(404).json({ success: false, message: 'Afiliado no encontrado para el estudiante' })
        return
      }

      const idAfiliado = afRes.rows[0].id_afiliado
      const match = nombreModulo.match(/Módulo\s+(\d+)/i)
      const num = match ? Number(match[1]) : 1
      
      await db.execute({
        sql: `INSERT INTO acreditaciones_cibir (id_afiliado, modulo, estatus, evaluado_por, fecha_evaluacion, observaciones)
              VALUES (?, ?, 'aprobado', ?, ?, NULL)
              ON CONFLICT(id_afiliado, modulo) DO UPDATE SET
                estatus = 'aprobado',
                evaluado_por = ?,
                fecha_evaluacion = ?,
                observaciones = NULL`,
        args: [idAfiliado, num, userId, now, userId, now]
      })

      const cibirAproRes = await db.execute({
        sql: `SELECT COUNT(*) as c FROM acreditaciones_cibir WHERE id_afiliado = ? AND estatus = 'aprobado'`,
        args: [idAfiliado]
      })
      const cibirAprobados = Number(cibirAproRes.rows[0].c)

      if (cibirAprobados === 5) {
        await db.execute({
          sql: `UPDATE afiliados SET cibir_acreditado = 1, estatus = '6_INSCRIPCION', fecha_ultimo_cambio_estatus = ? WHERE id_afiliado = ?`,
          args: [now, idAfiliado]
        })
        await db.execute({
          sql: `UPDATE inscripciones_cursos SET completado = 1, actualizado_en = ? WHERE id_inscripcion = ?`,
          args: [now, id]
        })
        const { emitirComprobanteSiCompleto } = await import('../lib/certificados.js')
        await emitirComprobanteSiCompleto(id)
      }
    } else {
      await db.execute({
        sql: `INSERT INTO modulos_inscripcion (id_inscripcion, nombre_modulo, estatus, aprobado_por, fecha_evaluacion, nota_admin)
              VALUES (?, ?, 'Aprobado', ?, ?, NULL)
              ON CONFLICT(id_inscripcion, nombre_modulo) DO UPDATE SET
                estatus = 'Aprobado',
                aprobado_por = ?,
                fecha_evaluacion = ?,
                nota_admin = NULL`,
        args: [id, nombreModulo, userId, now, userId, now]
      })

      const mcRes = await db.execute({
        sql: `SELECT nombre_modulo FROM modulos_curso WHERE id_curso = ?`,
        args: [ins.id_curso || 0]
      })
      let obligatorios = mcRes.rows.map((r: any) => r.nombre_modulo)
      if (obligatorios.length === 0) {
        obligatorios = ['Módulo General']
      }

      const miRes = await db.execute({
        sql: `SELECT nombre_modulo FROM modulos_inscripcion WHERE id_inscripcion = ? AND estatus = 'Aprobado'`,
        args: [id]
      })
      const aprobados = miRes.rows.map((r: any) => r.nombre_modulo)

      const completadoTodo = obligatorios.every(ob => aprobados.includes(ob))

      if (completadoTodo) {
        await db.execute({
          sql: `UPDATE inscripciones_cursos SET completado = 1, actualizado_en = ? WHERE id_inscripcion = ?`,
          args: [now, id]
        })
        const { emitirComprobanteSiCompleto } = await import('../lib/certificados.js')
        await emitirComprobanteSiCompleto(id)
      }
    }

    res.json({ success: true, message: 'Módulo aprobado con éxito' })
  } catch (error) {
    console.error('adminAprobarModuloInscripcion:', error)
    res.status(500).json({ success: false, message: 'Error al aprobar módulo' })
  }
}

export const adminRechazarModuloInscripcion = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id)
    const nombreModulo = req.params.nombre as string
    const { notaAdmin } = req.body
    if (!Number.isFinite(id) || !nombreModulo) {
      res.status(400).json({ success: false, message: 'id de inscripción o nombre de módulo inválido' })
      return
    }

    const userId = (req.user as any)?.id || null
    const now = new Date().toISOString()

    const insRes = await db.execute({
      sql: `SELECT ic.id_inscripcion, ic.id_curso, ic.programa_codigo, ic.id_estudiante,
                   af.estatus as afiliado_estatus
            FROM inscripciones_cursos ic
            JOIN estudiantes e ON e.id_estudiante = ic.id_estudiante
            LEFT JOIN afiliados af ON (e.id_persona = af.id_persona OR (e.id_empresa IS NOT NULL AND e.id_empresa = af.id_empresa))
            WHERE ic.id_inscripcion = ? AND ic.estatus = 'Inscrito'`,
      args: [id]
    })

    if (insRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Inscripción no encontrada o estudiante no está admitido' })
      return
    }

    const ins = insRes.rows[0] as any

    const isCibir = ins.programa_codigo === 'CIBIR' || (ins.programa_codigo === 'AFILIACION' && ins.afiliado_estatus === '5_CIBIR')

    if (isCibir) {
      const afRes = await db.execute({
        sql: `SELECT id_afiliado FROM afiliados a
              JOIN estudiantes e ON e.id_persona = a.id_persona OR (e.id_empresa IS NOT NULL AND e.id_empresa = a.id_empresa)
              WHERE e.id_estudiante = ? LIMIT 1`,
        args: [ins.id_estudiante]
      })

      if (afRes.rows.length === 0) {
        res.status(404).json({ success: false, message: 'Afiliado no encontrado para el estudiante' })
        return
      }

      const idAfiliado = afRes.rows[0].id_afiliado
      const match = nombreModulo.match(/Módulo\s+(\d+)/i)
      const num = match ? Number(match[1]) : 1

      await db.execute({
        sql: `INSERT INTO acreditaciones_cibir (id_afiliado, modulo, estatus, evaluado_por, fecha_evaluacion, observaciones)
              VALUES (?, ?, 'rechazado', ?, ?, ?)
              ON CONFLICT(id_afiliado, modulo) DO UPDATE SET
                estatus = 'rechazado',
                evaluado_por = ?,
                fecha_evaluacion = ?,
                observaciones = ?`,
        args: [idAfiliado, num, userId, now, notaAdmin || null, userId, now, notaAdmin || null]
      })

      await db.execute({
        sql: `UPDATE afiliados SET cibir_acreditado = 0, estatus = '5_CIBIR', fecha_ultimo_cambio_estatus = ? WHERE id_afiliado = ?`,
        args: [now, idAfiliado]
      })
      await db.execute({
        sql: `UPDATE inscripciones_cursos SET completado = 0, actualizado_en = ? WHERE id_inscripcion = ?`,
        args: [now, id]
      })
    } else {
      await db.execute({
        sql: `INSERT INTO modulos_inscripcion (id_inscripcion, nombre_modulo, estatus, aprobado_por, fecha_evaluacion, nota_admin)
              VALUES (?, ?, 'Rechazado', ?, ?, ?)
              ON CONFLICT(id_inscripcion, nombre_modulo) DO UPDATE SET
                estatus = 'Rechazado',
                aprobado_por = ?,
                fecha_evaluacion = ?,
                nota_admin = ?`,
        args: [id, nombreModulo, userId, now, notaAdmin || null, userId, now, notaAdmin || null]
      })

      await db.execute({
        sql: `UPDATE inscripciones_cursos SET completado = 0, actualizado_en = ? WHERE id_inscripcion = ?`,
        args: [now, id]
      })
    }

    res.json({ success: true, message: 'Módulo rechazado con éxito' })
  } catch (error) {
    console.error('adminRechazarModuloInscripcion:', error)
    res.status(500).json({ success: false, message: 'Error al rechazar módulo' })
  }
}

export const adminAprobarTodosModulosInscripcion = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) {
      res.status(400).json({ success: false, message: 'id de inscripción inválido' })
      return
    }

    const userId = (req.user as any)?.id || null
    const now = new Date().toISOString()

    const insRes = await db.execute({
      sql: `SELECT ic.id_inscripcion, ic.id_curso, ic.programa_codigo, ic.id_estudiante, ic.completado,
                   af.estatus as afiliado_estatus
            FROM inscripciones_cursos ic
            JOIN estudiantes e ON e.id_estudiante = ic.id_estudiante
            LEFT JOIN afiliados af ON (e.id_persona = af.id_persona OR (e.id_empresa IS NOT NULL AND e.id_empresa = af.id_empresa))
            WHERE ic.id_inscripcion = ? AND ic.estatus = 'Inscrito'`,
      args: [id]
    })

    if (insRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Inscripción no encontrada o estudiante no está admitido' })
      return
    }

    const ins = insRes.rows[0] as any

    const isCibir = ins.programa_codigo === 'CIBIR' || (ins.programa_codigo === 'AFILIACION' && ins.afiliado_estatus === '5_CIBIR')

    if (isCibir) {
      const afRes = await db.execute({
        sql: `SELECT id_afiliado FROM afiliados a
              JOIN estudiantes e ON e.id_persona = a.id_persona OR (e.id_empresa IS NOT NULL AND e.id_empresa = a.id_empresa)
              WHERE e.id_estudiante = ? LIMIT 1`,
        args: [ins.id_estudiante]
      })

      if (afRes.rows.length === 0) {
        res.status(404).json({ success: false, message: 'Afiliado no encontrado para el estudiante' })
        return
      }

      const idAfiliado = afRes.rows[0].id_afiliado

      for (let num = 1; num <= 5; num++) {
        await db.execute({
          sql: `INSERT INTO acreditaciones_cibir (id_afiliado, modulo, estatus, evaluado_por, fecha_evaluacion, observaciones)
                VALUES (?, ?, 'aprobado', ?, ?, NULL)
                ON CONFLICT(id_afiliado, modulo) DO UPDATE SET
                  estatus = 'aprobado',
                  evaluado_por = ?,
                  fecha_evaluacion = ?,
                  observaciones = NULL`,
          args: [idAfiliado, num, userId, now, userId, now]
        })
      }

      await db.execute({
        sql: `UPDATE afiliados SET cibir_acreditado = 1, estatus = '6_INSCRIPCION', fecha_ultimo_cambio_estatus = ? WHERE id_afiliado = ?`,
        args: [now, idAfiliado]
      })
    } else {
      const mcRes = await db.execute({
        sql: `SELECT nombre_modulo FROM modulos_curso WHERE id_curso = ?`,
        args: [ins.id_curso || 0]
      })
      let numModulos = mcRes.rows.map((r: any) => r.nombre_modulo)
      if (numModulos.length === 0) {
        numModulos = ['Módulo General']
      }

      for (const name of numModulos) {
        await db.execute({
          sql: `INSERT INTO modulos_inscripcion (id_inscripcion, nombre_modulo, estatus, aprobado_por, fecha_evaluacion, nota_admin)
                VALUES (?, ?, 'Aprobado', ?, ?, NULL)
                ON CONFLICT(id_inscripcion, nombre_modulo) DO UPDATE SET
                  estatus = 'Aprobado',
                  aprobado_por = ?,
                  fecha_evaluacion = ?,
                  nota_admin = NULL`,
          args: [id, name, userId, now, userId, now]
        })
      }
    }

    await db.execute({
      sql: `UPDATE inscripciones_cursos SET completado = 1, actualizado_en = ? WHERE id_inscripcion = ?`,
      args: [now, id]
    })
    const { emitirComprobanteSiCompleto } = await import('../lib/certificados.js')
    await emitirComprobanteSiCompleto(id)

    res.json({ success: true, message: 'Todos los módulos han sido aprobados con éxito' })
  } catch (error) {
    console.error('adminAprobarTodosModulosInscripcion:', error)
    res.status(500).json({ success: false, message: 'Error al aprobar todos los módulos' })
  }
}

export const adminListProfesores = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await db.execute({
      sql: `SELECT pr.id_profesor, pr.id_persona, pr.id_afiliado,
                   p.nombres, p.apellidos, p.cedula, p.email, p.telefono,
                   a.codigo as codigo_afiliado
            FROM profesores pr
            JOIN personas p ON pr.id_persona = p.id
            LEFT JOIN afiliados a ON pr.id_afiliado = a.id_afiliado
            ORDER BY p.nombres, p.apellidos`,
      args: []
    });
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('adminListProfesores:', error);
    res.status(500).json({ success: false, message: 'Error al obtener profesores' });
  }
}

export const adminListPersonasDisponibles = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await db.execute({
      sql: `SELECT p.id, p.nombres, p.apellidos, p.cedula, p.email, p.telefono,
                   a.id_afiliado, a.codigo as codigo_afiliado
            FROM personas p
            LEFT JOIN afiliados a ON a.id_persona = p.id
            WHERE p.id NOT IN (SELECT id_persona FROM profesores)
            ORDER BY p.nombres, p.apellidos`,
      args: []
    });
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('adminListPersonasDisponibles:', error);
    res.status(500).json({ success: false, message: 'Error al obtener personas disponibles' });
  }
}

export const adminCreateProfesor = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id_persona, id_afiliado, nombres, apellidos, cedula_tipo, cedula, email, telefono } = req.body;
    const now = new Date().toISOString();

    let targetPersonaId: number | null = null;
    let targetAfiliadoId: number | null = id_afiliado ? Number(id_afiliado) : null;

    if (id_persona) {
      targetPersonaId = Number(id_persona);
    } else if (targetAfiliadoId) {
      // If affiliate is selected, fetch their persona ID
      const afRes = await db.execute({
        sql: `SELECT id_persona FROM afiliados WHERE id_afiliado = ?`,
        args: [targetAfiliadoId]
      });
      if (afRes.rows.length > 0) {
        targetPersonaId = Number(afRes.rows[0].id_persona);
      } else {
        res.status(404).json({ success: false, message: 'Afiliado no encontrado' });
        return;
      }
    }

    if (!targetPersonaId) {
      // We need to create a new persona
      if (!nombres || !apellidos || !cedula || !email) {
        res.status(400).json({ success: false, message: 'Nombres, apellidos, cédula y email son obligatorios para crear un profesor nuevo' });
        return;
      }

      // Check duplicates in personas
      const existRes = await db.execute({
        sql: `SELECT id FROM personas WHERE email = ? OR cedula = ? LIMIT 1`,
        args: [email.trim(), cedula.trim()]
      });

      if (existRes.rows.length > 0) {
        targetPersonaId = Number(existRes.rows[0].id);
        
        // Also check if they are linked to an affiliate
        const afRes = await db.execute({
          sql: `SELECT id_afiliado FROM afiliados WHERE id_persona = ? LIMIT 1`,
          args: [targetPersonaId]
        });
        if (afRes.rows.length > 0) {
          targetAfiliadoId = Number(afRes.rows[0].id_afiliado);
        }
      } else {
        // Insert into personas
        const insertPersona = await db.execute({
          sql: `INSERT INTO personas (nombres, apellidos, cedula_tipo, cedula, email, telefono, creado_en)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
          args: [
            nombres.trim(),
            apellidos.trim(),
            cedula_tipo || 'V',
            cedula.trim(),
            email.trim(),
            telefono ? telefono.trim() : null,
            now
          ]
        });
        targetPersonaId = Number(insertPersona.lastInsertRowid);
      }
    }

    // Check if already a professor
    const profRes = await db.execute({
      sql: `SELECT id_profesor FROM profesores WHERE id_persona = ?`,
      args: [targetPersonaId]
    });

    if (profRes.rows.length > 0) {
      res.status(400).json({ success: false, message: 'Esta persona ya está registrada como profesor' });
      return;
    }

    // Insert into profesores
    await db.execute({
      sql: `INSERT INTO profesores (id_persona, id_afiliado, creado_en) VALUES (?, ?, ?)`,
      args: [targetPersonaId, targetAfiliadoId, now]
    });

    res.status(201).json({ success: true, message: 'Profesor registrado con éxito' });
  } catch (error: any) {
    console.error('adminCreateProfesor:', error);
    res.status(500).json({ success: false, message: 'Error al registrar profesor: ' + error.message });
  }
}

export const adminDeleteProfesor = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ success: false, message: 'ID de profesor inválido' });
      return;
    }

    await db.execute({
      sql: `DELETE FROM profesores WHERE id_profesor = ?`,
      args: [id]
    });

    res.json({ success: true, message: 'Profesor eliminado con éxito' });
  } catch (error) {
    console.error('adminDeleteProfesor:', error);
    res.status(500).json({ success: false, message: 'Error al eliminar profesor' });
  }
}

export const adminReenviarEnlaceExpediente = async (req: Request, res: Response): Promise<void> => {
  try {
    const idInscripcion = Number(req.params.id)
    if (!Number.isFinite(idInscripcion)) {
      res.status(400).json({ success: false, message: 'ID de inscripción inválido' })
      return
    }

    // 1. Buscar los datos del estudiante asociados a la inscripción
    const inscQuery = await db.execute({
      sql: `
        SELECT 
          ic.programa_codigo,
          COALESCE(emp.razon_social, p.nombres || ' ' || p.apellidos) as nombre_completo,
          COALESCE(emp.email, p.email) as email
        FROM inscripciones_cursos ic
        JOIN estudiantes e ON ic.id_estudiante = e.id_estudiante
        LEFT JOIN personas p ON e.id_persona = p.id
        LEFT JOIN empresas emp ON e.id_empresa = emp.id_empresa
        WHERE ic.id_inscripcion = ? LIMIT 1
      `,
      args: [idInscripcion]
    })

    if (inscQuery.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Inscripción no encontrada.' })
      return
    }

    const row = inscQuery.rows[0] as any
    const email = String(row.email || '').trim().toLowerCase()
    const nombre = String(row.nombre_completo || 'Aspirante').trim()
    const programaCodigo = row.programa_codigo

    if (!email) {
      res.status(400).json({ success: false, message: 'El aspirante no posee un correo electrónico registrado.' })
      return
    }

    // 2. Buscar si existe un token de preinscripción activo o usado para ese email
    const tokenQuery = await db.execute({
      sql: `SELECT token FROM tokens_accion WHERE email = ? AND tipo = 'preinscripcion' ORDER BY creado_en DESC LIMIT 1`,
      args: [email]
    })

    let tokenVal = ''
    if (tokenQuery.rows.length > 0) {
      tokenVal = tokenQuery.rows[0].token as string
      // Reactivar token poniendo usado = 0 y extendiendo validez a 30 días
      const expiracion = new Date()
      expiracion.setDate(expiracion.getDate() + 30)
      const fechaExpiracion = expiracion.toISOString()

      await db.execute({
        sql: `UPDATE tokens_accion SET usado = 0, fecha_expiracion = ? WHERE token = ?`,
        args: [fechaExpiracion, tokenVal]
      })
    } else {
      // Si no existe, crear un nuevo token de acción de preinscripción
      const { randomUUID } = await import('crypto')
      tokenVal = randomUUID()
      const expiracion = new Date()
      expiracion.setDate(expiracion.getDate() + 30)
      const fechaExpiracion = expiracion.toISOString()

      const dataJson = JSON.stringify({
        programa_interes: programaCodigo,
        nombreCompleto: nombre,
        email: email
      })

      await db.execute({
        sql: `INSERT INTO tokens_accion (token, tipo, email, data_json, fecha_expiracion, usado) VALUES (?, 'preinscripcion', ?, ?, ?, 0)`,
        args: [tokenVal, email, dataJson, fechaExpiracion]
      })
    }

    // 3. Enviar correo usando el servicio de Resend
    await enviarCorreoConfirmacionPreinscripcionPrograma({
      nombre,
      emailOriginal: email,
      programaCodigo,
      token: tokenVal,
    })

    res.json({ success: true, message: `Enlace de expediente reenviado con éxito a ${email}` })
  } catch (error: any) {
    console.error('adminReenviarEnlaceExpediente:', error)
    res.status(500).json({ success: false, message: 'Error al reenviar el enlace: ' + error.message })
  }
}





