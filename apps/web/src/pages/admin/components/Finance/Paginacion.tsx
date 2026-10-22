import React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export interface PaginacionDTO {
  pagina: number
  limite: number
  total: number
  paginas: number
}

interface Props {
  paginacion: PaginacionDTO | null
  onCambiar: (pagina: number) => void
}

const BOTON = 'inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500'

/** Pie de tabla: rango mostrado y navegación entre páginas. No se muestra si todo cabe en una página. */
const Paginacion: React.FC<Props> = ({ paginacion, onCambiar }) => {
  if (!paginacion || paginacion.paginas <= 1) return null
  const { pagina, limite, total, paginas } = paginacion
  const desde = (pagina - 1) * limite + 1
  const hasta = Math.min(pagina * limite, total)

  return (
    <nav aria-label="Paginación" className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-slate-100 bg-slate-50/50">
      <p className="text-xs text-slate-500 tabular-nums" aria-live="polite">
        Mostrando <strong className="text-slate-700">{desde}–{hasta}</strong> de <strong className="text-slate-700">{total}</strong> registros
      </p>
      <div className="flex items-center gap-2">
        <button type="button" className={BOTON} disabled={pagina <= 1} onClick={() => onCambiar(pagina - 1)}>
          <ChevronLeft size={14} aria-hidden="true" /> Anterior
        </button>
        <span className="text-xs font-bold text-slate-600 tabular-nums px-1">Página {pagina} de {paginas}</span>
        <button type="button" className={BOTON} disabled={pagina >= paginas} onClick={() => onCambiar(pagina + 1)}>
          Siguiente <ChevronRight size={14} aria-hidden="true" />
        </button>
      </div>
    </nav>
  )
}

export default Paginacion
