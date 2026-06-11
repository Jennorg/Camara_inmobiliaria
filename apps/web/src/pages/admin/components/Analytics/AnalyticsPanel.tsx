import React from 'react'
import { 
  BookOpen, 
  Calendar, 
  TrendingDown, 
  TrendingUp, 
  Users as UsersIcon, 
  Eye, 
  DollarSign, 
  BarChart2, 
  FileText as FileIcon, 
  GraduationCap as GradIcon 
} from 'lucide-react'

// ─── SVG mini-helpers ─────────────────────────────────────────────────────────
function buildSmoothedPath(points: [number, number][]): string {
  if (points.length < 2) return ''
  const [sx, sy] = points[0]
  let d = `M ${sx} ${sy}`
  for (let i = 1; i < points.length; i++) {
    const [cx, cy] = points[i - 1]
    const [nx, ny] = points[i]
    const mx = (cx + nx) / 2
    d += ` C ${mx} ${cy} ${mx} ${ny} ${nx} ${ny}`
  }
  return d
}

// ─── Shared KPI card ──────────────────────────────────────────────────────────
interface KpiCardProps {
  label: string
  value: string | number
  sub?: string
  change?: string
  positive?: boolean
  accent?: string
  icon: React.ReactNode
}

const KpiCard = ({ label, value, sub, change, positive = true, accent = 'bg-emerald-50', icon }: KpiCardProps) => (
  <div className='group bg-white rounded-3xl p-5 border border-slate-100 flex flex-col gap-3 w-full transition-all duration-300 hover:shadow-xl hover:shadow-slate-200/50 hover:-translate-y-1 relative overflow-hidden'>
    <div className='absolute -right-4 -top-4 w-24 h-24 bg-slate-50 rounded-full opacity-50 group-hover:scale-110 transition-transform duration-500' />
    
    <div className='flex items-center justify-between gap-2 relative z-10'>
      <span className='text-[10px] font-black uppercase tracking-widest text-slate-400'>{label}</span>
      <div className={`flex-shrink-0 w-10 h-10 rounded-2xl ${accent} flex items-center justify-center shadow-sm`}>{icon}</div>
    </div>
    
    <div className='flex flex-col items-start gap-1 relative z-10'>
      <p className='text-2xl font-black text-slate-900 leading-none tracking-tight'>{value}</p>
      {sub && <p className='text-[10px] text-slate-400 font-medium'>{sub}</p>}
      {change && (
        <span className={[
          'text-[10px] font-black px-2 py-0.5 rounded-full inline-flex items-center gap-1 mt-1',
          positive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500',
        ].join(' ')}>
          {positive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
          {change}
        </span>
      )}
    </div>
  </div>
)

// ─── Sparkline area chart ─────────────────────────────────────────────────────
interface SparklineProps {
  data: number[]
  labels?: string[]
  color?: string
  fill?: string
  height?: number
  label?: string
  sub?: string
}

const SparklineChart = ({ data, labels, color = '#10b981', fill = 'url(#gSpark)', height = 120, label, sub }: SparklineProps) => {
  const W = 440; const H = height
  const PAD = { top: 15, right: 10, bottom: 25, left: 10 }
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const min = Math.min(...data) * 0.9
  const max = Math.max(...data) * 1.05
  const norm = (v: number) => (v - min) / (max - min)
  const xOf = (i: number) => PAD.left + (i / (data.length - 1)) * innerW
  const yOf = (v: number) => PAD.top + (1 - norm(v)) * innerH
  const pts: [number, number][] = data.map((v, i) => [xOf(i), yOf(v)])
  const line = buildSmoothedPath(pts)
  const area = line + ` L ${xOf(data.length - 1)} ${PAD.top + innerH} L ${xOf(0)} ${PAD.top + innerH} Z`

  return (
    <div className='bg-white rounded-[2rem] p-6 border border-slate-100 flex flex-col gap-4 shadow-sm hover:shadow-md transition-shadow'>
      {label && (
        <div className='flex items-center justify-between'>
          <div>
            <h3 className='text-sm font-black text-slate-800 uppercase tracking-tight'>{label}</h3>
            {sub && <p className='text-[11px] text-slate-400 font-medium mt-0.5'>{sub}</p>}
          </div>
          <div className='flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-lg'>
            <span className='w-1.5 h-1.5 rounded-full' style={{ background: color }} />
            <span className='text-[9px] font-bold text-slate-500 uppercase'>Tiempo Real</span>
          </div>
        </div>
      )}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height="auto"
        preserveAspectRatio="xMidYMid meet"
        style={{ display: 'block' }}
      >
        <defs>
          <linearGradient id='gSpark' x1='0' y1='0' x2='0' y2='1'>
            <stop offset='0%' stopColor={color} stopOpacity='0.25' />
            <stop offset='100%' stopColor={color} stopOpacity='0.02' />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <path d={area} fill={fill} />
        <path d={line} fill='none' stroke={color} strokeWidth='3' strokeLinecap='round' strokeLinejoin='round' filter="url(#glow)" />
        <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r='5' fill={color} stroke="white" strokeWidth="2" />
        {labels && labels.map((l, i) => (
          <text key={l} x={xOf(i)} y={H - 4} textAnchor='middle' fontSize='10' fontWeight="700" fill='#cbd5e1'>{l}</text>
        ))}
      </svg>
    </div>
  )
}

// ─── Donut chart ──────────────────────────────────────────────────────────────
interface DonutSlice { label: string; value: number; color: string }

const DonutChart = ({ slices, title, sub }: { slices: DonutSlice[]; title: string; sub?: string }) => {
  const total = slices.reduce((a, s) => a + s.value, 0)
  const R = 40; const cx = 60; const cy = 60; const STROKE = 12
  let cumulative = 0

  const arcs = slices.map(s => {
    const pct = s.value / total
    const start = cumulative
    cumulative += pct
    return { ...s, pct, start }
  })

  function arcD(start: number, pct: number) {
    const r = R
    const startAngle = start * 2 * Math.PI - Math.PI / 2
    const endAngle = (start + pct) * 2 * Math.PI - Math.PI / 2
    const x1 = cx + r * Math.cos(startAngle)
    const y1 = cy + r * Math.sin(startAngle)
    const x2 = cx + r * Math.cos(endAngle)
    const y2 = cy + r * Math.sin(endAngle)
    const large = pct > 0.5 ? 1 : 0
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`
  }

  return (
    <div className='bg-white rounded-[2rem] p-6 border border-slate-100 flex flex-col gap-4 shadow-sm hover:shadow-md transition-shadow'>
      <div>
        <h3 className='text-sm font-black text-slate-800 uppercase tracking-tight'>{title}</h3>
        {sub && <p className='text-[11px] text-slate-400 font-medium mt-0.5'>{sub}</p>}
      </div>
      <div className='flex flex-col sm:flex-row items-center gap-6'>
        <div className='relative'>
          <svg width='120' height='120' viewBox='0 0 120 120' className='flex-shrink-0 drop-shadow-sm'>
            <circle cx={cx} cy={cy} r={R} fill='none' stroke='#f8fafc' strokeWidth={STROKE} />
            {arcs.map((a, i) => (
              <path
                key={i}
                d={arcD(a.start, a.pct)}
                fill='none'
                stroke={a.color}
                strokeWidth={STROKE}
                strokeLinecap='round'
                className="transition-all duration-700"
              />
            ))}
          </svg>
          <div className='absolute inset-0 flex flex-col items-center justify-center'>
            <span className='text-xl font-black text-slate-900 leading-none'>{total}</span>
            <span className='text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1'>Total</span>
          </div>
        </div>
        <div className='flex flex-col gap-2.5 flex-1 w-full'>
          {arcs.map((a, i) => (
            <div key={i} className='flex flex-col gap-1'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-1.5'>
                  <span className='w-1.5 h-1.5 rounded-full' style={{ background: a.color }} />
                  <span className='text-[10px] font-bold text-slate-500 uppercase tracking-wide'>{a.label}</span>
                </div>
                <span className='text-[10px] font-black text-slate-700 tabular-nums'>{a.value}</span>
              </div>
              <div className='w-full h-1 bg-slate-50 rounded-full overflow-hidden'>
                <div className='h-full rounded-full transition-all duration-1000' style={{ width: `${a.pct * 100}%`, background: a.color }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Horizontal bar chart ─────────────────────────────────────────────────────
interface BarItem { label: string; value: number; max: number; color?: string }

const HorizontalBars = ({ items, title, sub }: { items: BarItem[]; title: string; sub?: string }) => (
  <div className='bg-white rounded-[2rem] p-6 border border-slate-100 flex flex-col gap-5 shadow-sm'>
    <div>
      <h3 className='text-sm font-black text-slate-800 uppercase tracking-tight'>{title}</h3>
      {sub && <p className='text-[11px] text-slate-400 font-medium mt-0.5'>{sub}</p>}
    </div>
    <div className='flex flex-col gap-4'>
      {items.map((item, i) => (
        <div key={i} className='flex flex-col gap-1.5'>
          <div className='flex items-center justify-between'>
            <span className='text-[11px] font-bold text-slate-600 truncate max-w-[200px] uppercase tracking-wide'>{item.label}</span>
            <span className='text-[10px] font-black text-slate-900 tabular-nums bg-slate-50 px-2 py-0.5 rounded-md'>
              {item.value} / {item.max}
            </span>
          </div>
          <div className='h-2.5 bg-slate-50 rounded-full overflow-hidden border border-slate-100/50 p-[1px]'>
            <div
              className='h-full rounded-full transition-all duration-1000 shadow-sm'
              style={{ width: `${(item.value / item.max) * 100}%`, background: item.color ?? '#10b981' }}
            />
          </div>
        </div>
      ))}
    </div>
  </div>
)

// ─── Recent activity feed ─────────────────────────────────────────────────────
interface Activity { time: string; text: string; type: 'cibir' | 'curso' | 'cms' | 'finance' }

const ACTIVITIES: Activity[] = [
  { time: 'Hace 8 min', text: 'Daniela Rojas aprobada en CIBIR', type: 'cibir' },
  { time: 'Hace 22 min', text: 'Artículo "Penthouse City Views" publicado', type: 'cms' },
  { time: 'Hace 1h', text: 'Transacción $2,450 — Rental Income registrada', type: 'finance' },
  { time: 'Hace 2h', text: 'Andrés Páez aprobado en CIBIR', type: 'cibir' },
  { time: 'Hace 3h', text: 'Nuevo inscrito: Diplomado Derecho Inmobiliario', type: 'curso' },
  { time: 'Hace 5h', text: 'Artículo "Mercado Q4" enviado a revisión', type: 'cms' },
  { time: 'Hoy 09:00', text: 'Transferencia $6,500 — Commercial Lease Payment', type: 'finance' },
]

const ACTIVITY_COLORS: Record<Activity['type'], string> = {
  cibir: 'bg-emerald-500',
  cms: 'bg-indigo-500',
  finance: 'bg-sky-500',
  curso: 'bg-amber-500',
}
const ACTIVITY_LABELS: Record<Activity['type'], string> = {
  cibir: 'CIBIR',
  cms: 'CMS',
  finance: 'Finanzas',
  curso: 'Formación',
}

// ─── Analytics Data ───────────────────────────────────────────────────────────
const VISITS_DATA = [820, 940, 880, 1100, 1250, 1080, 1320, 1180, 1400, 1350, 1520, 1650]
const VISITS_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const CIBIR_SLICES: DonutSlice[] = [
  { label: 'Aprobados', value: 18, color: '#10b981' },
  { label: 'Pendientes', value: 3, color: '#f59e0b' },
  { label: 'Rechazados', value: 4, color: '#ef4444' },
]

const ARTICLE_SLICES: DonutSlice[] = [
  { label: 'Publicados', value: 24, color: '#6366f1' },
  { label: 'Borradores', value: 7, color: '#94a3b8' },
  { label: 'Revisión', value: 3, color: '#f59e0b' },
]

const CURSO_BARS: BarItem[] = [
  { label: 'Diplomado Derecho Inmobiliario', value: 18, max: 25, color: '#6366f1' },
  { label: 'Marketing Digital Real Estate', value: 30, max: 30, color: '#10b981' },
  { label: 'Tasación de Inmuebles Urbanos', value: 12, max: 20, color: '#f59e0b' },
  { label: 'Neuroventas para Corredores', value: 25, max: 25, color: '#ef4444' },
]

const INCOME_DATA = [85000, 92000, 78000, 110000, 124500, 105000, 118000, 101000, 130000, 112000, 140000, 128400]

// ─── Main panel ───────────────────────────────────────────────────────────────
const AnalyticsPanel = () => (
  <div className='flex flex-col gap-6 sm:gap-8 p-4 sm:p-8 overflow-y-auto h-full w-full bg-slate-50/50'>

    {/* ── KPI Row ─────────────────────────────────────────── */}
    <div className='grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4 sm:gap-5'>
      <KpiCard
        label='Afiliados Activos'
        value='347'
        change='+12'
        positive
        accent='bg-emerald-50'
        icon={<UsersIcon size={20} className='text-emerald-500' />}
      />
      <KpiCard
        label='Visitas este mes'
        value='1,650'
        change='+8.6%'
        positive
        accent='bg-blue-50'
        icon={<Eye size={20} className='text-blue-500' />}
      />
      <KpiCard
        label='Balance Total'
        value='$124,500'
        change='+4.6%'
        positive
        accent='bg-emerald-50'
        icon={<DollarSign size={20} className='text-emerald-500' />}
      />
      <KpiCard
        label='Ingreso Mensual'
        value='$28,400'
        change='+9%'
        positive
        accent='bg-blue-50'
        icon={<BarChart2 size={20} className='text-blue-500' />}
      />
      <KpiCard
        label='Artículos'
        value='34'
        sub='24 publicados · 10 en proceso'
        accent='bg-indigo-50'
        icon={<FileIcon size={20} className='text-indigo-500' />}
      />
      <KpiCard
        label='CIBIR Pendientes'
        value='3'
        sub='18 aprobados · 4 rechazados'
        positive={false}
        accent='bg-amber-50'
        icon={<GradIcon size={20} className='text-amber-500' />}
      />
    </div>

    {/* ── Charts row 1 ────────────────────────────────────── */}
    <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
      <div className='lg:col-span-2'>
        <SparklineChart
          data={VISITS_DATA}
          labels={VISITS_LABELS}
          color='#6366f1'
          fill='url(#gSpark2)'
          height={140}
          label='Visitas al sitio web'
          sub='Tráfico mensual — Ene a Dic 2025'
        />
      </div>
      <DonutChart
        slices={CIBIR_SLICES}
        title='Solicitudes CIBIR'
        sub='Estado actual del programa'
      />
    </div>

    {/* ── Charts row 2 ────────────────────────────────────── */}
    <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
      <div className='lg:col-span-2'>
        <SparklineChart
          data={INCOME_DATA}
          labels={VISITS_LABELS}
          color='#10b981'
          fill='url(#gSpark)'
          height={140}
          label='Flujo de Ingresos'
          sub='Ingresos mensuales en USD — 2025'
        />
      </div>
      <DonutChart
        slices={ARTICLE_SLICES}
        title='Estado de Artículos'
        sub='CMS — contenido publicado'
      />
    </div>

    {/* ── Charts row 3 ────────────────────────────────────── */}
    <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
      <HorizontalBars
        items={CURSO_BARS}
        title='Inscripción por Curso'
        sub='Cupos ocupados sobre total disponible'
      />

      {/* Activity feed */}
      <div className='bg-white rounded-[2rem] p-6 border border-slate-100 flex flex-col gap-5 shadow-sm'>
        <div className='flex items-center justify-between'>
          <div>
            <h3 className='text-sm font-black text-slate-800 uppercase tracking-tight'>Actividad Reciente</h3>
            <p className='text-[11px] text-slate-400 font-medium mt-0.5'>Últimos eventos de todos los módulos</p>
          </div>
          <button className='text-[10px] font-black text-indigo-500 uppercase tracking-widest hover:text-indigo-600 transition-colors'>Ver Todo</button>
        </div>
        <div className='flex flex-col gap-0'>
          {ACTIVITIES.map((a, i) => (
            <div key={i} className='flex items-start gap-4 py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors px-2 -mx-2 rounded-xl'>
              <div className={`mt-1.5 flex-shrink-0 w-2 h-2 rounded-full ${ACTIVITY_COLORS[a.type]} shadow-sm`} />
              <div className='flex-1 min-w-0'>
                <p className='text-xs font-bold text-slate-700 leading-snug tracking-tight'>{a.text}</p>
                <p className='text-[10px] text-slate-400 font-medium mt-1'>{a.time}</p>
              </div>
              <span className={`flex-shrink-0 text-[9px] font-black px-2 py-0.5 rounded-lg text-white ${ACTIVITY_COLORS[a.type]} shadow-xs`}>
                {ACTIVITY_LABELS[a.type]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>

    {/* ── Summary stats ────────────────────────────────────── */}
    <div className='grid grid-cols-2 sm:grid-cols-4 gap-5 mb-6'>
      {[
        { label: 'Cursos Activos', value: '2', icon: <BookOpen size={24} className="text-indigo-500" />, accent: 'bg-indigo-50' },
        { label: 'Próximos Cursos', value: '1', icon: <Calendar size={24} className="text-amber-500" />, accent: 'bg-amber-50' },
        { label: 'Gastos del Mes', value: '$12,150', icon: <TrendingDown size={24} className="text-rose-500" />, accent: 'bg-rose-50' },
        { label: 'Ganancia Neta', value: '$16,250', icon: <TrendingUp size={24} className="text-emerald-500" />, accent: 'bg-emerald-50' },
      ].map(s => (
        <div key={s.label} className='group bg-white rounded-[1.5rem] p-5 border border-slate-100 flex items-center gap-4 transition-all duration-300 hover:shadow-lg hover:-translate-y-1'>
          <div className={`w-12 h-12 rounded-2xl ${s.accent} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-500`}>
            {s.icon}
          </div>
          <div>
            <p className='text-[10px] font-black text-slate-400 uppercase tracking-widest'>{s.label}</p>
            <p className='text-lg font-black text-slate-900 leading-none mt-1'>{s.value}</p>
          </div>
        </div>
      ))}
    </div>

  </div>
)

export default AnalyticsPanel
