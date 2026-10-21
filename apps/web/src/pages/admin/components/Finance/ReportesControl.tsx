import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, FileSpreadsheet, Loader2, Lock, Send } from 'lucide-react'
import Swal from 'sweetalert2'
import { API_URL } from '@/config/env'
import { useAuth } from '@/context/AuthContext'

const usd = (n: number) => `$${n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const hoyCaracas = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Caracas' })

/** Descarga un reporte .xlsx generado por la API con los mismos filtros que la vista. */
export async function descargarXlsx(reporte: string, params: Record<string, string | number | undefined | null>, headers: Record<string, string>) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => [k, String(v)]))
  try {
    const res = await fetch(`${API_URL}/api/finanzas/export/${reporte}.xlsx?${qs}`, { headers })
    if (!res.ok) throw new Error((await res.json().catch(() => null))?.message || 'No se pudo generar el Excel')
    const url = URL.createObjectURL(await res.blob())
    const a = Object.assign(document.createElement('a'), { href: url, download: `${reporte}-${hoyCaracas()}.xlsx` })
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    Swal.fire('Error', e instanceof Error ? e.message : 'No se pudo generar el Excel', 'error')
  }
}

function useReporte<T>(url: string | null) {
  const { authHeaders } = useAuth()
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const recargar = useCallback(async () => {
    if (!url) return
    setError(null)
    try {
      const r = await fetch(url, { headers: authHeaders })
      const j = await r.json()
      if (!r.ok || !j.success) throw new Error(j.message || 'Error al cargar el reporte')
      setData(j.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar el reporte')
    }
  }, [url, authHeaders])
  useEffect(() => { recargar() }, [recargar])
  return { data, error, recargar, authHeaders }
}

const Cargando = ({ error }: { error: string | null }) =>
  error ? <p role="alert" className="p-6 text-sm text-red-600">{error}</p> : <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-300" aria-label="Cargando" /></div>

const BotonExcel = ({ onClick }: { onClick: () => void }) => (
  <button type="button" onClick={onClick}
    className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors flex items-center gap-1.5 shadow-sm">
    <FileSpreadsheet size={13} className="text-emerald-600" aria-hidden="true" /> Excel
  </button>
)

// ─────────────────────────────────────────────────────────────────────────────

interface Ingresos {
  anio: number
  conceptos: { concepto: string; etiqueta: string; meses: number[]; total: number }[]
  totalesMes: number[]
  total: number
}

/** Matriz de ingresos verificados del año por concepto y mes. */
export function IngresosPorConcepto({ anio }: { anio: number }) {
  const { data, error, authHeaders } = useReporte<Ingresos>(`${API_URL}/api/finanzas/ingresos-por-concepto?anio=${anio}`)
  if (!data) return <Cargando error={error} />
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-bold text-slate-800 text-base">Ingresos por concepto · {data.anio} <span className="text-emerald-700 tabular-nums">{usd(data.total)}</span></h3>
        <BotonExcel onClick={() => descargarXlsx('ingresos-por-concepto', { anio }, authHeaders)} />
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-xs tabular-nums">
          <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-3 py-3 text-left">Concepto</th>
              {MESES.map(m => <th key={m} className="px-2 py-3 text-right">{m}</th>)}
              <th className="px-3 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.conceptos.map(c => (
              <tr key={c.concepto} className={c.total ? '' : 'text-slate-300'}>
                <td className="px-3 py-2 font-bold text-slate-700">{c.etiqueta}</td>
                {c.meses.map((v, i) => <td key={i} className="px-2 py-2 text-right">{v ? usd(v) : '—'}</td>)}
                <td className="px-3 py-2 text-right font-black">{usd(c.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-emerald-50/60 font-black text-emerald-900">
            <tr>
              <td className="px-3 py-2">Total</td>
              {data.totalesMes.map((v, i) => <td key={i} className="px-2 py-2 text-right">{v ? usd(v) : '—'}</td>)}
              <td className="px-3 py-2 text-right">{usd(data.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

interface Totales {
  porMetodo: { metodo_pago: string; moneda: string; cantidad: number; monto: number; monto_usd: number }[]
  porCajero: { cajero: string; cantidad: number; monto_usd: number }[]
  totalUsd: number
  cantidad: number
}
interface Cierre extends Totales {
  fecha: string
  cierre: { cerrado_por: string | null; creado_en: string; observaciones: string | null; totales: Totales } | null
  cambiosTrasCierre: boolean
}

const METODOS: Record<string, string> = {
  efectivo_usd: 'Efectivo USD', efectivo_bs: 'Efectivo Bs', pago_movil: 'Pago Móvil', transferencia_bs: 'Transferencia Bs',
  zelle: 'Zelle', pos_debito: 'Punto de venta', binance_usdt: 'Binance USDT', otro: 'Otro',
}

/** Arqueo del día por método y cajero; se congela una vez con "Cerrar caja". */
export function CierreCaja() {
  const [fecha, setFecha] = useState(hoyCaracas())
  const { data, error, recargar, authHeaders } = useReporte<Cierre>(`${API_URL}/api/finanzas/cierre-caja?fecha=${fecha}`)
  const [cerrando, setCerrando] = useState(false)

  const cerrar = async () => {
    const r = await Swal.fire({
      title: `Cerrar caja del ${fecha}`, input: 'text', inputLabel: 'Observaciones (opcional)',
      text: 'Se guarda una foto de los totales. Cualquier cambio posterior en ese día quedará señalado.',
      showCancelButton: true, confirmButtonText: 'Cerrar caja', cancelButtonText: 'Cancelar', confirmButtonColor: '#059669',
    })
    if (!r.isConfirmed) return
    setCerrando(true)
    try {
      const res = await fetch(`${API_URL}/api/finanzas/cierre-caja`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ fecha, observaciones: r.value || null }),
      })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.message)
      await recargar()
    } catch (e) {
      Swal.fire('Error', e instanceof Error ? e.message : 'No se pudo cerrar la caja', 'error')
    } finally {
      setCerrando(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Día</span>
          <input type="date" value={fecha} max={hoyCaracas()} onChange={e => e.target.value && setFecha(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </label>
        {data && !data.cierre && (
          <button type="button" onClick={cerrar} disabled={cerrando}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider disabled:opacity-50">
            <Lock size={13} aria-hidden="true" /> {cerrando ? 'Cerrando…' : 'Cerrar caja'}
          </button>
        )}
      </div>

      {!data ? <Cargando error={error} /> : (
        <>
          {data.cierre && (
            <div role="status" className={`p-4 rounded-2xl border text-xs ${data.cambiosTrasCierre ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-emerald-50 border-emerald-200 text-emerald-900'}`}>
              <p className="font-bold flex items-center gap-1.5">
                {data.cambiosTrasCierre ? <AlertTriangle size={14} aria-hidden="true" /> : <Lock size={14} aria-hidden="true" />}
                Caja cerrada por {data.cierre.cerrado_por ?? '—'} el {new Date(data.cierre.creado_en).toLocaleString('es-VE', { timeZone: 'America/Caracas' })} con {usd(data.cierre.totales.totalUsd)} ({data.cierre.totales.cantidad} cobros).
              </p>
              {data.cambiosTrasCierre && <p className="mt-1">Hubo cambios después del cierre: ahora el día suma {usd(data.totalUsd)} ({data.cantidad} cobros). Revisa anulaciones o cobros registrados con esta fecha.</p>}
              {data.cierre.observaciones && <p className="mt-1 opacity-80">Observaciones: {data.cierre.observaciones}</p>}
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
              <table className="w-full text-xs tabular-nums">
                <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500">
                  <tr><th className="px-3 py-3 text-left">Método</th><th className="px-3 py-3 text-right">Cobros</th><th className="px-3 py-3 text-right">Monto</th><th className="px-3 py-3 text-right">USD</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.porMetodo.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-slate-400">Sin cobros este día.</td></tr>}
                  {data.porMetodo.map(m => (
                    <tr key={`${m.metodo_pago}-${m.moneda}`}>
                      <td className="px-3 py-2 font-bold text-slate-700">{METODOS[m.metodo_pago] ?? m.metodo_pago}</td>
                      <td className="px-3 py-2 text-right">{m.cantidad}</td>
                      <td className="px-3 py-2 text-right">{m.moneda === 'VES' ? `Bs. ${m.monto.toLocaleString('es-VE', { minimumFractionDigits: 2 })}` : usd(m.monto)}</td>
                      <td className="px-3 py-2 text-right font-bold">{usd(m.monto_usd)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-emerald-50/60 font-black text-emerald-900">
                  <tr><td className="px-3 py-2">Total</td><td className="px-3 py-2 text-right">{data.cantidad}</td><td /><td className="px-3 py-2 text-right">{usd(data.totalUsd)}</td></tr>
                </tfoot>
              </table>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
              <table className="w-full text-xs tabular-nums">
                <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500">
                  <tr><th className="px-3 py-3 text-left">Cajero</th><th className="px-3 py-3 text-right">Cobros</th><th className="px-3 py-3 text-right">USD</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.porCajero.map(c => (
                    <tr key={c.cajero}><td className="px-3 py-2 font-bold text-slate-700 break-all">{c.cajero}</td><td className="px-3 py-2 text-right">{c.cantidad}</td><td className="px-3 py-2 text-right font-bold">{usd(c.monto_usd)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

interface PorCobrar {
  filas: { tipo: 'mensualidad' | 'curso'; id_afiliado: number | null; id_inscripcion: number | null; codigo: string | null; nombre: string; identificacion: string; email: string; detalle: string; monto_usd: number; dias: number; tramo: string }[]
  tramos: { tramo: string; cantidad: number; monto_usd: number }[]
  total_usd: number
}

/** Mensualidades vencidas y cursos sin pagar, por antigüedad, con recordatorio a morosos. */
export function CuentasPorCobrar() {
  const { data, error, authHeaders } = useReporte<PorCobrar>(`${API_URL}/api/finanzas/cuentas-por-cobrar`)
  const [tramo, setTramo] = useState<string | null>(null)

  const recordar = async (idAfiliado: number) => {
    try {
      const res = await fetch(`${API_URL}/api/pagos/admin/solvencia/recordatorio`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders }, body: JSON.stringify({ id_afiliado: idAfiliado }),
      })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.message)
      Swal.fire('Listo', j.data.registrados ? 'Recordatorio enviado.' : 'Ya se le envió un recordatorio hoy.', 'success')
    } catch (e) {
      Swal.fire('Error', e instanceof Error ? e.message : 'No se pudo enviar', 'error')
    }
  }

  if (!data) return <Cargando error={error} />
  const filas = tramo ? data.filas.filter(f => f.tramo === tramo) : data.filas
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-bold text-slate-800 text-base">Cuentas por cobrar <span className="text-red-700 tabular-nums">{usd(data.total_usd)}</span></h3>
        <BotonExcel onClick={() => descargarXlsx('cuentas-por-cobrar', {}, authHeaders)} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {data.tramos.map(t => (
          <button key={t.tramo} type="button" aria-pressed={tramo === t.tramo} onClick={() => setTramo(tramo === t.tramo ? null : t.tramo)}
            className={`text-left p-3 rounded-2xl border transition-colors ${tramo === t.tramo ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">{t.tramo} días</span>
            <span className="text-lg font-black tabular-nums text-slate-900">{usd(t.monto_usd)}</span>
            <span className="text-[11px] text-slate-500 block">{t.cantidad} {t.cantidad === 1 ? 'cuenta' : 'cuentas'}</span>
          </button>
        ))}
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500">
            <tr><th className="px-3 py-3 text-left">Persona</th><th className="px-3 py-3 text-left">Detalle</th><th className="px-3 py-3 text-right">Monto</th><th className="px-3 py-3 text-right">Días</th><th className="px-3 py-3" /></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filas.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-slate-400">No hay cuentas por cobrar.</td></tr>}
            {filas.map(f => (
              <tr key={`${f.tipo}-${f.id_afiliado ?? f.id_inscripcion}`}>
                <td className="px-3 py-2">
                  <p className="font-bold text-slate-800">{f.codigo ? `${f.codigo} · ` : ''}{f.nombre}</p>
                  <p className="text-[11px] text-slate-500">{f.identificacion} · {f.email}</p>
                </td>
                <td className="px-3 py-2 text-slate-600">{f.detalle}</td>
                <td className="px-3 py-2 text-right font-bold tabular-nums">{usd(f.monto_usd)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{f.dias}</td>
                <td className="px-3 py-2 text-right">
                  {f.id_afiliado && (
                    <button type="button" onClick={() => recordar(f.id_afiliado!)} aria-label={`Enviar recordatorio a ${f.nombre}`}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider text-red-700 bg-red-50 hover:bg-red-100">
                      <Send size={11} aria-hidden="true" /> Recordar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
