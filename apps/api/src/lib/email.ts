import { Resend } from 'resend';
import { env } from '../config/env.js';

const resend = new Resend(env.RESEND_API_KEY);

const FROM_NAME = 'Cámara Inmobiliaria de Bolívar';
const DEFAULT_FROM = `${FROM_NAME} <${env.RESEND_FROM_EMAIL}>`;

/** Correo de verificación de dirección (registro CIBIR) */
export const enviarCorreoVerificacion = async (nombre: string, emailOriginal: string, token: string) => {
  const enlaceVerificacion = `${env.APP_URL}/cibir/verificar?token=${token}`
  const { data, error } = await resend.emails.send({
    from: DEFAULT_FROM,
    to: emailOriginal,
    subject: 'Confirma tu registro en la Cámara Inmobiliaria (CIBIR)',
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#333;">
        <h2 style="color:#166534;">¡Hola, ${nombre}!</h2>
        <p>Has solicitado preinscribirte al curso <strong>CIBIR</strong> de la Cámara Inmobiliaria del Estado Bolívar.</p>
        <p>Para confirmar tu correo electrónico (<em>${emailOriginal}</em>) haz clic en el enlace:</p>
        <div style="text-align:center;margin:30px 0;">
          <a href="${enlaceVerificacion}" style="background-color:#16a34a;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block;">Confirmar mi correo</a>
        </div>
        <p style="font-size:14px;color:#666;">O copia y pega esto en tu navegador: ${enlaceVerificacion}</p>
        <hr style="border:none;border-top:1px solid #ddd;margin-top:30px;"/>
        <p style="font-size:12px;color:#999;">Si no fuiste tú, ignora este correo.</p>
      </div>
    `
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
  
  const { data, error } = await resend.emails.send({
    from: DEFAULT_FROM,
    to: emailOriginal,
    subject: `Invitación de ${nombreEmpresa} — Cámara Inmobiliaria`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#333;border:1px solid #f0f0f0;border-radius:16px;padding:32px;">
        <div style="text-align:center;margin-bottom:24px;">
          <div style="background-color:#ecfdf5;color:#059669;display:inline-block;padding:8px 16px;border-radius:99px;font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:0.1em;">
            Invitación Corporativa
          </div>
        </div>
        <h2 style="color:#111827;text-align:center;margin-top:0;">¡Hola, ${nombre}!</h2>
        <p style="text-align:center;color:#4b5563;font-size:16px;">
          La empresa <strong>${nombreEmpresa}</strong> te ha registrado como parte de su equipo en la <strong>Cámara Inmobiliaria del Estado Bolívar</strong>.
        </p>
        <div style="background-color:#f9fafb;border-radius:12px;padding:24px;margin:32px 0;text-align:center;">
          <p style="margin-top:0;font-weight:bold;color:#1f2937;">Para completar tu perfil y cargar tus documentos obligatorios (Cédula y Título):</p>
          <a href="${enlaceVerificacion}" style="background-color:#16a34a;color:white;padding:14px 32px;text-decoration:none;border-radius:10px;font-weight:bold;display:inline-block;margin-top:8px;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);">
            Completar mi Perfil
          </a>
          <p style="font-size:12px;color:#9ca3af;margin-top:16px;">O copia este enlace: ${enlaceVerificacion}</p>
        </div>
        <p style="font-size:14px;color:#6b7280;line-height:1.5;">
          Una vez confirmado, tu solicitud entrará en el proceso de revisión de la Cámara. Recibirás actualizaciones sobre el estatus de tu afiliación por este medio.
        </p>
        <hr style="border:none;border-top:1px solid #f3f4f6;margin:32px 0;"/>
        <p style="font-size:12px;color:#9ca3af;text-align:center;margin-bottom:0;">
          &copy; 2026 Cámara Inmobiliaria del Estado Bolívar. Todos los derechos reservados.
        </p>
      </div>
    `
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

  const { data, error } = await resend.emails.send({
    from: DEFAULT_FROM,
    to: emailOriginal,
    subject,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#333;">
        <h2 style="color:#166534;">¡Hola, ${nombre}!</h2>
        <p>Has solicitado ${accion} Cámara Inmobiliaria del Estado Bolívar.</p>
        <p>Para confirmar tu correo electrónico (<em>${emailOriginal}</em>) y continuar con el proceso, haz clic aquí:</p>
        <div style="text-align:center;margin:30px 0;">
          <a href="${enlace}" style="background-color:#16a34a;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block;">Confirmar mi solicitud</a>
        </div>
        <p style="font-size:14px;color:#666;">O copia y pega esto en tu navegador: ${enlace}</p>
        <hr style="border:none;border-top:1px solid #ddd;margin-top:30px;"/>
        <p style="font-size:12px;color:#999;">Si no fuiste tú, ignora este correo.</p>
      </div>
    `,
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
  const { data, error } = await resend.emails.send({
    from: DEFAULT_FROM,
    to: emailOriginal,
    subject: '¡Felicidades! Tu solicitud ha sido aprobada',
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#333;border:1px solid #eee;border-radius:12px;padding:24px;">
        <h1 style="color:#059669;text-align:center;">¡BIENVENIDO!</h1>
        <h2 style="color:#1f2937;">Hola, ${nombre}</h2>
        <p>Tu solicitud de afiliación a la <strong>Cámara Inmobiliaria del Estado Bolívar</strong> ha sido aprobada.</p>
        <div style="background-color:#f0fdf4;border-left:4px solid #059669;padding:16px;margin:24px 0;">
          <p style="margin:0;font-weight:bold;color:#065f46;">Próximo paso: Configura tu acceso</p>
          <p style="margin:8px 0 0;font-size:14px;color:#065f46;">Establece tu contraseña para ingresar al portal.</p>
        </div>
        <div style="text-align:center;margin:32px 0;">
          <a href="${enlaceSetup}" style="background-color:#059669;color:white;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;">Establecer mi Contraseña</a>
        </div>
        <p style="font-size:13px;color:#6b7280;text-align:center;">Este enlace tiene validez de 48 horas.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:32px 0;"/>
        <p style="font-size:12px;color:#9ca3af;text-align:center;">&copy; 2026 Cámara Inmobiliaria del Estado Bolívar</p>
      </div>
    `
  })
  if (error) { console.error('enviarCorreoAprobacion:', error); throw error }
  return data
}

/** Correo de reset de contraseña (admin) */
export const enviarCorreoResetAdmin = async (nombre: string, emailOriginal: string, token: string) => {
  const enlace = `${env.APP_URL}/establecer-contrasena?token=${token}&modo=reset`
  const { data, error } = await resend.emails.send({
    from: DEFAULT_FROM,
    to: emailOriginal,
    subject: 'Restablecimiento de contraseña — Cámara Inmobiliaria',
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#333;border:1px solid #eee;border-radius:12px;padding:24px;">
        <h2 style="color:#065f46;">Hola, ${nombre}</h2>
        <p>Un administrador ha iniciado un restablecimiento de contraseña para tu cuenta (<em>${emailOriginal}</em>).</p>
        <p>Haz clic para crear tu nueva contraseña. Enlace válido por <strong>24 horas</strong>.</p>
        <div style="text-align:center;margin:32px 0;">
          <a href="${enlace}" style="background-color:#059669;color:white;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;">
            Establecer nueva contraseña
          </a>
        </div>
        <p style="font-size:13px;color:#6b7280;">Si no esperabas este correo, ignóralo.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;"/>
        <p style="font-size:12px;color:#9ca3af;text-align:center;">&copy; 2026 Cámara Inmobiliaria del Estado Bolívar</p>
      </div>
    `,
  })
  if (error) throw new Error(`enviarCorreoResetAdmin: ${JSON.stringify(error)}`)
  return data
}

/** Olvidé mi contraseña */
export const enviarCorreoOlvideContrasena = async (emailOriginal: string, token: string) => {
  const enlace = `${env.APP_URL}/establecer-contrasena?token=${token}&modo=reset`
  const { data, error } = await resend.emails.send({
    from: DEFAULT_FROM,
    to: emailOriginal,
    subject: 'Recupera tu contraseña — Cámara Inmobiliaria',
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#333;border:1px solid #eee;border-radius:12px;padding:24px;">
        <h2 style="color:#065f46;">Recupera tu acceso</h2>
        <p>Recibimos una solicitud para restablecer la contraseña de <strong>${emailOriginal}</strong>.</p>
        <p>Haz clic en el botón para crear una nueva contraseña. Enlace válido por <strong>1 hora</strong>.</p>
        <div style="text-align:center;margin:32px 0;">
          <a href="${enlace}" style="background-color:#059669;color:white;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;">
            Restablecer mi contraseña
          </a>
        </div>
        <p style="font-size:13px;color:#6b7280;">Si no solicitaste esto, ignora el correo.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;"/>
        <p style="font-size:12px;color:#9ca3af;text-align:center;">&copy; 2026 Cámara Inmobiliaria del Estado Bolívar</p>
      </div>
    `,
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

  const { data, error } = await resend.emails.send({
    from: DEFAULT_FROM,
    to: emailEstudiante,
    subject: `Tu comprobante de aprobación digital — ${tituloFormacion}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#333;">
        <h2 style="color:#166534;">¡Felicitaciones, ${nombre}!</h2>
        <p>Tu participación en <strong>${tituloFormacion}</strong> ha sido registrada como <strong>completada</strong>.</p>
        <p>Puedes descargar o compartir el <strong>comprobante de aprobación digital</strong> desde:</p>
        <div style="text-align:center;margin:28px 0;">
          <a href="${urlComprobante}" style="background-color:#059669;color:white;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;">
            Ver comprobante y exportar PDF
          </a>
        </div>
        <div style="background:#f8fafc;border-radius:8px;padding:14px;margin:20px 0;font-size:13px;color:#334155;">
          <p style="margin:0 0 6px;"><strong>Código de validación:</strong> ${codigoValidacion}</p>
        </div>
        <hr style="border:none;border-top:1px solid #ddd;margin-top:30px;"/>
        <p style="font-size:12px;color:#999;">Cámara Inmobiliaria del Estado Bolívar</p>
      </div>
    `,
  })
  if (error) { console.error('enviarCorreoComprobanteGraduacion:', error); throw error }
  return data
}

export const enviarCorreoSetPasswordEstudiante = async (params: {
  nombre: string
  emailOriginal: string
  programaCodigo: string
  token: string
}) => {
  const { nombre, emailOriginal, programaCodigo, token } = params
  const enlaceSetup = `${env.APP_URL}/establecer-contrasena?token=${token}`
  
  const { data, error } = await resend.emails.send({
    from: DEFAULT_FROM,
    to: emailOriginal,
    subject: `Continúa tu inscripción — ${programaCodigo}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#333;border:1px solid #eee;border-radius:12px;padding:24px;">
        <h2 style="color:#059669;">¡Hola, ${nombre}!</h2>
        <p>Tu correo ha sido verificado con éxito para el programa <strong>${programaCodigo}</strong>.</p>
        
        <div style="background-color:#f0fdf4;border-left:4px solid #059669;padding:16px;margin:24px 0;">
          <p style="margin:0;font-weight:bold;color:#065f46;">Siguiente Paso: Crea tu contraseña</p>
          <p style="margin:8px 0 0;font-size:14px;color:#065f46;">Para acceder a tu panel de formación y completar tu registro, por favor establece tu contraseña:</p>
        </div>

        <div style="text-align:center;margin:32px 0;">
          <a href="${enlaceSetup}" style="background-color:#059669;color:white;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;">Establecer mi Contraseña</a>
        </div>

        <p style="font-size:13px;color:#6b7280;text-align:center;">Una vez creada, podrás entrar en el sistema. Posteriormente, un administrador se pondrá en contacto contigo para agendar tu entrevista.</p>
        
        <p style="font-size:13px;color:#6b7280;text-align:center;">Este enlace tiene validez de 48 horas.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:32px 0;"/>
        <p style="font-size:12px;color:#9ca3af;text-align:center;">&copy; 2026 Cámara Inmobiliaria del Estado Bolívar</p>
      </div>
    `
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
  
  const { data, error } = await resend.emails.send({
    from: DEFAULT_FROM,
    to: emailOriginal,
    subject: `Cita de Entrevista — ${programaCodigo}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#333;border:1px solid #eee;border-radius:12px;padding:24px;">
        <h2 style="color:#1e40af;">¡Hola, ${nombre}!</h2>
        <p>Tu solicitud para el programa <strong>${programaCodigo}</strong> ha avanzado a la fase de entrevista.</p>
        
        <div style="background-color:#f8fafc;border-left:4px solid #1e40af;padding:16px;margin:24px 0;">
          <h3 style="margin:0 0 10px;color:#1e40af;font-size:16px;">Detalles de la Cita</h3>
          <p style="margin:4px 0;"><strong>Fecha:</strong> ${entrevistaFecha}</p>
          <p style="margin:4px 0;"><strong>Hora:</strong> ${entrevistaHora}</p>
          <p style="margin:4px 0;"><strong>Lugar:</strong> ${entrevistaLugar}</p>
        </div>

        <p style="font-size:14px;color:#64748b;">Por favor, asiste puntualmente a la cita. Si no has configurado tu contraseña, puedes hacerlo usando el enlace que te enviamos anteriormente.</p>

        <hr style="border:none;border-top:1px solid #eee;margin:32px 0;"/>
        <p style="font-size:12px;color:#9ca3af;text-align:center;">&copy; 2026 Cámara Inmobiliaria del Estado Bolívar</p>
      </div>
    `
  })
  if (error) { console.error('enviarCorreoAprobacionEstudiante:', error); throw error }
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

  const { data, error } = await resend.emails.send({
    from: DEFAULT_FROM,
    to: emailOriginal,
    subject: esAprobado ? `¡Bienvenido al sistema! — ${programaCodigo}` : `Resultado de tu solicitud — ${programaCodigo}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#333;border:1px solid #eee;border-radius:12px;padding:24px;">
        <h2 style="color:${esAprobado ? '#059669' : '#dc2626'};">${esAprobado ? '¡Felicidades!' : 'Información sobre tu solicitud'}</h2>
        <p>Hola, ${nombre}. Tras la entrevista realizada, tu resultado es: <strong>${resultado === 'Parcial' ? 'Aprobado Parcial' : resultado}</strong>.</p>
        
        ${esAprobado ? `
          <div style="background-color:#f0fdf4;border-left:4px solid #059669;padding:16px;margin:24px 0;">
            <p style="margin:0;font-weight:bold;color:#065f46;">Ya tienes acceso a la intranet</p>
            <p style="margin:8px 0 0;font-size:14px;color:#065f46;">Puedes ingresar a tu panel para ver el estado de tus módulos y formación.</p>
          </div>
          <div style="text-align:center;margin:32px 0;">
            <a href="${enlacePortal}" style="background-color:#059669;color:white;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;">
              ${token ? 'Configurar Contraseña y Entrar' : 'Ir a mi Panel'}
            </a>
          </div>
        ` : `
          <p>Lamentamos informarte que tu solicitud no ha sido aprobada en esta ocasión. Te invitamos a estar atento a próximas cohortes.</p>
        `}

        <hr style="border:none;border-top:1px solid #eee;margin:32px 0;"/>
        <p style="font-size:12px;color:#9ca3af;text-align:center;">&copy; 2026 Cámara Inmobiliaria del Estado Bolívar</p>
      </div>
    `
  })
  if (error) { console.error('enviarCorreoResultadoEntrevista:', error); throw error }
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

  await resend.emails.send({
    from: DEFAULT_FROM,
    to: env.ADMIN_EMAIL,
    subject: `NUEVA SOLICITUD: Preinscripción ${programaCodigo}`,
    html: `
      <div style="font-family:sans-serif;color:#333;max-width:600px;margin:0 auto;border:1px solid #eee;padding:20px;border-radius:8px;">
        <h2 style="color:#1e40af;text-align:center;">Nueva Solicitud Recibida</h2>
        <p>Se ha registrado un nuevo interesado en el programa/curso:</p>
        <table style="width:100%;border-collapse:collapse;margin:20px 0;">
          <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold;width:120px;">ID:</td><td style="padding:8px;border:1px solid #eee;">#${idInscripcion}</td></tr>
          <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold;">Programa:</td><td style="padding:8px;border:1px solid #eee;">${programaCodigo}</td></tr>
          <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold;">Nombre:</td><td style="padding:8px;border:1px solid #eee;">${nombre}</td></tr>
          <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold;">Email:</td><td style="padding:8px;border:1px solid #eee;">${email}</td></tr>
          <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold;">Cédula/RIF:</td><td style="padding:8px;border:1px solid #eee;">${cedulaRif || 'N/A'}</td></tr>
          <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold;">Teléfono:</td><td style="padding:8px;border:1px solid #eee;">${telefono || 'N/A'}</td></tr>
        </table>
        
        <div style="text-align:center;margin:30px 0;">
          <a href="${enlaceGestion}" style="background-color:#1e40af;color:white;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;">
            Agendar Entrevista
          </a>
        </div>
        
        <p style="font-size:13px;color:#666;text-align:center;">Haz clic en el botón superior para procesar esta solicitud desde el Panel de Administración.</p>
      </div>
    `
  })
}

export const notificarAdminNuevaAfiliacion = async (params: {
  nombre: string
  email: string
  cedulaRif: string
  telefono: string
}) => {
  const { nombre, email, cedulaRif, telefono } = params
  await resend.emails.send({
    from: DEFAULT_FROM,
    to: env.ADMIN_EMAIL,
    subject: `NUEVA SOLICITUD: Afiliación (CIBIR)`,
    html: `
      <div style="font-family:sans-serif;color:#333;">
        <h2 style="color:#047857;">Nueva Solicitud de Afiliación</h2>
        <p>Un nuevo candidato ha iniciado su proceso de afiliación y verificado su correo.</p>
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold;">Nombre:</td><td style="padding:8px;border:1px solid #eee;">${nombre}</td></tr>
          <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold;">Email:</td><td style="padding:8px;border:1px solid #eee;">${email}</td></tr>
          <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold;">Cédula/RIF:</td><td style="padding:8px;border:1px solid #eee;">${cedulaRif}</td></tr>
          <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold;">Teléfono:</td><td style="padding:8px;border:1px solid #eee;">${telefono}</td></tr>
        </table>
        <p>El candidato ahora aparece como '1_PREINSCRIPCION' en la lista de CIBIR.</p>
      </div>
    `
  })
}
