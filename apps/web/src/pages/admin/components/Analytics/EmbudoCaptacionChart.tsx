import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  AreaChart,
  Area,
  Cell
} from 'recharts'
import {
  Filter,
  Calendar,
  Layers,
  GraduationCap,
  Award,
  TrendingUp,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  BarChart3,
  LineChart
} from 'lucide-react'
import { API_URL } from '@/config/env'
import { useAuth } from '@/context/AuthContext'
import { formatDateLatina, sanitizeDateForInput } from '@/utils/formatters'

export type ViewRouteMode = 'comparativo' | 'cibir' | 'acreditacion'
export type ChartTypeMode = 'embudo' | 'temporal'
export type DatePreset = 'all' | '30d' | '90d' | 'year' | 'custom'

interface EmbudoKpis {
  totalCaptados: number
  totalCibir: number
  totalAcreditacion: number
  totalAfiliados: number
  totalRechazados: number
  pctCibirShare: number
  pctAcreditacionShare: number
  tasaConversionGlobal: number
  tasaConversionCibir: number
  tasaConversionAcreditacion: number
}

interface FunnelStageItem {
  key: string
  name: string
  shortName: string
  stepIndex: number
  cibir: number
  acreditacion: number
  total: number
  cibirActual: number
  acreditacionActual: number
  totalActual: number
  pctCibir: number
  pctAcreditacion: number
  pctTotal: number
}

interface TimelineItem {
  periodo: string
  cibir: number
  acreditacion: number
  total: number
}

const CIBIR_COLOR = '#10b981' // Esmeralda
const ACREDITACION_COLOR = '#6366f1' // Índigo
const TOTAL_COLOR = '#0ea5e9' // Sky

export default function EmbudoCaptacionChart() {
  const { token } = useAuth()
  const [routeMode, setRouteMode] = useState<ViewRouteMode>('comparativo')
  const [chartType, setChartType] = useState<ChartTypeMode>('embudo')
  const [preset, setPreset] = useState<DatePreset>('all')
  const [desde, setDesde] = useState<string>('')
  const [hasta, setHasta] = useState<string>('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [kpis, setKpis] = useState<EmbudoKpis | null>(null)
  const [funnelStages, setFunnelStages] = useState<FunnelStageItem[]>([])
  const [timeline, setTimeline] = useState<TimelineItem[]>([])

  // Ajustar fechas según preset
  const handlePresetChange = (newPreset: DatePreset) => {
    setPreset(newPreset)
    const now = new Date()
    const todayStr = now.toISOString().slice(0, 10)

    if (newPreset === 'all') {
      setDesde('')
      setHasta('')
    } else if (newPreset === '30d') {
      const past = new Date()
      past.setDate(past.getDate() - 30)
      setDesde(past.toISOString().slice(0, 10))
      setHasta(todayStr)
    } else if (newPreset === '90d') {
      const past = new Date()
      past.setDate(past.getDate() - 90)
      setDesde(past.toISOString().slice(0, 10))
      setHasta(todayStr)
    } else if (newPreset === 'year') {
      const startYear = new Date(now.getFullYear(), 0, 1)
      setDesde(startYear.toISOString().slice(0, 10))
      setHasta(todayStr)
    }
  }

  const fetchEmbudoData = useCallback(async (signal?: AbortSignal) => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (desde) params.append('desde', desde)
      if (hasta) params.append('hasta', hasta)

      const res = await fetch(`${API_URL}/api/analytics/embudo?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Error al cargar datos del embudo')
      }

      setKpis(json.data.kpis)
      setFunnelStages(json.data.funnelStages || [])
      setTimeline(json.data.timeline || [])
    } catch (err: any) {
      if (!signal?.aborted) {
        console.error('Error fetching embudo analytics:', err)
        setError(err.message || 'Error al cargar analítica del embudo')
      }
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [token, desde, hasta])

  useEffect(() => {
    const controller = new AbortController()
    fetchEmbudoData(controller.signal)
    return () => controller.abort()
  }, [fetchEmbudoData])

  // Formato para Custom Tooltip del Embudo
  const CustomFunnelTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null

    const stageData = funnelStages.find(s => s.name === label || s.shortName === label)

    return (
      <div className="bg-slate-900/95 text-white border border-slate-700/80 rounded-2xl p-4 shadow-2xl backdrop-blur-md min-w-[240px] text-xs">
        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-1">
          Etapa {stageData ? `0${stageData.stepIndex}` : ''}
        </p>
        <p className="font-black text-sm text-white mb-3">{label}</p>

        <div className="space-y-2 border-t border-slate-800 pt-2.5">
          {routeMode !== 'acreditacion' && (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 text-emerald-300 font-bold">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>Ruta CIBIR:</span>
              </div>
              <div className="text-right">
                <span className="font-black text-white">{stageData?.cibir || 0}</span>
                <span className="text-[10px] text-slate-400 ml-1">({stageData?.pctCibir || 0}%)</span>
              </div>
            </div>
          )}

          {routeMode !== 'cibir' && (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 text-indigo-300 font-bold">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                <span>Acreditación:</span>
              </div>
              <div className="text-right">
                <span className="font-black text-white">{stageData?.acreditacion || 0}</span>
                <span className="text-[10px] text-slate-400 ml-1">({stageData?.pctAcreditacion || 0}%)</span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-800/80 font-black">
            <span className="text-slate-300">Total Acumulado:</span>
            <span className="text-white">{stageData?.total || 0} ({stageData?.pctTotal || 0}%)</span>
          </div>

          {stageData && stageData.totalActual > 0 && (
            <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-400 font-medium">
              <span>En curso actualmente:</span>
              <span className="font-bold text-amber-300">{stageData.totalActual} postulantes</span>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Formato para Custom Tooltip Temporal
  const CustomTimelineTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null

    return (
      <div className="bg-slate-900/95 text-white border border-slate-700/80 rounded-2xl p-4 shadow-2xl backdrop-blur-md min-w-[200px] text-xs">
        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-1">
          Período
        </p>
        <p className="font-black text-sm text-white mb-2.5">{label}</p>
        <div className="space-y-1.5 border-t border-slate-800 pt-2">
          {payload.map((entry: any) => (
            <div key={entry.name} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 font-bold" style={{ color: entry.color }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                <span>{entry.name}:</span>
              </div>
              <span className="font-black text-white">{entry.value}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-[2.5rem] p-6 sm:p-8 border border-slate-100 shadow-sm space-y-8">
      {/* Header y Controles */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 pb-6 border-b border-slate-100">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h3 className="text-base sm:text-lg font-black text-slate-800 uppercase tracking-tight">
              Embudo de Captación: CIBIR vs Acreditación
            </h3>
          </div>
          <p className="text-xs text-slate-400 font-medium">
            Histograma interactivo de conversión y distribución de postulantes por ruta de afiliación.
          </p>
        </div>

        {/* Filtros de Ruta y Tipo de Gráfico */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Selector de Ruta: Comparativo | CIBIR | Acreditación */}
          <div className="flex items-center p-1 bg-slate-100 rounded-2xl border border-slate-200/60">
            <button
              type="button"
              onClick={() => setRouteMode('comparativo')}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                routeMode === 'comparativo'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Layers size={13} />
              <span>Comparativo</span>
            </button>
            <button
              type="button"
              onClick={() => setRouteMode('cibir')}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                routeMode === 'cibir'
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'text-slate-500 hover:text-emerald-700'
              }`}
            >
              <GraduationCap size={13} />
              <span>Solo CIBIR</span>
            </button>
            <button
              type="button"
              onClick={() => setRouteMode('acreditacion')}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                routeMode === 'acreditacion'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-indigo-700'
              }`}
            >
              <Award size={13} />
              <span>Solo Acreditación</span>
            </button>
          </div>

          {/* Selector de Tipo de Gráfico: Embudo vs Temporal */}
          <div className="flex items-center p-1 bg-slate-100 rounded-2xl border border-slate-200/60">
            <button
              type="button"
              onClick={() => setChartType('embudo')}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                chartType === 'embudo'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Ver histograma por etapas del embudo"
            >
              <BarChart3 size={13} />
              <span>Etapas</span>
            </button>
            <button
              type="button"
              onClick={() => setChartType('temporal')}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                chartType === 'temporal'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Ver evolución histórica mensual"
            >
              <LineChart size={13} />
              <span>Evolución</span>
            </button>
          </div>
        </div>
      </div>

      {/* Barra de Filtro de Fechas */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-50/80 p-4 rounded-3xl border border-slate-100">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mr-1">
            <Calendar size={14} className="text-emerald-500" />
            <span>Rango:</span>
          </span>
          {([
            { id: 'all', label: 'Todo el Histórico' },
            { id: '30d', label: 'Últimos 30 días' },
            { id: '90d', label: 'Últimos 90 días' },
            { id: 'year', label: 'Este Año (2026)' },
            { id: 'custom', label: 'Personalizado' },
          ] as const).map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => handlePresetChange(p.id)}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                preset === p.id
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-200/60 border border-slate-200/60'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Inputs de fecha Desde / Hasta (en formato latino con sanitize) */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs shadow-sm">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Desde:</span>
            <input
              type="date"
              value={sanitizeDateForInput(desde)}
              onChange={(e) => {
                setPreset('custom')
                setDesde(e.target.value)
              }}
              className="outline-none text-slate-800 font-bold bg-transparent cursor-pointer text-xs"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs shadow-sm">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Hasta:</span>
            <input
              type="date"
              value={sanitizeDateForInput(hasta)}
              onChange={(e) => {
                setPreset('custom')
                setHasta(e.target.value)
              }}
              className="outline-none text-slate-800 font-bold bg-transparent cursor-pointer text-xs"
            />
          </div>

          {(desde || hasta) && (
            <button
              type="button"
              onClick={() => handlePresetChange('all')}
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"
              title="Restablecer fechas"
            >
              <RotateCcw size={14} />
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards de Conversión */}
      {kpis && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-100/80 space-y-1">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Postulantes Totales</p>
            <p className="text-2xl font-black text-slate-900">{kpis.totalCaptados}</p>
            <p className="text-[10px] text-slate-500 font-medium">
              CIBIR: <b className="text-emerald-600">{kpis.totalCibir}</b> ({kpis.pctCibirShare}%) · Acred.: <b className="text-indigo-600">{kpis.totalAcreditacion}</b> ({kpis.pctAcreditacionShare}%)
            </p>
          </div>

          <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-100/80 space-y-1">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Conversión Global</p>
            <p className="text-2xl font-black text-emerald-600">{kpis.tasaConversionGlobal}%</p>
            <p className="text-[10px] text-slate-500 font-medium">
              {kpis.totalAfiliados} culminaron el proceso
            </p>
          </div>

          <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-100/80 space-y-1">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Conversión CIBIR</p>
            <p className="text-2xl font-black text-emerald-600">{kpis.tasaConversionCibir}%</p>
            <p className="text-[10px] text-slate-500 font-medium">
              Ruta formación modular
            </p>
          </div>

          <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-100/80 space-y-1">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Conversión Acreditación</p>
            <p className="text-2xl font-black text-indigo-600">{kpis.tasaConversionAcreditacion}%</p>
            <p className="text-[10px] text-slate-500 font-medium">
              Ruta experiencia / baremo
            </p>
          </div>

          <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-100/80 space-y-1 col-span-2 sm:col-span-1">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Rechazados</p>
            <p className="text-2xl font-black text-rose-500">{kpis.totalRechazados}</p>
            <p className="text-[10px] text-slate-500 font-medium">
              Desestimados / no conformes
            </p>
          </div>
        </div>
      )}

      {/* Visualización Gráfica con Recharts */}
      <div className="relative min-h-[360px] w-full pt-4">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-xs z-10">
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Actualizando analítica...</p>
            </div>
          </div>
        ) : null}

        {chartType === 'embudo' ? (
          // Histograma de Etapas del Embudo
          <div className="w-full h-80 sm:h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={funnelStages}
                margin={{ top: 20, right: 20, left: -10, bottom: 20 }}
                barSize={routeMode === 'comparativo' ? 24 : 36}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="shortName"
                  stroke="#94a3b8"
                  fontSize={11}
                  fontWeight={800}
                  tickLine={false}
                  dy={10}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  fontWeight={700}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<CustomFunnelTooltip />} />
                <Legend
                  verticalAlign="top"
                  align="right"
                  wrapperStyle={{ paddingBottom: '20px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }}
                />

                {routeMode !== 'acreditacion' && (
                  <Bar
                    dataKey="cibir"
                    name="CIBIR (Formación)"
                    fill={CIBIR_COLOR}
                    radius={[8, 8, 0, 0]}
                    animationDuration={900}
                  />
                )}

                {routeMode !== 'cibir' && (
                  <Bar
                    dataKey="acreditacion"
                    name="Acreditación (Experiencia)"
                    fill={ACREDITACION_COLOR}
                    radius={[8, 8, 0, 0]}
                    animationDuration={900}
                  />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          // Histograma de Evolución Temporal
          <div className="w-full h-80 sm:h-96">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={timeline}
                margin={{ top: 20, right: 20, left: -10, bottom: 20 }}
              >
                <defs>
                  <linearGradient id="gradCibir" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CIBIR_COLOR} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={CIBIR_COLOR} stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="gradAcred" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={ACREDITACION_COLOR} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={ACREDITACION_COLOR} stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="periodo"
                  stroke="#94a3b8"
                  fontSize={11}
                  fontWeight={800}
                  tickLine={false}
                  dy={10}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  fontWeight={700}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<CustomTimelineTooltip />} />
                <Legend
                  verticalAlign="top"
                  align="right"
                  wrapperStyle={{ paddingBottom: '20px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }}
                />

                {routeMode !== 'acreditacion' && (
                  <Area
                    type="monotone"
                    dataKey="cibir"
                    name="CIBIR"
                    stroke={CIBIR_COLOR}
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#gradCibir)"
                    animationDuration={1000}
                  />
                )}

                {routeMode !== 'cibir' && (
                  <Area
                    type="monotone"
                    dataKey="acreditacion"
                    name="Acreditación"
                    stroke={ACREDITACION_COLOR}
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#gradAcred)"
                    animationDuration={1000}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Desglose de Pasos y Cuellos de Botella */}
      <div className="pt-6 border-t border-slate-100">
        <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 mb-4 flex items-center gap-2">
          <TrendingUp size={15} className="text-emerald-600" />
          <span>Detalle de Retención por Etapa</span>
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
          {funnelStages.map((st) => (
            <div
              key={st.key}
              className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col justify-between gap-2 hover:border-emerald-200 transition-colors"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Paso 0{st.stepIndex}</span>
                  <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                    {routeMode === 'cibir' ? st.pctCibir : routeMode === 'acreditacion' ? st.pctAcreditacion : st.pctTotal}%
                  </span>
                </div>
                <p className="text-xs font-black text-slate-800 uppercase tracking-tight mt-1 line-clamp-1" title={st.name}>
                  {st.shortName}
                </p>
              </div>

              <div className="space-y-1 pt-1 border-t border-slate-200/60 text-[10px]">
                <div className="flex justify-between font-bold text-slate-600">
                  <span>Acumulado:</span>
                  <span className="text-slate-900 font-black">
                    {routeMode === 'cibir' ? st.cibir : routeMode === 'acreditacion' ? st.acreditacion : st.total}
                  </span>
                </div>
                <div className="flex justify-between font-medium text-slate-500 text-[9px]">
                  <span>En curso:</span>
                  <span className="text-amber-600 font-bold">
                    {routeMode === 'cibir' ? st.cibirActual : routeMode === 'acreditacion' ? st.acreditacionActual : st.totalActual}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
