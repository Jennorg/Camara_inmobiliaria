import { Request, Response } from 'express'
import { randomUUID, createHash } from 'crypto'
import { db } from '../lib/db.js'
import { env } from '../config/env.js'
import { obtenerSiguienteCodigoAfiliado } from '../lib/afiliados.js'

const sha256 = (raw: string) => createHash('sha256').update(raw).digest('hex')
import { emitirComprobanteSiCompleto } from '../lib/certificados.js'
import {
  enviarCorreoConfirmacionPreinscripcionPrograma,
  notificarAdminNuevaPreinscripcion,
  enviarCorreoAprobacionEstudiante,
  enviarCorreoSetPasswordEstudiante,
  enviarCorreoResultadoEntrevista,
  enviarCorreoInvitacionCibir,
  enviarCorreoRechazo
} from '../lib/email.js'
import bcrypt from 'bcryptjs'
import { requireAuth, requireRole } from '../middlewares/auth.middleware.js'
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

async function upsertEstudianteByEmail(params: {
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
    const resE = await db.execute({
      sql: `SELECT id_empresa FROM empresas WHERE email = ? LIMIT 1`,
      args: [email]
    })
    if (resE.rows.length > 0) {
      idEmpresa = resE.rows[0].id_empresa as number
    } else {
      const cleanedRif = (cedulaRif || '').replace(/\D/g, '') || `TEMP-J-${Date.now()}`;
      const insE = await db.execute({
        sql: `INSERT INTO empresas (razon_social, rif_numero, email, telefono) VALUES (?, ?, ?, ?) RETURNING id_empresa`,
        args: [razonSocial, cleanedRif, email, telefono || null]
      })
      idEmpresa = insE.rows[0].id_empresa as number
    }
  } else {
    const resP = await db.execute({
      sql: `SELECT id FROM personas WHERE email = ? LIMIT 1`,
      args: [email]
    })
    if (resP.rows.length > 0) {
      idPersona = resP.rows[0].id as number
      // Actualizar nivel, profesion si se proveen
      if (nivelProfesional || profesion) {
        await db.execute({
          sql: `UPDATE personas SET 
                  nivel_academico = COALESCE(?, nivel_academico),
                  profesion = COALESCE(?, profesion)
                WHERE id = ?`,
          args: [nivelProfesional || null, profesion || null, idPersona]
        })
      }
      if (anoInicioServicio !== undefined && anoInicioServicio !== null) {
        await db.execute({
          sql: `UPDATE afiliados SET ano_inicio_servicio = COALESCE(?, ano_inicio_servicio) WHERE id_persona = ?`,
          args: [anoInicioServicio, idPersona]
        })
      }
    } else {
      const cedulaInput = String(cedulaRif || `TEMP-V-${Date.now()}`).trim();
      const cedulaMatch = cedulaInput.match(/^([VEP])?-?(.+)$/i);
      const cedulaTipo = cedulaMatch && cedulaMatch[1] ? cedulaMatch[1].toUpperCase() : 'V';
      const cedulaNumero = cedulaMatch ? cedulaMatch[2].replace(/\D/g, '') : cedulaInput.replace(/\D/g, '');

      const insP = await db.execute({
        sql: `INSERT INTO personas (nombres, apellidos, cedula_tipo, cedula, email, telefono, nivel_academico, profesion) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
        args: [nombres || '', apellidos || '', cedulaTipo, cedulaNumero, email, telefono || null, nivelProfesional || null, profesion || null]
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
}): Promise<{ token: string, fechaExpiracion: string }> {
  const {
    nombreCompleto, nombres, apellidos, cedulaRif, email, telefono, programaCodigo,
    tipoAfiliado, nivelProfesional, profesion, esCorredorInmobiliario,
    razonSocial, representanteLegal, cedulaRepresentante, emailRepresentante, empresaTelefono, id_empresa
  } = params

  const expiracion = new Date()
  expiracion.setHours(expiracion.getHours() + 24)
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
    sql: `DELETE FROM verificaciones_preinscripciones
          WHERE lower(trim(email)) = lower(trim(?)) AND programa_interes = ?`,
    args: [email, programaCodigo],
  })

  await db.execute({
    sql: `INSERT INTO verificaciones_preinscripciones (
            token_verificacion, email, nombres, apellidos, cedula, telefono, 
            programa_interes, tipo_afiliado, nivel_academico, profesion, es_corredor_inmobiliario,
            razon_social, representante_legal_nombres, representante_legal_apellidos, 
            representante_legal_cedula, representante_legal_email, 
            empresa_telefono,
            id_empresa, fecha_expiracion
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      token, email, nombres || null, apellidos || null, cleanedCedulaRif || null, telefono || null,
      programaCodigo, tipoAfiliado || 'Natural', nivelProfesional || null, profesion || null,
      esCorredorInmobiliario === null ? null : (esCorredorInmobiliario === 'si' || esCorredorInmobiliario === true ? 1 : 0),
      razonSocial ?? null,
      repNombres || null,
      repApellidos || null,
      cleanedCedulaRep ?? null,
      emailRepresentante ?? null,
      empresaTelefono ?? null,
      id_empresa ?? null,
      fechaExpiracion
    ],
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

    // --- BLOQUEO DE 90 DÍAS PARA AFILIACIÓN ---
    if (programaCodigo === 'AFILIACION') {
      const existingRejection = await db.execute({
        sql: `SELECT a.estatus, a.actualizado_en as fecha_ultimo_cambio_estatus 
              FROM afiliados a
              JOIN personas p ON a.id_persona = p.id
              WHERE (p.email = ? OR (p.cedula = ? AND p.cedula IS NOT NULL)) 
                AND a.estatus = 'Rechazado' 
              LIMIT 1`,
        args: [email, cedulaRif],
      })

      if (existingRejection.rows.length > 0) {
        const row = existingRejection.rows[0] as any
        const fechaRechazo = new Date(row.fecha_ultimo_cambio_estatus || row.actualizado_en || Date.now())
        const diasTranscurridos = Math.floor((Date.now() - fechaRechazo.getTime()) / (1000 * 60 * 60 * 24))
        const DIAS_BLOQUEO = 90

        if (diasTranscurridos < DIAS_BLOQUEO) {
          const diasRestantes = DIAS_BLOQUEO - diasTranscurridos
          res.status(403).json({
            success: false,
            message: `Tu solicitud previa fue rechazada definitivamente. Podrás realizar una nueva solicitud en ${diasRestantes} días.`
          })
          return
        }
      }
    }

    // --- ESTADO DE CORRECCIÓN (REQUIERE ACCIÓN) ---
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
        if (row.estatus === 'Requiere Acción') {
          res.status(200).json({
            success: true,
            message: 'Ya posees una solicitud de afiliación activa que requiere correcciones. Por favor, revisa tu correo electrónico para encontrar el enlace de edición y completar tu registro.'
          })
          return
        }
      }
    }

    // Si ya existe estudiante por email, lo buscamos para ver si ya tiene inscripción.
    const existingEst = await db.execute({
      sql: `SELECT e.id_estudiante 
            FROM estudiantes e
            LEFT JOIN personas p ON e.id_persona = p.id
            LEFT JOIN empresas emp ON e.id_empresa = emp.id_empresa
            WHERE p.email = ? OR emp.email = ?
            LIMIT 1`,
      args: [email, email]
    })

    if (existingEst.rows.length > 0) {
      const id_estudiante = existingEst.rows[0].id_estudiante as number
      const existing = await db.execute({
        sql: `SELECT id_inscripcion, estatus FROM inscripciones_cursos
              WHERE id_estudiante = ? AND programa_codigo = ? AND id_curso IS NULL
              LIMIT 1`,
        args: [id_estudiante, programaCodigo],
      })
      if (existing.rows.length > 0) {
        const prev = existing.rows[0] as any
        if (prev.estatus === 'Preinscrito') {
          res.status(409).json({
            success: false,
            message: `Ya tienes una solicitud de preinscripción al ${programaCodigo} en espera de aprobación.`,
          })
          return
        }
        if (prev.estatus === 'Inscrito') {
          res.status(409).json({
            success: false,
            message: `Ya fuiste admitido al programa ${programaCodigo}.`,
          })
          return
        }
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
      sql: `SELECT * FROM verificaciones_preinscripciones WHERE token_verificacion = ? LIMIT 1`,
      args: [token],
    })
    if (ver.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Token inválido o no encontrado' })
      return
    }

    const registro = ver.rows[0] as any
    // El token no expira por tiempo; expira una vez enviado el formulario (al eliminarse de la BD)
    /*
    const exp = new Date(String(registro.fecha_expiracion))
    if (exp < new Date()) {
      await db.execute({
        sql: `DELETE FROM verificaciones_preinscripciones WHERE token_verificacion = ?`,
        args: [token],
      })
      res.status(400).json({ success: false, message: 'El token ha expirado. Debes solicitar una nueva preinscripción.' })
      return
    }
    */

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

    if (!programaCodigo || !email || !nombreCompleto) {
      res.status(400).json({ success: false, message: 'Registro de verificación incompleto' })
      return
    }

    // Para AFILIACION, nivelProfesional y esCorredorInmobiliario son opcionales
    if (!isAfiliacion && (esCorredorInmobiliario === null)) {
      res.status(400).json({ success: false, message: 'Registro de verificación incompleto' })
      return
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
    const existing = await db.execute({
      sql: `SELECT id_inscripcion, estatus FROM inscripciones_cursos
            WHERE id_estudiante = ? AND programa_codigo = ? AND id_curso IS NULL
            LIMIT 1`,
      args: [id_estudiante, programaCodigo],
    })
    if (existing.rows.length > 0) {
      await db.execute({
        sql: `DELETE FROM verificaciones_preinscripciones WHERE token_verificacion = ?`,
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

    const now = new Date().toISOString()
    const result = await db.execute({
      sql: `INSERT INTO inscripciones_cursos
              (id_estudiante, id_curso, programa_codigo, tipo_inscripcion, estatus, creado_en, actualizado_en, id_empresa)
            VALUES (?, NULL, ?, 'programa', 'Preinscrito', ?, ?, ?)
            ON CONFLICT DO UPDATE SET
              estatus = 'Preinscrito',
              tipo_inscripcion = 'programa',
              actualizado_en = excluded.actualizado_en,
              id_empresa = excluded.id_empresa
            RETURNING *`,
      args: [id_estudiante, programaCodigo, now, now, registro.id_empresa || null],
    })

    await db.execute({
      sql: `DELETE FROM verificaciones_preinscripciones WHERE token_verificacion = ?`,
      args: [token],
    })

    // Acceso al portal (Usuario + Token) y correo de bienvenida se crean únicamente tras la aprobación administrativa.

    // Guardar documentos en documentos_adjuntos
    const docsToInsert: { tipo: string; url: string; nombre?: string; fecha?: string }[] = []
    try {


      if (typeof req.body?.url_titulo === 'string' && req.body.url_titulo) {
        docsToInsert.push({ tipo: 'titulo', url: req.body.url_titulo })
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
          sql: `DELETE FROM documentos_adjuntos 
                WHERE entidad_tipo = 'estudiante' AND entidad_id = ? 
                AND tipo_doc IN (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [id_estudiante, ...tipos]
        })

        for (const doc of docsToInsert) {
          await db.execute({
            sql: `INSERT INTO documentos_adjuntos (entidad_tipo, entidad_id, tipo_doc, url, nombre_archivo, fecha_documento)
                  VALUES ('estudiante', ?, ?, ?, ?, ?)`,
            args: [id_estudiante, doc.tipo, doc.url, doc.nombre?.trim() || null, doc.fecha || null]
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
            sql: `INSERT INTO personas (nombres, apellidos, cedula_tipo, cedula, email, telefono, nivel_academico, actualizado_en)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                  ON CONFLICT(email) DO UPDATE SET
                    nombres = excluded.nombres,
                    apellidos = excluded.apellidos,
                    cedula_tipo = excluded.cedula_tipo,
                    cedula = excluded.cedula,
                    telefono = COALESCE(excluded.telefono, personas.telefono),
                    nivel_academico = COALESCE(excluded.nivel_academico, personas.nivel_academico),
                    actualizado_en = excluded.actualizado_en
                  RETURNING id`,
            args: [repNombres, repApellidos, repCedulaTipo, repCedulaNumero, repEmail, registro.telefono || null, nivelAcademico, now]
          })
          const idPersona = resP.rows[0].id as number

          // 3. Crear/Upsert AFILIADO
          const resA = await db.execute({
            sql: `INSERT INTO afiliados (id_persona, id_empresa, tipo_afiliado, estatus, actualizado_en)
                  VALUES (?, ?, 'Corporativo', '2_EXPEDIENTE', ?)
                  ON CONFLICT(id_persona) DO UPDATE SET
                    id_empresa = excluded.id_empresa,
                    tipo_afiliado = 'Corporativo',
                    estatus = CASE WHEN afiliados.estatus = '1_PREINSCRIPCION' THEN '2_EXPEDIENTE' ELSE afiliados.estatus END,
                    actualizado_en = excluded.actualizado_en
                  RETURNING id_afiliado`,
            args: [idPersona, idEmpresa, now]
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
            sql: `INSERT INTO personas (nombres, apellidos, cedula_tipo, cedula, email, telefono, nivel_academico, actualizado_en)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                  ON CONFLICT(email) DO UPDATE SET
                    nombres = excluded.nombres,
                    apellidos = excluded.apellidos,
                    cedula_tipo = excluded.cedula_tipo,
                    cedula = excluded.cedula,
                    telefono = excluded.telefono,
                    nivel_academico = COALESCE(excluded.nivel_academico, personas.nivel_academico),
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
              now
            ]
          })
          const idPersonaAC = resP.rows[0].id as number

          // 2. Upsert Afiliado con tipo 'Agente Corporativo' y la empresa vinculada
          const resA = await db.execute({
            sql: `INSERT INTO afiliados (id_persona, id_empresa, tipo_afiliado, estatus, ano_inicio_servicio, actualizado_en)
                  VALUES (?, ?, 'Agente Corporativo', '1_PREINSCRIPCION', ?, ?)
                  ON CONFLICT(id_persona) DO UPDATE SET
                    id_empresa = COALESCE(excluded.id_empresa, afiliados.id_empresa),
                    tipo_afiliado = 'Agente Corporativo',
                    estatus = CASE WHEN afiliados.estatus = 'Requiere Acción' THEN afiliados.estatus ELSE '1_PREINSCRIPCION' END,
                    ano_inicio_servicio = COALESCE(excluded.ano_inicio_servicio, afiliados.ano_inicio_servicio),
                    actualizado_en = excluded.actualizado_en
                  RETURNING id_afiliado`,
            args: [idPersonaAC, empresaId, anoInicioServicio, now]
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
            sql: `INSERT INTO personas (nombres, apellidos, cedula_tipo, cedula, email, telefono, nivel_academico, actualizado_en)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                  ON CONFLICT(email) DO UPDATE SET
                    nombres = excluded.nombres,
                    apellidos = excluded.apellidos,
                    cedula_tipo = excluded.cedula_tipo,
                    cedula = excluded.cedula,
                    telefono = excluded.telefono,
                    nivel_academico = COALESCE(excluded.nivel_academico, personas.nivel_academico),
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
              now
            ]
          })
          const idPersona = resP.rows[0].id as number

          // 2. Upsert Afiliado
          const resA = await db.execute({
            sql: `INSERT INTO afiliados (id_persona, id_empresa, tipo_afiliado, estatus, ano_inicio_servicio, actualizado_en)
                  VALUES (?, NULL, 'Natural', '2_EXPEDIENTE', ?, ?)
                  ON CONFLICT(id_persona) DO UPDATE SET
                    id_empresa = NULL,
                    estatus = CASE WHEN afiliados.estatus = '1_PREINSCRIPCION' THEN '2_EXPEDIENTE' ELSE afiliados.estatus END,
                    ano_inicio_servicio = COALESCE(excluded.ano_inicio_servicio, afiliados.ano_inicio_servicio),
                    actualizado_en = excluded.actualizado_en
                  RETURNING id_afiliado`,
            args: [idPersona, anoInicioServicio, now]
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

/**
 * GET /api/public/cursos
 * Lista pública de todos los cursos disponibles o próximos.
 */
export const publicListCursos = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await db.execute({
      sql: `SELECT c.*, i.nombre as instructor_nombre
            FROM cursos c
            LEFT JOIN instructores i ON i.id_instructor = c.id_instructor
            WHERE c.estatus IN ('Abierto', 'Próximamente')
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
      sql: `SELECT id_curso, nombre, estatus FROM cursos WHERE id_curso = ? LIMIT 1`,
      args: [idCurso],
    })
    if (cursoRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Curso no encontrado' })
      return
    }
    const curso = cursoRes.rows[0] as any
    if (curso.estatus !== 'Abierto' && curso.estatus !== 'Próximamente') {
      res.status(400).json({ success: false, message: 'El curso no está disponible para inscripciones' })
      return
    }

    // Upsert estudiante por email
    const { id_estudiante } = await upsertEstudianteByEmail({
      nombreCompleto,
      cedulaRif,
      email,
      telefono,
      tipo: 'Regular',
    })

    // Verificar si ya tiene una inscripción a este curso
    const existing = await db.execute({
      sql: `SELECT id_inscripcion, estatus FROM inscripciones_cursos
            WHERE id_estudiante = ? AND id_curso = ?
            LIMIT 1`,
      args: [id_estudiante, idCurso],
    })

    if (existing.rows.length > 0) {
      const prev = existing.rows[0] as any
      if (prev.estatus === 'Preinscrito') {
        res.status(409).json({ success: false, message: 'Ya posees una solicitud de inscripción enviada para este curso.' })
        return
      }
      if (prev.estatus === 'Inscrito') {
        res.status(409).json({ success: false, message: 'Ya te encuentras formalmente inscrito en este curso.' })
        return
      }
    }

    const now = new Date().toISOString()
    const result = await db.execute({
      sql: `INSERT INTO inscripciones_cursos
              (id_estudiante, id_curso, programa_codigo, tipo_inscripcion, estatus, creado_en, actualizado_en)
            VALUES (?, ?, NULL, 'cohorte', 'Preinscrito', ?, ?)
            ON CONFLICT DO UPDATE SET
              estatus = 'Preinscrito',
              tipo_inscripcion = 'cohorte',
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
      sql: `SELECT c.*, i.nombre as instructor_nombre
            FROM cursos c
            LEFT JOIN instructores i ON i.id_instructor = c.id_instructor
            ${where}
            ORDER BY c.id_curso DESC`,
      args,
    })
    res.json({ success: true, data: result.rows })
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
    const {
      nombre,
      descripcion,
      programa_codigo,
      nivel_academico,
      cupos_totales,
      fecha_inicio,
      fecha_fin,
      precio,
      imagen_url,
      estatus,
      id_instructor,
    } = req.body

    if (!nombre || !cupos_totales) {
      res.status(400).json({ success: false, message: 'nombre y cupos_totales son requeridos' })
      return
    }

    const cupos = Number(cupos_totales)
    if (!Number.isFinite(cupos) || cupos <= 0) {
      res.status(400).json({ success: false, message: 'cupos_totales debe ser un número positivo' })
      return
    }

    // Si no se pasa instructor, usar el id=1 por defecto
    const instructorId = Number(id_instructor) || 1

    const now = new Date().toISOString()
    const result = await db.execute({
      sql: `INSERT INTO cursos (
              id_instructor, nombre, descripcion, programa_codigo, nivel_academico,
              cupos_totales, cupos_disponibles, fecha_inicio, fecha_fin,
              precio, imagen_url, estatus, creado_en, actualizado_en
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING *`,
      args: [
        instructorId,
        nombre.trim(),
        descripcion ?? null,
        programa_codigo ? String(programa_codigo).toUpperCase() : null,
        nivel_academico ?? null,
        cupos,
        cupos, // cupos_disponibles = cupos_totales al crear
        fecha_inicio ?? null,
        fecha_fin ?? null,
        precio ?? null,
        imagen_url ?? null,
        estatus ?? 'Abierto',
        now,
        now,
      ],
    })

    res.status(201).json({ success: true, data: result.rows[0] })
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
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) {
      res.status(400).json({ success: false, message: 'id inválido' })
      return
    }

    const {
      nombre,
      descripcion,
      programa_codigo,
      nivel_academico,
      cupos_totales,
      cupos_disponibles,
      fecha_inicio,
      fecha_fin,
      precio,
      imagen_url,
      estatus,
      id_instructor,
    } = req.body

    const now = new Date().toISOString()
    const result = await db.execute({
      sql: `UPDATE cursos SET
              nombre = COALESCE(?, nombre),
              descripcion = ?,
              programa_codigo = ?,
              nivel_academico = ?,
              cupos_totales = COALESCE(?, cupos_totales),
              cupos_disponibles = COALESCE(?, cupos_disponibles),
              fecha_inicio = ?,
              fecha_fin = ?,
              precio = ?,
              imagen_url = COALESCE(?, imagen_url),
              estatus = COALESCE(?, estatus),
              id_instructor = COALESCE(?, id_instructor),
              actualizado_en = ?
            WHERE id_curso = ?
            RETURNING *`,
      args: [
        nombre ?? null,
        descripcion ?? null,
        programa_codigo ? String(programa_codigo).toUpperCase() : null,
        nivel_academico ?? null,
        cupos_totales != null ? Number(cupos_totales) : null,
        cupos_disponibles != null ? Number(cupos_disponibles) : null,
        fecha_inicio ?? null,
        fecha_fin ?? null,
        precio ?? null,
        imagen_url ?? null,
        estatus ?? null,
        id_instructor != null ? Number(id_instructor) : null,
        now,
        id,
      ],
    })

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Curso no encontrado' })
      return
    }
    res.json({ success: true, data: result.rows[0] })
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

    const inscritos = await db.execute({
      sql: `SELECT COUNT(*) as c FROM inscripciones_cursos WHERE id_curso = ? AND estatus = 'Inscrito'`,
      args: [id],
    })
    const count = Number((inscritos.rows[0] as any)?.c ?? 0)
    if (count > 0) {
      res.status(409).json({
        success: false,
        message: `No se puede eliminar: hay ${count} estudiante(s) inscrito(s) en este curso.`,
      })
      return
    }

    await db.execute({
      sql: `UPDATE cursos SET estatus = 'Cerrado', actualizado_en = ? WHERE id_curso = ?`,
      args: [new Date().toISOString(), id],
    })
    res.json({ success: true, message: 'Curso cerrado correctamente.' })
  } catch (error) {
    console.error('adminDeleteCurso:', error)
    res.status(500).json({ success: false, message: 'Error al cerrar curso' })
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
      sql: `SELECT * FROM verificaciones_preinscripciones WHERE token_verificacion = ? LIMIT 1`,
      args: [token],
    })
    if (ver.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Token inválido o no encontrado' })
      return
    }

    const registro = ver.rows[0] as any
    // El token expira por tiempo (24h)
    const exp = new Date(String(registro.fecha_expiracion))
    if (exp < new Date()) {
      res.status(400).json({ success: false, message: 'El enlace de preinscripción ha expirado. Por favor, realiza la preinscripción nuevamente.' })
      return
    }

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
          sql: `SELECT tipo_doc, url, nombre_archivo, fecha_documento 
                FROM documentos_adjuntos 
                WHERE entidad_tipo = 'estudiante' AND entidad_id = ?`,
          args: [existingEstId]
        })
        documentos = docsRes.rows
      }
    }

    // Establecer o renovar la cookie por 24 horas (1 día)
    res.cookie('auth_expediente', token, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000, // 24 horas
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

    if (onlyCursos) {
      // Formación = Cursos + Programas (CIBIR/PADI/PEGI/PREANI), excepto AFILIACION que va por panel de Afiliados
      baseWhere.push("(ic.id_curso IS NOT NULL OR (ic.programa_codigo IS NOT NULL AND ic.programa_codigo <> 'AFILIACION'))")
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
            LEFT JOIN afiliados af ON e.id_persona = af.id_persona
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
          CASE WHEN (
            ic.programa_codigo = 'AFILIACION' AND (
              (af.ano_inicio_servicio IS NOT NULL AND (CAST(strftime('%Y', 'now') AS INTEGER) - af.ano_inicio_servicio) > 8)
              OR EXISTS (
                SELECT 1 FROM documentos_adjuntos da 
                WHERE da.entidad_tipo = 'estudiante' 
                  AND da.entidad_id = e.id_estudiante 
                  AND da.tipo_doc = 'diplomado' 
                  AND (UPPER(da.nombre_archivo) LIKE '%FIPPI%' OR UPPER(da.nombre_archivo) LIKE '%FIPI%' OR UPPER(da.nombre_archivo) LIKE '%PREANI%')
              )
            )
          ) THEN 1 ELSE 0 END as apto_acreditacion
        FROM inscripciones_cursos ic
        JOIN estudiantes e ON e.id_estudiante = ic.id_estudiante
        LEFT JOIN personas p ON e.id_persona = p.id
        LEFT JOIN empresas emp ON e.id_empresa = emp.id_empresa
        LEFT JOIN afiliados a_rep ON emp.id_representante_legal = a_rep.id_afiliado
        LEFT JOIN personas p_rep ON a_rep.id_persona = p_rep.id
        LEFT JOIN afiliados af ON (e.id_persona = af.id_persona OR (e.id_empresa IS NOT NULL AND e.id_empresa = af.id_empresa))
        LEFT JOIN empresas emp_vinc ON ic.id_empresa = emp_vinc.id_empresa
        LEFT JOIN cursos cur ON ic.id_curso = cur.id_curso
        WHERE ${whereParts.join(' AND ')}
        ORDER BY ic.fecha_inscripcion DESC
      `,
      args,
    })

    res.json({ success: true, data: result.rows, meta: { counts } })
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
    const nivelProfesional = normalizeNivelProfesional(req.body?.nivelProfesional)
    const esCorredorInmobiliario = normalizeEsCorredorInmobiliario(req.body?.esCorredorInmobiliario)

    if (!nombreCompleto || !email) {
      res.status(400).json({ success: false, message: 'nombreCompleto y email son requeridos' })
      return
    }
    if (!nivelProfesional) {
      res.status(400).json({ success: false, message: 'nivelProfesional inválido. Use Bachiller/Nivel Profesional/Postgrado.' })
      return
    }
    if (esCorredorInmobiliario === null) {
      res.status(400).json({ success: false, message: 'esCorredorInmobiliario es requerido (true/false).' })
      return
    }

    // validar curso abierto y cupos
    const cursoRes = await db.execute({
      sql: `SELECT id_curso, cupos_disponibles, estatus FROM cursos WHERE id_curso = ? LIMIT 1`,
      args: [idCurso],
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
    if ((curso.cupos_disponibles as number) <= 0) {
      res.status(400).json({ success: false, message: 'No hay cupos disponibles' })
      return
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

    await db.batch(
      [
        {
          sql: `INSERT INTO inscripciones_cursos (id_estudiante, id_curso, tipo_inscripcion, estatus, asignado_por, aprobado_por, creado_en, actualizado_en)
                VALUES (?, ?, 'cohorte', 'Inscrito', ?, ?, ?, ?)
                ON CONFLICT DO UPDATE SET
                  estatus='Inscrito',
                  tipo_inscripcion='cohorte',
                  asignado_por=excluded.asignado_por,
                  aprobado_por=excluded.aprobado_por,
                  actualizado_en=excluded.actualizado_en`,
          args: [id_estudiante, idCurso, req.user?.id ?? null, req.user?.id ?? null, now, now],
        },
        {
          sql: `UPDATE cursos SET cupos_disponibles = cupos_disponibles - 1
                WHERE id_curso = ? AND cupos_disponibles > 0`,
          args: [idCurso],
        },
      ],
      'write'
    )

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
            SET estatus='Entrevista', actualizado_en=?,
                entrevista_fecha=?, entrevista_hora=?, entrevista_lugar=?, entrevista_estatus='Pendiente'
            WHERE id_inscripcion=? AND estatus='Preinscrito'
            RETURNING *`,
      args: [now, entrevistaFecha, entrevistaHora, entrevistaLugar, id],
    })

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Preinscripción no encontrada o ya procesada' })
      return
    }

    const row = result.rows[0] as any

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

  // 4. Insertar/Actualizar afiliado en estatus deseado
  const resIns = await db.execute({
    sql: `INSERT INTO afiliados (id_persona, id_empresa, tipo_afiliado, estatus, codigo, fecha_afiliacion, actualizado_en, activo, id_user, cibir_convalidado)
          VALUES (?, ?, COALESCE(
            (SELECT tipo_afiliado FROM afiliados WHERE id_persona = ?),
            CASE WHEN ? IS NOT NULL THEN 'Corporativo' ELSE 'Natural' END
          ), ?, ?, ?, ?, 1, ?, ?)
          ON CONFLICT(id_persona) DO UPDATE SET
            estatus = ?,
            codigo = COALESCE(afiliados.codigo, ?),
            fecha_afiliacion = COALESCE(afiliados.fecha_afiliacion, ?),
            actualizado_en = excluded.actualizado_en,
            activo = 1,
            id_user = COALESCE(afiliados.id_user, ?),
            cibir_convalidado = ?
          RETURNING id_afiliado`,
    args: [
      finalIdPersona,
      est.id_empresa,
      finalIdPersona,
      est.id_empresa,
      targetStatus,
      nextCode,
      fechaAfiliacionVal,
      now,
      userId,
      convalidadoVal,
      targetStatus,
      nextCode,
      fechaAfiliacionVal,
      userId,
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
        sql: `SELECT id, reset_token_hash FROM users WHERE email = ?`,
        args: [row.email]
      })
      const existingUser = userRes.rows[0] as any

      if (!existingUser) {
        shouldSendToken = true
        const expiracion = new Date()
        expiracion.setDate(expiracion.getDate() + 7)
        const placeholderPass = await bcrypt.hash(randomUUID(), 10)
        const tokenHash = sha256(tokenToUse)

        await db.execute({
          sql: `INSERT INTO users (email, password_hash, roles, reset_token_hash, reset_token_expira)
                VALUES (?, ?, '["estudiante", "afiliado"]', ?, ?)`,
          args: [row.email, placeholderPass, tokenHash, expiracion.toISOString()]
        })
      } else if (existingUser.reset_token_hash) {
        shouldSendToken = true
        const expiracion = new Date()
        expiracion.setDate(expiracion.getDate() + 7)
        const tokenHash = sha256(tokenToUse)

        await db.execute({
          sql: `UPDATE users SET reset_token_hash = ?, reset_token_expira = ?, actualizado_en = ? WHERE id = ?`,
          args: [tokenHash, expiracion.toISOString(), now, existingUser.id]
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
              SET estatus='Rechazado', nota_admin=?, aprobado_por=?, actualizado_en=?, entrevista_estatus='Realizada'
              WHERE id_inscripcion=?`,
        args: [notaAdmin || null, req.user?.id || null, now, id]
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
            SET estatus='Inscrito', aprobado_por=?, actualizado_en=?, entrevista_estatus='Realizada'
            WHERE id_inscripcion=?`,
      args: [req.user?.id || null, now, id]
    })

    let insertedAfiliadoId: number | null = null
    let tokenToUse = randomUUID()
    let shouldSendToken = false

    // Crear/Verificar Acceso
    try {
      const userRes = await db.execute({
        sql: `SELECT id, reset_token_hash, activo FROM users WHERE email = ?`,
        args: [row.email]
      })
      const existingUser = userRes.rows[0] as any

      if (!existingUser) {
        shouldSendToken = true
        const expiracion = new Date()
        expiracion.setDate(expiracion.getDate() + 7)
        const placeholderPass = await bcrypt.hash(randomUUID(), 10)
        const tokenHash = sha256(tokenToUse)

        const defaultRoles = row.programa_codigo === 'AFILIACION' ? '["estudiante", "afiliado"]' : '["estudiante"]'

        await db.execute({
          sql: `INSERT INTO users (email, password_hash, roles, reset_token_hash, reset_token_expira)
                VALUES (?, ?, ?, ?, ?)`,
          args: [row.email, placeholderPass, defaultRoles, tokenHash, expiracion.toISOString()]
        })
      } else if (existingUser.reset_token_hash) {
        // Si el usuario existe pero tiene un token pendiente (no ha establecido contraseña)
        shouldSendToken = true
        const expiracion = new Date()
        expiracion.setDate(expiracion.getDate() + 7)
        const tokenHash = sha256(tokenToUse)

        await db.execute({
          sql: `UPDATE users SET reset_token_hash = ?, reset_token_expira = ?, actualizado_en = ? WHERE id = ?`,
          args: [tokenHash, expiracion.toISOString(), now, existingUser.id]
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

    // Si tiene id_curso, descontar cupo
    if (row.id_curso) {
      await db.execute({
        sql: `UPDATE cursos SET cupos_disponibles = cupos_disponibles - 1 WHERE id_curso = ? AND cupos_disponibles > 0`,
        args: [row.id_curso],
      })
    }

    // Registrar módulos CIEBO
    if (resultado === 'Aprobado' || (resultado === 'Parcial' && Array.isArray(modulosConvalidados))) {
      const modulos = resultado === 'Aprobado' ? [1, 2, 3, 4, 5] : modulosConvalidados

      const targetAfiliadoId = row.id_afiliado || insertedAfiliadoId
      if (targetAfiliadoId) {
        for (const num of modulos) {
          await db.execute({
            sql: `INSERT INTO convalidaciones_cibir (id_afiliado, modulo, estatus, evaluado_por)
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
export const adminAprobarPreinscripcionDirecta = async (req: Request, res: Response): Promise<void> => {
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

    // Aprobación Directa
    await db.execute({
      sql: `UPDATE inscripciones_cursos 
            SET estatus='Inscrito', aprobado_por=?, actualizado_en=?
            WHERE id_inscripcion=?`,
      args: [req.user?.id || null, now, id]
    })

    let tokenToUse = randomUUID()
    let shouldSendToken = false

    // Crear/Verificar Acceso
    try {
      const userRes = await db.execute({
        sql: `SELECT id, reset_token_hash FROM users WHERE email = ?`,
        args: [row.email]
      })
      const existingUser = userRes.rows[0] as any

      if (!existingUser) {
        shouldSendToken = true
        const expiracion = new Date()
        expiracion.setDate(expiracion.getDate() + 7)
        const placeholderPass = await bcrypt.hash(randomUUID(), 10)
        const tokenHash = sha256(tokenToUse)

        const defaultRoles = row.programa_codigo === 'AFILIACION' ? '["estudiante", "afiliado"]' : '["estudiante"]'

        await db.execute({
          sql: `INSERT INTO users (email, password_hash, roles, reset_token_hash, reset_token_expira)
                VALUES (?, ?, ?, ?, ?)`,
          args: [row.email, placeholderPass, defaultRoles, tokenHash, expiracion.toISOString()]
        })
      } else if (existingUser.reset_token_hash) {
        // Si el usuario existe pero tiene un token pendiente (no ha establecido contraseña)
        shouldSendToken = true
        const expiracion = new Date()
        expiracion.setDate(expiracion.getDate() + 7)
        const tokenHash = sha256(tokenToUse)

        await db.execute({
          sql: `UPDATE users SET reset_token_hash = ?, reset_token_expira = ?, actualizado_en = ? WHERE id = ?`,
          args: [tokenHash, expiracion.toISOString(), now, existingUser.id]
        })
      }
    } catch (err) {
      console.error('Error preparando acceso directo:', err)
    }

    // --- PUENTE HACIA AFILIADOS (Si es AFILIACION) ---
    if (row.programa_codigo === 'AFILIACION') {
      try {
        await promocionarYVincularAfiliado(row.id_estudiante, row.email, now)
      } catch (err) {
        console.error('Error al mapear preinscripción a afiliado:', err)
      }
    }
    // --------------------------------------------------

    // Si tiene id_curso, descontar cupo
    if (row.id_curso) {
      await db.execute({
        sql: `UPDATE cursos SET cupos_disponibles = cupos_disponibles - 1 WHERE id_curso = ? AND cupos_disponibles > 0`,
        args: [row.id_curso],
      })
    }

    // Enviar correo de bienvenida con acceso a password
    try {
      await enviarCorreoSetPasswordEstudiante({
        nombre: row.nombre_completo,
        emailOriginal: row.email,
        programaCodigo: row.programa_codigo || 'Curso',
        token: shouldSendToken ? tokenToUse : undefined
      })
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

    // Si pasó de Inscrito a Rechazado, devolver el cupo
    if (current.rows.length > 0 && current.rows[0].estatus === 'Inscrito' && current.rows[0].id_curso) {
      await db.execute({
        sql: `UPDATE cursos SET cupos_disponibles = cupos_disponibles + 1 WHERE id_curso = ?`,
        args: [current.rows[0].id_curso],
      })
    }

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
      // a. Borrar documentos adjuntos
      await db.execute({
        sql: `DELETE FROM documentos_adjuntos WHERE entidad_tipo = 'estudiante' AND entidad_id = ?`,
        args: [idEstudiante]
      })

      // b. Borrar afiliados asociados a esta persona o empresa
      if (idPersona) {
        await db.execute({
          sql: `DELETE FROM afiliados WHERE id_persona = ?`,
          args: [idPersona]
        })
      }
      if (idEmpresa) {
        await db.execute({
          sql: `DELETE FROM afiliados WHERE id_empresa = ?`,
          args: [idEmpresa]
        })
      }

      // c. Borrar estudiante
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

      // e. Borrar persona (si no está asociada a ningún otro registro)
      if (idPersona) {
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
export const academiaAdminGuards = [requireAuth, requireRole('admin', 'super_admin')] as const

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
      sql: `SELECT id_documento, tipo_doc, url, nombre_archivo, creado_en
            FROM documentos_adjuntos
            WHERE entidad_tipo = 'estudiante' AND entidad_id = ?
            ORDER BY tipo_doc, creado_en ASC`,
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
          sql: `SELECT id, reset_token_hash FROM users WHERE email = ?`,
          args: [row.email]
        })
        const existingUser = userRes.rows[0] as any

        let tokenToUse: string | undefined = undefined
        let shouldSendToken = false

        if (!existingUser) {
          shouldSendToken = true
          tokenToUse = randomUUID()
          const expiracion = new Date()
          expiracion.setDate(expiracion.getDate() + 7)
          const placeholderPass = await bcrypt.hash(randomUUID(), 10)
          const tokenHash = sha256(tokenToUse)

          const defaultRoles = (row.programa_codigo === 'AFILIACION' && targetAfiliadoStatus === 'Afiliado') ? '["estudiante", "afiliado"]' : '["estudiante"]'

          await db.execute({
            sql: `INSERT INTO users (email, password_hash, roles, reset_token_hash, reset_token_expira)
                  VALUES (?, ?, ?, ?, ?)`,
            args: [row.email, placeholderPass, defaultRoles, tokenHash, expiracion.toISOString()]
          })
        } else if (existingUser.reset_token_hash && (etapa === 5 || etapa === 6)) {
          // El usuario ya existe pero tiene un token pendiente (no ha establecido contraseña)
          // Solo actualizamos y enviamos token si estamos en etapa de aprobación (Inscripción/Afiliación)
          shouldSendToken = true
          tokenToUse = randomUUID()
          const expiracion = new Date()
          expiracion.setDate(expiracion.getDate() + 7)
          const tokenHash = sha256(tokenToUse)

          await db.execute({
            sql: `UPDATE users SET reset_token_hash = ?, reset_token_expira = ?, actualizado_en = ? WHERE id = ?`,
            args: [tokenHash, expiracion.toISOString(), now, existingUser.id]
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
            await db.execute({
              sql: `INSERT INTO afiliados (id_persona, id_empresa, tipo_afiliado, estatus, actualizado_en, activo)
                    VALUES (?, ?, COALESCE(
                      (SELECT tipo_afiliado FROM afiliados WHERE id_persona = ?),
                      CASE WHEN ? IS NOT NULL THEN 'Corporativo' ELSE 'Natural' END
                    ), ?, ?, 1)
                    ON CONFLICT(id_persona) DO UPDATE SET
                      estatus = ?,
                      actualizado_en = excluded.actualizado_en,
                      activo = 1`,
              args: [
                finalIdPersona,
                est.id_empresa,
                finalIdPersona,
                est.id_empresa,
                targetAfiliadoStatus,
                now,
                targetAfiliadoStatus
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

    // Nombre limpio (quitando los paréntesis y el RIF)
    let nombreLimpio = rawNombre
    const parenIndex = rawNombre.indexOf('(')
    if (parenIndex !== -1) {
      nombreLimpio = rawNombre.substring(0, parenIndex).trim()
    }

    const nameSearch = `%${nombreLimpio}%`
    const docSearchLike = extractedDoc ? `%${extractedDoc.replace(/[^a-zA-Z0-9]/g, '')}%` : ''

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
             OR (COALESCE(p.nombres, '') || ' ' || COALESCE(p.apellidos, '') LIKE ?)
             OR (e.razon_social LIKE ?)
          LIMIT 1
        `,
        args: [extractedDoc, extractedDoc, docSearchLike, docSearchLike, nameSearch, nameSearch]
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



