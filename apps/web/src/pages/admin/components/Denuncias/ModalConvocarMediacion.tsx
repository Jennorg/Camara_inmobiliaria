import React, { useState } from 'react'
import { X, Calendar, MapPin, Users, Check, Clock } from 'lucide-react'
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

  if (!isOpen || !denuncia) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!fechaAudiencia) {
      toast.error('Debe seleccionar la fecha y hora de la audiencia de mediación.')
      return
    }
    if (!lugarModalidad.trim()) {
      toast.error('Debe especificar el lugar o enlace de la reunión.')
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

      toast.success('Audiencia de mediación convocada exitosamente.')
      onSuccess()
      onClose()
    } catch (err: any) {
      toast.error(err.message || 'Error al agendar mediación')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-900 to-indigo-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-blue-200">
              <Users size={20} />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">
                Convocar a Audiencia de Mediación
              </h3>
              <p className="text-xs text-blue-200/80">
                Expediente: <span className="font-mono font-bold text-white">{denuncia.codigo}</span>
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-slate-700">
          <div className="p-3 rounded-xl bg-blue-50/50 border border-blue-100 text-xs text-blue-900">
            Esta convocatoria notificará formalmente al denunciante (<strong>{denuncia.nombre_denunciante}</strong>) y al afiliado denunciado (<strong>{denuncia.nombre_denunciado}</strong>) para una sesión de conciliación gremial.
          </div>

          {/* Fecha y Hora */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Fecha y Hora de la Audiencia *
            </label>
            <div className="relative">
              <input
                type="datetime-local"
                required
                value={fechaAudiencia}
                onChange={e => setFechaAudiencia(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-medium"
              />
            </div>
          </div>

          {/* Lugar o Modalidad */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Lugar / Modalidad / Enlace de Videollamada *
            </label>
            <input
              type="text"
              required
              value={lugarModalidad}
              onChange={e => setLugarModalidad(e.target.value)}
              placeholder="Ej. Sede Cámara Inmobiliaria de Bolívar (Sala de Juntas) o Enlace Zoom"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          {/* Instrucciones / Notas */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Instrucciones y Requerimientos a las Partes
            </label>
            <textarea
              rows={3}
              value={notas}
              onChange={e => setNotas(e.target.value)}
              placeholder="Ej. Consignar originales del contrato de corretaje y comprobantes de transferencias bancarias..."
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
            />
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/20 active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading ? (
                <span>Agendando...</span>
              ) : (
                <>
                  <Check size={16} />
                  <span>Agendar y Notificar Audiencia</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
