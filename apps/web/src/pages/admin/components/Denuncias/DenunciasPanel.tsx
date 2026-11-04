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
  en_defensa: { label: 'En Defensa',     badge: 'bg-amber-50 text-amber-700 border-amber-200',      dot: 'bg-amber-500' },
  en_mediacion: { label: 'En Mediación',   badge: 'bg-purple-50 text-purple-700 border-purple-200',   dot: 'bg-purple-500' },
  resuelta:     { label: 'Resuelta',       badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  desestimada:  { label: 'Desestimada',    badge: 'bg-rose-50 text-rose-700 border-rose-200',         dot: 'bg-rose-500' },
  archivada:    { label: 'Archivada',      badge: 'bg-gray-100 text-gray-600 border-gray-300',        dot: 'bg-gray-400' },
}

const PRIORIDAD_CONFIG: Record<PrioridadDenuncia, { label: string; badge: string }> = {
  baja:    { label: 'Baja',    badge: 'bg-slate-50 text-slate-600 border-slate-200' },
  media:   { label: 'Media',   badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  alta:    { label: 'Alta',    badge: 'bg-rose-50 text-rose-700 border-rose-200 font-bold' },
  urgente: { label: 'Urgente', badge: 'bg-red-100 text-red-800 border-red-300 font-black motion-safe:animate-pulse' },
}

type TipoAccion = 'estatus' | 'defensa' | 'mediacion' | 'resolver'
interface AccionCaso { titulo: string; detalle: string; tipo: TipoAccion; destino?: EstatusDenuncia; tono?: 'primario' | 'peligro' }

/** Etapas del proceso, en orden; las dos finales (resuelta/desestimada) comparten el último paso */
const PASOS = ['Recibida', 'En revisión', 'Defensa', 'Mediación', 'Resolución']
const PASO_ACTUAL: Record<EstatusDenuncia, number> = { recibida: 0, en_revision: 1, en_defensa: 2, en_mediacion: 3, resuelta: 4, desestimada: 4, archivada: -1 }

const GUIA_ETAPA: Record<EstatusDenuncia, string> = {
  recibida: 'La denuncia acaba de llegar. Decide si es admisible para abrir el expediente de trabajo.',
  en_revision: 'El Tribunal analiza los hechos y las pruebas. Pide la versión del afiliado denunciado o cita a las partes.',
  en_defensa: 'El afiliado denunciado da su versión de los hechos (su defensa). Anótala cuando la reciba y decide cómo seguir.',
  en_mediacion: 'Hay una audiencia de conciliación convocada. Después de celebrarla, emite la resolución del caso.',
  resuelta: 'El caso terminó con una resolución. Solo puedes reabrirlo si surgen hechos nuevos.',
  desestimada: 'La denuncia se desestimó sin lugar. Solo puedes reabrirla si surgen hechos nuevos.',
  archivada: 'El expediente está archivado, sin resolución. Puedes reabrirlo si el denunciante retoma el caso.',
}

const ACCIONES: Record<EstatusDenuncia, AccionCaso[]> = {
  recibida: [
    { titulo: 'Admitir a revisión', detalle: 'La denuncia es admisible: se abre el expediente y empieza el análisis.', tipo: 'estatus', destino: 'en_revision', tono: 'primario' },
    { titulo: 'Desestimar la denuncia', detalle: 'No procede (sin fundamento o fuera de competencia). Redactas el dictamen y el caso termina.', tipo: 'resolver' },
    { titulo: 'Archivar', detalle: 'Se cierra sin resolución, por ejemplo si el denunciante no responde.', tipo: 'estatus', destino: 'archivada', tono: 'peligro' },
  ],
  en_revision: [
    { titulo: 'Pedirle su defensa al afiliado', detalle: 'Se le avisa al denunciado para que dé su versión de los hechos (es su derecho a defenderse).', tipo: 'estatus', destino: 'en_defensa', tono: 'primario' },
    { titulo: 'Convocar mediación', detalle: 'Cita a ambas partes a una audiencia de conciliación, con fecha y lugar.', tipo: 'mediacion' },
    { titulo: 'Emitir resolución', detalle: 'Cierra el caso con un dictamen: acuerdo, amonestación, sanción o desestimación.', tipo: 'resolver' },
    { titulo: 'Archivar', detalle: 'Se cierra sin resolución.', tipo: 'estatus', destino: 'archivada', tono: 'peligro' },
  ],
  en_defensa: [
    { titulo: 'Anotar la defensa recibida', detalle: 'Escribe en el expediente lo que respondió el afiliado denunciado.', tipo: 'defensa', tono: 'primario' },
    { titulo: 'Convocar mediación', detalle: 'Cita a ambas partes a una audiencia de conciliación.', tipo: 'mediacion' },
    { titulo: 'Emitir resolución', detalle: 'Cierra el caso con un dictamen.', tipo: 'resolver' },
    { titulo: 'Volver a revisión', detalle: 'El Tribunal necesita analizar más antes de decidir.', tipo: 'estatus', destino: 'en_revision' },
    { titulo: 'Archivar', detalle: 'Se cierra sin resolución.', tipo: 'estatus', destino: 'archivada', tono: 'peligro' },
  ],
  en_mediacion: [
    { titulo: 'Emitir resolución', detalle: 'Se celebró la audiencia: registra el acuerdo o la decisión del Tribunal.', tipo: 'resolver', tono: 'primario' },
    { titulo: 'Reprogramar mediación', detalle: 'Cambia la fecha o el lugar de la audiencia.', tipo: 'mediacion' },
    { titulo: 'Volver a la defensa', detalle: 'La mediación no avanzó y todavía falta la versión del afiliado.', tipo: 'estatus', destino: 'en_defensa' },
    { titulo: 'Archivar', detalle: 'Se cierra sin resolución.', tipo: 'estatus', destino: 'archivada', tono: 'peligro' },
  ],
  resuelta: [{ titulo: 'Reabrir expediente', detalle: 'Vuelve a revisión por hechos nuevos. Queda constancia en el historial.', tipo: 'estatus', destino: 'en_revision' }],
  desestimada: [{ titulo: 'Reabrir expediente', detalle: 'Vuelve a revisión por hechos nuevos. Queda constancia en el historial.', tipo: 'estatus', destino: 'en_revision' }],
  archivada: [{ titulo: 'Reabrir expediente', detalle: 'Vuelve a revisión. Queda constancia en el historial.', tipo: 'estatus', destino: 'en_revision' }],
}

const KPI_ACTIVO: Record<string, string> = {
  '': 'bg-slate-50 border-slate-700',
  recibida: 'bg-slate-100 border-slate-500',
  en_revision: 'bg-blue-50 border-blue-600',
  en_mediacion: 'bg-purple-50 border-purple-600',
  resuelta: 'bg-emerald-50 border-emerald-600',
  desestimada: 'bg-rose-50 border-rose-600',
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
  // Una sola petición de caso a la vez: mientras se procesa, las acciones quedan bloqueadas
  const [procesando, setProcesando] = useState(false)

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
  const handleCambiarEstatus = async (nuevoEstatus: EstatusDenuncia, titulo?: string) => {
    if (!detail) return
    const { isConfirmed } = await Swal.fire({
      title: titulo ? `${titulo}: pasar a "${ESTADO_CONFIG[nuevoEstatus].label}"` : `¿Cambiar estatus a "${ESTADO_CONFIG[nuevoEstatus].label}"?`,
      text: 'El cambio de etapa quedará registrado en el historial del expediente.',
      showCancelButton: true,
      confirmButtonText: 'Confirmar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#059669'
    })

    if (isConfirmed) {
      setProcesando(true)
      try {
        const res = await fetch(`${API_URL}/api/denuncias/admin/${detail.id_denuncia}/estatus`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({ estatus: nuevoEstatus })
        })
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Error al cambiar estatus')
        toast.success(`Estatus actualizado a ${ESTADO_CONFIG[nuevoEstatus].label}`)
        await Promise.all([fetchDetalle(detail.id_denuncia), fetchDenuncias()])
      } catch (err: any) {
        toast.error(err.message || 'Error al actualizar estatus')
      } finally {
        setProcesando(false)
      }
    }
  }

  // Anotar la defensa que presentó el afiliado denunciado
  const handleRegistrarDefensa = async () => {
    if (!detail) return
    const { value: defensaTexto } = await Swal.fire({
      title: 'Anotar la defensa del afiliado',
      input: 'textarea',
      inputPlaceholder: 'Escribe lo que respondió el afiliado denunciado sobre los hechos…',
      showCancelButton: true,
      confirmButtonText: 'Guardar defensa',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#059669',
      inputValidator: v => (v?.trim() ? null : 'Escribe lo que respondió el afiliado.')
    })
    if (!defensaTexto) return
    setProcesando(true)
    try {
      const res = await fetch(`${API_URL}/api/denuncias/admin/${detail.id_denuncia}/defensa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ defensaTexto })
      })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Error al guardar la defensa')
      toast.success('Defensa guardada en el expediente')
      await Promise.all([fetchDetalle(detail.id_denuncia), fetchDenuncias()])
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar la defensa')
    } finally {
      setProcesando(false)
    }
  }

  // Cambiar la prioridad: la define el Tribunal y queda en el historial interno
  const handleCambiarPrioridad = async (prioridad: PrioridadDenuncia) => {
    if (!detail || procesando || prioridad === detail.prioridad) return
    const { isConfirmed, value: motivo } = await Swal.fire({
      title: `Cambiar prioridad a "${PRIORIDAD_CONFIG[prioridad].label}"`,
      input: 'text',
      inputPlaceholder: 'Motivo del cambio (opcional)…',
      showCancelButton: true,
      confirmButtonText: 'Cambiar prioridad',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#059669'
    })
    if (!isConfirmed) return
    setProcesando(true)
    try {
      const res = await fetch(`${API_URL}/api/denuncias/admin/${detail.id_denuncia}/prioridad`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ prioridad, motivo: motivo || undefined })
      })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Error al cambiar la prioridad')
      toast.success(`Prioridad actualizada a ${PRIORIDAD_CONFIG[prioridad].label}`)
      await Promise.all([fetchDetalle(detail.id_denuncia), fetchDenuncias()])
    } catch (err: any) {
      toast.error(err.message || 'Error al cambiar la prioridad')
    } finally {
      setProcesando(false)
    }
  }

  const ejecutarAccion = (a: AccionCaso) => {
    if (procesando) return
    if (a.tipo === 'estatus' && a.destino) handleCambiarEstatus(a.destino, a.titulo)
    else if (a.tipo === 'defensa') handleRegistrarDefensa()
    else if (a.tipo === 'mediacion') setModalMediacionOpen(true)
    else setModalResolucionOpen(true)
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
    <div className="p-4 sm:p-6 w-full overflow-y-auto h-full space-y-6 [&_button:focus-visible]:outline-none [&_button:focus-visible]:ring-2 [&_button:focus-visible]:ring-emerald-600 [&_button:focus-visible]:ring-offset-2 [&_a:focus-visible]:outline-none [&_a:focus-visible]:ring-2 [&_a:focus-visible]:ring-emerald-600 [&_a:focus-visible]:ring-offset-2">
      {/* Header Superior */}
      <header className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-rose-700">
            <Gavel size={13} aria-hidden="true" />
            Tribunal de Ética &amp; Disciplina
          </p>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight mt-1.5 text-balance">
            Gestión de Denuncias
          </h2>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Expedientes de quejas, mediación, derecho a la defensa y resoluciones entre partes y afiliados.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchDenuncias}
          className="px-3.5 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 transition-colors inline-flex items-center gap-1.5 text-xs font-bold shrink-0"
        >
          <RefreshCw size={14} aria-hidden="true" className={loading ? 'animate-spin text-emerald-700' : ''} />
          <span>Refrescar</span>
        </button>
      </header>

      {/* Tarjetas KPI (filtro por estatus) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3" role="group" aria-label="Filtrar por estatus">
        {([
          ['', 'Total', kpis.total],
          ['recibida', 'Recibidas', kpis.recibidas],
          ['en_revision', 'En Revisión', kpis.enRevision],
          ['en_mediacion', 'En Mediación', kpis.enMediacion],
          ['resuelta', 'Resueltas', kpis.resueltas],
          ['desestimada', 'Desestimadas', kpis.desestimadas],
        ] as [string, string, number][]).map(([key, label, value]) => {
          const on = filtroEstatus === key
          return (
            <button
              key={key || 'total'}
              type="button"
              aria-pressed={on}
              onClick={() => setFiltroEstatus(key)}
              className={`p-4 rounded-2xl border-2 text-left transition-colors ${
                on ? KPI_ACTIVO[key] : 'bg-white border-slate-200 hover:border-slate-400'
              }`}
            >
              <span className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-600`}>
                {key && <span aria-hidden="true" className={`w-2 h-2 rounded-full ${ESTADO_CONFIG[key as EstatusDenuncia].dot}`} />}
                {label}
              </span>
              <span className={`block text-2xl font-black mt-1.5 tabular-nums text-slate-900`}>{value}</span>
            </button>
          )
        })}
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
                className="p-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 transition-colors shadow-xs"
                title="Volver a la lista"
                aria-label="Volver a la lista"
              >
                <ArrowLeft size={16} />
              </button>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-black text-sm text-slate-800">{detail.codigo}</span>
                  <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${ESTADO_CONFIG[detail.estatus].badge}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${ESTADO_CONFIG[detail.estatus].dot}`} />
                    {ESTADO_CONFIG[detail.estatus].label}
                  </span>
                  <span className={`text-[11px] uppercase font-bold px-2 py-0.5 rounded-full border ${PRIORIDAD_CONFIG[detail.prioridad].badge}`}>
                    Prioridad {PRIORIDAD_CONFIG[detail.prioridad].label}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mt-1 text-balance">{detail.titulo}</h3>
              </div>
            </div>
          </div>

          {/* Proceso: dónde está el caso, qué sigue y quién decide la prioridad */}
          <div className="px-6 pt-6 space-y-5">
            {(() => {
              const actual = PASO_ACTUAL[detail.estatus]
              const cerrado = detail.estatus === 'resuelta' || detail.estatus === 'desestimada' || detail.estatus === 'archivada'
              return (
                <>
                  <ol className="flex items-start" aria-label="Etapas del proceso">
                    {PASOS.map((paso, i) => {
                      const hecho = actual > i || (actual === 4 && i === 4)
                      const enCurso = actual === i && !cerrado
                      return (
                        <li key={paso} className="relative flex-1 flex flex-col items-center text-center" aria-current={enCurso ? 'step' : undefined}>
                          {i > 0 && <span aria-hidden="true" className={`absolute right-1/2 top-4 h-0.5 w-full -translate-y-1/2 ${hecho || enCurso ? 'bg-emerald-500' : 'bg-slate-200'}`} />}
                          <span className={`relative z-10 grid h-8 w-8 place-items-center rounded-full text-xs font-black ring-4 ring-white ${
                            hecho ? 'bg-emerald-100 text-emerald-800' : enCurso ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-600'
                          }`}>
                            {hecho ? <Check size={15} aria-hidden="true" /> : i + 1}
                          </span>
                          <span className={`mt-1.5 text-[11px] font-bold ${enCurso ? 'text-emerald-950' : hecho ? 'text-emerald-800' : 'text-slate-500'}`}>
                            {i === 4 && detail.estatus === 'desestimada' ? 'Desestimada' : paso}
                          </span>
                        </li>
                      )
                    })}
                  </ol>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <section className="lg:col-span-2 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5" aria-labelledby="sig-paso">
                      <h4 id="sig-paso" className="flex items-center gap-2 text-sm font-black text-slate-900">
                        {cerrado ? `Expediente ${ESTADO_CONFIG[detail.estatus].label.toLowerCase()}` : 'Qué sigue'}
                        {procesando && (
                          <span role="status" className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                            <RefreshCw size={13} className="animate-spin" aria-hidden="true" /> Procesando…
                          </span>
                        )}
                      </h4>
                      <p className="mt-0.5 text-xs font-medium text-slate-600">{GUIA_ETAPA[detail.estatus]}</p>
                      <ul className="mt-3 space-y-2">
                        {ACCIONES[detail.estatus].map(a => (
                          <li key={a.titulo}>
                            <button
                              type="button"
                              onClick={() => ejecutarAccion(a)}
                              disabled={procesando}
                              className={`w-full flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                                a.tono === 'primario'
                                  ? 'bg-emerald-700 border-emerald-700 text-white hover:bg-emerald-800'
                                  : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-100'
                              }`}
                            >
                              <span className="min-w-0">
                                <span className={`block text-sm font-bold ${a.tono === 'peligro' ? 'text-rose-700' : ''}`}>{a.titulo}</span>
                                <span className={`block text-xs font-medium ${a.tono === 'primario' ? 'text-emerald-100' : 'text-slate-600'}`}>{a.detalle}</span>
                              </span>
                              <ChevronRight size={16} aria-hidden="true" className="shrink-0" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </section>

                    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5" aria-labelledby="prio-caso">
                      <h4 id="prio-caso" className="text-sm font-black text-slate-900">Prioridad del caso</h4>
                      <p className="mt-0.5 text-xs font-medium text-slate-600">
                        La define el Tribunal. El sistema la propone al recibir la denuncia según el tipo de falta y el monto; el denunciante no la elige.
                      </p>
                      <label className="mt-3 block">
                        <span className="sr-only">Prioridad</span>
                        <select
                          value={detail.prioridad}
                          disabled={cerrado || procesando}
                          onChange={e => handleCambiarPrioridad(e.target.value as PrioridadDenuncia)}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:opacity-60 disabled:bg-slate-100"
                        >
                          {(['baja', 'media', 'alta', 'urgente'] as PrioridadDenuncia[]).map(p => <option key={p} value={p}>{PRIORIDAD_CONFIG[p].label}</option>)}
                        </select>
                      </label>
                      <p className="mt-2 text-[11px] font-medium text-slate-500">Cada cambio queda en el historial interno, con su motivo.</p>
                    </section>
                  </div>
                </>
              )
            })()}
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
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Denunciante ({detail.tipo_denunciante === 'afiliado' ? 'Afiliado' : 'Particular'})</span>
                    <span className="text-[11px] font-bold font-mono text-slate-700 bg-white px-2 py-0.5 rounded-lg border border-slate-200">
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
                <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200 space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Afiliado Gremial Denunciado</span>
                  <p className="font-bold text-emerald-950 text-sm">{detail.nombre_denunciado}</p>
                  <p className="text-xs text-emerald-700 font-mono">Código: {detail.codigo_afiliado_denunciado || 'No asignado'}</p>
                  <div className="pt-2 border-t border-emerald-200/80 flex flex-col gap-1 text-xs text-emerald-900">
                    <span className="flex items-center gap-1.5">
                      <Building2 size={12} className="text-emerald-500" />
                      Tipo: {detail.denunciado_tipo_persona || 'Afiliado'} ({detail.denunciado_estatus_afiliado || 'Activo'})
                    </span>
                    {detail.denunciado_email_persona && (
                      <span className="flex items-center gap-1.5"><Mail size={12} className="text-emerald-500" /> {detail.denunciado_email_persona}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Hechos y Conflicto */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
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
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
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
                          <FileText size={16} className="text-emerald-600 shrink-0" />
                          <span className="text-xs font-bold text-slate-700 truncate group-hover:text-emerald-900">
                            {doc.nombre_archivo}
                          </span>
                        </div>
                        <ExternalLink size={14} className="text-slate-400 group-hover:text-emerald-600 shrink-0" />
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">No se adjuntaron documentos adicionales.</p>
                )}
              </div>
            </div>

            {/* Columna Derecha: Bitácora Procesal y Notas Internas */}
            <div className="space-y-6">
              {/* Notas Internas Confidenciales */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Notas Internas</span>
                  <button
                    onClick={handleGuardarNotas}
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1"
                  >
                    <Save size={12} /> Guardar
                  </button>
                </div>
                <textarea
                  aria-label="Notas internas"
                  rows={3}
                  value={notaInterna}
                  onChange={e => setNotaInterna(e.target.value)}
                  placeholder="Anotaciones confidenciales para el Tribunal de Ética…"
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 resize-none bg-white"
                />
              </div>

              {/* Línea de Tiempo del Expediente */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Historial Procesal</span>
                <div className="space-y-3 relative pl-4 border-l-2 border-slate-100 max-h-72 overflow-y-auto">
                  {detail.historial && detail.historial.length > 0 ? (
                    detail.historial.map(h => (
                      <div key={h.id_historial} className="relative text-xs space-y-0.5">
                        <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-white" />
                        <p className="font-bold text-slate-800">{h.accion}</p>
                        {h.comentario && <p className="text-slate-600 text-xs">{h.comentario}</p>}
                        <span className="text-[11px] text-slate-500 font-mono">{fmtDate(h.fecha)}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-500">Sin historial registrado.</p>
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
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search size={14} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="search"
                name="busqueda"
                aria-label="Buscar denuncias"
                autoComplete="off"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por código, denunciante, afiliado o cédula…"
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                aria-label="Filtrar por prioridad"
                value={filtroPrioridad}
                onChange={e => setFiltroPrioridad(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 bg-white outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
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
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
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
                        className="hover:bg-slate-50 focus-within:bg-slate-50 transition-colors cursor-pointer group"
                      >
                        <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                          {d.codigo}
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                          {fmtDate(d.fecha_presentacion)}
                        </td>
                        <td className="py-3 px-4 max-w-[160px] truncate">
                          <p className="font-bold text-slate-800 truncate">{d.nombre_denunciante}</p>
                          <p className="text-[11px] text-slate-500 font-mono">{d.cedula_rif_denunciante}</p>
                        </td>
                        <td className="py-3 px-4 max-w-[180px] truncate">
                          <p className="font-bold text-emerald-950 truncate">{d.nombre_denunciado}</p>
                          <p className="text-[11px] text-emerald-700 font-mono">{d.codigo_afiliado_denunciado || '-'}</p>
                        </td>
                        <td className="py-3 px-4 max-w-[220px]">
                          <p className="font-semibold text-slate-800 truncate">{d.titulo}</p>
                          <p className="text-[11px] text-slate-500 truncate">{TIPOS_FALTA_LABELS[d.tipo_falta] || d.tipo_falta}</p>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className={`text-[11px] uppercase font-bold px-2 py-0.5 rounded-full border ${PRIORIDAD_CONFIG[d.prioridad].badge}`}>
                            {PRIORIDAD_CONFIG[d.prioridad].label}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${ESTADO_CONFIG[d.estatus].badge}`}>
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
                            className="p-1.5 rounded-lg bg-slate-100 group-hover:bg-emerald-700 group-hover:text-white transition-colors text-slate-700"
                            title="Ver expediente"
                            aria-label={`Ver expediente ${d.codigo}`}
                          >
                            <ChevronRight size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-slate-500">
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
