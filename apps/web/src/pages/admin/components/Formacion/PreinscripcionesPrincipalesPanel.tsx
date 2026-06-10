import React, { useEffect, useMemo, useState } from 'react'
import { API_URL } from '@/config/env'
import { useAuth } from '@/context/AuthContext'
import { ClipboardList, FileText, Calendar, ShieldCheck, GraduationCap, CreditCard, Check, User, Search, Building2 } from 'lucide-react'
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
  representante_nombre?: string | null
  representante_cedula?: string | null
  representante_email?: string | null
  representante_telefono?: string | null
  tipo_estudiante?: string | null
  afiliado_estatus?: string
  afiliado_tipo?: string | null
  empresa_vinculada_nombre?: string | null
  estudiante_es_corredor_inmobiliario?: number | boolean | null
  estudiante_nivel_profesional?: string | null
  estudiante_profesion?: string | null
  ano_inicio_servicio?: number | null
  apto_acreditacion?: number
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
  const [filtroAcreditacion, setFiltroAcreditacion] = useState<'todos' | 'apto' | 'no_apto'>('todos')
  const [rows, setRows] = useState<Row[]>([])
  const [counts, setCounts] = useState({ Todos: 0, Pendiente: 0, Entrevista: 0, Aprobado: 0, Rechazado: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Row | null>(null)
  const [documentos, setDocumentos] = useState<{ id_documento: number; tipo_doc: string; url: string; nombre_archivo: string | null }[]>([])
  const [loadingDocs, setLoadingDocs] = useState(false)
  const [toggleLoading, setToggleLoading] = useState(false)

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
      const targetId = idFromUrl ? Number(idFromUrl) : (selected ? selected.id_inscripcion : null)
      if (targetId) {
        const found = data.find(r => r.id_inscripcion === targetId)
        if (found) {
          setSelected(found)
          fetchDocumentos(found.id_estudiante)
        } else {
          setSelected(null)
          setDocumentos([])
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
          modulosAcreditados: finalizarData.modulos,
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

  const handleVerReferencia = async (nombre: string) => {
    try {
      Swal.fire({
        title: 'Buscando afiliado...',
        text: `Consultando información de "${nombre}"`,
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading() }
      })
      const res = await fetch(`${API_URL}/api/academia/afiliados/referencia?nombre=${encodeURIComponent(nombre)}`, {
        headers: { ...authHeaders }
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'Error en la búsqueda')
      if (!json.data) {
        Swal.fire({
          title: 'Afiliado no encontrado',
          text: `No se encontró ningún miembro registrado con el nombre "${nombre}".`,
          icon: 'warning',
          confirmButtonColor: '#059669'
        })
        return
      }
      const af = json.data
      Swal.fire({
        title: 'Referencia Encontrada',
        html: `
          <div class="text-left text-sm text-slate-700 space-y-3">
            <div class="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-0.5">
              <p class="text-[10px] font-black uppercase text-slate-400">Nombre Completo</p>
              <p class="font-bold text-slate-800">${af.nombre_completo}</p>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div class="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-0.5">
                <p class="text-[10px] font-black uppercase text-slate-400">Cédula / RIF</p>
                <p class="font-bold text-slate-800">${af.doc_identidad || 'No registrado'}</p>
              </div>
              <div class="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-0.5">
                <p class="text-[10px] font-black uppercase text-slate-400">Código</p>
                <p class="font-bold text-slate-800">${af.codigo || 'Sin código'}</p>
              </div>
            </div>
            <div class="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-0.5">
              <p class="text-[10px] font-black uppercase text-slate-400">Estatus</p>
              <span class="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">${af.estatus}</span>
            </div>
          </div>
        `,
        icon: 'success',
        confirmButtonColor: '#059669'
      })
    } catch (e: any) {
      Swal.fire({ title: 'Error', text: e.message || 'Error al buscar referencia', icon: 'error' })
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
    } catch (e: any) { setError(e.message) }
  }

  const remitirACibir = async (id: number) => {
    try {
      const res = await fetch(`${API_URL}/api/academia/inscripciones/${id}/remitir-cibir`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'No se pudo remitir')
      await fetchData()
    } catch (e: any) { setError(e.message) }
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
    } catch (e: any) { setError(e.message) }
  }

  const eliminarSolicitud = async (id: number) => {
    const result = await Swal.fire({
      title: '¿Eliminar solicitud?',
      text: 'Esta acción es irreversible y borrará todos los datos del aspirante.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      confirmButtonText: 'Sí, borrar todo'
    })
    if (result.isConfirmed) {
      try {
        const res = await fetch(`${API_URL}/api/academia/inscripciones/${id}`, {
          method: 'DELETE',
          headers: { ...authHeaders },
        })
        const json = await res.json()
        if (!res.ok || !json.success) throw new Error(json.message || 'Error al eliminar')
        setSelected(null)
        await fetchData()
      } catch (e: any) { Swal.fire({ title: 'Error', text: e.message, icon: 'error' }) }
    }
  }

  const filteredRows = useMemo(() => {
    let result = rows
    if (filtroAcreditacion === 'apto') {
      result = result.filter(r => r.programa_codigo === 'AFILIACION' && !!r.apto_acreditacion)
    } else if (filtroAcreditacion === 'no_apto') {
      result = result.filter(r => r.programa_codigo !== 'AFILIACION' || !r.apto_acreditacion)
    }
    if (!search) return result
    const q = search.toLowerCase()
    return result.filter(r =>
      (r.estudiante_nombre || '').toLowerCase().includes(q) ||
      (r.estudiante_email || '').toLowerCase().includes(q) ||
      (r.estudiante_cedula || '').toLowerCase().includes(q)
    )
  }, [rows, search, filtroAcreditacion])

  const mapStatusUI = (s: Estatus) => {
    if (s === 'Preinscrito') return 'Pendiente'
    if (s === 'Inscrito') return 'Aprobado'
    return s
  }
  const getStatusStyles = (s: Estatus) => {
    if (s === 'Preinscrito') return 'bg-amber-50 text-amber-600'
    if (s === 'Entrevista') return 'bg-emerald-50 text-emerald-600'
    if (s === 'Inscrito') return 'bg-emerald-50 text-emerald-600'
    if (s === 'Rechazado') return 'bg-red-50 text-red-500'
    return 'bg-slate-100 text-slate-500'
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-[340px_1fr] grid-rows-1 h-full w-full overflow-hidden relative">
      {/* Listado lateral */}
      <div className={['flex flex-col bg-white border-r border-gray-100 overflow-hidden min-h-0', selected ? 'hidden sm:flex' : 'flex'].join(' ')}>
        <div className="px-3 pt-3 pb-2 border-b border-gray-100 flex flex-col gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
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
              className="text-[10px] font-bold px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-slate-600 outline-none focus:border-[#00D084] transition-all flex-1"
            >
              <option value="Todos">Todos los Programas</option>
              <option value="AFILIACION">AFILIACION</option>
              <option value="CIBIR">CIBIR</option>
              <option value="PADI">PADI</option>
              <option value="PEGI">PEGI</option>
              <option value="PREANI">PREANI</option>
            </select>

            <select
              value={filtroAcreditacion}
              onChange={(e) => setFiltroAcreditacion(e.target.value as any)}
              className="text-[10px] font-bold px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-slate-600 outline-none focus:border-[#00D084] transition-all flex-1"
            >
              <option value="todos">Todos (Acreditación)</option>
              <option value="apto">Apto para acreditación</option>
              <option value="no_apto">No apto para acreditación</option>
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
            <div className="p-4 text-center text-xs text-slate-400 font-semibold uppercase tracking-widest mt-10 animate-pulse">Cargando...</div>
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
                <div className="flex items-start justify-between gap-2">
                  <span className={['text-sm font-semibold flex-1', selected?.id_inscripcion === r.id_inscripcion ? 'text-[#00B870]' : 'text-slate-800'].join(' ')}>
                    {r.estudiante_nombre}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getStatusStyles(r.estatus)}`}>
                    {mapStatusUI(r.estatus)}
                  </span>
                </div>
                <span className="text-xs text-slate-400 truncate">
                  {r.programa_codigo === 'AFILIACION' && r.afiliado_tipo ? (
                    r.afiliado_tipo === 'Corporativo' ? 'Corporativo' :
                    r.afiliado_tipo === 'Agente Corporativo' || r.afiliado_tipo === 'Agente' 
                      ? `Agente Corporativo${r.empresa_vinculada_nombre ? ` (${r.empresa_vinculada_nombre})` : ''}` :
                    'Agente Independiente'
                  ) : r.programa_codigo}
                  {' • '}{r.estudiante_cedula || 'S/N'}
                </span>
                {r.programa_codigo === 'AFILIACION' && !!r.apto_acreditacion && (
                  <span className="inline-block text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-100 mt-0.5 self-start">
                    Apto para acreditación
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Detalle del aspirante */}
      <div className={['bg-gray-50 overflow-hidden relative min-h-0', selected ? 'block' : 'hidden sm:block'].join(' ')}>
        {selected ? (
          <div className="absolute inset-0 overflow-y-auto p-4 sm:p-6">
            <button onClick={() => setSelected(null)} className="sm:hidden mb-4 flex items-center gap-1 text-xs text-slate-500 font-bold uppercase"><ChevronDown className="rotate-90 w-4 h-4" /> Volver</button>
            
            <div className="bg-white rounded-2xl p-4 border border-gray-100 flex items-center gap-4 flex-wrap mb-4">
              <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 font-black text-xl">
                {selected.estudiante_nombre.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-black text-slate-900 leading-tight uppercase">{selected.estudiante_nombre}</h3>
                <p className="text-xs text-slate-400 mt-0.5 font-bold uppercase tracking-widest">{selected.estudiante_cedula || 'S/D'}</p>
                {selected.programa_codigo === 'AFILIACION' && !!selected.apto_acreditacion && (
                  <span className="inline-block text-[10px] font-black px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-100 mt-1 uppercase tracking-tighter">
                    Apto para acreditación
                  </span>
                )}
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={`text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-wider ${getStatusStyles(selected.estatus)}`}>
                  {mapStatusUI(selected.estatus)}
                </span>
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{selected.programa_codigo}</span>
              </div>
            </div>

            {/* Stepper de Progreso */}
            {selected.programa_codigo === 'AFILIACION' && (() => {
              const getActiveIndex = (est: string, aEst?: string) => {
                if (aEst) {
                  switch (aEst) {
                    case '1_PREINSCRIPCION': return 0;
                    case '2_EXPEDIENTE': return 1;
                    case '3_ENTREVISTA': return 2;
                    case '4_VERIFICACION': return 3;
                    case '5_CIBIR': return 4;
                    case '6_INSCRIPCION': return 5;
                    case 'Afiliado': return 6;
                    default: break;
                  }
                }
                switch (est) {
                  case 'Preinscrito': return 1;
                  case 'Entrevista': return 2;
                  case 'Inscrito': return 6;
                  default: return 0;
                }
              }
              const activeIndex = getActiveIndex(selected.estatus, selected.afiliado_estatus)
              return (
                <div className="bg-white rounded-2xl p-5 border border-gray-100 mb-4 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Progreso del Trámite</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">{activeIndex + 1} de 7</span>
                  </div>
                  <div className="relative flex items-start justify-between px-2 pt-2 pb-6">
                    <div className="absolute left-6 right-6 top-[24px] h-0.5 bg-slate-100 -z-0" />
                    <div className="absolute left-6 top-[24px] h-0.5 bg-emerald-500 -z-0 transition-all duration-500" style={{ width: `calc(${(activeIndex / 6) * 100}% - 12px)` }} />
                    {AFILIACION_STEPS_FLOW.map((step, idx) => {
                      const isCompleted = idx < activeIndex;
                      const isCurrent = idx === activeIndex;
                      const StepIcon = step.icon;
                      return (
                        <div key={idx} className="flex flex-col items-center relative z-10 group gap-1.5">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isCompleted ? 'bg-emerald-500 text-white' : isCurrent ? 'bg-emerald-600 text-white ring-4 ring-emerald-100 scale-110' : 'bg-white text-slate-300 border-2 border-slate-100'}`}>
                            {isCompleted ? <Check className="w-4 h-4" strokeWidth={3} /> : <StepIcon className="w-4 h-4" />}
                          </div>
                          <span className={`text-[8px] font-black tracking-tighter uppercase ${isCurrent ? 'text-emerald-600' : 'text-slate-300'}`}>{step.labelShort}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}

            {/* Datos del aspirante */}
            {selected.tipo_estudiante === 'Corporativo' || selected.estudiante_cedula?.startsWith('J') ? (
              <>
                {/* Sección Empresa */}
                <div className="bg-white rounded-2xl p-4 border border-gray-100 mb-3">
                  <div className="flex items-center gap-2 mb-3">
                    <Building2 className="w-4 h-4 text-slate-500" />
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Información de la Empresa</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">RIF</span>
                      <span className="text-sm text-slate-700 font-medium break-all">{selected.estudiante_cedula || 'No indicado'}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Teléfono</span>
                      <span className="text-sm text-slate-700 font-medium break-all">
                        {selected.estudiante_telefono || 'No indicado'}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5 sm:col-span-2">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Email</span>
                      <span className="text-sm text-slate-700 font-medium break-all">{selected.estudiante_email}</span>
                    </div>
                  </div>
                </div>

                {/* Sección Representante */}
                <div className="bg-white rounded-2xl p-4 border border-gray-100 mb-3">
                  <div className="flex items-center gap-2 mb-3">
                    <User className="w-4 h-4 text-slate-500" />
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Información del Representante</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-0.5 sm:col-span-2">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Nombre</span>
                      <span className="text-sm text-slate-700 font-medium break-all">{selected.representante_nombre || 'No indicado'}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Cédula</span>
                      <span className="text-sm text-slate-700 font-medium break-all">{selected.representante_cedula || 'No indicado'}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Teléfono</span>
                      <span className="text-sm text-slate-700 font-medium break-all">
                        {selected.representante_telefono || selected.estudiante_telefono || 'No indicado'}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5 sm:col-span-2">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Email</span>
                      <span className="text-sm text-slate-700 font-medium break-all">{selected.representante_email || 'No indicado'}</span>
                    </div>
                  </div>
                </div>

                {/* Sección Empresa Vinculada (Solo para Agentes) */}
                {(selected.afiliado_tipo === 'Agente Corporativo' || selected.afiliado_tipo === 'Agente') && selected.empresa_vinculada_nombre && (
                  <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100 mb-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Building2 className="w-4 h-4 text-emerald-600" />
                      <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide">Empresa Vinculada</p>
                    </div>
                    <p className="text-sm text-emerald-900 font-black uppercase tracking-tight">
                      {selected.empresa_vinculada_nombre}
                    </p>
                    <p className="text-[10px] text-emerald-600 font-medium mt-0.5">
                      Este agente pertenece a la nómina de esta empresa afiliada.
                    </p>
                  </div>
                )}
              </>
            ) : (
              /* Vista Normal (Persona Natural) */
              <div className="bg-white rounded-2xl p-4 border border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
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
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Nivel Académico</span>
                  <span className="text-sm text-slate-700 font-medium break-all">{selected.estudiante_nivel_profesional || 'No indicado'}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Profesión</span>
                  <span className="text-sm text-slate-700 font-medium break-all">{selected.estudiante_profesion || 'No indicado'}</span>
                </div>
                {selected.ano_inicio_servicio !== undefined && selected.ano_inicio_servicio !== null && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Año Inicio de Servicio</span>
                    <span className="text-sm text-slate-700 font-medium break-all">{selected.ano_inicio_servicio}</span>
                  </div>
                )}
                <div className="sm:col-span-2 flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl mt-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-bold text-slate-800">¿Es Corredor Inmobiliario?</span>
                    <span className="text-[10px] text-slate-400">Información sobre si el aspirante ejerce en el sector</span>
                  </div>
                  <div>
                    {selected.estudiante_es_corredor_inmobiliario ? (
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-black px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 uppercase tracking-wider">
                        Sí, es Asesor
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-black px-3 py-1.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 uppercase tracking-wider">
                        No es Asesor
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Documentos */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100 mb-4">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Documentación Adjunta</span>
              {loadingDocs ? <div className="py-8 text-center animate-pulse"><Loader2 className="animate-spin mx-auto text-slate-300" /></div> : documentos.length === 0 ? <div className="py-4 text-center text-xs text-slate-300 italic">Sin documentos</div> : (
                <div className="flex flex-col gap-2">
                  {documentos.map(doc => (
                    <div key={doc.id_documento} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <a href={doc.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 flex-1 min-w-0 hover:text-emerald-600 transition-colors">
                        <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-bold truncate">{doc.nombre_archivo || doc.tipo_doc}</span>
                          <span className="text-[9px] text-slate-400 uppercase font-black">{doc.tipo_doc.replace(/_/g, ' ')}</span>
                        </div>
                      </a>
                      {['referencia_afiliado_1', 'referencia_afiliado_2'].includes(doc.tipo_doc) && doc.nombre_archivo && (
                        <button onClick={() => handleVerReferencia(doc.nombre_archivo!)} className="ml-2 px-2 py-1 rounded-lg bg-white border border-slate-200 text-[9px] font-black text-slate-500 hover:bg-slate-50 uppercase tracking-tighter">Validar Afiliado</button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Acciones */}
            {['Preinscrito', 'Entrevista'].includes(selected.estatus) && (
              <div className="bg-white rounded-2xl p-5 border border-gray-100 flex flex-col gap-3">
                {selected.estatus === 'Preinscrito' && (
                  <div className="flex gap-2">
                    {selected.programa_codigo === 'AFILIACION' ? (
                      <>
                        {selected.apto_acreditacion ? (
                          <button onClick={() => aprobarDirecto(selected.id_inscripcion)} className="flex-1 py-3 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-200">Aprobar Directo</button>
                        ) : (
                          <button onClick={() => remitirACibir(selected.id_inscripcion)} className="flex-1 py-3 rounded-xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-200">Remitir a CIBIR</button>
                        )}
                        <button onClick={() => setShowModalAgendar(true)} className="flex-1 py-3 rounded-xl bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest">Agendar Cita</button>
                      </>
                    ) : <button onClick={() => aprobarDirecto(selected.id_inscripcion)} className="flex-1 py-3 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest">Aprobar</button>}
                    <button onClick={() => rechazar(selected.id_inscripcion)} className="px-4 py-3 rounded-xl bg-red-50 text-red-600 text-[10px] font-black uppercase tracking-widest hover:bg-red-100">Rechazar</button>
                  </div>
                )}
                {selected.estatus === 'Entrevista' && (
                  <div className="flex flex-col gap-3">
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-xs font-bold text-emerald-700">Entrevista: {selected.entrevista_fecha} @ {selected.entrevista_hora}</div>
                    <div className="flex gap-2">
                      <button onClick={() => setShowModalFinalizar(true)} className="flex-1 py-3 rounded-xl bg-[#00D084] text-white text-[10px] font-black uppercase tracking-widest">Dar Veredicto</button>
                      <button onClick={() => setShowModalAgendar(true)} className="px-4 py-3 rounded-xl border border-slate-200 text-slate-500 text-[10px] font-black uppercase tracking-widest">Reprogramar</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <button onClick={() => eliminarSolicitud(selected.id_inscripcion)} className="w-full mt-4 py-3 rounded-xl text-[9px] font-black text-red-300 hover:text-red-500 uppercase tracking-widest transition-colors">Eliminar Solicitud del Sistema</button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-200">
            <ClipboardList className="w-12 h-12" />
            <p className="text-xs font-black uppercase tracking-widest">Selecciona un registro</p>
          </div>
        )}
      </div>

      {/* Modal Agendar */}
      {showModalAgendar && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-6">
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-4">Programar Entrevista</h3>
            <div className="flex flex-col gap-4">
              <input type="date" value={entrevista.fecha} onChange={e => setEntrevista({ ...entrevista, fecha: e.target.value })} className="w-full p-3 rounded-xl bg-slate-50 border border-slate-100 text-sm" />
              <input type="time" value={entrevista.hora} onChange={e => setEntrevista({ ...entrevista, hora: e.target.value })} className="w-full p-3 rounded-xl bg-slate-50 border border-slate-100 text-sm" />
              <input type="text" value={entrevista.lugar} onChange={e => setEntrevista({ ...entrevista, lugar: e.target.value })} className="w-full p-3 rounded-xl bg-slate-50 border border-slate-100 text-sm" placeholder="Lugar..." />
              <button onClick={agendarEntrevista} className="w-full py-3 rounded-xl bg-emerald-600 text-white font-black uppercase text-xs tracking-widest">Confirmar Cita</button>
              <button onClick={() => setShowModalAgendar(false)} className="w-full text-slate-400 font-bold uppercase text-[10px]">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Finalizar */}
      {showModalFinalizar && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl p-6">
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-6">Veredicto Administrativo</h3>
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-3 gap-2">
                {(['Aprobado', 'Parcial', 'Rechazado'] as const).map(res => (
                  <button key={res} onClick={() => setFinalizarData({ ...finalizarData, resultado: res })} className={`py-3 rounded-xl text-[10px] font-black uppercase border transition-all ${finalizarData.resultado === res ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white text-slate-400 border-slate-100'}`}>{res}</button>
                ))}
              </div>
              {finalizarData.resultado === 'Parcial' && (
                <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100">
                  <span className="text-[10px] font-black text-emerald-600 uppercase mb-3 block">Módulos Acreditados</span>
                  <div className="grid grid-cols-5 gap-2">
                    {[1, 2, 3, 4, 5].map(m => (
                      <button key={m} onClick={() => setFinalizarData({ ...finalizarData, modulos: finalizarData.modulos.includes(m) ? finalizarData.modulos.filter(x => x !== m) : [...finalizarData.modulos, m] })} className={`h-10 rounded-lg text-[10px] font-black border transition-all ${finalizarData.modulos.includes(m) ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white text-slate-300 border-slate-100'}`}>M{m}</button>
                    ))}
                  </div>
                </div>
              )}
              <textarea value={finalizarData.nota} onChange={e => setFinalizarData({ ...finalizarData, nota: e.target.value })} className="w-full p-4 rounded-xl bg-slate-50 border border-slate-100 text-sm min-h-[100px]" placeholder="Notas internas..." />
              <button onClick={finalizarEntrevista} className="w-full py-4 rounded-xl bg-slate-900 text-white font-black uppercase text-xs tracking-widest">Finalizar y Notificar</button>
              <button onClick={() => setShowModalFinalizar(false)} className="w-full text-slate-400 font-bold uppercase text-[10px]">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Loader2({ className }: { className?: string }) {
  return <Search className={['animate-spin', className].join(' ')} />
}

function ChevronDown({ className }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6" /></svg>
}
