import { Resend } from 'resend';
import { env } from '../config/env.js';

const resend = new Resend(env.RESEND_API_KEY);

const FROM_NAME = 'Cámara Inmobiliaria de Bolívar';
const DEFAULT_FROM = `${FROM_NAME} <${env.RESEND_FROM_EMAIL}>`;

/**
 * Wrapper para enviar correos con Resend.
 * En desarrollo (development) solo loguea el envío para no gastar cuota.
 */
async function sendResendEmail(params: any) {
  if (env.NODE_ENV === 'development') {
    console.log('--- [MOCK EMAIL] ---')
    console.log(`Para: ${params.to}`)
    console.log(`Asunto: ${params.subject}`)
    console.log('---------------------')
    return { data: { id: 'mock-id' }, error: null }
  }

  if (!env.RESEND_API_KEY || env.RESEND_API_KEY === 're_123') {
    console.warn('[EMAIL] No hay una API KEY de Resend válida configurada.')
    return { data: null, error: { message: 'Missing API Key' } }
  }

  return await resend.emails.send(params)
}

/**
 * Wrapper para enviar correos por lote con Resend.
 */
async function sendResendEmailBatch(emails: any[]) {
  if (env.NODE_ENV === 'development') {
    console.log('--- [MOCK EMAIL BATCH] ---')
    console.log(`Cantidad: ${emails.length} correos`)
    for (const email of emails) {
      console.log(`  Para: ${email.to} | Asunto: ${email.subject}`)
    }
    console.log('---------------------------')
    return { data: emails.map((_, i) => ({ id: `mock-batch-id-${i}` })), error: null }
  }

  if (!env.RESEND_API_KEY || env.RESEND_API_KEY === 're_123') {
    console.warn('[EMAIL] No hay una API KEY de Resend válida configurada.')
    return { data: null, error: { message: 'Missing API Key' } }
  }

  return await resend.batch.send(emails)
}

const logoUrl = env.SUPABASE_URL
  ? `${env.SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/public-docs/Logo.png`
  : 'https://gmhybfyxcbfhcaugtvlx.supabase.co/storage/v1/object/public/public-docs/Logo.png';

/** Template base profesional */
const renderEmailTemplate = (content: string, title?: string) => `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f3f4f6; }
        .container { width: 100%; max-width: 600px; margin: 0 auto; padding: 20px 10px; box-sizing: border-box; }
        .card { background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); width: 100%; }
        .header { background-color: #065f46; padding: 40px 20px; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.025em; text-transform: uppercase; }
        .content { padding: 40px 20px; }
        .footer { padding: 32px 20px; text-align: center; color: #6b7280; font-size: 12px; }
        .btn { background-color: #10b981; color: #ffffff !important; padding: 14px 28px; text-decoration: none; border-radius: 12px; font-weight: 700; display: inline-block; transition: background-color 0.2s; max-width: 100%; box-sizing: border-box; }
        .divider { height: 1px; background-color: #f3f4f6; margin: 32px 0; }
        .badge { background-color: #ecfdf5; color: #065f46; padding: 4px 12px; border-radius: 9999px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; display: inline-block; margin-bottom: 16px; }
        
        @media only screen and (max-width: 480px) {
          .container { padding: 10px !important; }
          .content { padding: 30px 15px !important; }
          .header { padding: 30px 15px !important; }
          .header h1 { font-size: 20px !important; }
          .btn { width: 100% !important; padding: 16px 10px !important; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <div class="header">
            <div style="margin-bottom: 0px; text-align: center;">
              <img src="${logoUrl}" alt="Logo" style="height: 120px; width: auto; display: inline-block; vertical-align: middle;" />
            </div>
            <h1>Cámara Inmobiliaria</h1>
            <div style="color: #6ee7b7; font-size: 10px; font-weight: 700; margin-top: 4px;">ESTADO BOLÍVAR</div>
          </div>
          <div class="content">
            ${title ? `<div class="badge">${title}</div>` : ''}
            ${content}
          </div>
        </div>
        <div class="footer">
          <p><strong>Cámara Inmobiliaria del Estado Bolívar</strong></p>
          <p>Carrera Guri, Edif. Cámara de la Construcción, Alta Vista, Puerto Ordaz, Estado Bolívar.</p>
          <p>&copy; 2026 Todos los derechos reservados.</p>
          <div style="margin-top: 20px;">
            <a href="${env.APP_URL}" style="color: #065f46; text-decoration: none; font-weight: 600;">Visitar nuestro portal</a>
          </div>
        </div>
      </div>
    </body>
  </html>
`;

/** Correo de verificación de dirección (registro CIBIR) */
export const enviarCorreoVerificacion = async (nombre: string, emailOriginal: string, token: string) => {
  const enlaceVerificacion = `${env.APP_URL}/cibir/verificar?token=${token}`
  const { data, error } = await sendResendEmail({
    from: DEFAULT_FROM,
    to: emailOriginal,
    subject: 'Confirma tu registro en la Cámara Inmobiliaria (CIBIR)',
    html: renderEmailTemplate(`
      <h2 style="margin-top: 0; color: #111827; font-size: 24px;">¡Hola, ${nombre}!</h2>
      <p>Has solicitado preinscribirte al curso <strong>CIBIR</strong> de la Cámara Inmobiliaria del Estado Bolívar.</p>
      <p>Para confirmar tu correo electrónico (<em>${emailOriginal}</em>) y continuar con tu proceso, haz clic en el siguiente botón:</p>
      <div style="text-align: center; margin: 40px 0;">
        <a href="${enlaceVerificacion}" class="btn">Confirmar Correo Electrónico</a>
      </div>
      <div class="divider"></div>
      <p style="font-size: 14px; color: #6b7280;">Si el botón no funciona, puedes copiar y pegar este enlace en tu navegador:</p>
      <p style="font-size: 12px; color: #3b82f6; word-break: break-all;">${enlaceVerificacion}</p>
    `, 'Verificación de Registro')
  })
  if (error) { console.error('enviarCorreoVerificacion:', error); throw error }
  return data
}

/** Correo para afiliados registrados vía invitación corporativa */
export const enviarCorreoInvitacionCorporativa = async (params: {
  nombre: string,
  emailOriginal: string,
  nombreEmpresa: string,
  token: string
}) => {
  const { nombre, emailOriginal, nombreEmpresa, token } = params
  const enlaceVerificacion = `${env.APP_URL}/cursos/verificar?token=${token}`

  const { data, error } = await sendResendEmail({
    from: DEFAULT_FROM,
    to: emailOriginal,
    subject: `Invitación de ${nombreEmpresa} — Cámara Inmobiliaria`,
    html: renderEmailTemplate(`
      <h2 style="margin-top: 0; color: #111827; font-size: 24px;">¡Hola, ${nombre}!</h2>
      <p>La empresa <strong>${nombreEmpresa}</strong> te ha registrado como parte de su equipo en la <strong>Cámara Inmobiliaria del Estado Bolívar</strong>.</p>
      <div style="background-color: #f9fafb; border-radius: 16px; padding: 24px; margin: 32px 0;">
        <p style="margin-top: 0; font-weight: 700; color: #1f2937;">Siguiente paso:</p>
        <p>Para completar tu perfil y cargar tus documentos obligatorios (Cédula y Título), haz clic en el botón:</p>
        <div style="text-align: center; margin-top: 24px;">
          <a href="${enlaceVerificacion}" class="btn">Completar mi Perfil</a>
        </div>
      </div>
      <p style="font-size: 14px; color: #6b7280;">
        Una vez completado, tu solicitud entrará en el proceso de revisión. Recibirás actualizaciones sobre el estatus de tu afiliación por este medio.
      </p>
    `, 'Invitación Corporativa')
  })
  if (error) { console.error('enviarCorreoInvitacionCorporativa:', error); throw error }
  return data
}

/** Confirmación de preinscripción a programas principales (PADI/PEGI/PREANI/CIBIR) */
export const enviarCorreoConfirmacionPreinscripcionPrograma = async (params: {
  nombre: string
  emailOriginal: string
  programaCodigo: string
  token: string
}) => {
  const { nombre, emailOriginal, programaCodigo, token } = params
  const enlace = `${env.APP_URL.replace(/\/$/, '')}/cursos/verificar?token=${token}`

  const esAfiliacion = programaCodigo === 'AFILIACION'
  const accion = esAfiliacion ? 'solicitar tu afiliación a la' : `preinscribirte al programa <strong>${programaCodigo}</strong> de la`
  const subject = esAfiliacion ? 'Confirma tu solicitud de afiliación' : `Confirma tu preinscripción — ${programaCodigo}`

  const { data, error } = await sendResendEmail({
    from: DEFAULT_FROM,
    to: emailOriginal,
    subject,
    html: renderEmailTemplate(`
      <h2 style="margin-top: 0; color: #111827; font-size: 24px;">¡Hola, ${nombre}!</h2>
      <p>Has solicitado ${accion} Cámara Inmobiliaria del Estado Bolívar.</p>
      <p>Para confirmar tu correo electrónico (<em>${emailOriginal}</em>) y continuar con el proceso, por favor presiona el botón:</p>
      <div style="text-align: center; margin: 40px 0;">
        <a href="${enlace}" class="btn">Confirmar mi Solicitud</a>
      </div>
      <div class="divider"></div>
      <p style="font-size: 14px; color: #6b7280;">Si no fuiste tú, puedes ignorar este mensaje de forma segura.</p>
    `, esAfiliacion ? 'Afiliación' : 'Preinscripción')
  })
  if (error) {
    console.error('enviarCorreoConfirmacionPreinscripcionPrograma:', error)
    throw error
  }
  return data
}

/** Correo de bienvenida + enlace para establecer contraseña inicial (afiliado aprobado) */
export const enviarCorreoAprobacion = async (nombre: string, emailOriginal: string, token: string) => {
  const enlaceSetup = `${env.APP_URL}/establecer-contrasena?token=${token}`
  const { data, error } = await sendResendEmail({
    from: DEFAULT_FROM,
    to: emailOriginal,
    subject: '¡Felicidades! Tu solicitud ha sido aprobada',
    html: renderEmailTemplate(`
      <h2 style="margin-top: 0; color: #111827; font-size: 24px;">¡Felicidades, ${nombre}!</h2>
      <p>Tu solicitud de afiliación a la <strong>Cámara Inmobiliaria del Estado Bolívar</strong> ha sido aprobada con éxito.</p>
      <div style="background-color: #f0fdf4; border-radius: 16px; padding: 24px; margin: 32px 0;">
        <p style="margin-top: 0; font-weight: 700; color: #065f46;">Próximo paso: Configura tu acceso</p>
        <p>Establece tu contraseña para ingresar al portal y comenzar a disfrutar de los beneficios de la Cámara.</p>
        <div style="text-align: center; margin-top: 24px;">
          <a href="${enlaceSetup}" class="btn">Establecer mi Contraseña</a>
        </div>
      </div>
      <p style="font-size: 13px; color: #6b7280; text-align: center;">Este enlace tiene una validez de 7 días por motivos de seguridad.</p>
    `, 'Afiliación Aprobada')
  })
  if (error) { console.error('enviarCorreoAprobacion:', error); throw error }
  return data
}

/** Correo de reset de contraseña (admin) */
export const enviarCorreoResetAdmin = async (nombre: string, emailOriginal: string, token: string) => {
  const enlace = `${env.APP_URL}/establecer-contrasena?token=${token}&modo=reset`
  const { data, error } = await sendResendEmail({
    from: DEFAULT_FROM,
    to: emailOriginal,
    subject: 'Restablecimiento de contraseña — Cámara Inmobiliaria',
    html: renderEmailTemplate(`
      <h2 style="margin-top: 0; color: #111827; font-size: 24px;">Hola, ${nombre}</h2>
      <p>Un administrador ha iniciado un restablecimiento de contraseña para tu cuenta (<em>${emailOriginal}</em>).</p>
      <p>Haz clic en el botón inferior para crear tu nueva contraseña. El enlace es válido por <strong>7 días</strong>.</p>
      <div style="text-align: center; margin: 40px 0;">
        <a href="${enlace}" class="btn">Restablecer Contraseña</a>
      </div>
      <p style="font-size: 13px; color: #6b7280;">Si no esperabas este correo, puedes ignorarlo con seguridad.</p>
    `, 'Seguridad')
  })
  if (error) throw new Error(`enviarCorreoResetAdmin: ${JSON.stringify(error)}`)
  return data
}

/** Olvidé mi contraseña */
export const enviarCorreoOlvideContrasena = async (emailOriginal: string, token: string) => {
  const enlace = `${env.APP_URL}/establecer-contrasena?token=${token}&modo=reset`
  const { data, error } = await sendResendEmail({
    from: DEFAULT_FROM,
    to: emailOriginal,
    subject: 'Recupera tu contraseña — Cámara Inmobiliaria',
    html: renderEmailTemplate(`
      <h2 style="margin-top: 0; color: #111827; font-size: 24px;">Recupera tu acceso</h2>
      <p>Hemos recibido una solicitud para restablecer la contraseña de <strong>${emailOriginal}</strong>.</p>
      <p>Haz clic en el botón inferior para crear una nueva contraseña. Este enlace es válido por <strong>1 hora</strong>.</p>
      <div style="text-align: center; margin: 40px 0;">
        <a href="${enlace}" class="btn">Restablecer mi Contraseña</a>
      </div>
      <p style="font-size: 13px; color: #6b7280;">Si no solicitaste este cambio, no es necesario realizar ninguna acción.</p>
    `, 'Seguridad')
  })
  if (error) throw new Error(`enviarCorreoOlvideContrasena: ${JSON.stringify(error)}`)
  return data
}

/** Comprobante de aprobación digital */
export const enviarCorreoComprobanteGraduacion = async (params: {
  nombre: string
  emailEstudiante: string
  tituloFormacion: string
  codigoValidacion: string
}) => {
  const { nombre, emailEstudiante, tituloFormacion, codigoValidacion } = params
  const urlComprobante = `${env.APP_URL.replace(/\/$/, '')}/comprobante/${encodeURIComponent(codigoValidacion)}`

  const { data, error } = await sendResendEmail({
    from: DEFAULT_FROM,
    to: emailEstudiante,
    subject: `Tu comprobante de aprobación digital — ${tituloFormacion}`,
    html: renderEmailTemplate(`
      <h2 style="margin-top: 0; color: #111827; font-size: 24px;">¡Felicitaciones, ${nombre}!</h2>
      <p>Tu participación en <strong>${tituloFormacion}</strong> ha sido registrada como <strong>completada</strong> con éxito.</p>
      <div style="background-color: #f8fafc; border-radius: 16px; padding: 24px; margin: 32px 0;">
        <p style="margin-top: 0; font-weight: 700; color: #1f2937;">Certificación Digital:</p>
        <p>Ya puedes descargar o compartir tu comprobante de aprobación oficial desde nuestro portal:</p>
        <div style="text-align: center; margin-top: 24px;">
          <a href="${urlComprobante}" class="btn">Ver Comprobante (PDF)</a>
        </div>
        <p style="font-size: 11px; color: #94a3b8; margin-top: 20px; text-align: center;">Código de validación: ${codigoValidacion}</p>
      </div>
    `, 'Certificación')
  })
  if (error) { console.error('enviarCorreoComprobanteGraduacion:', error); throw error }
  return data
}

export const enviarCorreoSetPasswordEstudiante = async (params: {
  nombre: string
  emailOriginal: string
  programaCodigo: string
  token?: string
}) => {
  const { nombre, emailOriginal, programaCodigo, token } = params
  const enlaceSetup = token ? `${env.APP_URL}/establecer-contrasena?token=${token}` : `${env.APP_URL}/panel`

  const { data, error } = await sendResendEmail({
    from: DEFAULT_FROM,
    to: emailOriginal,
    subject: `Continúa tu inscripción — ${programaCodigo}`,
    html: renderEmailTemplate(`
      <h2 style="margin-top: 0; color: #111827; font-size: 24px;">¡Hola, ${nombre}!</h2>
      <p>Tu preinscrpción ha sido aprobada con éxito para el programa <strong>${programaCodigo}</strong>.</p>
      <div style="background-color: #f0fdf4; border-radius: 16px; padding: 24px; margin: 32px 0;">
        <p style="margin-top: 0; font-weight: 700; color: #065f46;">${token ? 'Siguiente Paso: Crea tu contraseña' : 'Acceso al Portal'}</p>
        <p>${token ? 'Para acceder a tu panel de formación y completar tu registro, por favor establece tu contraseña segura:' : 'Ya puedes ingresar a tu panel personal para gestionar tu formación:'}</p>
        <div style="text-align: center; margin-top: 24px;">
          <a href="${enlaceSetup}" class="btn">${token ? 'Establecer mi Contraseña' : 'Ir a mi Panel'}</a>
        </div>
      </div>
      <p style="font-size: 13px; color: #6b7280;">${token ? 'Una vez creada, podrás entrar al sistema.' : 'Ingresa con tu correo electrónico y contraseña registrada.'} Un administrador se pondrá en contacto contigo para los siguientes pasos.</p>
    `, 'Formación')
  })
  if (error) { console.error('enviarCorreoSetPasswordEstudiante:', error); throw error }
  return data
}

export const enviarCorreoAprobacionEstudiante = async (params: {
  nombre: string
  emailOriginal: string
  programaCodigo: string
  entrevistaFecha: string
  entrevistaHora: string
  entrevistaLugar: string
  token?: string
}) => {
  const { nombre, emailOriginal, programaCodigo, entrevistaFecha, entrevistaHora, entrevistaLugar, token } = params
  const enlaceSetup = token ? `${env.APP_URL}/establecer-contrasena?token=${token}` : null

  const { data, error } = await sendResendEmail({
    from: DEFAULT_FROM,
    to: emailOriginal,
    subject: `Cita de Entrevista — ${programaCodigo}`,
    html: renderEmailTemplate(`
      <h2 style="margin-top: 0; color: #111827; font-size: 24px;">¡Hola, ${nombre}!</h2>
      <p>Tu solicitud para el programa <strong>${programaCodigo}</strong> ha avanzado a la fase de entrevista presencial.</p>
      <div style="background-color: #f8fafc; border-radius: 16px; padding: 24px; margin: 32px 0; border: 1px solid #e2e8f0;">
        <h3 style="margin-top: 0; color: #065f46; font-size: 16px;">Detalles de tu Cita:</h3>
        <table style="width: 100%; font-size: 14px;">
          <tr><td style="padding: 4px 0; color: #64748b; width: 80px;">Fecha:</td><td style="font-weight: 700;">${entrevistaFecha}</td></tr>
          <tr><td style="padding: 4px 0; color: #64748b;">Hora:</td><td style="font-weight: 700;">${entrevistaHora}</td></tr>
          <tr><td style="padding: 4px 0; color: #64748b;">Lugar:</td><td style="font-weight: 700;">${entrevistaLugar}</td></tr>
        </table>
      </div>
      <p style="font-size: 14px; color: #64748b;">Por favor, asiste puntualmente con tu documentación física si aún no la has consignado. ¡Te esperamos!</p>
    `, 'Cita de Entrevista')
  })
  if (error) { console.error('enviarCorreoAprobacionEstudiante:', error); throw error }
  return data
}

export const enviarCorreoInvitacionCibir = async (params: {
  nombre: string
  emailOriginal: string
  token?: string
}) => {
  const { nombre, emailOriginal, token } = params
  const enlacePortal = token ? `${env.APP_URL}/establecer-contrasena?token=${token}` : `${env.APP_URL}/panel`

  const { data, error } = await sendResendEmail({
    from: DEFAULT_FROM,
    to: emailOriginal,
    subject: 'Información sobre tu solicitud de afiliación — CIBIR',
    html: renderEmailTemplate(`
      <h2 style="margin-top: 0; color: #111827; font-size: 24px;">¡Hola, ${nombre}!</h2>
      <p>Hemos revisado tu solicitud de afiliación a la <strong>Cámara Inmobiliaria del Estado Bolívar</strong>.</p>
      
      <div style="background-color: #f8fafc; border-radius: 16px; padding: 24px; margin: 32px 0; border: 1px solid #e2e8f0;">
        <p style="margin-top: 0; font-weight: 700; color: #1e40af;">Requerimiento Académico</p>
        <p>Para completar tu proceso de afiliación, es necesario que realices el <strong>Curso de Inducción de Bienes Raíces (CIBIR)</strong>, el cual te proporcionará los conocimientos fundamentales necesarios para el ejercicio profesional en nuestro estado.</p>
        
        <p>Ya te hemos dado acceso a nuestro portal para que puedas gestionar tu formación y estar al tanto de las próximas cohortes del curso.</p>
        
        <div style="text-align: center; margin-top: 24px;">
          <a href="${enlacePortal}" class="btn">${token ? 'Activar mi Cuenta' : 'Ir a mi Panel'}</a>
        </div>
      </div>
      
      <p style="font-size: 14px; color: #64748b;">Una vez que completes satisfactoriamente el programa CIBIR, tu solicitud de afiliación continuará a la siguiente fase de aprobación.</p>
    `, 'Afiliación - CIBIR')
  })
  if (error) { console.error('enviarCorreoInvitacionCibir:', error); throw error }
  return data
}

/** Notifica el resultado final de la entrevista */
export const enviarCorreoResultadoEntrevista = async (params: {
  nombre: string
  emailOriginal: string
  resultado: 'Aprobado' | 'Parcial' | 'Rechazado'
  programaCodigo: string
  token?: string
}) => {
  const { nombre, emailOriginal, resultado, programaCodigo, token } = params
  const enlacePortal = token ? `${env.APP_URL}/establecer-contrasena?token=${token}` : `${env.APP_URL}/panel`
  const esAprobado = resultado === 'Aprobado' || resultado === 'Parcial'

  const { data, error } = await sendResendEmail({
    from: DEFAULT_FROM,
    to: emailOriginal,
    subject: esAprobado ? `¡Bienvenido al sistema! — ${programaCodigo}` : `Resultado de tu solicitud — ${programaCodigo}`,
    html: renderEmailTemplate(`
      <h2 style="margin-top: 0; color: #111827; font-size: 24px;">${esAprobado ? '¡Felicidades!' : 'Información sobre tu solicitud'}</h2>
      <p>Hola, ${nombre}. Tras la entrevista realizada para el programa <strong>${programaCodigo}</strong>, tu resultado es: <span style="font-weight: 800; color: ${esAprobado ? '#10b981' : '#ef4444'};">${resultado === 'Parcial' ? 'Aprobado Parcial' : resultado}</span>.</p>
      
      ${esAprobado ? `
        <div style="background-color: #f0fdf4; border-radius: 16px; padding: 24px; margin: 32px 0;">
          <p style="margin-top: 0; font-weight: 700; color: #065f46;">Acceso a la Intranet</p>
          <p>Ya puedes ingresar a tu panel personal para gestionar tu formación y ver tu progreso.</p>
          <div style="text-align: center; margin-top: 24px;">
            <a href="${enlacePortal}" class="btn">${token ? 'Configurar y Entrar' : 'Ir a mi Panel'}</a>
          </div>
        </div>
      ` : `
        <div style="background-color: #fef2f2; border-radius: 16px; padding: 24px; margin: 32px 0;">
          <p style="margin: 0; color: #991b1b;">Lamentamos informarte que tu solicitud no ha sido aprobada en esta ocasión. Te invitamos a estar atento a próximas cohortes y seguir participando en nuestras actividades.</p>
        </div>
      `}
    `, 'Resultado')
  })
  if (error) { console.error('enviarCorreoResultadoEntrevista:', error); throw error }
  return data
}

/** Correo de Notificación de Rechazo de Solicitud/Preinscripción */
export const enviarCorreoRechazo = async (params: {
  nombre: string
  emailOriginal: string
  programaCodigo: string
  motivo?: string | null
}) => {
  const { nombre, emailOriginal, programaCodigo, motivo } = params
  const { data, error } = await sendResendEmail({
    from: DEFAULT_FROM,
    to: emailOriginal,
    subject: `Estatus de tu solicitud — Cámara Inmobiliaria`,
    html: renderEmailTemplate(`
      <h2 style="margin-top: 0; color: #111827; font-size: 24px;">Información sobre tu solicitud</h2>
      <p>Hola, <strong>${nombre}</strong>.</p>
      <p>Te informamos que tu solicitud para el programa/afiliación <strong>${programaCodigo}</strong> no ha sido aprobada en esta ocasión.</p>
      ${motivo ? `
        <div style="background-color: #f9fafb; border-radius: 12px; padding: 20px; border: 1px solid #e5e7eb; margin: 24px 0;">
          <p style="margin-top: 0; font-weight: 700; color: #374151; font-size: 14px;">Motivo o comentarios de la administración:</p>
          <p style="margin-bottom: 0; font-style: italic; color: #4b5563; font-size: 13px;">"${motivo}"</p>
        </div>
      ` : ''}
      <p style="font-size: 14px; color: #4b5563; margin-top: 24px;">
        Agradecemos tu interés y el tiempo dedicado a postularte. Si deseas solventar los inconvenientes e intentarlo de nuevo en el futuro, podrás realizar una nueva solicitud ingresando a nuestro portal.
      </p>
    `, 'Solicitud Rechazada')
  })
  if (error) { console.error('enviarCorreoRechazo:', error); throw error }
  return data
}

/** Correo de Onboarding Masivo para afiliados existentes */
export const enviarCorreoOnboardingMasivo = async (nombre: string, emailOriginal: string, token: string) => {
  const enlaceSetup = `${env.APP_URL}/establecer-contrasena?token=${token}`
  const { data, error } = await sendResendEmail({
    from: DEFAULT_FROM,
    to: emailOriginal,
    subject: 'Acceso a tu nuevo Portal — Cámara Inmobiliaria de Bolívar',
    html: renderEmailTemplate(`
      <h2 style="margin-top: 0; color: #111827; font-size: 24px;">¡Estimado(a), ${nombre}!</h2>
      <p>En la <strong>Cámara Inmobiliaria del Estado Bolívar</strong>, nos mantenemos en un proceso de mejora continua para ofrecerle las mejores herramientas y servicios que fortalezcan su ejercicio profesional.</p>
      
      <p>Como parte de esta evolución, nos complace informarle que ya tiene a su disposición nuestro nuevo <strong>Portal Digital</strong>. Dado que usted ya es un miembro activo y valorado de nuestra Cámara, hemos pre-configurado su cuenta para que pueda acceder de forma inmediata.</p>
      
      <div style="background-color: #f0fdf4; border-radius: 16px; padding: 24px; margin: 32px 0;">
        <p style="margin-top: 0; font-weight: 700; color: #065f46;">Activa tu acceso como Afiliado</p>
        <p>Para comenzar a utilizar el sistema, gestionar sus certificados y acceder a contenido exclusivo, solo debe establecer su contraseña de seguridad haciendo clic en el siguiente botón:</p>
        <div style="text-align: center; margin-top: 24px;">
          <a href="${enlaceSetup}" class="btn">Activar mi Acceso</a>
        </div>
      </div>
      
      <p style="font-size: 14px; color: #6b7280;">
        Su nombre de usuario será su correo electrónico: <strong>${emailOriginal}</strong>. Este enlace de activación es personal y garantiza la seguridad de su cuenta.
      </p>
      
      <div class="divider"></div>
      <p style="font-size: 13px; color: #94a3b8; text-align: center;">Es un honor contar con su participación en esta nueva etapa tecnológica de nuestra institución.</p>
    `, 'Mejora Continua')
  })
  if (error) { console.error('enviarCorreoOnboardingMasivo:', error); throw error }
  return data
}

/** Envia correos de Onboarding Masivo en lote (Batch) */
export const enviarCorreoOnboardingMasivoBatch = async (
  destinatarios: Array<{ nombre: string; emailDestino: string; token: string }>
) => {
  const emails = destinatarios.map(d => {
    const enlaceSetup = `${env.APP_URL}/establecer-contrasena?token=${d.token}`
    return {
      from: DEFAULT_FROM,
      to: d.emailDestino,
      subject: 'Acceso a tu nuevo Portal — Cámara Inmobiliaria de Bolívar',
      html: renderEmailTemplate(`
        <h2 style="margin-top: 0; color: #111827; font-size: 24px;">¡Estimado(a), ${d.nombre}!</h2>
        <p>En la <strong>Cámara Inmobiliaria del Estado Bolívar</strong>, nos mantenemos en un proceso de mejora continua para ofrecerle las mejores herramientas y servicios que fortalezcan su ejercicio profesional.</p>
        
        <p>Como parte de esta evolución, nos complace informarle que ya tiene a su disposición nuestro nuevo <strong>Portal Digital</strong>. Dado que usted ya es un miembro activo y valorado de nuestra Cámara, hemos pre-configurado su cuenta para que pueda acceder de forma inmediata.</p>
        
        <div style="background-color: #f0fdf4; border-radius: 16px; padding: 24px; margin: 32px 0;">
          <p style="margin-top: 0; font-weight: 700; color: #065f46;">Activa tu acceso como Afiliado</p>
          <p>Para comenzar a utilizar el sistema, gestionar sus certificados y acceder a contenido exclusivo, solo debe establecer su contraseña de seguridad haciendo clic en el siguiente botón:</p>
          <div style="text-align: center; margin-top: 24px;">
            <a href="${enlaceSetup}" class="btn">Activar mi Acceso</a>
          </div>
        </div>
        
        <p style="font-size: 14px; color: #6b7280;">
          Su nombre de usuario será su correo electrónico: <strong>${d.emailDestino}</strong>. Este enlace de activación es personal y garantiza la seguridad de su cuenta.
        </p>
        
        <div class="divider"></div>
        <p style="font-size: 13px; color: #94a3b8; text-align: center;">Es un honor contar con su participación en esta nueva etapa tecnológica de nuestra institución.</p>
      `, 'Mejora Continua')
    }
  })

  const { data, error } = await sendResendEmailBatch(emails)
  if (error) {
    console.error('enviarCorreoOnboardingMasivoBatch:', error)
    throw error
  }
  return data
}

/** NOTIFICACIONES PARA EL ADMINISTRADOR */

export const notificarAdminNuevaPreinscripcion = async (params: {
  idInscripcion: number
  nombre: string
  email: string
  programaCodigo: string
  cedulaRif?: string | null
  telefono?: string | null
}) => {
  const { idInscripcion, nombre, email, programaCodigo, cedulaRif, telefono } = params
  const enlaceGestion = `${env.APP_URL}/admin/formacion?id=${idInscripcion}&tab=preinscripciones`

  await sendResendEmail({
    from: DEFAULT_FROM,
    to: env.ADMIN_EMAIL,
    subject: `NUEVA SOLICITUD: Preinscripción ${programaCodigo}`,
    html: renderEmailTemplate(`
      <h2 style="margin-top: 0; color: #1e40af; font-size: 20px;">Nueva Solicitud Recibida</h2>
      <p>Se ha registrado un nuevo interesado en el sistema:</p>
      <div style="background-color: #f8fafc; border-radius: 12px; padding: 20px; border: 1px solid #e2e8f0;">
        <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
          <tr><td style="padding: 6px 0; color: #64748b; width: 100px;">Programa:</td><td style="font-weight: 700;">${programaCodigo}</td></tr>
          <tr><td style="padding: 6px 0; color: #64748b;">Nombre:</td><td style="font-weight: 700;">${nombre}</td></tr>
          <tr><td style="padding: 6px 0; color: #64748b;">Email:</td><td style="font-weight: 700;">${email}</td></tr>
          <tr><td style="padding: 6px 0; color: #64748b;">Cédula/RIF:</td><td style="font-weight: 700;">${cedulaRif || 'N/A'}</td></tr>
          <tr><td style="padding: 6px 0; color: #64748b;">Teléfono:</td><td style="font-weight: 700;">${telefono || 'N/A'}</td></tr>
        </table>
      </div>
      <div style="text-align: center; margin-top: 32px;">
        <a href="${enlaceGestion}" class="btn" style="background-color: #1e40af;">Gestionar en Panel</a>
      </div>
    `, 'Notificación Admin')
  })
}

export const notificarAdminNuevaAfiliacion = async (params: {
  nombre: string
  email: string
  cedulaRif: string
  telefono: string
}) => {
  const { nombre, email, cedulaRif, telefono } = params
  await sendResendEmail({
    from: DEFAULT_FROM,
    to: env.ADMIN_EMAIL,
    subject: `NUEVA SOLICITUD: Afiliación (CIBIR)`,
    html: renderEmailTemplate(`
      <h2 style="margin-top: 0; color: #047857; font-size: 20px;">Nueva Solicitud de Afiliación</h2>
      <p>Un candidato ha verificado su correo y completado la preinscripción CIBIR:</p>
      <div style="background-color: #f0fdf4; border-radius: 12px; padding: 20px; border: 1px solid #d1fae5;">
        <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
          <tr><td style="padding: 6px 0; color: #065f46; width: 100px;">Nombre:</td><td style="font-weight: 700;">${nombre}</td></tr>
          <tr><td style="padding: 6px 0; color: #065f46;">Email:</td><td style="font-weight: 700;">${email}</td></tr>
          <tr><td style="padding: 6px 0; color: #065f46;">Cédula/RIF:</td><td style="font-weight: 700;">${cedulaRif}</td></tr>
          <tr><td style="padding: 6px 0; color: #065f46;">Teléfono:</td><td style="font-weight: 700;">${telefono}</td></tr>
        </table>
      </div>
      <p style="font-size: 13px; color: #6b7280; margin-top: 20px;">El candidato ya se encuentra en fase de <strong>Preinscripción</strong> en el panel administrativo.</p>
    `, 'Notificación Admin')
  })
}

/**
 * Notifica a un afiliado independiente que fue vinculado como Agente Corporativo.
 */
export const enviarCorreoVinculacionCorporativa = async (params: {
  nombre: string
  emailOriginal: string
  nombreEmpresa: string
}) => {
  const { nombre, emailOriginal, nombreEmpresa } = params
  const enlacePanel = `${env.APP_URL}/panel`
  const { data, error } = await sendResendEmail({
    from: DEFAULT_FROM,
    to: emailOriginal,
    subject: `Ahora eres Agente Corporativo de ${nombreEmpresa} — Cámara Inmobiliaria`,
    html: renderEmailTemplate(`
      <h2 style="margin-top: 0; color: #111827; font-size: 24px;">¡Hola, ${nombre}!</h2>
      <p>Tenemos buenas noticias para ti. La empresa <strong>${nombreEmpresa}</strong> te ha seleccionado y vinculado como <strong>Agente Corporativo</strong> en la <strong>Cámara Inmobiliaria del Estado Bolívar</strong>.</p>
      <div style="background-color: #f0fdf4; border-radius: 16px; padding: 24px; margin: 32px 0; border: 1px solid #d1fae5;">
        <p style="margin-top: 0; font-weight: 700; color: #065f46;">¿Qué significa esto?</p>
        <ul style="color: #374151; font-size: 14px; padding-left: 20px; line-height: 1.8;">
          <li>Tu perfil ahora está asociado a <strong>${nombreEmpresa}</strong>.</li>
          <li>Seguirás disfrutando de todos los beneficios de tu afiliación.</li>
          <li>La empresa podrá coordinar actividades contigo a través del portal.</li>
        </ul>
        <div style="text-align: center; margin-top: 24px;">
          <a href="${enlacePanel}" class="btn">Ver mi Panel</a>
        </div>
      </div>
      <p style="font-size: 13px; color: #6b7280; text-align: center;">Si tienes alguna duda, comunícate directamente con la empresa o con la Cámara Inmobiliaria.</p>
    `, 'Vinculación Corporativa')
  })
  if (error) { console.error('enviarCorreoVinculacionCorporativa:', error) }
  return data
}
