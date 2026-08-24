import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { API_URL } from '@/config/env'
import { useAuth } from '@/context/AuthContext'
import { ClipboardList, FileText, Calendar, ShieldCheck, GraduationCap, CreditCard, Check, User, Search, Building2, CheckCircle2, Award, Clock, Mail } from 'lucide-react'
import Swal from 'sweetalert2'
import AfiliadosPanel from '@/pages/admin/components/Afiliados/AfiliadosPanel'
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
  cibir_acreditado?: number | boolean | null
  completado?: number
  num_modulos?: number
  modulos_aprobados?: number
  num_documentos?: number
}

export default function PreinscripcionesPrincipalesPanel({
  initialPrograma = 'Todos'
}: {
  initialPrograma?: ProgramaCodigo | 'Todos'
}) {
  const { token } = useAuth()
  const [programa, setPrograma] = useState<ProgramaCodigo | 'Todos'>(initialPrograma)
  type UiEstatus = 'Todos' | 'Pendiente' | 'Sin Expediente' | 'Entrevista' | 'Inscripción' | 'Rechazado'
  const [uiEstatus, setUiEstatus] = useState<UiEstatus>('Pendiente')
  const [search, setSearch] = useState('')
  const [filtroAcreditacion, setFiltroAcreditacion] = useState<'todos' | 'apto' | 'no_apto'>('todos')
  const [showProgramaDropdown, setShowProgramaDropdown] = useState(false)
  const [showAcreditacionDropdown, setShowAcreditacionDropdown] = useState(false)
  const [rows, setRows] = useState<Row[]>([])
  const [counts, setCounts] = useState({ Todos: 0, Pendiente: 0, 'Sin Expediente': 0, Entrevista: 0, Inscripción: 0, Rechazado: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Row | null>(null)
  const [documentos, setDocumentos] = useState<{ id_documento: number; tipo_doc: string; url: string; nombre_archivo: string | null }[]>([])
  const [loadingDocs, setLoadingDocs] = useState(false)
  const [toggleLoading, setToggleLoading] = useState(false)

  // CIBIR Module states
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
  const [completing, setCompleting] = useState(false)

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

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const qs = new URLSearchParams()
      if (uiEstatus !== 'Todos') {
        if (uiEstatus === 'Pendiente') {
          qs.set('estatus', 'Preinscrito')
          qs.set('conExpediente', 'true')
        } else if (uiEstatus === 'Sin Expediente') {
          qs.set('estatus', 'Preinscrito')
          qs.set('conExpediente', 'false')
        } else if (uiEstatus === 'Inscripción') {
          qs.set('estatus', 'Inscrito')
        } else {
          qs.set('estatus', uiEstatus)
        }
      }

      if (programa !== 'Todos') qs.set('programaCodigo', programa)

      const res = await fetch(`${API_URL}/api/academia/preinscripciones?${qs.toString()}`, {
        headers: { ...authHeaders },
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'Error cargando preinscripciones')

      const data = json.data as Row[]
      
      // Calcular dinámicamente los contadores de expediente vacío
      const preinscritosCount = data.filter(r => r.estatus === 'Preinscrito').length
      const sinExpedienteCount = data.filter(r => r.estatus === 'Preinscrito' && (r.num_documentos === 0 || !r.num_documentos)).length
      const conExpedienteCount = preinscritosCount - sinExpedienteCount

      setRows(data)

      if (json.meta && json.meta.counts) {
        setCounts({
          Todos: json.meta.counts.Todos || 0,
          Pendiente: conExpedienteCount,
          'Sin Expediente': sinExpedienteCount,
          Entrevista: json.meta.counts.Entrevista || 0,
          Inscripción: json.meta.counts.Aprobado || 0,
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
  }, [uiEstatus, programa, authHeaders, selected, fetchDocumentos])

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
        text: `Esto marcará todos los módulos como "Aprobado" y completará la formación académica de ${selected.estudiante_nombre} automáticamente.`,
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
        text: 'Aprobando todos los módulos',
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
        text: 'Todos los módulos han sido aprobados.',
        icon: 'success',
        timer: 2500,
        showConfirmButton: false
      })
      await fetchData()
      if (selected) {
        await fetchModulos(selected.id_inscripcion)
      }
    } catch (e: any) {
      Swal.fire('Error', e.message || 'Ocurrió un error al procesar los módulos', 'error')
    } finally {
      setCompleting(false)
      busyAprobarTodosRef.current = false
    }
  }

  const handleAprobarEtapaCibir = async () => {
    if (!selected) return

    const result = await Swal.fire({
      title: '¿Aprobar CIBIR y Afiliar?',
      text: `Esto aprobará todos los módulos del Programa CIBIR y moverá a ${selected.estudiante_nombre} a la etapa de Afiliado.`,
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
        text: 'Aprobando todos los módulos y cambiando etapa...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
      })

      // 1. Aprobar todos los módulos
      const resModulos = await fetch(`${API_URL}/api/academia/inscripciones/${selected.id_inscripcion}/modulos/aprobar-todos`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders }
      })
      const jsonModulos = await resModulos.json()
      if (!resModulos.ok || !jsonModulos.success) throw new Error(jsonModulos.message || 'No se pudieron aprobar los módulos')

      // 2. Cambiar a etapa de Afiliación (6)
      const resEtapa = await fetch(`${API_URL}/api/academia/inscripciones/${selected.id_inscripcion}/cambiar-etapa`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ etapa: 6 }),
      })
      const jsonEtapa = await resEtapa.json()
      if (!resEtapa.ok || !jsonEtapa.success) throw new Error(jsonEtapa.message || 'No se pudo cambiar la etapa')

      Swal.fire({
        title: '¡CIBIR Aprobado!',
        text: 'Todos los módulos han sido aprobados y el aspirante ha sido afiliado.',
        icon: 'success',
        timer: 2500,
        showConfirmButton: false
      })

      await fetchData()
    } catch (e: any) {
      Swal.fire('Error', e.message || 'No se pudo completar la aprobación de CIBIR', 'error')
    }
  }

  useEffect(() => {
    let active = true
    if (selected) {
      const isCibir = selected.programa_codigo === 'CIBIR' || (selected.programa_codigo === 'AFILIACION' && selected.afiliado_estatus === '5_CIBIR')
      if (isCibir) {
        setLoadingModulos(true)
        apiFetch(`${API_URL}/api/academia/inscripciones/${selected.id_inscripcion}/modulos`, { headers: { ...authHeaders } })
          .then(json => {
            if (active && json.success) setModulos(json.data)
          })
          .catch(() => {})
          .finally(() => {
            if (active) setLoadingModulos(false)
          })
      } else {
        setModulos([])
      }
    } else {
      setModulos([])
    }
    return () => { active = false }
  }, [selected, authHeaders])

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const qs = new URLSearchParams()
        if (uiEstatus !== 'Todos') qs.set('uiEstatus', uiEstatus)
        if (programa !== 'Todos') qs.set('programa', programa)

        const json = await apiFetch(`${API_URL}/api/academia/preinscripciones?${qs.toString()}`, {
          headers: { ...authHeaders },
        })
        if (!active) return
        if (!json.success) throw new Error(json.message || 'Error cargando inscripciones')

        setRows(json.data as Row[])
      } catch (e: any) {
        if (!active) return
        setError(e.message || 'Error inesperado')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [uiEstatus, programa, authHeaders])

  const busyAgendarRef = useRef(false)
  const agendarEntrevista = async () => {
    if (!selected || busyAgendarRef.current) return
    busyAgendarRef.current = true
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
    } finally {
      busyAgendarRef.current = false
    }
  }

  const busyFinalizarRef = useRef(false)
  const finalizarEntrevista = async () => {
    if (!selected || busyFinalizarRef.current) return
    busyFinalizarRef.current = true
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
    } finally {
      busyFinalizarRef.current = false
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

      await fetchData()
    } catch (e: any) {
      Swal.fire({ title: 'Error', text: e.message || 'Error al aprobar', icon: 'error' })
    }
  }

  const remitirACibir = async (id: number) => {
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
      if (!res.ok || !json.success) throw new Error(json.message || 'No se pudo remitir')

      Swal.fire({
        title: '¡Remitido a CIBIR!',
        text: 'El aspirante ha sido movido al estatus 5_CIBIR.',
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
      })

      await fetchData()
    } catch (e: any) {
      Swal.fire({ title: 'Error', text: e.message || 'Error al remitir', icon: 'error' })
    }
  }

  const cambiarEtapa = async (idInscripcion: number, etapa: number, labelEtapa: string) => {
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
      if (!res.ok || !json.success) throw new Error(json.message || 'No se pudo cambiar la etapa')

      Swal.fire({
        title: '¡Etapa Actualizada!',
        text: json.message || `El aspirante ha sido movido a ${labelEtapa}.`,
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
      })

      await fetchData()
    } catch (e: any) {
      Swal.fire({ title: 'Error', text: e.message, icon: 'error' })
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

  const reenviarEnlaceExpediente = async (id: number) => {
    const result = await Swal.fire({
      title: '¿Reenviar correo?',
      text: 'Se enviará un correo al aspirante y se reactivará su token para cargar el expediente.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#059669',
      confirmButtonText: 'Sí, reenviar correo'
    })
    if (result.isConfirmed) {
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
      }
    }
  }

  const filteredRows = useMemo(() => {
    let result = rows
    if (filtroAcreditacion === 'apto') {
      result = result.filter(r => r.programa_codigo === 'AFILIACION' && !!r.apto_acreditacion)
    } else if (filtroAcreditacion === 'no_apto') {
      result = result.filter(r => r.programa_codigo !== 'AFILIACION' || !r.apto_acreditacion)
    }

    // Filtro por sub-estado de expediente
    if (uiEstatus === 'Pendiente') {
      result = result.filter(r => r.num_documentos && r.num_documentos > 0)
    } else if (uiEstatus === 'Sin Expediente') {
      result = result.filter(r => !r.num_documentos || r.num_documentos === 0)
    } else if (uiEstatus === 'Inscripción') {
      // Para la pestaña 'Inscripción', mostrar solo quienes están pendientes de finalizar inscripción/pago y NO son ya Afiliados
      result = result.filter(r => r.afiliado_estatus !== 'Afiliado')
    }
    if (!search) return result
    const q = search.toLowerCase()
    return result.filter(r =>
      (r.estudiante_nombre || '').toLowerCase().includes(q) ||
      (r.estudiante_email || '').toLowerCase().includes(q) ||
      (r.estudiante_cedula || '').toLowerCase().includes(q)
    )
  }, [rows, search, filtroAcreditacion, uiEstatus])

  const getStatusLabelAndStyles = (estatus: Estatus, afiliadoEstatus?: string, numDocumentos: number = 1) => {
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
      return { label: 'Admitido', styles: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
    }
    if (estatus === 'Rechazado') {
      return { label: 'Rechazado', styles: 'bg-red-50 text-red-600 border-red-200' }
    }
    return { label: estatus, styles: 'bg-slate-100 text-slate-600 border-slate-200' }
  }

  return (
    <div className="flex flex-col h-full w-full overflow-hidden relative">
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

          <div className="flex gap-2">
            {/* Custom Programa Dropdown */}
            <div className="relative flex-1">
              <button
                type="button"
                onClick={() => setShowProgramaDropdown(!showProgramaDropdown)}
                className="w-full flex items-center justify-between gap-1 px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-slate-600 text-[10px] font-bold hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <span className="truncate">
                  {programa === 'Todos' ? 'Todos los Programas' : programa}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${showProgramaDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showProgramaDropdown && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowProgramaDropdown(false)} />
                  <div className="transition-opacity transition-transform absolute left-0 top-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl py-1 z-50 min-w-[150px] fade-in slide-in-from-top-1 duration-200">
                    {[
                      { key: 'Todos', label: 'Todos los Programas' },
                      { key: 'AFILIACION', label: 'AFILIACION' },
                      { key: 'CIBIR', label: 'CIBIR' },
                      { key: 'PADI', label: 'PADI' },
                      { key: 'PEGI', label: 'PEGI' },
                      { key: 'PREANI', label: 'PREANI' },
                    ].map(option => (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => {
                          setPrograma(option.key as any)
                          setShowProgramaDropdown(false)
                        }}
                        className={`w-full text-left px-3 py-1.5 text-[10px] font-bold transition-colors ${
                          programa === option.key ? 'bg-emerald-50 text-emerald-600' : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Custom Filtro Acreditación Dropdown */}
            <div className="relative flex-1">
              <button
                type="button"
                onClick={() => setShowAcreditacionDropdown(!showAcreditacionDropdown)}
                className="w-full flex items-center justify-between gap-1 px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-slate-600 text-[10px] font-bold hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <span className="truncate">
                  {filtroAcreditacion === 'todos' ? 'Todos (Acreditación)' : filtroAcreditacion === 'apto' ? 'Opta por acreditación' : 'No opta por acreditación'}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${showAcreditacionDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showAcreditacionDropdown && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowAcreditacionDropdown(false)} />
                  <div className="transition-opacity transition-transform absolute right-0 sm:left-0 top-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl py-1 z-50 min-w-[160px] fade-in slide-in-from-top-1 duration-200">
                    {[
                      { key: 'todos', label: 'Todos (Acreditación)' },
                      { key: 'apto', label: 'Opta por acreditación' },
                      { key: 'no_apto', label: 'No opta por acreditación' },
                    ].map(option => (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => {
                          setFiltroAcreditacion(option.key as any)
                          setShowAcreditacionDropdown(false)
                        }}
                        className={`w-full text-left px-3 py-1.5 text-[10px] font-bold transition-colors ${
                          filtroAcreditacion === option.key ? 'bg-emerald-50 text-emerald-600' : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 mt-1">
            {(['Todos', 'Pendiente', 'Sin Expediente', 'Entrevista', 'Inscripción', 'Rechazado'] as const).map(f => (
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
                  {(() => {
                    const statusObj = getStatusLabelAndStyles(r.estatus, r.afiliado_estatus, r.num_documentos)
                    return (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusObj.styles}`}>
                        {statusObj.label}
                      </span>
                    )
                  })()}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                  <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300/80 uppercase tracking-tight shadow-2xs">
                    <GraduationCap size={10} className="text-emerald-700 shrink-0" />
                    {r.programa_codigo === 'AFILIACION' && r.afiliado_tipo ? (
                      r.afiliado_tipo === 'Corporativo' ? 'Corporativo' :
                      r.afiliado_tipo === 'Agente Corporativo' || r.afiliado_tipo === 'Agente' 
                        ? `Agente Corp${r.empresa_vinculada_nombre ? ` (${r.empresa_vinculada_nombre})` : ''}` :
                      'Agente Indep.'
                    ) : r.programa_codigo}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">
                    {r.estudiante_cedula || 'S/N'}
                  </span>
                  {r.afiliado_estatus === 'Afiliado' && (
                    <span className="inline-block text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Afiliado
                    </span>
                  )}
                </div>
                {r.programa_codigo === 'AFILIACION' && !!r.apto_acreditacion && (
                  <span className="inline-block text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-100 mt-0.5 self-start">
                    Opta por Acreditación
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
                  const statusObj = getStatusLabelAndStyles(selected.estatus, selected.afiliado_estatus, selected.num_documentos)
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

            {/* Stepper de Progreso */}
            {(selected.programa_codigo === 'AFILIACION' || selected.afiliado_estatus === '5_CIBIR') && (() => {
              const getActiveIndex = (est: string, aEst?: string) => {
                if (aEst === 'Afiliado') return 6; // Etapa 7: Afiliación (Final)
                if (est === 'Inscrito' || aEst === '6_INSCRIPCION') return 5; // Etapa 6: Inscripción (Pago/Cobro)

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
                      const isClickable = !isCurrent;
                      const StepIcon = step.icon;
                      return (
                        <div
                          key={step.label}
                          className={`flex flex-col items-center relative z-10 gap-1.5 group ${isClickable ? 'cursor-pointer' : 'cursor-default'}`}
                          title={isClickable ? `Mover a: ${step.label}` : step.label}
                          onClick={isClickable ? () => cambiarEtapa(selected.id_inscripcion, idx, step.label) : undefined}
                        >
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors transition-transform
                            ${isCompleted
                              ? 'bg-emerald-500 text-white group-hover:bg-emerald-400 group-hover:scale-110'
                              : isCurrent
                                ? 'bg-emerald-600 text-white ring-4 ring-emerald-100 scale-110'
                                : 'bg-white text-slate-300 border-2 border-slate-100 group-hover:border-emerald-300 group-hover:text-emerald-400 group-hover:scale-110'
                            }`}>
                            {isCompleted ? <Check className="w-4 h-4" strokeWidth={3} /> : <StepIcon className="w-4 h-4" />}
                          </div>
                          <span className={`text-[8px] font-black tracking-tighter uppercase transition-colors
                            ${isCurrent ? 'text-emerald-600' : isCompleted ? 'text-emerald-400 group-hover:text-emerald-500' : 'text-slate-300 group-hover:text-emerald-400'}`}>
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

            {/* Módulos de la Formación CIBIR (Solo para quienes cursan CIBIR y NO optan/tienen acreditación directa) */}
            {(selected.programa_codigo === 'CIBIR' || selected.afiliado_estatus === '5_CIBIR') && !selected.apto_acreditacion && !selected.cibir_acreditado && (
              <div className="bg-white rounded-2xl p-5 border border-gray-100 mb-4 flex flex-col gap-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-50">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-emerald-600" />
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Progreso por Módulos (CIBIR)</h4>
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
                    <div className="w-5 h-5 border-2 border-[#00D084] border-t-transparent rounded-full animate-spin" />
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
                              {selected.afiliado_estatus !== 'Afiliado' && selected.estatus !== 'Inscrito' && Number(selected.completado) !== 1 && (
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
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
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
                                  <button onClick={() => aprobarDirecto(selected.id_inscripcion)} className="flex-1 py-3 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-colors">Aprobar Acreditación y Afiliar</button>
                                  <button onClick={() => remitirACibir(selected.id_inscripcion)} className="flex-1 py-3 rounded-xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-200 hover:bg-blue-700 transition-colors">Remitir a CIBIR</button>
                                </>
                              ) : (
                                <button onClick={() => remitirACibir(selected.id_inscripcion)} className="flex-1 py-3 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-colors">Remitir a CIBIR</button>
                              )}
                              <button onClick={() => setShowModalAgendar(true)} className="flex-1 py-3 rounded-xl bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 transition-colors">Agendar Cita</button>
                            </>
                          ) : <button onClick={() => aprobarDirecto(selected.id_inscripcion)} className="flex-1 py-3 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-colors">Aprobar y Afiliar</button>}
                          <button onClick={() => rechazar(selected.id_inscripcion)} className="px-4 py-3 rounded-xl bg-red-50 text-red-600 text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-colors">Rechazar</button>
                        </div>
                        <button 
                          onClick={() => reenviarEnlaceExpediente(selected.id_inscripcion)} 
                          className="w-full mt-2 py-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <Mail className="w-3.5 h-3.5" />
                          Reenviar Enlace de Expediente
                        </button>
                      </>
                    ) : (
                      <div className="flex gap-2 w-full">
                        <button 
                          onClick={() => reenviarEnlaceExpediente(selected.id_inscripcion)} 
                          className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <Mail className="w-3.5 h-3.5" />
                          Reenviar Enlace
                        </button>
                        <button 
                          onClick={() => rechazar(selected.id_inscripcion)} 
                          className="px-4 py-3 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-[10px] font-black uppercase tracking-widest transition-colors"
                        >
                          Rechazar
                        </button>
                      </div>
                    )}
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

                {selected.afiliado_estatus === '5_CIBIR' && (
                  <div className="flex flex-col gap-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Acciones de CIBIR</span>
                    <button
                      onClick={handleAprobarEtapaCibir}
                      className="w-full py-3 rounded-xl bg-[#00D084] hover:bg-[#00B870] text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-200 transition-colors transition-transform active:scale-95 flex items-center justify-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" strokeWidth={3} />
                      Aprobar CIBIR y Afiliar
                    </button>
                  </div>
                )}

                {/* Botón principal de Afiliación Oficial (Siempre visible si no es Afiliado aun) */}
                <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aprobación Final</span>
                  <button
                    onClick={() => cambiarEtapa(selected.id_inscripcion, 6, 'Afiliación')}
                    className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-200 transition-colors transition-transform active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" strokeWidth={3} />
                    Finalizar y Convertir en Miembro Afiliado Oficial
                  </button>
                </div>
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
                  <button key={res} onClick={() => setFinalizarData({ ...finalizarData, resultado: res })} className={`py-3 rounded-xl text-[10px] font-black uppercase border transition-colors ${finalizarData.resultado === res ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white text-slate-400 border-slate-100'}`}>{res}</button>
                ))}
              </div>
              {finalizarData.resultado === 'Parcial' && (
                <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100">
                  <span className="text-[10px] font-black text-emerald-600 uppercase mb-3 block">Módulos Acreditados</span>
                  <div className="grid grid-cols-5 gap-2">
                    {[1, 2, 3, 4, 5].map(m => (
                      <button key={m} onClick={() => setFinalizarData({ ...finalizarData, modulos: finalizarData.modulos.includes(m) ? finalizarData.modulos.filter(x => x !== m) : [...finalizarData.modulos, m] })} className={`h-10 rounded-lg text-[10px] font-black border transition-colors ${finalizarData.modulos.includes(m) ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white text-slate-300 border-slate-100'}`}>M{m}</button>
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
  </div>
)
}

function Loader2({ className }: { className?: string }) {
  return <Search className={['animate-spin', className].join(' ')} />
}

function ChevronDown({ className }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6" /></svg>
}
