import React, { useEffect, useMemo, useState } from 'react'
import { API_URL } from '@/config/env'
import { useAuth } from '@/context/AuthContext'
import { formatNombreCard } from '@/utils/formatters'
import { Check, X, Search, FileText, User, Mail, Phone, CreditCard, Calendar, GraduationCap, BookOpen } from 'lucide-react'
import Swal from 'sweetalert2'

type Estatus = 'Preinscrito' | 'Inscrito' | 'Rechazado' | 'Cancelado'

type Row = {
  id_inscripcion: number
  id_curso: number
  curso_nombre: string
  estatus: Estatus
  creado_en: string
  id_estudiante: number
  estudiante_nombre: string
  estudiante_email: string
  estudiante_telefono: string | null
  estudiante_cedula: string | null
  completado?: number
}

type UiEstatus = 'Todos' | 'Pendiente' | 'Aprobado' | 'Rechazado'

export default function AprobarCursosPanel() {
  const { token } = useAuth()
  const [uiEstatus, setUiEstatus] = useState<UiEstatus>('Pendiente')
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [counts, setCounts] = useState({ Todos: 0, Pendiente: 0, Aprobado: 0, Rechazado: 0 })
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

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const qs = new URLSearchParams()
      qs.set('onlyCursos', 'true')
      
      if (uiEstatus === 'Todos') qs.set('estatus', 'Todos')
      else if (uiEstatus === 'Pendiente') qs.set('estatus', 'Preinscrito')
      else if (uiEstatus === 'Aprobado') qs.set('estatus', 'Inscrito')
      else if (uiEstatus === 'Rechazado') qs.set('estatus', 'Rechazado')

      const res = await fetch(`${API_URL}/api/academia/preinscripciones?${qs.toString()}`, {
        headers: { ...authHeaders },
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'Error cargando inscripciones de cursos')

      const data = json.data as Row[]
      setRows(data)

      if (json.meta && json.meta.counts) {
        setCounts({
          Todos: json.meta.counts.Todos || 0,
          Pendiente: json.meta.counts.Pendiente || 0,
          Aprobado: json.meta.counts.Aprobado || 0,
          Rechazado: json.meta.counts.Rechazado || 0,
        })
      }

      // Restore selection if possible
      if (selected) {
        const found = data.find(r => r.id_inscripcion === selected.id_inscripcion)
        if (found) {
          setSelected(found)
        } else {
          setSelected(null)
          setDocumentos([])
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
    } catch { /* ignore error */ }
    finally { setLoadingDocs(false) }
  }

  useEffect(() => {
    fetchData()
  }, [uiEstatus, token])

  const handleValidar = async (id: number) => {
    const result = await Swal.fire({
      title: '¿Aprobar inscripción?',
      text: 'Esto registrará oficialmente al estudiante en el curso, descontará el cupo disponible y enviará sus credenciales si es un usuario nuevo.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#00D084',
      cancelButtonColor: '#cbd5e1',
      confirmButtonText: 'Sí, aprobar',
      cancelButtonText: 'Cancelar'
    })

    if (!result.isConfirmed) return

    try {
      Swal.fire({
        title: 'Procesando...',
        text: 'Aprobando inscripción de curso y notificando al estudiante',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading()
        }
      })

      const res = await fetch(`${API_URL}/api/academia/inscripciones/${id}/aprobar-directo`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'No se pudo aprobar')

      Swal.fire({
        title: '¡Aprobada!',
        text: 'El participante ha sido inscrito en el curso con éxito.',
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
      })
      await fetchData()
    } catch (e: any) {
      Swal.fire({
        title: 'Error',
        text: e.message || 'No se pudo aprobar la inscripción',
        icon: 'error',
        confirmButtonColor: '#00D084'
      })
    }
  }

  const handleRechazar = async (id: number) => {
    const result = await Swal.fire({
      title: '¿Rechazar solicitud?',
      text: 'Escribe el motivo del rechazo (se enviará por correo electrónico al estudiante):',
      input: 'textarea',
      inputPlaceholder: 'Ej. Documentación incompleta o pago no verificado...',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#cbd5e1',
      confirmButtonText: 'Rechazar solicitud',
      cancelButtonText: 'Cancelar',
      inputValidator: (value) => {
        if (!value) {
          return '¡Debes escribir un motivo de rechazo!'
        }
      }
    })

    if (!result.isConfirmed) return

    try {
      Swal.fire({
        title: 'Procesando...',
        text: 'Registrando rechazo y notificando al estudiante',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading()
        }
      })

      const res = await fetch(`${API_URL}/api/academia/inscripciones/${id}/rechazar`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ notaAdmin: result.value }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'No se pudo rechazar')

      Swal.fire({
        title: 'Rechazada',
        text: 'La solicitud ha sido rechazada y el correo fue enviado.',
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
      })
      await fetchData()
    } catch (e: any) {
      Swal.fire({
        title: 'Error',
        text: e.message || 'No se pudo rechazar la solicitud',
        icon: 'error',
        confirmButtonColor: '#ef4444'
      })
    }
  }

  const filteredRows = useMemo(() => {
    if (!search) return rows
    const q = search.toLowerCase()
    return rows.filter(r =>
      r.estudiante_nombre?.toLowerCase().includes(q) ||
      r.estudiante_email?.toLowerCase().includes(q) ||
      r.estudiante_cedula?.toLowerCase().includes(q) ||
      r.curso_nombre?.toLowerCase().includes(q)
    )
  }, [rows, search])

  const mapStatusUI = (s: Estatus) => {
    if (s === 'Preinscrito') return 'Pendiente'
    if (s === 'Inscrito') return 'Aprobado'
    return s
  }

  const getStatusStyles = (s: Estatus) => {
    if (s === 'Preinscrito') return 'bg-amber-50 text-amber-600 border border-amber-100'
    if (s === 'Inscrito') return 'bg-emerald-50 text-emerald-600 border border-emerald-100'
    if (s === 'Rechazado') return 'bg-red-50 text-red-500 border border-red-100'
    return 'bg-slate-100 text-slate-500 border border-slate-200'
  }

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
            {(['Todos', 'Pendiente', 'Aprobado', 'Rechazado'] as const).map(f => (
              <button
                key={f}
                onClick={() => setUiEstatus(f)}
                className={[
                  'text-[10px] font-bold px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5 active:scale-95',
                  uiEstatus === f 
                    ? 'bg-[#00D084] text-white shadow-sm shadow-[#00D084]/20' 
                    : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-100',
                ].join(' ')}
              >
                {f === 'Pendiente' ? 'Pendientes' : f === 'Aprobado' ? 'Aprobados' : f === 'Rechazado' ? 'Rechazados' : 'Todos'}
                <span className={[
                  'px-1.5 py-0.5 rounded-full text-[9px] font-black', 
                  uiEstatus === f ? 'bg-white/25 text-white' : 'bg-slate-200/60 text-slate-500'
                ].join(' ')}>
                  {counts[f] || 0}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* List scrollable area */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 scrollbar-hide">
          {loading ? (
            <div className="p-10 text-center flex flex-col items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-[#00D084] border-t-transparent rounded-full animate-spin" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Cargando...</span>
            </div>
          ) : error ? (
            <div className="p-6 text-center text-xs text-red-500 font-semibold">{error}</div>
          ) : filteredRows.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 font-medium">No se encontraron inscripciones.</div>
          ) : (
            filteredRows.map(r => (
              <button
                key={r.id_inscripcion}
                onClick={() => { setSelected(r); fetchDocumentos(r.id_estudiante) }}
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
                  <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${getStatusStyles(r.estatus)}`}>
                    {mapStatusUI(r.estatus)}
                  </span>
                </div>
                
                <span className="text-[11px] text-slate-500 font-semibold leading-tight line-clamp-1 flex items-center gap-1">
                  <BookOpen size={10} className="text-slate-400" /> {r.curso_nombre}
                </span>
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium mt-0.5">
                  <span>ID: {r.estudiante_cedula || 'S/N'}</span>
                  <span>{new Date(r.creado_en).toLocaleDateString('es-ES', { month: 'short', day: '2-digit' })}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── DETAIL COLUMN ── */}
      <div className={['bg-slate-50/40 overflow-hidden relative min-h-0', selected ? 'block' : 'hidden sm:block'].join(' ')}>
        {selected ? (
          <div className="absolute inset-0 overflow-y-auto p-4 sm:p-6 flex flex-col gap-5">
            {/* Mobile Back Button */}
            <button
              onClick={() => setSelected(null)}
              className="sm:hidden flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors self-start mb-2"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Volver a la lista
            </button>

            {/* General card info */}
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center gap-4 flex-wrap">
              <div className="w-12 h-12 rounded-xl bg-[#E9FAF4] flex items-center justify-center text-[#00B870] font-black text-xl border border-[#00D084]/10 shrink-0">
                {selected.estudiante_nombre.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-slate-900 leading-tight">{selected.estudiante_nombre}</h3>
                <p className="text-xs text-slate-400 mt-0.5 font-bold uppercase tracking-wider">Solicitud de Inscripción a Curso</p>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full ${getStatusStyles(selected.estatus)}`}>
                  {mapStatusUI(selected.estatus)}
                </span>
                <span className="text-[10px] text-slate-400 font-bold tabular-nums">
                  Registrado: {new Date(selected.creado_en).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </div>
            </div>

            {/* Course details */}
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col gap-3">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-50">
                <GraduationCap className="w-4 h-4 text-emerald-600" />
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Curso / Taller Solicitado</h4>
              </div>
              <div>
                <p className="text-sm font-extrabold text-slate-800 leading-tight">{selected.curso_nombre}</p>
                <div className="flex gap-4 mt-2 text-xs text-slate-500 font-semibold">
                  <span>Código de Inscripción: <strong className="text-slate-700">#{selected.id_inscripcion}</strong></span>
                </div>
              </div>
            </div>

            {/* Student metadata */}
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col gap-3">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-50">
                <User className="w-4 h-4 text-emerald-600" />
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Información Personal</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-0.5">
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Cédula o RIF</span>
                  <p className="text-xs font-bold text-slate-700">{selected.estudiante_cedula || 'No especificado'}</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Correo Electrónico</span>
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <a href={`mailto:${selected.estudiante_email}`} className="text-xs font-bold text-[#00B870] hover:underline break-all">{selected.estudiante_email}</a>
                  </div>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Teléfono de Contacto</span>
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <p className="text-xs font-bold text-slate-700">{selected.estudiante_telefono || 'No registrado'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Documents section (if any) */}
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col gap-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-50">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Documentos Adjuntos</h4>
                </div>
                {loadingDocs && <span className="text-[9px] font-bold text-[#00B870] animate-pulse">Cargando...</span>}
              </div>
              {loadingDocs ? (
                <div className="py-6 flex justify-center"><div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
              ) : documentos.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No se encontraron documentos registrados para este estudiante.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
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

            {/* Actions panel */}
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col gap-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-50">
                <CreditCard className="w-4 h-4 text-emerald-600" />
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Acciones de Gestión</h4>
              </div>
              
              {selected.estatus === 'Preinscrito' ? (
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => handleValidar(selected.id_inscripcion)}
                    className="flex-1 py-3 bg-[#00D084] hover:bg-[#00B870] text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-md shadow-[#00D084]/20 active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" strokeWidth={3} />
                    Validar e Inscribir
                  </button>
                  <button
                    onClick={() => handleRechazar(selected.id_inscripcion)}
                    className="py-3 px-5 border border-red-100 text-red-500 hover:bg-red-50 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    <X className="w-4 h-4" strokeWidth={3} />
                    Rechazar
                  </button>
                </div>
              ) : selected.estatus === 'Inscrito' ? (
                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-3 text-emerald-800">
                  <Check className="w-5 h-5 shrink-0" strokeWidth={3} />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide">Solicitud Aprobada</p>
                    <p className="text-[11px] font-semibold mt-0.5 text-emerald-700">Esta inscripción ha sido validada y el estudiante ya se encuentra participando activamente.</p>
                  </div>
                </div>
              ) : selected.estatus === 'Rechazado' ? (
                <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-800">
                  <X className="w-5 h-5 shrink-0" strokeWidth={3} />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide">Solicitud Rechazada</p>
                    <p className="text-[11px] font-semibold mt-0.5 text-red-700">La inscripción fue rechazada administrativamente.</p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">No se pueden realizar acciones administrativas en esta solicitud.</p>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center">
            <div className="w-20 h-20 bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-center text-slate-300 mb-4 animate-bounce duration-1000">
              <GraduationCap className="w-8 h-8" />
            </div>
            <h4 className="text-sm font-bold text-slate-700 mb-1">Selecciona una solicitud</h4>
            <p className="text-xs text-slate-400 max-w-xs leading-relaxed font-semibold">Elige una inscripción de la lista lateral para visualizar el detalle del estudiante, verificar documentos y procesar su inscripción.</p>
          </div>
        )}
      </div>
    </div>
  )
}
