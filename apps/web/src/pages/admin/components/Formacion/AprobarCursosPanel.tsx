import React, { useEffect, useMemo, useState } from 'react'
import { API_URL } from '@/config/env'
import { useAuth } from '@/context/AuthContext'
import { CheckCircle2, Search, FileText, User, Mail, Phone, GraduationCap, BookOpen, Award, Clock, X } from 'lucide-react'
import Swal from 'sweetalert2'

type Row = {
  id_inscripcion: number
  id_curso: number | null
  curso_nombre: string | null
  programa_codigo: string | null
  estatus: string
  estatus_academico: string
  completado: number
  creado_en: string
  fecha_inscripcion: string
  id_estudiante: number
  estudiante_nombre: string
  estudiante_email: string
  estudiante_telefono: string | null
  estudiante_cedula: string | null
  num_modulos?: number
  modulos_aprobados?: number
}

type UiFilter = 'EnCurso' | 'Completado' | 'Todos'

export default function AprobarCursosPanel() {
  const { token } = useAuth()
  const [uiFilter, setUiFilter] = useState<UiFilter>('EnCurso')
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Row | null>(null)
  const [documentos, setDocumentos] = useState<{ id_documento: number; tipo_doc: string; url: string; nombre_archivo: string | null }[]>([])
  const [loadingDocs, setLoadingDocs] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false)

  // Module states
  const [modulos, setModulos] = useState<{
    nombre_modulo: string;
    profesor: string | null;
    estatus: string;
    aprobado_por: number | null;
    fecha_evaluacion: string | null;
    nota_admin: string | null;
  }[]>([])
  const [loadingModulos, setLoadingModulos] = useState(false)
  const [evaluating, setEvaluating] = useState<string | null>(null)

  const authHeaders = useMemo(() => {
    const h: Record<string, string> = {}
    if (token) h.Authorization = `Bearer ${token}`
    return h
  }, [token])

  const fetchModulos = async (idInscripcion: number) => {
    setLoadingModulos(true)
    setModulos([])
    try {
      const res = await fetch(`${API_URL}/api/academia/inscripciones/${idInscripcion}/modulos`, {
        headers: { ...authHeaders }
      })
      const json = await res.json()
      if (res.ok && json.success) {
        setModulos(json.data.modulos)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingModulos(false)
    }
  }

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      // Traer estudiantes ya INSCRITOS en cursos (no preinscripciones)
      const qs = new URLSearchParams()
      qs.set('onlyCursos', 'true')
      qs.set('estatus', 'Inscrito')

      const res = await fetch(`${API_URL}/api/academia/preinscripciones?${qs.toString()}`, {
        headers: { ...authHeaders },
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'Error cargando inscripciones')

      setRows(json.data as Row[])

      if (selected) {
        const found = (json.data as Row[]).find((r: Row) => r.id_inscripcion === selected.id_inscripcion)
        if (found) {
          setSelected(found)
          fetchModulos(found.id_inscripcion)
        } else {
          setSelected(null)
          setDocumentos([])
          setModulos([])
        }
      }
    } catch (e: any) {
      setError(e.message || 'Error inesperado')
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
    } catch { /* ignore */ }
    finally { setLoadingDocs(false) }
  }

  useEffect(() => { fetchData() }, [token])

  const handleAprobarModulo = async (nombreModulo: string) => {
    if (!selected) return
    setEvaluating(nombreModulo)
    try {
      Swal.fire({
        title: 'Procesando...',
        text: 'Aprobando módulo',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
      })

      const res = await fetch(`${API_URL}/api/academia/inscripciones/${selected.id_inscripcion}/modulos/${encodeURIComponent(nombreModulo)}/aprobar`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders }
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'Error al aprobar módulo')

      Swal.fire({
        title: '¡Módulo Aprobado!',
        text: 'El estado del módulo ha sido actualizado.',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false
      })
      
      // Actualizar datos
      await fetchData()
      if (selected) {
        await fetchModulos(selected.id_inscripcion)
      }
    } catch (e: any) {
      Swal.fire('Error', e.message || 'No se pudo aprobar el módulo', 'error')
    } finally {
      setEvaluating(null)
    }
  }

  const handleRechazarModulo = async (nombreModulo: string) => {
    if (!selected) return

    const { value: notaAdmin } = await Swal.fire({
      title: 'Rechazar Módulo',
      input: 'textarea',
      inputLabel: 'Razón del rechazo (nota administrativa)',
      inputPlaceholder: 'Escribe el motivo del rechazo aquí...',
      inputAttributes: {
        'aria-label': 'Escribe el motivo del rechazo aquí'
      },
      showCancelButton: true,
      confirmButtonText: 'Rechazar módulo',
      confirmButtonColor: '#ef4444',
      cancelButtonText: 'Cancelar'
    })

    if (notaAdmin === undefined) return // cancelado

    setEvaluating(nombreModulo)
    try {
      Swal.fire({
        title: 'Procesando...',
        text: 'Rechazando módulo',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
      })

      const res = await fetch(`${API_URL}/api/academia/inscripciones/${selected.id_inscripcion}/modulos/${encodeURIComponent(nombreModulo)}/rechazar`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ notaAdmin })
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'Error al rechazar módulo')

      Swal.fire({
        title: 'Módulo Rechazado',
        text: 'El módulo ha sido rechazado correctamente.',
        icon: 'warning',
        timer: 1500,
        showConfirmButton: false
      })
      
      await fetchData()
      if (selected) {
        await fetchModulos(selected.id_inscripcion)
      }
    } catch (e: any) {
      Swal.fire('Error', e.message || 'No se pudo rechazar el módulo', 'error')
    } finally {
      setEvaluating(null)
    }
  }

  const handleAprobarTodos = async () => {
    if (!selected) return

    const result = await Swal.fire({
      title: '¿Aprobar todos los módulos?',
      text: `Esto marcará todos los módulos como "Aprobado", completará el curso y generará el certificado de ${selected.estudiante_nombre} automáticamente.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#00D084',
      cancelButtonColor: '#cbd5e1',
      confirmButtonText: 'Sí, aprobar todo',
      cancelButtonText: 'Cancelar'
    })

    if (!result.isConfirmed) return

    setCompleting(true)
    try {
      Swal.fire({
        title: 'Procesando...',
        text: 'Aprobando todos los módulos y emitiendo certificado',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
      })

      const res = await fetch(`${API_URL}/api/academia/inscripciones/${selected.id_inscripcion}/modulos/aprobar-todos`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders }
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'No se pudo completar la aprobación masiva')

      Swal.fire({
        title: '¡Aprobación Completa!',
        text: 'Todos los módulos han sido aprobados y el certificado ha sido emitido.',
        icon: 'success',
        timer: 2500,
        showConfirmButton: false
      })
      await fetchData()
      if (selected) {
        await fetchModulos(selected.id_inscripcion)
      }
    } catch (e: any) {
      Swal.fire('Error', e.message || 'No se pudo realizar la aprobación masiva', 'error')
    } finally {
      setCompleting(false)
    }
  }

  // Filtrado local por completado/en curso
  const filteredByUi = useMemo(() => {
    if (uiFilter === 'EnCurso') return rows.filter(r => !r.completado || Number(r.completado) === 0)
    if (uiFilter === 'Completado') return rows.filter(r => Number(r.completado) === 1)
    return rows
  }, [rows, uiFilter])

  const filteredRows = useMemo(() => {
    if (!search) return filteredByUi
    const q = search.toLowerCase()
    return filteredByUi.filter(r =>
      r.estudiante_nombre?.toLowerCase().includes(q) ||
      r.estudiante_email?.toLowerCase().includes(q) ||
      r.estudiante_cedula?.toLowerCase().includes(q) ||
      r.curso_nombre?.toLowerCase().includes(q)
    )
  }, [filteredByUi, search])

  const counts = useMemo(() => ({
    Todos: rows.length,
    EnCurso: rows.filter(r => !r.completado || Number(r.completado) === 0).length,
    Completado: rows.filter(r => Number(r.completado) === 1).length,
  }), [rows])

  const filterConfig: { key: UiFilter; label: string }[] = [
    { key: 'EnCurso', label: 'En Curso' },
    { key: 'Completado', label: 'Completados' },
    { key: 'Todos', label: 'Todos' },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-[340px_1fr] grid-rows-1 h-full w-full overflow-hidden relative bg-slate-50/20">
      {/* ── LIST COLUMN ── */}
      <div className={['flex flex-col bg-white border-r border-gray-100 overflow-hidden min-h-0', selected ? 'hidden sm:flex' : 'flex'].join(' ')}>

        <div className="px-4 pt-4 pb-3 border-b border-gray-100 flex flex-col gap-2">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar estudiante o curso..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full text-xs rounded-xl border border-gray-200 pl-9 pr-3 py-2.5 text-slate-700 bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-[#00D084]/20 focus:border-[#00D084] outline-none transition-all"
            />
          </div>

          {/* Status filters */}
          <div className="flex flex-wrap gap-1 mt-1">
            {filterConfig.map(f => (
              <button
                key={f.key}
                onClick={() => setUiFilter(f.key)}
                className={[
                  'text-[10px] font-bold px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5 active:scale-95',
                  uiFilter === f.key
                    ? 'bg-[#00D084] text-white shadow-sm shadow-[#00D084]/20'
                    : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-100',
                ].join(' ')}
              >
                {f.label}
                <span className={[
                  'px-1.5 py-0.5 rounded-full text-[9px] font-black',
                  uiFilter === f.key ? 'bg-white/25 text-white' : 'bg-slate-200/60 text-slate-500'
                ].join(' ')}>
                  {counts[f.key]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 scrollbar-hide">
          {loading ? (
            <div className="p-10 text-center flex flex-col items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-[#00D084] border-t-transparent rounded-full animate-spin" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Cargando...</span>
            </div>
          ) : error ? (
            <div className="p-6 text-center text-xs text-red-500 font-semibold">{error}</div>
          ) : filteredRows.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 font-medium">
              {uiFilter === 'EnCurso' ? 'No hay estudiantes actualmente cursando.' : 'No se encontraron resultados.'}
            </div>
          ) : (
            filteredRows.map(r => {
              const isCompletado = Number(r.completado) === 1
              return (
                <button
                  key={r.id_inscripcion}
                  onClick={() => { setSelected(r); fetchDocumentos(r.id_estudiante); fetchModulos(r.id_inscripcion); }}
                  className={[
                    'w-full text-left px-4 py-4 transition-all flex flex-col gap-1.5 border-l-4 border-transparent',
                    selected?.id_inscripcion === r.id_inscripcion
                      ? 'bg-[#E9FAF4] border-l-[#00D084]'
                      : 'hover:bg-slate-50/50',
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className={[
                      'text-xs font-bold leading-tight flex-1 truncate',
                      selected?.id_inscripcion === r.id_inscripcion ? 'text-[#00B870]' : 'text-slate-800'
                    ].join(' ')}>
                      {r.estudiante_nombre}
                    </span>
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                      isCompletado
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                        : 'bg-amber-50 text-amber-600 border-amber-100'
                    }`}>
                      {isCompletado ? <><CheckCircle2 size={9} /> Aprobado</> : <><Clock size={9} /> En Curso</>}
                    </span>
                  </div>

                  <span className="text-[11px] text-slate-500 font-semibold leading-tight line-clamp-1 flex items-center gap-1">
                    <BookOpen size={10} className="text-slate-400" /> {r.curso_nombre || r.programa_codigo || '—'}
                  </span>

                  {/* Barra de progreso de módulos */}
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className="bg-[#00D084] h-full transition-all duration-300"
                        style={{ width: `${((r.modulos_aprobados || 0) / (r.num_modulos || 1)) * 100}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 font-black whitespace-nowrap">
                      {r.modulos_aprobados || 0} / {r.num_modulos || 1} Mód.
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium mt-0.5">
                    <span>ID: {r.estudiante_cedula || 'S/N'}</span>
                    <span>{new Date(r.fecha_inscripcion).toLocaleDateString('es-ES', { month: 'short', day: '2-digit' })}</span>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* ── DETAIL COLUMN ── */}
      <div className={['bg-slate-50/40 overflow-hidden relative min-h-0', selected ? 'block' : 'hidden sm:block'].join(' ')}>
        {selected ? (
          <div className="absolute inset-0 overflow-y-auto p-4 sm:p-6 flex flex-col gap-5">
            {/* Mobile back button */}
            <button
              onClick={() => setSelected(null)}
              className="sm:hidden flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors self-start mb-2"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Volver a la lista
            </button>

            {/* Header card */}
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center gap-4 flex-wrap">
              <div className="w-12 h-12 rounded-xl bg-[#E9FAF4] flex items-center justify-center text-[#00B870] font-black text-xl border border-[#00D084]/10 shrink-0">
                {selected.estudiante_nombre.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900 leading-tight">{selected.estudiante_nombre}</h3>
                  <button
                    onClick={() => setIsInfoModalOpen(true)}
                    className="px-2.5 py-1 text-[10px] font-bold text-slate-500 hover:text-[#00B870] bg-slate-50 hover:bg-[#E9FAF4] border border-slate-200 hover:border-[#00D084]/20 rounded-lg transition-all"
                  >
                    Más información
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 font-bold uppercase tracking-wider">Estudiante Inscrito</p>
              </div>
              <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border flex items-center gap-1 ${
                Number(selected.completado) === 1
                  ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                  : 'bg-amber-50 text-amber-600 border-amber-100'
              }`}>
                {Number(selected.completado) === 1 ? <><CheckCircle2 size={10} /> Curso Aprobado</> : <><Clock size={10} /> En Curso</>}
              </span>
            </div>

            {/* Course details */}
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col gap-3">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-50">
                <GraduationCap className="w-4 h-4 text-emerald-600" />
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Curso / Programa</h4>
              </div>
              <div>
                <p className="text-sm font-extrabold text-slate-800 leading-tight">
                  {selected.curso_nombre || selected.programa_codigo || 'Curso sin nombre'}
                </p>
                <div className="flex gap-4 mt-2 text-xs text-slate-500 font-semibold flex-wrap">
                  <span>Inscripción: <strong className="text-slate-700">#{selected.id_inscripcion}</strong></span>
                  <span>Desde: <strong className="text-slate-700">{new Date(selected.fecha_inscripcion).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}</strong></span>
                </div>
              </div>
            </div>

            {/* Módulos de la Formación */}
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col gap-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-50">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-emerald-600" />
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Progreso por Módulos</h4>
                </div>
                {Number(selected.completado) === 1 ? (
                  <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                    Aprobado y Certificado
                  </span>
                ) : (
                  <button
                    onClick={handleAprobarTodos}
                    className="text-[9px] font-black uppercase tracking-wider text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-all px-2.5 py-1 rounded border border-emerald-200 active:scale-95 flex items-center gap-1 shrink-0"
                  >
                    Aprobar Todos
                  </button>
                )}
              </div>

              {loadingModulos ? (
                <div className="py-8 flex flex-col items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cargando módulos...</span>
                </div>
              ) : modulos.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No hay módulos configurados para este curso.</p>
              ) : (
                <div className="space-y-3">
                  {/* Barra de progreso global */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex flex-col gap-2">
                    <div className="flex justify-between items-center text-xs font-bold text-slate-600">
                      <span>Progreso del Estudiante</span>
                      <span>
                        {modulos.filter(m => m.estatus === 'Aprobado').length} / {modulos.length} Módulos
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-[#00D084] h-full transition-all duration-500" 
                        style={{ width: `${(modulos.filter(m => m.estatus === 'Aprobado').length / modulos.length) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Listado de módulos individuales */}
                  <div className="divide-y divide-slate-100">
                    {modulos.map((mod) => {
                      const isAprobado = mod.estatus === 'Aprobado';
                      const isRechazado = mod.estatus === 'Rechazado';
                      
                      return (
                        <div key={mod.nombre_modulo} className="py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between first:pt-0 last:pb-0">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-slate-800 break-words">{mod.nombre_modulo}</span>
                              {mod.profesor && (
                                <span className="text-[10px] text-slate-500 font-semibold italic">
                                  (Prof. {mod.profesor})
                                </span>
                              )}
                            </div>
                            {isRechazado && mod.nota_admin && (
                              <p className="text-[11px] text-red-500 font-semibold bg-red-50/50 p-2 rounded-lg border border-red-100/30 mt-1 max-w-lg">
                                <strong>Razón de Rechazo:</strong> {mod.nota_admin}
                              </p>
                            )}
                            {isAprobado && mod.fecha_evaluacion && (
                              <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                                Aprobado el {new Date(mod.fecha_evaluacion).toLocaleDateString()}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                            {/* Badges */}
                            {isAprobado && (
                              <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[9px] font-black uppercase tracking-wider border border-emerald-100 flex items-center gap-1">
                                <CheckCircle2 size={10} /> Aprobado
                              </span>
                            )}
                            {isRechazado && (
                              <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-500 text-[9px] font-black uppercase tracking-wider border border-rose-100 flex items-center gap-1">
                                Rechazado
                              </span>
                            )}
                            {!isAprobado && !isRechazado && (
                              <span className="px-2.5 py-1 rounded-full bg-slate-50 text-slate-400 text-[9px] font-black uppercase tracking-wider border border-slate-100 flex items-center gap-1">
                                Pendiente
                              </span>
                            )}

                            {/* Acciones por módulo */}
                            <div className="flex gap-1 ml-2">
                              {!isAprobado && (
                                <button
                                  onClick={() => handleAprobarModulo(mod.nombre_modulo)}
                                  disabled={evaluating !== null}
                                  className="px-2 py-1.5 bg-[#E9FAF4] hover:bg-[#00D084] text-[#00B870] hover:text-white rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border border-[#00D084]/20 active:scale-95 disabled:opacity-50"
                                >
                                  {evaluating === mod.nombre_modulo ? '...' : 'Aprobar'}
                                </button>
                              )}
                              {!isRechazado && (
                                <button
                                  onClick={() => handleRechazarModulo(mod.nombre_modulo)}
                                  disabled={evaluating !== null}
                                  className="px-2 py-1.5 bg-rose-50 hover:bg-rose-500 text-rose-500 hover:text-white rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border border-rose-100 active:scale-95 disabled:opacity-50"
                                >
                                  {evaluating === mod.nombre_modulo ? '...' : 'Rechazar'}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center">
            <div className="w-20 h-20 bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-center text-slate-300 mb-4">
              <GraduationCap className="w-8 h-8" />
            </div>
            <h4 className="text-sm font-bold text-slate-700 mb-1">Selecciona un estudiante</h4>
            <p className="text-xs text-slate-400 max-w-xs leading-relaxed font-semibold">
              Elige un estudiante inscrito de la lista para revisar su expediente y aprobar el curso, lo que emitirá su certificado automáticamente.
            </p>
          </div>
        )}
      </div>

      {/* ── MODAL DE MÁS INFORMACIÓN ── */}
      {isInfoModalOpen && selected && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-100 shadow-xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Expediente del Estudiante</h3>
                <p className="text-xs text-slate-400 font-semibold">{selected.estudiante_nombre}</p>
              </div>
              <button
                onClick={() => setIsInfoModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Student info */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-50">
                  <User className="w-4 h-4 text-[#00D084]" />
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Información Personal</h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-0.5">
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Cédula o RIF</span>
                    <p className="text-xs font-bold text-slate-700">{selected.estudiante_cedula || 'No especificado'}</p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Correo Electrónico</span>
                    <div className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <a href={`mailto:${selected.estudiante_email}`} className="text-xs font-bold text-[#00B870] hover:underline break-all">
                        {selected.estudiante_email}
                      </a>
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Teléfono</span>
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <p className="text-xs font-bold text-slate-700">{selected.estudiante_telefono || 'No registrado'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Documents */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-50">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#00D084]" />
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Documentos Adjuntos</h4>
                  </div>
                  {loadingDocs && <span className="text-[9px] font-bold text-[#00B870] animate-pulse">Cargando...</span>}
                </div>
                {loadingDocs ? (
                  <div className="py-6 flex justify-center">
                    <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : documentos.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No se encontraron documentos registrados para este estudiante.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {documentos.map(doc => (
                      <a
                        key={doc.id_documento}
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-100 hover:border-emerald-200 hover:bg-[#E9FAF4]/35 transition-all group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider truncate leading-tight">
                            {doc.tipo_doc.replace(/_/g, ' ')}
                          </p>
                          <p className="text-[11px] font-bold text-slate-700 truncate group-hover:text-emerald-700 mt-0.5">
                            {doc.nombre_archivo || 'Ver documento'}
                          </p>
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
              <button
                onClick={() => setIsInfoModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 rounded-xl transition-all"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
