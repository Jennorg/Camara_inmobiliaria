import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, Loader2, Search, X } from 'lucide-react'
import Swal from 'sweetalert2'
import { useAuth } from '@/context/AuthContext'
import { API_URL } from '@/config/env'
import { apiFetch } from '@/lib/apiClient'
import LineaTiempoSolvencia from '@/components/LineaTiempoSolvencia'
import { cleanSearchDigits, normalizeSearchText } from '@/utils/searchUtils'
import { formatNombreCard } from '@/utils/formatters'

type EstadoMes = 'pagado' | 'en_revision' | 'deuda' | 'por_pagar' | 'adelantado'

interface FilaSolvencia {
  id_afiliado: number
  codigo: string | null
  nombre: string
  nombres: string | null
  apellidos: string | null
  razon_social: string | null
  cedula: string | null
  rif: string | null
  email: string | null
  solvente: boolean
  meses_deuda: number
  deuda_usd: number
  celdas: (EstadoMes | null)[]
}

interface Resumen {
  inicio: string
  mes_actual: string
  anio: number
  monto_mensual: number
  afiliados: FilaSolvencia[]
}

type CriterioBusqueda = 'nombre' | 'cedula' | 'codigo'

const CRITERIOS: { key: CriterioBusqueda; label: string; placeholder: string }[] = [
  { key: 'nombre', label: 'Nombre', placeholder: 'Buscar por nombre o empresa...' },
  { key: 'cedula', label: 'Cédula', placeholder: 'Buscar por cédula o RIF...' },
  { key: 'codigo', label: 'Código', placeholder: 'Buscar por N° de afiliado...' },
]

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const CELDA: Record<EstadoMes, { clase: string; marca: string; titulo: string }> = {
  pagado:      { clase: 'bg-emerald-500 text-white',  marca: '✓', titulo: 'Pagado' },
  adelantado:  { clase: 'bg-teal-300 text-teal-900',  marca: '✓', titulo: 'Pagado por adelantado' },
  en_revision: { clase: 'bg-amber-400 text-white',    marca: '…', titulo: 'Pago en revisión' },
  deuda:       { clase: 'bg-red-500 text-white',      marca: '!', titulo: 'Pendiente de pago' },
  por_pagar:   { clase: 'bg-slate-200 text-slate-500', marca: '·', titulo: 'Mes en curso' },
}

/** Matriz mes a mes de la solvencia de todos los afiliados; al abrir una fila se ve su línea de tiempo. */
export default function SolvenciaPanel() {
  const { authHeaders } = useAuth()
  const [anio, setAnio] = useState(new Date().getFullYear())
  const [data, setData] = useState<Resumen | null>(null)
  const [inicio, setInicio] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [criterio, setCriterio] = useState<CriterioBusqueda>('nombre')
  const [menuCriterio, setMenuCriterio] = useState(false)
  const [soloMora, setSoloMora] = useState(false)
  const [abierto, setAbierto] = useState<number | null>(null)
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    try {
      const r = await apiFetch<{ data: Resumen }>(`${API_URL}/api/pagos/admin/solvencia?anio=${anio}`, { headers: authHeaders })
      setData(r.data)
      setInicio(r.data.inicio)
    } catch (e: any) {
      Swal.fire('Error', e.message, 'error')
    }
  }, [authHeaders, anio])

  useEffect(() => { cargar() }, [cargar])

  const filas = useMemo(() => {
    const terminos = normalizeSearchText(busqueda).split(' ').filter(Boolean)
    const digitos = cleanSearchDigits(busqueda)
    const coincide = (a: FilaSolvencia) => {
      if (criterio === 'nombre') {
        // Sin acentos ni mayúsculas; busca en el titular y en la razón social
        const texto = normalizeSearchText(`${a.nombres ?? ''} ${a.apellidos ?? ''} ${a.razon_social ?? ''}`)
        return terminos.every(t => texto.includes(t))
      }
      if (criterio === 'cedula') return digitos !== '' && (cleanSearchDigits(a.cedula).includes(digitos) || cleanSearchDigits(a.rif).includes(digitos))
      return (a.codigo ?? '') === busqueda.trim()
    }
    return (data?.afiliados ?? []).filter(a => (!soloMora || !a.solvente) && (!busqueda.trim() || coincide(a)))
  }, [data, busqueda, criterio, soloMora])

  const guardarInicio = async () => {
    setGuardando(true)
    try {
      await apiFetch(`${API_URL}/api/pagos/admin/solvencia/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ inicio }),
      })
      await cargar()
    } catch (e: any) {
      Swal.fire('Error', e.message, 'error')
    } finally {
      setGuardando(false)
    }
  }

  if (!data) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>

  const enMora = data.afiliados.filter(a => !a.solvente)
  const deudaTotal = enMora.reduce((t, a) => t + a.deuda_usd, 0)

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-end gap-4 justify-between">
        <div className="flex gap-6 text-sm">
          <div><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Solventes</p><p className="text-2xl font-black text-emerald-600 tabular-nums">{data.afiliados.length - enMora.length}</p></div>
          <div><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">En mora</p><p className="text-2xl font-black text-red-600 tabular-nums">{enMora.length}</p></div>
          <div><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Deuda total</p><p className="text-2xl font-black text-slate-800 tabular-nums">${deudaTotal.toFixed(2)}</p></div>
        </div>

        <div className="flex items-end gap-2">
          <label className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Sin historial, la deuda cuenta desde</span>
            <input type="month" value={inicio} onChange={e => setInicio(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </label>
          <button type="button" onClick={guardarInicio} disabled={guardando || !inicio || inicio === data.inicio}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider disabled:opacity-40 disabled:pointer-events-none cursor-pointer">
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-xl border border-slate-200 bg-white">
          <button type="button" aria-label="Año anterior" onClick={() => setAnio(a => a - 1)} className="p-2 text-slate-500 hover:text-slate-800 cursor-pointer"><ChevronLeft size={16} /></button>
          <span className="px-2 text-sm font-black text-slate-800 tabular-nums">{anio}</span>
          <button type="button" aria-label="Año siguiente" onClick={() => setAnio(a => a + 1)} className="p-2 text-slate-500 hover:text-slate-800 cursor-pointer"><ChevronRight size={16} /></button>
        </div>
        <div className="relative flex-1 min-w-[240px] max-w-md flex items-center bg-slate-50 border border-slate-200/80 rounded-xl focus-within:ring-2 focus-within:ring-emerald-500/10 focus-within:border-emerald-500 transition-colors h-9 z-20">
          <div className="relative shrink-0 border-r border-slate-200/80 h-full flex items-center">
            <button type="button" onClick={() => setMenuCriterio(v => !v)}
              className="flex items-center gap-0.5 px-2.5 h-full text-[10px] font-black uppercase tracking-wider text-slate-600 hover:text-slate-900 transition-colors cursor-pointer">
              <span>{CRITERIOS.find(c => c.key === criterio)?.label}</span>
              <ChevronDown size={11} className={`text-slate-400 transition-transform ${menuCriterio ? 'rotate-180' : ''}`} />
            </button>
            {menuCriterio && (
              <>
                <div className="fixed inset-0 z-40" aria-hidden="true" onClick={() => setMenuCriterio(false)} />
                <div className="absolute left-0 top-full mt-1 bg-white border border-slate-100 rounded-xl shadow-xl py-1 z-50 min-w-[130px]">
                  {CRITERIOS.map(c => (
                    <button key={c.key} type="button" onClick={() => { setCriterio(c.key); setMenuCriterio(false) }}
                      className={`w-full text-left px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer ${criterio === c.key ? 'bg-emerald-50 text-emerald-600' : 'text-slate-600 hover:bg-slate-50'}`}>
                      {c.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="relative flex-grow h-full flex items-center">
            <Search className="absolute left-2.5 text-slate-400" size={13} />
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder={CRITERIOS.find(c => c.key === criterio)?.placeholder}
              className="w-full h-full pl-8 pr-8 bg-transparent text-xs font-medium text-slate-700 placeholder-slate-400 focus:outline-none" />
            {busqueda && (
              <button type="button" aria-label="Limpiar búsqueda" onClick={() => setBusqueda('')} className="absolute right-2 text-slate-400 hover:text-slate-700 cursor-pointer"><X size={13} /></button>
            )}
          </div>
        </div>
        <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
          <input type="checkbox" checked={soloMora} onChange={e => setSoloMora(e.target.checked)} className="accent-emerald-600" />
          Solo en mora
        </label>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-bold text-slate-500 ml-auto">
          {(Object.keys(CELDA) as EstadoMes[]).map(k => (
            <span key={k} className="inline-flex items-center gap-1"><span className={`w-3 h-3 rounded-sm ${CELDA[k].clase.split(' ')[0]}`} />{CELDA[k].titulo}</span>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              <th className="px-3 py-3 text-left w-14">N°</th>
              <th className="px-3 py-3 text-left">Afiliado</th>
              {MESES.map(m => <th key={m} className="px-1 py-3 text-center w-9">{m}</th>)}
              <th className="px-3 py-3 text-right">Deuda</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filas.length === 0 && <tr><td colSpan={15} className="p-6 text-center text-slate-400 font-medium">Sin afiliados para mostrar.</td></tr>}
            {filas.map(a => (
              <Fragment key={a.id_afiliado}>
                <tr onClick={() => setAbierto(abierto === a.id_afiliado ? null : a.id_afiliado)} className="hover:bg-slate-50 cursor-pointer">
                  <td className="px-3 py-2 text-xs font-bold text-slate-400 tabular-nums">{a.codigo}</td>
                  <td className="px-3 py-2 font-bold text-slate-800 truncate max-w-[260px]" title={a.nombre}>{formatNombreCard(a.nombres, a.apellidos) || a.razon_social || a.nombre}</td>
                  {a.celdas.map((c, i) => (
                    <td key={i} className="px-1 py-2 text-center">
                      {c ? (
                        <span title={`${MESES[i]} ${anio}: ${CELDA[c].titulo}`} className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-[11px] font-black ${CELDA[c].clase}`}>{CELDA[c].marca}</span>
                      ) : <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-200" />}
                    </td>
                  ))}
                  <td className={`px-3 py-2 text-right text-xs font-bold tabular-nums ${a.solvente ? 'text-emerald-600' : 'text-red-600'}`}>
                    {a.solvente ? 'Solvente' : `$${a.deuda_usd.toFixed(2)}`}
                  </td>
                </tr>
                {abierto === a.id_afiliado && (
                  <tr><td colSpan={15} className="bg-slate-50/60 px-6 py-4"><LineaTiempoSolvencia idAfiliado={a.id_afiliado} /></td></tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500 font-medium">
        Mensualidad de ${data.monto_mensual.toFixed(2)} USD. El mes en curso no cuenta como deuda hasta que termina. Los afiliados sin historial importado deben desde el mes indicado arriba.
      </p>
    </div>
  )
}
