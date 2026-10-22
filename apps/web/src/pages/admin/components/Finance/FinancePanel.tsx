import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { 
  Landmark, 
  DollarSign, 
  Plus, 
  Download, 
  FileSpreadsheet, 
  Search, 
  Calendar, 
  Receipt, 
  Banknote,
  ArrowUpRight, 
  ArrowDownRight, 
  AlertCircle, 
  CheckCircle, 
  ExternalLink, 
  FileText, 
  TrendingUp, 
  TrendingDown, 
  CalendarClock,
  Building2, 
  RefreshCw, 
  Filter, 
  X,
  CreditCard,
  Ban
} from 'lucide-react'
import SolvenciaPanel from './SolvenciaPanel'
import { API_URL } from '@/config/env'
import { useAuth } from '@/context/AuthContext'
import { toast } from 'sonner'
import Swal from 'sweetalert2'
import ModalGestionCuentasBancarias from '@/pages/admin/components/Finance/ModalGestionCuentasBancarias'
import ModalGestionAranceles from '@/pages/admin/components/Finance/ModalGestionAranceles'
import ModalRegistrarGasto from '@/pages/admin/components/Finance/ModalRegistrarGasto'
import { Skeleton } from '@/components/Skeleton'
import Paginacion, { type PaginacionDTO } from '@/pages/admin/components/Finance/Paginacion'
import ModalRegistrarCobro from '@/pages/admin/components/Finance/ModalRegistrarCobro'
import ReferenciasTasasPanel from '@/pages/admin/components/Finance/ReferenciasTasasPanel'
import ReciboDigitalModal from '@/components/ReciboDigitalModal'
import { CuentasPorCobrar, EgresosPorConcepto, IngresosPorConcepto, descargarXlsx } from './ReportesControl'
import ModalReporte from '@/pages/admin/components/Finance/ModalReporte'
import type { PagoDTO } from '@/types/pagos'
import { BinanceIcon } from '@/components/icons/BinanceIcon'
import type { 
  ResumenFinancieroDTO, 
  LibroVentaItemDTO, 
  LibroCompraItemDTO, 
  TxCategory, 
  TxStatus 
} from '@/types/finanzas'

type FinanceTab = 'dashboard' | 'libro_venta' | 'libro_compra' | 'tasas_referencias' | 'solvencia' | 'cuentas_cobrar'

/** Conceptos del libro de ventas (los mismos que agrupa la API) */
const CONCEPTOS_VENTA: Record<string, string> = { mensualidad: 'Mensualidades', afiliacion: 'Afiliación', cibir: 'CIBIR', preani: 'PREANI', pegi: 'PEGI', padi: 'PADI', curso: 'Cursos', otros: 'Otros' }

/** Tope "redondo" del eje Y (1, 2, 2.5, 5 o 10 por una potencia de diez) para que los cuatro tramos queden en números limpios */
function escalaMaxima(max: number): number {
  if (max <= 0) return 100
  const potencia = 10 ** Math.floor(Math.log10(max))
  return [1, 2, 2.5, 5, 10].map(f => f * potencia).find(v => v >= max) ?? max
}

/** Monto compacto para los ejes: 950, 1,2k, 15k */
function montoCorto(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(v % 1000 === 0 || v >= 10000 ? 0 : 1).replace('.', ',')}k`
  return String(Math.round(v))
}

/** Filas por página de los libros */
const LIMITE_LIBRO = 50

const COLORES_CONCEPTO: Record<string, string> = {
  mensualidad: '#059669', afiliacion: '#0D9488', cibir: '#2563EB', preani: '#7C3AED', pegi: '#D97706', padi: '#DB2777', curso: '#65A30D', otros: '#6B7280',
}

const CATEGORIAS: Record<string, { label: string; color: string }> = {
  afiliacion:           { label: 'Afiliación',                  color: '#059669' },
  curso:                { label: 'Curso/Taller',                 color: '#0D9488' },
  convenio:             { label: 'Convenio',                     color: '#047857' },
  servicio:             { label: 'Servicio Gremial',             color: '#65A30D' },
  alquiler:             { label: 'Alquiler Sede',                color: '#D97706' },
  servicios_publicos:   { label: 'Servicios Públicos/Internet',  color: '#EA580C' },
  nomina:               { label: 'Nómina Administrativa',        color: '#DC2626' },
  honorarios:           { label: 'Honorarios Profesionales',     color: '#7C3AED' },
  papeleria:            { label: 'Papelería y Suministros',      color: '#4F46E5' },
  mantenimiento:        { label: 'Mantenimiento',                color: '#2563EB' },
  impuestos:            { label: 'Impuestos / Tasas',            color: '#B91C1C' },
  gasto_operativo:      { label: 'Gasto Operativo',              color: '#A16207' },
  gasto_admin:          { label: 'Gasto Admin.',                 color: '#78716C' },
  donacion:             { label: 'Donación',                     color: '#1D4ED8' },
  otro:                 { label: 'Otro',                         color: '#6B7280' },
}

const MESES = [
  { num: 1, label: 'Enero' },
  { num: 2, label: 'Febrero' },
  { num: 3, label: 'Marzo' },
  { num: 4, label: 'Abril' },
  { num: 5, label: 'Mayo' },
  { num: 6, label: 'Junio' },
  { num: 7, label: 'Julio' },
  { num: 8, label: 'Agosto' },
  { num: 9, label: 'Septiembre' },
  { num: 10, label: 'Octubre' },
  { num: 11, label: 'Noviembre' },
  { num: 12, label: 'Diciembre' },
]

const fmt = (n: number) => `$${Number(n || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtBs = (n: number) => `Bs. ${Number(n || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtDate = (s: string) => {
  if (!s) return '-'
  const [y, m, d] = s.split('-')
  if (!d) return s
  return `${d}/${m}/${y}`
}

export default function FinancePanel() {
  const { authHeaders, isSuperAdmin } = useAuth()

  const [tab, setTab] = useState<FinanceTab>('dashboard')
  const [loading, setLoading] = useState(false)
  const [loadingResumen, setLoadingResumen] = useState(true)

  // Filtros de periodo
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState<number | null>(new Date().getMonth() + 1)
  const [vistaDistribucion, setVistaDistribucion] = useState<'ingresos' | 'gastos'>('ingresos')
  const [searchQuery, setSearchQuery] = useState('')
  const [filtroConcepto, setFiltroConcepto] = useState('')
  const [filtroMetodo, setFiltroMetodo] = useState('')

  // Datos
  const [resumen, setResumen] = useState<ResumenFinancieroDTO | null>(null)
  const [libroVentas, setLibroVentas] = useState<LibroVentaItemDTO[]>([])
  const [totalesVentas, setTotalesVentas] = useState<any>(null)
  const [libroCompras, setLibroCompras] = useState<LibroCompraItemDTO[]>([])
  const [loadingVentas, setLoadingVentas] = useState(true)
  const [loadingCompras, setLoadingCompras] = useState(true)
  const [paginacionVentas, setPaginacionVentas] = useState<PaginacionDTO | null>(null)
  const [paginacionCompras, setPaginacionCompras] = useState<PaginacionDTO | null>(null)
  // La página se guarda junto con los filtros con que se eligió: si cambian, se vuelve a la primera sin otra petición
  const [pagVentas, setPagVentas] = useState({ clave: '', pagina: 1 })
  const [pagCompras, setPagCompras] = useState({ clave: '', pagina: 1 })
  const claveVentas = `${selectedYear}|${selectedMonth}|${searchQuery}|${filtroConcepto}|${filtroMetodo}`
  const claveCompras = `${selectedYear}|${selectedMonth}|${searchQuery}`
  const paginaVentas = pagVentas.clave === claveVentas ? pagVentas.pagina : 1
  const paginaCompras = pagCompras.clave === claveCompras ? pagCompras.pagina : 1
  const [totalesCompras, setTotalesCompras] = useState<any>(null)

  // Modales
  const [modalGastoOpen, setModalGastoOpen] = useState(false)
  const [modalCobroOpen, setModalCobroOpen] = useState(false)
  const [modalIngresosOpen, setModalIngresosOpen] = useState(false)
  const [modalEgresosOpen, setModalEgresosOpen] = useState(false)
  const [modalCuentasOpen, setModalCuentasOpen] = useState(false)
  const [modalArancelesOpen, setModalArancelesOpen] = useState(false)
  
  // Visor de Recibo Digital
  const [reciboPago, setReciboPago] = useState<PagoDTO | null>(null)

  const abrirRecibo = async (idPago: number | string) => {
    try {
      const res = await fetch(`${API_URL}/api/pagos/recibo/${idPago}`, { headers: authHeaders })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'No se pudo cargar el recibo')
      setReciboPago(json.data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo cargar el recibo')
    }
  }

  // Cotizaciones para Ticker de Referencia
  const [tasasTicker, setTasasTicker] = useState<{ bcv: number; usdt: number } | null>(null)

  const fetchTasasTicker = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/finanzas/referencias`, { headers: authHeaders })
      const json = await res.json()
      if (json.success && json.data?.tasas) {
        setTasasTicker({
          bcv: json.data.tasas.USD_BCV?.tasa || 0,
          usdt: json.data.tasas.USDT_BINANCE?.tasa || 0
        })
      }
    } catch {
      // Ignorar error no crítico de ticker
    }
  }, [authHeaders])

  // Cargar Resumen Financiero
  // El servidor devuelve el año completo con el detalle de cada mes, así que el mes elegido se resuelve en el cliente
  // (cambiar de mes es instantáneo). Lo ya visto de un año se muestra al momento y se revalida en segundo plano.
  const resumenPorAnio = useRef(new Map<number, ResumenFinancieroDTO>())
  const fetchResumen = useCallback(async () => {
    const guardado = resumenPorAnio.current.get(selectedYear)
    if (guardado) setResumen(guardado)
    else setLoadingResumen(true)
    try {
      const res = await fetch(`${API_URL}/api/finanzas/resumen?anio=${selectedYear}`, {
        headers: authHeaders
      })
      if (!res.ok) throw new Error('Error al cargar resumen')
      const json = await res.json()
      resumenPorAnio.current.set(selectedYear, json.data)
      setResumen(json.data)
    } catch (err: any) {
      console.error(err)
    } finally {
      setLoadingResumen(false)
    }
  }, [selectedYear, authHeaders])

  // Cifras del mes elegido (o del año completo si no hay mes)
  const vista = useMemo(
    () => (resumen ? (selectedMonth ? resumen.meses[selectedMonth - 1] : resumen.anual) : null),
    [resumen, selectedMonth],
  )

  // Cargar Libro de Ventas
  const fetchLibroVentas = useCallback(async () => {
    setLoadingVentas(true)
    try {
      const params = new URLSearchParams()
      params.append('anio', String(selectedYear))
      if (selectedMonth) params.append('mes', String(selectedMonth))
      if (searchQuery) params.append('search', searchQuery)
      if (filtroConcepto) params.append('concepto', filtroConcepto)
      if (filtroMetodo) params.append('metodo', filtroMetodo)
      params.append('pagina', String(paginaVentas))
      params.append('limite', String(LIMITE_LIBRO))

      const res = await fetch(`${API_URL}/api/finanzas/libro-ventas?${params.toString()}`, {
        headers: authHeaders
      })
      if (!res.ok) throw new Error('Error al cargar libro de ventas')
      const json = await res.json()
      setLibroVentas(json.data.items || [])
      setTotalesVentas(json.data.totales)
      setPaginacionVentas(json.data.paginacion ?? null)
    } catch (err: any) {
      console.error(err)
    } finally {
      setLoadingVentas(false)
    }
  }, [selectedYear, selectedMonth, searchQuery, filtroConcepto, filtroMetodo, paginaVentas, authHeaders])

  // Cargar Libro de Compras
  const fetchLibroCompras = useCallback(async () => {
    setLoadingCompras(true)
    try {
      const params = new URLSearchParams()
      params.append('anio', String(selectedYear))
      if (selectedMonth) params.append('mes', String(selectedMonth))
      if (searchQuery) params.append('search', searchQuery)
      params.append('pagina', String(paginaCompras))
      params.append('limite', String(LIMITE_LIBRO))

      const res = await fetch(`${API_URL}/api/finanzas/libro-compras?${params.toString()}`, {
        headers: authHeaders
      })
      if (!res.ok) throw new Error('Error al cargar libro de compras')
      const json = await res.json()
      setLibroCompras(json.data.items || [])
      setTotalesCompras(json.data.totales)
      setPaginacionCompras(json.data.paginacion ?? null)
    } catch (err: any) {
      console.error(err)
    } finally {
      setLoadingCompras(false)
    }
  }, [selectedYear, selectedMonth, searchQuery, paginaCompras, authHeaders])

  // Cargar todo
  const refreshData = useCallback(async () => {
    setLoading(true)
    await Promise.all([fetchResumen(), fetchLibroVentas(), fetchLibroCompras(), fetchTasasTicker()])
    setLoading(false)
  }, [fetchResumen, fetchLibroVentas, fetchLibroCompras, fetchTasasTicker])

  // Cada bloque se carga por separado: el dashboard no espera a los libros (el de ventas trae cientos de filas)
  // y buscar o filtrar en un libro no vuelve a calcular el resumen.
  useEffect(() => { fetchResumen() }, [fetchResumen])
  useEffect(() => { fetchTasasTicker() }, [fetchTasasTicker])
  useEffect(() => { if (tab === 'libro_venta') fetchLibroVentas() }, [tab, fetchLibroVentas])
  useEffect(() => { if (tab === 'libro_compra') fetchLibroCompras() }, [tab, fetchLibroCompras])

  // Anular un pago del libro de ventas (solo superadmin)
  const handleAnularPago = async (idPago: number, recibo: string) => {
    const r = await Swal.fire({
      title: `Anular pago ${recibo}`,
      text: 'Deja de contar en los libros, el dashboard y la solvencia. No revierte efectos ya aplicados (afiliación, inscripción a un curso).',
      input: 'text', inputLabel: 'Motivo de la anulación', inputValidator: v => (v.trim().length < 3 ? 'Indica el motivo' : null),
      icon: 'warning', showCancelButton: true, confirmButtonText: 'Anular pago', cancelButtonText: 'Cancelar', confirmButtonColor: '#dc2626',
    })
    if (!r.isConfirmed) return
    try {
      const res = await fetch(`${API_URL}/api/pagos/admin/${idPago}/anular`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ motivo: String(r.value).trim() }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'No se pudo anular')
      toast.success('Pago anulado')
      resumenPorAnio.current.delete(selectedYear)
      refreshData()
    } catch (err: any) {
      toast.error(err.message || 'Error al anular el pago')
    }
  }

  // Anular gasto
  const handleAnularGasto = async (id: number) => {
    const { value: motivo } = await Swal.fire({
      title: '¿Anular movimiento contable?',
      input: 'text',
      inputLabel: 'Motivo de la anulación',
      inputPlaceholder: 'Ej: Factura anulada por el proveedor / Error de carga',
      showCancelButton: true,
      confirmButtonText: 'Anular Gasto',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc2626'
    })

    if (motivo !== undefined) {
      try {
        const res = await fetch(`${API_URL}/api/finanzas/movimientos/${id}/anular`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders
          },
          body: JSON.stringify({ motivo: motivo || 'Anulado por administración' })
        })
        if (!res.ok) throw new Error('Error al anular movimiento')
        toast.success('Movimiento anulado correctamente')
        refreshData()
      } catch (err: any) {
        toast.error(err.message || 'Error al anular')
      }
    }
  }

  // Exportar a PDF
  const handleExportPDF = async (tipo: 'ventas' | 'compras') => {
    // La tabla muestra una página; el PDF lleva todo el libro con los mismos filtros
    const params = new URLSearchParams({ anio: String(selectedYear) })
    if (selectedMonth) params.append('mes', String(selectedMonth))
    if (searchQuery) params.append('search', searchQuery)
    if (tipo === 'ventas') {
      if (filtroConcepto) params.append('concepto', filtroConcepto)
      if (filtroMetodo) params.append('metodo', filtroMetodo)
    }
    let completo: any[]
    try {
      const res = await fetch(`${API_URL}/api/finanzas/${tipo === 'ventas' ? 'libro-ventas' : 'libro-compras'}?${params.toString()}`, { headers: authHeaders })
      if (!res.ok) throw new Error()
      completo = (await res.json()).data.items
    } catch {
      toast.error('No se pudo preparar el PDF')
      return
    }
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' })
    const esVentas = tipo === 'ventas'
    const titulo = esVentas ? 'LIBRO DE VENTAS' : 'LIBRO DE COMPRAS'
    const mesNombre = selectedMonth ? MESES.find(m => m.num === selectedMonth)?.label : 'Todos'
    const periodoTexto = `Período: ${mesNombre} ${selectedYear}`

    // Encabezado
    doc.setFillColor(6, 78, 59)
    doc.rect(0, 0, 280, 24, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text(`CÁMARA INMOBILIARIA DEL ESTADO BOLÍVAR — ${titulo}`, 14, 12)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(`RIF: J-30456789-0 · ${periodoTexto} · Emitido: ${new Date().toLocaleDateString('es-VE')}`, 14, 18)

    if (esVentas) {
      const rows = (completo as LibroVentaItemDTO[]).map(item => [
        fmtDate(item.fecha),
        item.documento,
        item.cliente,
        item.rif_cedula || '-',
        item.concepto.slice(0, 32),
        item.metodo_pago,
        `$${item.monto_usd.toFixed(2)}`
      ])

      const total = totalesVentas?.totalVentasUSD || 0

      autoTable(doc, {
        head: [['Fecha', 'Nro. Recibo/Doc', 'Cliente / Afiliado', 'RIF/C.I.', 'Concepto', 'Método', 'Total ($)']],
        body: rows,
        startY: 30,
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: [6, 78, 59], textColor: 255, fontStyle: 'bold' },
        foot: [['', '', '', '', '', 'Totales:', `$${total.toFixed(2)}`]],
        footStyles: { fillColor: [240, 253, 244], textColor: [6, 78, 59], fontStyle: 'bold' },
        margin: { left: 14, right: 14 }
      })

      doc.save(`Libro_Ventas_${selectedYear}_${selectedMonth || 'Anual'}.pdf`)
    } else {
      const rows = (completo as LibroCompraItemDTO[]).map(item => [
        fmtDate(item.fecha),
        item.nro_factura_documento,
        item.proveedor,
        item.rif_cedula || '-',
        item.concepto.slice(0, 28),
        `$${item.monto_usd_equivalente.toFixed(2)}`
      ])

      const total = totalesCompras?.totalComprasUSD || 0

      autoTable(doc, {
        head: [['Fecha', 'Nro. Factura', 'Proveedor', 'RIF', 'Concepto', 'Total ($)']],
        body: rows,
        startY: 30,
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: [6, 78, 59], textColor: 255, fontStyle: 'bold' },
        foot: [['', '', '', '', '', 'Totales:', `$${total.toFixed(2)}`]],
        footStyles: { fillColor: [240, 253, 244], textColor: [6, 78, 59], fontStyle: 'bold' },
        margin: { left: 14, right: 14 }
      })

      doc.save(`Libro_Compras_${selectedYear}_${selectedMonth || 'Anual'}.pdf`)
    }
  }

  return (
    <div className="p-4 sm:p-6 w-full overflow-y-auto h-full space-y-6">
      {/* Header Superior */}
      <div className="flex items-start sm:items-center justify-between flex-wrap gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800">
              Contabilidad & Finanzas
            </span>
            <span className="text-xs text-slate-400">· Flujo de Caja & Libros Fiscales</span>
          </div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight mt-1">
            Centro de Control Financiero
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Libro de compras, libro de ventas y conciliación de ingresos por afiliaciones, cursos y gastos de sede.
          </p>
        </div>

        {/* Botones de Acción Global */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setModalCuentasOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors shadow-sm"
          >
            <Landmark size={14} className="text-emerald-600" />
            Cuentas Receptoras
          </button>
          <button
            onClick={() => setModalArancelesOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors shadow-sm"
          >
            <DollarSign size={14} className="text-emerald-600" />
            Aranceles
          </button>
          <button
            onClick={() => setModalCobroOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors shadow-sm"
          >
            <Banknote size={14} className="text-emerald-600" aria-hidden="true" />
            Registrar cobro
          </button>
          <button
            onClick={() => setModalGastoOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 transition-all shadow-sm shadow-emerald-600/20"
          >
            <Plus size={15} aria-hidden="true" />
            Registrar compra / gasto
          </button>
        </div>
      </div>

      {/* Barra de Filtro Temporal y Tabs */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-sm">
        {/* Tabs Principales */}
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 border border-slate-200/60">
          <button
            onClick={() => setTab('dashboard')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              tab === 'dashboard'
                ? 'bg-white text-emerald-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Dashboard & Flujo de Caja
          </button>
          <button
            onClick={() => setTab('libro_venta')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              tab === 'libro_venta'
                ? 'bg-white text-emerald-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <TrendingUp size={13} className="text-emerald-600" />
            Libro de Ventas{totalesVentas ? ` (${totalesVentas.cantidadRegistros})` : ''}
          </button>
          <button
            onClick={() => setTab('libro_compra')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              tab === 'libro_compra'
                ? 'bg-white text-emerald-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <TrendingDown size={13} className="text-amber-600" />
            Libro de Compras{totalesCompras ? ` (${totalesCompras.cantidadRegistros})` : ''}
          </button>
          <button
            onClick={() => setTab('solvencia')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              tab === 'solvencia'
                ? 'bg-white text-emerald-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <CalendarClock size={13} className="text-emerald-600" />
            Solvencia
          </button>
          {([
            ['cuentas_cobrar', 'Cuentas por cobrar', AlertCircle],
          ] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                tab === key ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon size={13} className="text-emerald-600" />
              {label}
            </button>
          ))}
          <button
            onClick={() => setTab('tasas_referencias')}
            data-testid="tab-tasas-referencias"
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              tab === 'tasas_referencias'
                ? 'bg-white text-emerald-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <DollarSign size={13} className="text-emerald-600" />
            Tasas
          </button>
        </div>

        {/* Cotizaciones Ticker Rápido */}
        {tasasTicker && tasasTicker.bcv > 0 && (
          <div 
            onClick={() => setTab('tasas_referencias')}
            data-testid="ticker-tasas-referencia"
            title="Ver conversor y cotizaciones en vivo"
            className="hidden md:flex items-center gap-2 px-3 py-1 bg-slate-50 border border-slate-200/80 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors text-[11px]"
          >
            <span className="font-bold text-slate-500">BCV:</span>
            <span className="font-mono font-black text-slate-800">Bs. {tasasTicker.bcv.toFixed(2)}</span>
            <span className="text-slate-300">|</span>
            <span className="font-bold text-[#b58b09]">USDT:</span>
            <span className="font-mono font-black text-slate-800">Bs. {tasasTicker.usdt.toFixed(2)}</span>
          </div>
        )}

        {/* Filtros de Año y Mes */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200">
            <Calendar size={14} className="text-slate-400" />
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
              className="text-xs font-bold text-slate-700 bg-transparent outline-none cursor-pointer"
            >
              {[2024, 2025, 2026, 2027].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200">
            <select
              value={selectedMonth === null ? '' : selectedMonth}
              onChange={e => setSelectedMonth(e.target.value === '' ? null : Number(e.target.value))}
              className="text-xs font-bold text-slate-700 bg-transparent outline-none cursor-pointer"
            >
              <option value="">Todo el Año</option>
              {MESES.map(m => (
                <option key={m.num} value={m.num}>{m.label}</option>
              ))}
            </select>
          </div>

          <button
            onClick={refreshData}
            title="Refrescar datos"
            className="p-2 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
          >
            <RefreshCw size={14} className={loading || loadingResumen ? 'animate-spin text-emerald-600' : ''} />
          </button>
        </div>
      </div>

      {/* ── TAB 1: DASHBOARD & FLUJO DE CAJA ── */}
      {tab === 'dashboard' && (
        <div className="space-y-6">
          {/* Tarjetas KPI */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Ingresos */}
            <div className="bg-white rounded-2xl border border-emerald-100 p-4 shadow-sm relative overflow-hidden flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Ingresos</span>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <ArrowUpRight size={18} />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black text-emerald-700 tabular-nums">
                  {fmt(vista?.kpis.totalIngresosUSD || 0)}
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {vista?.kpis.conteoIngresos || 0} operaciones registradas
                </p>
              </div>
            </div>

            {/* Egresos */}
            <div className="bg-white rounded-2xl border border-amber-100 p-4 shadow-sm relative overflow-hidden flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Egresos</span>
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <ArrowDownRight size={18} />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black text-slate-700 tabular-nums">
                  {fmt(vista?.kpis.totalEgresosUSD || 0)}
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {vista?.kpis.conteoEgresos || 0} gastos operativos
                </p>
              </div>
            </div>

            {/* Flujo Neto */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm relative overflow-hidden flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Flujo Neto / Superávit</span>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  (vista?.kpis.flujoNetoUSD || 0) >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                }`}>
                  <TrendingUp size={18} />
                </div>
              </div>
              <div className="mt-3">
                <span className={`text-2xl font-black tabular-nums ${
                  (vista?.kpis.flujoNetoUSD || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'
                }`}>
                  {fmt(vista?.kpis.flujoNetoUSD || 0)}
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {(vista?.kpis.flujoNetoUSD || 0) >= 0 ? 'Balance positivo' : 'Déficit en el periodo'}
                </p>
              </div>
            </div>
          </div>

          {/* Gráfico Mensual y Desglose de Gastos */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Gráfico de Barras */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Ingresos vs. Egresos Mensuales ({selectedYear})</h3>
                  <p className="text-xs text-slate-400">Comportamiento del flujo de caja mensual</p>
                </div>
                <div className="flex items-center gap-3 text-xs font-bold">
                  <span className="flex items-center gap-1.5 text-emerald-600">
                    <span className="w-3 h-3 rounded-md bg-emerald-500 inline-block" /> Ingresos
                  </span>
                  <span className="flex items-center gap-1.5 text-amber-600">
                    <span className="w-3 h-3 rounded-md bg-amber-400 inline-block" /> Egresos
                  </span>
                </div>
              </div>

              {/* Mientras llega el resumen del año (o se cambia de año) se muestra un esqueleto del histograma */}
              {(!resumen || resumen.periodo.anio !== selectedYear) && (
                <div role="status" aria-label="Cargando histograma" className="h-56 w-full pt-2">
                  <div className="grid grid-cols-12 gap-1.5 sm:gap-2 h-full items-end pb-6 border-b border-slate-100">
                    {Array.from({ length: 12 }, (_, i) => (
                      <div key={i} className="flex flex-col items-center justify-end h-full p-1">
                        <div className="w-full flex items-end justify-center gap-1 h-36">
                          <Skeleton className="w-full max-w-[12px] rounded-t-sm rounded-b-none" style={{ height: `${30 + ((i * 37) % 55)}%` }} />
                          <Skeleton className="w-full max-w-[12px] rounded-t-sm rounded-b-none" style={{ height: `${12 + ((i * 53) % 30)}%` }} />
                        </div>
                        <Skeleton className="h-2.5 w-6 mt-2" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {resumen?.historicoMensual && resumen.periodo.anio === selectedYear && (() => {
                const datos = resumen.historicoMensual
                const maxVal = escalaMaxima(Math.max(...datos.flatMap(x => [x.ingresos, x.egresos])))
                const ticks = [0, 1, 2, 3, 4].map(k => (maxVal / 4) * k)
                const alto = (v: number) => (v > 0 ? Math.max((v / maxVal) * 100, 1.5) : 0)

                return (
                  <div className="flex gap-2 pt-2">
                    {/* Eje Y: montos en USD */}
                    <div className="relative h-36 w-11 shrink-0" aria-hidden="true">
                      {ticks.map(t => (
                        <span key={t} style={{ bottom: `${(t / maxVal) * 100}%` }}
                          className="absolute right-0 translate-y-1/2 text-[10px] font-semibold text-slate-400 tabular-nums">
                          {montoCorto(t)}
                        </span>
                      ))}
                    </div>

                    <div className="relative flex-1 min-w-0">
                      {/* Líneas guía horizontales */}
                      <div className="absolute inset-x-0 top-0 h-36 pointer-events-none" aria-hidden="true">
                        {ticks.map(t => (
                          <div key={t} style={{ bottom: `${(t / maxVal) * 100}%` }}
                            className={`absolute inset-x-0 border-t ${t === 0 ? 'border-slate-400' : 'border-dashed border-slate-300'}`} />
                        ))}
                      </div>

                      <div className="relative grid grid-cols-12 gap-1 sm:gap-1.5">
                        {datos.map(m => {
                          const seleccionado = selectedMonth === m.mesNumero
                          return (
                            <button
                              key={m.mesNumero}
                              type="button"
                              aria-pressed={seleccionado}
                              aria-label={`${m.mes}: ingresos ${fmt(m.ingresos)}, egresos ${fmt(m.egresos)}`}
                              onClick={() => setSelectedMonth(seleccionado ? null : m.mesNumero)}
                              className={`group flex flex-col items-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                                seleccionado ? 'bg-emerald-50/80 ring-2 ring-emerald-500' : 'hover:bg-slate-50'
                              }`}
                            >
                              <div className="w-full h-36 flex items-end justify-center gap-0.5 sm:gap-1">
                                <div
                                  style={{ height: `${alto(m.ingresos)}%` }}
                                  title={`${m.mes}: Ingresos ${fmt(m.ingresos)}`}
                                  className="w-full max-w-[12px] bg-emerald-500 rounded-t-sm transition-all group-hover:bg-emerald-600"
                                />
                                <div
                                  style={{ height: `${alto(m.egresos)}%` }}
                                  title={`${m.mes}: Egresos ${fmt(m.egresos)}`}
                                  className="w-full max-w-[12px] bg-amber-400 rounded-t-sm transition-all group-hover:bg-amber-500"
                                />
                              </div>
                              {/* Eje X: mes y montos del mes */}
                              <span className={`mt-1.5 text-[10px] font-bold ${seleccionado ? 'text-emerald-800' : 'text-slate-500'}`}>{m.mes}</span>
                              <span className="hidden sm:block text-[9px] font-semibold tabular-nums text-emerald-600 leading-tight">{m.ingresos > 0 ? montoCorto(m.ingresos) : '–'}</span>
                              <span className="hidden sm:block text-[9px] font-semibold tabular-nums text-amber-600 leading-tight pb-1">{m.egresos > 0 ? montoCorto(m.egresos) : '–'}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* Distribución del período: ingresos por concepto o gastos por categoría */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm flex flex-col">
              <div className="flex items-start justify-between gap-2 mb-1">
                <h3 className="text-sm font-bold text-slate-800">
                  {vistaDistribucion === 'ingresos' ? 'Distribución de ingresos' : 'Distribución de gastos'}
                </h3>
                <div role="group" aria-label="Ver distribución de" className="inline-flex p-0.5 rounded-lg bg-slate-100 text-[11px] font-bold shrink-0">
                  {(['ingresos', 'gastos'] as const).map(v => (
                    <button
                      key={v}
                      type="button"
                      aria-pressed={vistaDistribucion === v}
                      onClick={() => setVistaDistribucion(v)}
                      className={`px-2.5 py-1 rounded-md capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                        vistaDistribucion === v ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-slate-400 mb-4">
                {vistaDistribucion === 'ingresos' ? 'Ingresos por concepto en el período' : 'Egresos categorizados en el período'}
              </p>

              {!resumen && (
                <div role="status" aria-label="Cargando distribución" className="space-y-3">
                  {[0, 1, 2, 3].map(i => (
                    <div key={i} className="space-y-1.5">
                      <div className="flex justify-between"><Skeleton className="h-3 w-24" /><Skeleton className="h-3 w-16" /></div>
                      <Skeleton className="h-1.5 w-full" />
                    </div>
                  ))}
                </div>
              )}
              {resumen && (() => {
                const esIngresos = vistaDistribucion === 'ingresos'
                const filas = esIngresos
                  ? (vista?.ingresosPorConcepto ?? []).map(c => ({ clave: c.concepto, label: c.etiqueta, color: COLORES_CONCEPTO[c.concepto] ?? '#6B7280', total: c.total }))
                  : (vista?.gastosPorCategoria ?? []).map(c => {
                      const info = CATEGORIAS[c.categoria] || { label: c.categoria, color: '#6B7280' }
                      return { clave: c.categoria, label: info.label, color: info.color, total: c.total }
                    })
                const totalBase = (esIngresos ? vista?.kpis.totalIngresosUSD : vista?.kpis.totalEgresosUSD) || 1

                return filas.length > 0 ? (
                  <div className="space-y-3 overflow-y-auto max-h-56 pr-1">
                    {filas.map(f => {
                      const pct = Math.round((f.total / totalBase) * 100)
                      return (
                        <div key={f.clave} className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-semibold">
                            <span className="text-slate-700 truncate">{f.label}</span>
                            <span className="text-slate-900 font-bold tabular-nums">{fmt(f.total)} ({pct}%)</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: f.color }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-xs py-8">
                    <AlertCircle size={24} className="mb-1 text-slate-300" aria-hidden="true" />
                    {esIngresos ? 'No hay ingresos registrados en este período.' : 'No hay gastos registrados en este período.'}
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: LIBRO DE VENTAS (INGRESOS GREMIALES / FISCALES) ── */}
      {tab === 'libro_venta' && (
        <div className="space-y-4">
          {/* Header del Libro de Ventas */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <h3 className="font-bold text-slate-800 text-base">Libro de Ventas & Ingresos</h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Total Ingresos: {totalesVentas ? <strong className="text-emerald-700">{fmt(totalesVentas.totalVentasUSD)}</strong> : <Skeleton className="inline-block align-middle h-3.5 w-20" />}
              </p>
            </div>

            {/* Búsqueda y Exportar */}
            <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Buscar recibo, cliente o RIF..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <select aria-label="Filtrar por concepto" value={filtroConcepto} onChange={e => setFiltroConcepto(e.target.value)}
                className="py-1.5 px-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="">Todos los conceptos</option>
                {Object.entries(CONCEPTOS_VENTA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select aria-label="Filtrar por método de pago" value={filtroMetodo} onChange={e => setFiltroMetodo(e.target.value)}
                className="py-1.5 px-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="">Todos los métodos</option>
                <option value="efectivo_usd">Efectivo USD</option>
                <option value="efectivo_bs">Efectivo Bs</option>
                <option value="pago_movil">Pago Móvil</option>
                <option value="transferencia_bs">Transferencia Bs</option>
                <option value="zelle">Zelle</option>
                <option value="binance_usdt">Binance USDT</option>
                <option value="pos_debito">Punto de venta</option>
              </select>

              <button
                onClick={() => setModalIngresosOpen(true)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <TrendingUp size={13} aria-hidden="true" />
                Ingresos por concepto
              </button>
              <button
                onClick={() => handleExportPDF('ventas')}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Download size={13} className="text-emerald-600" />
                PDF
              </button>
              <button
                onClick={() => descargarXlsx('libro-ventas', { anio: selectedYear, mes: selectedMonth, search: searchQuery, concepto: filtroConcepto, metodo: filtroMetodo }, authHeaders)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <FileSpreadsheet size={13} className="text-emerald-600" />
                Excel
              </button>
            </div>
          </div>

          {/* Tabla del Libro de Ventas */}
          <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Fecha</th>
                    <th className="py-3 px-4">Recibo / Doc</th>
                    <th className="py-3 px-4">Cliente / Afiliado</th>
                    <th className="py-3 px-4">RIF / C.I.</th>
                    <th className="py-3 px-4">Concepto</th>
                    <th className="py-3 px-4">Método</th>
                    <th className="py-3 px-4 text-right">Total ($)</th>
                    <th className="py-3 px-4 text-center">Recibo</th>
                  </tr>
                </thead>
                <tbody aria-busy={loadingVentas} className={`divide-y divide-slate-100 text-slate-700 transition-opacity ${loadingVentas && libroVentas.length > 0 ? 'opacity-50' : ''}`}>
                  {loadingVentas && libroVentas.length === 0 ? (
                    Array.from({ length: 6 }, (_, i) => (
                      <tr key={i} aria-hidden="true"><td colSpan={8} className="py-3 px-4"><Skeleton className="h-5 w-full" /></td></tr>
                    ))
                  ) : libroVentas.length > 0 ? (
                    libroVentas.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 font-mono whitespace-nowrap text-[11px] text-slate-500">
                          {fmtDate(item.fecha)}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-emerald-800 whitespace-nowrap">
                          {item.documento}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-800 max-w-[180px] truncate">
                          {item.cliente}
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                          {item.rif_cedula || '-'}
                        </td>
                        <td className="py-3 px-4 max-w-[200px] truncate text-slate-600">
                          {item.concepto}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-[11px] text-slate-500 capitalize">
                          {item.metodo_pago.replace('_', ' ')}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums font-black text-emerald-700">
                          {fmt(item.monto_usd)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {item.id_pago && isSuperAdmin && (
                            <button
                              onClick={() => handleAnularPago(item.id_pago!, item.documento)}
                              title="Anular pago (superadmin)"
                              aria-label={`Anular pago ${item.documento}`}
                              className="mr-1 p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors inline-flex align-middle"
                            >
                              <Ban size={13} />
                            </button>
                          )}
                          {item.id_pago ? (
                            <button
                              onClick={() => abrirRecibo(item.id_pago!)}
                              title="Ver Recibo Digital Oficial"
                              className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors inline-flex items-center gap-1 text-[10px] font-bold"
                            >
                              <Receipt size={13} />
                              <span>Ver</span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic" title={item.tipo_origen === 'cuota_importada' ? 'Cuota del listado de solvencia importado, sin recibo' : undefined}>
                              {item.tipo_origen === 'cuota_importada' ? 'Importado' : 'Manual'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="text-center py-10 text-slate-400">
                        No hay ventas registradas para este periodo.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Paginacion paginacion={paginacionVentas} onCambiar={pagina => setPagVentas({ clave: claveVentas, pagina })} />
          </div>
        </div>
      )}

      {/* ── TAB 3: LIBRO DE COMPRAS (GASTOS OPERATIVOS / PROVEEDORES) ── */}
      {tab === 'libro_compra' && (
        <div className="space-y-4">
          {/* Header del Libro de Compras */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <h3 className="font-bold text-slate-800 text-base">Libro de Compras & Gastos Operativos</h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Total Compras: {totalesCompras ? <strong className="text-slate-800">{fmt(totalesCompras.totalComprasUSD)}</strong> : <Skeleton className="inline-block align-middle h-3.5 w-20" />}
              </p>
            </div>

            {/* Búsqueda y Exportar */}
            <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Buscar factura, proveedor o RIF..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <button
                onClick={() => handleExportPDF('compras')}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Download size={13} className="text-emerald-600" />
                PDF
              </button>
              <button
                onClick={() => setModalEgresosOpen(true)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <TrendingDown size={13} aria-hidden="true" />
                Egresos por concepto
              </button>
              <button
                onClick={() => descargarXlsx('libro-compras', { anio: selectedYear, mes: selectedMonth, search: searchQuery }, authHeaders)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <FileSpreadsheet size={13} className="text-emerald-600" />
                Excel
              </button>
              <button
                onClick={() => setModalGastoOpen(true)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Plus size={13} aria-hidden="true" />
                Nuevo gasto
              </button>
            </div>
          </div>

          {/* Tabla del Libro de Compras */}
          <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Fecha</th>
                    <th className="py-3 px-4">Nro. Factura</th>
                    <th className="py-3 px-4">Proveedor</th>
                    <th className="py-3 px-4">RIF</th>
                    <th className="py-3 px-4">Concepto / Categoría</th>
                    <th className="py-3 px-4 text-right">Total ($)</th>
                    <th className="py-3 px-4 text-center">Adjunto</th>
                    <th className="py-3 px-4 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody aria-busy={loadingCompras} className={`divide-y divide-slate-100 text-slate-700 transition-opacity ${loadingCompras && libroCompras.length > 0 ? 'opacity-50' : ''}`}>
                  {loadingCompras && libroCompras.length === 0 ? (
                    Array.from({ length: 4 }, (_, i) => (
                      <tr key={i} aria-hidden="true"><td colSpan={8} className="py-3 px-4"><Skeleton className="h-5 w-full" /></td></tr>
                    ))
                  ) : libroCompras.length > 0 ? (
                    libroCompras.map(item => {
                      const esAnulado = item.estatus === 'anulado'
                      return (
                        <tr
                          key={item.id_movimiento}
                          className={`transition-colors ${esAnulado ? 'bg-red-50/40 opacity-60' : 'hover:bg-slate-50/60'}`}
                        >
                          <td className="py-3 px-4 font-mono whitespace-nowrap text-[11px] text-slate-500">
                            {fmtDate(item.fecha)}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-800 whitespace-nowrap">
                            {item.nro_factura_documento}
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-800 max-w-[170px] truncate">
                            {item.proveedor}
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                            {item.rif_cedula || '-'}
                          </td>
                          <td className="py-3 px-4 max-w-[190px]">
                            <p className="truncate text-slate-700 font-medium">{item.concepto}</p>
                            <span className="text-[9px] font-bold text-slate-400 capitalize">
                              {CATEGORIAS[item.categoria]?.label || item.categoria}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right tabular-nums font-black text-slate-800">
                            {fmt(item.monto_usd_equivalente)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {item.comprobante_url ? (
                              <a
                                href={item.comprobante_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Ver Comprobante Digital"
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors inline-flex items-center gap-1 text-[10px] font-bold"
                              >
                                <ExternalLink size={12} />
                                <span>Doc</span>
                              </a>
                            ) : (
                              <span className="text-[10px] text-slate-300">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {!esAnulado && (
                              <button
                                onClick={() => handleAnularGasto(item.id_movimiento)}
                                title="Anular Gasto"
                                className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              >
                                <Ban size={14} />
                              </button>
                            )}
                            {esAnulado && (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-red-100 text-red-700">
                                Anulado
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="text-center py-10 text-slate-400">
                        No hay compras o gastos registrados para este periodo.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Paginacion paginacion={paginacionCompras} onCambiar={pagina => setPagCompras({ clave: claveCompras, pagina })} />
          </div>
        </div>
      )}

      {/* ── TAB 4: TASAS DE REFERENCIA & CONVERSOR ── */}
      {tab === 'solvencia' && <SolvenciaPanel />}
      {tab === 'cuentas_cobrar' && <CuentasPorCobrar />}

      {tab === 'tasas_referencias' && (
        <ReferenciasTasasPanel />
      )}

      {/* ── MODALES ── */}
      <ModalRegistrarGasto
        isOpen={modalGastoOpen}
        onClose={() => setModalGastoOpen(false)}
        onSuccess={refreshData}
      />

      <ModalGestionCuentasBancarias
        isOpen={modalCuentasOpen}
        open={modalCuentasOpen}
        onClose={() => setModalCuentasOpen(false)}
        authHeaders={authHeaders}
      />

      <ModalGestionAranceles
        isOpen={modalArancelesOpen}
        open={modalArancelesOpen}
        onClose={() => setModalArancelesOpen(false)}
        authHeaders={authHeaders}
      />

      <ModalReporte open={modalIngresosOpen} onClose={() => setModalIngresosOpen(false)} icono={<TrendingUp className="w-5 h-5" aria-hidden="true" />}
        titulo="Ingresos por concepto" subtitulo={`Ingresos verificados de ${selectedYear}, por mes`}>
        <IngresosPorConcepto anio={selectedYear} />
      </ModalReporte>

      <ModalReporte open={modalEgresosOpen} onClose={() => setModalEgresosOpen(false)} icono={<TrendingDown className="w-5 h-5" aria-hidden="true" />}
        titulo="Egresos por concepto" subtitulo={`Compras y gastos de ${selectedYear}, por mes`}>
        <EgresosPorConcepto anio={selectedYear} />
      </ModalReporte>

      <ModalRegistrarCobro
        open={modalCobroOpen}
        onClose={() => setModalCobroOpen(false)}
        onCobrado={(pago) => {
          setModalCobroOpen(false)
          abrirRecibo(pago.id_pago) // el recibo completo trae los datos del pagador
          fetchLibroVentas()
        }}
        authHeaders={authHeaders}
      />

      <ReciboDigitalModal
        pago={reciboPago}
        onClose={() => setReciboPago(null)}
      />
    </div>
  )
}
