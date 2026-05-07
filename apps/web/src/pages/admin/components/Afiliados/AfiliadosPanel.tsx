import React, { useEffect, useMemo, useState } from 'react'
import { API_URL } from '@/config/env'
import { useAuth } from '@/context/AuthContext'
import { formatNombreCard } from '@/utils/formatters'
import { EstatusAfiliado, AfiliadoDTO } from '@/types/afiliados'
import { FileText, ExternalLink, Download, Award, GraduationCap } from 'lucide-react'

function DocLink({ label, url, compact = false }: { label: string, url?: string | null, compact?: boolean }) {
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
          <span className="text-[10px] font-bold text-slate-600 truncate">Ver documento</span>
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
  const [filterTipo, setFilterTipo] = useState<'Todos' | 'Natural' | 'Corporativo'>('Todos')
  const [items, setItems] = useState<AfiliadoDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<AfiliadoDTO | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

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
        if (['estatus', 'nombre_completo', 'codigo_cibir', 'tipo_afiliado'].includes(field)) await load()
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
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Afiliados (CIBIR)</h3>
            <p className="text-xs text-slate-400 mt-0.5">Gestión de candidatos, aprobaciones y estatus.</p>
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
                <option value="Natural">Independientes</option>
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
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold truncate text-slate-800">{formatNombreCard(a.nombre_completo)}</span>

                    <span className={`text-[9px] font-black uppercase tracking-widest ${a.tipo_afiliado === 'Corporativo' ? 'text-emerald-600' : 'text-blue-500'}`}>
                      {a.tipo_afiliado === 'Corporativo' ? 'Corporativo' : 'Independiente'}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 whitespace-nowrap">
                    {a.estatus.replace(/_/g, ' ')}
                  </span>
                </div>
                <span className="text-xs text-slate-400 truncate">{a.email}</span>
                <span className="text-[10px] text-slate-300">
                  #{a.id_afiliado} · {a.codigo_cibir || 'sin código'} · {new Date(a.fecha_registro).toLocaleDateString('es-ES')}
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
                      <option value="Natural">Independiente</option>
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
                  {selected.codigo_cibir && (
                    <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700">
                      {selected.codigo_cibir}
                    </span>
                  )}
                </div>
              </div>
            </div>

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
                    value={selected.empresa_rif_tipo ? `${selected.empresa_rif_tipo}-${selected.empresa_rif_numero}` : selected.cedula} 
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

              {['1_PREINSCRIPCION', '6_INSCRIPCION'].includes(selected.estatus) && (
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
    </div>
  )
}

