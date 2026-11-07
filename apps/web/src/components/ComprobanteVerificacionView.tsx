import React from 'react'
import { Award, ShieldCheck } from 'lucide-react'

export interface ComprobanteVerificacionViewProps {
  codigo: string
  fechaEmisionIso: string
  titularNombre: string
  programaOCurso: string
  urlVerificacion: string
  vigente: boolean
}

function formatFecha(iso: string): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleDateString('es-VE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

/**
 * Diseño del comprobante (impresión / PDF vía “Guardar como PDF” del navegador).
 */
const ComprobanteVerificacionView: React.FC<ComprobanteVerificacionViewProps> = ({
  codigo,
  fechaEmisionIso,
  titularNombre,
  programaOCurso,
  urlVerificacion,
  vigente,
}) => {
  return (
    <article
      id="comprobante-digital-root"
      className="mx-auto max-w-[640px] rounded-2xl border-2 border-emerald-200/80 bg-white p-8 sm:p-10 shadow-sm print:shadow-none print:border-slate-300"
    >
      <div className="flex flex-col items-center text-center gap-2 border-b border-slate-100 pb-6">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <Award className="h-8 w-8" strokeWidth={2} />
        </div>
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
          Cámara Inmobiliaria de Venezuela
        </p>
        <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
          Comprobante de aprobación digital
        </h1>
        <div className="mt-1 flex items-center gap-2">
          {vigente ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-700">
              <ShieldCheck size={12} /> Válido
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-800">
              No vigente
            </span>
          )}
        </div>
      </div>

      <div className="mt-8 space-y-5 text-left text-sm text-slate-700">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Titular</p>
          <p className="mt-1 text-lg font-bold text-slate-900">{titularNombre}</p>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Programa o formación</p>
          <p className="mt-1 font-semibold text-slate-800">{programaOCurso}</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Código de validación</p>
            <p className="mt-1 font-mono text-base font-bold tracking-wide text-emerald-800">{codigo}</p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Fecha de emisión</p>
            <p className="mt-1 font-medium text-slate-800">{formatFecha(fechaEmisionIso)}</p>
          </div>
        </div>
        <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Verificación pública</p>
          <p className="mt-2 break-all text-xs font-medium text-emerald-700 underline-offset-2">
            {urlVerificacion}
          </p>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
            Cualquier persona puede comprobar la autenticidad de este documento visitando el enlace anterior.
          </p>
        </div>
      </div>

      <p className="mt-8 text-center text-[11px] text-slate-400">
        Documento emitido electrónicamente · No requiere firma autógrafa para verificación en línea
      </p>
    </article>
  )
}

export default ComprobanteVerificacionView
