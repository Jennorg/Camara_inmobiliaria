import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, Loader2, Search, X } from 'lucide-react'
import Swal from 'sweetalert2'
import { useAuth } from '@/context/AuthContext'
import { API_URL } from '@/config/env'
import { apiFetch } from '@/lib/apiClient'
import { cleanSearchDigits, normalizeSearchText } from '@/utils/searchUtils'
import { formatNombreCard } from '@/utils/formatters'
import { accionDelMes, corregirMesSolvencia, type MesCorregible } from '@/utils/correccionesSolvencia'

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
  bloqueado: boolean
  celdas: (EstadoMes | null)[]
}

interface ConfigCobranza {
  diaVencimiento: number
  diasAvisoPrevio: number
  frecuenciaMoraDias: number
  mesesGracia: number
}

const CAMPOS_COBRANZA: { key: keyof ConfigCobranza; label: string; min: number; max: number }[] = [
  { key: 'diaVencimiento', label: 'Día de vencimiento', min: 1, max: 28 },
  { key: 'diasAvisoPrevio', label: 'Aviso previo (días antes)', min: 0, max: 20 },
  { key: 'frecuenciaMoraDias', label: 'Repetir aviso de mora cada (días)', min: 1, max: 60 },
  { key: 'mesesGracia', label: 'Meses de gracia antes de bloquear', min: 0, max: 24 },
]

interface Resumen {
  inicio: string
  cobranza: ConfigCobranza
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
  const { authHeaders, token, isSuperAdmin } = useAuth()
  const [anio, setAnio] = useState(new Date().getFullYear())
  const [data, setData] = useState<Resumen | null>(null)
  const [inicio, setInicio] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [criterio, setCriterio] = useState<CriterioBusqueda>('nombre')
  const [menuCriterio, setMenuCriterio] = useState(false)
  const [soloMora, setSoloMora] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [cobranza, setCobranza] = useState<ConfigCobranza | null>(null)

  const cargar = useCallback(async () => {
    try {
      const r = await apiFetch<{ data: Resumen }>(`${API_URL}/api/pagos/admin/solvencia?anio=${anio}`, { headers: authHeaders })
      setData(r.data)
      setInicio(r.data.inicio)
      setCobranza(r.data.cobranza)
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

  /** Superadmin: clic en el mes de un afiliado para anular su pago, marcarlo o quitarle la marca */
  const corregirCelda = async (idAfiliado: number, mesIndex: number) => {
    const periodo = `${anio}-${String(mesIndex + 1).padStart(2, '0')}`
    try {
      const r = await apiFetch<{ data: { meses: MesCorregible[] } }>(`${API_URL}/api/pagos/solvencia/afiliado/${idAfiliado}`, { headers: authHeaders })
      const mes = r.data.meses.find(m => m.periodo === periodo)
      if (!mes || !accionDelMes(mes)) {
        Swal.fire('Sin cambios posibles', 'Este mes no tiene nada que corregir.', 'info')
        return
      }
      if (await corregirMesSolvencia(idAfiliado, mes, token)) await cargar()
    } catch (e: any) {
      Swal.fire('Error', e.message, 'error')
    }
  }

  const enviarRecordatorio = async (idAfiliado?: number) => {
    const ok = await Swal.fire({
      title: idAfiliado ? 'Enviar recordatorio' : 'Recordatorio a todos los morosos',
      text: 'Se envía por correo y en la campana del panel. Cada afiliado recibe como máximo uno por día.',
      icon: 'question', showCancelButton: true, confirmButtonText: 'Enviar', cancelButtonText: 'Cancelar', confirmButtonColor: '#059669',
    })
    if (!ok.isConfirmed) return
    try {
      const r = await apiFetch<{ data: { morosos: number; registrados: number; emails: number } }>(`${API_URL}/api/pagos/admin/solvencia/recordatorio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(idAfiliado ? { id_afiliado: idAfiliado } : {}),
      })
      const { morosos, registrados, emails } = r.data
      Swal.fire('Listo', registrados ? `Recordatorio enviado a ${registrados} de ${morosos} (${emails} correos).` : 'Ya se les envió un recordatorio hoy.', 'success')
    } catch (e: any) {
      Swal.fire('Error', e.message, 'error')
    }
  }

  const guardarConfig = async (cambios: { inicio?: string; cobranza?: ConfigCobranza }) => {
    setGuardando(true)
    try {
      await apiFetch(`${API_URL}/api/pagos/admin/solvencia/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(cambios),
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
          <button type="button" onClick={() => guardarConfig({ inicio })} disabled={guardando || !inicio || inicio === data.inicio}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider disabled:opacity-40 disabled:pointer-events-none cursor-pointer">
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>

      {cobranza && (
        <details className="rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3">
          <summary className="cursor-pointer text-xs font-black uppercase tracking-wider text-slate-600">
            Calendario de cobranza · vence el día {data.cobranza.diaVencimiento} · bloqueo tras {data.cobranza.mesesGracia} meses de deuda
          </summary>
          <form
            className="mt-3 flex flex-wrap items-end gap-3"
            onSubmit={e => { e.preventDefault(); guardarConfig({ cobranza }) }}
          >
            {CAMPOS_COBRANZA.map(c => (
              <label key={c.key} className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">{c.label}</span>
                <input
                  type="number" inputMode="numeric" min={c.min} max={c.max} step={1} required
                  value={cobranza[c.key]}
                  onChange={e => setCobranza({ ...cobranza, [c.key]: e.currentTarget.valueAsNumber })}
                  className="w-28 px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </label>
            ))}
            <button type="submit" disabled={guardando}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider disabled:opacity-40 cursor-pointer">
              {guardando ? 'Guardando…' : 'Guardar calendario'}
            </button>
          </form>
        </details>
      )}

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
        <button type="button" onClick={() => enviarRecordatorio()} disabled={enMora.length === 0}
          className="px-3 py-2 rounded-xl border border-red-200 bg-red-50 text-red-700 text-[11px] font-black uppercase tracking-wider hover:bg-red-100 disabled:opacity-40 cursor-pointer">
          Recordar a morosos
        </button>
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
              <tr key={a.id_afiliado} className="hover:bg-slate-50">
                  <td className="px-3 py-2 text-xs font-bold text-slate-400 tabular-nums">{a.codigo}</td>
                  <td className="px-3 py-2 font-bold text-slate-800 truncate max-w-[260px]" title={a.nombre}>{formatNombreCard(a.nombres, a.apellidos) || a.razon_social || a.nombre}</td>
                  {a.celdas.map((c, i) => (
                    <td key={i} className="px-1 py-2 text-center">
                      {c ? (
                        isSuperAdmin ? (
                          <button type="button" onClick={e => { e.stopPropagation(); corregirCelda(a.id_afiliado, i) }}
                            title={`${MESES[i]} ${anio}: ${CELDA[c].titulo} · clic para corregir`}
                            aria-label={`${MESES[i]} ${anio}: ${CELDA[c].titulo}. Corregir`}
                            className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-[11px] font-black cursor-pointer hover:ring-2 hover:ring-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-600 ${CELDA[c].clase}`}>{CELDA[c].marca}</button>
                        ) : (
                          <span title={`${MESES[i]} ${anio}: ${CELDA[c].titulo}`} className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-[11px] font-black ${CELDA[c].clase}`}>{CELDA[c].marca}</span>
                        )
                      ) : <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-200" />}
                    </td>
                  ))}
                  <td className={`px-3 py-2 text-right text-xs font-bold tabular-nums ${a.solvente ? 'text-emerald-600' : 'text-red-600'}`}>
                    {a.solvente ? 'Solvente' : `$${a.deuda_usd.toFixed(2)}`}
                    {a.bloqueado && <span className="block text-[9px] font-black uppercase tracking-wider text-red-700">Bloqueado</span>}
                  </td>
                </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isSuperAdmin && (
        <p className="text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
          Como superadmin puedes corregir cualquier mes: haz clic en su casilla para anular el pago, marcarlo como pagado o quitar la marca.
        </p>
      )}

      <p className="text-xs text-slate-500 font-medium">
        Mensualidad de ${data.monto_mensual.toFixed(2)} USD. El mes en curso cuenta como deuda a partir del día {data.cobranza.diaVencimiento + 1}. Con más de {data.cobranza.mesesGracia} meses de deuda se bloquean el carnet, la constancia de solvencia y los certificados. Los afiliados sin historial importado deben desde el mes indicado arriba.
      </p>
    </div>
  )
}
