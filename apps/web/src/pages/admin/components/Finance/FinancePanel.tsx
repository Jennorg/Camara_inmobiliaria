import React, { useState, useMemo, useRef } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// ─── Tipos ────────────────────────────────────────────────────────────────────
type TxType = 'ingreso' | 'egreso'
type TxStatus = 'completado' | 'pendiente' | 'anulado'
type TxCategory =
  | 'afiliacion'
  | 'curso'
  | 'convenio'
  | 'servicio'
  | 'gasto_operativo'
  | 'gasto_admin'
  | 'donacion'
  | 'otro'

interface Movimiento {
  id: string
  fecha: string
  tipo: TxType
  categoria: TxCategory
  concepto: string
  monto: number
  referencia: string
  vinculado: { tipo: 'afiliado' | 'curso' | 'preinscripcion'; id: number; nombre: string } | null
  metodo_pago: string
  estado: TxStatus
  proveedor_cliente: string
  documento: string
}

// ─── Categorías — paleta corporativa verde ────────────────────────────────────
const CATEGORIAS: Record<TxCategory, { label: string; color: string }> = {
  afiliacion:       { label: 'Afiliación',       color: '#059669' },
  curso:            { label: 'Curso/Taller',      color: '#0D9488' },
  convenio:         { label: 'Convenio',          color: '#047857' },
  servicio:         { label: 'Servicio',          color: '#65A30D' },
  gasto_operativo:  { label: 'Gasto Operativo',   color: '#A16207' },
  gasto_admin:      { label: 'Gasto Admin.',      color: '#78716C' },
  donacion:         { label: 'Donación',          color: '#1D4ED8' },
  otro:             { label: 'Otro',              color: '#6B7280' },
}

// ─── Datos mock — montos pequeños y realistas ────────────────────────────────
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const MOCK_MOVIMIENTOS: Movimiento[] = [
  { id: 'M-001', fecha: '2026-03-15', tipo: 'ingreso', categoria: 'afiliacion', concepto: 'Cuota afiliación — María López',              monto: 35,  referencia: 'TRN-001245', vinculado: { tipo: 'afiliado', id: 101, nombre: 'María López' }, metodo_pago: 'Transferencia', estado: 'completado', proveedor_cliente: 'María López C.I. 12.345.678',                           documento: 'FAC-2026-001' },
  { id: 'M-002', fecha: '2026-03-14', tipo: 'ingreso', categoria: 'curso',      concepto: 'Inscripción Curso AVALUOS — Juan Pérez',     monto: 85,  referencia: 'TRN-001244', vinculado: { tipo: 'curso', id: 5, nombre: 'Curso de Avaluos Inmobiliarios' }, metodo_pago: 'Depósito',      estado: 'completado', proveedor_cliente: 'Juan Pérez C.I. 23.456.789',                             documento: 'FAC-2026-002' },
  { id: 'M-003', fecha: '2026-03-12', tipo: 'egreso',  categoria: 'gasto_operativo', concepto: 'Alquiler sede gremial — Marzo',          monto: 120, referencia: 'TRN-001243', vinculado: null, metodo_pago: 'Transferencia', estado: 'completado', proveedor_cliente: 'Inmobiliaria Centro C.A. RIF J-12345678-9',         documento: 'FAC-P-2026-003' },
  { id: 'M-004', fecha: '2026-03-10', tipo: 'ingreso', categoria: 'convenio',    concepto: 'Pago convenio Cámara de Comercio — Febrero', monto: 250, referencia: 'TRN-001242', vinculado: null, metodo_pago: 'Transferencia', estado: 'completado', proveedor_cliente: 'Cámara de Comercio de Bolívar RIF J-20012345-6',       documento: 'FAC-2026-004' },
  { id: 'M-005', fecha: '2026-03-08', tipo: 'egreso',  categoria: 'gasto_admin',  concepto: 'Servicios públicos sede',                  monto: 45,  referencia: 'TRN-001241', vinculado: null, metodo_pago: 'Efectivo',      estado: 'pendiente',  proveedor_cliente: 'CORPOELEC RIF G-20012345-0',                      documento: 'FAC-P-2026-005' },
  { id: 'M-006', fecha: '2026-03-05', tipo: 'ingreso', categoria: 'curso',      concepto: 'Inscripción Taller TASACIÓN — Carlos Rivas',  monto: 60,  referencia: 'TRN-001240', vinculado: { tipo: 'curso', id: 7, nombre: 'Taller de Tasación Inmobiliaria' }, metodo_pago: 'Depósito',      estado: 'completado', proveedor_cliente: 'Carlos Rivas C.I. 15.678.901',                           documento: 'FAC-2026-006' },
  { id: 'M-007', fecha: '2026-03-03', tipo: 'ingreso', categoria: 'afiliacion',  concepto: 'Afiliación corporativa — Constructora ABC',   monto: 180, referencia: 'TRN-001239', vinculado: { tipo: 'afiliado', id: 202, nombre: 'Constructora ABC S.A.' }, metodo_pago: 'Transferencia', estado: 'completado', proveedor_cliente: 'Constructora ABC S.A. RIF J-30456789-0',                    documento: 'FAC-2026-007' },
  { id: 'M-008', fecha: '2026-02-28', tipo: 'egreso',  categoria: 'gasto_operativo', concepto: 'Suministros de oficina',                   monto: 28,  referencia: 'TRN-001238', vinculado: null, metodo_pago: 'Transferencia', estado: 'completado', proveedor_cliente: 'Papelería El Gremial RIF J-40567890-1',                documento: 'FAC-P-2026-008' },
  { id: 'M-009', fecha: '2026-02-25', tipo: 'ingreso', categoria: 'curso',      concepto: 'Preinscripción PEGI — Ana Torres',            monto: 75,  referencia: 'TRN-001237', vinculado: { tipo: 'preinscripcion', id: 56, nombre: 'Ana Torres' }, metodo_pago: 'Depósito',      estado: 'completado', proveedor_cliente: 'Ana Torres C.I. 18.901.234',                             documento: 'FAC-2026-009' },
  { id: 'M-010', fecha: '2026-02-22', tipo: 'egreso',  categoria: 'servicio',     concepto: 'Mantenimiento sitio web',                   monto: 55,  referencia: 'TRN-001236', vinculado: null, metodo_pago: 'Transferencia', estado: 'completado', proveedor_cliente: 'WebSolutions C.A. RIF J-50678901-2',                      documento: 'FAC-P-2026-010' },
  { id: 'M-011', fecha: '2026-02-20', tipo: 'ingreso', categoria: 'convenio',    concepto: 'Cuota convenio inmobiliarias — Enero',        monto: 200, referencia: 'TRN-001235', vinculado: null, metodo_pago: 'Transferencia', estado: 'completado', proveedor_cliente: 'Asociación de Inmobiliarias Bolívar RIF J-60789012-3',    documento: 'FAC-2026-011' },
  { id: 'M-012', fecha: '2026-02-18', tipo: 'egreso',  categoria: 'gasto_admin',  concepto: 'Pago nómina administrativa',                monto: 350, referencia: 'TRN-001234', vinculado: null, metodo_pago: 'Transferencia', estado: 'completado', proveedor_cliente: 'Personal Administrativo CIBIR',                              documento: 'REC-2026-012' },
  { id: 'M-013', fecha: '2026-02-15', tipo: 'ingreso', categoria: 'afiliacion',  concepto: 'Afiliación agente — Roberto Méndez',         monto: 35,  referencia: 'TRN-001233', vinculado: { tipo: 'afiliado', id: 303, nombre: 'Roberto Méndez' }, metodo_pago: 'Transferencia', estado: 'pendiente',  proveedor_cliente: 'Roberto Méndez C.I. 20.123.456',                           documento: 'FAC-2026-013' },
  { id: 'M-014', fecha: '2026-02-12', tipo: 'egreso',  categoria: 'gasto_operativo', concepto: 'Material didáctico cursos',                monto: 40,  referencia: 'TRN-001232', vinculado: null, metodo_pago: 'Efectivo',      estado: 'completado', proveedor_cliente: 'Librería Técnica C.A. RIF J-70890123-4',                  documento: 'FAC-P-2026-014' },
  { id: 'M-015', fecha: '2026-02-10', tipo: 'ingreso', categoria: 'curso',      concepto: 'Inscripción PADI — Laura Silva',             monto: 90,  referencia: 'TRN-001231', vinculado: { tipo: 'curso', id: 3, nombre: 'Programa PADI' }, metodo_pago: 'Depósito',      estado: 'completado', proveedor_cliente: 'Laura Silva C.I. 25.678.901',                             documento: 'FAC-2026-015' },
  { id: 'M-016', fecha: '2026-02-08', tipo: 'egreso',  categoria: 'servicio',     concepto: 'Servicio de hosting + dominio',              monto: 18,  referencia: 'TRN-001230', vinculado: null, metodo_pago: 'Tarjeta',       estado: 'completado', proveedor_cliente: 'DigitalOcean LLC',                                        documento: 'FAC-P-2026-016' },
  { id: 'M-017', fecha: '2026-02-05', tipo: 'ingreso', categoria: 'donacion',    concepto: 'Donación programa formación',                monto: 150, referencia: 'TRN-001229', vinculado: null, metodo_pago: 'Transferencia', estado: 'completado', proveedor_cliente: 'Fundación Desarrollo Local RIF J-30098765-4',              documento: 'FAC-2026-017' },
  { id: 'M-018', fecha: '2026-02-01', tipo: 'egreso',  categoria: 'gasto_operativo', concepto: 'Alquiler sede gremial — Febrero',          monto: 120, referencia: 'TRN-001228', vinculado: null, metodo_pago: 'Transferencia', estado: 'completado', proveedor_cliente: 'Inmobiliaria Centro C.A. RIF J-12345678-9',         documento: 'FAC-P-2026-018' },
]

// ─── Resumen mensual — montos pequeños ───────────────────────────────────────
const MOCK_RESUMEN_MENSUAL = MESES.map((mes, i) => {
  const ingresosBase = 280 + Math.random() * 220 + i * 18
  const egresosBase  = 150 + Math.random() * 160 + i * 6
  return {
    mes,
    ingresos:  Math.round(ingresosBase),
    egresos:   Math.round(egresosBase),
  }
})

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatter = new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })
const fmt = (n: number) => formatter.format(n)
const fmtDate = (s: string) => new Date(s + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
const fmtShortDate = (s: string) => new Date(s + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })

const ESTADO_BADGE: Record<TxStatus, { label: string; style: string }> = {
  completado: { label: 'Completado', style: 'bg-emerald-100 text-emerald-700' },
  pendiente:  { label: 'Pendiente',  style: 'bg-amber-100 text-amber-700' },
  anulado:    { label: 'Anulado',    style: 'bg-red-100 text-red-600' },
}

// ─── PDF export ───────────────────────────────────────────────────────────────
function exportarPDF(tipo: 'compra' | 'venta', movimientos: Movimiento[]) {
  const esCompra = tipo === 'compra'
  const label = esCompra ? 'Compra' : 'Venta'

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' })

  // ── Header ──
  doc.setFillColor(0, 110, 70)
  doc.rect(0, 0, 280, 22, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(`Libro de ${label}`, 14, 14)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text(`Cámara Inmobiliaria de Bolívar · Período: Marzo 2026 · Emitido: ${new Date().toLocaleDateString('es-ES')}`, 14, 20)

  // Totales
  const total = movimientos.reduce((s, m) => s + m.monto, 0)

  doc.setFillColor(240, 253, 244)
  doc.rect(14, 25, 252, 10, 'F')
  doc.setTextColor(21, 128, 61)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text(`Total ${label === 'Compra' ? 'Compras' : 'Ventas'}: $${total.toFixed(2)}`, 18, 32)

  // ── Table ──
  const rows = movimientos.map(m => [
    fmtDate(m.fecha),
    m.documento,
    m.proveedor_cliente.slice(0, 35),
    m.concepto.slice(0, 35),
    `$${m.monto.toFixed(2)}`,
  ])

  autoTable(doc, {
    head: [[ 'Fecha', 'Comprobante', 'Proveedor / Cliente', 'Concepto', 'Total' ]],
    body: rows,
    startY: 38,
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [0, 110, 70], textColor: 255, fontStyle: 'bold', fontSize: 7 },
    foot: [[ '', '', '', 'Totales', `$${total.toFixed(2)}` ]],
    footStyles: { fillColor: [240, 253, 244], textColor: [21, 128, 61], fontStyle: 'bold', fontSize: 7 },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 24 },
      2: { cellWidth: 60 },
      3: { cellWidth: 64 },
      4: { cellWidth: 24, halign: 'right' },
    },
    margin: { left: 14, right: 14 },
    tableWidth: 'auto',
    pageBreak: 'auto',
  })

  const filename = `Libro_${label}_Marzo2026.pdf`
  doc.save(filename)
}

// ─── Iconos SVG ───────────────────────────────────────────────────────────────
const I = {
  plus: <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>,
  x: <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>,
  download: <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>,
  balance: <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>,
  search: <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>,
  check: <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>,
  alert: <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>,
  arrowUp: <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="18 15 12 9 6 15" /></svg>,
  arrowDown: <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="6 9 12 15 18 9" /></svg>,
}

// ─── StatCard ──────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, change, changePositive, icon }: {
  label: string; value: string; change?: string; changePositive?: boolean; icon: React.ReactNode
}) => (
  <div className="bg-white rounded-xl border border-emerald-100/60 p-4 flex flex-col gap-2 hover:shadow-sm transition-shadow">
    <div className="flex items-center justify-between">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
      <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600">{icon}</div>
    </div>
    <div className="flex items-end gap-2">
      <span className="text-xl font-bold text-slate-800 leading-none tabular-nums">{value}</span>
      {change && (
        <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
          changePositive ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
        }`}>
          {changePositive ? I.arrowUp : I.arrowDown}
          {change}
        </span>
      )}
    </div>
  </div>
)

// ─── Bar Chart (Histograma) — verde corporativo ────────────────────────────────
const HistogramaChart = ({ data, onBarClick, selectedMonth }: {
  data: typeof MOCK_RESUMEN_MENSUAL
  onBarClick?: (idx: number) => void
  selectedMonth: number | null
}) => {
  const allVals = data.flatMap(d => [d.ingresos, d.egresos])
  const maxVal = Math.max(...allVals) * 1.2
  const barW = 24
  const gap = 6
  const groupW = barW * 2 + gap
  const padL = 36
  const padR = 12
  const padT = 16
  const padB = 24
  const svgW = padL + data.length * (groupW + 4) + padR
  const svgH = 180

  const ref = useRef<HTMLDivElement>(null)

  return (
    <div ref={ref} className="bg-white rounded-xl border border-emerald-100/60 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-slate-700">Ingresos vs Egresos</h3>
        <div className="flex items-center gap-3 text-[10px] font-semibold">
          <span className="flex items-center gap-1.5 text-emerald-600"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" /> Ingresos</span>
          <span className="flex items-center gap-1.5 text-amber-700"><span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" /> Egresos</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full" style={{ height: 180 }}>
        {[0, 0.25, 0.5, 0.75, 1].map(r => {
          const y = padT + (1 - r) * (svgH - padT - padB)
          return <line key={r} x1={padL} y1={y} x2={svgW - padR} y2={y} stroke="#f1f5f9" strokeWidth="1" />
        })}
        {data.map((d, i) => {
          const cx = padL + i * (groupW + 4)
          const ih = (d.ingresos / maxVal) * (svgH - padT - padB)
          const eh = (d.egresos / maxVal) * (svgH - padT - padB)
          const isSelected = selectedMonth === i
          return (
            <g key={d.mes} className="cursor-pointer" onClick={() => onBarClick?.(i)}>
              <rect x={cx} y={svgH - padB - ih} width={barW} height={Math.max(ih, 2)} rx={2} fill="#10B981" opacity={isSelected ? 1 : 0.85} className="hover:opacity-100 transition-opacity" />
              <rect x={cx + barW + gap} y={svgH - padB - eh} width={barW} height={Math.max(eh, 2)} rx={2} fill="#F59E0B" opacity={isSelected ? 1 : 0.75} className="hover:opacity-100 transition-opacity" />
              <text x={cx + barW + gap / 2} y={svgH - 5} textAnchor="middle" fontSize="8" fill="#94a3b8" fontWeight="600">{d.mes}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ─── Modal ─────────────────────────────────────────────────────────────────────
const RegistrarMovimientoModal = ({ open, onClose, onSave }: {
  open: boolean; onClose: () => void; onSave: (m: Partial<Movimiento>) => void
}) => {
  const [tipo, setTipo] = useState<TxType>('ingreso')
  const [categoria, setCategoria] = useState<TxCategory>('afiliacion')
  const [concepto, setConcepto] = useState('')
  const [monto, setMonto] = useState('')
  const [metodoPago, setMetodoPago] = useState('Transferencia')
  const [proveedor, setProveedor] = useState('')

  if (!open) return null

  const handleSave = () => {
    const montoNum = parseFloat(monto) || 0
    onSave({
      tipo, categoria, concepto,
      monto: montoNum,
      metodo_pago: metodoPago,
      proveedor_cliente: proveedor,
      estado: 'pendiente',
    })
    setConcepto(''); setMonto(''); setProveedor('')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-emerald-100/60">
          <h2 className="text-base font-bold text-slate-800">Registrar Movimiento</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">{I.x}</button>
        </div>
        <div className="p-5 space-y-4">
          {/* Tipo */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Tipo</label>
            <div className="flex gap-2">
              {(['ingreso', 'egreso'] as const).map(t => (
                <button key={t} onClick={() => setTipo(t)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${
                    tipo === t
                      ? t === 'ingreso' ? 'bg-emerald-50 text-emerald-600 ring-2 ring-emerald-400' : 'bg-amber-50 text-amber-600 ring-2 ring-amber-300'
                      : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                  }`}>
                  {t === 'ingreso' ? 'Ingreso' : 'Egreso'}
                </button>
              ))}
            </div>
          </div>

          {/* Categoría */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Categoría</label>
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.entries(CATEGORIAS) as [TxCategory, typeof CATEGORIAS[TxCategory]][]).map(([key, cat]) => (
                <button key={key} onClick={() => setCategoria(key)}
                  className={`py-1.5 px-3 rounded-lg text-[10px] font-semibold transition-colors text-left ${
                    categoria === key ? 'ring-2 text-slate-700' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                  }`}
                  style={categoria === key ? { '--tw-ring-color': cat.color, backgroundColor: cat.color + '12' } as React.CSSProperties : {}}>
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Concepto */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Concepto</label>
            <input value={concepto} onChange={e => setConcepto(e.target.value)}
              placeholder="Ej: Inscripción curso — Nombre"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 placeholder-slate-300 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-colors" />
          </div>

          {/* Monto */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Monto ($)</label>
            <input value={monto} onChange={e => setMonto(e.target.value.replace(/[^0-9.]/g, ''))}
              placeholder="0.00"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold text-slate-700 placeholder-slate-300 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-colors" />
          </div>

          {/* Método de pago + Proveedor */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Método de Pago</label>
              <select value={metodoPago} onChange={e => setMetodoPago(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-colors bg-white">
                {['Transferencia', 'Depósito', 'Efectivo', 'Tarjeta', 'Cheque'].map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">{tipo === 'ingreso' ? 'Cliente' : 'Proveedor'}</label>
              <input value={proveedor} onChange={e => setProveedor(e.target.value)}
                placeholder="Nombre / RIF"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 placeholder-slate-300 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-colors" />
            </div>
          </div>

          {/* Vinculado (mock info) */}
          <div className="bg-emerald-50/50 border border-emerald-200 rounded-lg px-3 py-2.5 flex items-start gap-2">
            <span className="text-emerald-500 mt-0.5">{I.alert}</span>
            <p className="text-[11px] text-emerald-700">
              <strong>Modo simulación:</strong> Los ingresos por afiliaciones, cursos y preinscripciones se vinculan automáticamente a sus registros originales. Quedará como <em>Pendiente</em> hasta su confirmación.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-emerald-100/60 bg-emerald-50/30 rounded-b-2xl">
          <button onClick={onClose} className="px-3 py-2 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-100 transition-colors">Cancelar</button>
          <button onClick={handleSave}
            disabled={!concepto || !monto}
            className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors transition-opacity flex items-center gap-1.5">
            {I.check} Registrar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Tabla de Movimientos ──────────────────────────────────────────────────────
const TablaMovimientos = ({ data, tipo }: { data: Movimiento[]; tipo?: TxType }) => {
  const filtrados = tipo ? data.filter(m => m.tipo === tipo) : data
  if (filtrados.length === 0) return (
    <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
      <p className="text-sm font-semibold">No hay movimientos</p>
    </div>
  )

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[600px]">
        <thead>
          <tr className="bg-emerald-50/50 border-b border-emerald-100/60">
            {['Fecha', 'Concepto', 'Categoría', 'Total'].map(h => (
              <th key={h} className="px-3 py-2.5 text-left text-[9px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {filtrados.map(m => (
            <tr key={m.id} className="hover:bg-emerald-50/30 transition-colors">
              <td className="px-3 py-2.5 text-[11px] text-slate-500 whitespace-nowrap">{fmtDate(m.fecha)}</td>
              <td className="px-3 py-2.5">
                <p className="text-[11px] font-semibold text-slate-700">{m.concepto}</p>
                <p className="text-[9px] text-slate-400 font-mono">{m.referencia}</p>
              </td>
              <td className="px-3 py-2.5">
                <span className="inline-flex text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: CATEGORIAS[m.categoria].color + '15', color: CATEGORIAS[m.categoria].color }}>
                  {CATEGORIAS[m.categoria].label}
                </span>
              </td>
              <td className={`px-3 py-2.5 text-xs font-bold tabular-nums whitespace-nowrap ${m.tipo === 'ingreso' ? 'text-emerald-600' : 'text-slate-600'}`}>
                {m.tipo === 'ingreso' ? '+' : '-'}{fmt(m.monto)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Libro de Compra / Venta ───────────────────────────────────────────────────
const LibroCompraVenta = ({ tipo, movimientos }: { tipo: 'compra' | 'venta'; movimientos: Movimiento[] }) => {
  const esCompra = tipo === 'compra'
  const movs = movimientos.filter(m => esCompra ? m.tipo === 'egreso' : m.tipo === 'ingreso')

  const total = movs.reduce((s, m) => s + m.monto, 0)

  const [search, setSearch] = useState('')

  const filtrados = search
    ? movs.filter(m => m.concepto.toLowerCase().includes(search.toLowerCase()) || m.documento.toLowerCase().includes(search.toLowerCase()))
    : movs

  const handleExport = () => exportarPDF(tipo, filtrados)

  return (
    <div className="flex flex-col gap-3">
      {/* Encabezado */}
      <div className="bg-white rounded-xl border border-emerald-100/60 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${esCompra ? 'bg-amber-50' : 'bg-emerald-50'}`}>
            <span className={`text-xs font-bold ${esCompra ? 'text-amber-600' : 'text-emerald-600'}`}>
              {esCompra ? 'C' : 'V'}
            </span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-700">Libro de {esCompra ? 'Compra' : 'Venta'}</h3>
            <p className="text-[10px] text-slate-400">Marzo 2026 · {filtrados.length} movimientos</p>
          </div>
        </div>
        <button onClick={handleExport}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors">
          {I.download} Exportar PDF
        </button>
      </div>

      {/* Total general */}
      <div className="bg-emerald-50 rounded-lg p-3 flex items-center justify-between">
        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total {esCompra ? 'Compras' : 'Ventas'}</span>
        <span className="text-base font-bold text-emerald-700 tabular-nums">{fmt(total)}</span>
      </div>

      {/* Búsqueda */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">{I.search}</div>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder={`Buscar por concepto o comprobante...`}
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-xs outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-colors bg-white" />
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-emerald-100/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="bg-emerald-50/50 border-b border-emerald-100/60">
                {['Fecha', 'Comprobante', 'Proveedor / Cliente', 'Concepto', 'Total'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-[9px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtrados.map(m => (
                <tr key={m.id} className="hover:bg-emerald-50/30 transition-colors">
                  <td className="px-3 py-2.5 text-[11px] text-slate-500 whitespace-nowrap">{fmtDate(m.fecha)}</td>
                  <td className="px-3 py-2.5 text-[11px] font-mono font-bold text-slate-600">{m.documento}</td>
                  <td className="px-3 py-2.5 text-[11px] text-slate-600 max-w-[200px] truncate">{m.proveedor_cliente}</td>
                  <td className="px-3 py-2.5 text-[11px] text-slate-500 max-w-[200px] truncate">{m.concepto}</td>
                  <td className={`px-3 py-2.5 text-xs font-bold tabular-nums whitespace-nowrap ${esCompra ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {fmt(m.monto)}
                  </td>
                </tr>
              ))}
            </tbody>
            {filtrados.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-200">
                  <td colSpan={4} className="px-3 py-2.5 text-[10px] font-bold text-slate-600 text-right">Totales</td>
                  <td className="px-3 py-2.5 text-xs font-bold font-mono text-slate-800 tabular-nums">{fmt(total)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Panel Principal ───────────────────────────────────────────────────────────
type FinanceTab = 'dashboard' | 'libro_compra' | 'libro_venta'

const FinancePanel = () => {
  const [tab, setTab] = useState<FinanceTab>('dashboard')
  const [movimientos, setMovimientos] = useState(MOCK_MOVIMIENTOS)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null)

  const ingresos = useMemo(() => movimientos.filter(m => m.tipo === 'ingreso'), [movimientos])
  const egresos  = useMemo(() => movimientos.filter(m => m.tipo === 'egreso'), [movimientos])

  const totalIngresos = useMemo(() => ingresos.reduce((s, m) => s + m.monto, 0), [ingresos])
  const totalEgresos  = useMemo(() => egresos.reduce((s, m) => s + m.monto, 0), [egresos])
  const balance       = totalIngresos - totalEgresos

  const handleSave = (m: Partial<Movimiento>) => {
    const tipo = m.tipo || 'ingreso'
    const nuevo: Movimiento = {
      id: `M-${String(movimientos.length + 1).padStart(3, '0')}`,
      fecha: new Date().toISOString().slice(0, 10),
      tipo,
      categoria: m.categoria || 'otro',
      concepto: m.concepto || '',
      monto: m.monto || 0,
      referencia: `TRN-${String(100000 + movimientos.length + 1)}`,
      vinculado: null,
      metodo_pago: m.metodo_pago || 'Transferencia',
      estado: 'pendiente',
      proveedor_cliente: m.proveedor_cliente || '',
      documento: tipo === 'egreso' ? `FAC-P-2026-${String(movimientos.length + 1).padStart(3, '0')}` : `FAC-2026-${String(movimientos.length + 1).padStart(3, '0')}`,
    }
    setMovimientos(prev => [nuevo, ...prev])
  }

  const TABS: { id: FinanceTab; label: string }[] = [
    { id: 'dashboard',    label: 'Dashboard' },
    { id: 'libro_compra', label: 'Libro de Compra' },
    { id: 'libro_venta',  label: 'Libro de Venta' },
  ]

  return (
    <div className="p-4 sm:p-6 w-full overflow-y-auto h-full space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-start sm:items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Finanzas</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Libros de compra y venta · Flujo de caja — {new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
          </p>
        </div>
        <button onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 transition-colors shadow-sm">
          {I.plus}
          Nuevo Movimiento
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 bg-slate-100 rounded-lg p-0.5 w-fit border border-slate-200/60">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition-colors ${
              tab === t.id
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-600'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Dashboard */}
      {tab === 'dashboard' && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            <StatCard label="Balance Neto"  value={fmt(balance)} change={`${balance >= 0 ? '+' : ''}${((balance / (totalEgresos || 1)) * 100).toFixed(0)}%`} changePositive={balance >= 0} icon={I.balance} />
            <StatCard label="Ingresos"      value={fmt(totalIngresos)} change={`+${movimientos.filter(m => m.tipo === 'ingreso').length} ops`} changePositive icon={I.arrowUp} />
            <StatCard label="Egresos"       value={fmt(totalEgresos)}  change={`${movimientos.filter(m => m.tipo === 'egreso').length} ops`} changePositive={false} icon={I.arrowDown} />
            <StatCard label="Movimientos"   value={String(movimientos.length)} change={`${movimientos.filter(m => m.estado === 'pendiente').length} pend.`} changePositive icon={I.alert} />
          </div>

          {/* Histograma + Últimos movimientos */}
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="flex-1 min-w-0">
              <HistogramaChart data={MOCK_RESUMEN_MENSUAL} onBarClick={i => setSelectedMonth(i)} selectedMonth={selectedMonth} />
              {selectedMonth !== null && (
                <div className="mt-1.5 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-2">
                  <span className="text-emerald-500 mt-0.5">{I.alert}</span>
                  <p className="text-[11px] text-emerald-700">
                    <strong>{MESES[selectedMonth]}:</strong> Ingresos <strong>{fmt(MOCK_RESUMEN_MENSUAL[selectedMonth].ingresos)}</strong> · Egresos <strong>{fmt(MOCK_RESUMEN_MENSUAL[selectedMonth].egresos)}</strong> ·
                    Neto <strong>{fmt(MOCK_RESUMEN_MENSUAL[selectedMonth].ingresos - MOCK_RESUMEN_MENSUAL[selectedMonth].egresos)}</strong>
                  </p>
                </div>
              )}
            </div>

            {/* Últimos movimientos */}
            <div className="w-full lg:w-[280px] flex-shrink-0">
              <div className="bg-white rounded-xl border border-emerald-100/60 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-emerald-100/60">
                  <h3 className="text-xs font-bold text-slate-700">Últimos</h3>
                  <span className="text-[9px] font-bold text-slate-400">{movimientos.filter(m => m.estado === 'pendiente').length} pendientes</span>
                </div>
                <div className="divide-y divide-slate-50 max-h-[280px] overflow-y-auto">
                  {movimientos.slice(0, 5).map(m => (
                    <div key={m.id} className="px-4 py-2.5 flex items-center justify-between gap-2 hover:bg-emerald-50/30 transition-colors">
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold text-slate-700 truncate">{m.concepto}</p>
                        <p className="text-[9px] text-slate-400">{fmtShortDate(m.fecha)} · {m.referencia}</p>
                      </div>
                      <span className={`text-[11px] font-bold tabular-nums whitespace-nowrap ${m.tipo === 'ingreso' ? 'text-emerald-600' : 'text-slate-600'}`}>
                        {m.tipo === 'ingreso' ? '+' : '-'}{fmt(m.monto)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Tabla completa */}
          <div className="bg-white rounded-xl border border-emerald-100/60 overflow-hidden">
            <div className="px-4 py-3 border-b border-emerald-100/60">
              <h3 className="text-xs font-bold text-slate-700">Historial de Transacciones</h3>
            </div>
            <TablaMovimientos data={movimientos} />
          </div>
        </>
      )}

      {/* Libro de Compra */}
      {tab === 'libro_compra' && <LibroCompraVenta tipo="compra" movimientos={movimientos} />}

      {/* Libro de Venta */}
      {tab === 'libro_venta' && <LibroCompraVenta tipo="venta" movimientos={movimientos} />}

      {/* Modal */}
      <RegistrarMovimientoModal open={modalOpen} onClose={() => setModalOpen(false)} onSave={handleSave} />
    </div>
  )
}

export default FinancePanel
