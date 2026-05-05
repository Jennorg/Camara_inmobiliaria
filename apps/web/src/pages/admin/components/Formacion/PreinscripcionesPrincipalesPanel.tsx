import React, { useEffect, useMemo, useState } from 'react'
import { API_URL } from '@/config/env'
import { useAuth } from '@/context/AuthContext'
import { formatNombreCard } from '@/utils/formatters'



type ProgramaCodigo = 'PADI' | 'PEGI' | 'PREANI' | 'CIBIR' | 'AFILIACION'
type Estatus = 'Preinscrito' | 'Entrevista' | 'Inscrito' | 'Rechazado' | 'Cancelado'

type Row = {
  id_inscripcion: number
  programa_codigo: ProgramaCodigo
  estatus: Estatus
  creado_en: string
  id_estudiante: number
  estudiante_nombre: string
  estudiante_email: string
  estudiante_telefono: string | null
  estudiante_cedula: string | null
  entrevista_fecha?: string
  entrevista_hora?: string
  entrevista_lugar?: string
}

export default function PreinscripcionesPrincipalesPanel({
  initialPrograma = 'Todos'
}: {
  initialPrograma?: ProgramaCodigo | 'Todos'
}) {
  const { token } = useAuth()
  const [programa, setPrograma] = useState<ProgramaCodigo | 'Todos'>(initialPrograma)
  type UiEstatus = 'Todos' | 'Pendiente' | 'Entrevista' | 'Aprobado' | 'Rechazado'
  const [uiEstatus, setUiEstatus] = useState<UiEstatus>('Pendiente')
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [counts, setCounts] = useState({ Todos: 0, Pendiente: 0, Entrevista: 0, Aprobado: 0, Rechazado: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Row | null>(null)
  const [documentos, setDocumentos] = useState<{ id_documento: number; tipo_doc: string; url: string; nombre_archivo: string | null }[]>([])
  const [loadingDocs, setLoadingDocs] = useState(false)

  const authHeaders = useMemo(() => {
    const h: Record<string, string> = {}
    if (token) h.Authorization = `Bearer ${token}`
    return h
  }, [token])

  const [showModalAgendar, setShowModalAgendar] = useState(false)
  const [showModalFinalizar, setShowModalFinalizar] = useState(false)
  const [entrevista, setEntrevista] = useState({ fecha: '', hora: '', lugar: 'Sede Cámara Inmobiliaria' })
  const [finalizarData, setFinalizarData] = useState<{ resultado: 'Aprobado' | 'Parcial' | 'Rechazado', modulos: number[], nota: string }>({
    resultado: 'Aprobado',
    modulos: [1, 2, 3, 4, 5],
    nota: ''
  })

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const qs = new URLSearchParams()
      if (uiEstatus === 'Todos') qs.set('estatus', 'Todos')
      else if (uiEstatus === 'Pendiente') qs.set('estatus', 'Preinscrito')
      else if (uiEstatus === 'Entrevista') qs.set('estatus', 'Entrevista')
      else if (uiEstatus === 'Aprobado') qs.set('estatus', 'Inscrito')
      else if (uiEstatus === 'Rechazado') qs.set('estatus', 'Rechazado')

      if (programa !== 'Todos') qs.set('programaCodigo', programa)

      const res = await fetch(`${API_URL}/api/academia/preinscripciones?${qs.toString()}`, {
        headers: { ...authHeaders },
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'Error cargando preinscripciones')

      const data = json.data as Row[]
      setRows(data)

      if (json.meta && json.meta.counts) {
        setCounts({
          Todos: json.meta.counts.Todos || 0,
          Pendiente: json.meta.counts.Pendiente || 0,
          Entrevista: json.meta.counts.Entrevista || 0,
          Aprobado: json.meta.counts.Aprobado || 0,
          Rechazado: json.meta.counts.Rechazado || 0,
        })
      }

      const urlParams = new URLSearchParams(window.location.search)
      const idFromUrl = urlParams.get('id')
      if (idFromUrl) {
        const found = data.find(r => r.id_inscripcion === Number(idFromUrl))
        if (found) {
          setSelected(found)
          fetchDocumentos(found.id_estudiante)
        }
      } else {
        setSelected(null)
        setDocumentos([])
      }
    } catch (e: unknown) {
      const err = e as Error
      setError(err.message || 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }

  const fetchDocumentos = async (idEstudiante: number) => {
    setLoadingDocs(true)
    setDocumentos([])
    try {
      const res = await fetch(`${API_URL}/api/academia/estudiantes/${idEstudiante}/documentos`, {
        headers: { ...authHeaders },
      })
      const json = await res.json()
      if (res.ok && json.success) setDocumentos(json.data)
    } catch { /* silencioso */ }
    finally { setLoadingDocs(false) }
  }

  useEffect(() => {
    fetchData()
  }, [programa, uiEstatus, token])

  const agendarEntrevista = async () => {
    if (!selected) return
    try {
      const res = await fetch(`${API_URL}/api/academia/inscripciones/${selected.id_inscripcion}/agendar-entrevista`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          entrevistaFecha: entrevista.fecha,
          entrevistaHora: entrevista.hora,
          entrevistaLugar: entrevista.lugar
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'No se pudo agendar')
      setShowModalAgendar(false)
      await fetchData()
    } catch (e: any) {
      setError(e.message)
    }
  }

  const finalizarEntrevista = async () => {
    if (!selected) return
    try {
      const res = await fetch(`${API_URL}/api/academia/inscripciones/${selected.id_inscripcion}/finalizar-entrevista`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          resultado: finalizarData.resultado,
          modulosConvalidados: finalizarData.modulos,
          notaAdmin: finalizarData.nota
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'No se pudo finalizar')
      setShowModalFinalizar(false)
      await fetchData()
    } catch (e: any) {
      setError(e.message)
    }
  }

  const aprobarDirecto = async (id: number) => {
    try {
      const res = await fetch(`${API_URL}/api/academia/inscripciones/${id}/aprobar-directo`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'No se pudo aprobar')
      await fetchData()
    } catch (e: any) {
      setError(e.message)
    }
  }

  const rechazar = async (id: number) => {
    try {
      const res = await fetch(`${API_URL}/api/academia/inscripciones/${id}/rechazar`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ notaAdmin: '' }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'No se pudo rechazar')
      await fetchData()
    } catch (e: any) {
      setError(e.message)
    }
  }

  const filteredRows = useMemo(() => {
    if (!search) return rows
    const q = search.toLowerCase()
    return rows.filter(r =>
      r.estudiante_nombre?.toLowerCase().includes(q) ||
      r.estudiante_email?.toLowerCase().includes(q) ||
      r.estudiante_cedula?.toLowerCase().includes(q)
    )
  }, [rows, search])

  const mapStatusUI = (s: Estatus) => {
    if (s === 'Preinscrito') return 'Pendiente'
    if (s === 'Inscrito') return 'Aprobado'
    return s
  }
  const getStatusStyles = (s: Estatus) => {
    if (s === 'Preinscrito') return 'bg-amber-50 text-amber-600'
    if (s === 'Entrevista') return 'bg-blue-50 text-blue-600'
    if (s === 'Inscrito') return 'bg-emerald-50 text-emerald-600'
    if (s === 'Rechazado') return 'bg-red-50 text-red-500'
    return 'bg-slate-100 text-slate-500'
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-[340px_1fr] grid-rows-1 h-full w-full overflow-hidden relative">
      {/* List */}
      <div className={['flex flex-col bg-white border-r border-gray-100 overflow-hidden min-h-0', selected ? 'hidden sm:flex' : 'flex'].join(' ')}>

        <div className="px-3 pt-3 pb-2 border-b border-gray-100 flex flex-col gap-2">
          {/* Buscar aspirante */}
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m1.1-5.4a7.5 7.5 0 11-15 0 7.5 7.5 0 0115 0z" /></svg>
            <input
              type="text"
              placeholder="Buscar aspirante..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full text-xs rounded-xl border border-gray-200 pl-8 pr-3 py-2 text-slate-700 bg-gray-50 focus:bg-white transition-colors"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={programa}
              onChange={(e) => setPrograma(e.target.value as any)}
              className="text-[10px] font-bold px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-slate-600 outline-none focus:border-[#00D084] transition-all"
            >
              <option value="Todos">Todos los Programas</option>
              <option value="AFILIACION">AFILIACION</option>
              <option value="CIBIR">CIBIR</option>
              <option value="PADI">PADI</option>
              <option value="PEGI">PEGI</option>
              <option value="PREANI">PREANI</option>
            </select>
          </div>

          <div className="flex flex-wrap gap-1.5 mt-1">
            {(['Todos', 'Pendiente', 'Entrevista', 'Aprobado', 'Rechazado'] as const).map(f => (
              <button
                key={f}
                onClick={() => setUiEstatus(f)}
                className={[
                  'text-[10px] font-semibold px-2.5 py-1.5 rounded-full transition-colors flex items-center gap-1',
                  uiEstatus === f ? 'bg-[#00D084] text-white' : 'bg-gray-100 text-slate-500 hover:bg-gray-200',
                ].join(' ')}
              >
                {f}
                <span className={['px-1.5 rounded-full text-[9px] font-bold', uiEstatus === f ? 'bg-white/25' : 'bg-white text-slate-400'].join(' ')}>
                  {counts[f] || 0}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {loading ? (
            <div className="p-4 text-center text-xs text-slate-400 font-semibold uppercase tracking-widest mt-10">Cargando...</div>
          ) : error ? (
            <div className="p-4 text-center text-xs text-red-500 mt-10">{error}</div>
          ) : filteredRows.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-400 mt-10">No hay registros.</div>
          ) : (
            filteredRows.map(r => (
              <button
                key={r.id_inscripcion}
                onClick={() => { setSelected(r); fetchDocumentos(r.id_estudiante) }}
                className={['w-full text-left px-4 py-3.5 transition-colors flex flex-col gap-1',
                  selected?.id_inscripcion === r.id_inscripcion ? 'bg-[#E9FAF4]' : 'hover:bg-slate-50',
                ].join(' ')}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={['text-sm font-semibold truncate', selected?.id_inscripcion === r.id_inscripcion ? 'text-[#00B870]' : 'text-slate-800'].join(' ')}>
                    {formatNombreCard(r.estudiante_nombre)}
                  </span>

                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getStatusStyles(r.estatus)}`}>
                    {mapStatusUI(r.estatus)}
                  </span>
                </div>
                <span className="text-xs text-slate-400 truncate">{r.programa_codigo} • {r.estudiante_cedula || 'S/N'}</span>
                <span className="text-[10px] text-slate-300">{new Date(r.creado_en).toLocaleDateString('es-ES', { month: 'short', day: '2-digit', year: 'numeric' })}</span>
              </button>
            ))
          )}
        </div>
      </div>

      <div className={['bg-gray-50 overflow-hidden relative min-h-0', selected ? 'block' : 'hidden sm:block'].join(' ')}>
        {selected ? (
          <div className="absolute inset-0 overflow-y-auto p-4 sm:p-6">
            <button
              onClick={() => setSelected(null)}
              className="sm:hidden flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors self-start"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
              Volver a la lista
            </button>
            <div className="bg-white rounded-2xl p-4 border border-gray-100 flex items-center gap-3 flex-wrap">
              <div className="w-11 h-11 rounded-full bg-[#E9FAF4] flex items-center justify-center text-[#00B870] font-black text-lg flex-shrink-0">
                {selected.estudiante_nombre.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-slate-900 leading-tight">{formatNombreCard(selected.estudiante_nombre)}</h3>

                <p className="text-xs text-slate-400 mt-0.5 truncate">{selected.estudiante_cedula || 'Sin documento'}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${getStatusStyles(selected.estatus)}`}>
                  {mapStatusUI(selected.estatus)}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {selected.programa_codigo}
                </span>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Cédula</span>
                <span className="text-sm text-slate-700 font-medium break-all">{selected.estudiante_cedula || 'No indicado'}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Teléfono</span>
                <span className="text-sm text-slate-700 font-medium break-all">{selected.estudiante_telefono || 'No indicado'}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Email</span>
                <span className="text-sm text-slate-700 font-medium break-all">{selected.estudiante_email}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Fecha de Solicitud</span>
                <span className="text-sm text-slate-700 font-medium break-all">{new Date(selected.creado_en).toLocaleString('es-ES')}</span>
              </div>
            </div>

            {/* Documentos */}
            <div className="bg-white rounded-2xl p-4 border border-gray-100 flex flex-col gap-3">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Documentación Adjunta</span>
              {loadingDocs ? (
                <div className="py-4 text-center text-xs text-slate-400 animate-pulse">Cargando documentos...</div>
              ) : documentos.length === 0 ? (
                <div className="py-4 px-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 text-center">
                  <span className="text-[10px] text-slate-400 font-medium italic">Sin documentos adjuntos</span>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {documentos.map((doc) => {
                    const labelMap: Record<string, string> = {
                      titulo: 'Título Académico',
                      cv: 'Curriculum Vitae',
                      especializacion: 'Especialización',
                      curso_extra: 'Curso Extra',
                      comprobante: 'Comprobante',
                    }
                    const colorMap: Record<string, string> = {
                      titulo: 'bg-blue-50 text-blue-700 hover:bg-blue-100',
                      cv: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
                      especializacion: 'bg-purple-50 text-purple-700 hover:bg-purple-100',
                      curso_extra: 'bg-amber-50 text-amber-700 hover:bg-amber-100',
                      comprobante: 'bg-slate-50 text-slate-600 hover:bg-slate-100',
                    }
                    return (
                      <a
                        key={doc.id_documento}
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors ${colorMap[doc.tipo_doc] || colorMap.comprobante}`}
                      >
                        <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M13.8 12H3" />
                        </svg>
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold truncate">{doc.nombre_archivo || labelMap[doc.tipo_doc] || doc.tipo_doc}</span>
                          <span className="text-[9px] opacity-60 font-normal uppercase tracking-wider">{labelMap[doc.tipo_doc] || doc.tipo_doc}</span>
                        </div>
                      </a>
                    )
                  })}
                </div>
              )}
            </div>

            {['Preinscrito', 'Entrevista'].includes(selected.estatus) && (
              <div className="bg-white rounded-2xl p-4 border border-gray-100 flex flex-col gap-2">
              {selected.estatus === 'Preinscrito' && (
                <div className="flex gap-2">
                  {['AFILIACION', 'PEGI'].includes(selected.programa_codigo) ? (
                    <button
                      onClick={() => setShowModalAgendar(true)}
                      className="flex-1 py-2.5 rounded-xl bg-[#00D084] text-white text-sm font-semibold hover:bg-[#00B870] transition-colors"
                    >
                      Agendar Entrevista
                    </button>
                  ) : (
                    <button
                      onClick={() => aprobarDirecto(selected.id_inscripcion)}
                      className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-bold shadow-lg shadow-emerald-600/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                      Aprobar Preinscripción
                    </button>
                  )}
                  <button
                    onClick={() => rechazar(selected.id_inscripcion)}
                    className="flex-1 py-2.5 rounded-xl bg-red-50 text-red-500 text-sm font-semibold hover:bg-red-100 transition-colors"
                  >
                    Rechazar
                  </button>
                </div>
              )}
              {selected.estatus === 'Entrevista' && (
                <div className="flex flex-col gap-3">
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                    <p className="text-[11px] font-bold text-blue-600 uppercase tracking-wider mb-1">Cita Programada</p>
                    <p className="text-xs text-blue-700">
                      {selected.entrevista_fecha} a las {selected.entrevista_hora} <br />
                      <span className="opacity-70">{selected.entrevista_lugar}</span>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowModalFinalizar(true)}
                      className="flex-1 py-2.5 rounded-xl bg-[#00D084] text-white text-sm font-semibold hover:bg-[#00B870] transition-colors shadow-lg shadow-[#00D084]/20"
                    >
                      Dar Veredicto Final
                    </button>
                    <button
                      onClick={() => setShowModalAgendar(true)}
                      className="px-4 py-2.5 rounded-xl border border-blue-200 text-blue-600 text-sm font-semibold hover:bg-blue-100 transition-colors"
                    >
                      Reprogramar
                    </button>
                  </div>
                </div>
              )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-300">
            <svg viewBox="0 0 24 24" className="w-12 h-12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm font-medium">Selecciona una preinscripción</p>
          </div>
        )}
      </div>

      {/* Modal Agendar Entrevista */}
      {showModalAgendar && selected && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-[8px] p-4">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.15)] overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="relative p-8 bg-gradient-to-br from-emerald-600 to-teal-700 text-white overflow-hidden">
              <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
              <div className="relative z-10">
                <h3 className="text-2xl font-black tracking-tight">Agendar Entrevista</h3>
                <p className="text-emerald-100/80 text-sm mt-1 font-medium">Programa Académico: {selected.programa_codigo}</p>
              </div>
              <button
                onClick={() => setShowModalAgendar(false)}
                className="absolute top-8 right-8 z-50 p-2.5 bg-white/10 hover:bg-white/20 rounded-full transition-all duration-300 backdrop-blur-md border border-white/10 group"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 group-hover:rotate-90 transition-transform duration-500" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-8 flex flex-col gap-6">
              <div className="flex flex-col gap-2 group">
                <label className="text-[10px] font-black text-emerald-600/60 uppercase tracking-[0.2em] ml-1 group-focus-within:text-emerald-600 transition-colors">Fecha de Entrevista</label>
                <input
                  type="date"
                  value={entrevista.fecha}
                  onChange={e => setEntrevista({ ...entrevista, fecha: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-semibold focus:bg-white focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500 outline-none transition-all shadow-sm"
                />
              </div>

              <div className="flex flex-col gap-2 group">
                <label className="text-[10px] font-black text-emerald-600/60 uppercase tracking-[0.2em] ml-1 group-focus-within:text-emerald-600 transition-colors">Hora de la Cita</label>
                <input
                  type="time"
                  value={entrevista.hora}
                  onChange={e => setEntrevista({ ...entrevista, hora: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-semibold focus:bg-white focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500 outline-none transition-all shadow-sm"
                />
              </div>

              <div className="flex flex-col gap-2 group">
                <label className="text-[10px] font-black text-emerald-600/60 uppercase tracking-[0.2em] ml-1 group-focus-within:text-emerald-600 transition-colors">Lugar / Plataforma</label>
                <input
                  type="text"
                  value={entrevista.lugar}
                  onChange={e => setEntrevista({ ...entrevista, lugar: e.target.value })}
                  placeholder="Ej: Sede Cámara Inmobiliaria o Google Meet"
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-semibold focus:bg-white focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500 outline-none transition-all shadow-sm"
                />
              </div>

              <div className="pt-4 flex flex-col gap-3">
                <button
                  onClick={agendarEntrevista}
                  disabled={!entrevista.fecha || !entrevista.hora || !entrevista.lugar}
                  className="w-full py-4.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-base font-bold shadow-[0_10px_25px_-5px_rgba(5,150,105,0.4)] hover:shadow-[0_15px_30px_-5px_rgba(5,150,105,0.5)] hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:pointer-events-none uppercase tracking-widest text-xs"
                >
                  Confirmar Programación
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Finalizar Entrevista */}
      {showModalFinalizar && selected && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-[8px] p-4">
          <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.15)] overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="relative p-8 bg-gradient-to-br from-slate-800 to-slate-900 text-white overflow-hidden">
              <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="relative z-10">
                <h3 className="text-2xl font-black tracking-tight">Veredicto Final</h3>
                <p className="text-slate-400 text-sm mt-1 font-medium">Aspirante: <span className="text-white font-bold">{formatNombreCard(selected.estudiante_nombre)}</span></p>

              </div>
              <button
                onClick={() => setShowModalFinalizar(false)}
                className="absolute top-8 right-8 z-50 p-2.5 bg-white/5 hover:bg-white/10 rounded-full transition-all duration-300 backdrop-blur-md border border-white/5 group"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 group-hover:rotate-90 transition-transform duration-500" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-8 flex flex-col gap-6">
              <div className="flex flex-col gap-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Resultado de Admisión</label>
                <div className="grid grid-cols-3 gap-3">
                  {(['Aprobado', 'Parcial', 'Rechazado'] as const).map(res => (
                    <button
                      key={res}
                      onClick={() => setFinalizarData({ ...finalizarData, resultado: res, modulos: res === 'Aprobado' ? [1, 2, 3, 4, 5] : finalizarData.modulos })}
                      className={[
                        'py-3.5 px-4 rounded-2xl text-xs font-bold border transition-all duration-300',
                        finalizarData.resultado === res
                          ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                          : 'bg-white border-slate-100 text-slate-500 hover:border-emerald-200'
                      ].join(' ')}
                    >
                      {res === 'Parcial' ? 'Parcial (CIEBO)' : res}
                    </button>
                  ))}
                </div>
              </div>

              {finalizarData.resultado === 'Parcial' && (
                <div className="bg-emerald-50/30 rounded-[2rem] p-6 border border-emerald-100/50 flex flex-col gap-4 animate-in slide-in-from-top-2 duration-500">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <label className="text-[10px] font-black text-emerald-800/60 uppercase tracking-[0.2em]">Módulos Convalidados</label>
                      <p className="text-[10px] text-emerald-600/60 font-medium">Marca los módulos ya cursados</p>
                    </div>
                    <span className="text-[11px] font-black bg-emerald-600 text-white px-3 py-1 rounded-full">{finalizarData.modulos.length} / 5</span>
                  </div>
                  <div className="grid grid-cols-5 gap-2.5">
                    {[1, 2, 3, 4, 5].map(m => {
                      const active = finalizarData.modulos.includes(m)
                      return (
                        <button
                          key={m}
                          onClick={() => {
                            const next = active ? finalizarData.modulos.filter(x => x !== m) : [...finalizarData.modulos, m]
                            setFinalizarData({ ...finalizarData, modulos: next })
                          }}
                          className={[
                            'h-14 rounded-2xl border-2 flex flex-col items-center justify-center transition-all duration-300',
                            active 
                              ? 'bg-white border-emerald-600 text-emerald-600 shadow-sm' 
                              : 'bg-white/50 border-slate-100 text-slate-400 opacity-60'
                          ].join(' ')}
                        >
                          <span className="text-[11px] font-black">M{m}</span>
                          <div className={['w-1.5 h-1.5 rounded-full mt-1.5 transition-all duration-300', active ? 'bg-emerald-600 scale-125' : 'bg-slate-200'].join(' ')} />
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2 group">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 group-focus-within:text-emerald-600 transition-colors">Nota Administrativa (Opcional)</label>
                <textarea
                  value={finalizarData.nota}
                  onChange={e => setFinalizarData({ ...finalizarData, nota: e.target.value })}
                  placeholder="Añade observaciones internas sobre el perfil del aspirante..."
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-medium focus:bg-white focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500 outline-none transition-all h-24 resize-none"
                />
              </div>

              <div className="pt-2">
                <button
                  onClick={finalizarEntrevista}
                  className="w-full py-4.5 rounded-2xl bg-slate-900 text-white text-xs font-black shadow-xl shadow-slate-900/10 hover:bg-slate-800 hover:-translate-y-0.5 active:translate-y-0 transition-all uppercase tracking-[0.2em]"
                >
                  Finalizar Proceso y Notificar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
