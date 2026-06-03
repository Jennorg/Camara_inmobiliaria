import React, { useEffect, useMemo, useState } from 'react'
import { API_URL } from '@/config/env'
import { useAuth } from '@/context/AuthContext'
import { formatNombreCard } from '@/utils/formatters'
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
  ano_inicio_servicio?: number | null
  apto_convalidacion?: number
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
  const [filtroConvalidacion, setFiltroConvalidacion] = useState<'todos' | 'apto' | 'no_apto'>('todos')
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

  const handleToggleCorredor = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selected) return
    const newStatus = e.target.checked
    setToggleLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/academia/inscripciones/${selected.id_inscripcion}/toggle-corredor`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ esCorredor: newStatus }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'No se pudo actualizar')
      
      // Update local state
      setRows(prev => prev.map(r => r.id_inscripcion === selected.id_inscripcion ? { ...r, estudiante_es_corredor_inmobiliario: newStatus } : r))
      setSelected(prev => prev ? { ...prev, estudiante_es_corredor_inmobiliario: newStatus } : null)
      
      Swal.fire({
        title: '¡Actualizado!',
        text: 'El estado de corredor inmobiliario ha sido actualizado.',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false
      })
    } catch (err: any) {
      Swal.fire({
        title: 'Error',
        text: err.message || 'No se pudo actualizar el estado',
        icon: 'error'
      })
    } finally {
      setToggleLoading(false)
    }
  }

  const handleVerReferencia = async (nombre: string) => {
    try {
      Swal.fire({
        title: 'Buscando afiliado...',
        text: `Consultando información de "${nombre}"`,
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading()
        }
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
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-0.5">
                <p class="text-[10px] font-black uppercase text-slate-400">Código de Afiliado</p>
                <p class="font-bold text-slate-800">${af.codigo || 'Sin código'}</p>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div class="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-0.5">
                <p class="text-[10px] font-black uppercase text-slate-400">Tipo de Afiliación</p>
                <p class="font-bold text-slate-800">${af.tipo_afiliado}</p>
              </div>
              <div class="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-0.5">
                <p class="text-[10px] font-black uppercase text-slate-400">Estatus</p>
                <div>
                  <span class="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                    ${af.estatus}
                  </span>
                </div>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div class="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-0.5">
                <p class="text-[10px] font-black uppercase text-slate-400">Teléfono</p>
                <p class="font-bold text-slate-800 break-all">${af.telefono || 'No registrado'}</p>
              </div>
              <div class="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-0.5">
                <p class="text-[10px] font-black uppercase text-slate-400">Email</p>
                <p class="font-bold text-slate-800 break-all">${af.email || 'No registrado'}</p>
              </div>
            </div>
          </div>
        `,
        icon: 'success',
        confirmButtonColor: '#059669',
        confirmButtonText: 'Entendido'
      })
    } catch (e: any) {
      Swal.fire({
        title: 'Error',
        text: e.message || 'No se pudo obtener la información de la referencia',
        icon: 'error',
        confirmButtonColor: '#059669'
      })
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

  const eliminarSolicitud = async (id: number) => {
    if (!selected) return

    const result = await Swal.fire({
      title: '¿Eliminar solicitud por completo?',
      text: 'Esta acción borrará de forma permanente el expediente del aspirante, su usuario y todos sus datos relacionados de la base de datos. Esta acción es irreversible.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#cbd5e1',
      confirmButtonText: 'Sí, borrar todo',
      cancelButtonText: 'Cancelar'
    })

    if (result.isConfirmed) {
      try {
        const res = await fetch(`${API_URL}/api/academia/inscripciones/${id}`, {
          method: 'DELETE',
          headers: { ...authHeaders },
        })
        const json = await res.json()
        if (!res.ok || !json.success) throw new Error(json.message || 'No se pudo eliminar la solicitud')
        
        Swal.fire({
          title: '¡Eliminada!',
          text: 'La solicitud ha sido eliminada por completo del sistema.',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        })
        setSelected(null)
        await fetchData()
      } catch (e: any) {
        Swal.fire({
          title: 'Error',
          text: e.message || 'No se pudo eliminar la solicitud',
          icon: 'error',
          confirmButtonColor: '#059669'
        })
      }
    }
  }

  const filteredRows = useMemo(() => {
    let result = rows
    if (filtroConvalidacion === 'apto') {
      result = result.filter(r => r.programa_codigo === 'AFILIACION' && !!r.apto_convalidacion)
    } else if (filtroConvalidacion === 'no_apto') {
      result = result.filter(r => r.programa_codigo !== 'AFILIACION' || !r.apto_convalidacion)
    }

    if (!search) return result
    const q = search.toLowerCase()
    return result.filter(r =>
      r.estudiante_nombre?.toLowerCase().includes(q) ||
      r.estudiante_email?.toLowerCase().includes(q) ||
      r.estudiante_cedula?.toLowerCase().includes(q)
    )
  }, [rows, search, filtroConvalidacion])

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
              value={filtroConvalidacion}
              onChange={(e) => setFiltroConvalidacion(e.target.value as any)}
              className="text-[10px] font-bold px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-slate-600 outline-none focus:border-[#00D084] transition-all flex-1"
            >
              <option value="todos">Todos (Convalidación)</option>
              <option value="apto">Apto para convalidación</option>
              <option value="no_apto">No apto para convalidación</option>
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
                {r.programa_codigo === 'AFILIACION' && !!r.apto_convalidacion && (
                  <span className="inline-block text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-100 mt-0.5 self-start">
                    Apto para convalidación
                  </span>
                )}
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
                <h3 className="text-sm font-bold text-slate-900 leading-tight">{selected.estudiante_nombre}</h3>

                <p className="text-xs text-slate-400 mt-0.5 truncate">{selected.estudiante_cedula || 'Sin documento'}</p>
                {selected.programa_codigo === 'AFILIACION' && !!selected.apto_convalidacion && (
                  <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-100 mt-1">
                    Apto para convalidación
                  </span>
                )}
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${getStatusStyles(selected.estatus)}`}>
                  {mapStatusUI(selected.estatus)} por: {selected.programa_codigo === 'AFILIACION' ? 'Afiliación' : selected.programa_codigo}
                </span>
                {selected.programa_codigo === 'AFILIACION' && selected.afiliado_tipo ? (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    selected.afiliado_tipo === 'Corporativo' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                    selected.afiliado_tipo === 'Agente Corporativo' || selected.afiliado_tipo === 'Agente' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                    'bg-emerald-50 text-emerald-600 border border-emerald-100'
                  }`}>
                    {selected.afiliado_tipo === 'Corporativo' ? 'CORPORATIVO' :
                     selected.afiliado_tipo === 'Agente Corporativo' || selected.afiliado_tipo === 'Agente' ? 'AGENTE CORPORATIVO' :
                     'AGENTE INDEPENDIENTE'}
                  </span>
                ) : (
                  (selected.tipo_estudiante === 'Corporativo' || selected.estudiante_cedula?.startsWith('J')) && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                      JURÍDICO
                    </span>
                  )
                )}
              </div>
            </div>

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
                  case 'Preinscrito': return 1; // Expediente (document review phase)
                  case 'Entrevista': return 2; // Entrevista
                  case 'Inscrito': return 6; // Afiliado
                  default: return 0;
                }
              }
              const activeIndex = getActiveIndex(selected.estatus, selected.afiliado_estatus)
              const handleStepClick = async (idx: number) => {
                if (idx === activeIndex) return

                const stepsNames = [
                  'Preinscripción',
                  'Expediente',
                  'Entrevista',
                  'Verificación',
                  'CIBIR',
                  'Inscripción',
                  'Afiliación'
                ]
                
                const implications = [
                  'Revertirá al aspirante al estado de registro inicial de datos básicos.',
                  'Colocará al aspirante en la etapa de carga y revisión de documentos adjuntos.',
                  'Habilitará al aspirante para la etapa de entrevista con la junta directiva.',
                  'Colocará al aspirante en la etapa de evaluación de su perfil y validación de referencias de afiliados activos.',
                  'Habilitará al aspirante para la validación y acreditación del curso de formación CIBIR.',
                  'Colocará al aspirante en la etapa de pago del arancel de inscripción y aprobación administrativa final.',
                  'Convertirá de forma definitiva al aspirante en un miembro activo (Afiliado) con credenciales de acceso a la Cámara.'
                ]

                const displayName = selected.estudiante_nombre

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
                    <div class="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs text-left">
                      <p class="font-bold text-emerald-900 mb-1">ℹ️ NOTA: Estás retrocediendo en el proceso:</p>
                      <p class="leading-tight text-[10px] text-emerald-700">El proceso se devolverá a una etapa anterior. Se deberán procesar los requisitos de nuevo desde este punto.</p>
                    </div>
                  `
                }

                const result = await Swal.fire({
                  title: '¿Cambiar etapa del trámite?',
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
                  try {
                    const res = await fetch(`${API_URL}/api/academia/inscripciones/${selected.id_inscripcion}/cambiar-etapa`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json', ...authHeaders },
                      body: JSON.stringify({ etapa: idx })
                    })
                    const json = await res.json()
                    if (!res.ok || !json.success) throw new Error(json.message || 'No se pudo cambiar la etapa')
                    
                    Swal.fire({
                      title: '¡Actualizado!',
                      text: `El trámite ahora está en la etapa de "${stepsNames[idx]}".`,
                      icon: 'success',
                      timer: 2000,
                      showConfirmButton: false
                    })
                    await fetchData()
                  } catch (e: any) {
                    Swal.fire({
                      title: 'Error',
                      text: e.message || 'No se pudo cambiar la etapa',
                      icon: 'error',
                      confirmButtonColor: '#059669'
                    })
                  }
                }
              }
              return (
                <div className="bg-white rounded-2xl p-5 border border-gray-100 mb-3 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Progreso del Trámite</span>
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
                </div>
              )
            })()}

            {selected.programa_codigo === 'AFILIACION' && !!selected.apto_convalidacion && (() => {
              const currentYear = new Date().getFullYear();
              const anosServicio = selected.ano_inicio_servicio ? (currentYear - selected.ano_inicio_servicio) : 0;
              const has8Years = anosServicio > 8;
              const qualifyingDocs = documentos.filter(d => d.tipo_doc === 'diplomado' && d.nombre_archivo && ['FIPPI', 'FIPI', 'PREANI'].includes(d.nombre_archivo.toUpperCase().trim()));
              
              return (
                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 mb-3 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-5 h-5 text-emerald-600" />
                    <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Apto para Convalidación CIBIR</p>
                  </div>
                  <p className="text-xs text-emerald-700 font-medium leading-relaxed">
                    El aspirante cumple con los requisitos reglamentarios para la acreditación directa o nivelación especial del programa de formación:
                  </p>
                  <div className="flex flex-col gap-1.5 mt-1">
                    {has8Years && (
                      <div className="flex items-start gap-1.5 text-[11px] text-emerald-900 font-semibold">
                        <span className="text-emerald-500">✓</span>
                        <span>Tiene {anosServicio} años de servicio (inició en {selected.ano_inicio_servicio}), superando el mínimo requerido de 8 años.</span>
                      </div>
                    )}
                    {qualifyingDocs.length > 0 && (
                      <div className="flex items-start gap-1.5 text-[11px] text-emerald-900 font-semibold">
                        <span className="text-emerald-500">✓</span>
                        <span>
                          Adjuntó soporte de diplomado:{" "}
                          <span className="underline">{qualifyingDocs.map(d => d.nombre_archivo || d.tipo_doc).join(", ")}</span>.
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {selected.tipo_estudiante === 'Corporativo' || selected.estudiante_cedula?.startsWith('J') ? (
              <>
                {/* Sección Empresa */}
                <div className="bg-white rounded-2xl p-4 border border-gray-100 mb-3">
                  <div className="flex items-center gap-2 mb-3">
                    <svg viewBox="0 0 24 24" className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect>
                      <path d="M9 22v-4h6v4"></path>
                      <path d="M8 6h.01"></path>
                      <path d="M16 6h.01"></path>
                      <path d="M12 6h.01"></path>
                      <path d="M12 10h.01"></path>
                      <path d="M12 14h.01"></path>
                      <path d="M16 10h.01"></path>
                      <path d="M16 14h.01"></path>
                      <path d="M8 10h.01"></path>
                      <path d="M8 14h.01"></path>
                    </svg>
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
                    <svg viewBox="0 0 24 24" className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"></path>
                      <circle cx="12" cy="7" r="4"></circle>
                    </svg>
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
                {selected.ano_inicio_servicio !== undefined && selected.ano_inicio_servicio !== null && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Año Inicio de Servicio</span>
                    <span className="text-sm text-slate-700 font-medium break-all">{selected.ano_inicio_servicio}</span>
                  </div>
                )}
                <div className="sm:col-span-2 flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl mt-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-bold text-slate-800">¿Es Corredor Inmobiliario?</span>
                    <span className="text-[10px] text-slate-400">Confirmar si el aspirante ya cuenta con acreditación en el sector</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={!!selected.estudiante_es_corredor_inmobiliario} 
                      onChange={handleToggleCorredor}
                      disabled={toggleLoading}
                      className="sr-only peer" 
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>
              </div>
            )}

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
                    const isCorp = documentos.some(d => d.tipo_doc === 'registro_mercantil');
                    const labelMap: Record<string, string> = {
                      titulo: isCorp ? 'RIF de la Empresa' : 'Título Académico',
                      cv: 'Curriculum Vitae',
                      especializacion: 'Especialización',
                      curso_extra: 'Curso Extra',
                      comprobante: 'Comprobante',
                      titulo_representante: 'Título del Representante',
                      registro_mercantil: 'Acta Constitutiva',
                      referencia_afiliado_1: 'Referencia Afiliado 1',
                      referencia_afiliado_2: 'Referencia Afiliado 2',
                      diplomado: 'Diplomado',
                      otro_documento: 'Otro Documento',
                    }
                    const resolvedLabel = labelMap[doc.tipo_doc] || doc.tipo_doc.replace(/_/g, ' ')
                    return (
                      <div
                        key={doc.id_documento}
                        className="flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold bg-slate-50 text-slate-700 hover:bg-slate-100 transition-colors"
                      >
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 min-w-0 flex-grow hover:text-emerald-600"
                        >
                          <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M13.8 12H3" />
                          </svg>
                          <div className="flex flex-col min-w-0">
                            <span className="font-bold truncate">{doc.nombre_archivo || resolvedLabel}</span>
                            <span className="text-[9px] opacity-60 font-normal uppercase tracking-wider">{resolvedLabel}</span>
                          </div>
                        </a>

                        {['referencia_afiliado_1', 'referencia_afiliado_2'].includes(doc.tipo_doc) && doc.nombre_archivo && (
                          <button
                            type="button"
                            onClick={() => handleVerReferencia(doc.nombre_archivo!)}
                            className="ml-2 shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100 transition-colors text-[10px] font-bold uppercase tracking-wider"
                          >
                            <User size={12} />
                            Ver Afiliado
                          </button>
                        )}
                      </div>
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
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                    <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider mb-1">Cita Programada</p>
                    <p className="text-xs text-emerald-700">
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
                      className="px-4 py-2.5 rounded-xl border border-emerald-200 text-emerald-600 text-sm font-semibold hover:bg-emerald-100 transition-colors"
                    >
                      Reprogramar
                    </button>
                  </div>
                </div>
              )}
              </div>
            )}

            {/* Danger Zone: Eliminar Solicitud */}
            <div className="bg-red-50/50 rounded-2xl p-4 border border-red-100 flex flex-col gap-2.5 mt-3">
              <span className="text-[10px] font-black text-red-600 uppercase tracking-[0.2em] ml-1">Zona de Peligro</span>
              <p className="text-[10px] text-red-700/80 font-medium leading-relaxed -mt-1">
                Esta acción eliminará de forma irreversible la preinscripción, su expediente y todos los registros asociados en el sistema.
              </p>
              <button
                type="button"
                onClick={() => eliminarSolicitud(selected.id_inscripcion)}
                className="w-full py-2.5 rounded-xl bg-red-100 hover:bg-red-200 text-red-700 text-xs font-bold transition-colors uppercase tracking-wider"
              >
                Eliminar Solicitud por Completo
              </button>
            </div>
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
                <p className="text-slate-400 text-sm mt-1 font-medium">Aspirante: <span className="text-white font-bold">{selected.estudiante_nombre}</span></p>

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
