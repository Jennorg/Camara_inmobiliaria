import React, { useState, useEffect, useCallback } from 'react'
import { 
  ShieldAlert, 
  Search, 
  Filter, 
  RefreshCw, 
  Gavel, 
  Users, 
  Calendar, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  FileText, 
  ExternalLink, 
  ChevronRight, 
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  DollarSign,
  Plus,
  Send,
  Save,
  Check,
  Ban
} from 'lucide-react'
import { API_URL } from '@/config/env'
import { useAuth } from '@/context/AuthContext'
import { toast } from 'sonner'
import Swal from 'sweetalert2'
import ModalResolucionDenuncia from './ModalResolucionDenuncia'
import ModalConvocarMediacion from './ModalConvocarMediacion'
import type { 
  DenunciaDTO, 
  DenunciasKpisDTO, 
  EstatusDenuncia, 
  TipoFalta, 
  PrioridadDenuncia 
} from '@/types/denuncias'

const TIPOS_FALTA_LABELS: Record<string, string> = {
  incumplimiento_contrato: 'Incumplimiento de Contrato',
  comisiones_indebidas: 'Cobro Indebido / Retención de Honorarios',
  publicidad_enganosa: 'Publicidad Engañosa / Captación Irregular',
  falta_etica: 'Violación al Código de Ética CIV',
  retencion_documentos: 'Retención Indebida de Documentos/Llaves',
  fraude_estafa: 'Presunto Fraude o Mala Praxis',
  otro: 'Otro Conflicto'
}

const ESTADO_CONFIG: Record<EstatusDenuncia, { label: string; badge: string; dot: string }> = {
  recibida:     { label: 'Recibida',       badge: 'bg-slate-100 text-slate-700 border-slate-200',     dot: 'bg-slate-500' },
  en_revision:  { label: 'En Revisión',    badge: 'bg-blue-50 text-blue-700 border-blue-200',         dot: 'bg-blue-500' },
  en_descargos: { label: 'En Descargos',   badge: 'bg-amber-50 text-amber-700 border-amber-200',      dot: 'bg-amber-500' },
  en_mediacion: { label: 'En Mediación',   badge: 'bg-purple-50 text-purple-700 border-purple-200',   dot: 'bg-purple-500' },
  resuelta:     { label: 'Resuelta',       badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  desestimada:  { label: 'Desestimada',    badge: 'bg-rose-50 text-rose-700 border-rose-200',         dot: 'bg-rose-500' },
  archivada:    { label: 'Archivada',      badge: 'bg-gray-100 text-gray-500 border-gray-200',        dot: 'bg-gray-400' },
}

const PRIORIDAD_CONFIG: Record<PrioridadDenuncia, { label: string; badge: string }> = {
  baja:    { label: 'Baja',    badge: 'bg-slate-50 text-slate-600 border-slate-200' },
  media:   { label: 'Media',   badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  alta:    { label: 'Alta',    badge: 'bg-rose-50 text-rose-700 border-rose-200 font-bold' },
  urgente: { label: 'Urgente', badge: 'bg-red-100 text-red-800 border-red-300 font-black animate-pulse' },
}

const fmtDate = (s?: string | null) => {
  if (!s) return '-'
  return new Date(s).toLocaleDateString('es-VE', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function DenunciasPanel() {
  const { authHeaders } = useAuth()

  const [loading, setLoading] = useState(true)
  const [denuncias, setDenuncias] = useState<DenunciaDTO[]>([])
  const [kpis, setKpis] = useState<DenunciasKpisDTO>({
    total: 0,
    recibidas: 0,
    enRevision: 0,
    enMediacion: 0,
    resueltas: 0,
    desestimadas: 0
  })

  // Filtros
  const [search, setSearch] = useState('')
  const [filtroEstatus, setFiltroEstatus] = useState<string>('')
  const [filtroPrioridad, setFiltroPrioridad] = useState<string>('')

  // Detalle de caso seleccionado
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<DenunciaDTO | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [notaInterna, setNotaInterna] = useState('')

  // Modales
  const [modalResolucionOpen, setModalResolucionOpen] = useState(false)
  const [modalMediacionOpen, setModalMediacionOpen] = useState(false)

  // Cargar lista
  const fetchDenuncias = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filtroEstatus) params.append('estatus', filtroEstatus)
      if (filtroPrioridad) params.append('prioridad', filtroPrioridad)
      if (search.trim()) params.append('search', search.trim())

      const res = await fetch(`${API_URL}/api/denuncias/admin?${params.toString()}`, {
        headers: authHeaders
      })
      if (!res.ok) throw new Error('Error al cargar denuncias')
      const json = await res.json()
      setDenuncias(json.data.denuncias || [])
      setKpis(json.data.kpis)
    } catch (err: any) {
      console.error(err)
      toast.error('Error al cargar lista de denuncias')
    } finally {
      setLoading(false)
    }
  }, [filtroEstatus, filtroPrioridad, search, authHeaders])

  useEffect(() => {
    fetchDenuncias()
  }, [fetchDenuncias])

  // Cargar detalle
  const fetchDetalle = useCallback(async (id: number) => {
    try {
      setLoadingDetail(true)
      const res = await fetch(`${API_URL}/api/denuncias/admin/${id}`, {
        headers: authHeaders
      })
      if (!res.ok) throw new Error('Error al cargar detalle')
      const json = await res.json()
      setDetail(json.data)
      setNotaInterna(json.data.notas_internas || '')
    } catch (err: any) {
      toast.error('Error al abrir expediente')
    } finally {
      setLoadingDetail(false)
    }
  }, [authHeaders])

  const handleSelectDenuncia = (id: number) => {
    setSelectedId(id)
    fetchDetalle(id)
  }

  // Cambiar Estatus
  const handleCambiarEstatus = async (nuevoEstatus: EstatusDenuncia) => {
    if (!detail) return
    const { value: comentario } = await Swal.fire({
      title: `¿Cambiar estatus a "${ESTADO_CONFIG[nuevoEstatus].label}"?`,
      input: 'text',
      inputPlaceholder: 'Ingrese una nota u observación del cambio procesal...',
      showCancelButton: true,
      confirmButtonText: 'Actualizar Estatus',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#059669'
    })

    if (comentario !== undefined) {
      try {
        const res = await fetch(`${API_URL}/api/denuncias/admin/${detail.id_denuncia}/estatus`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({ estatus: nuevoEstatus, comentario: comentario || undefined })
        })
        if (!res.ok) throw new Error('Error al cambiar estatus')
        toast.success(`Estatus actualizado a ${ESTADO_CONFIG[nuevoEstatus].label}`)
        fetchDetalle(detail.id_denuncia)
        fetchDenuncias()
      } catch (err: any) {
        toast.error(err.message || 'Error al actualizar estatus')
      }
    }
  }

  // Guardar notas internas
  const handleGuardarNotas = async () => {
    if (!detail) return
    try {
      const res = await fetch(`${API_URL}/api/denuncias/admin/${detail.id_denuncia}/notas`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ notas: notaInterna })
      })
      if (!res.ok) throw new Error('Error al guardar notas')
      toast.success('Notas internas actualizadas')
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar notas')
    }
  }

  return (
    <div className="p-4 sm:p-6 w-full overflow-y-auto h-full space-y-6">
      {/* Header Superior */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800">
              Tribunal de Ética & Disciplina
            </span>
            <span className="text-xs text-slate-400">· Resolución de Conflictos Gremiales</span>
          </div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight mt-1">
            Gestión de Denuncias
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Expedientes de quejas, mediación, derecho a la defensa y resoluciones entre partes y afiliados.
          </p>
        </div>

        <button
          onClick={fetchDenuncias}
          className="p-2 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors inline-flex items-center gap-1.5 text-xs font-bold"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin text-emerald-600' : ''} />
          <span>Refrescar</span>
        </button>
      </div>

      {/* Tarjetas KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div 
          onClick={() => setFiltroEstatus('')} 
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            filtroEstatus === '' ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">Total</span>
          <p className="text-xl font-black mt-1 tabular-nums">{kpis.total}</p>
        </div>
        <div 
          onClick={() => setFiltroEstatus('recibida')} 
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            filtroEstatus === 'recibida' ? 'bg-slate-100 border-slate-400 text-slate-800' : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Recibidas</span>
          <p className="text-xl font-black text-slate-800 mt-1 tabular-nums">{kpis.recibidas}</p>
        </div>
        <div 
          onClick={() => setFiltroEstatus('en_revision')} 
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            filtroEstatus === 'en_revision' ? 'bg-blue-50 border-blue-400 text-blue-900' : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">En Revisión</span>
          <p className="text-xl font-black text-blue-800 mt-1 tabular-nums">{kpis.enRevision}</p>
        </div>
        <div 
          onClick={() => setFiltroEstatus('en_mediacion')} 
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            filtroEstatus === 'en_mediacion' ? 'bg-purple-50 border-purple-400 text-purple-900' : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600">En Mediación</span>
          <p className="text-xl font-black text-purple-800 mt-1 tabular-nums">{kpis.enMediacion}</p>
        </div>
        <div 
          onClick={() => setFiltroEstatus('resuelta')} 
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            filtroEstatus === 'resuelta' ? 'bg-emerald-50 border-emerald-400 text-emerald-900' : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Resueltas</span>
          <p className="text-xl font-black text-emerald-700 mt-1 tabular-nums">{kpis.resueltas}</p>
        </div>
        <div 
          onClick={() => setFiltroEstatus('desestimada')} 
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            filtroEstatus === 'desestimada' ? 'bg-rose-50 border-rose-400 text-rose-900' : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600">Desestimadas</span>
          <p className="text-xl font-black text-rose-700 mt-1 tabular-nums">{kpis.desestimadas}</p>
        </div>
      </div>

      {/* VISTA PRINCIPAL: SPLIT / DETALLE O LISTA */}
      {selectedId && detail ? (
        /* ── EXPEDIENTE DETALLADO ── */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
          {/* Header del Expediente */}
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4 bg-slate-50/70">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedId(null)}
                className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors shadow-xs"
                title="Volver a la lista"
              >
                <ArrowLeft size={16} />
              </button>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-black text-sm text-slate-800">{detail.codigo}</span>
                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${ESTADO_CONFIG[detail.estatus].badge}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${ESTADO_CONFIG[detail.estatus].dot}`} />
                    {ESTADO_CONFIG[detail.estatus].label}
                  </span>
                  <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${PRIORIDAD_CONFIG[detail.prioridad].badge}`}>
                    Prioridad {PRIORIDAD_CONFIG[detail.prioridad].label}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">{detail.titulo}</h3>
              </div>
            </div>

            {/* Acciones de Caso */}
            <div className="flex items-center gap-2 flex-wrap">
              {detail.estatus !== 'resuelta' && detail.estatus !== 'desestimada' && (
                <>
                  <button
                    onClick={() => setModalMediacionOpen(true)}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-all flex items-center gap-1.5 shadow-xs"
                  >
                    <Users size={14} />
                    Convocar Mediación
                  </button>
                  <button
                    onClick={() => setModalResolucionOpen(true)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-900 hover:bg-indigo-950 transition-all flex items-center gap-1.5 shadow-sm shadow-indigo-950/20"
                  >
                    <Gavel size={14} />
                    Emitir Resolución (Fin al Caso)
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Cuerpo del Expediente */}
          <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Columna Izquierda: Partes y Hechos (2 spans) */}
            <div className="lg:col-span-2 space-y-6">
              {/* Tarjeta de Partes Involucradas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Denunciante */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Denunciante ({detail.tipo_denunciante === 'afiliado' ? 'Afiliado' : 'Particular'})</span>
                    <span className="text-[10px] font-bold font-mono bg-white px-2 py-0.5 rounded-lg border border-slate-200">
                      PIN: {detail.pin_seguimiento}
                    </span>
                  </div>
                  <p className="font-bold text-slate-900 text-sm">{detail.nombre_denunciante}</p>
                  <p className="text-xs text-slate-500 font-mono">C.I. / RIF: {detail.cedula_rif_denunciante}</p>
                  <div className="pt-2 border-t border-slate-200 flex flex-col gap-1 text-xs text-slate-600">
                    <span className="flex items-center gap-1.5"><Mail size={12} className="text-slate-400" /> {detail.email_denunciante}</span>
                    <span className="flex items-center gap-1.5"><Phone size={12} className="text-slate-400" /> {detail.telefono_denunciante}</span>
                  </div>
                </div>

                {/* Afiliado Denunciado */}
                <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-200 space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-indigo-500">Afiliado Gremial Denunciado</span>
                  <p className="font-bold text-indigo-950 text-sm">{detail.nombre_denunciado}</p>
                  <p className="text-xs text-indigo-700 font-mono">Código: {detail.codigo_afiliado_denunciado || 'No asignado'}</p>
                  <div className="pt-2 border-t border-indigo-200/80 flex flex-col gap-1 text-xs text-indigo-900">
                    <span className="flex items-center gap-1.5">
                      <Building2 size={12} className="text-indigo-400" />
                      Tipo: {detail.denunciado_tipo_persona || 'Afiliado'} ({detail.denunciado_estatus_afiliado || 'Activo'})
                    </span>
                    {detail.denunciado_email_persona && (
                      <span className="flex items-center gap-1.5"><Mail size={12} className="text-indigo-400" /> {detail.denunciado_email_persona}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Hechos y Conflicto */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Motivo: <strong className="text-slate-700">{TIPOS_FALTA_LABELS[detail.tipo_falta] || detail.tipo_falta}</strong>
                  </span>
                  {detail.monto_involucrado > 0 && (
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
                      Monto en disputa: ${detail.monto_involucrado.toFixed(2)} USD
                    </span>
                  )}
                </div>

                <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {detail.descripcion_hechos}
                </div>

                {detail.inmueble_referencia && (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
                    <strong>Inmueble / Ubicación referida:</strong> {detail.inmueble_referencia}
                  </div>
                )}
              </div>

              {/* Dictamen y Resolución Final (Si ya está resuelta) */}
              {detail.dictamen_resolucion && (
                <div className="p-5 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
                      <Gavel size={18} className="text-emerald-600" />
                      Dictamen Oficial y Resolución del Caso
                    </div>
                    <span className="text-xs text-emerald-700 font-medium">
                      Emitido el {fmtDate(detail.fecha_resolucion)}
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap bg-white p-3.5 rounded-xl border border-emerald-200">
                    {detail.dictamen_resolucion}
                  </p>

                  {detail.acta_resolucion_url && (
                    <div className="flex items-center justify-end">
                      <a
                        href={detail.acta_resolucion_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 transition-colors shadow-xs"
                      >
                        <FileText size={14} />
                        Descargar Acta de Resolución Firmada (PDF)
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* Documentos y Evidencias */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-3">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Documentos y Evidencias Probatorias ({detail.documentos?.length || 0})
                </span>

                {detail.documentos && detail.documentos.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {detail.documentos.map(doc => (
                      <a
                        key={doc.id_documento_denuncia}
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-3 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 hover:border-slate-300 transition-colors flex items-center justify-between gap-3 group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FileText size={16} className="text-indigo-600 shrink-0" />
                          <span className="text-xs font-bold text-slate-700 truncate group-hover:text-indigo-900">
                            {doc.nombre_archivo}
                          </span>
                        </div>
                        <ExternalLink size={14} className="text-slate-400 group-hover:text-indigo-600 shrink-0" />
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No se adjuntaron documentos adicionales.</p>
                )}
              </div>
            </div>

            {/* Columna Derecha: Bitácora Procesal y Notas Internas */}
            <div className="space-y-6">
              {/* Cambiar Estado Rápido */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Cambiar Estado</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {(['en_revision', 'en_descargos', 'en_mediacion', 'archivada'] as EstatusDenuncia[]).map(st => (
                    <button
                      key={st}
                      onClick={() => handleCambiarEstatus(st)}
                      disabled={detail.estatus === st}
                      className={`py-1.5 px-2.5 rounded-lg text-[11px] font-bold transition-colors text-left border ${
                        detail.estatus === st
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {ESTADO_CONFIG[st].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notas Internas Confidenciales */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Notas Internas</span>
                  <button
                    onClick={handleGuardarNotas}
                    className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
                  >
                    <Save size={12} /> Guardar
                  </button>
                </div>
                <textarea
                  rows={3}
                  value={notaInterna}
                  onChange={e => setNotaInterna(e.target.value)}
                  placeholder="Anotaciones confidenciales para el Tribunal de Ética..."
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 resize-none bg-slate-50/50"
                />
              </div>

              {/* Línea de Tiempo del Expediente */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Historial Procesal</span>
                <div className="space-y-3 relative pl-4 border-l-2 border-slate-100 max-h-72 overflow-y-auto">
                  {detail.historial && detail.historial.length > 0 ? (
                    detail.historial.map(h => (
                      <div key={h.id_historial} className="relative text-xs space-y-0.5">
                        <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-white" />
                        <p className="font-bold text-slate-800">{h.accion}</p>
                        {h.comentario && <p className="text-slate-500 text-[11px]">{h.comentario}</p>}
                        <span className="text-[10px] text-slate-400 font-mono">{fmtDate(h.fecha)}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400">Sin historial registrado.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ── TABLA DE LISTADO DE DENUNCIAS ── */
        <div className="space-y-4">
          {/* Barra de Filtros */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por código, denunciante, afiliado o cédula..."
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-xs outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={filtroPrioridad}
                onChange={e => setFiltroPrioridad(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-slate-50 outline-none"
              >
                <option value="">Todas las Prioridades</option>
                <option value="urgente">Urgente</option>
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
              </select>
            </div>
          </div>

          {/* Tabla */}
          <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Código</th>
                    <th className="py-3 px-4">Fecha</th>
                    <th className="py-3 px-4">Denunciante</th>
                    <th className="py-3 px-4">Afiliado Denunciado</th>
                    <th className="py-3 px-4">Motivo / Título</th>
                    <th className="py-3 px-4">Prioridad</th>
                    <th className="py-3 px-4">Estatus</th>
                    <th className="py-3 px-4 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {denuncias.length > 0 ? (
                    denuncias.map(d => (
                      <tr
                        key={d.id_denuncia}
                        onClick={() => handleSelectDenuncia(d.id_denuncia)}
                        className="hover:bg-slate-50/70 transition-colors cursor-pointer group"
                      >
                        <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                          {d.codigo}
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                          {fmtDate(d.fecha_presentacion)}
                        </td>
                        <td className="py-3 px-4 max-w-[160px] truncate">
                          <p className="font-bold text-slate-800 truncate">{d.nombre_denunciante}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{d.cedula_rif_denunciante}</p>
                        </td>
                        <td className="py-3 px-4 max-w-[180px] truncate">
                          <p className="font-bold text-indigo-950 truncate">{d.nombre_denunciado}</p>
                          <p className="text-[10px] text-indigo-600 font-mono">{d.codigo_afiliado_denunciado || '-'}</p>
                        </td>
                        <td className="py-3 px-4 max-w-[220px]">
                          <p className="font-semibold text-slate-800 truncate">{d.titulo}</p>
                          <p className="text-[10px] text-slate-400 truncate">{TIPOS_FALTA_LABELS[d.tipo_falta] || d.tipo_falta}</p>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${PRIORIDAD_CONFIG[d.prioridad].badge}`}>
                            {PRIORIDAD_CONFIG[d.prioridad].label}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${ESTADO_CONFIG[d.estatus].badge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${ESTADO_CONFIG[d.estatus].dot}`} />
                            {ESTADO_CONFIG[d.estatus].label}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              handleSelectDenuncia(d.id_denuncia)
                            }}
                            className="p-1.5 rounded-lg bg-slate-100 group-hover:bg-indigo-900 group-hover:text-white transition-colors text-slate-600"
                            title="Ver expediente"
                          >
                            <ChevronRight size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-slate-400">
                        {loading ? 'Cargando expedientes...' : 'No se encontraron denuncias registradas.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── MODALES DE ACCIÓN ── */}
      <ModalResolucionDenuncia
        isOpen={modalResolucionOpen}
        onClose={() => setModalResolucionOpen(false)}
        onSuccess={() => {
          if (detail) fetchDetalle(detail.id_denuncia)
          fetchDenuncias()
        }}
        denuncia={detail}
      />

      <ModalConvocarMediacion
        isOpen={modalMediacionOpen}
        onClose={() => setModalMediacionOpen(false)}
        onSuccess={() => {
          if (detail) fetchDetalle(detail.id_denuncia)
          fetchDenuncias()
        }}
        denuncia={detail}
      />
    </div>
  )
}
