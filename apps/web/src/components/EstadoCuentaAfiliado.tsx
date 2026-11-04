import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, CalendarPlus, Check, CheckCircle2, CircleDashed, Clock, Loader2, Wallet, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { API_URL } from '@/config/env'
import { apiFetch } from '@/lib/apiClient'
import WidgetReportarPago from '@/pages/landing/afiliado/components/WidgetReportarPago'
import { mesesPagables } from '@/pages/landing/afiliado/components/SelectorMesesPago'

type EstadoMes = 'pagado' | 'en_revision' | 'deuda' | 'por_pagar' | 'adelantado'

interface MesSolvencia {
  periodo: string
  estado: EstadoMes
  pago: { numero_recibo: string; fecha_pago: string } | null
}

interface Solvencia {
  monto_mensual: number
  solvente: boolean
  meses_deuda: number
  deuda_usd: number
  bloqueado?: boolean
  meses: MesSolvencia[]
}

type EstadoTile = EstadoMes | 'futuro'

const ESTILO: Record<EstadoTile, { label: string; clase: string; Icono: typeof Clock }> = {
  pagado:      { label: 'Pagado',      clase: 'bg-emerald-50 border-emerald-200 text-emerald-800', Icono: CheckCircle2 },
  adelantado:  { label: 'Adelantado',  clase: 'bg-teal-50 border-teal-200 text-teal-800', Icono: CalendarPlus },
  en_revision: { label: 'En revisión', clase: 'bg-amber-50 border-amber-300 text-amber-900', Icono: Clock },
  deuda:       { label: 'Vencido',     clase: 'bg-red-50 border-red-300 text-red-800 hover:bg-red-100', Icono: AlertCircle },
  por_pagar:   { label: 'Mes actual',  clase: 'bg-white border-slate-300 text-slate-800 hover:border-emerald-500 hover:bg-emerald-50', Icono: CircleDashed },
  futuro:      { label: 'Adelantar',   clase: 'bg-white border-dashed border-slate-300 text-slate-700 hover:border-emerald-500 hover:bg-emerald-50', Icono: CalendarPlus },
}

const fecha = (ym: string) => new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1, 1)
const mesCorto = (ym: string) => fecha(ym).toLocaleDateString('es-VE', { month: 'short' }).replace('.', '')
const mesLargo = (ym: string) => fecha(ym).toLocaleDateString('es-VE', { month: 'long', year: 'numeric' })
const usd = (n: number) => `$${n.toFixed(2)}`

interface Props {
  idAfiliado: number
  /** Tras reportar un pago, para refrescar el aviso de mora del panel */
  onReportado?: () => void
}

/**
 * Estado de cuenta del afiliado: la línea de tiempo mensual es el centro de la pantalla.
 * Tocar un mes impago selecciona también los anteriores (el pago cubre primero la deuda más antigua)
 * y la barra inferior muestra el estimado; "Pagar" abre el formulario de reporte en un modal.
 */
export default function EstadoCuentaAfiliado({ idAfiliado, onReportado }: Props) {
  const { token } = useAuth()
  const [data, setData] = useState<Solvencia | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const [sel, setSel] = useState(0)
  const [modal, setModal] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let vivo = true
    setError(null)
    apiFetch<{ data: Solvencia }>(`${API_URL}/api/pagos/solvencia/afiliado/${idAfiliado}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => vivo && setData(r.data))
      .catch(e => vivo && setError(e.message))
    return () => { vivo = false }
  }, [idAfiliado, token, version])

  const lista = useMemo(() => (data ? mesesPagables(data.meses) : []), [data])
  const indice = useMemo(() => new Map(lista.map((m, i) => [m.periodo, i])), [lista])
  const deudas = lista.filter(m => m.estado === 'deuda').length

  useEffect(() => {
    if (!modal) return
    dialogRef.current?.focus()
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') setModal(false) }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [modal])

  if (error) return <p className="p-6 text-sm font-medium text-red-600">No se pudo cargar tu estado de cuenta: {error}</p>
  if (!data) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-400" aria-label="Cargando" /></div>

  const total = sel * data.monto_mensual
  const enRevision = data.meses.filter(m => m.estado === 'en_revision').length
  const hastaAdelantado = [...data.meses].reverse().find(m => m.estado === 'adelantado')?.periodo
  // Estado actual: la mora real manda; sin deuda, un pago en revisión es una espera (no una alarma) y si no, está al día
  const situacion = data.meses_deuda > 0
    ? {
        tono: 'bg-red-50 border-red-200 text-red-900', icono: 'bg-red-100 text-red-700', Icono: AlertCircle,
        titulo: `Tienes ${data.meses_deuda} ${data.meses_deuda === 1 ? 'mensualidad pendiente' : 'mensualidades pendientes'}`,
        detalle: data.bloqueado
          ? 'Tu carnet, constancia y certificados están bloqueados hasta que Finanzas verifique tu pago.'
          : 'Selecciona los meses en la línea de tiempo y reporta tu pago para ponerte al día.',
      }
    : enRevision > 0
    ? {
        tono: 'bg-amber-50 border-amber-200 text-amber-950', icono: 'bg-amber-100 text-amber-800', Icono: Clock,
        titulo: 'Tu pago está en revisión',
        detalle: 'Finanzas está verificando tu pago. Se habilita todo en cuanto se confirme; no necesitas hacer nada más.',
      }
    : {
        tono: 'bg-emerald-50 border-emerald-200 text-emerald-950', icono: 'bg-emerald-100 text-emerald-800', Icono: CheckCircle2,
        titulo: 'Estás al día',
        detalle: hastaAdelantado ? `Tus mensualidades están pagadas hasta ${mesLargo(hastaAdelantado)}.` : 'Tus mensualidades están pagadas.',
      }
  const elegidos = lista.slice(0, sel)

  // Un mosaico por mes (año en curso primero); los adelantos llegan hasta diciembre del año siguiente
  const tiles: { periodo: string; estado: EstadoTile; recibo?: string }[] = [
    ...data.meses.map(m => ({ periodo: m.periodo, estado: m.estado as EstadoTile, recibo: m.pago?.numero_recibo })),
    ...lista.filter(m => m.estado === 'futuro').map(m => ({ periodo: m.periodo, estado: 'futuro' as EstadoTile })),
  ]
  // Año en curso primero, luego los siguientes; el historial (años anteriores) queda debajo, del más reciente al más antiguo
  const actual = String(new Date().getFullYear())
  const todos = [...new Set(tiles.map(t => t.periodo.slice(0, 4)))].sort()
  const anios = [...todos.filter(a => a >= actual), ...todos.filter(a => a < actual).reverse()]

  const alPagar = () => {
    setModal(false)
    setSel(0)
    setVersion(v => v + 1)
    onReportado?.()
  }

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8 max-w-5xl w-full mx-auto">
        {/* Resumen */}
        <header className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Mi membresía</p>
              <h2 className="text-2xl font-black tracking-tight text-slate-900 mt-0.5">Estado de cuenta</h2>
            </div>
            <dl className="flex gap-6 text-right">
              {!data.solvente && (
                <div>
                  <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Deuda</dt>
                  <dd className="text-2xl font-black tabular-nums text-red-700">{usd(data.deuda_usd)}</dd>
                </div>
              )}
              <div>
                <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Cuota mensual</dt>
                <dd className="text-2xl font-black tabular-nums text-slate-900">{usd(data.monto_mensual)}</dd>
              </div>
            </dl>
          </div>
          <div role="status" className={`mt-5 flex items-start gap-3 rounded-2xl border p-4 ${situacion.tono}`}>
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${situacion.icono}`} aria-hidden="true">
              <situacion.Icono size={20} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-black">{situacion.titulo}</p>
              <p className="mt-0.5 text-xs font-medium leading-relaxed opacity-90">{situacion.detalle}</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {deudas > 0 && (
              <button type="button" onClick={() => setSel(deudas)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 transition-colors">
                <Wallet size={14} aria-hidden="true" /> Seleccionar toda la deuda ({usd(deudas * data.monto_mensual)})
              </button>
            )}
          </div>
        </header>

        {/* Línea de tiempo */}
        <section aria-label="Línea de tiempo de mensualidades" className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
          <p className="text-sm font-semibold text-slate-700 mb-5">
            Toca los meses que vas a pagar. Se incluyen todos los anteriores, porque tu pago cubre primero la deuda más antigua.
          </p>
          <div className="relative space-y-7 pl-6 sm:pl-8">
            <span aria-hidden className="absolute left-[7px] sm:left-[11px] top-2 bottom-2 w-0.5 bg-slate-200" />
            {anios.map(anio => (
              <div key={anio} className="relative">
                <span aria-hidden className="absolute -left-6 sm:-left-8 top-1 grid h-4 w-4 sm:h-6 sm:w-6 place-items-center rounded-full bg-slate-800 ring-4 ring-white" />
                <h3 className="text-lg font-black tracking-tight text-slate-900 mb-3 ml-1">{anio}</h3>
                <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
                  {tiles.filter(t => t.periodo.startsWith(anio)).map(t => {
                    const e = ESTILO[t.estado]
                    const i = indice.get(t.periodo)
                    const elegible = i !== undefined
                    const on = elegible && i < sel
                    const etiqueta = `${mesLargo(t.periodo)}, ${e.label}`
                    const contenido = (
                      <>
                        <span className="block text-base font-black uppercase leading-none tracking-tight">{mesCorto(t.periodo)}</span>
                        <span className={`mt-1.5 flex items-center justify-center gap-1 text-xs font-semibold leading-none ${on ? 'text-white' : ''}`}>
                          {on ? <><Check size={12} aria-hidden="true" /> {usd(data.monto_mensual)}</>
                            : elegible ? <>{e.label} · {usd(data.monto_mensual)}</>
                            : <><e.Icono size={12} aria-hidden="true" /> {e.label}</>}
                        </span>
                        {!elegible && t.recibo && <span className="mt-1 block truncate text-[11px] font-medium tabular-nums opacity-80">{t.recibo}</span>}
                      </>
                    )
                    return (
                      <li key={t.periodo}>
                        {elegible ? (
                          <button type="button" aria-pressed={on} aria-label={etiqueta}
                            onClick={() => setSel(i === sel - 1 ? i : i + 1)}
                            className={`w-full rounded-2xl border-2 px-2 py-3.5 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 ${
                              on ? 'bg-emerald-600 border-emerald-600 text-white shadow-md' : e.clase
                            }`}>
                            {contenido}
                          </button>
                        ) : (
                          <div aria-label={etiqueta} className={`w-full rounded-2xl border-2 px-2 py-3.5 text-center ${e.clase}`}>{contenido}</div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Barra de pago */}
      <div className="sticky bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur px-4 py-3 sm:px-6 shadow-[0_-4px_16px_rgba(15,23,42,0.06)]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <div role="status" className="min-w-0">
            {sel > 0 ? (
              <>
                <p className="text-xs font-semibold text-slate-600">
                  {sel} {sel === 1 ? 'mes' : 'meses'}: {mesLargo(elegidos[0].periodo)}{sel > 1 && <> → {mesLargo(elegidos[sel - 1].periodo)}</>}
                </p>
                <p className="text-xl font-black tabular-nums text-slate-900">Estimado: {usd(total)} <span className="text-xs font-bold text-slate-500">USD</span></p>
              </>
            ) : (
              <p className="text-sm font-semibold text-slate-600">Selecciona los meses en la línea de tiempo para ver el estimado.</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {sel > 0 && (
              <button type="button" onClick={() => setSel(0)}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors">
                <X size={13} aria-hidden="true" /> Limpiar
              </button>
            )}
            <button type="button" disabled={sel === 0} onClick={() => setModal(true)}
              className="rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-black uppercase tracking-wider text-white shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-colors disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none">
              Pagar {sel > 0 && usd(total)}
            </button>
          </div>
        </div>
      </div>

      {/* Modal de reporte de pago */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 p-0 sm:p-6" onMouseDown={e => { if (e.target === e.currentTarget) setModal(false) }}>
          <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="titulo-pago" tabIndex={-1}
            className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl outline-none">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
              <div>
                <h2 id="titulo-pago" className="text-lg font-black text-slate-900">Reportar pago</h2>
                <p className="text-xs font-semibold text-slate-600">
                  {sel} {sel === 1 ? 'mensualidad' : 'mensualidades'} · {mesLargo(elegidos[0].periodo)}{sel > 1 && <> → {mesLargo(elegidos[sel - 1].periodo)}</>} · {usd(total)} USD
                </p>
              </div>
              <button type="button" onClick={() => setModal(false)} aria-label="Cerrar"
                className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 transition-colors">
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            <div className="overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
              <WidgetReportarPago idAfiliado={idAfiliado} mesesFijos={sel} onReportado={alPagar} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
