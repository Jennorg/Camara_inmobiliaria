import React, { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { API_URL } from '@/config/env'
import { useAuth } from '@/context/AuthContext'
import { toast } from 'sonner'
import type { DenunciaDTO } from '@/types/denuncias'

interface ModalConvocarMediacionProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  denuncia: DenunciaDTO | null
}

export default function ModalConvocarMediacion({
  isOpen,
  onClose,
  onSuccess,
  denuncia
}: ModalConvocarMediacionProps) {
  const { authHeaders } = useAuth()
  const [loading, setLoading] = useState(false)

  const [fechaAudiencia, setFechaAudiencia] = useState('')
  const [lugarModalidad, setLugarModalidad] = useState('Sede Cámara Inmobiliaria de Bolívar (Sala de Juntas)')
  const [notas, setNotas] = useState('')

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

    if (!fechaAudiencia) {
      toast.error('Indica la fecha y la hora de la audiencia.')
      return
    }
    if (!lugarModalidad.trim()) {
      toast.error('Indica el lugar o el enlace de la reunión.')
      return
    }

    try {
      setLoading(true)

      const res = await fetch(`${API_URL}/api/denuncias/admin/${denuncia.id_denuncia}/mediacion`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({
          fechaAudiencia,
          lugarModalidad: lugarModalidad.trim(),
          notas: notas.trim() || undefined
        })
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error al convocar mediación')

      const correos = json.data?.correos as { denunciante: boolean; denunciado: boolean } | undefined
      const sinCorreo = [!correos?.denunciante && 'al denunciante', !correos?.denunciado && 'al afiliado denunciado'].filter(Boolean)
      if (correos && sinCorreo.length) {
        toast.warning(`Audiencia registrada, pero no se pudo enviar el correo ${sinCorreo.join(' ni ')}. Avísale por otra vía.`)
      } else {
        toast.success('Audiencia convocada. Se envió un correo a ambas partes.')
      }
      setFechaAudiencia('')
      setNotas('')
      onSuccess()
      onClose()
    } catch (err: any) {
      toast.error(err.message || 'Error al convocar la mediación')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 sm:p-6"
      onMouseDown={e => { if (e.target === e.currentTarget && !loading) onClose() }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-mediacion"
        className="flex max-h-[94vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl bg-white shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div>
            <h3 id="titulo-mediacion" className="text-lg font-bold text-slate-900">Convocar mediación</h3>
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
          <div className="space-y-5 overflow-y-auto overscroll-contain px-6 py-5">
            <p className="text-sm text-slate-600">
              Audiencia entre <strong className="text-slate-900">{denuncia.nombre_denunciante}</strong> (denunciante) y{' '}
              <strong className="text-slate-900">{denuncia.nombre_denunciado}</strong> (afiliado denunciado). Queda anotada en el expediente y
              a ambas partes se les envía un correo con la fecha y el lugar (al denunciado no se le dice quién denunció).
            </p>

            <div>
              <label htmlFor="fecha-audiencia" className="text-sm font-semibold text-slate-900">Fecha y hora *</label>
              <input
                id="fecha-audiencia"
                name="fecha_audiencia"
                type="datetime-local"
                required
                value={fechaAudiencia}
                onChange={e => setFechaAudiencia(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
              />
            </div>

            <div>
              <label htmlFor="lugar-audiencia" className="text-sm font-semibold text-slate-900">Lugar o enlace de la videollamada *</label>
              <input
                id="lugar-audiencia"
                name="lugar_audiencia"
                type="text"
                required
                autoComplete="off"
                value={lugarModalidad}
                onChange={e => setLugarModalidad(e.target.value)}
                placeholder="Ej. Sala de Juntas de la Cámara, o enlace de Zoom…"
                className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
              />
            </div>

            <div>
              <label htmlFor="notas-audiencia" className="text-sm font-semibold text-slate-900">Qué deben llevar las partes <span className="font-normal text-slate-500">(opcional)</span></label>
              <textarea
                id="notas-audiencia"
                name="notas_audiencia"
                rows={3}
                value={notas}
                onChange={e => setNotas(e.target.value)}
                placeholder="Ej. El contrato de corretaje original y los comprobantes de pago…"
                className="mt-1.5 w-full resize-y rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
              />
            </div>
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
              {loading ? 'Guardando…' : 'Convocar mediación'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
