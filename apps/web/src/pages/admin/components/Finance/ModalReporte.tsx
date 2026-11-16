import Modal from '@/components/ui/Modal'
import React from 'react'
import { X } from 'lucide-react'

interface Props {
  open: boolean
  titulo: string
  subtitulo: string
  icono: React.ReactNode
  onClose: () => void
  children: React.ReactNode
}

/** Ventana para reportes anchos (matrices por mes): se cierra con la X, con Escape (lo da el <dialog>) o haciendo clic fuera. */
const ModalReporte: React.FC<Props> = ({ open, titulo, subtitulo, icono, onClose, children }) => {

  if (!open) return null

  return (
    <Modal onClose={onClose} aria-labelledby="titulo-modal-reporte"
      className="flex items-center justify-center p-4 sm:p-6 bg-[#022c22]/60 backdrop-blur-sm overflow-y-auto cms-fade-up motion-reduce:animate-none"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="relative bg-white w-full max-w-6xl mx-auto rounded-[2rem] shadow-2xl overflow-hidden flex flex-col my-auto border border-emerald-100">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 rounded-2xl bg-emerald-600 text-white">{icono}</span>
            <div>
              <h3 id="titulo-modal-reporte" className="text-base font-black text-slate-900 uppercase tracking-tight">{titulo}</h3>
              <p className="text-xs font-bold text-slate-500">{subtitulo}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Cerrar"
            className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
        <div className="p-6 max-h-[75vh] overflow-y-auto">{children}</div>
      </div>
    </Modal>
  )
}

export default ModalReporte
