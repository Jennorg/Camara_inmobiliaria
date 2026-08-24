import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { API_URL } from '@/config/env'
import { useAuth } from '@/context/AuthContext'
import { Search, Users, Clock, AlertCircle, Building2 } from 'lucide-react'

// ─── DonutChart ───────────────────────────────────────────────────────────────
interface DonutSlice { label: string; value: number; color: string }

function DonutChart({ 
  slices, 
  title, 
  sub,
  customCenterValue,
  customCenterLabel
}: { 
  slices: DonutSlice[]; 
  title: string; 
  sub?: string;
  customCenterValue?: number;
  customCenterLabel?: string;
}) {
  const sumTotal = slices.reduce((a, s) => a + s.value, 0)
  const centerValue = customCenterValue !== undefined ? customCenterValue : sumTotal
  const centerLabel = customCenterLabel || 'Total'
  const R = 40; const cx = 60; const cy = 60; const STROKE = 12
  let cumulative = 0

  const arcs = slices.map(s => {
    const pct = sumTotal > 0 ? s.value / sumTotal : 0
    const start = cumulative
    cumulative += pct
    return { ...s, pct, start }
  })

  function arcD(start: number, pct: number) {
    const startAngle = start * 2 * Math.PI - Math.PI / 2
    const endAngle = (start + pct) * 2 * Math.PI - Math.PI / 2
    const x1 = cx + R * Math.cos(startAngle)
    const y1 = cy + R * Math.sin(startAngle)
    const x2 = cx + R * Math.cos(endAngle)
    const y2 = cy + R * Math.sin(endAngle)
    return `M ${x1} ${y1} A ${R} ${R} 0 ${pct > 0.5 ? 1 : 0} 1 ${x2} ${y2}`
  }

  return (
    <div className='bg-white rounded-[2rem] p-6 border border-slate-100 flex flex-col gap-4 shadow-sm hover:shadow-md transition-shadow w-full'>
      <div>
        <h3 className='text-sm font-black text-slate-800 uppercase tracking-tight'>{title}</h3>
        {sub && <p className='text-[11px] text-slate-400 font-medium mt-0.5'>{sub}</p>}
      </div>
      <div className='flex flex-col sm:flex-row items-center gap-6'>
        <div className='relative flex-shrink-0'>
          <svg width='120' height='120' viewBox='0 0 120 120' className='drop-shadow-sm'>
            <circle cx={cx} cy={cy} r={R} fill='none' stroke='#f8fafc' strokeWidth={STROKE} />
            {arcs.map((a) => {
              if (a.pct >= 0.999) return <circle key={a.label} cx={cx} cy={cy} r={R} fill='none' stroke={a.color} strokeWidth={STROKE} className='transition-colors duration-700' />
              return a.pct > 0 && <path key={a.label} d={arcD(a.start, a.pct)} fill='none' stroke={a.color} strokeWidth={STROKE} strokeLinecap='round' className='transition-colors duration-700' />
            })}
          </svg>
          <div className='absolute inset-0 flex flex-col items-center justify-center text-center px-1'>
            <span className='text-xl font-black text-slate-900 leading-none'>{centerValue}</span>
            <span className='text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1 truncate max-w-[70px]'>{centerLabel}</span>
          </div>
        </div>
        <div className='flex flex-col gap-2.5 flex-1 w-full min-w-0'>
          {arcs.map((a) => (
            <div key={a.label} className='flex flex-col gap-1'>
              <div className='flex items-center justify-between gap-2'>
                <div className='flex items-center gap-1.5 min-w-0'>
                  <span className='w-2 h-2 rounded-full flex-shrink-0' style={{ background: a.color }} />
                  <span className='text-[10px] font-bold text-slate-500 uppercase tracking-wide truncate'>{a.label}</span>
                </div>
                <span className='text-[10px] font-black text-slate-700 tabular-nums flex-shrink-0'>{a.value}</span>
              </div>
              <div className='w-full h-1 bg-slate-50 rounded-full overflow-hidden'>
                <div className='h-full rounded-full transition-colors duration-1000' style={{ width: `${a.pct * 100}%`, background: a.color }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── BarChartCard ─────────────────────────────────────────────────────────────
function BarChartCard({
  slices,
  title,
  sub,
}: {
  slices: DonutSlice[];
  title: string;
  sub?: string;
}) {
  const maxVal = Math.max(...slices.map(s => s.value), 1);

  return (
    <div className='bg-white rounded-[2rem] p-6 border border-slate-100 flex flex-col justify-between gap-4 shadow-sm hover:shadow-md transition-shadow w-full'>
      <div>
        <h3 className='text-sm font-black text-slate-800 uppercase tracking-tight'>{title}</h3>
        {sub && <p className='text-[11px] text-slate-400 font-medium mt-0.5'>{sub}</p>}
      </div>

      <div className='flex flex-col gap-2.5 flex-1 justify-center'>
        {slices.map((s) => {
          const pct = Math.min(100, Math.round((s.value / maxVal) * 100));
          return (
            <div key={s.label} className='space-y-1'>
              <div className='flex items-center justify-between text-[10px] font-bold'>
                <div className='flex items-center gap-1.5 min-w-0'>
                  <span className='w-2.5 h-2.5 rounded-sm flex-shrink-0' style={{ background: s.color }} />
                  <span className='text-slate-600 uppercase tracking-wide truncate'>{s.label}</span>
                </div>
                <span className='text-slate-900 font-black tabular-nums shrink-0 ml-1'>{s.value} <span className='text-[9px] font-normal text-slate-400'>faltantes</span></span>
              </div>
              <div className='w-full h-1.5 bg-slate-50 rounded-full overflow-hidden'>
                <div 
                  className='h-full rounded-full transition-colors duration-1000' 
                  style={{ width: `${pct}%`, background: s.color }} 
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatRelativeTime(isoString: string): string {
  try {
    if (!isoString) return '';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    
    const diffMs = Date.now() - date.getTime()
    if (diffMs < 0) return 'Hace un momento'
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return 'Hace un momento'
    if (diffMins < 60) return `Hace ${diffMins} min`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `Hace ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays === 1) return 'Ayer'
    if (diffDays < 7) return `Hace ${diffDays} dias`
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return ''
  }
}

const TYPE_CONFIG: Record<string, { label: string; dot: string }> = {
  cibir:   { label: 'CIBIR',     dot: 'bg-emerald-500' },
  cms:     { label: 'CMS',       dot: 'bg-indigo-500'  },
  finance: { label: 'Finanzas',  dot: 'bg-sky-500'     },
  curso:   { label: 'Formacion', dot: 'bg-amber-500'   },
}

// ─── Panel principal ──────────────────────────────────────────────────────────
async function requestAnalyticsData(authHeaders: Record<string, string>, signal?: AbortSignal) {
  const res = await fetch(`${API_URL}/api/analytics`, { headers: { ...authHeaders }, signal })
  if (!res.ok) throw new Error('Error cargando metricas')
  const json = await res.json()
  if (!json.success) throw new Error(json.message || 'Error cargando metricas')
  return json.data
}

const AnalyticsPanel = () => {
  const { token } = useAuth()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const authHeaders = useMemo(() => {
    const h: Record<string, string> = {}
    if (token) h.Authorization = `Bearer ${token}`
    return h
  }, [token])

  const loadAnalytics = useCallback(async (signal: AbortSignal) => {
    setLoading(true)
    try {
      const result = await requestAnalyticsData(authHeaders, signal)
      if (!signal.aborted) setData(result)
    } catch (e: any) {
      if (!signal.aborted) {
        console.error(e)
        setError(e.message || 'Error inesperado')
      }
    } finally {
      if (!signal.aborted) setLoading(false)
    }
  }, [authHeaders])

  useEffect(() => {
    const controller = new AbortController()
    loadAnalytics(controller.signal)
    return () => controller.abort()
  }, [loadAnalytics])

  const kpis             = useMemo(() => data?.kpis             || {}, [data])
  const admissionSlices  = useMemo(() => data?.admissionSlices  || [], [data])
  const memberTypeSlices = useMemo(() => data?.memberTypeSlices || [], [data])
  const corpLogoSlices   = useMemo(() => data?.corpLogoSlices   || [], [data])
  const pendingDataSlices = useMemo(() => data?.pendingDataSlices || [], [data])
  const cibirSlices      = useMemo(() => data?.cibirSlices      || [], [data])
  const preaniSlices     = useMemo(() => data?.preaniSlices     || [], [data])
  const pegiSlices       = useMemo(() => data?.pegiSlices       || [], [data])
  const padiSlices       = useMemo(() => data?.padiSlices       || [], [data])
  const activities       = useMemo(() => data?.activities       || [], [data])

  const afiliacionSlices = useMemo(() => [
    { label: 'Aprobados',  value: kpis.afiliadosAprobados   || 0, color: '#10b981' },
    { label: 'Pendientes', value: kpis.solicitudesPendientes || 0, color: '#f59e0b' },
    { label: 'Rechazados', value: kpis.afiliadosRechazados   || 0, color: '#ef4444' },
  ], [kpis])

  if (loading) {
    return (
      <div className='flex items-center justify-center h-full w-full bg-slate-50/50 py-20'>
        <div className='text-center space-y-4'>
          <Search className='animate-spin w-10 h-10 text-[#00D084] mx-auto' />
          <p className='text-xs font-black uppercase tracking-widest text-slate-400'>Cargando metricas...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className='flex items-center justify-center h-full w-full bg-slate-50/50 py-20 p-6'>
        <div className='text-center p-6 bg-white rounded-3xl border border-slate-100 max-w-sm'>
          <p className='text-sm font-black text-rose-500 uppercase tracking-wide'>Error al cargar analiticas</p>
          <p className='text-xs text-slate-400 mt-2'>{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className='flex flex-col gap-8 p-4 sm:p-8 overflow-y-auto h-full w-full bg-slate-50/50'>

      {/* ══════════════════════════════════════════════════ */}
      {/* 📊 TABLERO DE CONTROL                             */}
      {/* ══════════════════════════════════════════════════ */}
      <section className='space-y-5'>
        <div className='pb-2 border-b-2 border-slate-200'>
          <h2 className='text-sm font-black text-slate-800 uppercase tracking-widest'>Tablero de Control</h2>
          <p className='text-xs text-slate-400 font-medium mt-0.5'>Vista general del gremio</p>
        </div>

        {/* KPIs principales */}
        <div className='flex flex-wrap justify-center gap-4'>
          <div className='group bg-white rounded-[1.75rem] p-5 border border-slate-100 flex flex-col gap-3 hover:shadow-lg hover:-translate-y-0.5 transition-colors transition-transform duration-300 w-72'>
            <div className='flex items-start justify-between gap-2'>
              <p className='text-[10px] font-black text-slate-400 uppercase tracking-widest'>Afiliados Activos</p>
              <div className='w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-500'>
                <Users size={18} className='text-emerald-500' />
              </div>
            </div>
            <p className='text-3xl font-black text-slate-900 leading-none'>{kpis.afiliadosActivos || 0}</p>
            <p className='text-[10px] text-slate-400 font-medium'>Miembros con estatus Afiliado</p>
          </div>
          <div className='group bg-white rounded-[1.75rem] p-5 border border-slate-100 flex flex-col gap-3 hover:shadow-lg hover:-translate-y-0.5 transition-colors transition-transform duration-300 w-72'>
            <div className='flex items-start justify-between gap-2'>
              <p className='text-[10px] font-black text-slate-400 uppercase tracking-widest'>Solicitudes Pendientes</p>
              <div className='w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-500'>
                <Clock size={18} className='text-amber-500' />
              </div>
            </div>
            <p className='text-3xl font-black text-slate-900 leading-none'>{kpis.solicitudesPendientes || 0}</p>
            <p className='text-[10px] text-slate-400 font-medium'>
              {kpis.afiliadosAprobados || 0} aprobados · {kpis.afiliadosRechazados || 0} rechazados
            </p>
          </div>
          <div className='group bg-white rounded-[1.75rem] p-5 border border-slate-100 flex flex-col gap-3 hover:shadow-lg hover:-translate-y-0.5 transition-colors transition-transform duration-300 w-72'>
            <div className='flex items-start justify-between gap-2'>
              <p className='text-[10px] font-black text-slate-400 uppercase tracking-widest'>Logos Corporativos</p>
              <div className='w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-500'>
                <Building2 size={18} className='text-blue-500' />
              </div>
            </div>
            <p className='text-3xl font-black text-slate-900 leading-none'>
              {kpis.afiliadosCorpConLogo || 0} <span className='text-sm text-slate-400 font-bold'>/ {kpis.totalAfiliadosCorp || 0}</span>
            </p>
            <p className='text-[10px] text-slate-400 font-medium'>
              {kpis.totalAfiliadosCorp > 0 ? Math.round(((kpis.afiliadosCorpConLogo || 0) / kpis.totalAfiliadosCorp) * 100) : 0}% de empresas tienen su logo cargado
            </p>
          </div>
        </div>

        {/* Embudo + Tipos de miembro + Logos Corporativos + Información Pendiente */}
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5'>
          <DonutChart slices={admissionSlices}  title='Embudo de Admisión'  sub='Candidatos activos por etapa del proceso' />
          <DonutChart slices={memberTypeSlices} title='Tipos de Miembros'   sub='Distribución de afiliados activos por categoría' />
          <DonutChart slices={corpLogoSlices}   title='Logos Corporativos' sub='Empresas corporativas con logo cargado' />
          <BarChartCard 
            slices={pendingDataSlices} 
            title='Información Pendiente' 
            sub='Campos faltantes en la base de datos' 
          />
        </div>
      </section>

      {/* ══════════════════════════════════════════════════ */}
      {/* 🎓 ADMISIÓN Y PROGRAMAS ACADÉMICOS                */}
      {/* ══════════════════════════════════════════════════ */}
      <section className='space-y-5 pt-2 border-t-2 border-slate-200'>
        <div className='pb-2 border-b-2 border-slate-200'>
          <h2 className='text-sm font-black text-slate-800 uppercase tracking-widest'>Admision y Programas Academicos</h2>
          <p className='text-xs text-slate-400 font-medium mt-0.5'>Solicitudes y distribucion de cohortes especificas</p>
        </div>

        {/* Fila 1: Afiliación + CIBIR */}
        <div className='grid grid-cols-1 md:grid-cols-2 gap-5'>
          <DonutChart slices={afiliacionSlices} title='Solicitudes de Afiliacion' sub='Distribucion real de estados de afiliacion' />
          <DonutChart slices={cibirSlices}      title='Solicitudes CIBIR'         sub='Nivelacion modular - acreditaciones CIBIR' />
        </div>

        {/* Fila 2: Programas académicos */}
        <div className='grid grid-cols-1 md:grid-cols-3 gap-5'>
          <DonutChart slices={preaniSlices} title='Solicitudes PREANI' sub='Preinscripciones al programa PREANI' />
          <DonutChart slices={pegiSlices}   title='Solicitudes PEGI'   sub='Preinscripciones al programa PEGI'   />
          <DonutChart slices={padiSlices}   title='Solicitudes PADI'   sub='Preinscripciones al programa PADI'   />
        </div>
      </section>

      {/* ══════════════════════════════════════════════════ */}
      {/* 🔔 FEED DE ACTIVIDAD                              */}
      {/* ══════════════════════════════════════════════════ */}
      <section className='space-y-5 pt-2 border-t-2 border-slate-200'>
        <div className='pb-2 border-b-2 border-slate-200'>
          <h2 className='text-sm font-black text-slate-800 uppercase tracking-widest'>Feed de Actividad</h2>
          <p className='text-xs text-slate-400 font-medium mt-0.5'>Ultimas {activities.length} notificaciones registradas por el sistema</p>
        </div>

        <div className='bg-white rounded-[2rem] p-4 sm:p-6 border border-slate-100 shadow-sm'>
          <div className='flex flex-col divide-y divide-slate-50'>
            {activities.map((a: any) => {
              const cfg = TYPE_CONFIG[a.type] || { label: 'General', dot: 'bg-slate-400' }
              return (
                <div key={a.id || `${a.titulo}-${a.fecha}`} className='flex items-start gap-4 py-4 hover:bg-slate-50/60 transition-colors px-3 -mx-3 rounded-xl'>
                  {/* Dot */}
                  <div className={`mt-1.5 flex-shrink-0 w-2.5 h-2.5 rounded-full ${cfg.dot}`} />

                  {/* Contenido */}
                  <div className='flex-1 min-w-0 space-y-1'>
                    <div className='flex items-center gap-2'>
                      <p className='text-xs font-black text-slate-800 leading-snug'>{a.titulo}</p>
                    </div>
                    <p className='text-xs text-slate-600 leading-relaxed'>{a.mensaje}</p>
                    <div className='flex items-center gap-2 pt-0.5'>
                      <span className='inline-block text-[9px] font-black px-2 py-0.5 rounded-lg text-emerald-700 bg-emerald-50'>
                        {cfg.label}
                      </span>
                      <span className='text-[10px] text-slate-400'>{formatRelativeTime(a.creado_en)}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

    </div>
  )
}

export default AnalyticsPanel