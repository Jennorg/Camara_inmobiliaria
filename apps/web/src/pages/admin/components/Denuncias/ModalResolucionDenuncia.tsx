import React, { useEffect, useState } from 'react'
import { X } from 'lucide-react'
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

const TIPOS_RESOLUCION: { id: TipoResolucion; label: string; desc: string }[] = [
  { id: 'conciliacion_acuerdo', label: 'Acuerdo entre las partes', desc: 'Llegaron a un arreglo: reintegro, cumplimiento del contrato o entrega de lo pactado.' },
  { id: 'amonestacion_privada', label: 'Amonestación privada', desc: 'Llamado de atención por escrito, confidencial, para una falta leve.' },
  { id: 'amonestacion_publica', label: 'Amonestación pública', desc: 'Censura formal que queda en el expediente disciplinario y se notifica a la Cámara.' },
  { id: 'suspension_temporal', label: 'Suspensión temporal', desc: 'El afiliado pierde sus derechos por un tiempo, por una falta grave.' },
  { id: 'expulsion_definitiva', label: 'Expulsión definitiva', desc: 'Se revoca el código de afiliado y las credenciales, de forma permanente.' },
  { id: 'desestimacion_sin_lugar', label: 'Desestimar la denuncia', desc: 'No hubo falta o no hay pruebas suficientes. El afiliado queda absuelto.' },
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

  useEffect(() => {
    if (!isOpen) return
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape' && !loading) onClose() }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [isOpen, loading, onClose])

  if (!isOpen || !denuncia) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return

    if (!dictamen.trim()) {
      toast.error('Escribe el dictamen de la resolución.')
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

      toast.success('Resolución emitida. El caso quedó cerrado.')
      setDictamen('')
      setActaUrl('')
      setTipoResolucion('conciliacion_acuerdo')
      onSuccess()
      onClose()
    } catch (err: any) {
      toast.error(err.message || 'Error al emitir resolución')
    } finally {
      setLoading(false)
    }
  }

  const estatusFinal = tipoResolucion === 'desestimacion_sin_lugar' ? 'desestimada' : 'resuelta'

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 sm:p-6"
      onMouseDown={e => { if (e.target === e.currentTarget && !loading) onClose() }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-resolucion"
        className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl bg-white shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div>
            <h3 id="titulo-resolucion" className="text-lg font-bold text-slate-900">Emitir resolución</h3>
            <p className="mt-0.5 text-sm text-slate-600">
              Expediente <span className="font-mono font-semibold text-slate-800">{denuncia.codigo}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label="Cerrar"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="space-y-6 overflow-y-auto overscroll-contain px-6 py-5">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">Denunciante</dt>
                <dd className="font-semibold text-slate-900">{denuncia.nombre_denunciante}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Afiliado denunciado</dt>
                <dd className="font-semibold text-slate-900">{denuncia.nombre_denunciado}</dd>
              </div>
            </dl>

            <fieldset>
              <legend className="text-sm font-semibold text-slate-900">¿Cómo se resuelve el caso?</legend>
              <div className="mt-2 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-300">
                {TIPOS_RESOLUCION.map(t => {
                  const elegido = tipoResolucion === t.id
                  return (
                    <label
                      key={t.id}
                      className={`flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors ${elegido ? 'bg-slate-100' : 'bg-white hover:bg-slate-50'}`}
                    >
                      <input
                        type="radio"
                        name="tipo_resolucion"
                        value={t.id}
                        checked={elegido}
                        onChange={() => setTipoResolucion(t.id)}
                        className="mt-1 h-4 w-4 shrink-0 accent-emerald-600"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-slate-900">{t.label}</span>
                        <span className="block text-sm text-slate-600">{t.desc}</span>
                      </span>
                    </label>
                  )
                })}
              </div>
            </fieldset>

            <div>
              <label htmlFor="dictamen" className="text-sm font-semibold text-slate-900">Dictamen</label>
              <p className="text-sm text-slate-600">Explica qué se decidió y por qué. Si hay acuerdo o sanción, indica los plazos para cumplirla.</p>
              <textarea
                id="dictamen"
                name="dictamen"
                required
                rows={5}
                value={dictamen}
                onChange={e => setDictamen(e.target.value)}
                className="mt-2 w-full resize-y rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
              />
            </div>

            <div>
              <FileUpload
                label="Acta firmada (PDF, opcional)"
                onUploadSuccess={(url) => setActaUrl(url)}
                onClear={() => setActaUrl('')}
                accept="application/pdf"
                folder="denuncias"
              />
            </div>

            <p className="text-sm text-slate-600">
              Al emitirla, el caso pasa a <strong className="text-slate-900">{estatusFinal}</strong> y queda registrado en el historial. Las partes podrán consultar el dictamen.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Emitiendo…' : 'Emitir resolución'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
