import React, { useState } from 'react'
import { X, Check, Gavel, FileText, AlertTriangle, ShieldCheck } from 'lucide-react'
import { API_URL } from '@/config/env'
import { useAuth } from '@/context/AuthContext'
import { toast } from 'sonner'
import FileUpload from '@/components/common/FileUpload'
import type { TipoResolucion, DenunciaDTO } from '@/types/denuncias'

interface ModalResolucionDenunciaProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  denuncia: DenunciaDTO | null
}

const TIPOS_RESOLUCION: { id: TipoResolucion; label: string; desc: string; color: string }[] = [
  {
    id: 'conciliacion_acuerdo',
    label: 'Conciliación / Acuerdo de Partes',
    desc: 'Ambas partes llegaron a un acuerdo satisfactorio (reintegro, cumplimiento contractual, entrega de bienes).',
    color: 'emerald'
  },
  {
    id: 'amonestacion_privada',
    label: 'Amonestación Privada Escrita',
    desc: 'Llamado de atención confidencial al afiliado por falta leve a los deberes gremiales.',
    color: 'amber'
  },
  {
    id: 'amonestacion_publica',
    label: 'Amonestación Pública Gremial',
    desc: 'Censura formal con constancia en el expediente disciplinario y notificación a la Cámara.',
    color: 'orange'
  },
  {
    id: 'suspension_temporal',
    label: 'Suspensión Temporal de Membresía',
    desc: 'Inhabilitación temporal de los derechos como afiliado por falta grave.',
    color: 'rose'
  },
  {
    id: 'expulsion_definitiva',
    label: 'Expulsión Definitiva de la Cámara',
    desc: 'Revocación total del código de afiliado, credenciales CIV e inhabilitación gremial permanente.',
    color: 'red'
  },
  {
    id: 'desestimacion_sin_lugar',
    label: 'Desestimación sin Lugar (Absolución)',
    desc: 'Se determina que el afiliado no incurrió en falta o no existen elementos probatorios suficientes.',
    color: 'slate'
  }
]

export default function ModalResolucionDenuncia({
  isOpen,
  onClose,
  onSuccess,
  denuncia
}: ModalResolucionDenunciaProps) {
  const { authHeaders } = useAuth()
  const [loading, setLoading] = useState(false)

  const [tipoResolucion, setTipoResolucion] = useState<TipoResolucion>('conciliacion_acuerdo')
  const [dictamen, setDictamen] = useState('')
  const [actaUrl, setActaUrl] = useState('')

  if (!isOpen || !denuncia) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!dictamen.trim()) {
      toast.error('Debe redactar el dictamen oficial de la resolución.')
      return
    }

    try {
      setLoading(true)

      const res = await fetch(`${API_URL}/api/denuncias/admin/${denuncia.id_denuncia}/resolver`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({
          tipoResolucion,
          dictamen: dictamen.trim(),
          actaUrl: actaUrl || null
        })
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error al emitir resolución')

      toast.success('Resolución formal emitida exitosamente. El caso ha sido cerrado.')
      onSuccess()
      onClose()
    } catch (err: any) {
      toast.error(err.message || 'Error al emitir resolución')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-amber-300">
              <Gavel size={20} />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">
                Emitir Resolución Final y Cierre de Caso
              </h3>
              <p className="text-xs text-slate-300">
                Expediente: <span className="font-mono font-bold text-amber-300">{denuncia.codigo}</span> · Tribunal de Ética y Disciplina
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 text-slate-700">
          {/* Partes Resumen */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Denunciante:</span>
              <p className="font-bold text-slate-800">{denuncia.nombre_denunciante}</p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Afiliado Denunciado:</span>
              <p className="font-bold text-indigo-900">{denuncia.nombre_denunciado}</p>
            </div>
          </div>

          {/* Tipo de Resolución */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2">
              Tipo de Dictamen / Decisión Final *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {TIPOS_RESOLUCION.map(t => {
                const isSelected = tipoResolucion === t.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTipoResolucion(t.id)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-bold ${isSelected ? 'text-indigo-900' : 'text-slate-800'}`}>
                        {t.label}
                      </span>
                      {isSelected && <Check size={14} className="text-indigo-600" />}
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug">{t.desc}</p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Dictamen Oficial */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Texto Oficial del Dictamen y Fundamentación *
            </label>
            <textarea
              required
              rows={4}
              value={dictamen}
              onChange={e => setDictamen(e.target.value)}
              placeholder="Describa los acuerdos alcanzados o las medidas disciplinarias impuestas, detallando plazos de cumplimiento y fundamentos estatutarios..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
            />
          </div>

          {/* Adjuntar Acta Oficial Firmada */}
          <div>
            <FileUpload
              label="Acta de Resolución Firmada (PDF)"
              onUploadSuccess={(url) => setActaUrl(url)}
              onClear={() => setActaUrl('')}
              accept="application/pdf"
              folder="denuncias"
            />
            {actaUrl && (
              <p className="text-xs text-emerald-600 font-medium mt-1">
                ✓ Acta de resolución digital cargada correctamente
              </p>
            )}
          </div>

          {/* Advertencia de Cierre */}
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-800">
            <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <p>
              Al emitir la resolución, el caso pasará a estatus <strong>{tipoResolucion === 'desestimacion_sin_lugar' ? 'Desestimada' : 'Resuelta'}</strong>, quedando registrado formalmente en el historial del expediente. Ambas partes podrán consultar el dictamen emitido.
            </p>
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-900 hover:bg-indigo-950 shadow-md shadow-indigo-950/20 active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading ? (
                <span>Emitiendo...</span>
              ) : (
                <>
                  <Gavel size={16} />
                  <span>Emitir Veredicto y Cerrar Caso</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
