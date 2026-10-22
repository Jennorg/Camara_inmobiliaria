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
    // En pantallas chicas las acciones van arriba de las tarjetas; desde `sm`, al costado
    <section aria-labelledby={idTitulo} className="flex flex-col-reverse gap-2 border-b border-gray-100 bg-white px-4 py-2.5 sm:flex-row sm:items-start sm:gap-3">
      <h3 id={idTitulo} className="sr-only">
        Cohortes de {programa}
      </h3>

      <div
        role="group"
        aria-label={`Cohortes de ${programa}`}
        className="-mx-1 flex min-w-0 flex-1 snap-x gap-2.5 overflow-x-auto px-1 pb-1.5 [scrollbar-width:thin]"
      >
        <button
          type="button"
          aria-pressed={seleccion === null}
          ref={seleccion === null ? tarjetaActiva : undefined}
          onClick={() => onSeleccionar(null)}
          className={[
            'flex w-28 shrink-0 snap-start flex-col gap-0.5 rounded-xl border p-2.5 text-left transition-colors',
            seleccion === null ? 'border-emerald-500 bg-emerald-50/60 ring-1 ring-emerald-500' : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-slate-50',
            FOCO,
          ].join(' ')}
        >
          <span className="text-sm font-bold text-slate-800">Vista general</span>
          <span className="text-[11px] leading-snug text-slate-500">Todo {programa}, sin filtrar</span>
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
                'flex w-[15.5rem] shrink-0 snap-start flex-col rounded-xl border p-2.5 text-left transition-colors',
                elegida ? 'border-emerald-500 bg-emerald-50/60 ring-1 ring-emerald-500' : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-slate-50',
                FOCO,
              ].join(' ')}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-bold text-slate-800">{c.nombre}</span>
                <span
                  className={[
                    'shrink-0 rounded-full border px-1.5 py-px text-[10px] font-bold',
                    c.estado === 'Abierta' ? 'border-emerald-300 bg-emerald-100 text-emerald-800' : 'border-gray-200 bg-gray-100 text-slate-600',
                  ].join(' ')}
                >
                  {c.estado}
                </span>
              </span>

              <span className="mt-1 flex items-baseline gap-1.5">
                <span className="text-xl font-extrabold leading-none tabular-nums text-slate-900">{c.inscritos}</span>
                <span className="text-xs font-medium text-slate-500">{c.inscritos === 1 ? 'inscrito' : 'inscritos'}</span>
              </span>

              <span
                role="img"
                aria-label={`${c.nombre}: ${resumen}`}
                className="mt-2 flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-slate-100"
              >
                {presentes.map(e => (
                  <span key={e.clave} className={`${e.color} min-w-1`} style={{ flexGrow: c.etapas[e.clave] }} />
                ))}
              </span>

              <span className={`mt-1.5 grid gap-x-2 gap-y-0.5 text-[11px] text-slate-600 ${presentes.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`} aria-hidden="true">
                {presentes.map(e => (
                  <span key={e.clave} className="flex min-w-0 items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${e.color}`} />
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

      <div className="flex shrink-0 gap-2 sm:w-40 sm:flex-col sm:gap-1.5">
        {activa && (
          <button
            type="button"
            onClick={() => onExportar(activa)}
            className={`inline-flex min-h-9 min-w-0 items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 sm:w-full ${FOCO}`}
          >
            <Download size={14} aria-hidden="true" className="shrink-0" />
            <span className="truncate">Excel de {activa.nombre}</span>
          </button>
        )}
        <button
          type="button"
          onClick={onNueva}
          className={`inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-800 transition-colors hover:bg-emerald-100 sm:w-full ${FOCO}`}
        >
          <Plus size={14} aria-hidden="true" className="shrink-0" />
          Nueva cohorte
        </button>
      </div>
    </section>
  )
}

/**
 * Acceso a las cohortes cuando aún no hay un programa elegido (vista "Todos"): resume cada programa y lo abre con un clic,
 * para que la franja de cohortes se descubra desde la primera pantalla.
 */
export function CohortesPorPrograma({ cohortes, onElegir }: { cohortes: Cohorte[]; onElegir: (programa: Cohorte['programa_codigo']) => void }) {
  const idTitulo = useId()
  const programas: Cohorte['programa_codigo'][] = ['CIBIR', 'PREANI', 'PEGI', 'PADI']
  return (
    <section aria-labelledby={idTitulo} className="border-b border-gray-100 bg-white px-4 py-3">
      <h3 id={idTitulo} className="mb-2 text-sm font-bold text-slate-800">
        Cohortes por programa
      </h3>
      <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:thin]">
        {programas.map(programa => {
          const delPrograma = cohortes.filter(c => c.programa_codigo === programa)
          const inscritos = delPrograma.reduce((suma, c) => suma + c.inscritos, 0)
          const abierta = delPrograma.find(c => c.estado === 'Abierta')
          return (
            <button
              key={programa}
              type="button"
              onClick={() => onElegir(programa)}
              className={`flex min-w-44 flex-1 basis-44 flex-col gap-0.5 rounded-2xl border border-gray-200 bg-white p-3 text-left transition-colors hover:border-gray-300 hover:bg-slate-50 ${FOCO}`}
            >
              <span className="text-sm font-bold text-slate-800">{programa}</span>
              <span className="text-xs text-slate-600">
                <b className="font-bold tabular-nums text-slate-900">{delPrograma.length}</b> {delPrograma.length === 1 ? 'cohorte' : 'cohortes'} ·{' '}
                <b className="font-bold tabular-nums text-slate-900">{inscritos}</b> {inscritos === 1 ? 'inscrito' : 'inscritos'}
              </span>
              <span className="truncate text-[11px] text-slate-500">{abierta ? `Abierta: ${abierta.nombre}` : 'Sin cohorte abierta'}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
