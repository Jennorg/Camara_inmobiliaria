import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, Settings2 } from 'lucide-react'

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
  { clave: 'completado', etiqueta: 'Aprobado', color: 'bg-emerald-600' },
  { clave: 'admitido', etiqueta: 'Inscrito', color: 'bg-cyan-600' },
  { clave: 'entrevista', etiqueta: 'Entrevista', color: 'bg-purple-500' },
  { clave: 'pendiente', etiqueta: 'Pendiente', color: 'bg-amber-600' },
  { clave: 'sin_expediente', etiqueta: 'Sin expediente', color: 'bg-slate-500' },
  { clave: 'rechazado', etiqueta: 'Rechazado', color: 'bg-red-500' },
]

const sinMovimiento = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Cifra que cuenta hasta su valor al aparecer y cada vez que cambia; con movimiento reducido salta directo. */
function Numero({ valor, ms = 600 }: { valor: number; ms?: number }) {
  const [mostrado, setMostrado] = useState(sinMovimiento() ? valor : 0)
  const desde = useRef(mostrado)
  useEffect(() => {
    if (sinMovimiento()) {
      setMostrado(valor)
      desde.current = valor
      return
    }
    const inicio = desde.current
    const t0 = performance.now()
    let raf = 0
    const paso = (t: number) => {
      const k = Math.min(1, (t - t0) / ms)
      desde.current = Math.round(inicio + (valor - inicio) * (1 - Math.pow(1 - k, 3)))
      setMostrado(desde.current)
      if (k < 1) raf = requestAnimationFrame(paso)
    }
    raf = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(raf)
  }, [valor, ms])
  return <>{mostrado}</>
}

/** Anima el alto de lo que contiene cuando cambia (p. ej. de un resumen a una franja más alta), para que lo de abajo no salte. */
export function AlturaSuave({ children }: { children: ReactNode }) {
  const interior = useRef<HTMLDivElement>(null)
  const [alto, setAlto] = useState<number | undefined>(undefined)
  useLayoutEffect(() => {
    const el = interior.current
    if (!el) return
    const observador = new ResizeObserver(() => setAlto(el.offsetHeight))
    observador.observe(el)
    setAlto(el.offsetHeight)
    return () => observador.disconnect()
  }, [])
  return (
    <div style={{ height: alto }} className="overflow-hidden transition-[height] duration-300 ease-out motion-reduce:transition-none">
      <div ref={interior}>{children}</div>
    </div>
  )
}

/** Entrada de una tarjeta: aparece subiendo un poco, escalonada por su posición. */
const ENTRADA = 'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300 motion-safe:fill-mode-backwards'
const retraso = (i: number) => ({ animationDelay: `${Math.min(i, 8) * 55}ms` })

const FOCO = 'touch-manipulation motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700'

interface Props {
  programa: string
  cohortes: Cohorte[]
  /** Cohorte elegida; `null` = vista general, sin filtrar por cohorte */
  seleccion: number | null
  onSeleccionar: (id: number | null) => void
  onGestionar: () => void
  /** Vuelve a la vista de todos los programas */
  onVolver: () => void
  /** Se están cargando los inscritos de la selección: muestra una línea de progreso en la franja */
  cargando?: boolean
}

/** Franja para moverse entre las cohortes de un programa y ver, de un vistazo, cuántos inscritos tiene cada una y en qué etapa están. */
export default function CohortesNavegador({ programa, cohortes, seleccion, onSeleccionar, onGestionar, onVolver, cargando = false }: Props) {
  // De la más reciente a la más antigua: la abierta queda siempre junto a "Vista general"
  const ordenadas = useMemo(() => [...cohortes].sort((a, b) => b.numero - a.numero), [cohortes])
  const idTitulo = useId()
  const contenedor = useRef<HTMLDivElement>(null)
  const tarjetas = useRef(new Map<number | null, HTMLButtonElement>())
  const [marca, setMarca] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [conMovimiento, setConMovimiento] = useState(false)
  const registrar = (id: number | null) => (el: HTMLButtonElement | null) => {
    if (el) tarjetas.current.set(id, el)
    else tarjetas.current.delete(id)
  }

  // La marca (borde esmeralda) se mide sobre la tarjeta elegida y se desliza hasta ella
  const medir = useCallback(() => {
    const el = tarjetas.current.get(seleccion)
    if (el) setMarca({ x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight })
  }, [seleccion])
  useLayoutEffect(medir, [medir, cohortes])
  useEffect(() => {
    const cont = contenedor.current
    if (!cont) return
    const observador = new ResizeObserver(medir)
    observador.observe(cont)
    tarjetas.current.forEach(el => observador.observe(el))
    return () => observador.disconnect()
  }, [medir, cohortes])
  // La primera posición se coloca sin animar; solo los cambios posteriores se deslizan
  useEffect(() => {
    if (!marca || conMovimiento) return
    const id = requestAnimationFrame(() => setConMovimiento(true))
    return () => cancelAnimationFrame(id)
  }, [marca, conMovimiento])
  // La cohorte elegida siempre queda a la vista dentro de la franja desplazable
  useEffect(() => {
    tarjetas.current.get(seleccion)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [seleccion])

  return (
    // En pantallas chicas las acciones van arriba de las tarjetas; desde `sm`, al costado
    <section aria-labelledby={idTitulo} className="relative flex flex-col-reverse gap-2 border-b border-gray-100 bg-white px-4 py-2.5 sm:flex-row sm:items-start sm:gap-3">
      <h3 id={idTitulo} className="sr-only">
        Cohortes de {programa}
      </h3>

      <div
        ref={contenedor}
        role="group"
        aria-label={`Cohortes de ${programa}`}
        className="relative -mx-1 flex min-w-0 flex-1 snap-x gap-2.5 overflow-x-auto px-1 pb-1.5 [scrollbar-width:thin]"
      >
        {marca && (
          <span
            aria-hidden="true"
            className={[
              'pointer-events-none absolute left-0 top-0 z-10 rounded-xl border-2 border-emerald-500 bg-emerald-500/[0.06]',
              conMovimiento ? 'transition-[transform,width,height] duration-[420ms] ease-[cubic-bezier(0.4,0,0.1,1)] motion-reduce:transition-none' : '',
            ].join(' ')}
            style={{ transform: `translate(${marca.x}px, ${marca.y}px)`, width: marca.w, height: marca.h }}
          />
        )}
        <button
          type="button"
          aria-pressed={seleccion === null}
          ref={registrar(null)}
          onClick={() => onSeleccionar(null)}
          className={[
            'flex w-28 shrink-0 snap-start flex-col gap-0.5 rounded-xl border border-gray-200 bg-white p-2.5 text-left transition-colors hover:border-gray-300 hover:bg-slate-50',
            ENTRADA,
            FOCO,
          ].join(' ')}
        >
          <span className={`text-sm font-bold ${seleccion === null ? 'text-emerald-900' : 'text-slate-800'}`}>Vista general</span>
          <span className="text-[11px] leading-snug text-slate-500">Todo {programa}, sin filtrar</span>
        </button>

        {ordenadas.map((c, i) => {
          const elegida = c.id_cohorte === seleccion
          const presentes = ETAPAS.filter(e => c.etapas[e.clave] > 0)
          const resumen = presentes.map(e => `${c.etapas[e.clave]} ${e.etiqueta.toLocaleLowerCase('es')}`).join(', ') || 'sin inscritos'
          return (
            <button
              key={c.id_cohorte}
              type="button"
              aria-pressed={elegida}
              ref={registrar(c.id_cohorte)}
              onClick={() => onSeleccionar(c.id_cohorte)}
              style={retraso(i + 1)}
              className={[
                'flex w-[15.5rem] shrink-0 snap-start flex-col rounded-xl border border-gray-200 bg-white p-2.5 text-left transition-colors hover:border-gray-300 hover:bg-slate-50',
                ENTRADA,
                FOCO,
              ].join(' ')}
            >
              <span className="flex items-center justify-between gap-2">
                <span className={`truncate text-sm font-bold ${elegida ? 'text-emerald-900' : 'text-slate-800'}`}>{c.nombre}</span>
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
                <span className={`text-xl font-extrabold leading-none tabular-nums ${elegida ? 'text-emerald-900' : 'text-slate-900'}`}><Numero valor={c.inscritos} /></span>
                <span className="text-xs font-medium text-slate-500">{c.inscritos === 1 ? 'inscrito' : 'inscritos'}</span>
              </span>

              <span
                role="img"
                aria-label={`${c.nombre}: ${resumen}`}
                style={{ animationDelay: `${Math.min(i + 1, 8) * 55 + 120}ms` }}
                className="mt-2 flex h-1.5 origin-left gap-0.5 overflow-hidden rounded-full bg-slate-100 motion-safe:animate-[cohorte-barra_700ms_cubic-bezier(0.2,0.8,0.2,1)_both]"
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
          <p className="self-center px-2 text-xs text-slate-500">Este programa aún no tiene cohortes. Crea la primera con “Gestionar cohortes”.</p>
        )}
      </div>

      <div className="flex shrink-0 gap-2 sm:w-40 sm:flex-col sm:gap-1.5">
        <button
          type="button"
          onClick={onVolver}
          className={`inline-flex min-h-9 min-w-0 items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 sm:w-full ${FOCO}`}
        >
          <ArrowLeft size={14} aria-hidden="true" className="shrink-0" />
          <span className="truncate">Todos los programas</span>
        </button>
        <button
          type="button"
          onClick={onGestionar}
          className={`inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-800 transition-colors hover:bg-emerald-100 sm:w-full ${FOCO}`}
        >
          <Settings2 size={14} aria-hidden="true" className="shrink-0" />
          Gestionar cohortes
        </button>
      </div>

      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 bottom-0 h-0.5 overflow-hidden transition-opacity duration-200 ${cargando ? 'opacity-100' : 'opacity-0'}`}
      >
        <span className="block h-full w-full bg-gradient-to-r from-transparent via-emerald-500 to-transparent motion-safe:animate-progress-indefinite motion-reduce:bg-emerald-500/50" />
      </span>
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
        {programas.map((programa, i) => {
          const delPrograma = cohortes.filter(c => c.programa_codigo === programa)
          const inscritos = delPrograma.reduce((suma, c) => suma + c.inscritos, 0)
          const abierta = delPrograma.find(c => c.estado === 'Abierta')
          return (
            <button
              key={programa}
              type="button"
              onClick={() => onElegir(programa)}
              style={retraso(i)}
              className={`flex min-w-44 flex-1 basis-44 flex-col gap-0.5 rounded-2xl border border-gray-200 bg-white p-3 text-left transition-colors hover:border-emerald-400 hover:bg-emerald-50/40 ${ENTRADA} ${FOCO}`}
            >
              <span className="text-sm font-bold text-slate-800">{programa}</span>
              <span className="text-xs text-slate-600">
                <b className="font-bold tabular-nums text-slate-900">{delPrograma.length}</b> {delPrograma.length === 1 ? 'cohorte' : 'cohortes'} ·{' '}
                <b className="font-bold tabular-nums text-slate-900"><Numero valor={inscritos} /></b> {inscritos === 1 ? 'inscrito' : 'inscritos'}
              </span>
              <span className="truncate text-[11px] text-slate-500">{abierta ? `Abierta: ${abierta.nombre}` : 'Sin cohorte abierta'}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
