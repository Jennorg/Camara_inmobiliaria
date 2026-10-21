import { useEffect, useState } from 'react'
import { CheckCircle2, Clock, AlertCircle, CircleDashed, CalendarPlus, Loader2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { API_URL } from '@/config/env'
import { apiFetch } from '@/lib/apiClient'

type EstadoMes = 'pagado' | 'en_revision' | 'deuda' | 'por_pagar' | 'adelantado'

interface MesSolvencia {
  periodo: string
  estado: EstadoMes
  pago: { numero_recibo: string; estatus: string; fecha_pago: string; monto_usd_equivalente: number } | null
  historico?: boolean
}

interface Solvencia {
  monto_mensual: number
  solvente: boolean
  meses_deuda: number
  deuda_usd: number
  meses: MesSolvencia[]
}

const ESTADOS: Record<EstadoMes, { label: string; punto: string; texto: string; tarjeta: string; Icono: typeof Clock }> = {
  pagado:      { label: 'Pagado',          punto: 'bg-emerald-500', texto: 'text-emerald-700', tarjeta: 'bg-emerald-50/60 border-emerald-100', Icono: CheckCircle2 },
  adelantado:  { label: 'Pagado por adelantado', punto: 'bg-teal-500', texto: 'text-teal-700', tarjeta: 'bg-teal-50/60 border-teal-100', Icono: CalendarPlus },
  en_revision: { label: 'Pago en revisión', punto: 'bg-amber-500',   texto: 'text-amber-700', tarjeta: 'bg-amber-50/70 border-amber-100',   Icono: Clock },
  deuda:       { label: 'Pendiente de pago', punto: 'bg-red-500',    texto: 'text-red-600', tarjeta: 'bg-red-50/70 border-red-100',     Icono: AlertCircle },
  por_pagar:   { label: 'Mes en curso',    punto: 'bg-slate-300',   texto: 'text-slate-500', tarjeta: 'bg-slate-50 border-slate-100',   Icono: CircleDashed },
}

const mesCorto = (ym: string) =>
  new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1, 1).toLocaleDateString('es-VE', { month: 'short' }).replace('.', '')

const mesLargo = (ym: string) =>
  new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1, 1).toLocaleDateString('es-VE', { month: 'long', year: 'numeric' })

/** Línea de tiempo mensual de solvencia de un afiliado (mes más reciente arriba). */
export default function LineaTiempoSolvencia({ idAfiliado }: { idAfiliado: number }) {
  const { token } = useAuth()
  const [data, setData] = useState<Solvencia | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    setData(null)
    setError(null)
    apiFetch<{ data: Solvencia }>(`${API_URL}/api/pagos/solvencia/afiliado/${idAfiliado}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => vivo && setData(r.data))
      .catch(e => vivo && setError(e.message))
    return () => { vivo = false }
  }, [idAfiliado, token])

  if (error) return <p className="text-xs font-medium text-red-500">No se pudo cargar la solvencia: {error}</p>
  if (!data) return <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-slate-300" /></div>

  const meses = [...data.meses].reverse()
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
          data.solvente ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'
        }`}>
          {data.solvente ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
          {data.solvente ? 'Solvente' : `En mora · ${data.meses_deuda} ${data.meses_deuda === 1 ? 'mes' : 'meses'}`}
        </span>
        {!data.solvente && (
          <span className="text-xs font-bold text-red-600 tabular-nums">Deuda: ${data.deuda_usd.toFixed(2)} USD</span>
        )}
      </div>

      <ol className="max-h-[26rem] overflow-y-auto pr-1">
        {meses.map((m, i) => {
          const e = ESTADOS[m.estado]
          const anio = m.periodo.slice(0, 4)
          const nuevoAnio = i === 0 || meses[i - 1].periodo.slice(0, 4) !== anio
          return (
            <li key={m.periodo}>
              {nuevoAnio && (
                <div className="flex items-center gap-3 py-2">
                  <span className="text-[11px] font-black text-slate-400 tracking-[0.2em]">{anio}</span>
                  <span aria-hidden className="h-px flex-1 bg-slate-100" />
                </div>
              )}
              <div className="flex items-stretch gap-3">
                <div className="w-16 shrink-0 text-right pt-2" aria-label={mesLargo(m.periodo)}>
                  <p className={`text-xl font-black uppercase leading-none tracking-tight ${e.texto}`}>{mesCorto(m.periodo)}</p>
                  <p className="text-[10px] font-bold text-slate-300 tabular-nums mt-0.5">{anio}</p>
                </div>

                <div className="relative flex flex-col items-center shrink-0 w-5">
                  <span aria-hidden className={`mt-2.5 w-4 h-4 rounded-full ring-4 ring-white z-10 ${e.punto}`} />
                  {i < meses.length - 1 && <span aria-hidden className="flex-1 w-0.5 bg-slate-200 -mt-1" />}
                </div>

                <div className={`flex-1 min-w-0 mb-2 rounded-xl border px-3 py-2 ${e.tarjeta}`}>
                  <p className={`text-xs font-black flex items-center gap-1.5 ${e.texto}`}><e.Icono size={13} /> {e.label}</p>
                  {m.historico && <p className="text-[11px] text-slate-400 font-medium mt-0.5">Registro del listado de solvencia</p>}
                  {m.pago && (
                    <p className="text-[11px] text-slate-500 font-medium tabular-nums mt-0.5">
                      {m.pago.numero_recibo} · {new Date(m.pago.fecha_pago).toLocaleDateString('es-VE', { day: '2-digit', month: 'short' })}
                    </p>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
