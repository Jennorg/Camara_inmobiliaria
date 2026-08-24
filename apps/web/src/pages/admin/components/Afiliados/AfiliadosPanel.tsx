import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { API_URL } from '@/config/env'
import { useAuth } from '@/context/AuthContext'
import { formatNombreCard, formatRif } from '@/utils/formatters'
import { EstatusAfiliado, AfiliadoDTO } from '@/types/afiliados'
import { FileText, ExternalLink, Download, Award, GraduationCap, FileDown, ClipboardList, Calendar, ShieldCheck, CreditCard, Check, CheckCircle, ChevronDown, ShieldAlert, BadgeCheck, Search, X, Building2 } from 'lucide-react'
import ExportAfiliadosModal from '@/pages/admin/components/Afiliados/export/ExportAfiliadosModal'
import EstablecerAccesoAfiliado from '@/pages/admin/components/Users/EstablecerAccesoAfiliado'
import type { ExportTipoFilter } from '@/pages/admin/components/Afiliados/export/filterAfiliadosForExport'
import Swal from 'sweetalert2'
import FileUpload from '@/components/common/FileUpload'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/apiClient'

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
      className={`flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50 hover:bg-white hover:border-emerald-200 hover:shadow-sm transition-colors group ${compact ? 'py-2' : ''}`}
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

interface AfiliadosPanelProps {
  defaultViewMode?: 'list' | 'solicitudes'
  hideViewModeTabs?: boolean
}

export default function AfiliadosPanel({ defaultViewMode = 'list', hideViewModeTabs = false }: AfiliadosPanelProps) {
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

  // Cambio de Estado solicitudes
  const [viewMode, setViewMode] = useState<'list' | 'solicitudes'>(defaultViewMode)
  const [solicitudes, setSolicitudes] = useState<any[]>([])
  const [selectedSolicitud, setSelectedSolicitud] = useState<any | null>(null)
  const [adminObservaciones, setAdminObservaciones] = useState('')

  // Cambio directo por administrador
  const [showChangeTypeModal, setShowChangeTypeModal] = useState(false)
  const [showChangeTypeMenu, setShowChangeTypeMenu] = useState(false)
  const [pendingNewType, setPendingNewType] = useState<'Natural' | 'Corporativo' | 'Agente Corporativo' | ''>('')
  const [naturalTransitionTarget, setNaturalTransitionTarget] = useState<any | null>(null)
  const [empresas, setEmpresas] = useState<any[]>([])
  const [selectedEmpresaId, setSelectedEmpresaId] = useState('')
  const [razonSocial, setRazonSocial] = useState('')
  const [rifTipo, setRifTipo] = useState('J')
  const [rifNumero, setRifNumero] = useState('')
  const [emailEmpresa, setEmailEmpresa] = useState('')
  const [telefonoEmpresa, setTelefonoEmpresa] = useState('')
  const [direccionEmpresa, setDireccionEmpresa] = useState('')
  const [websiteEmpresa, setWebsiteEmpresa] = useState('')
  const [urlRegistro, setUrlRegistro] = useState('')
  const [urlRif, setUrlRif] = useState('')
  const [nombreRegistro, setNombreRegistro] = useState('')
  const [nombreRif, setNombreRif] = useState('')
  const [submittingChangeType, setSubmittingChangeType] = useState(false)

  const fetchEmpresas = async () => {
    try {
      const res = await fetch(`${API_URL}/api/public/empresas`)
      if (!res.ok) return
      const json = await res.json()
      if (json.success) setEmpresas(json.data)
    } catch (err) { console.error(err) }
  }

  const handleDropdownTypeChange = (newType: string) => {
    if (!selected) return
    if (newType === selected.tipo_afiliado) return

    setPendingNewType(newType as any)
    if (newType === 'Natural') {
      confirmNaturalTransition()
    } else {
      fetchEmpresas()
      setShowChangeTypeModal(true)
    }
  }

  const confirmNaturalTransition = async () => {
    if (!selected) return
    setNaturalTransitionTarget(selected)
  }

  const executeDirectTypeChange = async (type: string, additionalData: any = {}) => {
    if (!selected) return
    setSubmittingChangeType(true)
    try {
      const res = await fetch(`${API_URL}/api/afiliados/admin/${selected.id_afiliado}/cambiar-membresia`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo_destino: type,
          ...additionalData
        })
      })
      const json = await res.json()
      if (res.ok && json.success) {
        toast.success(json.message || 'Membresía actualizada con éxito.')
        setShowChangeTypeModal(false)
        // Reset states
        setSelectedEmpresaId('')
        setRazonSocial('')
        setRifNumero('')
        setEmailEmpresa('')
        setTelefonoEmpresa('')
        setDireccionEmpresa('')
        setWebsiteEmpresa('')
        setUrlRegistro('')
        setUrlRif('')
        setNombreRegistro('')
        setNombreRif('')
        // Reload details and list
        await loadDetail(selected.id_afiliado)
        await load()
      } else {
        toast.error(json.message || 'No se pudo realizar el cambio.')
      }
    } catch (err) {
      toast.error('Error de conexión: No se pudo establecer comunicación con el servidor.')
    } finally {
      setSubmittingChangeType(false)
    }
  }

  const busyTransitionRef = useRef(false)
  const handleConfirmNaturalTransition = async () => {
    if (busyTransitionRef.current) return
    busyTransitionRef.current = true
    try {
      setNaturalTransitionTarget(null)
      await executeDirectTypeChange('Natural')
    } finally {
      busyTransitionRef.current = false
    }
  }

  const [prevDefaultViewMode, setPrevDefaultViewMode] = useState(defaultViewMode)
  if (prevDefaultViewMode !== defaultViewMode) {
    setPrevDefaultViewMode(defaultViewMode)
    setViewMode(defaultViewMode)
    setSelected(null)
    setSelectedSolicitud(null)
  }

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

  const loadSolicitudes = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_URL}/api/afiliados/admin/solicitudes-cambio`, { headers: authHeaders })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'Error cargando solicitudes de cambio')
      setSolicitudes(json.data)
    } catch (e: any) {
      setError(e.message || 'Error inesperado')
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

  const resolverSolicitud = async (id: number, aprobado: boolean) => {
    setError('')
    try {
      const res = await fetch(`${API_URL}/api/afiliados/admin/solicitudes-cambio/${id}/resolver`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ aprobado, observaciones: adminObservaciones })
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'Error al resolver la solicitud')

      toast.success(aprobado ? 'La solicitud ha sido aprobada y los cambios se aplicaron exitosamente.' : 'La solicitud ha sido rechazada.')

      setAdminObservaciones('')
      setSelectedSolicitud(null)
      await loadSolicitudes()
      await load()
    } catch (e: any) {
      setError(e.message || 'Error al resolver la solicitud')
      toast.error(e.message || 'Error al resolver la solicitud')
    }
  }

  useEffect(() => {
    let active = true
    const fetchData = async () => {
      setLoading(true)
      setError('')
      try {
        if (viewMode === 'list') {
          const qs = new URLSearchParams()
          if (estatus !== 'Todos') qs.set('estatus', estatus)
          if (filterTipo !== 'Todos') qs.set('tipo_afiliado', filterTipo)

          const json = await apiFetch(`${API_URL}/api/afiliados?${qs.toString()}`, { headers: authHeaders })
          if (!active) return
          if (!json.success) throw new Error(json.message || 'Error cargando afiliados')
          setItems(json.data as AfiliadoDTO[])
        } else {
          const json = await apiFetch(`${API_URL}/api/afiliados/admin/solicitudes-cambio`, { headers: authHeaders })
          if (!active) return
          if (!json.success) throw new Error(json.message || 'Error cargando solicitudes de cambio')
          setSolicitudes(json.data)
        }
      } catch (e: any) {
        if (!active) return
        setError(e.message || 'Error inesperado')
      } finally {
        if (active) setLoading(false)
      }
    }
    fetchData()
    return () => { active = false }
  }, [viewMode, estatus, filterTipo, authHeaders])

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
          {/* viewMode Tabs */}
          {!hideViewModeTabs && (
            <div className="flex gap-1 p-1 bg-slate-100/70 rounded-xl">
              <button
                type="button"
                onClick={() => { setViewMode('list'); setSelected(null); setSelectedSolicitud(null); }}
                className={`flex-1 text-center py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors ${viewMode === 'list' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-400 hover:text-slate-600'
                  }`}
              >
                Afiliados CIBIR
              </button>
              <button
                type="button"
                onClick={() => { setViewMode('solicitudes'); setSelected(null); setSelectedSolicitud(null); }}
                className={`flex-1 text-center py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors relative ${viewMode === 'solicitudes' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-400 hover:text-slate-600'
                  }`}
              >
                Solicitudes Cambio
                {solicitudes.length > 0 && (
                  <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-emerald-500 text-white text-[8px] font-black scale-90">
                    {solicitudes.length}
                  </span>
                )}
              </button>
            </div>
          )}

          {viewMode === 'list' ? (
            <>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">Listado General</h3>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">Manejo de candidatos, aprobaciones y estatus.</p>
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
                    <option value="Afiliado">Afiliado</option>
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
                    <option value="Natural">Agente Independiente</option>
                    <option value="Agente Corporativo">Agente Corporativo</option>
                    <option value="Corporativo">Corporativo</option>
                  </select>
                  <button
                    onClick={load}
                    className="px-3 py-2 rounded-xl bg-slate-100 text-slate-600 text-[11px] font-bold hover:bg-slate-200 transition-colors"
                  >
                    Refrescar
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">Solicitudes pendientes</h3>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5">Cambios de membresía que requieren aprobación.</p>
              </div>
              <button
                onClick={loadSolicitudes}
                className="px-2.5 py-1.5 rounded-xl bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-colors"
              >
                Refrescar
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {loading ? (
            <div className="p-4 text-center text-xs text-slate-400 font-semibold uppercase tracking-widest mt-10">Cargando...</div>
          ) : error ? (
            <div className="p-4 text-center text-xs text-red-500 mt-10">{error}</div>
          ) : viewMode === 'list' ? (
            items.length === 0 ? (
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

                      <span className={`text-[9px] font-black uppercase tracking-widest ${a.tipo_afiliado === 'Corporativo' ? 'text-emerald-600' :
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
            )
          ) : (
            solicitudes.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400 mt-10">No hay solicitudes pendientes.</div>
            ) : (
              solicitudes.map(s => (
                <button
                  key={s.id_solicitud}
                  onClick={() => setSelectedSolicitud(s)}
                  className={['w-full text-left px-4 py-3.5 transition-colors flex flex-col gap-1',
                    selectedSolicitud?.id_solicitud === s.id_solicitud ? 'bg-[#E9FAF4]' : 'hover:bg-slate-50',
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-semibold text-slate-800">{s.afiliado_nombre}</span>
                      <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600">
                        {s.tipo_actual} ➔ {s.tipo_solicitado}
                      </span>
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-100 whitespace-nowrap">
                      Por Cámara
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 truncate">{s.afiliado_email}</span>
                  <span className="text-[10px] text-slate-300">
                    Solicitud #{s.id_solicitud} · {new Date(s.creado_en).toLocaleDateString('es-ES')}
                  </span>
                </button>
              ))
            )
          )}
        </div>
      </div>

      {/* Detail */}
      <div className="bg-gray-50 overflow-hidden relative min-h-0 hidden sm:block">
        {viewMode === 'solicitudes' ? (
          !selectedSolicitud ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-300">
              <p className="text-sm font-medium">Selecciona una solicitud</p>
            </div>
          ) : detailLoading ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-300">
              <p className="text-sm font-medium">Cargando detalle...</p>
            </div>
          ) : (
            <div className="absolute inset-0 overflow-y-auto p-4 sm:p-6 space-y-6">
              {/* Header */}
              <div className="bg-white rounded-2xl p-5 border border-gray-100 flex flex-col gap-1.5 shadow-sm">
                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 w-fit">
                  {selectedSolicitud.tipo_actual} ➔ {selectedSolicitud.tipo_solicitado}
                </span>
                <h3 className="text-sm font-bold text-slate-900 leading-tight">
                  Solicitud de: {selectedSolicitud.afiliado_nombre}
                </h3>
                <p className="text-xs text-slate-400">{selectedSolicitud.afiliado_email} • {selectedSolicitud.afiliado_telefono || 'sin teléfono'}</p>
                <p className="text-[10px] text-slate-400 font-bold mt-1">
                  Enviada el: {new Date(selectedSolicitud.creado_en).toLocaleString('es-ES')}
                </p>
              </div>

              {/* Conditional Info based on requested type */}
              {selectedSolicitud.tipo_solicitado === 'Corporativo' && (
                <>
                  {/* Company Info */}
                  <div className="bg-white rounded-2xl p-5 border border-gray-100 space-y-4 shadow-sm">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Datos de la Empresa</h4>
                    {(() => {
                      try {
                        const datos = JSON.parse(selectedSolicitud.datos_empresa || '{}');
                        return (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold text-slate-600">
                            <div>
                              <span className="text-[10px] text-slate-400 uppercase block mb-0.5">Razón Social</span>
                              <span className="text-slate-800 font-bold">{datos.razon_social || '—'}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 uppercase block mb-0.5">RIF</span>
                              <span className="text-slate-800 font-bold">{datos.rif_tipo}-{datos.rif_numero || '—'}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 uppercase block mb-0.5">Email</span>
                              <span className="text-slate-800 font-bold">{datos.email || '—'}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 uppercase block mb-0.5">Teléfono</span>
                              <span className="text-slate-800 font-bold">{datos.telefono || '—'}</span>
                            </div>
                            <div className="col-span-full">
                              <span className="text-[10px] text-slate-400 uppercase block mb-0.5">Dirección</span>
                              <span className="text-slate-800 font-bold leading-normal">{datos.direccion || '—'}</span>
                            </div>
                            {datos.website && (
                              <div className="col-span-full">
                                <span className="text-[10px] text-slate-400 uppercase block mb-0.5">Sitio Web</span>
                                <a href={datos.website.startsWith('http') ? datos.website : `https://${datos.website}`} target="_blank" rel="noopener noreferrer" className="text-emerald-600 underline font-bold">
                                  {datos.website}
                                </a>
                              </div>
                            )}
                          </div>
                        );
                      } catch {
                        return <p className="text-xs text-red-500 font-bold">Error al parsear datos de empresa</p>;
                      }
                    })()}
                  </div>

                  {/* Company Documents */}
                  <div className="bg-white rounded-2xl p-5 border border-gray-100 space-y-4 shadow-sm">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Documentos de la Empresa</h4>
                    {(() => {
                      try {
                        const docs = JSON.parse(selectedSolicitud.documentos_empresa || '[]');
                        return (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {docs.map((doc: any) => (
                              <DocLink
                                key={doc.url || doc.tipo_doc}
                                label={doc.tipo_doc.replace(/_/g, ' ')}
                                url={doc.url}
                                detail={doc.nombre_archivo}
                                compact
                              />
                            ))}
                          </div>
                        );
                      } catch {
                        return <p className="text-xs text-red-500 font-bold">Error al parsear documentos</p>;
                      }
                    })()}
                  </div>
                </>
              )}

              {selectedSolicitud.tipo_solicitado === 'Agente Corporativo' && (
                <div className="bg-white rounded-2xl p-5 border border-gray-100 space-y-2 shadow-sm">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Empresa Solicitada</h4>
                  <p className="text-xs font-semibold text-slate-800">
                    El afiliado solicita afiliarse como Agente Corporativo a la empresa:
                  </p>
                  <p className="text-sm font-bold text-emerald-600">
                    {selectedSolicitud.empresa_solicitada_nombre || '—'}
                  </p>
                  <p className="text-[10px] text-slate-400 font-bold bg-slate-50 border border-slate-100 rounded-lg p-2.5 mt-2 flex items-center gap-1.5">
                    <CheckCircle size={12} className="text-emerald-500 shrink-0" />
                    Aprobado previamente por el representante legal de la empresa.
                  </p>
                </div>
              )}

              {selectedSolicitud.tipo_solicitado === 'Natural' && (
                <div className="bg-white rounded-2xl p-5 border border-gray-100 space-y-2 shadow-sm">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Detalles de Solicitud</h4>
                  <p className="text-xs font-semibold text-slate-800">
                    El afiliado solicita pasar a ser Agente Independiente (Natural).
                  </p>
                  <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
                    Al aprobarse, se romperá su vínculo actual con cualquier empresa registrada y se actualizará su tipo de afiliación.
                  </p>
                </div>
              )}

              {/* Resolver Action */}
              <div className="bg-white rounded-2xl p-5 border border-gray-100 space-y-4 shadow-sm">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Resolver Solicitud (Administración)</h4>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Observaciones / Comentarios</label>
                  <textarea
                    value={adminObservaciones}
                    onChange={(e) => setAdminObservaciones(e.target.value)}
                    placeholder="Escribe comentarios, justificaciones de aprobación o motivos del rechazo..."
                    rows={3}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 focus:bg-white resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-2 border-t border-slate-50">
                  <button
                    onClick={() => resolverSolicitud(selectedSolicitud.id_solicitud, true)}
                    className="flex-1 py-2.5 rounded-xl bg-[#00D084] text-white text-xs font-black uppercase tracking-wider hover:bg-[#00B870] shadow-sm shadow-emerald-200 transition-colors transition-transform hover:-translate-y-0.5"
                  >
                    Aprobar Cambio
                  </button>
                  <button
                    onClick={() => resolverSolicitud(selectedSolicitud.id_solicitud, false)}
                    className="flex-1 py-2.5 rounded-xl bg-rose-50 text-rose-500 text-xs font-black uppercase tracking-wider hover:bg-rose-100 transition-colors"
                  >
                    Rechazar
                  </button>
                </div>
              </div>
            </div>
          )
        ) : !selected ? (
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
                  <div className="flex items-center gap-2 mb-1 relative max-w-[200px]">
                    <select
                      value={selected.tipo_afiliado}
                      onChange={(e) => handleDropdownTypeChange(e.target.value)}
                      className="w-full bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl hover:bg-emerald-100 hover:border-emerald-300 transition-colors cursor-pointer text-[10px] font-black uppercase tracking-widest px-3 py-2 pr-8 appearance-none outline-none focus:ring-2 focus:ring-emerald-500/20 shadow-xs"
                    >
                      <option value="Natural">Agente Independiente</option>
                      <option value="Agente Corporativo">Agente Corporativo</option>
                      <option value="Corporativo">Corporativo</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600 pointer-events-none" />
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
                      className="absolute left-6 top-[24px] md:top-[28px] h-0.5 bg-emerald-500 -z-0 transition-colors duration-500"
                      style={{ width: `calc(${(activeIndex / 6) * 100}% - ${activeIndex === 6 ? '12px' : '0px'})` }}
                    />

                    {AFILIACION_STEPS_FLOW.map((step, idx) => {
                      const isCompleted = idx < activeIndex;
                      const isCurrent = idx === activeIndex;
                      const StepIcon = step.icon;
                      return (
                        <button
                          key={step.label}
                          type="button"
                          onClick={() => handleStepClick(idx)}
                          className="flex flex-col items-center relative z-10 group cursor-pointer gap-2 focus:outline-none"
                        >
                          <div
                            className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-colors duration-300 ${isCompleted ? 'bg-emerald-500 text-white shadow-md shadow-emerald-100' :
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

                          <span className={`text-[8px] md:text-[10px] font-black tracking-tighter uppercase ${isCurrent ? 'text-emerald-600 font-extrabold' : isCompleted ? 'text-slate-500' : 'text-slate-300'
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
            {/* Certificados Entregados */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100 flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-gray-50 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
                    <Award size={15} />
                  </div>
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-800">Certificados Entregados</h4>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">Títulos y comprobantes emitidos</p>
                  </div>
                </div>
                {(selected as any).certificados && (selected as any).certificados.length > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
                    {(selected as any).certificados.length} {(selected as any).certificados.length === 1 ? 'Certificado' : 'Certificados'}
                  </span>
                )}
              </div>

              <div className="space-y-2">
                {(selected as any).certificados && (selected as any).certificados.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(selected as any).certificados.map((cert: any) => {
                      const certTitle = cert.curso_nombre || (cert.programa_codigo ? `Programa ${cert.programa_codigo}` : 'Certificado de Aprobación');
                      const validationCode = cert.codigo_validacion;
                      const fechaStr = cert.fecha_emision ? new Date(cert.fecha_emision).toLocaleDateString() : '';

                      return (
                        <div
                          key={cert.id_certificado || validationCode}
                          className="p-3 bg-slate-50/80 border border-slate-100 rounded-xl hover:border-amber-200 hover:bg-amber-50/30 transition-colors flex items-center justify-between gap-3 group"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-amber-100/80 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200/50">
                              <Award size={16} />
                            </div>
                            <div className="min-w-0">
                              <h6 className="text-[11px] font-black text-slate-800 truncate group-hover:text-amber-950 uppercase tracking-tight">
                                {certTitle}
                              </h6>
                              <p className="text-[9px] font-bold text-slate-400 truncate mt-0.5">
                                Cód: <span className="text-amber-700 font-black">{validationCode}</span> {fechaStr ? `· ${fechaStr}` : ''}
                              </p>
                            </div>
                          </div>
                          <a
                            href={`/comprobante/${encodeURIComponent(validationCode)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-white text-slate-600 hover:text-amber-700 hover:bg-amber-100/80 border border-slate-200 transition-colors shrink-0 shadow-2xs"
                            title="Ver Certificado Digital"
                          >
                            <ExternalLink size={13} />
                          </a>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-5 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                    <Award size={20} className="mx-auto text-slate-300 mb-1" />
                    <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Sin certificados emitidos</p>
                  </div>
                )}
              </div>
            </div>

            {/* Documentation Section */}
            {((selected.documentos && selected.documentos.length > 0) || selected.tipo_afiliado === 'Corporativo') && (
              <div className="bg-white rounded-2xl p-5 border border-gray-100 flex flex-col gap-5">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Documentación Adjunta</h4>
                  {selected.documentos && selected.documentos.length > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                      {selected.documentos.length} archivos
                    </span>
                  )}
                </div>

                {selected.documentos && selected.documentos.length > 0 && (
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
                )}

                {selected.tipo_afiliado === 'Corporativo' && (
                  <div className="border-t border-slate-100 pt-4 space-y-4">
                    <h5 className="text-[10px] font-black uppercase tracking-wider text-slate-500 font-bold">
                      Cargar/Actualizar Soportes de la Empresa
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FileUpload
                        label="Registro Mercantil"
                        accept=".pdf,image/*"
                        folder="documentos_empresa"
                        initialUrl={selected.documentos?.find((d: any) => d.tipo_doc === 'registro_mercantil')?.url}
                        initialFileName={selected.documentos?.find((d: any) => d.tipo_doc === 'registro_mercantil')?.nombre_archivo}
                        onUploadSuccess={(url, name) => {
                          updateField('documentos' as any, [
                            { tipo_doc: 'registro_mercantil', url, nombre_archivo: name || 'Registro_Mercantil.pdf' }
                          ])
                        }}
                        onClear={() => {
                          updateField('documentos' as any, [
                            { tipo_doc: 'registro_mercantil', url: '', nombre_archivo: '' }
                          ])
                        }}
                      />
                      <FileUpload
                        label="RIF de la Empresa"
                        accept=".pdf,image/*"
                        folder="documentos_empresa"
                        initialUrl={selected.documentos?.find((d: any) => d.tipo_doc === 'rif_empresa')?.url}
                        initialFileName={selected.documentos?.find((d: any) => d.tipo_doc === 'rif_empresa')?.nombre_archivo}
                        onUploadSuccess={(url, name) => {
                          updateField('documentos' as any, [
                            { tipo_doc: 'rif_empresa', url, nombre_archivo: name || 'RIF_Empresa.pdf' }
                          ])
                        }}
                        onClear={() => {
                          updateField('documentos' as any, [
                            { tipo_doc: 'rif_empresa', url: '', nombre_archivo: '' }
                          ])
                        }}
                      />
                    </div>
                  </div>
                )}
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

              <div className="bg-emerald-50/70 border border-emerald-200/60 p-4 rounded-2xl flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <GraduationCap size={16} className="text-emerald-600" />
                    <span className="text-xs font-black text-emerald-950 uppercase tracking-wider">Aprobar CIBIR</span>
                  </div>
                  <p className="text-[11px] font-medium text-emerald-800/80 leading-snug">
                    {!Boolean(selected.cibir_acreditado ?? selected.cibir_convalidado)
                      ? '✓ Aprobado en CIBIR (Genera certificado CIBIR de aprobación)'
                      : '✗ Acreditado por convalidación (Exonerado / Sin certificado CIBIR)'}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={!Boolean(selected.cibir_acreditado ?? selected.cibir_convalidado)}
                    onChange={(e) => updateField('cibir_acreditado', e.target.checked ? 0 : 1)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-colors peer-checked:bg-emerald-600" />
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
                    className="flex-1 py-2.5 rounded-xl bg-[#00D084] text-white text-sm font-bold hover:bg-[#00B870] shadow-sm shadow-emerald-200 transition-colors transition-transform hover:-translate-y-0.5"
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

      {showChangeTypeModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-[#022c22]/60 backdrop-blur-sm" aria-hidden="true" onClick={() => setShowChangeTypeModal(false)} />
          <div className="relative bg-white w-[calc(100vw-2rem)] sm:w-full max-w-xl mx-auto rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col h-fit max-h-[90vh] transition-colors duration-500 ease-in-out">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-base font-black text-gray-900 uppercase tracking-tight">
                  Cambiar Tipo de Membresía
                </h3>
                <p className="text-[10px] font-bold text-gray-400 mt-1">
                  Mover a {selected ? formatNombreCard(selected.nombre_completo) : ''} a la membresía: {pendingNewType}
                </p>
              </div>
              <button
                onClick={() => setShowChangeTypeModal(false)}
                className="w-8 h-8 rounded-lg bg-white border border-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-900"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto p-5 space-y-3 max-h-[calc(90vh-140px)]">
              {pendingNewType === 'Agente Corporativo' && (
                <div className="space-y-3">
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Seleccionar Empresa Destino
                    </label>
                    <CompanySearchField
                      companies={empresas.map(emp => ({
                        ...emp,
                        empresa_razon_social: emp.razon_social,
                        empresa_rif_numero: `${emp.rif_tipo}-${emp.rif_numero}`
                      }))}
                      selectedIdEmpresa={Number(selectedEmpresaId) || null}
                      onSelect={(id) => setSelectedEmpresaId(id ? String(id) : '')}
                    />
                  </div>
                </div>
              )}

              {pendingNewType === 'Corporativo' && (
                <div className="space-y-3">
                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-4">
                    <h5 className="text-xs font-black text-slate-800 uppercase tracking-tight">
                      Información de la Nueva Empresa
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="col-span-full flex flex-col gap-1.5">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Razón Social *</label>
                        <input
                          type="text"
                          value={razonSocial}
                          onChange={e => setRazonSocial(e.target.value)}
                          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-slate-700 bg-white"
                          placeholder="Nombre comercial de la inmobiliaria"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Tipo RIF *</label>
                        <select
                          value={rifTipo}
                          onChange={e => setRifTipo(e.target.value)}
                          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-slate-700 bg-white"
                        >
                          <option value="J">J (Jurídico)</option>
                          <option value="G">G (Gubernamental)</option>
                          <option value="P">P (Persona Firma Personal)</option>
                          <option value="V">V (Venezolano)</option>
                          <option value="E">E (Extranjero)</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Número de RIF (Solo números) *</label>
                        <input
                          type="text"
                          value={rifNumero}
                          onChange={e => setRifNumero(e.target.value.replace(/\D/g, ''))}
                          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-slate-700 bg-white"
                          placeholder="123456789"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Correo de la Empresa *</label>
                        <input
                          type="email"
                          value={emailEmpresa}
                          onChange={e => setEmailEmpresa(e.target.value)}
                          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-slate-700 bg-white"
                          placeholder="contacto@empresa.com"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Teléfono *</label>
                        <input
                          type="text"
                          value={telefonoEmpresa}
                          onChange={e => setTelefonoEmpresa(e.target.value)}
                          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-slate-700 bg-white"
                          placeholder="+58 212 555-5555"
                        />
                      </div>

                      <div className="col-span-full flex flex-col gap-1.5">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Dirección Física (Opcional)</label>
                        <textarea
                          rows={2}
                          value={direccionEmpresa}
                          onChange={e => setDireccionEmpresa(e.target.value)}
                          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-slate-700 bg-white resize-none"
                          placeholder="Dirección exacta..."
                        />
                      </div>

                      <div className="col-span-full flex flex-col gap-1.5">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Sitio Web (Opcional)</label>
                        <input
                          type="text"
                          value={websiteEmpresa}
                          onChange={e => setWebsiteEmpresa(e.target.value)}
                          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-slate-700 bg-white"
                          placeholder="www.tuempresa.com"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-4">
                    <h5 className="text-xs font-black text-slate-800 uppercase tracking-tight">
                      Documentación de la Empresa
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FileUpload
                        label="Registro Mercantil"
                        required
                        accept=".pdf,image/*"
                        folder="documentos_empresa"
                        onUploadSuccess={(url, name) => {
                          setUrlRegistro(url);
                          setNombreRegistro(name || 'Registro_Mercantil.pdf');
                        }}
                        onClear={() => {
                          setUrlRegistro('');
                          setNombreRegistro('');
                        }}
                      />
                      <FileUpload
                        label="RIF de la Empresa"
                        required
                        accept=".pdf,image/*"
                        folder="documentos_empresa"
                        onUploadSuccess={(url, name) => {
                          setUrlRif(url);
                          setNombreRif(name || 'RIF_Empresa.pdf');
                        }}
                        onClear={() => {
                          setUrlRif('');
                          setNombreRif('');
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-0 bg-gray-50 border-t border-gray-100 flex">
              <button
                type="button"
                onClick={() => setShowChangeTypeModal(false)}
                className="flex-1 h-12 rounded-xl border border-gray-200 text-gray-600 font-black uppercase tracking-widest text-[10px] hover:bg-white transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={
                  submittingChangeType ||
                  (pendingNewType === 'Agente Corporativo' && !selectedEmpresaId) ||
                  (pendingNewType === 'Corporativo' && (!razonSocial || !rifNumero || !emailEmpresa || !telefonoEmpresa || !urlRegistro || !urlRif))
                }
                onClick={() => {
                  const data: any = {};
                  if (pendingNewType === 'Agente Corporativo') {
                    data.id_empresa_solicitada = Number(selectedEmpresaId);
                  } else if (pendingNewType === 'Corporativo') {
                    data.datos_empresa = {
                      razon_social: razonSocial.trim(),
                      rif_tipo: rifTipo,
                      rif_numero: rifNumero.replace(/\D/g, ''),
                      email: emailEmpresa.trim().toLowerCase(),
                      telefono: telefonoEmpresa.trim(),
                      direccion: direccionEmpresa.trim(),
                      website: websiteEmpresa.trim()
                    };
                    data.documentos_empresa = [
                      { tipo_doc: 'registro_mercantil', url: urlRegistro, nombre_archivo: nombreRegistro },
                      { tipo_doc: 'rif_empresa', url: urlRif, nombre_archivo: nombreRif }
                    ];
                  }
                  executeDirectTypeChange(pendingNewType, data);
                }}
                className="flex-[2] h-12 rounded-xl bg-emerald-600 text-white font-black uppercase tracking-widest text-[10px] hover:bg-emerald-700 transition-colors flex items-center justify-center"
              >
                {submittingChangeType ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Natural Transition confirmation modal */}
      {naturalTransitionTarget && (
        <div className='fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs'>
          <div className='transition-opacity transition-transform bg-white rounded-2xl shadow-2xl border border-slate-100 p-5 w-[calc(100vw-2rem)] sm:w-full max-w-sm mx-auto fade-in zoom-in duration-200 text-center'>
            <div className='w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center text-amber-500 mx-auto mb-3'>
              <ShieldAlert size={28} />
            </div>
            <h3 className='text-base font-black text-slate-800 mb-1.5'>¿Cambiar a Agente Independiente?</h3>
            <p className='text-xs text-slate-500 mb-4 leading-relaxed'>
              ¿Estás seguro de convertir a <span className='font-bold text-slate-700'>{formatNombreCard(naturalTransitionTarget.nombre_completo)}</span> en Agente Independiente (Natural)? Se romperá cualquier vínculo con su empresa actual.
            </p>

            <div className='flex flex-col gap-2'>
              <button
                type='button'
                onClick={handleConfirmNaturalTransition}
                disabled={submittingChangeType}
                className='w-full py-2.5 bg-amber-500 text-white rounded-xl text-xs font-black hover:bg-amber-600 shadow-lg shadow-amber-500/25 transition-colors transition-opacity flex items-center justify-center gap-2 disabled:opacity-50'
              >
                <BadgeCheck size={16} />
                Sí, cambiar
              </button>
              <button
                type='button'
                onClick={() => setNaturalTransitionTarget(null)}
                className='w-full py-2 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors'
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CompanySearchField({
  companies,
  selectedIdEmpresa,
  onSelect,
  placeholder = "Buscar empresa...",
}: {
  companies: any[]
  selectedIdEmpresa: number | null | undefined
  onSelect: (id: number | null) => void
  placeholder?: string
}) {
  const [corpSearchField, setCorpSearchField] = React.useState<'nombre' | 'rif' | 'codigo'>('nombre')
  const [corpSearch, setCorpSearch] = React.useState('')
  const [showCorpDropdown, setShowCorpDropdown] = React.useState(false)
  const [showCorpResults, setShowCorpResults] = React.useState(false)

  const selectedCompany = companies.find(c => {
    return c.id_empresa === selectedIdEmpresa || c.id_afiliado === selectedIdEmpresa;
  })

  const [prevSelectedCompany, setPrevSelectedCompany] = React.useState(selectedCompany)
  if (prevSelectedCompany !== selectedCompany) {
    setPrevSelectedCompany(selectedCompany)
    if (selectedCompany) {
      setCorpSearch(selectedCompany.empresa_razon_social || selectedCompany.nombre_completo || '')
    } else {
      setCorpSearch('')
    }
  }

  const filteredCompanies = companies.filter((c) => {
    if (!corpSearch.trim()) return true
    const q = corpSearch.toLowerCase().trim()
    const qDigits = q.replace(/\D/g, '')
    const qClean = q.replace(/[^a-z0-9]/g, '')
    if (selectedCompany && (c.empresa_razon_social || c.nombre_completo || '') === corpSearch) return true;

    const razon = (c.empresa_razon_social || c.razon_social || '').toLowerCase();
    const nom = (c.nombre_completo || '').toLowerCase();
    const persona = `${c.nombres || ''} ${c.apellidos || ''}`.trim().toLowerCase();
    const rep = (c.representante_legal || c.representante_nombre || '').toLowerCase();

    const rifRaw = (c.empresa_rif_numero || c.rif_numero || c.cedula || '').toLowerCase();
    const rifTipo = (c.empresa_rif_tipo || c.rif_tipo || '').toLowerCase();
    const rifDigits = rifRaw.replace(/\D/g, '');
    const rifClean = `${rifTipo}${rifRaw}`.replace(/[^a-z0-9]/g, '');

    const cod = (c.codigo || c.empresa_codigo || '').toLowerCase();
    const codClean = cod.replace(/[^a-z0-9]/g, '');

    const matchNombre = razon.includes(q) || nom.includes(q) || persona.includes(q) || rep.includes(q);
    const matchCod = cod.includes(q) || (qClean !== '' && codClean.includes(qClean));
    const matchRif = rifRaw.includes(q) ||
                     rifClean.includes(qClean) ||
                     (qDigits.length >= 2 && rifDigits.includes(qDigits));

    if (corpSearchField === 'rif') return matchRif || matchNombre || matchCod;
    if (corpSearchField === 'codigo') return matchCod || matchNombre || matchRif;
    return matchNombre || matchRif || matchCod;
  })

  return (
    <div className="space-y-2 w-full">
      <div className="relative flex items-center bg-slate-50 border border-gray-200 rounded-xl focus-within:ring-2 focus-within:ring-emerald-500/10 focus-within:border-emerald-500 transition-colors h-10">
        <div className="relative shrink-0 border-r border-gray-200/80 h-full flex items-center">
          <button
            type="button"
            onClick={() => setShowCorpDropdown(!showCorpDropdown)}
            className="flex items-center gap-0.5 px-3 h-full text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-900 transition-colors"
          >
            <span>
              {corpSearchField === 'nombre' && 'Nombre'}
              {corpSearchField === 'rif' && 'RIF'}
              {corpSearchField === 'codigo' && 'Código'}
            </span>
            <ChevronDown size={12} className={`text-slate-400 transition-transform ${showCorpDropdown ? 'rotate-180' : ''}`} />
          </button>
          {showCorpDropdown && (
            <>
              <div className="fixed inset-0 z-40" aria-hidden="true" onClick={() => setShowCorpDropdown(false)} />
              <div className="transition-opacity transition-transform absolute left-0 top-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl py-1 z-50 min-w-[110px] fade-in slide-in-from-top-1 duration-200">
                {([
                  { key: 'nombre' as const, label: 'Nombre' },
                  { key: 'rif' as const, label: 'RIF' },
                  { key: 'codigo' as const, label: 'Código' },
                ]).map(option => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => { setCorpSearchField(option.key); setShowCorpDropdown(false); setCorpSearch(''); onSelect(null); }}
                    className={`w-full text-left px-3 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${corpSearchField === option.key ? 'bg-emerald-50 text-emerald-600' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="relative flex-grow h-full flex items-center">
          <Search className="absolute left-3 text-slate-400" size={14} />
          <input
            type="text"
            value={corpSearch}
            onChange={(e) => { setCorpSearch(e.target.value); setShowCorpResults(true); }}
            onFocus={() => setShowCorpResults(true)}
            placeholder={placeholder}
            className="w-full h-full pl-9 pr-8 bg-transparent text-xs font-semibold placeholder-slate-400 outline-none text-slate-800"
          />
          {corpSearch && (
            <button
              type="button"
              onClick={() => { setCorpSearch(''); onSelect(null); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center hover:bg-gray-300 transition-colors"
            >
              <X size={10} />
            </button>
          )}
        </div>
      </div>

      {selectedCompany && (
        <div className="flex items-center gap-3 px-3.5 py-2 bg-emerald-50/80 border border-emerald-100 rounded-xl">
          <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
            <Building2 size={14} className="text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-emerald-900 truncate">{selectedCompany.empresa_razon_social || selectedCompany.nombre_completo}</p>
            <p className="text-[10px] text-emerald-600 font-bold truncate">RIF: {selectedCompany.empresa_rif_numero || selectedCompany.cedula}{selectedCompany.codigo ? ` · Cód: ${selectedCompany.codigo}` : ''}</p>
          </div>
          <button
            type="button"
            onClick={() => { onSelect(null); setCorpSearch(''); }}
            className="w-6 h-6 rounded-full bg-emerald-200 text-emerald-700 flex items-center justify-center hover:bg-emerald-300 transition-colors shrink-0"
          >
            <X size={10} />
          </button>
        </div>
      )}

      <div className={`transition-colors duration-500 ease-in-out ${showCorpResults && corpSearch.trim() && !selectedCompany
        ? 'max-h-48 opacity-100 mt-1.5 border border-gray-200 pointer-events-auto'
        : 'max-h-0 opacity-0 mt-0 border-transparent overflow-hidden pointer-events-none'
        } relative z-10 w-full bg-white rounded-xl shadow-inner overflow-y-auto py-1.5`}>
        {filteredCompanies.length === 0 ? (
          <p className="px-4 py-3 text-xs text-slate-400 font-bold text-center">Sin resultados</p>
        ) : (
          filteredCompanies.slice(0, 10).map((c) => (
            <button
              key={c.id_afiliado}
              type="button"
              onClick={() => {
                onSelect(c.id_empresa ?? c.id_afiliado ?? null)
                setCorpSearch(c.empresa_razon_social || c.nombre_completo || '')
                setShowCorpResults(false)
              }}
              className="w-full text-left px-4 py-2 hover:bg-emerald-50/50 transition-colors flex items-center gap-3 group"
            >
              <div className="w-7 h-7 rounded-lg bg-slate-100 group-hover:bg-emerald-100 flex items-center justify-center shrink-0 transition-colors">
                <Building2 size={13} className="text-slate-400 group-hover:text-emerald-600 transition-colors" />
              </div>
              <div className="min-w-0 flex-grow">
                <p className="text-xs font-bold text-slate-800 group-hover:text-emerald-950 transition-colors truncate">{c.empresa_razon_social || c.nombre_completo}</p>
                <p className="text-[10px] text-slate-500 font-bold truncate">RIF: {c.empresa_rif_numero || c.cedula}{c.codigo ? ` · Cód: ${c.codigo}` : ''}</p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}


