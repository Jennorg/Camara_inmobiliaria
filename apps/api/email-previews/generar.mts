// Genera una vista previa HTML de cada correo del sistema en esta carpeta (NO envía nada).
//   pnpm --filter api emails:preview      (o: npx tsx email-previews/generar.mts)
// Abre email-previews/index.html en el navegador. Para pedir un cambio, indica el ID del correo (E01, E02…).
process.env.NODE_ENV = 'production'
process.env.RESEND_API_KEY ||= 're_solo_vista_previa'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = dirname(fileURLToPath(import.meta.url))
const DESTINO = 'destinatario@ejemplo.com'
let actual = { id: '', caso: '' }
const vistas: { id: string; caso: string; asunto: string }[] = []

// Se intercepta Resend: el correo se guarda como archivo y nunca sale a la red.
globalThis.fetch = (async (url: any, init: any) => {
  if (!String(url).includes('api.resend.com/emails')) throw new Error('Solo se esperaban llamadas a Resend')
  const m = ([] as any[]).concat(JSON.parse(init.body))[0]
  if (!vistas.some(v => v.id === actual.id)) {
    // El logo real vive en Backblaze; para la vista previa se usa la copia local
    const html = String(m.html).replace(/src="https?:[^"]*\/email\/(\w+)\.png"/g, 'src="assets/$1.png"').replace(/src="https?:[^"]*\/public-docs\/Logo\.png"/g, 'src="assets/logo.png"')
    writeFileSync(join(DIR, `${actual.id}.html`), html)
    vistas.push({ id: actual.id, caso: actual.caso, asunto: m.subject })
  }
  return new Response(JSON.stringify({ id: 'vista-previa', data: [{ id: 'x' }] }), { status: 200, headers: { 'content-type': 'application/json' } })
}) as typeof fetch

const E = await import('../src/lib/email.js')
const { textoAviso } = await import('../src/services/cobranza.service.js')
const { CONFIG_COBRANZA_DEFECTO } = await import('../src/lib/solvencia.js')

const N = 'María Pérez', EMP = 'Inversiones Orinoco C.A.', TOK = 'TOKEN-DE-EJEMPLO-NO-VALIDO'
const aviso = (tipo: any, deuda: number, bloqueado = false) => {
  const s: any = { id_afiliado: 1, meses: [], mesesDeuda: deuda, montoUsd: deuda * 10, mesMasAntiguo: '2026-09', mesesSinVerificar: deuda, bloqueado }
  const { titulo, intro, detalle, nota } = textoAviso(tipo, s, CONFIG_COBRANZA_DEFECTO, 10, '2026-11')
  return E.enviarCorreosLote([{ to: DESTINO, subject: titulo, titulo, parrafos: [`Hola, ${N}.`, intro], detalle, nota }])
}

const casos: [string, string, () => Promise<unknown>][] = [
  ['E01', 'Verificación de correo (registro de afiliación)', () => E.enviarCorreoVerificacion(N, DESTINO, TOK)],
  ['E02', 'Invitación corporativa a un agente', () => E.enviarCorreoInvitacionCorporativa({ nombre: N, emailOriginal: DESTINO, nombreEmpresa: EMP, token: TOK })],
  ['E03', 'Confirmación de preinscripción a un programa', () => E.enviarCorreoConfirmacionPreinscripcionPrograma({ nombre: N, emailOriginal: DESTINO, programaCodigo: 'PEGI', token: TOK })],
  ['E04', 'Afiliado oficial, con enlace de contraseña', () => E.enviarCorreoAprobacion(N, DESTINO, TOK)],
  ['E05', 'Restablecimiento de contraseña por un administrador', () => E.enviarCorreoResetAdmin(N, DESTINO, TOK)],
  ['E06', 'Olvidé mi contraseña', () => E.enviarCorreoOlvideContrasena(DESTINO, TOK)],
  ['E07', 'Comprobante de graduación', () => E.enviarCorreoComprobanteGraduacion({ nombre: N, emailEstudiante: DESTINO, tituloFormacion: 'Curso Introductorio de Bienes Raíces (CIBIR)', codigoValidacion: 'CIV-EJEMPLO123' })],
  ['E08', 'Inscripción confirmada a curso, con enlace de contraseña', () => E.enviarCorreoSetPasswordEstudiante({ nombre: N, emailOriginal: DESTINO, programaCodigo: 'Sucesiones en el ámbito inmobiliario', token: TOK })],
  ['E09', 'Inscripción confirmada a curso, usuario que ya tiene cuenta', () => E.enviarCorreoSetPasswordEstudiante({ nombre: N, emailOriginal: DESTINO, programaCodigo: 'Sucesiones en el ámbito inmobiliario' })],
  ['E10', 'Cita de entrevista agendada', () => E.enviarCorreoAprobacionEstudiante({ nombre: N, emailOriginal: DESTINO, programaCodigo: 'AFILIACION', entrevistaFecha: '2026-11-20', entrevistaHora: '10:00', entrevistaLugar: 'Sede de la Cámara, Ciudad Bolívar' })],
  ['E11', 'Enlace para elegir el horario de la entrevista', () => E.enviarCorreoEnlaceAgenda({ nombre: N, email: DESTINO, url: 'https://www.camarainmobiliariadebolivar.com/agendar/EJEMPLO' })],
  ['E12', 'Participación en el CIBIR confirmada (pago registrado)', () => E.enviarCorreoInvitacionCibir({ nombre: N, emailOriginal: DESTINO })],
  ['E13', 'Resultado de entrevista (programas, no afiliación): Aprobado, con enlace', () => E.enviarCorreoResultadoEntrevista({ nombre: N, emailOriginal: DESTINO, resultado: 'Aprobado', programaCodigo: 'PEGI', token: TOK })],
  ['E14', 'Resultado de entrevista (programas, no afiliación): Aprobado, usuario con cuenta', () => E.enviarCorreoResultadoEntrevista({ nombre: N, emailOriginal: DESTINO, resultado: 'Aprobado', programaCodigo: 'PEGI' })],
  ['E16', 'Solicitud no aprobada (tono sutil, sin rojo)', () => E.enviarCorreoResultadoEntrevista({ nombre: N, emailOriginal: DESTINO, resultado: 'Rechazado', programaCodigo: 'AFILIACION' })],
  ['E17', 'Avance de etapa en programas que no son afiliación, con enlace', () => E.enviarCorreoResultadoEntrevista({ nombre: N, emailOriginal: DESTINO, resultado: 'Aprobado', programaCodigo: 'PEGI', token: TOK, sinEntrevista: true })],
  ['E18', 'CIBIR aprobado: establecer contraseña', () => E.enviarCorreoAccesoCibirAprobado(N, DESTINO, TOK)],
  ['E19', 'Rechazo de solicitud, con motivo', () => E.enviarCorreoRechazo({ nombre: N, emailOriginal: DESTINO, programaCodigo: 'AFILIACION', motivo: 'La documentación presentada está incompleta.' })],
  ['E20', 'Rechazo de solicitud, sin motivo', () => E.enviarCorreoRechazo({ nombre: N, emailOriginal: DESTINO, programaCodigo: 'AFILIACION', motivo: null })],
  ['E21', 'Acceso al nuevo portal (onboarding masivo)', () => E.enviarCorreoOnboardingMasivo(N, DESTINO, TOK)],
  ['E23', 'Vinculación como Agente Corporativo', () => E.enviarCorreoVinculacionCorporativa({ nombre: N, emailOriginal: DESTINO, nombreEmpresa: EMP })],
  ['E24', 'Cobranza: recordatorio previo al vencimiento', () => aviso('previo', 0)],
  ['E25', 'Cobranza: la mensualidad vence hoy', () => aviso('vencimiento', 0)],
  ['E26', 'Cobranza: mora desde el 2.º mes, sin bloqueo', () => aviso('mora', 2)],
  ['E28', 'Cobranza: recordatorio manual de Finanzas', () => aviso('manual', 2)],
  ['E29', 'Reserva de curso vencida sin pago', () => E.enviarCorreosLote([{ to: DESTINO, subject: 'Tu reserva en "Sucesiones en el ámbito inmobiliario" venció', titulo: 'Reserva vencida', parrafos: [`Hola, ${N}.`, 'La reserva de tu cupo en "Sucesiones en el ámbito inmobiliario" venció sin un pago registrado, así que el cupo quedó liberado.', 'Si aún te interesa, puedes volver a preinscribirte mientras queden cupos disponibles.'] }])],
  ['E30', 'Cupo reservado en curso de pago (afiliado)', () => E.enviarCorreoReservaCurso({ nombre: N, email: DESTINO, curso: 'Sucesiones en el ámbito inmobiliario', montoUsd: 25, venceEn: '2026-11-15T20:00:00Z', esAfiliado: true })],
  ['E31', 'Cupo reservado en curso de pago (no afiliado)', () => E.enviarCorreoReservaCurso({ nombre: N, email: DESTINO, curso: 'Sucesiones en el ámbito inmobiliario', montoUsd: 40, venceEn: '2026-11-15T20:00:00Z', esAfiliado: false })],
  ['E32', 'Mediación de denuncia: denunciante', () => E.enviarCorreoMediacionDenuncia({ nombre: N, emailOriginal: DESTINO, rol: 'denunciante', codigoDenuncia: 'DEN-2026-001', fechaTexto: 'jueves 20 de noviembre de 2026, 10:00 a. m.', lugar: 'Sede de la Cámara, Ciudad Bolívar', notas: 'Traer documentos originales.' })],
  ['E33', 'Mediación de denuncia: denunciado', () => E.enviarCorreoMediacionDenuncia({ nombre: N, emailOriginal: DESTINO, rol: 'denunciado', codigoDenuncia: 'DEN-2026-001', fechaTexto: 'jueves 20 de noviembre de 2026, 10:00 a. m.', lugar: 'Sede de la Cámara, Ciudad Bolívar' })],
  ['E34', 'Mediación de denuncia: audiencia reprogramada', () => E.enviarCorreoMediacionDenuncia({ nombre: N, emailOriginal: DESTINO, rol: 'denunciante', codigoDenuncia: 'DEN-2026-001', fechaTexto: 'viernes 28 de noviembre de 2026, 2:00 p. m.', lugar: 'Sede de la Cámara, Ciudad Bolívar', reprogramada: true })],
  ['E39', 'Afiliado oficial, usuario que ya tiene cuenta', () => E.enviarCorreoAprobacion(N, DESTINO)],
  ['E35', 'Inscripción confirmada en PEGI, con enlace de contraseña', () => E.enviarCorreoSetPasswordEstudiante({ nombre: N, emailOriginal: DESTINO, programaCodigo: 'PEGI', token: TOK })],
  ['E36', 'Inscripción confirmada en PADI, usuario con cuenta', () => E.enviarCorreoSetPasswordEstudiante({ nombre: N, emailOriginal: DESTINO, programaCodigo: 'PADI' })],
  ['E37', 'Inscripción confirmada en PREANI, con enlace de contraseña', () => E.enviarCorreoSetPasswordEstudiante({ nombre: N, emailOriginal: DESTINO, programaCodigo: 'PREANI', token: TOK })],
  ['E38', 'Inscripción confirmada en CIBIR, con enlace de contraseña', () => E.enviarCorreoSetPasswordEstudiante({ nombre: N, emailOriginal: DESTINO, programaCodigo: 'CIBIR', token: TOK })],
]

mkdirSync(DIR, { recursive: true })
for (const [id, caso, fn] of casos) {
  actual = { id, caso }
  await fn()
}

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;')
const items = vistas.map(v => `<button data-f="${v.id}.html"><b>${v.id}</b> ${esc(v.caso)}<small>${esc(v.asunto)}</small></button>`).join('\n')
writeFileSync(join(DIR, 'index.html'), `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Vista previa de correos</title>
<style>
  *{box-sizing:border-box}body{margin:0;font:14px/1.4 system-ui,sans-serif;color:#1e293b;display:grid;grid-template-columns:340px 1fr;height:100vh}
  nav{overflow:auto;border-right:1px solid #e2e8f0;background:#f8fafc}nav h1{font-size:15px;margin:0;padding:16px;position:sticky;top:0;background:#f8fafc;border-bottom:1px solid #e2e8f0}
  nav button{display:block;width:100%;text-align:left;border:0;border-bottom:1px solid #e2e8f0;background:none;padding:10px 16px;cursor:pointer;font:inherit;color:inherit}
  nav button:hover,nav button.on{background:#ecfdf5}nav b{color:#047857;margin-right:6px}nav small{display:block;color:#64748b;margin-top:2px;font-size:12px}
  main{display:flex;flex-direction:column;min-width:0}header{padding:10px 16px;border-bottom:1px solid #e2e8f0;display:flex;gap:8px;align-items:center}
  header button{border:1px solid #cbd5e1;background:#fff;border-radius:8px;padding:6px 12px;cursor:pointer;font:inherit}header button.on{background:#059669;border-color:#059669;color:#fff}
  .lienzo{flex:1;background:#e2e8f0;display:flex;justify-content:center;overflow:auto}iframe{border:0;background:#fff;width:100%;height:100%}.movil iframe{width:390px}
  :focus-visible{outline:2px solid #059669;outline-offset:2px}
</style></head><body>
<nav><h1>Correos del sistema (${vistas.length})</h1>
${items}</nav>
<main><header><span id="titulo">Elige un correo</span><span style="flex:1"></span><button id="pc" class="on">Escritorio</button><button id="mv">Móvil</button></header>
<div class="lienzo" id="lienzo"><iframe id="v" title="Vista previa"></iframe></div></main>
<script>
  const v=document.getElementById('v'),l=document.getElementById('lienzo');
  const abrir=b=>{document.querySelectorAll('nav button').forEach(x=>x.classList.toggle('on',x===b));v.src=b.dataset.f;document.getElementById('titulo').textContent=b.querySelector('b').textContent+' · '+b.dataset.f;location.hash=b.dataset.f};
  document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>abrir(b));
  const modo=m=>{l.classList.toggle('movil',m);pc.classList.toggle('on',!m);mv.classList.toggle('on',m)};pc.onclick=()=>modo(false);mv.onclick=()=>modo(true);
  abrir(document.querySelector('nav button[data-f="'+location.hash.slice(1)+'"]')||document.querySelector('nav button'));
</script></body></html>`)
console.log(`${vistas.length} vistas previas en ${DIR}`)
process.exit(0)
