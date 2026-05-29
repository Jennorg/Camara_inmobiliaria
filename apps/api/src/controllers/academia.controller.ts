import { Request, Response } from 'express'
import { randomUUID, createHash } from 'crypto'
import { db } from '../lib/db.js'

const sha256 = (raw: string) => createHash('sha256').update(raw).digest('hex')
import { emitirComprobanteSiCompleto } from '../lib/certificados.js'
import {
  enviarCorreoConfirmacionPreinscripcionPrograma,
  notificarAdminNuevaPreinscripcion,
  enviarCorreoAprobacionEstudiante,
  enviarCorreoSetPasswordEstudiante,
  enviarCorreoResultadoEntrevista
} from '../lib/email.js'
import bcrypt from 'bcryptjs'
import { requireAuth, requireRole } from '../middlewares/auth.middleware.js'

const MAIN_PROGRAM_CODES = new Set(['PADI', 'PEGI', 'PREANI', 'CIBIR', 'AFILIACION'])
const PROFESSIONAL_LEVELS = new Set(['Bachiller', 'TSU', 'Universitario', 'Postgrado'])

function normalizeProgramaCodigo(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const code = value.trim().toUpperCase()
  return MAIN_PROGRAM_CODES.has(code) ? code : null
}

function normalizeNivelProfesional(value: unknown): 'Bachiller' | 'TSU' | 'Universitario' | 'Postgrado' | null {
  if (typeof value !== 'string') return null
  const cleaned = value.trim()
  return PROFESSIONAL_LEVELS.has(cleaned) ? (cleaned as 'Bachiller' | 'TSU' | 'Universitario' | 'Postgrado') : null
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
  nivelProfesional?: 'Bachiller' | 'TSU' | 'Universitario' | 'Postgrado' | null
  profesion?: string | null
  esCorredorInmobiliario?: boolean | null
}): Promise<{ id_estudiante: number }> {
  const { nombres, apellidos, razonSocial, cedulaRif, email, telefono, tipo, nivelProfesional, profesion, esCorredorInmobiliario } = params

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
      const insE = await db.execute({
        sql: `INSERT INTO empresas (razon_social, rif_numero, email, telefono) VALUES (?, ?, ?, ?) RETURNING id_empresa`,
        args: [razonSocial, cedulaRif || `TEMP-J-${Date.now()}`, email, telefono || null]
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
      // Actualizar nivel y profesion si se proveen
      if (nivelProfesional || profesion) {
        await db.execute({
          sql: `UPDATE personas SET 
                  nivel_academico = COALESCE(?, nivel_academico),
                  profesion = COALESCE(?, profesion)
                WHERE id = ?`,
          args: [nivelProfesional || null, profesion || null, idPersona]
        })
      }
    } else {
      const insP = await db.execute({
        sql: `INSERT INTO personas (nombres, apellidos, cedula, email, telefono, nivel_academico, profesion) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
        args: [nombres || '', apellidos || '', cedulaRif || `TEMP-V-${Date.now()}`, email, telefono || null, nivelProfesional || null, profesion || null]
      })
      idPersona = insP.rows[0].id as number
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
      token, email, nombres || null, apellidos || null, cedulaRif || null, telefono || null,
      programaCodigo, tipoAfiliado || 'Natural', nivelProfesional || null, profesion || null,
      esCorredorInmobiliario === null ? null : (esCorredorInmobiliario === 'si' || esCorredorInmobiliario === true ? 1 : 0),
      razonSocial ?? null,
      repNombres || null,
      repApellidos || null,
      cedulaRepresentante ?? null,
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

    await enviarCorreoConfirmacionPreinscripcionPrograma({
      nombre: nombreCompleto,
      emailOriginal: email,
      programaCodigo,
      token,
    })

    res.status(201).json({
      success: true,
      message: 'Te enviamos un correo para confirmar tu preinscripción. Revisa tu bandeja de entrada o SPAM.',
      data: { token }
    })
  } catch (error) {
    console.error('publicPreinscribirProgramaPrincipal:', error)
    res.status(500).json({ success: false, message: 'Error al procesar la preinscripción' })
  }
}

/**
 * POST /api/public/preinscripciones/confirmar
 * Confirma el email y crea la preinscripción real en `inscripciones_cursos`.
 */
export const publicConfirmarPreinscripcionPrograma = async (req: Request, res: Response): Promise<void> => {
  try {
    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : ''
    if (!token) {
      res.status(400).json({ success: false, message: 'Token es requerido' })
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
    const exp = new Date(String(registro.fecha_expiracion))
    if (exp < new Date()) {
      await db.execute({
        sql: `DELETE FROM verificaciones_preinscripciones WHERE token_verificacion = ?`,
        args: [token],
      })
      res.status(400).json({ success: false, message: 'El token ha expirado. Debes solicitar una nueva preinscripción.' })
      return
    }

    const programaCodigo = normalizeProgramaCodigo(registro.programa_interes)
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
          const insP = await db.execute({
            sql: `INSERT INTO personas (nombres, apellidos, cedula, email, telefono) VALUES (?, ?, ?, ?, ?) RETURNING id`,
            args: [
              registro.representante_legal_nombres || '',
              registro.representante_legal_apellidos || '',
              registro.representante_legal_cedula || `TEMP-V-${Date.now()}`,
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

    // 2. Crear acceso al portal (Usuario + Token)
    // Solo para cursos académicos (PADI, PEGI, PREANI, CIBIR). 
    // Para AFILIACION el acceso se crea solo tras aprobación administrativa.
    if (programaCodigo !== 'AFILIACION') {
      try {
        const resetToken = randomUUID()
        const expiracion = new Date()
        expiracion.setHours(expiracion.getHours() + 48)

        const placeholderPass = await bcrypt.hash(randomUUID(), 10)

        const resetTokenHash = sha256(resetToken)
        const userRes = await db.execute({
          sql: `INSERT INTO users (email, password_hash, roles, reset_token_hash, reset_token_expira)
                VALUES (?, ?, '["estudiante"]', ?, ?)
                ON CONFLICT(email) DO UPDATE SET 
                  reset_token_hash = excluded.reset_token_hash, 
                  reset_token_expira = excluded.reset_token_expira,
                  actualizado_en = strftime('%Y-%m-%dT%H:%M:%SZ','now')
                RETURNING id`,
          args: [email, placeholderPass, resetTokenHash, expiracion.toISOString()]
        })
        
        const newUserId = userRes.rows[0].id;
        
        // Update estudiante with the new user id
        await db.execute({
          sql: `UPDATE estudiantes SET id_user = ? WHERE id_estudiante = ? AND id_user IS NULL`,
          args: [newUserId, id_estudiante]
        })

        // 3. Enviar correo para establecer contraseña
        await enviarCorreoSetPasswordEstudiante({
          nombre: nombreCompleto,
          emailOriginal: email,
          programaCodigo: programaCodigo,
          token: resetToken
        })
      } catch (err) {
        console.error('Error creando acceso inicial:', err)
      }
    }

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
          const repCedula = String(registro.representante_legal_cedula || '').trim() || `TEMP-R-${idEmpresa}`

          const resP = await db.execute({
            sql: `INSERT INTO personas (nombres, apellidos, cedula, email, telefono, nivel_academico, actualizado_en)
                  VALUES (?, ?, ?, ?, ?, ?, ?)
                  ON CONFLICT(email) DO UPDATE SET
                    nombres = excluded.nombres,
                    apellidos = excluded.apellidos,
                    cedula = excluded.cedula,
                    telefono = COALESCE(excluded.telefono, personas.telefono),
                    nivel_academico = COALESCE(excluded.nivel_academico, personas.nivel_academico),
                    actualizado_en = excluded.actualizado_en
                  RETURNING id`,
            args: [repNombres, repApellidos, repCedula, repEmail, registro.telefono || null, nivelAcademico, now]
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

          // Asignar código si no tiene
          await db.execute({
            sql: `UPDATE afiliados SET codigo_cibir = CAST(id_afiliado AS TEXT) WHERE id_afiliado = ? AND codigo_cibir IS NULL`,
            args: [idAfiliado]
          })

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

          // 1. Upsert Persona
          const resP = await db.execute({
            sql: `INSERT INTO personas (nombres, apellidos, cedula, email, telefono, nivel_academico, actualizado_en)
                  VALUES (?, ?, ?, ?, ?, ?, ?)
                  ON CONFLICT(email) DO UPDATE SET
                    nombres = excluded.nombres,
                    apellidos = excluded.apellidos,
                    cedula = excluded.cedula,
                    telefono = excluded.telefono,
                    nivel_academico = COALESCE(excluded.nivel_academico, personas.nivel_academico),
                    actualizado_en = excluded.actualizado_en
                  RETURNING id`,
            args: [
              registro.nombres || '',
              registro.apellidos || '',
              registro.cedula || `TEMP-V-${Date.now()}`,
              registro.email,
              registro.telefono || telefono,
              nivelAcademico,
              now
            ]
          })
          const idPersonaAC = resP.rows[0].id as number

          // 2. Upsert Afiliado con tipo 'Agente Corporativo' y la empresa vinculada
          const resA = await db.execute({
            sql: `INSERT INTO afiliados (id_persona, id_empresa, tipo_afiliado, estatus, actualizado_en)
                  VALUES (?, ?, 'Agente Corporativo', '1_PREINSCRIPCION', ?)
                  ON CONFLICT(id_persona) DO UPDATE SET
                    id_empresa = COALESCE(excluded.id_empresa, afiliados.id_empresa),
                    tipo_afiliado = 'Agente Corporativo',
                    estatus = CASE WHEN afiliados.estatus = 'Requiere Acción' THEN afiliados.estatus ELSE '1_PREINSCRIPCION' END,
                    actualizado_en = excluded.actualizado_en
                  RETURNING id_afiliado`,
            args: [idPersonaAC, empresaId, now]
          })
          const idAfiliadoAC = resA.rows[0].id_afiliado as number

          if (idAfiliadoAC) {
            await db.execute({
              sql: `UPDATE afiliados SET codigo_cibir = CAST(id_afiliado AS TEXT) WHERE id_afiliado = ? AND codigo_cibir IS NULL`,
              args: [idAfiliadoAC]
            })
          }

          // Vincular id_persona al estudiante (la empresa se guarda en afiliados, no en estudiantes)
          await db.execute({
            sql: `UPDATE estudiantes SET id_persona = ? WHERE id_estudiante = ?`,
            args: [idPersonaAC, id_estudiante]
          })

        } else {
          // AFILIACION NATURAL
          // 1. Upsert Persona
          const resP = await db.execute({
            sql: `INSERT INTO personas (nombres, apellidos, cedula, email, telefono, nivel_academico, actualizado_en)
                  VALUES (?, ?, ?, ?, ?, ?, ?)
                  ON CONFLICT(email) DO UPDATE SET
                    nombres = excluded.nombres,
                    apellidos = excluded.apellidos,
                    cedula = excluded.cedula,
                    telefono = excluded.telefono,
                    nivel_academico = COALESCE(excluded.nivel_academico, personas.nivel_academico),
                    actualizado_en = excluded.actualizado_en
                  RETURNING id`,
            args: [
              registro.nombres || '',
              registro.apellidos || '',
              registro.cedula || `TEMP-V-${Date.now()}`,
              registro.email,
              registro.telefono || telefono,
              nivelAcademico,
              now
            ]
          })
          const idPersona = resP.rows[0].id as number

          // 2. Upsert Afiliado
          const resA = await db.execute({
            sql: `INSERT INTO afiliados (id_persona, id_empresa, tipo_afiliado, estatus, actualizado_en)
                  VALUES (?, NULL, 'Natural', '2_EXPEDIENTE', ?)
                  ON CONFLICT(id_persona) DO UPDATE SET
                    id_empresa = NULL,
                    estatus = CASE WHEN afiliados.estatus = '1_PREINSCRIPCION' THEN '2_EXPEDIENTE' ELSE afiliados.estatus END,
                    actualizado_en = excluded.actualizado_en
                  RETURNING id_afiliado`,
            args: [idPersona, now]
          })
          const idAfiliado = resA.rows[0].id_afiliado as number

          if (idAfiliado) {
            await db.execute({
              sql: `UPDATE afiliados SET codigo_cibir = CAST(id_afiliado AS TEXT) WHERE id_afiliado = ? AND codigo_cibir IS NULL`,
              args: [idAfiliado]
            })
          }

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

    // Notificar al admin
    notificarAdminNuevaPreinscripcion({
      idInscripcion: Number(result.rows[0].id_inscripcion),
      nombre: nombreCompleto,
      email: email,
      programaCodigo: programaCodigo,
      cedulaRif: cedulaRif,
      telefono: telefono
    }).catch(e => console.error('Error notificando admin (programa):', e))

    res.status(201).json({
      success: true,
      message: programaCodigo === 'AFILIACION'
        ? 'Correo confirmado. Tu solicitud de afiliación está siendo revisada por la administración. Pronto nos pondremos en contacto contigo.'
        : 'Preinscripción confirmada correctamente. Revisa tu correo para establecer tu contraseña.',
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

    // Notificar al admin
    notificarAdminNuevaPreinscripcion({
      idInscripcion: Number(result.rows[0].id_inscripcion),
      nombre: nombreCompleto,
      email: email,
      programaCodigo: curso.nombre || `Curso ${idCurso}`,
      cedulaRif: cedulaRif,
      telefono: telefono
    }).catch(e => console.error('Error notificando admin (curso):', e))

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
    const token = String(req.params.token ?? '')
    const ver = await db.execute({
      sql: `SELECT * FROM verificaciones_preinscripciones WHERE token_verificacion = ? LIMIT 1`,
      args: [token],
    })
    if (ver.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Token inválido o no encontrado' })
      return
    }

    const registro = ver.rows[0] as any
    const exp = new Date(String(registro.fecha_expiracion))
    if (exp < new Date()) {
      res.status(400).json({ success: false, message: 'El token ha expirado' })
      return
    }

    const nombreCompleto = (
      registro.razon_social ||
      `${registro.nombres || ''} ${registro.apellidos || ''}`.trim() ||
      `${registro.representante_legal_nombres || ''} ${registro.representante_legal_apellidos || ''}`.trim() ||
      'Aspirante'
    ).trim()

    res.json({
      success: true,
      data: {
        nombreCompleto,
        email: registro.email,
        programaCodigo: registro.programa_interes,
        tipoAfiliado: registro.tipo_afiliado ?? 'Natural',
        razonSocial: registro.razon_social,
        cedulaRif: registro.cedula,
        telefono: registro.telefono,
        nivelProfesional: registro.nivel_academico,
        esCorredorInmobiliario: registro.es_corredor_inmobiliario,
        url_titulo: registro.url_titulo,
        url_cv: registro.url_cv,
        url_especializaciones: registro.url_especializaciones,
        url_cursos_extras: registro.url_cursos_extras,
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

    const baseWhere: string[] = []
    const countArgs: any[] = []

    if (cursoId) {
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
              AND NOT (af.tipo_afiliado = 'Agente Corporativo' AND af.estatus = '1_PREINSCRIPCION')
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
    whereParts.push("NOT (af.tipo_afiliado = 'Agente Corporativo' AND af.estatus = '1_PREINSCRIPCION')")
    const args = [...countArgs]
    if (estatus !== 'Todos') {
      whereParts.push('ic.estatus = ?')
      args.push(estatus)
    }

    const result = await db.execute({
      sql: `
        SELECT
          ic.*,
          e.id_estudiante,
          COALESCE(p.nombres || ' ' || p.apellidos, emp.razon_social) as estudiante_nombre,
          COALESCE(p.email, emp.email) as estudiante_email,
          COALESCE(p.telefono, emp.telefono) as estudiante_telefono,
          COALESCE(p.cedula, 'J-' || REPLACE(emp.rif_numero, 'J-', '')) as estudiante_cedula,
          p.nivel_academico as estudiante_nivel_profesional,
          e.es_corredor_inmobiliario as estudiante_es_corredor_inmobiliario,
          e.tipo as tipo_estudiante,
          p_rep.nombres || ' ' || p_rep.apellidos as representante_nombre,
          p_rep.cedula as representante_cedula,
          p_rep.email as representante_email,
          p_rep.telefono as representante_telefono,
          af.estatus as afiliado_estatus,
          af.tipo_afiliado as afiliado_tipo,
          emp_vinc.razon_social as empresa_vinculada_nombre
        FROM inscripciones_cursos ic
        JOIN estudiantes e ON e.id_estudiante = ic.id_estudiante
        LEFT JOIN personas p ON e.id_persona = p.id
        LEFT JOIN empresas emp ON e.id_empresa = emp.id_empresa
        LEFT JOIN afiliados a_rep ON emp.id_representante_legal = a_rep.id_afiliado
        LEFT JOIN personas p_rep ON a_rep.id_persona = p_rep.id
        LEFT JOIN afiliados af ON (e.id_persona = af.id_persona OR (e.id_empresa IS NOT NULL AND e.id_empresa = af.id_empresa))
        LEFT JOIN empresas emp_vinc ON ic.id_empresa = emp_vinc.id_empresa
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
      res.status(400).json({ success: false, message: 'nivelProfesional inválido. Use Bachiller/Universitario/Postgrado.' })
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
                COALESCE(p.nombres || ' ' || p.apellidos, emp.razon_social) as nombre_completo,
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

    let insertedAfiliadoId: number | null = null;
    // --- PUENTE HACIA AFILIADOS (Si es AFILIACION) ---
    if (row.programa_codigo === 'AFILIACION') {
      try {
        // 1. Generar el código de Afiliado (Secuencial Numérico)
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
        const nextCode = correlativo.toString();

        // 2. Actualizar el estatus en la tabla afiliados
        // Buscamos el afiliado vinculado a este estudiante
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
 
          if (!finalIdPersona) {
            throw new Error(`No se encontró id_persona ni rep_id_persona para el estudiante ${row.id_estudiante}`)
          }
 
          const resIns = await db.execute({
            sql: `INSERT INTO afiliados (id_persona, id_empresa, tipo_afiliado, estatus, codigo_cibir, actualizado_en, activo)
                  VALUES (?, ?, COALESCE(
                    (SELECT tipo_afiliado FROM afiliados WHERE id_persona = ?),
                    CASE WHEN ? IS NOT NULL THEN 'Corporativo' ELSE 'Natural' END
                  ), 'Afiliado', ?, ?, 1)
                  ON CONFLICT(id_persona) DO UPDATE SET
                    estatus = 'Afiliado',
                    codigo_cibir = COALESCE(afiliados.codigo_cibir, excluded.codigo_cibir),
                    actualizado_en = excluded.actualizado_en,
                    activo = 1
                  RETURNING id_afiliado`,
            args: [finalIdPersona, est.id_empresa, finalIdPersona, est.id_empresa, nextCode, now]
          })
          insertedAfiliadoId = resIns.rows[0].id_afiliado as number
        }
      } catch (err) {
        console.error('Error al mapear entrevista aprobada a afiliado:', err);
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

    // Crear/Verificar Acceso
    try {
      const userRes = await db.execute({
        sql: `SELECT reset_token_hash, activo FROM users WHERE email = ?`,
        args: [row.email]
      })
      const existingUser = userRes.rows[0] as any

      let tokenToUse = randomUUID() // siempre generamos token nuevo

      if (!existingUser) {
        tokenToUse = randomUUID()
        const expiracion = new Date()
        expiracion.setHours(expiracion.getHours() + 48)
        const placeholderPass = await bcrypt.hash(randomUUID(), 10)
        const tokenHash = sha256(tokenToUse)

        await db.execute({
          sql: `INSERT INTO users (email, password_hash, roles, reset_token_hash, reset_token_expira)
                VALUES (?, ?, '["estudiante"]', ?, ?)`,
          args: [row.email, placeholderPass, tokenHash, expiracion.toISOString()]
        })
      }

      // Correo de bienvenida definitivo
      await enviarCorreoResultadoEntrevista({
        nombre: row.nombre_completo,
        emailOriginal: row.email,
        resultado: resultado as 'Aprobado' | 'Parcial' | 'Rechazado',
        programaCodigo: row.programa_codigo || 'Curso',
        token: tokenToUse || undefined
      })
    } catch (err) {
      console.error('Error preparando acceso:', err)
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

    // --- PUENTE HACIA AFILIADOS (Si es AFILIACION) ---
    if (row.programa_codigo === 'AFILIACION') {
      try {
        const estRes = await db.execute({
          sql: `SELECT id_persona, id_empresa FROM estudiantes WHERE id_estudiante = ?`,
          args: [row.id_estudiante]
        })
        const est = estRes.rows[0] as any

        if (est) {
          await db.execute({
            sql: `INSERT INTO afiliados (id_persona, id_empresa, tipo_afiliado, estatus, actualizado_en, activo)
                  VALUES (?, ?, CASE WHEN ? IS NOT NULL THEN 'Corporativo' ELSE 'Natural' END, '2_EXPEDIENTE', ?, 1)
                  ON CONFLICT(id_persona) DO UPDATE SET
                    estatus = '2_EXPEDIENTE',
                    actualizado_en = excluded.actualizado_en,
                    activo = 1`,
            args: [est.id_persona, est.id_empresa, est.id_empresa, now]
          })
        }
      } catch (err) {
        console.error('Error al mapear preinscripción a afiliado:', err);
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

    // Crear/Verificar Acceso
    try {
      const userRes = await db.execute({
        sql: `SELECT reset_token_hash FROM users WHERE email = ?`,
        args: [row.email]
      })
      const existingUser = userRes.rows[0] as any

      let tokenToUse = randomUUID() // siempre nuevo para aprobación directa

      if (!existingUser) {
        const expiracion = new Date()
        expiracion.setHours(expiracion.getHours() + 48)
        const placeholderPass = await bcrypt.hash(randomUUID(), 10)
        const tokenHash = sha256(tokenToUse)

        await db.execute({
          sql: `INSERT INTO users (email, password_hash, roles, reset_token_hash, reset_token_expira)
                VALUES (?, ?, '["estudiante"]', ?, ?)`,
          args: [row.email, placeholderPass, tokenHash, expiracion.toISOString()]
        })
      }

      // Enviar correo de bienvenida con acceso a password
      await enviarCorreoSetPasswordEstudiante({
        nombre: row.nombre_completo,
        emailOriginal: row.email,
        programaCodigo: row.programa_codigo || 'Curso',
        token: tokenToUse || randomUUID() // fallback
      })
    } catch (err) {
      console.error('Error preparando acceso directo:', err)
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

    res.json({ success: true, message: 'Preinscripción rechazada.', data: result.rows[0] })
  } catch (error) {
    console.error('adminRechazarPreinscripcion:', error)
    res.status(500).json({ success: false, message: 'Error al rechazar preinscripción' })
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
          COALESCE(p.nombres || ' ' || p.apellidos, emp.razon_social) as nombre_completo, 
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
                   COALESCE(p.nombres || ' ' || p.apellidos, emp.razon_social) as nombre_completo, 
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

    // 2. Si es programa de AFILIACION, actualizar/crear afiliado
    if (row.programa_codigo === 'AFILIACION') {
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
          // Obtener o generar un código cibir si pasa a "Afiliado"
          let nextCode = null
          if (targetAfiliadoStatus === 'Afiliado') {
            const resultUltimoCode = await db.execute({
              sql: `SELECT codigo_cibir FROM afiliados 
                    WHERE codigo_cibir GLOB '[0-9]*' 
                    ORDER BY CAST(codigo_cibir AS INTEGER) DESC LIMIT 1`,
              args: []
            })
            let correlativo = 1
            if (resultUltimoCode.rows.length > 0 && resultUltimoCode.rows[0].codigo_cibir) {
              const lastCode = parseInt(resultUltimoCode.rows[0].codigo_cibir as string, 10)
              if (!isNaN(lastCode)) correlativo = lastCode + 1
            }
            nextCode = correlativo.toString()
          }

          await db.execute({
            sql: `INSERT INTO afiliados (id_persona, id_empresa, tipo_afiliado, estatus, codigo_cibir, actualizado_en, activo)
                  VALUES (?, ?, COALESCE(
                    (SELECT tipo_afiliado FROM afiliados WHERE id_persona = ?),
                    CASE WHEN ? IS NOT NULL THEN 'Corporativo' ELSE 'Natural' END
                  ), ?, ?, ?, 1)
                  ON CONFLICT(id_persona) DO UPDATE SET
                    estatus = ?,
                    codigo_cibir = COALESCE(afiliados.codigo_cibir, ?),
                    actualizado_en = excluded.actualizado_en,
                    activo = 1`,
            args: [
              finalIdPersona, 
              est.id_empresa,
              finalIdPersona,
              est.id_empresa, 
              targetAfiliadoStatus, 
              nextCode, 
              now, 
              targetAfiliadoStatus, 
              nextCode
            ]
          })
        }
      }
    }

    // 3. Crear acceso al portal si pasa a 'Inscrito' (etapa >= 3)
    if (targetInscripcionStatus === 'Inscrito' && row.email) {
      try {
        const userRes = await db.execute({
          sql: `SELECT reset_token_hash FROM users WHERE email = ?`,
          args: [row.email]
        })
        const existingUser = userRes.rows[0] as any

        if (!existingUser) {
          const tokenToUse = randomUUID()
          const expiracion = new Date()
          expiracion.setHours(expiracion.getHours() + 48)
          const placeholderPass = await bcrypt.hash(randomUUID(), 10)
          const tokenHash = sha256(tokenToUse)

          await db.execute({
            sql: `INSERT INTO users (email, password_hash, roles, reset_token_hash, reset_token_expira)
                  VALUES (?, ?, '["estudiante"]', ?, ?)`,
            args: [row.email, placeholderPass, tokenHash, expiracion.toISOString()]
          })
        }
      } catch (err) {
        console.error('Error preparando acceso etapa:', err)
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
                 a.codigo_cibir, 
                 a.tipo_afiliado, 
                 a.estatus,
                 (p.nombres || ' ' || p.apellidos) as nombre_persona,
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
             OR (p.nombres || ' ' || p.apellidos LIKE ?)
             OR (e.razon_social LIKE ?)
          LIMIT 1
        `,
        args: [extractedDoc, extractedDoc, docSearchLike, docSearchLike, nameSearch, nameSearch]
      })
    } else {
      queryResult = await db.execute({
        sql: `
          SELECT a.id_afiliado, 
                 a.codigo_cibir, 
                 a.tipo_afiliado, 
                 a.estatus,
                 (p.nombres || ' ' || p.apellidos) as nombre_persona,
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
          WHERE (p.nombres || ' ' || p.apellidos LIKE ?)
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
        codigo_cibir: row.codigo_cibir,
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


