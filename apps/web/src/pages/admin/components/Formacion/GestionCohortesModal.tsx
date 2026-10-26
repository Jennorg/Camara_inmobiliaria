import { Lock, LockOpen, Plus, X } from 'lucide-react'
import type { Cohorte } from './CohortesNavegador'

interface Props {
  programa: string
  cohortes: Cohorte[]
  onCerrar: () => void
  onNueva: () => void
  onCambiarEstado: (cohorte: Cohorte) => void
}

/** Lista las cohortes del programa para cerrarlas o reabrirlas, y permite crear la siguiente. */
export default function GestionCohortesModal({ programa, cohortes, onCerrar, onNueva, onCambiarEstado }: Props) {
  const ordenadas = [...cohortes].sort((a, b) => b.numero - a.numero)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Gestionar cohortes de ${programa}`}
        className="flex max-h-[85vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h3 className="text-sm font-bold text-slate-800">Cohortes de {programa}</h3>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="rounded-lg p-1 text-slate-500 hover:bg-slate-100">
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <ul className="min-h-0 flex-1 divide-y divide-gray-100 overflow-y-auto">
          {ordenadas.map(c => {
            const abierta = c.estado === 'Abierta'
            return (
              <li key={c.id_cohorte} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-800">{c.nombre}</p>
                  <p className="text-[11px] text-slate-500">
                    <span className={abierta ? 'font-bold text-emerald-700' : ''}>{c.estado}</span> · {c.inscritos} {c.inscritos === 1 ? 'inscrito' : 'inscritos'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onCambiarEstado(c)}
                  className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50"
                >
                  {abierta ? <Lock size={14} aria-hidden="true" /> : <LockOpen size={14} aria-hidden="true" />}
                  {abierta ? 'Cerrar' : 'Reabrir'}
                </button>
              </li>
            )
          })}
          {ordenadas.length === 0 && <li className="px-4 py-6 text-center text-xs text-slate-500">Este programa aún no tiene cohortes.</li>}
        </ul>

        <div className="border-t border-gray-100 p-3">
          <button
            type="button"
            onClick={onNueva}
            className="inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-800 transition-colors hover:bg-emerald-100"
          >
            <Plus size={14} aria-hidden="true" />
            Nueva cohorte
          </button>
        </div>
      </div>
    </div>
  )
}
