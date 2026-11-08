import { Resend } from 'resend';
import { env } from '../config/env.js';
import { formatNombreCard } from './formatters.js';

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

/** Último evento de entrega en Resend (sent, delivered, bounced…). En desarrollo devuelve 'delivered'. */
export const obtenerEstadoCorreo = async (emailId: string): Promise<string | null> => {
  if (env.NODE_ENV === 'development') return 'delivered'
  const { data, error } = await resend.emails.get(emailId)
  if (error) throw new Error(JSON.stringify(error))
  return data?.last_event ?? null
}

export const escapeHtml = (t: string) =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// shortcut: razón social detectada por sufijo legal (C.A., S.A., S.R.L.), upgrade pasando el tipo de entidad desde el llamador
const SUFIJO_EMPRESA = /\b(c\.?\s?a\.?|s\.?\s?a\.?|s\.?r\.?\s?l\.?|c\.?\s?r\.?\s?l\.?)$/i

/** Saludo: primer nombre + primer apellido; las razones sociales se dejan completas. */
const nombreSaludo = (nombre?: string | null) => {
  const t = (nombre || '').trim()
  return SUFIJO_EMPRESA.test(t) ? t : formatNombreCard(t) || 'estimado(a)'
}

/** Código interno de programa → texto legible (PADI, PEGI, CIBIR… son siglas conocidas y se dejan). */
const nombrePrograma = (codigo: string) => (codigo === 'AFILIACION' ? 'Afiliación' : codigo)

// Imágenes de los programas: viven en apps/web/public/email (las sirve el frontend, no Backblaze)
const PROGRAMAS_EMAIL: Record<string, string> = {
  CIBIR: 'Curso Introductorio de Bienes Raíces',
  PREANI: 'Programa de Estudios Avanzados en Negocios Inmobiliarios',
  PEGI: 'Programa de Especialización en Gerencia Inmobiliaria',
  PADI: 'Programa de Especialización en Administración de Inmuebles',
}
const urlEmail = (archivo: string) => `${env.APP_URL.replace(/\/$/, '')}/email/${archivo}`
/** Imagen centrada del programa (vacía si el código no es uno de los programas con imagen). */
const imagenPrograma = (codigo: string) => PROGRAMAS_EMAIL[codigo]
  ? `<div style="margin: 28px 0; text-align: center;">
        <img src="${urlEmail(`${codigo.toLowerCase()}.png`)}" alt="${codigo} — ${PROGRAMAS_EMAIL[codigo]}" width="360" style="width: 360px; max-width: 100%; height: auto; display: block; margin: 0 auto;" />
      </div>`
  : ''

const logoUrl = (env.B2_PUBLIC_URL_BASE || 'https://files-supa.s3.us-east-005.backblazeb2.com/').replace(/\/$/, '') + '/public-docs/Logo.png';

const FUENTE_TITULO = "Georgia, 'Times New Roman', serif"
const FUENTE_TEXTO = "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif"
// Estilo del botón en línea: muchos clientes de correo (Gmail con cuentas no Google, Outlook) ignoran <style>
const ESTILO_BOTON = `display: inline-block; background-color: #059669; color: #ffffff; padding: 14px 32px; border-radius: 12px; font-weight: 700; font-size: 16px; line-height: 1.2; text-decoration: none; text-align: center;`

/**
 * Plantilla base "El Registro Oficial" (ver apps/web/DESIGN.md): papel claro, franja verde profunda con el logo,
 * titular serif y un único botón esmeralda. Tablas + estilos en línea para que se vea igual en cualquier cliente.
 * `title` ya no es una etiqueta visible: se usa como texto de vista previa en la bandeja de entrada.
 */
export const renderEmailTemplate = (content: string, title?: string) => `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="light only">
    <title>${title ?? 'Cámara Inmobiliaria del Estado Bolívar'}</title>
    <style>
      @media only screen and (max-width: 480px) {
        .cuerpo { padding: 28px 20px !important; }
        .btn-bloque a { display: block !important; }
      }
    </style>
  </head>
  <body style="margin: 0; padding: 0; background-color: #f8fafc;">
    ${title ? `<div style="display: none; max-height: 0; overflow: hidden; opacity: 0; color: transparent;">${title}</div>` : ''}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc;">
      <tr>
        <td align="center" style="padding: 24px 12px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;">
            <tr>
              <td align="center" style="background-color: #065f46; padding: 28px 24px;">
                <img src="${logoUrl}" alt="" height="104" style="height: 104px; width: auto; display: block; margin: 0 auto;" />
                <div style="margin-top: -8px; color: #ffffff; font-family: ${FUENTE_TITULO}; font-size: 20px; line-height: 1.2; font-weight: 700;">Cámara Inmobiliaria<br>de Bolívar</div>
              </td>
            </tr>
            <tr>
              <td class="cuerpo" style="padding: 40px 36px; font-family: ${FUENTE_TEXTO}; font-size: 16px; line-height: 1.6; color: #1e293b;">
                ${content.replaceAll('class="btn"', `style="${ESTILO_BOTON}"`).replaceAll('class="divider"', 'style="height: 1px; background-color: #e2e8f0; margin: 28px 0;"')}
              </td>
            </tr>
          </table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px;">
            <tr>
              <td align="center" style="padding: 24px 12px; font-family: ${FUENTE_TEXTO}; font-size: 13px; line-height: 1.6; color: #64748b;">
                <strong style="color: #1e293b;">Cámara Inmobiliaria del Estado Bolívar</strong><br>
                Carrera Guri, Edif. Cámara de la Construcción, Alta Vista, Puerto Ordaz, Estado Bolívar.<br>
                <a href="${env.APP_URL}" style="color: #047857; font-weight: 600; text-decoration: underline;">Visitar nuestro portal</a>
                &nbsp;·&nbsp; &copy; ${new Date().getFullYear()} Todos los derechos reservados.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;

/** Correo de verificación de dirección (registro CIBIR) */
export const enviarCorreoVerificacion = async (nombreCompleto: string, emailOriginal: string, token: string) => {
  const nombre = nombreSaludo(nombreCompleto)
  const enlaceVerificacion = `${env.APP_URL}/cursos/verificar?token=${token}`
  const { data, error } = await sendResendEmail({
    from: DEFAULT_FROM,
    to: emailOriginal,
    subject: 'Confirma tu solicitud de afiliación — Cámara Inmobiliaria',
    html: renderEmailTemplate(`
      <h2 style="margin: 0 0 16px; color: #022c22; font-family: ${FUENTE_TITULO}; font-size: 26px; line-height: 1.25; font-weight: 700;">¡Hola, ${nombre}!</h2>
      <p>Has solicitado tu afiliación a la <strong>Cámara Inmobiliaria del Estado Bolívar</strong>.</p>
      <p>Para confirmar tu correo electrónico (<em>${emailOriginal}</em>) y continuar con tu proceso, haz clic en el siguiente botón:</p>
      <div style="text-align: center; margin: 40px 0;">
        <a href="${enlaceVerificacion}" class="btn">Confirmar Correo Electrónico</a>
      </div>
      <div class="divider"></div>
      <p style="font-size: 14px; color: #6b7280;">Si el botón no funciona, puedes copiar y pegar este enlace en tu navegador:</p>
      <p style="font-size: 12px; color: #047857; word-break: break-all;">${enlaceVerificacion}</p>
    `, 'Solicitud de Afiliación')
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
  const { emailOriginal, nombreEmpresa, token } = params
  const nombre = nombreSaludo(params.nombre)
  const enlaceVerificacion = `${env.APP_URL}/cursos/verificar?token=${token}`

  const { data, error } = await sendResendEmail({
    from: DEFAULT_FROM,
    to: emailOriginal,
    subject: `Invitación de ${nombreEmpresa} — Cámara Inmobiliaria`,
    html: renderEmailTemplate(`
      <h2 style="margin: 0 0 16px; color: #022c22; font-family: ${FUENTE_TITULO}; font-size: 26px; line-height: 1.25; font-weight: 700;">¡Hola, ${nombre}!</h2>
      <p>La empresa <strong>${nombreEmpresa}</strong> te ha registrado como parte de su equipo en la <strong>Cámara Inmobiliaria del Estado Bolívar</strong>.</p>
      <div style="background-color: #f9fafb; border-radius: 16px; padding: 24px; margin: 32px 0;">
        <p style="margin-top: 0; font-weight: 700; color: #1f2937;">Siguiente paso:</p>
        <p>Para completar tu perfil y cargar tus documentos obligatorios, haz clic en el botón:</p>
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
  const { emailOriginal, programaCodigo, token } = params
  const nombre = nombreSaludo(params.nombre)
  const enlace = `${env.APP_URL.replace(/\/$/, '')}/cursos/verificar?token=${token}`

  const esAfiliacion = programaCodigo === 'AFILIACION'
  const accion = esAfiliacion ? 'tu afiliación a la' : `preinscribirte al programa <strong>${nombrePrograma(programaCodigo)}</strong> de la`
  const subject = esAfiliacion ? 'Confirma tu solicitud de afiliación' : `Confirma tu preinscripción — ${programaCodigo}`

  const { data, error } = await sendResendEmail({
    from: DEFAULT_FROM,
    to: emailOriginal,
    subject,
    html: renderEmailTemplate(`
      <h2 style="margin: 0 0 16px; color: #022c22; font-family: ${FUENTE_TITULO}; font-size: 26px; line-height: 1.25; font-weight: 700;">¡Hola, ${nombre}!</h2>
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

/** Afiliado oficial: se le informa y se le da acceso a su panel (con enlace para establecer contraseña si aún no la tiene) */
export const enviarCorreoAprobacion = async (nombre: string, emailOriginal: string, token?: string) => {
  const enlace = token ? `${env.APP_URL}/establecer-contrasena?token=${token}` : `${env.APP_URL}/panel`
  const { data, error } = await sendResendEmail({
    from: DEFAULT_FROM,
    to: emailOriginal,
    subject: 'Es oficialmente afiliado de la Cámara Inmobiliaria del Estado Bolívar',
    html: renderEmailTemplate(`
      <h2 style="margin: 0 0 16px; color: #022c22; font-family: ${FUENTE_TITULO}; font-size: 28px; line-height: 1.25; font-weight: 700;">¡Felicidades, ${nombreSaludo(nombre)}!</h2>
      <p style="font-size: 18px;">Nos enorgullece informarle que, a partir de este momento, es oficialmente <strong>afiliado de la Cámara Inmobiliaria del Estado Bolívar</strong>.</p>
      <div style="background-color: #ecfdf5; border-radius: 12px; padding: 28px 24px; margin: 32px 0 20px; text-align: center;">
        <p style="margin: 0 0 6px; font-family: ${FUENTE_TITULO}; font-size: 20px; font-weight: 700; color: #065f46;">${token ? 'Establezca su contraseña' : 'Acceda a su panel'}</p>
        <p style="margin: 0 0 22px; color: #334155;">${token ? 'Con ella podrá acceder a su panel interno, donde gestionará su afiliación.' : 'Ya puede acceder a su panel interno, donde gestionará su afiliación.'}</p>
        <a href="${enlace}" class="btn">${token ? 'Establecer mi contraseña' : 'Ir a mi panel'}</a>
      </div>
      ${token ? '<p style="margin: 0; font-size: 13px; color: #64748b; text-align: center;">Este enlace es válido por 30 días.</p>' : ''}
    `, 'Afiliación oficial')
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
      <h2 style="margin: 0 0 16px; color: #022c22; font-family: ${FUENTE_TITULO}; font-size: 26px; line-height: 1.25; font-weight: 700;">Hola, ${nombre}</h2>
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
      <h2 style="margin: 0 0 16px; color: #022c22; font-family: ${FUENTE_TITULO}; font-size: 26px; line-height: 1.25; font-weight: 700;">Recupera tu acceso</h2>
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
      <h2 style="margin: 0 0 16px; color: #022c22; font-family: ${FUENTE_TITULO}; font-size: 26px; line-height: 1.25; font-weight: 700;">¡Felicitaciones, ${nombre}!</h2>
      <p>Tu participación en <strong>${tituloFormacion}</strong> ha sido registrada como <strong>completada</strong> con éxito.</p>
      <div style="background-color: #f1f5f9; border-radius: 8px; padding: 20px 24px; margin: 28px 0;">
        <p style="margin-top: 0; font-weight: 700; color: #1f2937;">Certificación Digital:</p>
        <p>Ya puedes descargar o compartir tu comprobante de aprobación oficial desde nuestro portal:</p>
        <div style="text-align: center; margin-top: 24px;">
          <a href="${urlComprobante}" class="btn">Ver Comprobante (PDF)</a>
        </div>
        <p style="font-size: 11px; color: #64748b; margin-top: 20px; text-align: center;">Código de validación: ${codigoValidacion}</p>
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
  const { emailOriginal, token } = params
  const nombre = nombreSaludo(params.nombre)
  const programa = nombrePrograma(params.programaCodigo)
  const enlaceSetup = token ? `${env.APP_URL}/establecer-contrasena?token=${token}` : `${env.APP_URL}/panel`

  const { data, error } = await sendResendEmail({
    from: DEFAULT_FROM,
    to: emailOriginal,
    subject: `Inscripción confirmada — ${programa}`,
    html: renderEmailTemplate(`
      <h2 style="margin: 0 0 16px; color: #022c22; font-family: ${FUENTE_TITULO}; font-size: 26px; line-height: 1.25; font-weight: 700;">¡Hola, ${nombre}!</h2>
      ${PROGRAMAS_EMAIL[params.programaCodigo]
        ? `<p>Confirmamos tu inscripción en el <strong>${PROGRAMAS_EMAIL[params.programaCodigo]} (${params.programaCodigo})</strong>.</p>${imagenPrograma(params.programaCodigo)}`
        : `<p>Tu inscripción en <strong>${programa}</strong> ha sido confirmada con éxito.</p>`}
      <div style="background-color: #ecfdf5; border-radius: 8px; padding: 20px 24px; margin: 28px 0;">
        <p style="margin-top: 0; font-weight: 700; color: #065f46;">${token ? 'Siguiente Paso: Crea tu contraseña' : 'Acceso al Portal'}</p>
        <p>${token ? 'Para acceder a tu panel de formación y completar tu registro, por favor establece tu contraseña segura:' : 'Ya puedes ingresar a tu panel personal para gestionar tu formación:'}</p>
        <div style="text-align: center; margin-top: 24px;">
          <a href="${enlaceSetup}" class="btn">${token ? 'Establecer mi Contraseña' : 'Ir a mi Panel'}</a>
        </div>
      </div>
      <p style="font-size: 13px; color: #6b7280;">${token ? 'Una vez creada, podrás entrar al sistema.' : 'Ingresa con tu correo electrónico y contraseña registrada.'}</p>
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
  const { emailOriginal, entrevistaFecha, entrevistaHora, entrevistaLugar, token } = params
  const nombre = nombreSaludo(params.nombre)
  const programaCodigo = nombrePrograma(params.programaCodigo)
  const enlaceSetup = token ? `${env.APP_URL}/establecer-contrasena?token=${token}` : null

  const { data, error } = await sendResendEmail({
    from: DEFAULT_FROM,
    to: emailOriginal,
    subject: `Cita de Entrevista — ${programaCodigo}`,
    html: renderEmailTemplate(`
      <h2 style="margin: 0 0 16px; color: #022c22; font-family: ${FUENTE_TITULO}; font-size: 26px; line-height: 1.25; font-weight: 700;">¡Hola, ${nombre}!</h2>
      <p>Tu solicitud para el programa <strong>${programaCodigo}</strong> ha avanzado a la fase de entrevista presencial.</p>
      <div style="background-color: #f1f5f9; border-radius: 8px; padding: 20px 24px; margin: 28px 0;">
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

export const enviarCorreoEnlaceAgenda = async (params: { nombre: string; email: string; url: string }) => {
  const nombre = escapeHtml(nombreSaludo(params.nombre))
  const { data, error } = await sendResendEmail({
    from: DEFAULT_FROM,
    to: params.email,
    subject: 'Elige el horario de tu entrevista — Cámara Inmobiliaria',
    html: renderEmailTemplate(`
      <h2 style="margin: 0 0 16px; color: #022c22; font-family: ${FUENTE_TITULO}; font-size: 26px; line-height: 1.25; font-weight: 700;">¡Hola, ${nombre}!</h2>
      <p>Tu solicitud avanzó a la fase de entrevista. Elige el día y la hora que mejor te convengan entre los horarios disponibles; la entrevista será por videollamada de Google Meet.</p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${params.url}" class="btn">Elegir mi horario</a>
      </div>
      <p style="font-size: 14px; color: #64748b;">El enlace es personal y vence en 14 días. Si ya no necesitas la entrevista o no puedes elegir un horario, responde a este correo.</p>
    `, 'Elige tu horario de entrevista')
  })
  if (error) { console.error('enviarCorreoEnlaceAgenda:', error); throw error }
  return data
}

export const enviarCorreoInvitacionCibir = async (params: {
  nombre: string
  emailOriginal: string
}) => {
  const nombre = nombreSaludo(params.nombre)

  const { data, error } = await sendResendEmail({
    from: DEFAULT_FROM,
    to: params.emailOriginal,
    subject: 'Confirmación de tu participación en el CIBIR — Cámara Inmobiliaria',
    html: renderEmailTemplate(`
      <h2 style="margin: 0 0 16px; color: #022c22; font-family: ${FUENTE_TITULO}; font-size: 26px; line-height: 1.25; font-weight: 700;">¡Hola, ${nombre}!</h2>
      <p>Confirmamos que formas parte del <strong>${PROGRAMAS_EMAIL.CIBIR} (CIBIR)</strong>, requisito de tu proceso de afiliación a la <strong>Cámara Inmobiliaria del Estado Bolívar</strong>.</p>
      ${imagenPrograma('CIBIR')}
      <p>Pronto nos pondremos en contacto contigo para informarte cómo continuar.</p>
    `, 'Afiliación - Participación en el CIBIR confirmada')
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
  /** Aprobación por cambio manual de etapa: no menciona entrevista */
  sinEntrevista?: boolean
}) => {
  const { emailOriginal, resultado, token, sinEntrevista } = params
  const nombre = nombreSaludo(params.nombre)
  const programaCodigo = nombrePrograma(params.programaCodigo)
  const enlacePortal = token ? `${env.APP_URL}/establecer-contrasena?token=${token}` : `${env.APP_URL}/panel`
  const esAprobado = resultado === 'Aprobado' || resultado === 'Parcial'
  const titular = (texto: string, tam = 26) => `<h2 style="margin: 0 0 16px; color: #022c22; font-family: ${FUENTE_TITULO}; font-size: ${tam}px; line-height: 1.25; font-weight: 700;">${texto}</h2>`

  const cuerpo = esAprobado ? `
      <div style="text-align: center;">
        ${titular(`¡Felicidades, ${nombre}!`, 30)}
        <p style="margin: 0; font-size: 18px; color: #1e293b;">${sinEntrevista ? `Tu solicitud para el programa <strong>${programaCodigo}</strong> ha avanzado a la siguiente etapa.` : `Aprobaste la entrevista del programa <strong>${programaCodigo}</strong>.`}</p>
        ${resultado === 'Parcial' ? '<p style="margin: 8px 0 0; font-size: 15px; color: #64748b;">Resultado: Aprobado parcial</p>' : ''}
      </div>
      <div style="background-color: #ecfdf5; border-radius: 12px; padding: 28px 24px; margin: 32px 0 20px; text-align: center;">
        <p style="margin: 0 0 6px; font-family: ${FUENTE_TITULO}; font-size: 20px; font-weight: 700; color: #065f46;">${token ? 'Establece tu contraseña' : 'Tu panel te espera'}</p>
        <p style="margin: 0 0 22px; color: #334155;">${token ? 'Con ella podrás ingresar a tu panel personal y dar seguimiento a tu proceso.' : 'Ingresa a tu panel personal para dar seguimiento a tu proceso.'}</p>
        <a href="${enlacePortal}" class="btn">${token ? 'Establecer mi contraseña' : 'Ir a mi panel'}</a>
      </div>
      ${token ? '<p style="margin: 0; font-size: 13px; color: #64748b; text-align: center;">Este enlace es válido por 30 días.</p>' : ''}
    ` : `
      ${titular('Gracias por tu interés')}
      <p>Hola, ${nombre}. Agradecemos el tiempo que dedicaste a tu solicitud para el programa <strong>${programaCodigo}</strong>.</p>
      <div style="background-color: #f1f5f9; border-radius: 8px; padding: 20px 24px; margin: 28px 0;">
        <p style="margin: 0;">Tras la evaluación, tu solicitud no podrá continuar en esta ocasión. Te invitamos a estar atento a próximas cohortes y a seguir participando en nuestras actividades.</p>
      </div>
    `

  const { data, error } = await sendResendEmail({
    from: DEFAULT_FROM,
    to: emailOriginal,
    subject: esAprobado ? (sinEntrevista ? `Tu solicitud avanzó de etapa — ${programaCodigo}` : `¡Felicidades! Aprobaste tu entrevista — ${programaCodigo}`) : `Información sobre tu solicitud — ${programaCodigo}`,
    html: renderEmailTemplate(cuerpo, 'Resultado')
  })
  if (error) { console.error('enviarCorreoResultadoEntrevista:', error); throw error }
  return data
}

/** Acceso al sistema tras la aprobación del CIBIR por la Junta Directiva (enlace para establecer contraseña) */
export const enviarCorreoAccesoCibirAprobado = async (nombre: string, emailOriginal: string, token: string) => {
  const enlaceSetup = `${env.APP_URL}/establecer-contrasena?token=${token}`
  const { data, error } = await sendResendEmail({
    from: DEFAULT_FROM,
    to: emailOriginal,
    subject: 'CIBIR aprobado: establece tu contraseña',
    html: renderEmailTemplate(`
      <h2 style="margin: 0 0 16px; color: #022c22; font-family: ${FUENTE_TITULO}; font-size: 26px; line-height: 1.25; font-weight: 700;">¡Felicidades, ${nombreSaludo(nombre)}!</h2>
      <p>La Junta Directiva de la <strong>Cámara Inmobiliaria del Estado Bolívar</strong> ha aprobado tu CIBIR.</p>
      <div style="background-color: #ecfdf5; border-radius: 8px; padding: 20px 24px; margin: 28px 0;">
        <p style="margin-top: 0; font-weight: 700; color: #065f46;">Establece tu contraseña</p>
        <p>Con ella podrás ingresar a tu panel y continuar con tu inscripción.</p>
        <div style="text-align: center; margin-top: 24px;">
          <a href="${enlaceSetup}" class="btn">Establecer mi Contraseña</a>
        </div>
      </div>
      <p style="font-size: 13px; color: #6b7280; text-align: center;">Este enlace tiene una validez de 30 días por motivos de seguridad.</p>
    `, 'CIBIR Aprobado')
  })
  if (error) { console.error('enviarCorreoAccesoCibirAprobado:', error); throw error }
  return data
}

/** Correo de Notificación de Rechazo de Solicitud/Preinscripción */
export const enviarCorreoRechazo = async (params: {
  nombre: string
  emailOriginal: string
  programaCodigo: string
  motivo?: string | null
}) => {
  const { emailOriginal, motivo } = params
  const nombre = nombreSaludo(params.nombre)
  const programaCodigo = nombrePrograma(params.programaCodigo)
  const { data, error } = await sendResendEmail({
    from: DEFAULT_FROM,
    to: emailOriginal,
    subject: `Estatus de tu solicitud — Cámara Inmobiliaria`,
    html: renderEmailTemplate(`
      <h2 style="margin: 0 0 16px; color: #022c22; font-family: ${FUENTE_TITULO}; font-size: 26px; line-height: 1.25; font-weight: 700;">Información sobre tu solicitud</h2>
      <p>Hola, <strong>${nombre}</strong>.</p>
      <p>Te informamos que tu solicitud ${params.programaCodigo === 'AFILIACION' ? 'de <strong>afiliación</strong>' : `para el programa <strong>${programaCodigo}</strong>`} no ha sido aprobada en esta ocasión.</p>
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
export const enviarCorreoOnboardingMasivo = async (nombreCompleto: string, emailOriginal: string, token: string) => {
  const nombre = nombreSaludo(nombreCompleto)
  const enlaceSetup = `${env.APP_URL}/establecer-contrasena?token=${token}`
  const { data, error } = await sendResendEmail({
    from: DEFAULT_FROM,
    to: emailOriginal,
    subject: 'Acceso a tu nuevo Portal — Cámara Inmobiliaria de Bolívar',
    html: renderEmailTemplate(`
      <h2 style="margin: 0 0 16px; color: #022c22; font-family: ${FUENTE_TITULO}; font-size: 26px; line-height: 1.25; font-weight: 700;">¡Estimado(a), ${nombre}!</h2>
      <p>En la <strong>Cámara Inmobiliaria del Estado Bolívar</strong>, nos mantenemos en un proceso de mejora continua para ofrecerle las mejores herramientas y servicios que fortalezcan su ejercicio profesional.</p>
      
      <p>Como parte de esta evolución, nos complace informarle que ya tiene a su disposición nuestro nuevo <strong>Portal Digital</strong>. Dado que usted ya es un miembro activo y valorado de nuestra Cámara, hemos pre-configurado su cuenta para que pueda acceder de forma inmediata.</p>
      
      <div style="background-color: #ecfdf5; border-radius: 8px; padding: 20px 24px; margin: 28px 0;">
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
      <p style="font-size: 13px; color: #64748b; text-align: center;">Es un honor contar con su participación en esta nueva etapa tecnológica de nuestra institución.</p>
    `, 'Mejora Continua')
  })
  if (error) { console.error('enviarCorreoOnboardingMasivo:', error); throw error }
  return data
}

/**
 * Notifica a un afiliado independiente que fue vinculado como Agente Corporativo.
 */
export const enviarCorreoVinculacionCorporativa = async (params: {
  nombre: string
  emailOriginal: string
  nombreEmpresa: string
}) => {
  const { emailOriginal, nombreEmpresa } = params
  const nombre = nombreSaludo(params.nombre)
  const enlacePanel = `${env.APP_URL}/panel`
  const { data, error } = await sendResendEmail({
    from: DEFAULT_FROM,
    to: emailOriginal,
    subject: `Ahora eres Agente Corporativo de ${nombreEmpresa} — Cámara Inmobiliaria`,
    html: renderEmailTemplate(`
      <h2 style="margin: 0 0 16px; color: #022c22; font-family: ${FUENTE_TITULO}; font-size: 26px; line-height: 1.25; font-weight: 700;">¡Hola, ${nombre}!</h2>
      <p>Tenemos buenas noticias para ti. La empresa <strong>${nombreEmpresa}</strong> te ha seleccionado y vinculado como <strong>Agente Corporativo</strong> en la <strong>Cámara Inmobiliaria del Estado Bolívar</strong>.</p>
      <div style="background-color: #ecfdf5; border-radius: 8px; padding: 20px 24px; margin: 28px 0; border: 1px solid #d1fae5;">
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

export interface CorreoSimple {
  to: string
  subject: string
  /** Título del encabezado de la plantilla */
  titulo: string
  /** Párrafos de texto plano (se escapan) */
  parrafos: string[]
  /** Si se indica, el correo lleva titular, un resumen en filas (la última fila se destaca) y/o un botón */
  detalle?: { etiqueta: string; valor: string }[]
  nota?: string
  boton?: { texto: string; url: string }
}

/**
 * Envía muchos correos con la API de lotes de Resend (hasta 100 por llamada), para que el cron
 * no haga una petición por destinatario. Devuelve cuántos se aceptaron.
 */
/** Cuerpo de un correo simple: solo párrafos o, si trae detalle/botón, titular + resumen + botón. */
const cuerpoSimple = (c: CorreoSimple) => {
  const parrafos = c.parrafos.map(p => `<p>${escapeHtml(p)}</p>`).join('')
  if (!c.detalle && !c.boton) return parrafos
  const filas = (c.detalle ?? []).map((f, i, todas) => {
    const ultima = i === todas.length - 1
    return `<tr>
          <td style="padding: 12px 0; ${i ? 'border-top: 1px solid #d1d5db;' : ''} color: #475569; font-size: 15px;">${escapeHtml(f.etiqueta)}</td>
          <td align="right" style="padding: 12px 0; ${i ? 'border-top: 1px solid #d1d5db;' : ''} color: ${ultima ? '#065f46' : '#1e293b'}; font-weight: 700; ${ultima ? `font-family: ${FUENTE_TITULO}; font-size: 24px;` : 'font-size: 16px;'}">${escapeHtml(f.valor)}</td>
        </tr>`
  }).join('')
  return `<h2 style="margin: 0 0 16px; color: #022c22; font-family: ${FUENTE_TITULO}; font-size: 26px; line-height: 1.25; font-weight: 700;">${escapeHtml(c.titulo)}</h2>
      ${parrafos}
      ${filas ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; border-radius: 8px; margin: 24px 0;"><tr><td style="padding: 4px 24px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${filas}</table></td></tr></table>` : ''}
      ${c.nota ? `<p style="font-size: 14px; color: #475569;">${escapeHtml(c.nota)}</p>` : ''}
      ${c.boton ? `<div style="text-align: center; margin: 32px 0 8px;"><a href="${c.boton.url}" class="btn">${escapeHtml(c.boton.texto)}</a></div>` : ''}`
}

export const enviarCorreosLote = async (correos: CorreoSimple[]): Promise<number> => {
  const emails = correos.filter(c => c.to).map(c => ({
    from: DEFAULT_FROM,
    to: c.to,
    subject: c.subject,
    html: renderEmailTemplate(cuerpoSimple(c), escapeHtml(c.titulo)),
  }))
  if (!emails.length) return 0
  if (env.NODE_ENV === 'development') {
    for (const e of emails) console.log(`--- [MOCK EMAIL LOTE] Para: ${e.to} · ${e.subject}`)
    return emails.length
  }
  if (!env.RESEND_API_KEY || env.RESEND_API_KEY === 're_123') return 0
  let enviados = 0
  for (let i = 0; i < emails.length; i += 100) {
    const { error } = await resend.batch.send(emails.slice(i, i + 100))
    if (error) console.error('[EMAIL] enviarCorreosLote:', error)
    else enviados += Math.min(100, emails.length - i)
  }
  return enviados
}

/** Aviso de cupo reservado en un curso de pago (no bloquea la preinscripción si falla). */
export const enviarCorreoReservaCurso = async (params: { nombre: string; email: string; curso: string; montoUsd: number; venceEn: string; esAfiliado: boolean }) => {
  const vence = new Date(params.venceEn).toLocaleString('es-VE', { timeZone: 'America/Caracas', dateStyle: 'long', timeStyle: 'short' })
  return enviarCorreosLote([{
    to: params.email,
    subject: `Cupo reservado — ${params.curso}`,
    titulo: 'Cupo reservado',
    parrafos: [
      `Hola, ${nombreSaludo(params.nombre)}.`,
      `Reservamos tu cupo en "${params.curso}". El monto a pagar es $${params.montoUsd.toFixed(2)}${params.esAfiliado ? ' (precio de afiliado)' : ''}.`,
      `La reserva vence el ${vence}. Paga antes de esa fecha en la sede de la Cámara${params.esAfiliado ? ' o reporta tu pago desde tu panel de afiliado' : ''} para conservar el cupo.`,
    ],
  }])
}

/**
 * Aviso de audiencia de mediación a una de las partes de una denuncia.
 * Al denunciado no se le revela quién denunció: solo el código del expediente.
 */
export const enviarCorreoMediacionDenuncia = async (params: {
  nombre: string
  emailOriginal: string
  rol: 'denunciante' | 'denunciado'
  codigoDenuncia: string
  fechaTexto: string
  lugar: string
  notas?: string | null
  reprogramada?: boolean
}) => {
  const { emailOriginal, rol, codigoDenuncia, fechaTexto, lugar, notas, reprogramada } = params
  const nombre = nombreSaludo(params.nombre)
  const intro = rol === 'denunciante'
    ? `El Tribunal de Ética y Disciplina ha ${reprogramada ? 'reprogramado' : 'convocado'} una audiencia de mediación para tratar la denuncia que presentaste (expediente <strong>${escapeHtml(codigoDenuncia)}</strong>).`
    : `El Tribunal de Ética y Disciplina ha ${reprogramada ? 'reprogramado' : 'convocado'} una audiencia de mediación en el marco de la denuncia con expediente <strong>${escapeHtml(codigoDenuncia)}</strong>, presentada contra usted.`
  const consulta = rol === 'denunciante'
    ? `<p style="font-size: 14px; color: #6b7280;">Puedes seguir el estado de tu caso en <a href="${env.APP_URL.replace(/\/$/, '')}/denuncias" style="color: #065f46;">${env.APP_URL.replace(/\/$/, '')}/denuncias</a> con tu código y tu PIN de seguimiento.</p>`
    : ''

  const { data, error } = await sendResendEmail({
    from: DEFAULT_FROM,
    to: emailOriginal,
    subject: `${reprogramada ? 'Audiencia reprogramada' : 'Audiencia de mediación'} — expediente ${codigoDenuncia}`,
    html: renderEmailTemplate(`
      <h2 style="margin: 0 0 16px; color: #022c22; font-family: ${FUENTE_TITULO}; font-size: 26px; line-height: 1.25; font-weight: 700;">Hola, ${nombre}</h2>
      <p>${intro}</p>
      <div style="background-color: #f1f5f9; border-radius: 8px; padding: 20px 24px; margin: 28px 0;">
        <p style="margin: 0 0 8px;"><strong>Fecha y hora:</strong> ${escapeHtml(fechaTexto)}</p>
        <p style="margin: 0;"><strong>Lugar o enlace:</strong> ${escapeHtml(lugar)}</p>
        ${notas ? `<p style="margin: 16px 0 0;"><strong>Debe llevar o preparar:</strong> ${escapeHtml(notas)}</p>` : ''}
      </div>
      <p>Su asistencia es importante para intentar resolver el caso de común acuerdo. Si no puede asistir, comuníquese con la Cámara con anticipación.</p>
      <div class="divider"></div>
      ${consulta}
    `, 'Tribunal de Ética')
  })
  if (error) { console.error('enviarCorreoMediacionDenuncia:', error); throw error }
  return data
}
