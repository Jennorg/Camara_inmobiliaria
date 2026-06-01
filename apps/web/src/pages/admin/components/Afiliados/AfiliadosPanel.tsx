import React, { useEffect, useMemo, useState } from 'react'
import { API_URL } from '@/config/env'
import { useAuth } from '@/context/AuthContext'
import { formatNombreCard, formatRif } from '@/utils/formatters'
import { EstatusAfiliado, AfiliadoDTO } from '@/types/afiliados'
import { FileText, ExternalLink, Download, Award, GraduationCap, FileDown, ClipboardList, Calendar, ShieldCheck, CreditCard, Check } from 'lucide-react'
import ExportAfiliadosModal from '@/pages/admin/components/Afiliados/export/ExportAfiliadosModal'
import EstablecerAccesoAfiliado from '@/pages/admin/components/Users/EstablecerAccesoAfiliado'
import type { ExportTipoFilter } from '@/pages/admin/components/Afiliados/export/filterAfiliadosForExport'
import Swal from 'sweetalert2'

const AFILIACION_STEPS_FLOW = [
  { label: 'Preinscripción', desc: 'Registro inicial de datos básicos', icon: ClipboardList, labelShort: 'Preins.' },
  { label: 'Expediente', desc: 'Carga y revisión de documentación', icon: FileText, labelShort: 'Exped.' },
  { label: 'Entrevista', desc: 'Cita presencial con la junta directiva', icon: Calendar, labelShort: 'Entrev.' },
  { label: 'Verificación', desc: 'Evaluación de perfil y referencias', icon: ShieldCheck, labelShort: 'Verif.' },
  { label: 'CIBIR', desc: 'Acreditación o nivelación de conocimientos', icon: GraduationCap, labelShort: 'CIBIR' },
  { label: 'Inscripción', desc: 'Aprobación final y pago de arancel', icon: CreditCard, labelShort: 'Inscr.' },
  { label: 'Afiliación', desc: 'Miembro activo de la Cámara', icon: Check, labelShort: 'Afil.' }
]

function DocLink({ label, url, detail, compact = false }: { label: string, url?: string | null, detail?: string | null, compact?: boolean }) {
  if (!url) return (
    <div className={`flex items-center justify-between p-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/30 ${compact ? 'py-2' : ''}`}>
      <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">{label}</span>
      <span className="text-[10px] text-slate-300 italic font-medium">No cargado</span>
    </div>
  )

  return (
    <a 
      href={url} 
      target="_blank" 
      rel="noopener noreferrer"
      className={`flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50 hover:bg-white hover:border-emerald-200 hover:shadow-sm transition-all group ${compact ? 'py-2' : ''}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
          <FileText size={16} />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{label}</span>
          <span className="text-[10px] font-bold text-slate-600 truncate">{detail ? `Por: ${detail}` : 'Ver documento'}</span>
        </div>
      </div>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 group-hover:text-emerald-500 transition-colors">
        <ExternalLink size={14} />
      </div>
    </a>
  )
}

export default function AfiliadosPanel() {
  const { token } = useAuth()
  const authHeaders = useMemo(() => {
    const h: Record<string, string> = {}
    if (token) h.Authorization = `Bearer ${token}`
    return h
  }, [token])

  const [estatus, setEstatus] = useState<'Todos' | EstatusAfiliado>('Todos')
  const [filterTipo, setFilterTipo] = useState<'Todos' | 'Natural' | 'Corporativo' | 'Agente Corporativo'>('Todos')
  const [items, setItems] = useState<AfiliadoDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<AfiliadoDTO | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const qs = new URLSearchParams()
      if (estatus !== 'Todos') qs.set('estatus', estatus)
      if (filterTipo !== 'Todos') qs.set('tipo_afiliado', filterTipo)
      
      const res = await fetch(`${API_URL}/api/afiliados?${qs.toString()}`, { headers: authHeaders })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'Error cargando afiliados')
      setItems(json.data as AfiliadoDTO[])
    } catch (e: unknown) {
      const err = e as Error
      setError(err.message || 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }

  const loadDetail = async (id: number) => {
    setDetailLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_URL}/api/afiliados/${id}`, { headers: authHeaders })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'Error cargando detalle')
      setSelected(json.data as AfiliadoDTO)
    } catch (e: unknown) {
      const err = e as Error
      setError(err.message || 'Error inesperado')
    } finally {
      setDetailLoading(false)
    }
  }

  const updateField = async (field: keyof AfiliadoDTO, value: any) => {
    if (!selected) return
    try {
      const res = await fetch(`${API_URL}/api/afiliados/${selected.id_afiliado}`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value })
      })
      if (res.ok) {
        await loadDetail(selected.id_afiliado)
        if (['estatus', 'nombre_completo', 'codigo', 'tipo_afiliado'].includes(field)) await load()
      }
    } catch (err) { console.error(err) }
  }

  useEffect(() => { load() }, []) // initial
  useEffect(() => { load() }, [estatus, filterTipo]) // reload on filter

  const procesar = async (id: number, action: 'aprobar' | 'rechazar') => {
    setError('')
    try {
      const res = await fetch(`${API_URL}/api/afiliados/${id}/${action}`, { method: 'PATCH', headers: authHeaders })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'No se pudo procesar')
      await load()
      await loadDetail(id)
    } catch (e: unknown) {
      const err = e as Error
      setError(err.message || 'Error inesperado')
    }
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-[360px_1fr] grid-rows-1 h-full w-full overflow-hidden relative">
      {/* List */}
      <div className="flex flex-col bg-white border-r border-gray-100 overflow-hidden min-h-0">
        <div className="p-4 border-b border-gray-100 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Afiliados (CIBIR)</h3>
              <p className="text-xs text-slate-400 mt-0.5">Gestión de candidatos, aprobaciones y estatus.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowExportModal(true)}
              title="Exportar listado en PDF"
              className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100 transition-colors text-[10px] font-bold uppercase tracking-wider"
            >
              <FileDown size={14} />
              PDF
            </button>
          </div>
          
          <div className="flex flex-col gap-2">
            <select
              value={estatus}
              onChange={(e) => setEstatus(e.target.value as any)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-[11px] font-bold text-slate-700 bg-slate-50"
            >
              <option value="Todos">Todos los estados</option>
              <optgroup label="Proceso de Afiliación">
                <option value="1_PREINSCRIPCION">1. Preinscripción</option>
                <option value="2_EXPEDIENTE">2. Expediente</option>
                <option value="3_ENTREVISTA">3. Entrevista</option>
                <option value="4_VERIFICACION">4. Verificación</option>
                <option value="5_CIBIR">5. CIBIR</option>
                <option value="6_INSCRIPCION">6. Inscripción</option>
              </optgroup>
              <optgroup label="Estados Finales">
                <option value="Afiliado">Afiliado (CIBIR)</option>
                <option value="Moroso">Moroso</option>
                <option value="Suspendido">Suspendido</option>
                <option value="Rechazado">Rechazado</option>
              </optgroup>
            </select>

            <div className="flex gap-2">
              <select
                value={filterTipo}
                onChange={(e) => setFilterTipo(e.target.value as any)}
                className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-[11px] font-bold text-slate-700 bg-slate-50"
              >
                <option value="Todos">Todos los tipos</option>
                <option value="Natural">Agentes Independientes</option>
                <option value="Agente Corporativo">Agentes Corporativos</option>
                <option value="Corporativo">Corporativos</option>
              </select>
              <button
                onClick={load}
                className="px-3 py-2 rounded-xl bg-slate-100 text-slate-600 text-[11px] font-bold hover:bg-slate-200 transition-colors"
              >
                Refrescar
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {loading ? (
            <div className="p-4 text-center text-xs text-slate-400 font-semibold uppercase tracking-widest mt-10">Cargando...</div>
          ) : error ? (
            <div className="p-4 text-center text-xs text-red-500 mt-10">{error}</div>
          ) : items.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-400 mt-10">Sin resultados.</div>
          ) : (
            items.map(a => (
              <button
                key={a.id_afiliado}
                onClick={() => loadDetail(a.id_afiliado)}
                className={['w-full text-left px-4 py-3.5 transition-colors flex flex-col gap-1',
                  selected?.id_afiliado === a.id_afiliado ? 'bg-[#E9FAF4]' : 'hover:bg-slate-50',
                ].join(' ')}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold text-slate-800">{a.nombre_completo}</span>

                    <span className={`text-[9px] font-black uppercase tracking-widest ${
                      a.tipo_afiliado === 'Corporativo' ? 'text-emerald-600' :
                      a.tipo_afiliado === 'Agente Corporativo' || a.tipo_afiliado === 'Agente' ? 'text-amber-500' :
                      'text-blue-500'
                    }`}>
                      {a.tipo_afiliado === 'Corporativo' ? 'Corporativo' :
                       a.tipo_afiliado === 'Agente Corporativo' || a.tipo_afiliado === 'Agente' ? 'Agente Corporativo' :
                       'Agente Independiente'}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 whitespace-nowrap">
                    {a.estatus.replace(/_/g, ' ')}
                  </span>
                </div>
                <span className="text-xs text-slate-400 truncate">{a.email}</span>
                <span className="text-[10px] text-slate-300">
                  #{a.id_afiliado} · {a.codigo || 'sin código'} · {new Date(a.fecha_registro).toLocaleDateString('es-ES')}
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Detail */}
      <div className="bg-gray-50 overflow-hidden relative min-h-0 hidden sm:block">
        {!selected ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-300">
            <p className="text-sm font-medium">Selecciona un afiliado</p>
          </div>
        ) : detailLoading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-300">
            <p className="text-sm font-medium">Cargando detalle...</p>
          </div>
        ) : (
          <div className="absolute inset-0 overflow-y-auto p-4 sm:p-6">
            <div className="bg-white rounded-2xl p-4 border border-gray-100">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <select
                      value={selected.tipo_afiliado}
                      onChange={(e) => updateField('tipo_afiliado', e.target.value)}
                      className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-slate-100 text-slate-500 border-none focus:ring-0 cursor-pointer"
                    >
                      <option value="Natural">Agente Independiente</option>
                      <option value="Agente Corporativo">Agente Corporativo</option>
                      <option value="Corporativo">Corporativo</option>
                    </select>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 leading-tight">
                    {selected.tipo_afiliado === 'Corporativo' 
                      ? (selected.empresa_razon_social || formatNombreCard(selected.nombre_completo)) 
                      : formatNombreCard(selected.nombre_completo)
                    }
                  </h3>

                  <p className="text-xs text-slate-400 mt-0.5 truncate">{selected.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-slate-100 text-slate-600">
                    {selected.estatus.replace(/_/g, ' ')}
                  </span>
                  {selected.codigo && (
                    <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700">
                      {selected.codigo}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {(() => {
              const getActiveIndex = (est: string) => {
                switch (est) {
                  case '1_PREINSCRIPCION': return 0;
                  case '2_EXPEDIENTE':
                  case 'Requiere Acción': return 1;
                  case '3_ENTREVISTA': return 2;
                  case '4_VERIFICACION': return 3;
                  case '5_CIBIR': return 4;
                  case '6_INSCRIPCION': return 5;
                  case 'Afiliado': return 6;
                  default: return 6;
                }
              }
              const activeIndex = getActiveIndex(selected.estatus)

              const handleStepClick = async (idx: number) => {
                const statusValues: EstatusAfiliado[] = [
                  '1_PREINSCRIPCION',
                  '2_EXPEDIENTE',
                  '3_ENTREVISTA',
                  '4_VERIFICACION',
                  '5_CIBIR',
                  '6_INSCRIPCION',
                  'Afiliado'
                ]
                const targetStatus = statusValues[idx]
                if (targetStatus === selected.estatus) return

                const stepsNames = ['Preinscripción', 'Expediente', 'Entrevista', 'Verificación', 'CIBIR', 'Inscripción', 'Afiliación']
                const implications = [
                  'Revertirá al aspirante al estado de registro inicial de datos básicos.',
                  'Colocará al aspirante en la etapa de carga y revisión de documentos adjuntos.',
                  'Habilitará al aspirante para la etapa de entrevista con la junta directiva.',
                  'Colocará al aspirante en la etapa de evaluación de su perfil y validación de referencias de afiliados activos.',
                  'Habilitará al aspirante para la validación y acreditación del curso de formación CIBIR.',
                  'Colocará al aspirante en la etapa de pago del arancel de inscripción y aprobación administrativa final.',
                  'Convertirá de forma definitiva al aspirante en un miembro activo (Afiliado) con credenciales de acceso a la Cámara.'
                ]

                const displayName = selected.tipo_afiliado === 'Corporativo' 
                  ? (selected.empresa_razon_social || formatNombreCard(selected.nombre_completo)) 
                  : formatNombreCard(selected.nombre_completo)

                // Detect skipping or returning
                let warningHtml = ''
                if (idx > activeIndex + 1) {
                  const skipped = []
                  for (let i = activeIndex + 1; i < idx; i++) {
                    skipped.push(stepsNames[i])
                  }
                  warningHtml = `
                    <div class="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs text-left">
                      <p class="font-bold text-amber-900 mb-1">⚠️ ADVERTENCIA: Estás saltando etapas intermedias:</p>
                      <ul class="list-disc pl-4 font-semibold text-amber-800">
                        ${skipped.map(s => `<li>${s}</li>`).join('')}
                      </ul>
                      <p class="mt-1 text-[10px] leading-tight text-amber-700">Al saltar estas fases, se omitirán las revisiones y requisitos asociados a ellas.</p>
                    </div>
                  `
                } else if (idx < activeIndex) {
                  warningHtml = `
                    <div class="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-800 text-xs text-left">
                      <p class="font-bold text-blue-900 mb-1">ℹ️ NOTA: Estás retrocediendo en el proceso:</p>
                      <p class="leading-tight text-[10px] text-blue-700">El proceso se devolverá a una etapa anterior. Se deberán procesar los requisitos de nuevo desde este punto.</p>
                    </div>
                  `
                }

                const result = await Swal.fire({
                  title: '¿Cambiar etapa del proceso?',
                  html: `
                    <div class="text-slate-700 text-sm text-left">
                      <p class="mb-2">¿Estás seguro de mover a <strong>${displayName}</strong> a la etapa de <strong>${stepsNames[idx]}</strong>?</p>
                      <div class="p-3 bg-slate-50 border border-slate-100 rounded-xl text-slate-600 text-xs">
                        <strong>Implicación de esta etapa:</strong> ${implications[idx]}
                      </div>
                      ${warningHtml}
                    </div>
                  `,
                  icon: idx > activeIndex + 1 ? 'warning' : 'question',
                  showCancelButton: true,
                  confirmButtonColor: idx > activeIndex + 1 ? '#d97706' : '#059669',
                  cancelButtonColor: '#cbd5e1',
                  confirmButtonText: 'Sí, cambiar',
                  cancelButtonText: 'Cancelar'
                })

                if (result.isConfirmed) {
                  await updateField('estatus', targetStatus)
                  Swal.fire({
                    title: '¡Actualizado!',
                    text: `El afiliado ahora está en la etapa de "${stepsNames[idx]}".`,
                    icon: 'success',
                    timer: 2000,
                    showConfirmButton: false
                  })
                }
              }

              return (
                <div className="bg-white rounded-2xl p-5 border border-gray-100 mb-3 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Progreso del Proceso</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                      {activeIndex + 1} de 7 completado
                    </span>
                  </div>

                  <div className="relative flex items-start justify-between px-2 pt-2 pb-8">
                    {/* Connecting Line background */}
                    <div className="absolute left-6 right-6 top-[24px] md:top-[28px] h-0.5 bg-slate-100 -z-0" />
                    {/* Active progress line */}
                    <div 
                      className="absolute left-6 top-[24px] md:top-[28px] h-0.5 bg-emerald-500 -z-0 transition-all duration-500" 
                      style={{ width: `calc(${(activeIndex / 6) * 100}% - ${activeIndex === 6 ? '12px' : '0px'})` }}
                    />

                    {AFILIACION_STEPS_FLOW.map((step, idx) => {
                      const isCompleted = idx < activeIndex;
                      const isCurrent = idx === activeIndex;
                      const StepIcon = step.icon;
                      return (
                        <button 
                          key={idx} 
                          type="button"
                          onClick={() => handleStepClick(idx)}
                          className="flex flex-col items-center relative z-10 group cursor-pointer gap-2 focus:outline-none"
                        >
                          <div 
                            className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                              isCompleted ? 'bg-emerald-500 text-white shadow-md shadow-emerald-100' :
                              isCurrent ? 'bg-emerald-600 text-white ring-4 ring-emerald-100 font-extrabold scale-110' :
                              'bg-white text-slate-400 border-2 border-slate-200'
                            }`}
                          >
                            {isCompleted ? (
                              <Check className="w-3.5 h-3.5 md:w-5 md:h-5" strokeWidth={3} />
                            ) : (
                              <StepIcon className="w-3.5 h-3.5 md:w-5 md:h-5" />
                            )}
                          </div>
                          
                          <span className={`text-[8px] md:text-[10px] font-black tracking-tighter uppercase ${
                            isCurrent ? 'text-emerald-600 font-extrabold' : isCompleted ? 'text-slate-500' : 'text-slate-300'
                          }`}>
                            {step.labelShort}
                          </span>
                          
                          <span className="absolute top-12 left-1/2 -translate-x-1/2 text-[9px] font-bold tracking-tight whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white px-2 py-1 rounded shadow-md pointer-events-none z-50">
                            {step.label}: {step.desc}
                          </span>
                        </button>
                      )
                    })}
                  </div>

                  <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-100 flex items-start gap-3 mt-1">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 font-bold text-sm">
                      {activeIndex + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h5 className="text-xs font-bold text-slate-800">
                        Etapa Actual: <span className="text-emerald-600">{AFILIACION_STEPS_FLOW[activeIndex]?.label}</span>
                      </h5>
                      <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                        {AFILIACION_STEPS_FLOW[activeIndex]?.desc}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })()}

            <EstablecerAccesoAfiliado
              token={token}
              afiliado={selected}
              compact
              onSuccess={() => loadDetail(selected.id_afiliado)}
            />

            {/* Profile Info */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100 flex flex-col gap-5">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Información del Perfil</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selected.tipo_afiliado === 'Corporativo' && (
                  <div className="col-span-full flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Razón Social</label>
                    <input 
                      type="text" 
                      value={selected.empresa_razon_social || ''} 
                      onChange={(e) => updateField('empresa_razon_social', e.target.value)}
                      className="w-full rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2 text-sm text-slate-700 focus:bg-white transition-colors"
                      placeholder="Nombre del corporativo"
                    />
                  </div>
                )}
                
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Nombres</label>
                  <input 
                    type="text" 
                    value={selected.nombres || ''} 
                    onChange={(e) => updateField('nombres', e.target.value)}
                    className="w-full rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2 text-sm text-slate-700 focus:bg-white transition-colors"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Apellidos</label>
                  <input 
                    type="text" 
                    value={selected.apellidos || ''} 
                    onChange={(e) => updateField('apellidos', e.target.value)}
                    className="w-full rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2 text-sm text-slate-700 focus:bg-white transition-colors"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Cédula / RIF</label>
                  <input 
                    type="text" 
                    value={selected.empresa_rif_numero ? formatRif(selected.empresa_rif_tipo, selected.empresa_rif_numero) : selected.cedula} 
                    disabled
                    className="w-full rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-400 cursor-not-allowed"
                  />
                </div>
                {selected.tipo_afiliado === 'Corporativo' && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Cédula del Representante</label>
                    <input 
                      type="text" 
                      value={selected.cedula || ''} 
                      onChange={(e) => updateField('cedula', e.target.value)}
                      className="w-full rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2 text-sm text-slate-700 focus:bg-white transition-colors"
                    />
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Teléfono</label>
                  <input 
                    type="text" 
                    value={selected.telefono || ''} 
                    onChange={(e) => updateField('telefono', e.target.value)}
                    className="w-full rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2 text-sm text-slate-700 focus:bg-white transition-colors"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Fecha Nacimiento</label>
                  <input 
                    type="text" 
                    value={selected.fecha_nacimiento || ''} 
                    onChange={(e) => updateField('fecha_nacimiento', e.target.value)}
                    className="w-full rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2 text-sm text-slate-700 focus:bg-white transition-colors"
                    placeholder="DD-MM-YYYY"
                  />
                </div>
                <div className="col-span-full flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Dirección</label>
                  <textarea 
                    value={selected.direccion || ''} 
                    onChange={(e) => updateField('direccion', e.target.value)}
                    rows={2}
                    className="w-full rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2 text-sm text-slate-700 focus:bg-white transition-colors resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Documentation Section */}
            {selected.documentos && selected.documentos.length > 0 && (
              <div className="bg-white rounded-2xl p-5 border border-gray-100 flex flex-col gap-5">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Documentación Adjunta</h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                    {selected.documentos.length} archivos
                  </span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selected.documentos.map((doc: any) => (
                    <DocLink 
                      key={doc.id_documento} 
                      label={doc.tipo_doc.replace(/_/g, ' ')} 
                      url={doc.url} 
                      detail={doc.nombre_archivo}
                      compact 
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Process Management */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100 flex flex-col gap-4">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Gestión del Proceso</h4>
              
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Estado Actual</label>
                <select 
                  value={selected.estatus}
                  onChange={(e) => updateField('estatus', e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold text-slate-700"
                >
                  <option value="1_PREINSCRIPCION">1. Preinscripción</option>
                  <option value="2_EXPEDIENTE">2. Expediente</option>
                  <option value="3_ENTREVISTA">3. Entrevista</option>
                  <option value="4_VERIFICACION">4. Verificación</option>
                  <option value="5_CIBIR">5. CIBIR</option>
                  <option value="6_INSCRIPCION">6. Inscripción</option>
                  <option value="Afiliado">Afiliado</option>
                  <option value="Moroso">Moroso</option>
                  <option value="Suspendido">Suspendido</option>
                  <option value="Rechazado">Rechazado</option>
                </select>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <input 
                  type="checkbox" 
                  id="cibir_convalidado"
                  checked={!!selected.cibir_convalidado}
                  onChange={(e) => updateField('cibir_convalidado', e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500"
                />
                <label htmlFor="cibir_convalidado" className="text-xs font-bold text-slate-600 cursor-pointer">
                  Convalidar conocimientos CIBIR (Vía Entrevista)
                </label>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <input 
                  type="checkbox" 
                  id="inscripcion_pagada"
                  checked={!!selected.inscripcion_pagada}
                  onChange={(e) => updateField('inscripcion_pagada', e.target.checked ? 1 : 0)}
                  className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500"
                />
                <label htmlFor="inscripcion_pagada" className="text-xs font-bold text-slate-600 cursor-pointer">
                  Cuota de inscripción pagada
                </label>
              </div>

              {(['1_PREINSCRIPCION', '6_INSCRIPCION'].includes(selected.estatus) || (selected.tipo_afiliado === 'Agente Corporativo' && selected.estatus === '2_EXPEDIENTE')) && (
                <div className="flex gap-2 pt-2 border-t border-slate-50">
                  <button
                    onClick={() => procesar(selected.id_afiliado, 'aprobar')}
                    className="flex-1 py-2.5 rounded-xl bg-[#00D084] text-white text-sm font-bold hover:bg-[#00B870] shadow-sm shadow-emerald-200 transition-all hover:-translate-y-0.5"
                  >
                    ✓ Aprobar Afiliación
                  </button>
                  <button
                    onClick={() => procesar(selected.id_afiliado, 'rechazar')}
                    className="flex-1 py-2.5 rounded-xl bg-red-50 text-red-500 text-sm font-bold hover:bg-red-100 transition-colors"
                  >
                    ✗ Rechazar
                  </button>
                </div>
              )}
            </div>

            {error && (
              <div className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-2xl p-4">{error}</div>
            )}
          </div>
        )}
      </div>

      <ExportAfiliadosModal
        open={showExportModal}
        onClose={() => setShowExportModal(false)}
        authHeaders={authHeaders}
        initialFilters={{
          estatus,
          tipo: filterTipo as ExportTipoFilter,
        }}
      />
    </div>
  )
}

