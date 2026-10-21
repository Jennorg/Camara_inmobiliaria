import { useEffect, useId, useRef } from 'react'
import { Download, Plus } from 'lucide-react'

export type Etapa = 'cursando' | 'completado' | 'admitido' | 'entrevista' | 'pendiente' | 'sin_expediente' | 'rechazado'

export type Cohorte = {
  id_cohorte: number
  programa_codigo: 'CIBIR' | 'PREANI' | 'PEGI' | 'PADI'
  numero: number
  nombre: string
  estado: 'Abierta' | 'Cerrada'
  inscritos: number
  etapas: Record<Etapa, number>
}

/**
 * Orden de las etapas en la barra y la leyenda. Cada tono es lo bastante oscuro para verse sobre blanco (3:1) y
 * distinto de sus vecinos; además cada etapa lleva su nombre y cifra, así que el color nunca es lo único que informa.
 */
const ETAPAS: { clave: Etapa; etiqueta: string; color: string }[] = [
  { clave: 'cursando', etiqueta: 'Cursando', color: 'bg-indigo-500' },
  { clave: 'completado', etiqueta: 'Completado', color: 'bg-emerald-600' },
  { clave: 'admitido', etiqueta: 'Admitido', color: 'bg-cyan-600' },
  { clave: 'entrevista', etiqueta: 'Entrevista', color: 'bg-purple-500' },
  { clave: 'pendiente', etiqueta: 'Pendiente', color: 'bg-amber-600' },
  { clave: 'sin_expediente', etiqueta: 'Sin expediente', color: 'bg-slate-500' },
  { clave: 'rechazado', etiqueta: 'Rechazado', color: 'bg-red-500' },
]

const FOCO = 'touch-manipulation motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700'

interface Props {
  programa: string
  cohortes: Cohorte[]
  /** Cohorte elegida; `null` = vista general, sin filtrar por cohorte */
  seleccion: number | null
  onSeleccionar: (id: number | null) => void
  onNueva: () => void
  onExportar: (cohorte: Cohorte) => void
}

/** Franja para moverse entre las cohortes de un programa y ver, de un vistazo, cuántos inscritos tiene cada una y en qué etapa están. */
export default function CohortesNavegador({ programa, cohortes, seleccion, onSeleccionar, onNueva, onExportar }: Props) {
  const activa = cohortes.find(c => c.id_cohorte === seleccion)
  const tarjetaActiva = useRef<HTMLButtonElement>(null)
  const idTitulo = useId()

  // La cohorte elegida siempre queda a la vista dentro de la franja desplazable
  useEffect(() => {
    tarjetaActiva.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [seleccion])

  return (
    <section aria-labelledby={idTitulo} className="border-b border-gray-100 bg-white px-4 pt-3 pb-3">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <h3 id={idTitulo} className="text-sm font-bold text-slate-800">
          Cohortes de {programa}
        </h3>
        <div className="flex items-center gap-2">
          {activa && (
            <button
              type="button"
              onClick={() => onExportar(activa)}
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 ${FOCO}`}
            >
              <Download size={14} aria-hidden="true" className="shrink-0" />
              <span className="max-w-[14rem] truncate">Excel de {activa.nombre}</span>
            </button>
          )}
          <button
            type="button"
            onClick={onNueva}
            className={`inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-800 transition-colors hover:bg-emerald-100 ${FOCO}`}
          >
            <Plus size={14} aria-hidden="true" />
            Nueva cohorte
          </button>
        </div>
      </div>

      <div
        role="group"
        aria-label={`Cohortes de ${programa}`}
        className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]"
      >
        <button
          type="button"
          aria-pressed={seleccion === null}
          ref={seleccion === null ? tarjetaActiva : undefined}
          onClick={() => onSeleccionar(null)}
          className={[
            'flex w-36 shrink-0 snap-start flex-col gap-1 rounded-2xl border p-3 text-left transition-colors',
            seleccion === null ? 'border-emerald-500 bg-emerald-50/60 ring-1 ring-emerald-500' : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-slate-50',
            FOCO,
          ].join(' ')}
        >
          <span className="text-sm font-bold text-slate-800">Vista general</span>
          <span className="text-xs leading-snug text-slate-500">Sin filtrar por cohorte</span>
        </button>

        {cohortes.map(c => {
          const elegida = c.id_cohorte === seleccion
          const presentes = ETAPAS.filter(e => c.etapas[e.clave] > 0)
          const resumen = presentes.map(e => `${c.etapas[e.clave]} ${e.etiqueta.toLocaleLowerCase('es')}`).join(', ') || 'sin inscritos'
          return (
            <button
              key={c.id_cohorte}
              type="button"
              aria-pressed={elegida}
              ref={elegida ? tarjetaActiva : undefined}
              onClick={() => onSeleccionar(c.id_cohorte)}
              className={[
                'flex min-w-60 max-w-sm flex-1 basis-60 snap-start flex-col rounded-2xl border p-3 text-left transition-colors',
                elegida ? 'border-emerald-500 bg-emerald-50/60 ring-1 ring-emerald-500' : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-slate-50',
                FOCO,
              ].join(' ')}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-bold text-slate-800">{c.nombre}</span>
                <span
                  className={[
                    'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold',
                    c.estado === 'Abierta' ? 'border-emerald-300 bg-emerald-100 text-emerald-800' : 'border-gray-200 bg-gray-100 text-slate-600',
                  ].join(' ')}
                >
                  {c.estado}
                </span>
              </span>

              <span className="mt-1.5 flex items-baseline gap-1.5">
                <span className="text-2xl font-extrabold leading-none tabular-nums text-slate-900">{c.inscritos}</span>
                <span className="text-xs font-medium text-slate-500">{c.inscritos === 1 ? 'inscrito' : 'inscritos'}</span>
              </span>

              <span
                role="img"
                aria-label={`${c.nombre}: ${resumen}`}
                className="mt-2.5 flex h-2 gap-0.5 overflow-hidden rounded-full bg-slate-100"
              >
                {presentes.map(e => (
                  <span key={e.clave} className={`${e.color} min-w-1`} style={{ flexGrow: c.etapas[e.clave] }} />
                ))}
              </span>

              <span className={`mt-2 grid gap-x-3 gap-y-1 text-[11px] text-slate-600 ${presentes.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`} aria-hidden="true">
                {presentes.map(e => (
                  <span key={e.clave} className="flex min-w-0 items-center gap-1.5">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${e.color}`} />
                    <span className="truncate">{e.etiqueta}</span>
                    <b className="ml-auto font-bold tabular-nums text-slate-800">{c.etapas[e.clave]}</b>
                  </span>
                ))}
              </span>
            </button>
          )
        })}

        {cohortes.length === 0 && (
          <p className="self-center px-2 text-xs text-slate-500">Este programa aún no tiene cohortes. Crea la primera con “Nueva cohorte”.</p>
        )}
      </div>
    </section>
  )
}
