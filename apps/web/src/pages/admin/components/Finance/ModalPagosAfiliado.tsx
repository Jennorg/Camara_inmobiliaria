import Modal from '@/components/ui/Modal'
import { useEffect, useState } from 'react'
import Swal from '@/lib/swal'
import { toast } from 'sonner'
import { CalendarPlus, Loader2, Receipt, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { API_URL } from '@/config/env'
import { apiFetch } from '@/lib/apiClient'
import { formatDateLatina } from '@/utils/formatters'
import type { PagoDTO } from '@/types/pagos'
import LineaTiempoSolvencia from '@/components/LineaTiempoSolvencia'
import ReciboDigitalModal, { getMetodoLabel } from '@/components/ReciboDigitalModal'

type Pago = PagoDTO & { periodo?: string | null; meses_cubiertos?: number | null }

const ESTATUS: Record<string, string> = {
  Verificado: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Pendiente: 'bg-amber-50 text-amber-800 border-amber-200',
  Rechazado: 'bg-red-50 text-red-700 border-red-200',
  Anulado: 'bg-slate-100 text-slate-500 border-slate-200',
}

/** 'YYYY-MM' desplazado n meses */
const sumarMeses = (ym: string, n: number) => {
  const d = new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const mes = (ym: string) =>
  new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1, 1).toLocaleDateString('es-VE', { month: 'short', year: 'numeric' }).replace('.', '')

/** Meses que cubre una mensualidad y si fue adelanto (cubre meses posteriores al mes en que se pagó) */
function cobertura(p: Pago) {
  if (p.tipo_concepto !== 'mensualidad' || !p.periodo) return null
  const n = Math.max(1, Number(p.meses_cubiertos) || 1)
  const hasta = sumarMeses(p.periodo, n - 1)
  return { desde: p.periodo, hasta, n, adelanto: hasta > String(p.fecha_pago).slice(0, 7), anio: n >= 12 }
}

interface Props {
  idAfiliado: number
  nombre: string
  representante?: string | null
  /** Año que se está viendo en Solvencia: el que se puede marcar como año adelantado */
  anio: number
  onClose: () => void
}

/** Popup de Solvencia: historial de pagos del afiliado (cuándo, cómo, qué meses cubre) y su línea de tiempo mensual. */
export default function ModalPagosAfiliado({ idAfiliado, nombre, representante, anio, onClose }: Props) {
  const { authHeaders, puede } = useAuth()
  const [pagos, setPagos] = useState<Pago[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [recibo, setRecibo] = useState<Pago | null>(null)

  useEffect(() => {
    apiFetch<{ data: Pago[] }>(`${API_URL}/api/pagos/afiliado/${idAfiliado}`, { headers: authHeaders })
      .then(r => setPagos(r.data))
      .catch(e => setError(e.message))
  }, [idAfiliado, authHeaders])

  // El listado importado (o marcar mes a mes en Solvencia) no distingue el año adelantado de los meses sueltos; el personal lo decide por afiliado
  const marcarAnioAdelantado = async () => {
    const ok = await Swal.fire({
      title: `¿${nombre} pagó ${anio} por adelantado?`,
      text: `Sus 12 meses de ${anio} marcados como pagados se reportarán en Finanzas con el monto del año adelantado en lugar de 12 cuotas. Sigue solvente todo el año.`,
      icon: 'question', showCancelButton: true, confirmButtonText: 'Sí, fue año adelantado', cancelButtonText: 'Cancelar', confirmButtonColor: '#059669',
    })
    if (!ok.isConfirmed) return
    try {
      const r = await apiFetch<{ data: { antes_usd: number; despues_usd: number } }>(`${API_URL}/api/pagos/admin/solvencia/afiliado/${idAfiliado}/sincerar-anual`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders }, body: JSON.stringify({ anio }),
      })
      toast.success(`${anio} reportado como año adelantado: $${r.data.antes_usd.toFixed(2)} → $${r.data.despues_usd.toFixed(2)}`)
    } catch (e: any) {
      Swal.fire('No se pudo marcar', e.message, 'error')
    }
  }

  return (
    <Modal onClose={onClose} aria-labelledby="titulo-pagos-afiliado" className="flex items-center justify-center bg-slate-900/60 p-4" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Pagos y solvencia</p>
            <h2 id="titulo-pagos-afiliado" className="truncate text-lg font-black text-slate-900">{nombre}</h2>
            {representante && <p className="text-xs font-semibold text-slate-500">Rep. {representante}</p>}
          </div>
          {puede('finanzas', 'editar') && (
            <button type="button" onClick={marcarAnioAdelantado}
              title={`Si los 12 meses de ${anio} están marcados como pagados (importados o a mano), reportarlos como un año pagado por adelantado`}
              className="ml-auto shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-[11px] font-black uppercase tracking-wider text-teal-800 hover:bg-teal-100">
              <CalendarPlus size={13} aria-hidden="true" /> Marcar {anio} como año adelantado
            </button>
          )}
          <button type="button" onClick={onClose} aria-label="Cerrar"
            className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"><X size={16} aria-hidden="true" /></button>
        </div>

        <div className="grid gap-6 overflow-y-auto p-6 lg:grid-cols-[1fr_340px]">
          <section aria-labelledby="titulo-historial" className="min-w-0">
            <h3 id="titulo-historial" className="mb-3 text-xs font-black uppercase tracking-wider text-slate-500">Historial de pagos</h3>
            {error ? <p className="text-sm font-medium text-red-600">No se pudieron cargar los pagos: {error}</p>
              : !pagos ? <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-slate-300" aria-label="Cargando" /></div>
              : pagos.length === 0 ? <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm font-medium text-slate-500">Este afiliado no tiene pagos registrados.</p>
              : (
                <ul className="space-y-2">
                  {pagos.map(p => {
                    const c = cobertura(p)
                    return (
                      <li key={p.id_pago}>
                        <button type="button" onClick={() => setRecibo(p)}
                          className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-left transition-colors hover:border-emerald-300 hover:bg-emerald-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-black text-slate-800">{p.descripcion_concepto}</p>
                              <p className="mt-0.5 text-xs font-semibold text-slate-500 tabular-nums">
                                {formatDateLatina(p.fecha_pago)} · {getMetodoLabel(p.metodo_pago)}
                                {p.banco_origen && <> · {p.banco_origen}</>}
                                {p.referencia && <> · Ref. {p.referencia}</>}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-black tabular-nums text-slate-900">${Number(p.monto_usd_equivalente).toFixed(2)}</p>
                              {p.moneda === 'VES' && <p className="text-[11px] font-semibold tabular-nums text-slate-400">Bs. {Number(p.monto).toFixed(2)}</p>}
                            </div>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
                            <span className={`rounded-full border px-2 py-0.5 ${ESTATUS[p.estatus] ?? ESTATUS.Anulado}`}>{p.estatus}</span>
                            {c && (
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-600">
                                {c.n === 1 ? mes(c.desde) : `${mes(c.desde)} → ${mes(c.hasta)}`} · {c.n} {c.n === 1 ? 'mes' : 'meses'}
                              </span>
                            )}
                            {c?.adelanto && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-teal-800">
                                <CalendarPlus size={11} aria-hidden="true" /> {c.anio ? 'Año completo adelantado' : 'Adelanto'}
                              </span>
                            )}
                            {c?.anio && !c.adelanto && <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-800">Año completo</span>}
                            <span className="ml-auto inline-flex items-center gap-1 text-slate-400"><Receipt size={11} aria-hidden="true" /> {p.numero_recibo}</span>
                          </div>
                          {p.estatus === 'Rechazado' && p.motivo_rechazo && <p className="mt-1.5 text-[11px] font-medium text-red-600">Motivo: {p.motivo_rechazo}</p>}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
          </section>

          <section aria-labelledby="titulo-meses">
            <h3 id="titulo-meses" className="mb-3 text-xs font-black uppercase tracking-wider text-slate-500">Mes a mes</h3>
            <LineaTiempoSolvencia idAfiliado={idAfiliado} />
          </section>
        </div>
      </div>

      {recibo && <ReciboDigitalModal pago={recibo} onClose={() => setRecibo(null)} />}
    </Modal>
  )
}
