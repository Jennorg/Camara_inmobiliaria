import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { API_URL } from '@/config/env'
import { useAuth } from '@/context/AuthContext'
import { CheckCircle2, Search, FileText, User, Mail, Phone, GraduationCap, BookOpen, Award, Clock, X, UserPlus, Users, ChevronDown } from 'lucide-react'
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

  // Enrollment Modal States
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false)
  const [enrollMode, setEnrollMode] = useState<'afiliado' | 'nuevo'>('afiliado')
  const [cursosDisponibles, setCursosDisponibles] = useState<any[]>([])
  const [afiliadosLista, setAfiliadosLista] = useState<any[]>([])
  const [searchField, setSearchField] = useState<'nombre' | 'cedula' | 'curso'>('nombre')
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)
  const [afiliadoSearch, setAfiliadoSearch] = useState('')
  const [afiliadoSearchField, setAfiliadoSearchField] = useState<'nombre' | 'cedula' | 'email'>('nombre')
  const [showAfiliadoSearchDropdown, setShowAfiliadoSearchDropdown] = useState(false)
  const [selectedCursoId, setSelectedCursoId] = useState<string>('')
  const [selectedAfiliadoId, setSelectedAfiliadoId] = useState<string>('')
  const [submittingEnroll, setSubmittingEnroll] = useState(false)

  const [enrollFormData, setEnrollFormData] = useState({
    nombreCompleto: '',
    email: '',
    cedulaPrefix: 'V',
    cedulaRif: '',
    codigoPais: '+58',
    telefono: '',
    nivelProfesional: 'Nivel Profesional',
    esCorredorInmobiliario: true
  })

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

  const fetchModulos = useCallback(async (idInscripcion: number) => {
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
  }, [authHeaders])

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError('')
    try {
      // Traer estudiantes ya INSCRITOS en cursos (no preinscripciones)
      const qs = new URLSearchParams()
      qs.set('onlyCursos', 'true')
      qs.set('estatus', 'Inscrito')

      const res = await fetch(`${API_URL}/api/academia/preinscripciones?${qs.toString()}`, {
        headers: { ...authHeaders },
        signal,
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
  }, [authHeaders, selected, fetchModulos])

  const handleOpenEnrollModal = async () => {
    setIsEnrollModalOpen(true);
    setAfiliadoSearch('');
    setSelectedAfiliadoId('');
    setEnrollFormData({
      nombreCompleto: '',
      email: '',
      cedulaPrefix: 'V',
      cedulaRif: '',
      codigoPais: '+58',
      telefono: '',
      nivelProfesional: 'Nivel Profesional',
      esCorredorInmobiliario: true
    });

    try {
      const resCursos = await fetch(`${API_URL}/api/academia/cursos`, { headers: { ...authHeaders } });
      if (!resCursos.ok) {
        throw new Error(`HTTP error! status: ${resCursos.status}`);
      }
      const jsonCursos = await resCursos.json();
      if (jsonCursos.success && Array.isArray(jsonCursos.data)) {
        setCursosDisponibles(jsonCursos.data);
        if (jsonCursos.data.length > 0) {
          const primerAbierto = jsonCursos.data.find((c: any) => c.estatus === 'Abierto') || jsonCursos.data[0];
          setSelectedCursoId(String(primerAbierto.id_curso));
        }
      }

      const resAfil = await fetch(`${API_URL}/api/afiliados`, { headers: { ...authHeaders } });
      if (!resAfil.ok) {
        throw new Error(`HTTP error! status: ${resAfil.status}`);
      }
      const jsonAfil = await resAfil.json();
      if (jsonAfil.success && Array.isArray(jsonAfil.data)) {
        setAfiliadosLista(jsonAfil.data);
      }
    } catch (e) {
      console.error('Error cargando datos para inscripción:', e);
    }
  };

  const handleSelectAfiliado = (af: any) => {
    setSelectedAfiliadoId(String(af.id_afiliado || af.id));
    const nombre = [af.nombres, af.apellidos].filter(Boolean).join(' ') || af.razon_social || af.nombre || '';
    const rawCed = String(af.cedula || af.rif || '');
    const prefix = rawCed.includes('-') ? rawCed.split('-')[0].toUpperCase() : 'V';
    const numCed = rawCed.includes('-') ? rawCed.split('-')[1] : rawCed;
    const rawTel = String(af.telefono || af.telefono_movil || '');
    const codeTel = rawTel.startsWith('+') ? (rawTel.match(/^(\+\d{1,4})/)?.[1] || '+58') : '+58';
    const numTel = rawTel.replace(/^(\+\d{1,4}\s?)/, '');

    setEnrollFormData({
      nombreCompleto: nombre,
      email: af.email || '',
      cedulaPrefix: ['V', 'E', 'J', 'G', 'P'].includes(prefix) ? prefix : 'V',
      cedulaRif: numCed,
      codigoPais: codeTel,
      telefono: numTel,
      nivelProfesional: 'Nivel Profesional',
      esCorredorInmobiliario: true
    });
  };

  const handleSubmitEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCursoId) {
      Swal.fire('Atención', 'Selecciona un curso para inscribir al estudiante', 'warning');
      return;
    }
    if (!enrollFormData.nombreCompleto.trim() || !enrollFormData.email.trim()) {
      Swal.fire('Atención', 'Nombre completo y correo electrónico son requeridos', 'warning');
      return;
    }

    const payload = {
      ...enrollFormData,
      cedulaRif: enrollFormData.cedulaRif ? `${enrollFormData.cedulaPrefix || 'V'}-${enrollFormData.cedulaRif.replace(/^[VEJGP]-?/i, '')}` : '',
      telefono: enrollFormData.telefono ? `${enrollFormData.codigoPais || '+58'} ${enrollFormData.telefono.replace(/^(\+\d{1,4}\s?)/, '')}` : ''
    };

    setSubmittingEnroll(true);
    try {
      const res = await fetch(`${API_URL}/api/academia/cursos/${selectedCursoId}/asignar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Error al inscribir estudiante');
      }

      Swal.fire('¡Estudiante Inscrito!', 'El estudiante ha sido registrado e inscrito exitosamente.', 'success');
      setIsEnrollModalOpen(false);
      fetchData();
    } catch (err: any) {
      Swal.fire('Error', err.message || 'Error en el proceso de inscripción', 'error');
    } finally {
      setSubmittingEnroll(false);
    }
  };

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

  useEffect(() => {
    const controller = new AbortController()
    fetchData(controller.signal)
    return () => controller.abort()
  }, [fetchData])

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

  const busyAprobarTodosRef = useRef(false)
  const handleAprobarTodos = async () => {
    if (!selected || busyAprobarTodosRef.current) return
    busyAprobarTodosRef.current = true

    try {
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
      Swal.fire('Error', e.message || 'No se pudo completar la aprobación masiva', 'error')
    } finally {
      setCompleting(false)
      busyAprobarTodosRef.current = false
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
    return filteredByUi.filter(r => {
      if (searchField === 'nombre') {
        return r.estudiante_nombre?.toLowerCase().includes(q) || r.estudiante_email?.toLowerCase().includes(q)
      }
      if (searchField === 'cedula') {
        return r.estudiante_cedula?.toLowerCase().includes(q)
      }
      if (searchField === 'curso') {
        return r.curso_nombre?.toLowerCase().includes(q)
      }
      return (
        r.estudiante_nombre?.toLowerCase().includes(q) ||
        r.estudiante_email?.toLowerCase().includes(q) ||
        r.estudiante_cedula?.toLowerCase().includes(q) ||
        r.curso_nombre?.toLowerCase().includes(q)
      )
    })
  }, [filteredByUi, search, searchField])

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

        <div className="px-4 pt-4 pb-3 border-b border-gray-100 flex flex-col gap-2.5">
          {/* Button Inscribir Nuevo Estudiante */}
          <button
            onClick={handleOpenEnrollModal}
            className="w-full flex items-center justify-center gap-2 bg-[#00D084] hover:bg-[#00B870] text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-md shadow-[#00D084]/20 transition-colors transition-transform active:scale-95 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Inscribir estudiante</span>
          </button>

          {/* Buscador con Dropdown al estilo Directorio de Miembros */}
          <div className="relative flex items-center rounded-xl bg-gray-50/50 border border-gray-200 focus-within:bg-white focus-within:border-[#00D084] focus-within:ring-2 focus-within:ring-[#00D084]/20 transition-colors text-xs h-10 shadow-xs z-20">
            {/* Dropdown de criterio de búsqueda */}
            <div className="relative shrink-0 border-r border-gray-200 h-full flex items-center pl-3 pr-2">
              <button
                type="button"
                onClick={() => setShowSearchDropdown(!showSearchDropdown)}
                className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-slate-600 hover:text-[#00B870] transition-colors"
              >
                <span>
                  {searchField === 'nombre' && 'Nombre'}
                  {searchField === 'cedula' && 'Cédula'}
                  {searchField === 'curso' && 'Curso'}
                </span>
                <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${showSearchDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showSearchDropdown && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowSearchDropdown(false)} />
                  <div className="transition-opacity transition-transform absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl py-1.5 z-40 min-w-[120px] fade-in slide-in-from-top-1 duration-150">
                    {[
                      { key: 'nombre', label: 'Nombre' },
                      { key: 'cedula', label: 'Cédula / RIF' },
                      { key: 'curso', label: 'Curso' },
                    ].map(option => (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => {
                          setSearchField(option.key as any);
                          setShowSearchDropdown(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition-colors ${searchField === option.key
                          ? 'bg-[#E9FAF4] text-[#00B870] font-extrabold'
                          : 'text-slate-600 hover:bg-slate-50'
                          }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="relative flex-grow h-full flex items-center pr-2">
              <Search className="w-3.5 h-3.5 text-slate-400 ml-2 shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={
                  searchField === 'nombre'
                    ? 'Buscar por nombre o email...'
                    : searchField === 'cedula'
                      ? 'Buscar por cédula / RIF...'
                      : 'Buscar por curso...'
                }
                className="w-full h-full pl-2 pr-6 bg-transparent text-slate-800 font-semibold placeholder-slate-400 outline-none text-xs"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center hover:bg-slate-300 transition-colors"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          </div>

          {/* Status filters */}
          <div className="flex flex-wrap gap-1 mt-1">
            {filterConfig.map(f => (
              <button
                key={f.key}
                onClick={() => setUiFilter(f.key)}
                className={[
                  'text-[10px] font-bold px-3 py-1.5 rounded-full transition-transform flex items-center gap-1.5 active:scale-95',
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
                    'w-full text-left px-4 py-4 transition-colors flex flex-col gap-1.5 border-l-4 border-transparent',
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
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border flex items-center gap-1 ${isCompletado
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
                        className="bg-[#00D084] h-full transition-colors duration-300"
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
                    className="px-2.5 py-1 text-[10px] font-bold text-slate-500 hover:text-[#00B870] bg-slate-50 hover:bg-[#E9FAF4] border border-slate-200 hover:border-[#00D084]/20 rounded-lg transition-colors"
                  >
                    Más información
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 font-bold uppercase tracking-wider">Estudiante Inscrito</p>
              </div>
              <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border flex items-center gap-1 ${Number(selected.completado) === 1
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
                    className="text-[9px] font-black uppercase tracking-wider text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors transition-transform px-2.5 py-1 rounded border border-emerald-200 active:scale-95 flex items-center gap-1 shrink-0"
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
                        className="bg-[#00D084] h-full transition-colors duration-500"
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
                                  className="px-2 py-1.5 bg-[#E9FAF4] hover:bg-[#00D084] text-[#00B870] hover:text-white rounded-lg text-[9px] font-black uppercase tracking-wider transition-colors transition-transform border border-[#00D084]/20 active:scale-95 disabled:opacity-50"
                                >
                                  {evaluating === mod.nombre_modulo ? '...' : 'Aprobar'}
                                </button>
                              )}
                              {!isRechazado && (
                                <button
                                  onClick={() => handleRechazarModulo(mod.nombre_modulo)}
                                  disabled={evaluating !== null}
                                  className="px-2 py-1.5 bg-rose-50 hover:bg-rose-500 text-rose-500 hover:text-white rounded-lg text-[9px] font-black uppercase tracking-wider transition-colors transition-transform border border-rose-100 active:scale-95 disabled:opacity-50"
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
          <div className="transition-opacity transition-transform bg-white rounded-2xl max-w-2xl w-full border border-slate-100 shadow-xl overflow-hidden flex flex-col max-h-[85vh] fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Expediente del Estudiante</h3>
                <p className="text-xs text-slate-400 font-semibold">{selected.estudiante_nombre}</p>
              </div>
              <button
                onClick={() => setIsInfoModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
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
                        className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-100 hover:border-emerald-200 hover:bg-[#E9FAF4]/35 transition-colors group"
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
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 rounded-xl transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL INSCRIBIR NUEVO ALUMNO / PERSONA ── */}
      {isEnrollModalOpen && (
        <div className="transition-opacity fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#E9FAF4] text-[#00B870] flex items-center justify-center font-bold">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Inscribir Alumno / Persona</h3>
                  <p className="text-[10px] text-slate-400 font-medium">Asignar estudiante a un curso activo</p>
                </div>
              </div>
              <button
                onClick={() => setIsEnrollModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body Form */}
            <form onSubmit={handleSubmitEnroll} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 space-y-4 overflow-y-auto flex-1">
                {/* Seleccionar Curso */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                    1. Seleccionar Curso o Programa *
                  </label>
                  <select
                    required
                    value={selectedCursoId}
                    onChange={(e) => setSelectedCursoId(e.target.value)}
                    className="w-full text-xs font-semibold text-slate-800 rounded-xl border border-gray-200 px-3.5 py-2.5 focus:ring-2 focus:ring-[#00D084]/20 focus:border-[#00D084] outline-none"
                  >
                    <option value="" disabled>Seleccione un curso...</option>
                    {(Array.isArray(cursosDisponibles) ? cursosDisponibles : []).map((c: any) => (
                      <option key={c.id_curso} value={c.id_curso}>
                        {c.nombre || c.titulo || `Curso #${c.id_curso}`} ({c.estatus})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tipo de Inscrito Switcher */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                    2. Origen del Estudiante *
                  </label>
                  <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => { setEnrollMode('afiliado'); setSelectedAfiliadoId(''); }}
                      className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors ${enrollMode === 'afiliado'
                        ? 'bg-white text-[#00B870] shadow-xs font-extrabold'
                        : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>Afiliado Existente</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setEnrollMode('nuevo'); setSelectedAfiliadoId(''); }}
                      className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors ${enrollMode === 'nuevo'
                        ? 'bg-white text-[#00B870] shadow-xs font-extrabold'
                        : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>Persona No Afiliada</span>
                    </button>
                  </div>
                </div>

                {/* Si elige Afiliado Existente */}
                {enrollMode === 'afiliado' && (
                  <div className="space-y-3 bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 relative z-30">
                    <label className="block text-[10px] font-black text-emerald-800 uppercase tracking-widest mb-1">
                      Buscar en Directorio de Afiliados
                    </label>

                    <div className="relative">
                      {/* Buscador de Nómina de Afiliados al estilo Directorio de Miembros */}
                      <div className="relative flex items-center rounded-xl bg-white border border-emerald-200 focus-within:ring-2 focus-within:ring-[#00D084]/20 transition-colors text-xs h-10 shadow-xs z-30">
                        {/* Dropdown Criterion Selector */}
                        <div className="relative shrink-0 border-r border-emerald-100 h-full flex items-center pl-3 pr-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowAfiliadoSearchDropdown(prev => !prev);
                            }}
                            className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-800 hover:text-[#00B870] transition-colors"
                          >
                            <span>
                              {afiliadoSearchField === 'nombre' && 'Nombre'}
                              {afiliadoSearchField === 'cedula' && 'Cédula'}
                              {afiliadoSearchField === 'email' && 'Correo'}
                            </span>
                            <ChevronDown className={`w-3 h-3 text-emerald-600 transition-transform ${showAfiliadoSearchDropdown ? 'rotate-180' : ''}`} />
                          </button>

                          {showAfiliadoSearchDropdown && (
                            <>
                              <div
                                className="fixed inset-0 z-40"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowAfiliadoSearchDropdown(false);
                                }}
                              />
                              <div className="transition-opacity transition-transform absolute left-0 top-full mt-1 bg-white border border-emerald-200 rounded-xl shadow-xl py-1.5 z-50 min-w-[120px] fade-in slide-in-from-top-1 duration-150">
                                {[
                                  { key: 'nombre', label: 'Nombre' },
                                  { key: 'cedula', label: 'Cédula / RIF' },
                                  { key: 'email', label: 'Correo' },
                                ].map(option => (
                                  <button
                                    key={option.key}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setAfiliadoSearchField(option.key as any);
                                      setShowAfiliadoSearchDropdown(false);
                                    }}
                                    className={`w-full text-left px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition-colors ${afiliadoSearchField === option.key
                                      ? 'bg-[#E9FAF4] text-[#00B870] font-extrabold'
                                      : 'text-slate-600 hover:bg-slate-50'
                                      }`}
                                  >
                                    {option.label}
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </div>

                        <div className="relative flex-grow h-full flex items-center pr-2">
                          <Search className="w-3.5 h-3.5 text-emerald-600 ml-2 shrink-0" />
                          <input
                            type="text"
                            value={afiliadoSearch}
                            onChange={(e) => setAfiliadoSearch(e.target.value)}
                            placeholder={
                              afiliadoSearchField === 'nombre'
                                ? 'Buscar por nombre completo...'
                                : afiliadoSearchField === 'cedula'
                                  ? 'Buscar por cédula o RIF...'
                                  : 'Buscar por correo electrónico...'
                            }
                            className="w-full h-full pl-2 pr-6 bg-transparent text-slate-800 font-semibold placeholder-slate-400 outline-none text-xs"
                          />
                          {afiliadoSearch && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setAfiliadoSearch(''); }}
                              className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center hover:bg-emerald-200 transition-colors"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Lista filtrada de afiliados FLOTANTE / position absolute */}
                      {afiliadoSearch.trim().length > 0 && (
                        <div className="transition-opacity transition-transform absolute left-0 right-0 top-full mt-1.5 z-50 max-h-48 overflow-y-auto divide-y divide-emerald-100/60 bg-white rounded-2xl border border-emerald-200 shadow-2xl fade-in slide-in-from-top-1 duration-150">
                          {(Array.isArray(afiliadosLista) ? afiliadosLista : [])
                            .filter((af: any) => {
                              if (!af) return false;
                              const q = afiliadoSearch.toLowerCase();
                              const nombre = [af.nombres, af.apellidos, af.razon_social, af.nombre].filter(Boolean).join(' ').toLowerCase();
                              const cedula = String(af.cedula || af.rif || af.cedula_rif || '').toLowerCase();
                              const email = String(af.email || '').toLowerCase();

                              if (afiliadoSearchField === 'nombre') return nombre.includes(q);
                              if (afiliadoSearchField === 'cedula') return cedula.includes(q);
                              if (afiliadoSearchField === 'email') return email.includes(q);
                              return nombre.includes(q) || email.includes(q) || cedula.includes(q);
                            })
                            .slice(0, 8)
                            .map((af: any) => {
                              const nombre = [af.nombres, af.apellidos].filter(Boolean).join(' ') || af.razon_social || af.nombre || 'Sin nombre';
                              const isSel = String(af.id_afiliado || af.id) === selectedAfiliadoId;
                              return (
                                <button
                                  key={af.id_afiliado || af.id}
                                  type="button"
                                  onClick={() => {
                                    handleSelectAfiliado(af);
                                    setAfiliadoSearch('');
                                  }}
                                  className={`w-full text-left p-3 text-xs flex items-center justify-between transition-colors ${isSel ? 'bg-[#E9FAF4] text-[#00B870] font-bold' : 'hover:bg-slate-50 text-slate-700'
                                    }`}
                                >
                                  <div className="min-w-0">
                                    <p className="font-bold truncate">{nombre}</p>
                                    <p className="text-[10px] text-slate-400 truncate">{af.email || 'Sin correo'} • C.I: {af.cedula || 'S/N'}</p>
                                  </div>
                                  {isSel && <CheckCircle2 className="w-4 h-4 text-[#00B870] shrink-0 ml-2" />}
                                </button>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Campos de datos del estudiante */}
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      Nombre Completo del Estudiante *
                    </label>
                    <input
                      required
                      type="text"
                      placeholder="Ej. María Pérez"
                      value={enrollFormData.nombreCompleto}
                      onChange={(e) => setEnrollFormData({ ...enrollFormData, nombreCompleto: e.target.value })}
                      className="w-full text-xs font-semibold rounded-xl border border-gray-200 px-3.5 py-2.5 text-slate-800 focus:ring-2 focus:ring-[#00D084]/20 focus:border-[#00D084] outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                        Correo Electrónico *
                      </label>
                      <input
                        required
                        type="email"
                        placeholder="ejemplo@correo.com"
                        value={enrollFormData.email}
                        onChange={(e) => setEnrollFormData({ ...enrollFormData, email: e.target.value })}
                        className="w-full text-xs font-semibold rounded-xl border border-gray-200 px-3.5 py-2.5 text-slate-800 focus:ring-2 focus:ring-[#00D084]/20 focus:border-[#00D084] outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                        Tipo y Cédula / RIF
                      </label>
                      <div className="flex rounded-xl border border-gray-200 overflow-hidden focus-within:ring-2 focus-within:ring-[#00D084]/20 focus-within:border-[#00D084] transition-colors bg-white">
                        <select
                          value={enrollFormData.cedulaPrefix || 'V'}
                          onChange={(e) => setEnrollFormData({ ...enrollFormData, cedulaPrefix: e.target.value })}
                          className="bg-slate-50 border-r border-gray-200 px-2.5 text-xs font-black text-slate-700 outline-none cursor-pointer shrink-0"
                        >
                          <option value="V">V-</option>
                          <option value="E">E-</option>
                          <option value="J">J-</option>
                          <option value="G">G-</option>
                          <option value="P">P-</option>
                        </select>
                        <input
                          type="text"
                          placeholder="12345678"
                          value={enrollFormData.cedulaRif}
                          onChange={(e) => setEnrollFormData({ ...enrollFormData, cedulaRif: e.target.value.replace(/[^\d]/g, '') })}
                          className="w-full text-xs font-semibold px-3 py-2.5 text-slate-800 outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      Teléfono de Contacto
                    </label>
                    <div className="flex rounded-xl border border-gray-200 overflow-hidden focus-within:ring-2 focus-within:ring-[#00D084]/20 focus-within:border-[#00D084] transition-colors bg-white">
                      <select
                        value={enrollFormData.codigoPais || '+58'}
                        onChange={(e) => setEnrollFormData({ ...enrollFormData, codigoPais: e.target.value })}
                        className="bg-slate-50 border-r border-gray-200 px-2.5 text-xs font-black text-slate-700 outline-none cursor-pointer shrink-0 max-w-[110px]"
                      >
                        <option value="+58">🇻🇪 +58</option>
                        <option value="+57">🇨🇴 +57</option>
                        <option value="+1">🇺🇸 +1</option>
                        <option value="+34">🇪🇸 +34</option>
                        <option value="+52">🇲🇽 +52</option>
                        <option value="+56">🇨🇱 +56</option>
                        <option value="+54">🇦🇷 +54</option>
                        <option value="+51">🇵🇪 +51</option>
                        <option value="+593">🇪🇨 +593</option>
                        <option value="+507">🇵🇦 +507</option>
                        <option value="+1-809">🇩🇴 +1</option>
                      </select>
                      <input
                        type="text"
                        placeholder="0414-1234567"
                        value={enrollFormData.telefono}
                        onChange={(e) => setEnrollFormData({ ...enrollFormData, telefono: e.target.value })}
                        className="w-full text-xs font-semibold px-3 py-2.5 text-slate-800 outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsEnrollModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingEnroll}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-[#00D084] hover:bg-[#00B870] rounded-xl shadow-md shadow-[#00D084]/20 transition-colors transition-opacity flex items-center gap-1.5 disabled:opacity-50"
                >
                  {submittingEnroll ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Registrando...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>Registrar e Inscribir</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
