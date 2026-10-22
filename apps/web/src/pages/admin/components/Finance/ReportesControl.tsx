import { useCallback, useEffect, useState } from 'react'
import { FileDown, FileSpreadsheet, Loader2, Send } from 'lucide-react'
import Swal from 'sweetalert2'
import { toast } from 'sonner'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { dibujarEncabezadoPdf } from '@/utils/pdfEncabezado'
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
    // El enlace debe estar en el documento y el archivo no se libera de inmediato: si no, algunos navegadores cancelan la descarga
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 30_000)
    toast.success('Excel descargado')
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

const BotonPdf = ({ onClick }: { onClick: () => void }) => (
  <button type="button" onClick={onClick}
    className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors flex items-center gap-1.5 shadow-sm">
    <FileDown size={13} className="text-emerald-600" aria-hidden="true" /> PDF
  </button>
)

// ─────────────────────────────────────────────────────────────────────────────

interface MatrizConceptos {
  anio: number
  conceptos: { concepto: string; etiqueta: string; meses: number[]; total: number }[]
  totalesMes: number[]
  total: number
}

/** PDF apaisado de una matriz concepto × mes, con el encabezado de los demás reportes */
async function exportarMatrizPdf(titulo: string, data: MatrizConceptos) {
  try {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' })
    await dibujarEncabezadoPdf(doc, titulo.toUpperCase(), `Año ${data.anio}`)
    const monto = (v: number) => (v ? v.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—')
    autoTable(doc, {
      head: [['Concepto', ...MESES, 'Total ($)']],
      body: data.conceptos.map(c => [c.etiqueta, ...c.meses.map(monto), monto(c.total)]),
      foot: [['Total', ...data.totalesMes.map(monto), monto(data.total)]],
      startY: 30,
      styles: { fontSize: 7, cellPadding: 1.5, halign: 'right' },
      columnStyles: { 0: { cellWidth: 38 } },
      // La primera columna (concepto) va a la izquierda también en el encabezado y el pie
      didParseCell: d => { if (d.column.index === 0) d.cell.styles.halign = 'left' },
      headStyles: { fillColor: [6, 78, 59], textColor: 255, fontStyle: 'bold' },
      footStyles: { fillColor: [240, 253, 244], textColor: [6, 78, 59], fontStyle: 'bold' },
      margin: { left: 14, right: 14 },
    })
    doc.save(`${titulo.replace(/\s+/g, '_')}_${data.anio}.pdf`)
  } catch {
    toast.error('No se pudo generar el PDF')
  }
}

/** Matriz año × concepto por mes: la comparten los ingresos y los egresos. */
function MatrizPorConcepto({ anio, ruta, titulo, colorTotal, vacio }: { anio: number; ruta: string; titulo: string; colorTotal: string; vacio: string }) {
  const { data, error, authHeaders } = useReporte<MatrizConceptos>(`${API_URL}/api/finanzas/${ruta}?anio=${anio}`)
  if (!data) return <Cargando error={error} />
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-bold text-slate-800 text-base">{titulo} · {data.anio} <span className={`${colorTotal} tabular-nums`}>{usd(data.total)}</span></h3>
        <div className="flex items-center gap-2">
          <BotonPdf onClick={() => exportarMatrizPdf(titulo, data)} />
          <BotonExcel onClick={() => descargarXlsx(ruta, { anio }, authHeaders)} />
        </div>
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
            {data.conceptos.length === 0 && <tr><td colSpan={14} className="p-6 text-center text-slate-400">{vacio}</td></tr>}
            {data.conceptos.map(c => (
              <tr key={c.concepto} className={c.total ? '' : 'text-slate-300'}>
                <td className="px-3 py-2 font-bold text-slate-700">{c.etiqueta}</td>
                {c.meses.map((v, i) => <td key={i} className="px-2 py-2 text-right">{v ? usd(v) : '—'}</td>)}
                <td className="px-3 py-2 text-right font-black">{usd(c.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50 font-black text-slate-900">
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

/** Ingresos verificados del año por concepto y mes. */
export const IngresosPorConcepto = ({ anio }: { anio: number }) => (
  <MatrizPorConcepto anio={anio} ruta="ingresos-por-concepto" titulo="Ingresos por concepto" colorTotal="text-emerald-700" vacio="Sin ingresos registrados este año." />
)

/** Egresos del año por categoría y mes. */
export const EgresosPorConcepto = ({ anio }: { anio: number }) => (
  <MatrizPorConcepto anio={anio} ruta="egresos-por-concepto" titulo="Egresos por concepto" colorTotal="text-amber-700" vacio="Sin egresos registrados este año." />
)

// ─────────────────────────────────────────────────────────────────────────────

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
