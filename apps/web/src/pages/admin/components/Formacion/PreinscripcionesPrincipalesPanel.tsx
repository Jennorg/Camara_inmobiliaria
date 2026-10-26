import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { API_URL } from '@/config/env'
import { useAuth } from '@/context/AuthContext'
import { ClipboardList, FileText, Calendar, ShieldCheck, GraduationCap, CreditCard, Check, User, Search, Building2, CheckCircle2, Clock, Mail, Loader2 } from 'lucide-react'
import Swal from 'sweetalert2'
import AfiliadosPanel from '@/pages/admin/components/Afiliados/AfiliadosPanel'
import { etiquetaDocumento, formatNombreCard } from '@/utils/formatters'
import { matchesSearch } from '@/utils/searchUtils'
import { formatDateLatina } from '@/utils/formatters'
import DisponibilidadEntrevistasModal from './DisponibilidadEntrevistasModal'
import GestionCohortesModal from './GestionCohortesModal'
import CohortesNavegador, { AlturaSuave, CohortesPorPrograma, type Cohorte } from './CohortesNavegador'
import ModalCobroTaquilla from '@/pages/admin/components/Finance/ModalCobroTaquilla'
import ReciboDigitalModal from '@/components/ReciboDigitalModal'
import type { PagoDTO } from '@/types/pagos'

const AFILIACION_STEPS_FLOW = [
  { label: 'Preinscripción', desc: 'Registro inicial de datos básicos', icon: ClipboardList, labelShort: 'Preins.' },
  { label: 'Expediente', desc: 'Carga y revisión de documentación', icon: FileText, labelShort: 'Exped.' },
  { label: 'Entrevista', desc: 'Cita presencial con la junta directiva', icon: Calendar, labelShort: 'Entrev.' },
  { label: 'Verificación', desc: 'Evaluación de perfil y referencias', icon: ShieldCheck, labelShort: 'Verif.' },
  { label: 'CIBIR', desc: 'Acreditación o nivelación de conocimientos', icon: GraduationCap, labelShort: 'CIBIR' },
  { label: 'Inscripción', desc: 'Aprobación final y pago de arancel', icon: CreditCard, labelShort: 'Inscr.' },
  { label: 'Afiliación', desc: 'Miembro activo de la Cámara', icon: Check, labelShort: 'Afil.' }
]

type ProgramaCodigo = 'CIBIR' | 'PADI' | 'PEGI' | 'PREANI' | 'AFILIACION'
type Estatus = 'Preinscrito' | 'Entrevista' | 'Inscrito' | 'Rechazado' | 'Cancelado'

type Row = {
  id_inscripcion: number
  programa_codigo: ProgramaCodigo
  estatus: Estatus
  creado_en: string
  id_estudiante: number
  estudiante_nombre: string
  estudiante_nombres: string
  estudiante_apellidos: string
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
  id_afiliado?: number | null
  afiliado_estatus?: string
  afiliado_tipo?: string | null
  /** Hay un pago verificado del arancel CIBIR / del arancel de su programa */
  pago_cibir?: number | null
  pago_programa?: number | null
  empresa_vinculada_nombre?: string | null
  estudiante_es_corredor_inmobiliario?: number | boolean | null
  estudiante_nivel_profesional?: string | null
  estudiante_profesion?: string | null
  ano_inicio_servicio?: number | null
  apto_acreditacion?: number
  cibir_acreditado?: number | boolean | null
  completado?: number
  num_modulos?: number
  modulos_aprobados?: number
  num_documentos?: number
  edicion_cibir_nombre?: string | null
  id_cohorte?: number | null
  cohorte_numero?: number | null
  cohorte_nombre?: string | null
}

/** Etapas del trámite de acreditación; es el filtro de estado cuando en CIBIR se elige la vía Acreditación */
const ETAPAS_ACRED = ['Todas', 'Sin expediente', 'En revisión', 'Entrevista', 'Verificación', 'Por acreditar', 'Acreditado', 'Rechazado'] as const
type EtapaAcred = typeof ETAPAS_ACRED[number]
const TIPOS_ACRED = ['Agente Indep.', 'Agente Corp.', 'Corporativo'] as const

const etapaAcred = (r: Pick<Row, 'estatus' | 'afiliado_estatus' | 'num_documentos' | 'cibir_acreditado'>): Exclude<EtapaAcred, 'Todas'> => {
  if (r.estatus === 'Rechazado') return 'Rechazado'
  if (r.cibir_acreditado || r.afiliado_estatus === '6_INSCRIPCION') return 'Acreditado'
  switch (r.afiliado_estatus) {
    case '3_ENTREVISTA': return 'Entrevista'
    case '4_VERIFICACION': return 'Verificación'
    case '5_CIBIR': return 'Por acreditar'
    default: return r.num_documentos ? 'En revisión' : 'Sin expediente'
  }
}
const tipoAcred = (t?: string | null) => (t === 'Corporativo' ? 'Corporativo' : t === 'Agente Corporativo' || t === 'Agente' ? 'Agente Corp.' : 'Agente Indep.')

const UI_ESTATUS = ['Todos', 'Sin Expediente', 'Pendiente', 'Entrevista', 'Inscrito', 'Aprobado', 'Rechazado'] as const

/**
 * Estado de la lista de una fila: sigue a la etapa de afiliación (la misma que muestra la etiqueta) y, sin ella, al estatus de la inscripción.
 * Inscrito = está dentro del programa (etapa CIBIR o inscripción); Aprobado = lo terminó (`completado`) o ya es Afiliado oficial.
 * Verificación cuenta como Pendiente: aún no ha entrado al programa. En la BD, Inscrito y Aprobado comparten estatus 'Inscrito'.
 */
type EstadoUi = Exclude<typeof UI_ESTATUS[number], 'Todos'>
type FilaEstado = { estatus: string; completado?: unknown; afiliado_estatus?: string; num_documentos?: number }
const estadoUi = (r: FilaEstado): EstadoUi | null => {
  const a = r.afiliado_estatus
  if (r.estatus === 'Rechazado' || a === 'Rechazado') return 'Rechazado'
  if (a === 'Afiliado' || ((r.estatus === 'Inscrito' || r.estatus === 'Pagado') && Number(r.completado) === 1)) return 'Aprobado'
  const preinscrito: EstadoUi = r.num_documentos ? 'Pendiente' : 'Sin Expediente'
  switch (a) {
    case '1_PREINSCRIPCION': case '2_EXPEDIENTE': return preinscrito
    case '3_ENTREVISTA': return 'Entrevista'
    case '4_VERIFICACION': return 'Pendiente'
    case '5_CIBIR': case '6_INSCRIPCION': return 'Inscrito'
  }
  if (r.estatus === 'Preinscrito') return preinscrito
  if (r.estatus === 'Entrevista') return 'Entrevista'
  return r.estatus === 'Inscrito' ? 'Inscrito' : null
}

const PROGRAMAS_CON_COHORTE = ['CIBIR', 'PREANI', 'PEGI', 'PADI']
/** Aparición de la franja al cambiar de programa y de las primeras filas al cambiar de lista (sin movimiento si el usuario lo prefiere) */
const ENTRADA_FRANJA = 'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-300'
const ENTRADA_FILA = 'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-left-1 motion-safe:duration-300 motion-safe:fill-mode-backwards'

export default function PreinscripcionesPrincipalesPanel({
  initialPrograma = 'Todos'
}: {
  initialPrograma?: ProgramaCodigo | 'Todos'
}) {
  const { token } = useAuth()
  const [programa, setPrograma] = useState<ProgramaCodigo | 'Todos'>(initialPrograma)
  type UiEstatus = typeof UI_ESTATUS[number]
  const [uiEstatus, setUiEstatus] = useState<UiEstatus>('Pendiente')
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Row | null>(null)
  const [documentos, setDocumentos] = useState<{ id_documento: number; tipo_doc: string; url: string; nombre_archivo: string | null }[]>([])
  const [loadingDocs, setLoadingDocs] = useState(false)
  const [toggleLoading, setToggleLoading] = useState(false)

  const [processingAction, setProcessingAction] = useState<string | null>(null)
  const [changingEtapaStep, setChangingEtapaStep] = useState<number | null>(null)
  const [submittingAgendar, setSubmittingAgendar] = useState(false)
  const [submittingFinalizar, setSubmittingFinalizar] = useState(false)
  const [validatingRef, setValidatingRef] = useState<string | null>(null)

  const authHeaders = useMemo(() => {
    const h: Record<string, string> = {}
    if (token) h.Authorization = `Bearer ${token}`
    return h
  }, [token])

  // Cohortes: lista, filtro ('todas' | 'sin' | id) y acciones
  const [cohortes, setCohortes] = useState<Cohorte[]>([])
  const [cohorteFiltro, setCohorteFiltro] = useState<number | null>(null)
  const [savingCohorte, setSavingCohorte] = useState(false)
  const [gestionandoCohortes, setGestionandoCohortes] = useState(false)
  // Filtros propios de la vía Acreditación
  const [etapaAcredSel, setEtapaAcredSel] = useState<EtapaAcred>('Todas')
  const [tipoAcredSel, setTipoAcredSel] = useState<'' | typeof TIPOS_ACRED[number]>('')
  // La acreditación es una vía del CIBIR (quien opta por acreditarse en vez de cursarlo), no un programa aparte
  const [viaCibir, setViaCibir] = useState<'Todas' | 'Curso' | 'Acreditación'>('Todas')
  const esAcred = programa === 'CIBIR' && viaCibir === 'Acreditación'

  const fetchCohortes = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/academia/cohortes`, { headers: { ...authHeaders } })
      const json = await res.json()
      if (res.ok && json.success) setCohortes(json.data)
    } catch { /* el panel sigue funcionando sin cohortes */ }
  }, [authHeaders])
  useEffect(() => { fetchCohortes() }, [fetchCohortes])
  useEffect(() => { setCohorteFiltro(null); setViaCibir('Todas') }, [programa])

  const cohortesDelPrograma = useMemo(
    () => cohortes.filter(c => c.programa_codigo === programa),
    [cohortes, programa]
  )
  const seleccionarCohorte = (id: number | null) => {
    setCohorteFiltro(id)
    setUiEstatus('Todos') // una cohorte cerrada no tiene "pendientes": mostrar a todos, no el filtro por defecto
    setSelected(null)
  }

  const mostrarError = (e: unknown, fallback: string) =>
    Swal.fire({ title: 'Error', text: e instanceof Error ? e.message : fallback, icon: 'error', confirmButtonColor: '#dc2626' })

  const cambiarCohorte = async (r: Row, valor: string) => {
    setSavingCohorte(true)
    try {
      const res = await fetch(`${API_URL}/api/academia/inscripciones/${r.id_inscripcion}/cohorte`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ id_cohorte: valor === '' ? null : Number(valor) }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'No se pudo cambiar la cohorte')
      const destino = cohortes.find(c => c.id_cohorte === Number(valor))
      setSelected(prev => prev && prev.id_inscripcion === r.id_inscripcion
        ? { ...prev, id_cohorte: destino?.id_cohorte ?? null, cohorte_numero: destino?.numero ?? null, cohorte_nombre: destino?.nombre ?? null }
        : prev)
      await Promise.all([fetchData(true), fetchCohortes()])
    } catch (e) {
      mostrarError(e, 'No se pudo cambiar la cohorte')
    } finally {
      setSavingCohorte(false)
    }
  }

  const nuevaCohorte = async () => {
    if (!PROGRAMAS_CON_COHORTE.includes(programa)) return
    const abierta = cohortesDelPrograma.find(c => c.estado === 'Abierta')
    const r = await Swal.fire({
      title: `Nueva cohorte de ${programa}`,
      html: abierta
        ? `Se cerrará la <b>${abierta.nombre}</b> y las nuevas inscripciones entrarán a la nueva cohorte.`
        : 'Las nuevas inscripciones entrarán a esta cohorte.',
      input: 'text', inputLabel: 'Nombre (opcional)', inputPlaceholder: `Cohorte ${(cohortesDelPrograma.at(-1)?.numero ?? 0) + 1}`,
      showCancelButton: true, confirmButtonText: 'Crear', cancelButtonText: 'Cancelar', confirmButtonColor: '#059669',
    })
    if (!r.isConfirmed) return
    try {
      const res = await fetch(`${API_URL}/api/academia/cohortes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ programa_codigo: programa, nombre: r.value || undefined }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'No se pudo crear la cohorte')
      await fetchCohortes()
      seleccionarCohorte(json.data.id_cohorte)
    } catch (e) {
      mostrarError(e, 'No se pudo crear la cohorte')
    }
  }

  const cambiarEstadoCohorte = async (c: Cohorte) => {
    const cerrar = c.estado === 'Abierta'
    const otraAbierta = cohortesDelPrograma.find(o => o.estado === 'Abierta' && o.id_cohorte !== c.id_cohorte)
    const r = await Swal.fire({
      title: `${cerrar ? 'Cerrar' : 'Reabrir'} ${c.nombre}`,
      html: cerrar
        ? `Las nuevas inscripciones de ${c.programa_codigo} quedarán sin cohorte hasta que abras otra.`
        : `Las nuevas inscripciones entrarán a la <b>${c.nombre}</b>.${otraAbierta ? ` Se cerrará la <b>${otraAbierta.nombre}</b>.` : ''}`,
      showCancelButton: true, confirmButtonText: cerrar ? 'Cerrar' : 'Reabrir', cancelButtonText: 'Cancelar', confirmButtonColor: '#059669',
    })
    if (!r.isConfirmed) return
    try {
      const res = await fetch(`${API_URL}/api/academia/cohortes/${c.id_cohorte}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ estado: cerrar ? 'Cerrada' : 'Abierta' }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'No se pudo cambiar el estado de la cohorte')
      await fetchCohortes()
    } catch (e) {
      mostrarError(e, 'No se pudo cambiar el estado de la cohorte')
    }
  }

  const [showModalAgendar, setShowModalAgendar] = useState(false)
  const [showModalFinalizar, setShowModalFinalizar] = useState(false)
  // Cobros de caja sin salir de la pantalla: qué se está cobrando a la persona seleccionada y el recibo emitido
  const [cobro, setCobro] = useState<'formalizacion_afiliacion' | 'curso_cibir' | 'programa' | null>(null)
  const [reciboPago, setReciboPago] = useState<PagoDTO | null>(null)
  /** Muestra el recibo completo (con los datos del pagador); si no se puede pedir, el recién creado */
  const abrirRecibo = async (pago: PagoDTO) => {
    try {
      const res = await fetch(`${API_URL}/api/pagos/recibo/${pago.id_pago}`, { headers: { ...authHeaders } })
      const json = await res.json()
      setReciboPago(res.ok && json.success ? json.data : pago)
    } catch {
      setReciboPago(pago)
    }
  }
  const ofrecerCobroCibir = async (mensaje: string) => {
    const r = await Swal.fire({
      title: 'Falta el pago del CIBIR', text: mensaje, icon: 'info', showCancelButton: true,
      confirmButtonText: 'Registrar cobro ahora', cancelButtonText: 'Cerrar', confirmButtonColor: '#059669',
    })
    if (r.isConfirmed) setCobro('curso_cibir')
  }
  const [entrevista, setEntrevista] = useState({ fecha: '', hora: '', lugar: 'Sede Cámara Inmobiliaria' })
  // Agendar: por enlace (el aspirante elige entre los horarios disponibles) o fijando fecha y hora a mano
  const [modoAgenda, setModoAgenda] = useState<'enlace' | 'manual'>('enlace')
  const [enviandoEnlace, setEnviandoEnlace] = useState(false)
  const [showDisponibilidad, setShowDisponibilidad] = useState(false)
  const [finalizarData, setFinalizarData] = useState<{ resultado: 'Aprobado' | 'Parcial' | 'Rechazado', nota: string }>({
    resultado: 'Aprobado',
    nota: ''
  })

  const fetchDocumentos = useCallback(async (idEstudiante: number) => {
    if (!idEstudiante || isNaN(idEstudiante)) {
      setDocumentos([])
      return
    }
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
  }, [authHeaders])

  const selectedRef = useRef<Row | null>(null)
  selectedRef.current = selected

  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true)
    setError('')
    try {
      const qs = new URLSearchParams()
      qs.set('estatus', 'Todos')
      qs.set('soloProgramas', 'true') // los cursos y talleres se gestionan en Gestión de Formación
      if (cohorteFiltro !== null) {
        // Los miembros se piden por cohorte: no todos se guardan con el mismo código de programa
        qs.set('cohorteId', String(cohorteFiltro))
      } else if (programa !== 'Todos') {
        // CIBIR (cursando o acreditando) se mapea a 'AFILIACION' en la API
        if (programa === 'CIBIR') {
          qs.set('programaCodigo', 'AFILIACION')
        } else {
          qs.set('programaCodigo', programa)
        }
      }

      const res = await fetch(`${API_URL}/api/academia/preinscripciones?${qs.toString()}`, {
        headers: { ...authHeaders },
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'Error cargando preinscripciones')

      const data = json.data as Row[]
      setRows(data)

      const urlParams = new URLSearchParams(window.location.search)
      const idFromUrl = urlParams.get('id')
      const activeSelected = selectedRef.current
      const targetId = idFromUrl ? Number(idFromUrl) : (activeSelected ? activeSelected.id_inscripcion : null)
      if (targetId) {
        const found = data.find(r => r.id_inscripcion === targetId)
        if (found) {
          setSelected(found)
          fetchDocumentos(found.id_estudiante)
        }
        // Si no está en la lista (ej: ya es Afiliado y fue excluido del filtro),
        // mantenemos el selected previo intacto para no perder el panel del usuario.
      }
    } catch (e: unknown) {
      const err = e as Error
      setError(err.message || 'Error inesperado')
    } finally {
      if (!isSilent) setLoading(false)
    }
  }, [programa, cohorteFiltro, authHeaders, fetchDocumentos])

  const handleAprobarEtapaCibir = async () => {
    if (!selected || processingAction) return

    const result = await Swal.fire({
      title: '¿Aprobar CIBIR y Afiliar?',
      text: `Esto aprobará el CIBIR de ${selected.estudiante_nombre} y lo moverá a la etapa final de Miembro Afiliado Oficial.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#00D084',
      cancelButtonColor: '#cbd5e1',
      confirmButtonText: 'Sí, aprobar y afiliar',
      cancelButtonText: 'Cancelar'
    })

    if (!result.isConfirmed) return

    setProcessingAction('aprobarCibir')
    try {
      Swal.fire({
        title: 'Procesando...',
        text: 'Aprobando el CIBIR y otorgando afiliación oficial...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
      })

      // 1. Aprobar el CIBIR (promueve a etapa 7: 'Afiliado' y asigna credenciales)
      const resModulos = await fetch(`${API_URL}/api/academia/inscripciones/${selected.id_inscripcion}/modulos/aprobar-todos`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders }
      })
      const jsonModulos = await resModulos.json()
      if (!resModulos.ok || !jsonModulos.success) throw new Error(jsonModulos.message || 'No se pudo aprobar el CIBIR')

      // La persona pasa a 'Afiliado' y sale del filtro de preinscripciones.
      // fetchData(true) refresca la lista silenciosamente; si el selected ya no está
      // en la nueva lista, fetchData lo conserva intacto (no lo borra).
      await fetchData(true)

      Swal.fire({
        title: '¡Afiliación Completada!',
        html: `<b>${selected.estudiante_nombre}</b> ha sido acreditado en el CIBIR y ahora es <b>Miembro Afiliado Oficial</b> de la Cámara.`,
        icon: 'success',
        confirmButtonColor: '#00D084',
        confirmButtonText: 'Entendido'
      })
    } catch (e: any) {
      Swal.fire('Error', e.message || 'No se pudo completar la aprobación de CIBIR', 'error')
    } finally {
      setProcessingAction(null)
    }
  }


  useEffect(() => {
    fetchData()
  }, [fetchData])

  const enviarEnlaceAgenda = async () => {
    if (!selected || enviandoEnlace) return
    setEnviandoEnlace(true)
    try {
      const res = await fetch(`${API_URL}/api/academia/inscripciones/${selected.id_inscripcion}/enlace-agenda`, { method: 'POST', headers: { ...authHeaders } })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'No se pudo crear el enlace')
      setShowModalAgendar(false)
      const { url, emailEnviado } = json.data as { url: string; emailEnviado: boolean }
      const r = await Swal.fire({
        title: emailEnviado ? 'Enlace enviado' : 'Enlace creado',
        html: `${emailEnviado ? 'Se envió por correo al aspirante.' : 'El aspirante no tiene correo registrado; compártele el enlace.'}<br><br><code style="word-break:break-all;font-size:12px">${url}</code>`,
        showCancelButton: true, confirmButtonText: 'Copiar enlace', cancelButtonText: 'Cerrar', confirmButtonColor: '#059669',
      })
      if (r.isConfirmed) await navigator.clipboard.writeText(url).catch(() => {})
    } catch (e: any) {
      Swal.fire('Error', e.message || 'No se pudo crear el enlace', 'error')
    } finally {
      setEnviandoEnlace(false)
    }
  }

  const busyAgendarRef = useRef(false)
  const agendarEntrevista = async () => {
    if (!selected || busyAgendarRef.current || submittingAgendar) return
    busyAgendarRef.current = true
    setSubmittingAgendar(true)
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
      Swal.fire({
        title: '¡Cita Agendada!',
        text: 'La entrevista ha sido programada con éxito y el aspirante pasa a la etapa de Entrevista.',
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
      })
      await fetchData(true)
    } catch (e: any) {
      Swal.fire('Error', e.message || 'No se pudo agendar la entrevista', 'error')
    } finally {
      busyAgendarRef.current = false
      setSubmittingAgendar(false)
    }
  }

  const busyFinalizarRef = useRef(false)
  const finalizarEntrevista = async () => {
    if (!selected || busyFinalizarRef.current || submittingFinalizar) return
    busyFinalizarRef.current = true
    setSubmittingFinalizar(true)
    try {
      const res = await fetch(`${API_URL}/api/academia/inscripciones/${selected.id_inscripcion}/finalizar-entrevista`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          resultado: finalizarData.resultado,
          notaAdmin: finalizarData.nota
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'No se pudo finalizar')
      setShowModalFinalizar(false)
      await fetchData(true)
    } catch (e: any) {
      setError(e.message)
    } finally {
      busyFinalizarRef.current = false
      setSubmittingFinalizar(false)
    }
  }

  const handleVerReferencia = async (nombre: string) => {
    if (validatingRef) return
    setValidatingRef(nombre)
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
    } finally {
      setValidatingRef(null)
    }
  }

  const aprobarDirecto = async (id: number) => {
    if (processingAction) return
    setProcessingAction('aprobarDirecto')
    try {
      Swal.fire({
        title: 'Procesando...',
        text: 'Aprobando preinscripción y otorgando estatus de Afiliado...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
      })
      const res = await fetch(`${API_URL}/api/academia/inscripciones/${id}/aprobar-directo`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'No se pudo aprobar')

      Swal.fire({
        title: '¡Aprobación Exitosa!',
        text: 'El aspirante ha sido aprobado y registrado como Miembro Afiliado Oficial.',
        icon: 'success',
        timer: 2200,
        showConfirmButton: false
      })

      await fetchData(true)
    } catch (e: any) {
      Swal.fire({ title: 'Error', text: e.message || 'Error al aprobar', icon: 'error' })
    } finally {
      setProcessingAction(null)
    }
  }

  const remitirACibir = async (id: number) => {
    if (processingAction) return
    setProcessingAction('remitirCibir')
    try {
      Swal.fire({
        title: 'Procesando...',
        text: 'Remitiendo aspirante al programa CIBIR...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
      })
      const res = await fetch(`${API_URL}/api/academia/inscripciones/${id}/remitir-cibir`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
      })
      const json = await res.json()
      if (json.code === 'PAGO_CIBIR_REQUERIDO') {
        Swal.close()
        await ofrecerCobroCibir(json.message)
        return
      }
      if (!res.ok || !json.success) throw new Error(json.message || 'No se pudo remitir')

      Swal.fire({
        title: '¡Remitido a CIBIR!',
        text: 'El aspirante ha sido movido al estatus 5_CIBIR.',
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
      })

      await fetchData(true)
    } catch (e: any) {
      Swal.fire({ title: 'Error', text: e.message || 'Error al remitir', icon: 'error' })
    } finally {
      setProcessingAction(null)
    }
  }

  const cambiarEtapa = async (idInscripcion: number, etapa: number, labelEtapa: string) => {
    if (processingAction || changingEtapaStep !== null) return
    const result = await Swal.fire({
      title: `¿Mover a "${labelEtapa}"?`,
      text: 'El estado del trámite se actualizará manualmente. Esta acción puede enviar notificaciones al aspirante.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#059669',
      confirmButtonText: 'Sí, cambiar etapa',
      cancelButtonText: 'Cancelar'
    })
    if (!result.isConfirmed) return
    setChangingEtapaStep(etapa)
    setProcessingAction('cambiarEtapa')
    try {
      Swal.fire({
        title: 'Procesando...',
        text: 'Actualizando etapa del trámite...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
      })
      const res = await fetch(`${API_URL}/api/academia/inscripciones/${idInscripcion}/cambiar-etapa`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ etapa }),
      })
      const json = await res.json()
      if (json.code === 'PAGO_CIBIR_REQUERIDO') {
        Swal.close()
        await ofrecerCobroCibir(json.message)
        return
      }
      if (!res.ok || !json.success) throw new Error(json.message || 'No se pudo cambiar la etapa')

      Swal.fire({
        title: '¡Etapa Actualizada!',
        text: json.message || `El aspirante ha sido movido a ${labelEtapa}.`,
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
      })

      await fetchData(true)
    } catch (e: any) {
      Swal.fire({ title: 'Error', text: e.message, icon: 'error' })
    } finally {
      setChangingEtapaStep(null)
      setProcessingAction(null)
    }
  }

  const rechazar = async (id: number) => {
    if (processingAction) return
    setProcessingAction('rechazar')
    try {
      const res = await fetch(`${API_URL}/api/academia/inscripciones/${id}/rechazar`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ notaAdmin: '' }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'No se pudo rechazar')
      await fetchData(true)
    } catch (e: any) { setError(e.message) }
    finally {
      setProcessingAction(null)
    }
  }

  const eliminarSolicitud = async (id: number) => {
    if (processingAction) return
    const result = await Swal.fire({
      title: '¿Eliminar solicitud?',
      text: 'Esta acción es irreversible y borrará todos los datos del aspirante.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      confirmButtonText: 'Sí, borrar todo'
    })
    if (result.isConfirmed) {
      setProcessingAction('eliminar')
      try {
        const res = await fetch(`${API_URL}/api/academia/inscripciones/${id}`, {
          method: 'DELETE',
          headers: { ...authHeaders },
        })
        const json = await res.json()
        if (!res.ok || !json.success) throw new Error(json.message || 'Error al eliminar')
        setSelected(null)
        await fetchData(true)
      } catch (e: any) { Swal.fire({ title: 'Error', text: e.message, icon: 'error' }) }
      finally {
        setProcessingAction(null)
      }
    }
  }

  const reenviarEnlaceExpediente = async (id: number) => {
    if (processingAction) return
    const result = await Swal.fire({
      title: '¿Reenviar correo?',
      text: 'Se enviará un correo al aspirante y se reactivará su token para cargar el expediente.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#059669',
      confirmButtonText: 'Sí, reenviar correo'
    })
    if (result.isConfirmed) {
      setProcessingAction('reenviarEnlace')
      Swal.fire({
        title: 'Reenviando...',
        text: 'Por favor espera un momento.',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading()
        }
      })
      try {
        const res = await fetch(`${API_URL}/api/academia/inscripciones/${id}/reenviar-enlace`, {
          method: 'POST',
          headers: { ...authHeaders },
        })
        const json = await res.json()
        if (!res.ok || !json.success) throw new Error(json.message || 'Error al reenviar enlace')
        
        Swal.fire({
          title: '¡Enviado!',
          text: json.message || 'Enlace reenviado con éxito.',
          icon: 'success',
          confirmButtonColor: '#059669'
        })
      } catch (e: any) {
        Swal.fire({
          title: 'Error',
          text: e.message || 'Ocurrió un error al reenviar.',
          icon: 'error',
          confirmButtonColor: '#dc2626'
        })
      } finally {
        setProcessingAction(null)
      }
    }
  }

  // Filas acotadas por el programa seleccionado.
  // El servidor ya filtra por programa (CIBIR se pide como 'AFILIACION'). En CIBIR, la vía separa a quienes
  // cursan el CIBIR de quienes optan por acreditarse.
  const optaAcreditacion = (r: Row) => r.programa_codigo === 'AFILIACION' && !!r.apto_acreditacion
  const programaRows = useMemo(() => {
    if (programa !== 'CIBIR') return rows // con cohorte, el servidor ya trajo solo los de esa cohorte
    if (viaCibir === 'Acreditación') return rows.filter(optaAcreditacion)
    if (viaCibir === 'Curso') return rows.filter(r => !r.apto_acreditacion)
    return rows
  }, [rows, programa, viaCibir])

  const viaCounts = useMemo(() => ({
    Todas: rows.length,
    Curso: rows.filter(r => !r.apto_acreditacion).length,
    Acreditación: rows.filter(optaAcreditacion).length,
  }), [rows])

  // En la vía Acreditación, el dropdown de tipo de afiliado acota la base antes de contar por etapa
  const baseRows = useMemo(() => {
    if (!esAcred || !tipoAcredSel) return programaRows
    return programaRows.filter(r => tipoAcred(r.afiliado_tipo) === tipoAcredSel)
  }, [programaRows, esAcred, tipoAcredSel])

  const countsAcred = useMemo(() => {
    const c = Object.fromEntries(ETAPAS_ACRED.map(e => [e, 0])) as Record<EtapaAcred, number>
    c.Todas = baseRows.length
    baseRows.forEach(r => { c[etapaAcred(r)]++ })
    return c
  }, [baseRows])

  const counts = useMemo(() => {
    const base = baseRows

    const c = Object.fromEntries(UI_ESTATUS.map(e => [e, 0])) as Record<typeof UI_ESTATUS[number], number>
    c.Todos = base.length
    base.forEach(r => { const e = estadoUi(r); if (e) c[e]++ })
    return c
  }, [baseRows])

  const filteredRows = useMemo(() => {
    let result = baseRows

    // Filtro por sub-estado de expediente (la vía Acreditación usa sus propias etapas)
    if (esAcred) {
      if (etapaAcredSel !== 'Todas') result = result.filter(r => etapaAcred(r) === etapaAcredSel)
    } else if (uiEstatus !== 'Todos') {
      result = result.filter(r => estadoUi(r) === uiEstatus)
    }
    if (!search.trim()) return result
    return result.filter(r =>
      matchesSearch(
        [r.estudiante_nombre, r.estudiante_email, r.estudiante_cedula, r.empresa_vinculada_nombre],
        search
      )
    )
  }, [baseRows, search, uiEstatus, esAcred, etapaAcredSel])

  const getStatusLabelAndStyles = (estatus: Estatus, afiliadoEstatus?: string, numDocumentos: number = 1, completado?: unknown) => {
    // Si es un trámite de afiliación o tiene estatus en la tabla de afiliados, mostrar su etapa real
    if (afiliadoEstatus) {
      switch (afiliadoEstatus) {
        case '1_PREINSCRIPCION':
          return numDocumentos === 0
            ? { label: 'Sin Expediente', styles: 'bg-rose-50 text-rose-600 border-rose-200' }
            : { label: 'Preinscrito', styles: 'bg-amber-50 text-amber-700 border-amber-200' }
        case '2_EXPEDIENTE':
          return { label: 'Expediente', styles: 'bg-slate-100 text-slate-700 border-slate-200' }
        case '3_ENTREVISTA':
          return { label: 'Entrevista', styles: 'bg-purple-50 text-purple-700 border-purple-200' }
        case '4_VERIFICACION':
          return { label: 'Verificación', styles: 'bg-amber-50 text-amber-700 border-amber-200' }
        case '5_CIBIR':
          return { label: 'En CIBIR', styles: 'bg-indigo-50 text-indigo-700 border-indigo-200' }
        case '6_INSCRIPCION':
          return { label: 'Inscripción', styles: 'bg-sky-50 text-sky-700 border-sky-200' }
        case 'Afiliado':
          return { label: 'Afiliado Oficial', styles: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
        case 'Rechazado':
          return { label: 'Rechazado', styles: 'bg-red-50 text-red-600 border-red-200' }
        default:
          break
      }
    }
    if (estatus === 'Preinscrito') {
      if (numDocumentos === 0) {
        return { label: 'Sin Expediente', styles: 'bg-rose-50 text-rose-600 border-rose-200' }
      }
      return { label: 'Pendiente', styles: 'bg-amber-50 text-amber-700 border-amber-200' }
    }
    if (estatus === 'Entrevista') {
      return { label: 'Entrevista', styles: 'bg-purple-50 text-purple-700 border-purple-200' }
    }
    if (estatus === 'Inscrito') {
      return Number(completado) === 1
        ? { label: 'Aprobado', styles: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
        : { label: 'Inscrito', styles: 'bg-sky-50 text-sky-700 border-sky-200' }
    }
    if (estatus === 'Rechazado') {
      return { label: 'Rechazado', styles: 'bg-red-50 text-red-600 border-red-200' }
    }
    return { label: estatus, styles: 'bg-slate-100 text-slate-600 border-slate-200' }
  }

  return (
    <div className="flex flex-col h-full w-full overflow-hidden relative">
      <div className={selected ? 'hidden sm:block' : ''}>
        <AlturaSuave>
          {PROGRAMAS_CON_COHORTE.includes(programa) ? (
            <div key={programa} className={ENTRADA_FRANJA}>
              <CohortesNavegador
                programa={programa}
                cohortes={cohortesDelPrograma}
                seleccion={cohorteFiltro}
                onSeleccionar={seleccionarCohorte}
                onGestionar={() => setGestionandoCohortes(true)}
                onVolver={() => setPrograma('Todos')}
                cargando={loading}
              />
            </div>
          ) : cohortes.length > 0 ? (
            <div key="resumen" className={ENTRADA_FRANJA}>
              <CohortesPorPrograma cohortes={cohortes} onElegir={setPrograma} />
            </div>
          ) : null}
        </AlturaSuave>
      </div>
      {gestionandoCohortes && PROGRAMAS_CON_COHORTE.includes(programa) && (
        <GestionCohortesModal
          programa={programa}
          cohortes={cohortesDelPrograma}
          onCerrar={() => setGestionandoCohortes(false)}
          onNueva={nuevaCohorte}
          onCambiarEstado={cambiarEstadoCohorte}
        />
      )}
      <div className="relative flex-1 min-h-0">
      <div className="grid grid-cols-1 sm:grid-cols-[340px_1fr] grid-rows-1 h-full w-full overflow-hidden absolute inset-0">
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

          {(() => {
            const filtrosAcred = esAcred ? [
              { id: 'acred-tipo', etiqueta: 'Tipo de afiliado', ancho: '', valor: tipoAcredSel as string, cambiar: (v: string) => setTipoAcredSel(v as typeof tipoAcredSel),
                opciones: [{ valor: '', texto: 'Todos' }, ...TIPOS_ACRED.map(t => ({ valor: t as string, texto: t as string }))] },
            ] : []
            const campos = [
              ...(programa === 'CIBIR' ? [{ id: 'via-cibir', etiqueta: 'Acreditación', ancho: 'col-span-2', valor: viaCibir as string, cambiar: (v: string) => setViaCibir(v as typeof viaCibir),
                opciones: [
                  { valor: 'Todas', texto: `Todos (${viaCounts.Todas})` },
                  { valor: 'Curso', texto: `No optan por acreditación (${viaCounts.Curso})` },
                  { valor: 'Acreditación', texto: `Optan por acreditación (${viaCounts.Acreditación})` },
                ] }] : []),
              esAcred
                ? { id: 'acred-etapa', etiqueta: 'Etapa del trámite', ancho: 'col-span-2', valor: etapaAcredSel as string, cambiar: (v: string) => setEtapaAcredSel(v as EtapaAcred),
                    opciones: ETAPAS_ACRED.map(e => ({ valor: e as string, texto: `${e === 'Todas' ? 'Todas las etapas' : e} (${countsAcred[e]})` })) }
                : { id: 'estado-lista', etiqueta: 'Estado', ancho: 'col-span-2', valor: uiEstatus as string, cambiar: (v: string) => setUiEstatus(v as UiEstatus),
                    opciones: UI_ESTATUS.map(e => ({ valor: e as string, texto: `${e === 'Todos' ? 'Todos los estados' : e} (${counts[e] || 0})` })) },
              ...filtrosAcred,
            ]
            const hayFiltro = viaCibir !== 'Todas' || (esAcred ? etapaAcredSel !== 'Todas' || !!tipoAcredSel : uiEstatus !== 'Todos')
            return (
            <div className="grid grid-cols-2 gap-x-2 gap-y-2.5 pt-1">
              {campos.map(f => (
                <div key={f.id} className={`flex flex-col gap-1 min-w-0 ${f.ancho}`}>
                  <label htmlFor={f.id} className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{f.etiqueta}</label>
                  <select
                    id={f.id}
                    value={f.valor}
                    onChange={e => f.cambiar(e.target.value)}
                    className={`w-full min-h-9 px-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${
                      f.valor && f.valor !== 'Todas' && f.valor !== 'Todos' ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-gray-200 bg-white text-slate-600'
                    }`}
                  >
                    {f.opciones.map(o => <option key={o.valor} value={o.valor}>{o.texto}</option>)}
                  </select>
                </div>
              ))}
              {hayFiltro && (
                <button
                  type="button"
                  onClick={() => { setEtapaAcredSel('Todas'); setTipoAcredSel(''); setUiEstatus('Todos'); setViaCibir('Todas') }}
                  className="col-span-2 self-start text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
            )
          })()}

        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {loading ? (
            <div aria-busy="true" className="divide-y divide-gray-50">
              <span className="sr-only" role="status">Cargando inscritos…</span>
              {Array.from({ length: 7 }, (_, i) => (
                <div key={i} aria-hidden="true" className="flex flex-col gap-2 px-4 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="h-4 rounded bg-slate-100 motion-safe:animate-pulse" style={{ width: `${48 + ((i * 17) % 32)}%` }} />
                    <div className="h-4 w-20 rounded-full bg-slate-100 motion-safe:animate-pulse" />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-14 rounded bg-slate-100 motion-safe:animate-pulse" />
                    <div className="h-3 w-28 rounded bg-slate-100 motion-safe:animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="p-4 text-center text-xs text-red-500 mt-10">{error}</div>
          ) : filteredRows.length === 0 ? (
            <div role="status" className="p-4 text-center text-xs text-slate-400 mt-10">
              {cohorteFiltro !== null && programaRows.length === 0
                ? 'Esta cohorte aún no tiene inscritos. Si está abierta, las nuevas inscripciones del programa entrarán aquí.'
                : 'No hay registros.'}
            </div>
          ) : (
            filteredRows.map((r, i) => {
              const statusObj = getStatusLabelAndStyles(r.estatus, r.afiliado_estatus, r.num_documentos, r.completado)
              const isSelected = selected?.id_inscripcion === r.id_inscripcion

              // Tipo descriptivo limpio
              const tipoLabel = r.programa_codigo === 'AFILIACION' && r.afiliado_tipo
                ? (r.afiliado_tipo === 'Corporativo' ? 'Corporativo' :
                   r.afiliado_tipo === 'Agente Corporativo' || r.afiliado_tipo === 'Agente' ? 'Agente Corp.' :
                   'Agente Indep.')
                : (r.programa_codigo || null)

              // Meta parts separados por punto medio
              const metaParts = [
                r.estudiante_cedula || null,
                tipoLabel,
                r.empresa_vinculada_nombre || null,
                r.edicion_cibir_nombre ? `Ed. ${r.edicion_cibir_nombre}` : null,
                r.cohorte_numero ? `Cohorte ${r.cohorte_numero}` : null
              ].filter(Boolean)

              return (
                <button
                  key={r.id_inscripcion}
                  onClick={() => { setSelected(r); fetchDocumentos(r.id_estudiante) }}
                  style={i < 12 ? { animationDelay: `${i * 30}ms` } : undefined}
                  className={[
                    'w-full text-left px-4 py-3 transition-colors flex flex-col gap-1 cursor-pointer border-b border-gray-100/60',
                    isSelected ? 'bg-emerald-50/80 border-l-4 border-l-[#00D084]' : 'hover:bg-slate-50/80',
                    i < 12 ? ENTRADA_FILA : '',
                  ].join(' ')}
                >
                  {/* Línea 1: Nombre + Opta icon + Estado único (dot) */}
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-xs font-bold flex items-center gap-1.5 truncate flex-1 ${
                      isSelected ? 'text-emerald-900' : 'text-slate-800'
                    }`}>
                      <span className="truncate">{formatNombreCard(r.estudiante_nombres, r.estudiante_apellidos)}</span>
                      {!!r.apto_acreditacion && (
                        <span
                          title="Opta por Acreditación"
                          className="text-emerald-600 text-xs font-bold shrink-0"
                        >
                          ✦
                        </span>
                      )}
                    </span>

                    {/* Indicador de Estado Único */}
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${statusObj.styles}`}>
                      {statusObj.label}
                    </span>
                  </div>

                  {/* Línea 2: Meta en texto gris discreto */}
                  <p className="text-[11px] text-slate-400 font-medium truncate">
                    {metaParts.length > 0 ? metaParts.join(' · ') : 'Sin datos adicionales'}
                  </p>
                </button>
              )
            })
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
                    {selected.estudiante_nombres?.charAt(0) && selected.estudiante_apellidos?.charAt(0) ? `${selected.estudiante_nombres.charAt(0)}${selected.estudiante_apellidos.charAt(0)}` : ''}
                  </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-black text-slate-900 leading-tight uppercase">
                    {formatNombreCard(selected.estudiante_nombres, selected.estudiante_apellidos)}
                  </h3>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{selected.estudiante_cedula || 'S/D'}</p>
                  {selected.afiliado_estatus === 'Afiliado' && (
                    <span className="inline-block text-[9px] font-black px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-tight">
                      Miembro Afiliado
                    </span>
                  )}
                </div>
                {selected.programa_codigo === 'AFILIACION' && !!selected.apto_acreditacion && (
                  <span className="inline-block text-[10px] font-black px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-100 mt-1 uppercase tracking-tighter">
                    Opta por Acreditación
                  </span>
                )}
              </div>
              <div className="flex flex-col items-end gap-1">
                {(() => {
                  const statusObj = getStatusLabelAndStyles(selected.estatus, selected.afiliado_estatus, selected.num_documentos, selected.completado)
                  return (
                    <span className={`text-[10px] font-black px-3 py-1.5 rounded-full border uppercase tracking-wider ${statusObj.styles}`}>
                      {statusObj.label}
                    </span>
                  )
                })()}
                <span className="inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-300/80 uppercase tracking-wider shadow-2xs mt-1">
                  <GraduationCap size={11} className="text-emerald-700 shrink-0" />
                  {selected.programa_codigo === 'AFILIACION' && selected.afiliado_tipo ? selected.afiliado_tipo : selected.programa_codigo}
                </span>
              </div>
            </div>

            {PROGRAMAS_CON_COHORTE.includes(selected.programa_codigo) && (
              <label className="bg-white rounded-2xl px-4 py-3 border border-gray-100 flex items-center gap-3 flex-wrap mb-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cohorte</span>
                <select
                  value={selected.id_cohorte ?? ''}
                  disabled={savingCohorte}
                  onChange={e => cambiarCohorte(selected, e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-slate-700 text-xs font-bold disabled:opacity-60"
                >
                  <option value="">Sin cohorte</option>
                  {cohortes.filter(c => c.programa_codigo === selected.programa_codigo).map(c => (
                    <option key={c.id_cohorte} value={c.id_cohorte}>{c.nombre}{c.estado === 'Abierta' ? ' (abierta)' : ''}</option>
                  ))}
                </select>
              </label>
            )}

            {/* Cobros de caja de esta persona: se registran aquí, sin ir a Finanzas */}
            {(() => {
              const r = selected
              const enCurso = ['Preinscrito', 'Entrevista', 'Inscrito'].includes(r.estatus)
              const items: { clave: 'formalizacion_afiliacion' | 'curso_cibir' | 'programa'; etiqueta: string; detalle: string; pagado: boolean; disponible: boolean }[] = []
              if (r.programa_codigo === 'AFILIACION' && r.id_afiliado && r.afiliado_estatus === '6_INSCRIPCION') {
                items.push({ clave: 'formalizacion_afiliacion', etiqueta: 'Formalización de afiliación', detalle: 'Inscripción + primera cuota. Al cobrarla pasa a Afiliado.', pagado: false, disponible: true })
              }
              const cibirAplica = !r.cibir_acreditado && (
                (r.programa_codigo === 'AFILIACION' && ['4_VERIFICACION', '5_CIBIR', '6_INSCRIPCION'].includes(r.afiliado_estatus || '')) ||
                // quien opta por acreditación puede pagar el arancel antes de ser remitido a CIBIR
                (r.programa_codigo === 'AFILIACION' && !!r.apto_acreditacion && enCurso) ||
                (r.programa_codigo === 'CIBIR' && enCurso && Number(r.completado) !== 1))
              if (cibirAplica && r.id_afiliado) {
                items.push({ clave: 'curso_cibir', etiqueta: 'Arancel CIBIR', detalle: 'Se exige para pasar a la etapa CIBIR.', pagado: !!r.pago_cibir, disponible: true })
              }
              if (['PREANI', 'PEGI', 'PADI'].includes(r.programa_codigo) && enCurso) {
                items.push({ clave: 'programa', etiqueta: `Arancel ${r.programa_codigo}`, detalle: 'Se cobra a la persona inscrita al programa.', pagado: !!r.pago_programa, disponible: true })
              }
              if (items.length === 0) return null
              return (
                <div className="bg-white rounded-2xl px-4 py-3 border border-gray-100 mb-4 space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Cobros</span>
                  {items.map(it => (
                    <div key={it.clave} className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800">{it.etiqueta}</p>
                        <p className="text-[11px] text-slate-500 font-medium">{it.detalle}</p>
                      </div>
                      {it.pagado ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <Check size={11} aria-hidden="true" /> Pagado
                        </span>
                      ) : (
                        <button type="button" onClick={() => setCobro(it.clave)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2">
                          <CreditCard size={12} aria-hidden="true" /> Registrar cobro
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )
            })()}

            {/* Stepper de Progreso */}
            {(selected.programa_codigo === 'AFILIACION' || selected.afiliado_estatus === '5_CIBIR') && (() => {
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
                  case 'Preinscrito': return 0;
                  case 'Entrevista': return 2;
                  case 'Inscrito': return 5;
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
                    <div className="absolute left-6 top-[24px] h-0.5 bg-emerald-500 -z-0 transition-colors duration-500" style={{ width: `calc(${(activeIndex / 6) * 100}% - 12px)` }} />
                    {AFILIACION_STEPS_FLOW.map((step, idx) => {
                      const isCompleted = idx < activeIndex;
                      const isCurrent = idx === activeIndex;
                      const isChangingThis = changingEtapaStep === idx;
                      const isClickable = !isCurrent && changingEtapaStep === null && processingAction === null;
                      const StepIcon = step.icon;
                      return (
                        <div
                          key={step.label}
                          className={`flex flex-col items-center relative z-10 gap-1.5 group ${isClickable ? 'cursor-pointer' : 'cursor-default'} ${(changingEtapaStep !== null || processingAction !== null) ? 'pointer-events-none' : ''}`}
                          title={isClickable ? `Mover a: ${step.label}` : step.label}
                          onClick={isClickable ? () => cambiarEtapa(selected.id_inscripcion, idx, step.label) : undefined}
                        >
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors transition-transform
                            ${isChangingThis
                              ? 'bg-emerald-100 ring-4 ring-emerald-200 scale-110'
                              : isCompleted
                                ? 'bg-emerald-500 text-white group-hover:bg-emerald-400 group-hover:scale-110'
                                : isCurrent
                                  ? 'bg-emerald-600 text-white ring-4 ring-emerald-100 scale-110'
                                  : 'bg-white text-slate-300 border-2 border-slate-100 group-hover:border-emerald-300 group-hover:text-emerald-400 group-hover:scale-110'
                            }`}>
                            {isChangingThis ? (
                              <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                            ) : isCompleted ? (
                              <Check className="w-4 h-4" strokeWidth={3} />
                            ) : (
                              <StepIcon className="w-4 h-4" />
                            )}
                          </div>
                          <span className={`text-[8px] font-black tracking-tighter uppercase transition-colors
                            ${isChangingThis ? 'text-emerald-600 font-bold' : isCurrent ? 'text-emerald-600' : isCompleted ? 'text-emerald-400 group-hover:text-emerald-500' : 'text-slate-300 group-hover:text-emerald-400'}`}>
                            {step.labelShort}
                          </span>
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
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Nombres</span>
                  <span className="text-sm text-slate-700 font-medium break-all">{selected.estudiante_nombres || 'No indicado'}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Apellidos</span>
                  <span className="text-sm text-slate-700 font-medium break-all">{selected.estudiante_apellidos || 'No indicado'}</span>
                </div>
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
                  <span className="text-sm text-slate-700 font-medium break-all">{formatDateLatina(selected.creado_en)}</span>
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
                      <a href={doc.url} target="_blank" rel="noopener noreferrer" title={doc.nombre_archivo ?? undefined} className="flex items-center gap-3 flex-1 min-w-0 hover:text-emerald-600 transition-colors">
                        <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="text-xs font-bold truncate">{etiquetaDocumento(doc.tipo_doc)}</span>
                      </a>
                      {['referencia_afiliado_1', 'referencia_afiliado_2'].includes(doc.tipo_doc) && doc.nombre_archivo && (
                        <button 
                          onClick={() => handleVerReferencia(doc.nombre_archivo!)}
                          disabled={validatingRef !== null}
                          className="ml-2 px-2 py-1 rounded-lg bg-white border border-slate-200 text-[9px] font-black text-slate-500 hover:bg-slate-50 uppercase tracking-tighter disabled:opacity-50 disabled:pointer-events-none flex items-center gap-1"
                        >
                          {validatingRef === doc.nombre_archivo ? (
                            <>
                              <Loader2 className="w-2.5 h-2.5 animate-spin text-slate-500" />
                              <span>Validando...</span>
                            </>
                          ) : (
                            'Validar Afiliado'
                          )}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Acciones */}
            {selected.afiliado_estatus === 'Afiliado' ? (
              <div className="bg-emerald-50/80 rounded-2xl p-4 border border-emerald-100 flex items-center gap-3 mb-4">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-emerald-900">Aspirante Afiliado Acreditado</span>
                  <span className="text-[10px] text-emerald-700 font-medium">Este aspirante ya cuenta con estatus de Afiliado activo y su proceso académico/CIBIR ha sido culminado con éxito.</span>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-5 border border-gray-100 flex flex-col gap-3 mb-4">
                {selected.estatus === 'Preinscrito' && selected.afiliado_estatus !== '5_CIBIR' && (
                  <div className="w-full">
                    {selected.num_documentos && selected.num_documentos > 0 ? (
                      <>
                        <div className="flex gap-2">
                          {selected.programa_codigo === 'AFILIACION' ? (
                            <>
                              {selected.apto_acreditacion ? (
                                <>
                                  <button 
                                    onClick={() => aprobarDirecto(selected.id_inscripcion)} 
                                    disabled={processingAction !== null}
                                    className="flex-1 py-3 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-1.5"
                                  >
                                    {processingAction === 'aprobarDirecto' ? (
                                      <>
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        <span>Aprobando...</span>
                                      </>
                                    ) : (
                                      'Aprobar Acreditación y Afiliar'
                                    )}
                                  </button>
                                  <button 
                                    onClick={() => remitirACibir(selected.id_inscripcion)} 
                                    disabled={processingAction !== null}
                                    className="flex-1 py-3 rounded-xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-200 hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-1.5"
                                  >
                                    {processingAction === 'remitirCibir' ? (
                                      <>
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        <span>Remitiendo...</span>
                                      </>
                                    ) : (
                                      'Remitir a CIBIR'
                                    )}
                                  </button>
                                </>
                              ) : (
                                <button 
                                  onClick={() => remitirACibir(selected.id_inscripcion)} 
                                  disabled={processingAction !== null}
                                  className="flex-1 py-3 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-1.5"
                                >
                                  {processingAction === 'remitirCibir' ? (
                                    <>
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      <span>Remitiendo...</span>
                                    </>
                                  ) : (
                                    'Remitir a CIBIR'
                                  )}
                                </button>
                              )}
                              <button 
                                onClick={() => setShowModalAgendar(true)} 
                                disabled={processingAction !== null}
                                className="flex-1 py-3 rounded-xl bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 transition-colors disabled:opacity-50 disabled:pointer-events-none"
                              >
                                Agendar Cita
                              </button>
                            </>
                          ) : (
                            <button 
                              onClick={() => aprobarDirecto(selected.id_inscripcion)} 
                              disabled={processingAction !== null}
                              className="flex-1 py-3 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-1.5"
                            >
                              {processingAction === 'aprobarDirecto' ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  <span>Aprobando...</span>
                                </>
                              ) : (
                                'Aprobar y Afiliar'
                              )}
                            </button>
                          )}
                          <button 
                            onClick={() => rechazar(selected.id_inscripcion)} 
                            disabled={processingAction !== null}
                            className="px-4 py-3 rounded-xl bg-red-50 text-red-600 text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-colors disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-1.5"
                          >
                            {processingAction === 'rechazar' ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-red-600" />
                                <span>Rechazando...</span>
                              </>
                            ) : (
                              'Rechazar'
                            )}
                          </button>
                        </div>
                        <button 
                          onClick={() => reenviarEnlaceExpediente(selected.id_inscripcion)} 
                          disabled={processingAction !== null}
                          className="w-full mt-2 py-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 disabled:pointer-events-none"
                        >
                          {processingAction === 'reenviarEnlace' ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
                              <span>Reenviando...</span>
                            </>
                          ) : (
                            <>
                              <Mail className="w-3.5 h-3.5" />
                              Reenviar Enlace de Expediente
                            </>
                          )}
                        </button>
                      </>
                    ) : (
                      <div className="flex gap-2 w-full">
                        <button 
                          onClick={() => reenviarEnlaceExpediente(selected.id_inscripcion)} 
                          disabled={processingAction !== null}
                          className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 disabled:pointer-events-none"
                        >
                          {processingAction === 'reenviarEnlace' ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
                              <span>Reenviando...</span>
                            </>
                          ) : (
                            <>
                              <Mail className="w-3.5 h-3.5" />
                              Reenviar Enlace
                            </>
                          )}
                        </button>
                        <button 
                          onClick={() => rechazar(selected.id_inscripcion)} 
                          disabled={processingAction !== null}
                          className="px-4 py-3 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-[10px] font-black uppercase tracking-widest transition-colors disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-1.5"
                        >
                          {processingAction === 'rechazar' ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-red-600" />
                              <span>Rechazando...</span>
                            </>
                          ) : (
                            'Rechazar'
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {selected.estatus === 'Entrevista' && (
                  <div className="flex flex-col gap-3">
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-xs font-bold text-emerald-700">Entrevista: {formatDateLatina(selected.entrevista_fecha)} @ {selected.entrevista_hora}</div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setShowModalFinalizar(true)} 
                        disabled={processingAction !== null}
                        className="flex-1 py-3 rounded-xl bg-[#00D084] text-white text-[10px] font-black uppercase tracking-widest hover:bg-[#00B870] transition-colors disabled:opacity-50 disabled:pointer-events-none"
                      >
                        Dar Veredicto
                      </button>
                      <button 
                        onClick={() => setShowModalAgendar(true)} 
                        disabled={processingAction !== null}
                        className="px-4 py-3 rounded-xl border border-slate-200 text-slate-500 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:pointer-events-none"
                      >
                        Reprogramar
                      </button>
                    </div>
                  </div>
                )}

                {selected.afiliado_estatus === '5_CIBIR' && (
                  <div className="flex flex-col gap-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Acciones de CIBIR</span>
                    <button
                      onClick={handleAprobarEtapaCibir}
                      disabled={processingAction !== null}
                      className="w-full py-3 rounded-xl bg-[#00D084] hover:bg-[#00B870] text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-200 transition-colors transition-transform active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:pointer-events-none"
                    >
                      {processingAction === 'aprobarCibir' ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Aprobando y Afiliando...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" strokeWidth={3} />
                          Aprobar CIBIR y Afiliar
                        </>
                      )}
                    </button>
                  </div>
                )}

                {(() => {
                  // Ya aprobado: lo único que falta es cobrar (mismo modal que el bloque de Cobros)
                  const r = selected
                  const clave = r.estatus !== 'Inscrito' ? null
                    : r.programa_codigo === 'AFILIACION' && r.id_afiliado && r.afiliado_estatus === '6_INSCRIPCION' ? 'formalizacion_afiliacion' as const
                    : ['PREANI', 'PEGI', 'PADI'].includes(r.programa_codigo) && !r.pago_programa && Number(r.completado) !== 1 ? 'programa' as const
                    : null
                  if (!clave) return null
                  return (
                    <div className="flex flex-col gap-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {clave === 'programa' ? `Arancel ${r.programa_codigo} pendiente` : 'Formalización pendiente'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCobro(clave)}
                        className="w-full py-3 rounded-xl bg-[#00D084] hover:bg-[#00B870] text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-200 transition-colors transition-transform active:scale-95 flex items-center justify-center gap-1.5"
                      >
                        <CreditCard size={14} aria-hidden="true" />
                        {clave === 'programa' ? 'Registrar cobro' : 'Cobrar y formalizar'}
                      </button>
                    </div>
                  )
                })()}

              </div>
            )}

            <button 
              onClick={() => eliminarSolicitud(selected.id_inscripcion)} 
              disabled={processingAction !== null}
              className="w-full mt-4 py-3 rounded-xl text-[9px] font-black text-red-300 hover:text-red-500 uppercase tracking-widest transition-colors disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-1.5"
            >
              {processingAction === 'eliminar' ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin text-red-400" />
                  <span>Eliminando...</span>
                </>
              ) : (
                'Eliminar Solicitud del Sistema'
              )}
            </button>
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
            <div className="grid grid-cols-2 gap-1 p-1 mb-4 rounded-xl bg-slate-100">
              {([['enlace', 'Que elija'], ['manual', 'Fijar a mano']] as const).map(([modo, texto]) => (
                <button key={modo} type="button" aria-pressed={modoAgenda === modo} onClick={() => setModoAgenda(modo)}
                  className={`py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors ${modoAgenda === modo ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500 hover:text-slate-700'}`}>
                  {texto}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-4">
              {modoAgenda === 'enlace' ? (
                <>
                  <p className="text-xs text-slate-600">Se envía un enlace al aspirante para que elija uno de tus horarios disponibles. La entrevista será por Google Meet.</p>
                  <button type="button" onClick={enviarEnlaceAgenda} disabled={enviandoEnlace}
                    className="w-full py-3 rounded-xl bg-emerald-600 text-white font-black uppercase text-xs tracking-widest hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2">
                    {enviandoEnlace ? <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /><span>Creando enlace…</span></> : 'Enviar enlace'}
                  </button>
                  <button type="button" onClick={() => setShowDisponibilidad(true)} className="w-full text-emerald-700 font-bold uppercase text-[10px] hover:underline">
                    Mi disponibilidad
                  </button>
                </>
              ) : (
                <>
              <input type="date" value={entrevista.fecha} onChange={e => setEntrevista({ ...entrevista, fecha: e.target.value })} className="w-full p-3 rounded-xl bg-slate-50 border border-slate-100 text-sm" />
              <input type="time" value={entrevista.hora} onChange={e => setEntrevista({ ...entrevista, hora: e.target.value })} className="w-full p-3 rounded-xl bg-slate-50 border border-slate-100 text-sm" />
              <input type="text" value={entrevista.lugar} onChange={e => setEntrevista({ ...entrevista, lugar: e.target.value })} className="w-full p-3 rounded-xl bg-slate-50 border border-slate-100 text-sm" placeholder="Lugar..." />
              <button 
                onClick={agendarEntrevista} 
                disabled={submittingAgendar}
                className="w-full py-3 rounded-xl bg-emerald-600 text-white font-black uppercase text-xs tracking-widest hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
              >
                {submittingAgendar ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Guardando Cita...</span>
                  </>
                ) : (
                  'Confirmar Cita'
                )}
              </button>
                </>
              )}
              <button 
                onClick={() => setShowModalAgendar(false)} 
                disabled={submittingAgendar}
                className="w-full text-slate-400 font-bold uppercase text-[10px] hover:text-slate-600 transition-colors disabled:opacity-50 disabled:pointer-events-none"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {showDisponibilidad && <DisponibilidadEntrevistasModal onCerrar={() => setShowDisponibilidad(false)} authHeaders={authHeaders} />}

      {/* Modal Finalizar */}
      {cobro && selected && (
        <ModalCobroTaquilla
          open
          onClose={() => setCobro(null)}
          onSuccess={(pago) => { setCobro(null); abrirRecibo(pago); fetchData(true) }}
          afiliadoId={selected.id_afiliado ?? null}
          afiliadoNombre={formatNombreCard(selected.estudiante_nombres, selected.estudiante_apellidos)}
          afiliadoTipo={selected.afiliado_tipo ?? undefined}
          conceptoDefault={cobro === 'programa' ? 'programa' : cobro}
          programaPorCobrar={cobro === 'programa'
            ? { id_estudiante: selected.id_estudiante, codigo_arancel: `programa_${selected.programa_codigo.toLowerCase()}`, nombre: selected.programa_codigo }
            : null}
          authHeaders={authHeaders}
        />
      )}
      <ReciboDigitalModal pago={reciboPago} onClose={() => setReciboPago(null)} />

      {showModalFinalizar && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl p-6">
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-6">Veredicto Administrativo</h3>
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-3 gap-2">
                {(['Aprobado', 'Parcial', 'Rechazado'] as const).map(res => (
                  <button key={res} onClick={() => setFinalizarData({ ...finalizarData, resultado: res })} className={`py-3 rounded-xl text-[10px] font-black uppercase border transition-colors ${finalizarData.resultado === res ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white text-slate-400 border-slate-100'}`}>{res}</button>
                ))}
              </div>
              <textarea value={finalizarData.nota} onChange={e => setFinalizarData({ ...finalizarData, nota: e.target.value })} className="w-full p-4 rounded-xl bg-slate-50 border border-slate-100 text-sm min-h-[100px]" placeholder="Notas internas..." />
              <button 
                onClick={finalizarEntrevista} 
                disabled={submittingFinalizar}
                className="w-full py-4 rounded-xl bg-slate-900 text-white font-black uppercase text-xs tracking-widest hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
              >
                {submittingFinalizar ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Procesando Veredicto...</span>
                  </>
                ) : (
                  'Finalizar y Notificar'
                )}
              </button>
              <button 
                onClick={() => setShowModalFinalizar(false)} 
                disabled={submittingFinalizar}
                className="w-full text-slate-400 font-bold uppercase text-[10px] hover:text-slate-600 transition-colors disabled:opacity-50 disabled:pointer-events-none"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  </div>
)
}


function ChevronDown({ className }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6" /></svg>
}
