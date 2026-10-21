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
import ReferenciasTasasPanel from '@/pages/admin/components/Finance/ReferenciasTasasPanel'
import ReciboDigitalModal from '@/components/ReciboDigitalModal'
import { BinanceIcon } from '@/components/icons/BinanceIcon'
import type { 
  ResumenFinancieroDTO, 
  LibroVentaItemDTO, 
  LibroCompraItemDTO, 
  TxCategory, 
  TxStatus 
} from '@/types/finanzas'

type FinanceTab = 'dashboard' | 'libro_venta' | 'libro_compra' | 'tasas_referencias' | 'solvencia'

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
  const { authHeaders } = useAuth()

  const [tab, setTab] = useState<FinanceTab>('dashboard')
  const [loading, setLoading] = useState(true)

  // Filtros de periodo
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState<number | null>(new Date().getMonth() + 1)
  const [searchQuery, setSearchQuery] = useState('')

  // Datos
  const [resumen, setResumen] = useState<ResumenFinancieroDTO | null>(null)
  const [libroVentas, setLibroVentas] = useState<LibroVentaItemDTO[]>([])
  const [totalesVentas, setTotalesVentas] = useState<any>(null)
  const [libroCompras, setLibroCompras] = useState<LibroCompraItemDTO[]>([])
  const [totalesCompras, setTotalesCompras] = useState<any>(null)

  // Modales
  const [modalGastoOpen, setModalGastoOpen] = useState(false)
  const [modalCuentasOpen, setModalCuentasOpen] = useState(false)
  const [modalArancelesOpen, setModalArancelesOpen] = useState(false)
  
  // Visor de Recibo Digital
  const [selectedReciboId, setSelectedReciboId] = useState<number | string | null>(null)
  const [reciboModalOpen, setReciboModalOpen] = useState(false)

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
  const fetchResumen = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      params.append('anio', String(selectedYear))
      if (selectedMonth) params.append('mes', String(selectedMonth))

      const res = await fetch(`${API_URL}/api/finanzas/resumen?${params.toString()}`, {
        headers: authHeaders
      })
      if (!res.ok) throw new Error('Error al cargar resumen')
      const json = await res.json()
      setResumen(json.data)
    } catch (err: any) {
      console.error(err)
    }
  }, [selectedYear, selectedMonth, authHeaders])

  // Cargar Libro de Ventas
  const fetchLibroVentas = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      params.append('anio', String(selectedYear))
      if (selectedMonth) params.append('mes', String(selectedMonth))
      if (searchQuery) params.append('search', searchQuery)

      const res = await fetch(`${API_URL}/api/finanzas/libro-ventas?${params.toString()}`, {
        headers: authHeaders
      })
      if (!res.ok) throw new Error('Error al cargar libro de ventas')
      const json = await res.json()
      setLibroVentas(json.data.items || [])
      setTotalesVentas(json.data.totales)
    } catch (err: any) {
      console.error(err)
    }
  }, [selectedYear, selectedMonth, searchQuery, authHeaders])

  // Cargar Libro de Compras
  const fetchLibroCompras = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      params.append('anio', String(selectedYear))
      if (selectedMonth) params.append('mes', String(selectedMonth))
      if (searchQuery) params.append('search', searchQuery)

      const res = await fetch(`${API_URL}/api/finanzas/libro-compras?${params.toString()}`, {
        headers: authHeaders
      })
      if (!res.ok) throw new Error('Error al cargar libro de compras')
      const json = await res.json()
      setLibroCompras(json.data.items || [])
      setTotalesCompras(json.data.totales)
    } catch (err: any) {
      console.error(err)
    }
  }, [selectedYear, selectedMonth, searchQuery, authHeaders])

  // Cargar todo
  const refreshData = useCallback(async () => {
    setLoading(true)
    await Promise.all([fetchResumen(), fetchLibroVentas(), fetchLibroCompras(), fetchTasasTicker()])
    setLoading(false)
  }, [fetchResumen, fetchLibroVentas, fetchLibroCompras, fetchTasasTicker])

  useEffect(() => {
    refreshData()
  }, [refreshData])

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
  const handleExportPDF = (tipo: 'ventas' | 'compras') => {
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
      const rows = libroVentas.map(item => [
        fmtDate(item.fecha),
        item.documento,
        item.cliente,
        item.rif_cedula || '-',
        item.concepto.slice(0, 32),
        item.metodo_pago,
        `$${item.monto_exento.toFixed(2)}`,
        `$${item.base_imponible.toFixed(2)}`,
        `$${item.monto_iva.toFixed(2)}`,
        `$${item.monto_usd.toFixed(2)}`
      ])

      const total = totalesVentas?.totalVentasUSD || 0

      autoTable(doc, {
        head: [['Fecha', 'Nro. Recibo/Doc', 'Cliente / Afiliado', 'RIF/C.I.', 'Concepto', 'Método', 'Exento ($)', 'Base ($)', 'IVA ($)', 'Total ($)']],
        body: rows,
        startY: 30,
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: [6, 78, 59], textColor: 255, fontStyle: 'bold' },
        foot: [['', '', '', '', '', 'Totales:', `$${(totalesVentas?.totalExentoUSD || 0).toFixed(2)}`, `$${(totalesVentas?.totalBaseUSD || 0).toFixed(2)}`, `$${(totalesVentas?.totalIvaUSD || 0).toFixed(2)}`, `$${total.toFixed(2)}`]],
        footStyles: { fillColor: [240, 253, 244], textColor: [6, 78, 59], fontStyle: 'bold' },
        margin: { left: 14, right: 14 }
      })

      doc.save(`Libro_Ventas_${selectedYear}_${selectedMonth || 'Anual'}.pdf`)
    } else {
      const rows = libroCompras.map(item => [
        fmtDate(item.fecha),
        item.nro_factura_documento,
        item.nro_control_fiscal || '-',
        item.proveedor,
        item.rif_cedula || '-',
        item.concepto.slice(0, 28),
        `$${item.monto_exento.toFixed(2)}`,
        `$${item.base_imponible.toFixed(2)}`,
        `${item.alicuota_iva}%`,
        `$${item.monto_iva.toFixed(2)}`,
        `$${item.monto_usd_equivalente.toFixed(2)}`
      ])

      const total = totalesCompras?.totalComprasUSD || 0

      autoTable(doc, {
        head: [['Fecha', 'Nro. Factura', 'Nro. Control', 'Proveedor', 'RIF', 'Concepto', 'Exento ($)', 'Base ($)', 'Alíc.', 'IVA ($)', 'Total ($)']],
        body: rows,
        startY: 30,
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: [6, 78, 59], textColor: 255, fontStyle: 'bold' },
        foot: [['', '', '', '', '', 'Totales:', `$${(totalesCompras?.totalExentoUSD || 0).toFixed(2)}`, `$${(totalesCompras?.totalBaseUSD || 0).toFixed(2)}`, '', `$${(totalesCompras?.totalIvaCreditoUSD || 0).toFixed(2)}`, `$${total.toFixed(2)}`]],
        footStyles: { fillColor: [240, 253, 244], textColor: [6, 78, 59], fontStyle: 'bold' },
        margin: { left: 14, right: 14 }
      })

      doc.save(`Libro_Compras_${selectedYear}_${selectedMonth || 'Anual'}.pdf`)
    }
  }

  // Exportar a CSV / Excel
  const handleExportCSV = (tipo: 'ventas' | 'compras') => {
    let csvContent = 'data:text/csv;charset=utf-8,\uFEFF'
    if (tipo === 'ventas') {
      csvContent += 'Fecha,Documento,Cliente,RIF_CI,Concepto,Metodo_Pago,Exento_USD,Base_USD,IVA_USD,Total_USD\n'
      libroVentas.forEach(item => {
        csvContent += `"${item.fecha}","${item.documento}","${item.cliente}","${item.rif_cedula}","${item.concepto.replace(/"/g, '""')}","${item.metodo_pago}",${item.monto_exento},${item.base_imponible},${item.monto_iva},${item.monto_usd}\n`
      })
      const encodedUri = encodeURI(csvContent)
      const link = document.createElement('a')
      link.setAttribute('href', encodedUri)
      link.setAttribute('download', `Libro_Ventas_${selectedYear}_${selectedMonth || 'Anual'}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } else {
      csvContent += 'Fecha,Nro_Factura,Nro_Control,Proveedor,RIF,Concepto,Categoria,Exento_USD,Base_USD,Alicuota_IVA,IVA_USD,Total_USD,Metodo_Pago,Referencia\n'
      libroCompras.forEach(item => {
        csvContent += `"${item.fecha}","${item.nro_factura_documento}","${item.nro_control_fiscal || ''}","${item.proveedor}","${item.rif_cedula}","${item.concepto.replace(/"/g, '""')}","${item.categoria}",${item.monto_exento},${item.base_imponible},${item.alicuota_iva},${item.monto_iva},${item.monto_usd_equivalente},"${item.metodo_pago}","${item.referencia_pago || ''}"\n`
      })
      const encodedUri = encodeURI(csvContent)
      const link = document.createElement('a')
      link.setAttribute('href', encodedUri)
      link.setAttribute('download', `Libro_Compras_${selectedYear}_${selectedMonth || 'Anual'}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
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
            onClick={() => setModalGastoOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 transition-all shadow-sm shadow-emerald-600/20"
          >
            <Plus size={15} />
            + Registrar Compra / Gasto
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
            Libro de Ventas ({totalesVentas?.cantidadRegistros || 0})
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
            Libro de Compras ({totalesCompras?.cantidadRegistros || 0})
          </button>
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
            Tasas & Conversor
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
            <RefreshCw size={14} className={loading ? 'animate-spin text-emerald-600' : ''} />
          </button>
        </div>
      </div>

      {/* ── TAB 1: DASHBOARD & FLUJO DE CAJA ── */}
      {tab === 'dashboard' && (
        <div className="space-y-6">
          {/* Tarjetas KPI */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                  {fmt(resumen?.kpis.totalIngresosUSD || 0)}
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {resumen?.kpis.conteoIngresos || 0} operaciones registradas
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
                  {fmt(resumen?.kpis.totalEgresosUSD || 0)}
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {resumen?.kpis.conteoEgresos || 0} gastos operativos
                </p>
              </div>
            </div>

            {/* Flujo Neto */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm relative overflow-hidden flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Flujo Neto / Superávit</span>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  (resumen?.kpis.flujoNetoUSD || 0) >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                }`}>
                  <TrendingUp size={18} />
                </div>
              </div>
              <div className="mt-3">
                <span className={`text-2xl font-black tabular-nums ${
                  (resumen?.kpis.flujoNetoUSD || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'
                }`}>
                  {fmt(resumen?.kpis.flujoNetoUSD || 0)}
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {(resumen?.kpis.flujoNetoUSD || 0) >= 0 ? 'Balance positivo' : 'Déficit en el periodo'}
                </p>
              </div>
            </div>

            {/* IVA Crédito vs Débito */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm relative overflow-hidden flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">IVA Crédito Fiscal</span>
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Receipt size={18} />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black text-purple-700 tabular-nums">
                  {fmt(resumen?.kpis.ivaCreditoFiscal || 0)}
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Crédito a favor en compras
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

              {/* Render de barras SVG */}
              {resumen?.historicoMensual && (
                <div className="h-56 w-full pt-2">
                  <div className="grid grid-cols-12 gap-1.5 sm:gap-2 h-full items-end pb-6 border-b border-slate-100 relative">
                    {resumen.historicoMensual.map(m => {
                      const maxVal = Math.max(
                        ...resumen.historicoMensual.flatMap(x => [x.ingresos, x.egresos]),
                        100
                      )
                      const altIngreso = Math.max((m.ingresos / maxVal) * 100, 3)
                      const altEgreso = Math.max((m.egresos / maxVal) * 100, 3)
                      const isCurrentSelected = selectedMonth === m.mesNumero

                      return (
                        <div
                          key={m.mesNumero}
                          onClick={() => setSelectedMonth(isCurrentSelected ? null : m.mesNumero)}
                          className={`flex flex-col items-center justify-end h-full group cursor-pointer p-1 rounded-xl transition-all ${
                            isCurrentSelected ? 'bg-emerald-50/80 ring-2 ring-emerald-500' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="w-full flex items-end justify-center gap-1 h-36">
                            {/* Barra Ingreso */}
                            <div
                              style={{ height: `${altIngreso}%` }}
                              title={`${m.mes}: Ingresos ${fmt(m.ingresos)}`}
                              className="w-full max-w-[12px] bg-emerald-500 rounded-t-sm transition-all group-hover:bg-emerald-600"
                            />
                            {/* Barra Egreso */}
                            <div
                              style={{ height: `${altEgreso}%` }}
                              title={`${m.mes}: Egresos ${fmt(m.egresos)}`}
                              className="w-full max-w-[12px] bg-amber-400 rounded-t-sm transition-all group-hover:bg-amber-500"
                            />
                          </div>
                          <span className={`text-[10px] font-bold mt-2 ${
                            isCurrentSelected ? 'text-emerald-800' : 'text-slate-400'
                          }`}>
                            {m.mes}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Desglose por Categoría */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm flex flex-col">
              <h3 className="text-sm font-bold text-slate-800 mb-1">Distribución de Gastos</h3>
              <p className="text-xs text-slate-400 mb-4">Egresos categorizados en el período</p>

              {resumen?.gastosPorCategoria && resumen.gastosPorCategoria.length > 0 ? (
                <div className="space-y-3 overflow-y-auto max-h-56 pr-1">
                  {resumen.gastosPorCategoria.map(c => {
                    const catInfo = CATEGORIAS[c.categoria] || { label: c.categoria, color: '#6B7280' }
                    const totalEgresos = resumen.kpis.totalEgresosUSD || 1
                    const pct = Math.round((c.total / totalEgresos) * 100)

                    return (
                      <div key={c.categoria} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className="text-slate-700 truncate">{catInfo.label}</span>
                          <span className="text-slate-900 font-bold tabular-nums">{fmt(c.total)} ({pct}%)</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, backgroundColor: catInfo.color }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-xs py-8">
                  <AlertCircle size={24} className="mb-1 text-slate-300" />
                  No hay gastos registrados en este período.
                </div>
              )}
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
                Total Ingresos: <strong className="text-emerald-700">{fmt(totalesVentas?.totalVentasUSD || 0)}</strong> · Base: {fmt(totalesVentas?.totalBaseUSD || 0)} · Exento: {fmt(totalesVentas?.totalExentoUSD || 0)}
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

              <button
                onClick={() => handleExportPDF('ventas')}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Download size={13} className="text-emerald-600" />
                PDF
              </button>
              <button
                onClick={() => handleExportCSV('ventas')}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <FileSpreadsheet size={13} className="text-emerald-600" />
                Excel / CSV
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
                    <th className="py-3 px-4 text-right">Exento ($)</th>
                    <th className="py-3 px-4 text-right">Total ($)</th>
                    <th className="py-3 px-4 text-center">Recibo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {libroVentas.length > 0 ? (
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
                        <td className="py-3 px-4 text-right tabular-nums text-slate-500">
                          {fmt(item.monto_exento)}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums font-black text-emerald-700">
                          {fmt(item.monto_usd)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {item.id_pago ? (
                            <button
                              onClick={() => {
                                setSelectedReciboId(item.id_pago)
                                setReciboModalOpen(true)
                              }}
                              title="Ver Recibo Digital Oficial"
                              className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors inline-flex items-center gap-1 text-[10px] font-bold"
                            >
                              <Receipt size={13} />
                              <span>Ver</span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">Manual</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="text-center py-10 text-slate-400">
                        No hay ventas registradas para este periodo.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
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
                Total Compras: <strong className="text-slate-800">{fmt(totalesCompras?.totalComprasUSD || 0)}</strong> · Base: {fmt(totalesCompras?.totalBaseUSD || 0)} · IVA Crédito: <strong className="text-purple-700">{fmt(totalesCompras?.totalIvaCreditoUSD || 0)}</strong>
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
                onClick={() => handleExportCSV('compras')}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <FileSpreadsheet size={13} className="text-emerald-600" />
                Excel / CSV
              </button>
              <button
                onClick={() => setModalGastoOpen(true)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Plus size={13} />
                + Nuevo Gasto
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
                    <th className="py-3 px-4">Nro. Control</th>
                    <th className="py-3 px-4">Proveedor</th>
                    <th className="py-3 px-4">RIF</th>
                    <th className="py-3 px-4">Concepto / Categoría</th>
                    <th className="py-3 px-4 text-right">Base ($)</th>
                    <th className="py-3 px-4 text-right">IVA ($)</th>
                    <th className="py-3 px-4 text-right">Total ($)</th>
                    <th className="py-3 px-4 text-center">Adjunto</th>
                    <th className="py-3 px-4 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {libroCompras.length > 0 ? (
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
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                            {item.nro_control_fiscal || '-'}
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
                          <td className="py-3 px-4 text-right tabular-nums text-slate-600">
                            {fmt(item.base_imponible)}
                          </td>
                          <td className="py-3 px-4 text-right tabular-nums font-semibold text-purple-700">
                            {fmt(item.monto_iva)} ({item.alicuota_iva}%)
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
                      <td colSpan={11} className="text-center py-10 text-slate-400">
                        No hay compras o gastos registrados para este periodo.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 4: TASAS DE REFERENCIA & CONVERSOR ── */}
      {tab === 'solvencia' && <SolvenciaPanel />}

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

      <ReciboDigitalModal
        isOpen={reciboModalOpen}
        onClose={() => setReciboModalOpen(false)}
        reciboIdOrCode={selectedReciboId}
      />
    </div>
  )
}
