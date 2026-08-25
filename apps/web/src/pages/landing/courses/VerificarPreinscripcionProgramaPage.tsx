import React, { useEffect, useState, useRef } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { CheckCircle2, Loader2, ArrowRight, Home, GraduationCap, Briefcase, Award, School, ChevronDown, XCircle, FileText, AlertCircle, Calendar, ShieldCheck, Check, Search, ClipboardList, Mail, CreditCard } from 'lucide-react'
import { API_URL } from '@/config/env'
import { apiFetch } from '@/lib/apiClient'
import Swal from 'sweetalert2'
import { toast } from 'sonner'
import FileUpload from '@/components/common/FileUpload'
import Navbar from '@/pages/landing/components/navbar/Navbar'
import Footer from '@/pages/landing/components/Footer'
import { useExpedienteProgress } from '@/hooks/useExpedienteProgress'
import { useAuth } from '@/context/AuthContext'

const NIVELES = [
  { value: 'Bachiller', label: 'Bachiller', icon: School },
  { value: 'TSU', label: 'Técnico Superior (TSU)', icon: Briefcase },
  { value: 'Nivel Profesional', label: 'Nivel Profesional', icon: GraduationCap },
  { value: 'Postgrado', label: 'Postgrado', icon: Award },
]

const AFILIACION_STEPS = [
  { id: '1_PREINSCRIPCION', label: 'Preinscripción', icon: ClipboardList },
  { id: '2_EXPEDIENTE', label: 'Expediente', icon: Mail },
  { id: '3_ENTREVISTA', label: 'Entrevista', icon: Calendar },
  { id: '4_VERIFICACION', label: 'Verificación', icon: ShieldCheck },
  { id: '5_CIBIR', label: 'CIBIR', icon: GraduationCap },
  { id: '6_INSCRIPCION', label: 'Inscripción', icon: CreditCard },
  { id: 'Afiliado', label: 'Afiliación', icon: Check },
]

const CURSO_STEPS = [
  { id: '1_PREINSCRIPCION', label: 'Preinscripción', icon: ClipboardList },
  { id: '2_EXPEDIENTE', label: 'Expediente', icon: Mail },
  { id: '3_VERIFICACION', label: 'Verificación', icon: ShieldCheck },
  { id: '4_INSCRIPCION', label: 'Inscripción', icon: CreditCard },
  { id: 'Inscrito', label: 'Inscrito', icon: Check },
]

const INPUT_H = "h-[62px]" // Altura unificada

const isValidReferenciaString = (val: string) => {
  if (!val) return false
  return val.includes('(C.I.:') || val.includes('(RIF:')
}

export default function VerificarPreinscripcionProgramaPage() {
  const { user, token: sessionToken } = useAuth()
  const [searchParams] = useSearchParams()
  const tokenFromUrl = searchParams.get('token')
  const [verifiedToken, setVerifiedToken] = useState<string>('')
  const navigate = useNavigate()
  const [status, setStatus] = useState<'loading' | 'verifying' | 'form' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('Verificando tu enlace...')
  const [userData, setUserData] = useState<any>(null)
  const [darkMode, setDarkMode] = useState(false)
  const [showNivelDropdown, setShowNivelDropdown] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    nivelProfesional: '' as 'Bachiller' | 'TSU' | 'Nivel Profesional' | 'Postgrado' | '',
    profesion: '',
    optarAcreditacion: false,
    ano_inicio_servicio: '',
    fecha_nacimiento: '',
    url_titulo: '',
    name_titulo: '',
    url_cv: '',
    name_cv: '',
    url_registro_mercantil: '',
    name_registro_mercantil: '',
    url_titulo_representante: '',
    name_titulo_representante: '',
    especializaciones: [] as { nombre: string; url: string; fecha: string }[],
    cursos_extras: [] as { nombre: string; url: string; fecha: string }[],
    diplomados: [] as { nombre: string; url: string; fecha: string }[],
    otros_docs: [] as { nombre: string; url: string; fecha: string }[],
    url_referencia1: '',
    nombre_referencia1: '',
    url_referencia2: '',
    nombre_referencia2: '',
  })
  const [pendingCursoNombre, setPendingCursoNombre] = useState('')
  const [pendingCursoFecha, setPendingCursoFecha] = useState('')
  const [pendingEspecializacionNombre, setPendingEspecializacionNombre] = useState('')
  const [pendingEspecializacionFecha, setPendingEspecializacionFecha] = useState('')
  const [pendingDiplomadoNombre, setPendingDiplomadoNombre] = useState('')
  const [pendingDiplomadoFecha, setPendingDiplomadoFecha] = useState('')
  const [pendingOtroNombre, setPendingOtroNombre] = useState('')
  const [pendingOtroFecha, setPendingOtroFecha] = useState('')
  const [submitLoading, setSubmitLoading] = useState(false);

  // ── Persistencia de progreso ─────────────────────────────────────────────
  const { saveProgress, loadProgress, clearProgress } = useExpedienteProgress(verifiedToken)
  // Ref para el debounce del guardado automático
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Reference search state (on-demand per reference) ────────────────────
  type TipoReferencia = 'V' | 'E' | 'J' | 'G' | 'P'
  const [searchTipo1, setSearchTipo1] = useState<TipoReferencia>('V')
  const [searchQuery1, setSearchQuery1] = useState('')
  const [searching1, setSearching1] = useState(false)
  const [selectedAffiliate1, setSelectedAffiliate1] = useState<any | null>(null)
  const [notFound1, setNotFound1] = useState(false)

  const [searchTipo2, setSearchTipo2] = useState<TipoReferencia>('V')
  const [searchQuery2, setSearchQuery2] = useState('')
  const [searching2, setSearching2] = useState(false)
  const [selectedAffiliate2, setSelectedAffiliate2] = useState<any | null>(null)
  const [notFound2, setNotFound2] = useState(false)

  // Debounce refs
  const refTimer1 = useRef<ReturnType<typeof setTimeout> | null>(null)
  const refTimer2 = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Control de verificación para evitar re-procesos redundantes (especialmente en incógnito)
  const lastVerifiedTokenRef = useRef<string | null>(null)
  const lastUserRef = useRef<string | null>(null)

  /** Generic on-demand affiliate search — fires after 400ms debounce */
  const makeRefSearchHandler = (
    tipo: TipoReferencia,
    setQuery: React.Dispatch<React.SetStateAction<string>>,
    setSearching: React.Dispatch<React.SetStateAction<boolean>>,
    setSelected: React.Dispatch<React.SetStateAction<any | null>>,
    setNotFound: React.Dispatch<React.SetStateAction<boolean>>,
    refField: 'nombre_referencia1' | 'nombre_referencia2',
    timerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>
  ) => (val: string) => {
    setQuery(val)
    const q = val.replace(/\D/g, '')
    if (q.length < 5) {
      setSelected(null)
      setNotFound(false)
      setFormData(prev => ({ ...prev, [refField]: '' }))
      return
    }
    // Debounce
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      setSearching(true)
      setSelected(null)
      setNotFound(false)
      try {
        const res = await fetch(`${API_URL}/api/public/afiliados/buscar?q=${encodeURIComponent(q)}&tipo=${tipo}`)
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
        const json = await res.json()
        const match = json.success && json.data.length > 0 ? json.data[0] : null
        if (match) {
          setSelected(match)
          const displayId = ['J', 'G'].includes(tipo)
            ? `RIF: ${match.empresa_rif_tipo ?? 'J'}-${match.empresa_rif_numero}`
            : `C.I.: ${match.cedula}`
          setFormData(prev => ({
            ...prev,
            [refField]: `${match.nombre_completo} (${displayId})`
          }))
        } else {
          setNotFound(true)
          setFormData(prev => ({ ...prev, [refField]: '' }))
        }
      } catch {
        setNotFound(true)
        setFormData(prev => ({ ...prev, [refField]: '' }))
      } finally {
        setSearching(false)
      }
    }, 400)
  }

  const handleRefQuery1Change = makeRefSearchHandler(
    searchTipo1, setSearchQuery1, setSearching1, setSelectedAffiliate1, setNotFound1,
    'nombre_referencia1', refTimer1
  )
  const handleRefQuery2Change = makeRefSearchHandler(
    searchTipo2, setSearchQuery2, setSearching2, setSelectedAffiliate2, setNotFound2,
    'nombre_referencia2', refTimer2
  )

  /** Reset a reference search when tipo changes */
  const resetRef1 = () => { setSearchQuery1(''); setSelectedAffiliate1(null); setNotFound1(false); setFormData(prev => ({ ...prev, nombre_referencia1: '' })) }
  const resetRef2 = () => { setSearchQuery2(''); setSelectedAffiliate2(null); setNotFound2(false); setFormData(prev => ({ ...prev, nombre_referencia2: '' })) }

  useEffect(() => {
    const currentUserKey = `${user?.id_afiliado || 'anon'}-${user?.id_estudiante || 'anon'}`

    // Si el usuario cambia, permitimos re-verificar
    if (lastUserRef.current !== currentUserKey) {
      lastVerifiedTokenRef.current = null
      lastUserRef.current = currentUserKey
    }

    const tokenParaValidar = tokenFromUrl || 'session'

    // OPTIMIZACIÓN: Evitar re-verificaciones redundantes.
    // 1. Si ya verificamos un token real, no hace falta intentar con 'session' (el navigate nos trae aquí).
    // 2. Si es el mismo token que ya procesamos, ignorar.
    if (tokenParaValidar === 'session' && lastVerifiedTokenRef.current) return
    if (tokenParaValidar === lastVerifiedTokenRef.current) return

    let active = true
    const verificarToken = async () => {
      try {
        const json = await apiFetch(`${API_URL}/api/public/preinscripciones/token/${tokenParaValidar}`, {
          credentials: 'include'
        })
        if (!active) return
        if (json.success) {
          setUserData(json.data)
          const tok = json.data.token as string
          lastVerifiedTokenRef.current = tok // Guardar para evitar re-verificación
          setVerifiedToken(tok)

          if (tokenFromUrl) {
            navigate('/cursos/verificar', { replace: true })
          }

          // 1. Intentar restaurar progreso guardado desde localStorage
          const storageKey = `expediente_progress_${tok.slice(0, 12).replace(/[^a-zA-Z0-9_-]/g, '_')}`
          let saved: any = null
          try {
            const raw = localStorage.getItem(storageKey)
            if (raw) {
              const parsed = JSON.parse(raw)
              if (parsed._version === 1) saved = parsed
            }
          } catch { /* ignorar */ }

          // 2. Intentar obtener datos del perfil si está logueado
          let profileData: any = null
          if (user?.id_afiliado || user?.id_estudiante) {
            try {
              const targetId = user.id_afiliado || user.id_estudiante;
              const profileJson = await apiFetch(`${API_URL}/api/afiliados/${targetId}`, {
                headers: { 'Authorization': `Bearer ${sessionToken}` }
              })
              if (profileJson.success) profileData = profileJson.data
            } catch (e) { console.error("Error loading profile for pre-fill:", e) }
          }

          if (saved) {
            setFormData({
              nivelProfesional: (saved.nivelProfesional as any) || '',
              profesion: saved.profesion || '',
              optarAcreditacion: !!saved.optarAcreditacion,
              ano_inicio_servicio: saved.ano_inicio_servicio || '',
              fecha_nacimiento: saved.fecha_nacimiento || '',
              url_cv: saved.url_cv || '',
              name_cv: saved.name_cv || '',
              url_titulo: saved.url_titulo || '',
              name_titulo: saved.name_titulo || '',
              url_registro_mercantil: saved.url_registro_mercantil || '',
              name_registro_mercantil: saved.name_registro_mercantil || '',
              url_titulo_representante: saved.url_titulo_representante || '',
              name_titulo_representante: saved.name_titulo_representante || '',
              especializaciones: saved.especializaciones || [],
              cursos_extras: saved.cursos_extras || [],
              diplomados: saved.diplomados || [],
              otros_docs: saved.otros_docs || [],
              url_referencia1: saved.url_referencia1 || '',
              nombre_referencia1: saved.nombre_referencia1 || '',
              url_referencia2: saved.url_referencia2 || '',
              nombre_referencia2: saved.nombre_referencia2 || '',
            })
          } else {
            // Sin progreso guardado — inicializar con datos del servidor + perfil
            const docs = profileData?.documentos || json.data.documentos || []
            const cvDoc = docs.find((d: any) => d.tipo_doc === 'cv')
            const tituloDoc = docs.find((d: any) => d.tipo_doc === 'titulo')
            const registroDoc = docs.find((d: any) => d.tipo_doc === 'registro_mercantil')
            const tituloRepDoc = docs.find((d: any) => d.tipo_doc === 'titulo_representante')
            const ref1Doc = docs.find((d: any) => d.tipo_doc === 'referencia_afiliado_1')
            const ref2Doc = docs.find((d: any) => d.tipo_doc === 'referencia_afiliado_2')

            const hasPriorRefs = !!(ref1Doc?.url || ref2Doc?.url)
            const listDiplomados = docs.filter((d: any) => d.tipo_doc === 'diplomado')
            const hasFippiPreani = listDiplomados.some((d: any) => d && d.nombre_archivo && ['FIPPI', 'PREANI'].includes(d.nombre_archivo.toUpperCase()))

            setFormData(prev => ({
              ...prev,
              nivelProfesional: (profileData?.nivel_academico || json.data.nivel_academico || '') as any,
              profesion: profileData?.profesion || json.data.profesion || '',
              optarAcreditacion: hasPriorRefs || hasFippiPreani,
              ano_inicio_servicio: profileData?.ano_inicio_servicio !== undefined ? String(profileData.ano_inicio_servicio) : (json.data.ano_inicio_servicio !== undefined ? String(json.data.ano_inicio_servicio) : ''),
              fecha_nacimiento: profileData?.fecha_nacimiento || json.data.fecha_nacimiento || '',
              url_cv: cvDoc?.url || '',
              name_cv: cvDoc?.nombre_archivo || '',
              url_titulo: tituloDoc?.url || '',
              name_titulo: tituloDoc?.nombre_archivo || '',
              url_registro_mercantil: registroDoc?.url || '',
              name_registro_mercantil: registroDoc?.nombre_archivo || '',
              url_titulo_representante: tituloRepDoc?.url || '',
              name_titulo_representante: tituloRepDoc?.nombre_archivo || '',
              especializaciones: docs.filter((d: any) => d.tipo_doc === 'especializacion').map((d: any) => ({ nombre: d.nombre_archivo, url: d.url, fecha: d.fecha_documento || '' })),
              cursos_extras: docs.filter((d: any) => d.tipo_doc === 'curso_extra').map((d: any) => ({ nombre: d.nombre_archivo, url: d.url, fecha: d.fecha_documento || '' })),
              diplomados: listDiplomados.map((d: any) => ({ nombre: d.nombre_archivo, url: d.url, fecha: d.fecha_documento || '' })),
              otros_docs: docs.filter((d: any) => d.tipo_doc === 'otro_documento').map((d: any) => ({ nombre: d.nombre_archivo, url: d.url, fecha: d.fecha_documento || '' })),
              url_referencia1: ref1Doc?.url || '',
              nombre_referencia1: ref1Doc?.nombre_archivo || '',
              url_referencia2: ref2Doc?.url || '',
              nombre_referencia2: ref2Doc?.nombre_archivo || '',
            }))
          }
          setStatus('form')
        } else {
          setStatus('error')
          let errMsg = json.message || 'El enlace de acceso no es válido o ha caducado.'
          if (errMsg.toLowerCase().includes('token') || errMsg.toLowerCase().includes('expira') || errMsg.toLowerCase().includes('vencido') || errMsg.toLowerCase().includes('caducado')) {
            errMsg = 'El enlace de acceso no es válido, ya fue utilizado o ha caducado. Por favor, solicita uno nuevo al administrador de la Cámara.'
          }
          setMessage(errMsg)
          toast.error(errMsg)
        }
      } catch {
        setStatus('error')
        const connErr = 'Tiempo de espera agotado o error de conexión con el servidor. Por favor, comprueba tu conexión a internet.'
        setMessage(connErr)
        toast.error(connErr)
      }
    }
    verificarToken()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenFromUrl, user?.id_afiliado, user?.id_estudiante])

  // ── Auto-guardado de progreso con debounce de 600ms ──────────────────────
  useEffect(() => {
    if (status !== 'form' || !verifiedToken) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveProgress({
        nivelProfesional: formData.nivelProfesional,
        profesion: formData.profesion,
        optarAcreditacion: formData.optarAcreditacion,
        ano_inicio_servicio: formData.ano_inicio_servicio,
        url_cv: formData.url_cv,
        name_cv: formData.name_cv,
        url_titulo: formData.url_titulo,
        name_titulo: formData.name_titulo,
        url_registro_mercantil: formData.url_registro_mercantil,
        name_registro_mercantil: formData.name_registro_mercantil,
        url_titulo_representante: formData.url_titulo_representante,
        name_titulo_representante: formData.name_titulo_representante,
        especializaciones: formData.especializaciones,
        cursos_extras: formData.cursos_extras,
        diplomados: formData.diplomados,
        otros_docs: formData.otros_docs,
        url_referencia1: formData.url_referencia1,
        nombre_referencia1: formData.nombre_referencia1,
        url_referencia2: formData.url_referencia2,
        nombre_referencia2: formData.nombre_referencia2,
      })
    }, 600)
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData, status, verifiedToken])

  const isAfiliacion = userData?.programaCodigo === 'AFILIACION'
  const isMainProgram = !userData || ['AFILIACION', 'PADI', 'PEGI', 'PREANI', 'CIBIR'].includes(userData.programaCodigo)
  const isCorporativo = isAfiliacion && userData?.tipoAfiliado === 'Corporativo'
  const steps = isAfiliacion ? AFILIACION_STEPS : CURSO_STEPS
  const percent = ((status === 'success' ? 2 : 1) / (steps.length - 1)) * 100
  const isPostgrado = formData.nivelProfesional === 'Postgrado'
  const currentNivel = NIVELES.find(n => n.value === formData.nivelProfesional)
  const displayName = userData?.nombreCompleto
  const currentYear = new Date().getFullYear()
  const anosServicio = formData.ano_inicio_servicio ? (currentYear - parseInt(formData.ano_inicio_servicio, 10)) : 0
  const tieneDiplomadoRequerido = Array.isArray(formData.diplomados) && formData.diplomados.some(d =>
    d && d.nombre && typeof d.nombre === 'string' && ['FIPPI', 'PREANI'].includes(d.nombre.toUpperCase())
  )
  const showReferencesSection = isAfiliacion && !!formData.optarAcreditacion

  const isReferencesIncomplete = showReferencesSection && (
    (formData.url_referencia1 && !selectedAffiliate1 && !isValidReferenciaString(formData.nombre_referencia1)) ||
    (formData.url_referencia2 && !selectedAffiliate2 && !isValidReferenciaString(formData.nombre_referencia2)) ||
    (selectedAffiliate1 && selectedAffiliate2 && selectedAffiliate1.id_afiliado === selectedAffiliate2.id_afiliado)
  )

  const submitConfirmation = async (dataToSubmit: any) => {
    setSubmitLoading(true)
    setStatus('verifying')
    try {
      const res = await fetch(`${API_URL}/api/public/preinscripciones/confirmar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSubmit),
        credentials: 'include'
      })
      const json = await res.json()
      if (res.ok && json.success) {
        clearProgress()  // Limpiar progreso guardado al enviar exitosamente
        setStatus('success')
      }
      else {
        setStatus('error');
        let errMsg = json.message || 'Error al procesar la solicitud.';
        if (errMsg.toLowerCase().includes('token') || errMsg.toLowerCase().includes('expira') || errMsg.toLowerCase().includes('vencido') || errMsg.toLowerCase().includes('caducado')) {
          errMsg = 'El enlace de acceso no es válido, ya fue utilizado o ha caducado. Por favor, solicita uno nuevo al administrador de la Cámara.'
        }
        setMessage(errMsg);
        toast.error(errMsg);
      }
    } catch {
      setStatus('error');
      const connErr = 'Tiempo de espera agotado o error de conexión con el servidor. Por favor, comprueba tu conexión a internet.'
      setMessage(connErr);
      toast.error(connErr);
    }
    finally { setSubmitLoading(false); }
  }

  const handleConfirmar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!verifiedToken) return

    // 1. Validar Currículum (CV)
    if (!formData.url_cv) {
      Swal.fire({
        title: '¡Atención!',
        text: isCorporativo
          ? 'Por favor, carga la Síntesis Curricular del Representante Legal.'
          : 'Por favor, carga tu Síntesis Curricular.',
        icon: 'warning',
        confirmButtonColor: '#059669',
      });
      return;
    }

    // 2. Validar Nivel Académico
    if (!formData.nivelProfesional) {
      Swal.fire({
        title: '¡Atención!',
        text: isCorporativo
          ? 'Por favor, selecciona el Nivel Académico del Representante Legal.'
          : 'Por favor, selecciona tu Nivel Académico.',
        icon: 'warning',
        confirmButtonColor: '#059669',
      });
      return;
    }

    // 3. Validar Área de Especialización
    if (formData.nivelProfesional !== 'Bachiller' && !formData.profesion.trim()) {
      Swal.fire({
        title: '¡Atención!',
        text: isCorporativo
          ? 'Por favor, indica el Área de Especialización del Representante Legal.'
          : 'Por favor, indica el Área de Especialización de tu título.',
        icon: 'warning',
        confirmButtonColor: '#059669',
      });
      return;
    }

    // 4. Validar Año de Inicio como Asesor (Para todos los afiliados)
    if (isAfiliacion && !formData.ano_inicio_servicio) {
      Swal.fire({
        title: '¡Atención!',
        text: isCorporativo
          ? 'Por favor, indica el Año de Inicio como Asesor del Representante Legal.'
          : 'Por favor, indica el Año de Inicio como Asesor.',
        icon: 'warning',
        confirmButtonColor: '#059669',
      });
      return;
    }

    // 4.5. Validar Fecha de Nacimiento (Mínimo 18 años)
    if (!formData.fecha_nacimiento) {
      Swal.fire({
        title: '¡Atención!',
        text: isCorporativo
          ? 'Por favor, indica la Fecha de Nacimiento del Representante Legal.'
          : 'Por favor, indica tu Fecha de Nacimiento.',
        icon: 'warning',
        confirmButtonColor: '#059669',
      });
      return;
    }

    const birthDate = new Date(formData.fecha_nacimiento);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    if (age < 18) {
      Swal.fire({
        title: 'Edad mínima requerida',
        text: isCorporativo
          ? 'El Representante Legal debe ser mayor de 18 años.'
          : 'Debes tener al menos 18 años para enviar tu expediente y postularte.',
        icon: 'error',
        confirmButtonColor: '#059669',
      });
      return;
    }

    // 5. Validar Documentos Obligatorios por Tipo de Afiliado
    if (isCorporativo) {
      if (!formData.url_titulo) {
        Swal.fire({
          title: '¡Atención!',
          text: 'Por favor, carga el RIF de la Empresa.',
          icon: 'warning',
          confirmButtonColor: '#059669',
        });
        return;
      }
      if (!formData.url_registro_mercantil) {
        Swal.fire({
          title: '¡Atención!',
          text: 'Por favor, carga el Acta Constitutiva de la Empresa.',
          icon: 'warning',
          confirmButtonColor: '#059669',
        });
        return;
      }
      if (!formData.url_titulo_representante && formData.nivelProfesional !== 'Bachiller') {
        Swal.fire({
          title: '¡Atención!',
          text: 'Por favor, carga el Título Académico del Representante Legal.',
          icon: 'warning',
          confirmButtonColor: '#059669',
        });
        return;
      }
    } else {
      if (!formData.url_titulo && formData.nivelProfesional !== 'Bachiller') {
        Swal.fire({
          title: '¡Atención!',
          text: 'Por favor, carga tu Título Académico.',
          icon: 'warning',
          confirmButtonColor: '#059669',
        });
        return;
      }
    }

    // 6. Validar Soporte de Postgrado (si aplica)
    if (formData.nivelProfesional === 'Postgrado' && formData.especializaciones.length === 0) {
      Swal.fire({
        title: 'Documentación incompleta',
        text: 'Como indicaste que tienes nivel de Postgrado, es obligatorio cargar al menos un soporte de especialización o maestría.',
        icon: 'info',
        confirmButtonColor: '#059669',
      });
      return;
    }

    // 6.5. Validar Años de Servicio para Acreditación (CIBIR)
    if (isAfiliacion && formData.optarAcreditacion) {
      if (anosServicio < 8) {
        Swal.fire({
          title: 'Requisito para Acreditación',
          text: 'Para optar por la Acreditación de Conocimientos es obligatorio tener al menos 8 años de experiencia/servicio profesional en el sector inmobiliario.',
          icon: 'warning',
          confirmButtonColor: '#059669',
        });
        return;
      }
    }

    // 7. Validar Referencias (si aplica)
    if (showReferencesSection) {
      const hasRef1 = (formData.url_referencia1 && (selectedAffiliate1 || isValidReferenciaString(formData.nombre_referencia1)))
      if (!hasRef1) {
        Swal.fire({
          title: 'Referencia 1 Obligatoria',
          text: 'Por favor, completa la búsqueda del primer afiliado recomendante y carga su carta de referencia.',
          icon: 'warning',
          confirmButtonColor: '#059669',
        });
        return;
      }

      const hasRef2 = (formData.url_referencia2 && (selectedAffiliate2 || isValidReferenciaString(formData.nombre_referencia2)))
      if (!hasRef2) {
        Swal.fire({
          title: 'Referencia 2 Obligatoria',
          text: 'Por favor, completa la búsqueda del segundo afiliado recomendante y carga su carta de referencia.',
          icon: 'warning',
          confirmButtonColor: '#059669',
        });
        return;
      }

      if (selectedAffiliate1 && selectedAffiliate2 && selectedAffiliate1.id_afiliado === selectedAffiliate2.id_afiliado) {
        Swal.fire({
          title: 'Referencias Duplicadas',
          text: 'Las dos cartas de recomendación deben ser de afiliados activos diferentes.',
          icon: 'warning',
          confirmButtonColor: '#059669',
        });
        return;
      }
    }

    submitConfirmation({
      token: verifiedToken,
      nivelProfesional: formData.nivelProfesional,
      profesion: formData.profesion.trim(),
      optarAcreditacion: !!formData.optarAcreditacion,
      ano_inicio_servicio: formData.ano_inicio_servicio ? parseInt(formData.ano_inicio_servicio, 10) : null,
      fecha_nacimiento: formData.fecha_nacimiento,
      url_titulo: formData.url_titulo,
      url_cv: formData.url_cv,
      url_registro_mercantil: formData.url_registro_mercantil,
      url_titulo_representante: formData.url_titulo_representante,
      especializaciones: JSON.stringify(formData.especializaciones),
      cursos_extras: JSON.stringify(formData.cursos_extras),
      diplomados: JSON.stringify(formData.diplomados),
      otros_docs: JSON.stringify(formData.otros_docs),
      url_referencia1: formData.url_referencia1,
      nombre_referencia1: formData.nombre_referencia1.trim(),
      url_referencia2: formData.url_referencia2,
      nombre_referencia2: formData.nombre_referencia2.trim(),
    });
  }

  const renderAcreditacionSection = () => {
    if (!isAfiliacion) return null;
    return (
      <div className="transition-opacity transition-transform space-y-6 pt-4 fade-in slide-in-from-bottom-4 duration-500">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-1.5 h-6 rounded-full bg-emerald-600" />
            <div>
              <h3 className="text-base md:text-lg font-black uppercase tracking-wider text-[#022c22]">
                ¿Deseas optar por Acreditación?
              </h3>
            </div>
          </div>
          <p className="text-sm text-slate-600 font-medium ml-4.5 italic">
            Indica si deseas convalidar tu experiencia y estudios previos mediante acreditación directa.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setFormData(prev => ({ ...prev, optarAcreditacion: true }))}
            className={`flex items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-colors font-black text-sm uppercase tracking-wider ${formData.optarAcreditacion === true
              ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-md shadow-emerald-500/10'
              : 'border-slate-100 hover:border-emerald-200 text-slate-500 bg-white'
              }`}
          >
            Sí, deseo optar
          </button>
          <button
            type="button"
            onClick={() => setFormData(prev => ({ ...prev, optarAcreditacion: false, diplomados: [] }))}
            className={`flex items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-colors font-black text-sm uppercase tracking-wider ${formData.optarAcreditacion === false
              ? 'border-slate-300 bg-slate-50 text-slate-700 shadow-inner'
              : 'border-slate-100 hover:border-emerald-200 text-slate-500 bg-white'
              }`}
          >
            No, haré el CIBIR
          </button>
        </div>

        {/* Sección de Diplomados Realizados (Solo si opta por Acreditación) */}
        {formData.optarAcreditacion && (
          <div className="transition-opacity transition-transform space-y-6 pt-4 border-t border-slate-100/80 fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center gap-3 mb-1"><div className="w-1.5 h-6 rounded-full bg-emerald-500" /><div><h3 className="text-base md:text-lg font-black uppercase tracking-wider text-[#022c22]">Diplomados Realizados</h3></div></div>
                <p className="text-sm text-slate-600 font-medium ml-4.5 italic">Certificados de diplomados realizados relevantes de los últimos 5 años</p>
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase bg-slate-100 px-2.5 py-0.5 rounded-full">Opcional</span>
            </div>

            {/* Banner informativo de FIPPI/PREANI */}
            <div className="bg-emerald-50/60 border border-emerald-100 rounded-2xl p-4 flex gap-3 text-emerald-900 text-sm leading-relaxed">
              <AlertCircle className="text-emerald-500 shrink-0 mt-0.5" size={16} />
              <div>
                <span className="font-bold text-emerald-950">Información importante:</span> Solo se permite cargar los certificados correspondientes a los diplomados <span className="font-black">FIPPI</span> y/o <span className="font-black">PREANI</span>. Puede cargar un máximo de 2 certificados en total (uno de cada tipo).
              </div>
            </div>

            {/* Lista de diplomados cargados */}
            {formData.diplomados.length > 0 && (
              <div className="space-y-2">
                {formData.diplomados.map((dip, idx) => (
                  <div key={(dip as any).id || dip.url || `${dip.nombre}-${idx}`} className="group flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                      <FileText size={14} className="text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="text-sm font-bold text-slate-700 select-none">
                        {dip.nombre}
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={10} className="text-slate-400" />
                          <input
                            type="date"
                            value={dip.fecha}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              diplomados: prev.diplomados.map((d, i) =>
                                i === idx ? { ...d, fecha: e.target.value } : d
                              )
                            }))}
                            className="text-xs font-medium text-slate-500 bg-transparent border-none p-0 focus:ring-0 w-24"
                          />
                        </div>
                        <a href={dip.url} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-emerald-500 font-bold hover:underline uppercase tracking-widest">
                          Ver archivo
                        </a>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, diplomados: prev.diplomados.filter((_, i) => i !== idx) }))}
                      className="p-1.5 hover:bg-rose-50 text-slate-300 hover:text-rose-500 rounded-lg transition-colors shrink-0"
                    >
                      <XCircle size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Input selector + Fecha + Uploader para nuevo diplomado */}
            {formData.diplomados.length < 2 ? (
              <div className="transition-opacity space-y-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-100 fade-in duration-300">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs md:text-sm font-black uppercase tracking-wider text-slate-400 ml-1">Seleccionar Diplomado</label>
                    <select
                      value={pendingDiplomadoNombre}
                      onChange={(e) => setPendingDiplomadoNombre(e.target.value)}
                      className="w-full h-10 px-4 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400 bg-white transition cursor-pointer"
                    >
                      <option value="">-- Seleccione --</option>
                      <option value="FIPPI">FIPPI</option>
                      <option value="PREANI">PREANI</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs md:text-sm font-black uppercase tracking-wider text-slate-400 ml-1">Fecha del Certificado</label>
                    <div className="relative">
                      <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="date"
                        value={pendingDiplomadoFecha}
                        max={new Date().toISOString().split('T')[0]}
                        min={new Date(new Date().setFullYear(new Date().getFullYear() - 5)).toISOString().split('T')[0]}
                        onChange={(e) => setPendingDiplomadoFecha(e.target.value)}
                        className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400 bg-white transition"
                      />
                    </div>
                  </div>
                </div>
                <FileUpload
                  key={formData.diplomados.length}
                  label="Cargar certificado del diplomado"
                  accept="image/*,.pdf"
                  folder="diplomados"
                  onUploadSuccess={(url) => {
                    if (!pendingDiplomadoNombre) {
                      Swal.fire({
                        title: '¡Atención!',
                        text: 'Por favor, selecciona primero el nombre del diplomado (FIPPI o PREANI).',
                        icon: 'warning',
                        confirmButtonColor: '#059669',
                      });
                      return;
                    }

                    if (!pendingDiplomadoFecha) {
                      Swal.fire({
                        title: '¡Atención!',
                        text: 'Por favor, selecciona primero la fecha del certificado.',
                        icon: 'warning',
                        confirmButtonColor: '#059669',
                      });
                      return;
                    }

                    const yaExiste = Array.isArray(formData.diplomados) && formData.diplomados.some(
                      d => d && d.nombre && typeof d.nombre === 'string' && d.nombre.toUpperCase() === pendingDiplomadoNombre.toUpperCase()
                    );
                    if (yaExiste) {
                      Swal.fire({
                        title: 'Diplomado ya cargado',
                        text: `Ya has subido un certificado para el diplomado ${pendingDiplomadoNombre}. Solo se permite un certificado de cada tipo.`,
                        icon: 'error',
                        confirmButtonColor: '#059669',
                      });
                      return;
                    }

                    const courseDate = new Date(pendingDiplomadoFecha);
                    const fiveYearsAgo = new Date();
                    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

                    if (courseDate < fiveYearsAgo) {
                      Swal.fire({
                        title: 'Fecha no válida',
                        text: 'Lo sentimos, el certificado no debe tener más de 5 años de antigüedad.',
                        icon: 'error',
                        confirmButtonColor: '#059669',
                      });
                      return;
                    }

                    setFormData(prev => ({
                      ...prev,
                      diplomados: [...prev.diplomados, {
                        nombre: pendingDiplomadoNombre,
                        url,
                        fecha: pendingDiplomadoFecha
                      }]
                    }));
                    setPendingDiplomadoNombre('');
                    setPendingDiplomadoFecha('');
                  }}
                  onClear={() => { }}
                />
              </div>
            ) : (
              <div className="transition-opacity bg-emerald-50/60 border border-emerald-100 rounded-2xl p-4 text-center text-xs font-bold text-emerald-800 fade-in duration-300">
                ¡Límite máximo alcanzado! Has cargado los certificados correspondientes a FIPPI y PREANI.
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const selectedNivel = NIVELES.find(n => n.value === userData?.nivel_profesional)
  const programaLabel = userData?.programaCodigo === 'AFILIACION' ? 'la Cámara Inmobiliaria' : (userData?.programaCodigo || 'CIEBO')
  const tituloLabel = userData?.programaCodigo === 'AFILIACION' ? 'Solicitud de Afiliación' : `Programa ${userData?.programaCodigo}`

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar darkMode={darkMode} setDarkMode={setDarkMode} />

      {status !== 'error' && (
        <section className="transition-opacity relative bg-[#022c22] pt-28 pb-16 overflow-hidden text-center fade-in duration-500">
          <div className="relative z-10 max-w-5xl mx-auto px-6">
            {isMainProgram ? (
              <div className="w-full max-w-5xl mx-auto mb-10 mt-2 px-2">
                {/* Timeline Desktop/Mobile wrapping */}
                <div className="flex flex-wrap md:flex-nowrap items-start justify-center md:justify-between relative pb-4 pt-2 gap-y-4 gap-x-3 md:gap-x-0">
                  <div
                    className="absolute top-[28px] left-[8%] right-[8%] h-0.5 bg-emerald-500/20 -z-0 hidden md:block" />
                  <div
                    className="absolute top-[28px] left-[8%] h-0.5 bg-emerald-400 -z-0 hidden md:block transition-colors duration-1000"
                    style={{ width: `${percent}%` }}
                  />

                  {steps.map((step, idx) => {
                    const isCompleted = idx < (status === 'success' ? 2 : 1)
                    const isCurrent = idx === (status === 'success' ? 2 : 1)
                    const StepIcon = step.icon

                    return (
                      <div key={step.id} className="flex flex-col items-center gap-2 relative z-10 flex-1 min-w-[75px] max-w-[120px] md:max-w-none text-center">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors duration-500 shadow-md ${isCompleted ? 'bg-emerald-500 text-white shadow-emerald-950/20' :
                            isCurrent ? 'bg-emerald-400 text-[#022c22] scale-110 font-bold' :
                              'bg-emerald-900/30 text-emerald-100/40 border border-emerald-500/30'
                            }`}
                        >
                          {isCompleted ? <Check size={16} strokeWidth={3} /> : <StepIcon size={16} />}
                        </div>
                        <div className="space-y-0.5">
                          <p className={`text-[8px] font-black uppercase tracking-wider ${isCurrent ? 'text-emerald-300' : isCompleted ? 'text-emerald-400' : 'text-emerald-100/40'}`}>
                            Paso {idx + 1}
                          </p>
                          <p className={`text-[10px] font-bold leading-tight truncate max-w-[95px] mx-auto ${isCurrent ? 'text-white' : 'text-emerald-100/60'}`}>
                            {step.label}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-3 mb-8">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-white">
                    <CheckCircle2 size={16} />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                    Paso 1
                  </span>
                </div>
                <div className="w-12 h-px bg-emerald-500/30" />
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${status === 'success' ? 'bg-emerald-500' : 'bg-emerald-500/20 border border-emerald-500/40'}`}>
                    {status === 'success' ? <CheckCircle2 size={16} className="text-white" /> : <span className="text-emerald-400 text-xs font-black">2</span>}
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-widest ${status === 'success' ? 'text-emerald-400' : 'text-emerald-100/60'}`}>
                    Paso 2
                  </span>
                </div>
              </div>
            )}

            {status !== 'loading' && status !== 'verifying' && (
              <>
                <h1 className="text-3xl md:text-5xl font-black text-white uppercase tracking-tighter mb-3">
                  {status === 'success' ? '¡Todo Listo!' : (isAfiliacion ? 'Validación de Afiliado' : 'Completa tu Perfil')}
                </h1>
                <p className="text-white/90 text-sm max-w-lg mx-auto">
                  {status === 'form' && userData
                    ? <>Hola <span className="text-white font-bold">{displayName || 'aspirante'}</span>, falta poco para finalizar tu <span className="text-emerald-400 font-bold">{isAfiliacion ? 'solicitud de afiliación' : `inscripción al programa ${programaLabel}`}</span>.</>
                    : message
                  }
                </p>
              </>
            )}

            {status === 'loading' && (
              <div className="flex flex-col items-center justify-center py-4 space-y-4">
                <Loader2 size={32} className="animate-spin text-emerald-400" />
                <div className="space-y-1">
                  <h2 className="text-xl font-black text-white uppercase tracking-tight">Verificando enlace</h2>
                  <p className="text-emerald-100/60 text-xs font-bold uppercase tracking-wider">Cargando tu información...</p>
                </div>
              </div>
            )}

            {status === 'verifying' && (
              <div className="flex flex-col items-center justify-center py-4 space-y-4">
                <Loader2 size={32} className="animate-spin text-emerald-400" />
                <div className="space-y-1">
                  <h2 className="text-xl font-black text-white uppercase tracking-tight">Procesando Solicitud</h2>
                  <p className="text-emerald-100/60 text-xs font-bold uppercase tracking-wider">Generando tu expediente digital...</p>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-6 py-12">
          {status === 'form' && userData && (
            <form onSubmit={handleConfirmar} className="transition-opacity transition-transform flex flex-col gap-8 fade-in slide-in-from-bottom-4 duration-700">

              <div className="space-y-3">
                <h2 className="text-2xl md:text-3xl font-black text-[#022c22] uppercase tracking-tight">Carga de Documentación</h2>
                <p className="text-slate-600 text-sm md:text-base leading-relaxed">
                  Para finalizar tu proceso, por favor verifica tu nivel académico y adjunta los archivos solicitados.
                </p>
              </div>

              {/* Síntesis Curricular (CV) */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-3 mb-1"><div className="w-1.5 h-6 rounded-full bg-emerald-600" /><div><h3 className="text-base md:text-lg font-black uppercase tracking-wider text-[#022c22]">Síntesis Curricular (CV)</h3></div></div>
                  <p className="text-sm text-slate-600 font-medium ml-4.5 italic">
                    Carga {isCorporativo ? 'la síntesis curricular del Representante Legal' : 'tu currículum'} en formato PDF para iniciar la revisión de tu expediente.
                  </p>
                </div>
                <FileUpload
                  label={isCorporativo ? "Cargar Síntesis Curricular del Representante Legal" : "Cargar Síntesis Curricular (CV)"}
                  accept=".pdf"
                  folder="cvs"
                  required
                  initialUrl={formData.url_cv || undefined}
                  initialFileName={formData.name_cv || undefined}
                  onUploadSuccess={(url, fileName) => setFormData(prev => ({ ...prev, url_cv: url, name_cv: fileName || '' }))}
                  onClear={() => setFormData(prev => ({ ...prev, url_cv: '', name_cv: '' }))}
                />
              </div>

              {!isCorporativo && (
                <>
                  {/* Fecha de Nacimiento */}
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-3 mb-1">
                        <div className="w-1.5 h-6 rounded-full bg-emerald-600" />
                        <div>
                          <h3 className="text-base md:text-lg font-black uppercase tracking-wider text-[#022c22]">
                            Fecha de Nacimiento
                          </h3>
                        </div>
                      </div>
                      <p className="text-sm text-slate-600 font-medium ml-4.5 italic">
                        Es un requisito obligatorio para el registro de tu expediente.
                      </p>
                    </div>
                    <div className="relative group">
                      <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors">
                        <Calendar size={18} />
                      </div>
                      <input
                        type="date"
                        required
                        max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
                        value={formData.fecha_nacimiento}
                        onChange={(e) => setFormData(prev => ({ ...prev, fecha_nacimiento: e.target.value }))}
                        className={`w-full pl-14 pr-5 bg-white border-2 border-slate-100 rounded-2xl outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-colors text-base font-bold text-slate-700 ${INPUT_H}`}
                      />
                    </div>
                  </div>

                  {/* Selector de Nivel Académico */}
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-3 mb-1"><div className="w-1.5 h-6 rounded-full bg-emerald-600" /><div><h3 className="text-base md:text-lg font-black uppercase tracking-wider text-[#022c22]">Nivel Académico Alcanzado</h3></div></div>
                      <p className="text-sm text-slate-600 font-medium ml-4.5 italic">Confirma tu grado de instrucción actual.</p>
                    </div>

                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowNivelDropdown(!showNivelDropdown)}
                        className={`w-full px-5 flex items-center justify-between bg-white border-2 transition-colors duration-300 rounded-2xl ${showNivelDropdown ? 'border-emerald-500 ring-4 ring-emerald-500/10' : 'border-slate-100 hover:border-emerald-300'} ${INPUT_H}`}
                      >
                        <div className="flex items-center gap-3">
                          {currentNivel ? (
                            <>
                              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                <currentNivel.icon size={18} />
                              </div>
                              <span className="text-base font-bold text-slate-700">{currentNivel.label}</span>
                            </>
                          ) : (
                            <span className="text-base font-bold text-slate-400 italic">Selecciona tu nivel académico...</span>
                          )}
                        </div>
                        <ChevronDown size={20} className={`text-slate-400 transition-transform duration-300 ${showNivelDropdown ? 'rotate-180' : ''}`} />
                      </button>

                      {showNivelDropdown && (
                        <div className="transition-opacity transition-transform absolute z-50 w-full mt-2 bg-white border border-slate-100 rounded-2xl shadow-2xl overflow-hidden fade-in zoom-in-95 duration-200">
                          <div className="p-2 grid grid-cols-1 gap-1">
                            {NIVELES.map((nivel) => (
                              <button
                                key={nivel.value}
                                type="button"
                                onClick={() => {
                                  setFormData(prev => ({ ...prev, nivelProfesional: nivel.value as any }))
                                  setShowNivelDropdown(false)
                                }}
                                className={`flex items-center gap-4 p-3 rounded-xl transition-colors ${formData.nivelProfesional === nivel.value ? 'bg-emerald-600 text-white shadow-lg' : 'hover:bg-slate-50 text-slate-600'}`}
                              >
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${formData.nivelProfesional === nivel.value ? 'bg-white/20' : 'bg-slate-100'}`}>
                                  <nivel.icon size={20} />
                                </div>
                                <div className="flex flex-col items-start">
                                  <span className="text-base font-bold">{nivel.label}</span>
                                  {formData.nivelProfesional === nivel.value && <span className="text-xs opacity-80 font-black uppercase tracking-widest">Seleccionado</span>}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Área de Especialización */}
                  {formData.nivelProfesional && formData.nivelProfesional !== 'Bachiller' && (
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-3 mb-1"><div className="w-1.5 h-6 rounded-full bg-emerald-400" /><div><h3 className="text-base md:text-lg font-black uppercase tracking-wider text-[#022c22]">Área de Especialización</h3></div></div>
                        <p className="text-sm text-slate-600 font-medium ml-4.5 italic">Indica el área de especialización de tu título.</p>
                      </div>
                      <div className="relative group">
                        <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors">
                          <Briefcase size={18} />
                        </div>
                        <input
                          type="text"
                          required
                          value={formData.profesion}
                          onChange={(e) => setFormData(prev => ({ ...prev, profesion: e.target.value }))}
                          placeholder="Ej. Derecho, Ingeniería, Administración..."
                          className={`w-full pl-14 pr-5 bg-white border-2 border-slate-100 rounded-2xl outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-colors text-base font-bold text-slate-700 ${INPUT_H}`}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="space-y-8">
                {isCorporativo ? (
                  <>
                    {/* SECCIÓN REPRESENTANTE */}
                    <div className="space-y-6">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-3 mb-1"><div className="w-1.5 h-6 rounded-full bg-emerald-600" /><div><h3 className="text-base md:text-lg font-black uppercase tracking-wider text-[#022c22]">Representante Legal</h3></div></div>
                        <p className="text-sm text-slate-600 font-medium ml-4.5 italic">Información profesional y soportes de identidad.</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Selector de Nivel Académico (Inyectado aquí para Corporativos) */}
                        <div className="space-y-1.5">
                          <label className="text-xs md:text-sm font-black uppercase tracking-wider text-slate-400 ml-1">Nivel Académico</label>
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setShowNivelDropdown(!showNivelDropdown)}
                              className={`w-full px-4 flex items-center justify-between bg-white border-2 transition-colors duration-300 rounded-xl ${showNivelDropdown ? 'border-emerald-500 ring-4 ring-emerald-500/10' : 'border-slate-100 hover:border-emerald-300'} h-[50px]`}
                            >
                              <div className="flex items-center gap-2">
                                {currentNivel ? (
                                  <>
                                    <currentNivel.icon size={14} className="text-emerald-600" />
                                    <span className="text-sm font-bold text-slate-700">{currentNivel.label}</span>
                                  </>
                                ) : (
                                  <span className="text-sm font-bold text-slate-400 italic">Nivel...</span>
                                )}
                              </div>
                              <ChevronDown size={16} className={`text-slate-400 transition-transform duration-300 ${showNivelDropdown ? 'rotate-180' : ''}`} />
                            </button>
                            {showNivelDropdown && (
                              <div className="absolute z-50 w-full mt-2 bg-white border border-slate-100 rounded-xl shadow-2xl overflow-hidden">
                                <div className="p-1 grid grid-cols-1 gap-0.5">
                                  {NIVELES.map((nivel) => (
                                    <button
                                      key={nivel.value}
                                      type="button"
                                      onClick={() => {
                                        setFormData(prev => ({ ...prev, nivelProfesional: nivel.value as any }))
                                        setShowNivelDropdown(false)
                                      }}
                                      className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${formData.nivelProfesional === nivel.value ? 'bg-emerald-600 text-white' : 'hover:bg-slate-50 text-slate-600'}`}
                                    >
                                      <nivel.icon size={14} />
                                      <span className="text-xs font-bold">{nivel.label}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Año de Inicio como Asesor (Representante Legal) */}
                        <div className="space-y-1.5">
                          <label className="text-xs md:text-sm font-black uppercase tracking-wider text-slate-400 ml-1">Año de Inicio como Asesor</label>
                          <div className="relative group">
                            <Briefcase size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                              type="number"
                              min="1950"
                              max={new Date().getFullYear()}
                              required
                              value={formData.ano_inicio_servicio}
                              onChange={(e) => setFormData(prev => ({ ...prev, ano_inicio_servicio: e.target.value }))}
                              placeholder="Ej. 2015"
                              className="w-full pl-10 pr-4 bg-white border-2 border-slate-100 rounded-xl outline-none focus:border-emerald-500 transition-colors text-sm font-bold text-slate-700 h-[50px]"
                            />
                          </div>
                        </div>

                        {/* Fecha de Nacimiento (Representante Legal) */}
                        <div className="space-y-1.5">
                          <label className="text-xs md:text-sm font-black uppercase tracking-wider text-slate-400 ml-1">Fecha de Nacimiento</label>
                          <div className="relative group">
                            <Calendar size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                              type="date"
                              required
                              max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
                              value={formData.fecha_nacimiento}
                              onChange={(e) => setFormData(prev => ({ ...prev, fecha_nacimiento: e.target.value }))}
                              className="w-full pl-10 pr-4 bg-white border-2 border-slate-100 rounded-xl outline-none focus:border-emerald-500 transition-colors text-sm font-bold text-slate-700 h-[50px]"
                            />
                          </div>
                        </div>

                        {/* Área de Especialización (Inyectado aquí para Corporativos) */}
                        {formData.nivelProfesional && formData.nivelProfesional !== 'Bachiller' && (
                          <div className="space-y-1.5">
                            <label className="text-xs md:text-sm font-black uppercase tracking-wider text-slate-400 ml-1">Área de Especialización</label>
                            <div className="relative group">
                              <Briefcase size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                              <input
                                type="text"
                                required
                                value={formData.profesion}
                                onChange={(e) => setFormData(prev => ({ ...prev, profesion: e.target.value }))}
                                placeholder="Ej. Derecho, Ingeniería, Administración..."
                                className="w-full pl-10 pr-4 bg-white border-2 border-slate-100 rounded-xl outline-none focus:border-emerald-500 transition-colors text-sm font-bold text-slate-700 h-[50px]"
                              />
                            </div>
                          </div>
                        )}

                        <div className="md:col-span-2">
                          <FileUpload
                            label={formData.nivelProfesional === 'Bachiller' ? "Título del Representante (Opcional)" : "Título del Representante"}
                            accept="image/*,.pdf"
                            folder="afiliados/representantes"
                            required={formData.nivelProfesional !== 'Bachiller'}
                            initialUrl={formData.url_titulo_representante || undefined}
                            initialFileName={formData.name_titulo_representante || undefined}
                            onUploadSuccess={(url, fileName) => setFormData(prev => ({ ...prev, url_titulo_representante: url, name_titulo_representante: fileName || '' }))}
                            onClear={() => setFormData(prev => ({ ...prev, url_titulo_representante: '', name_titulo_representante: '' }))}
                          />
                        </div>
                      </div>
                    </div>

                  </>
                ) : (
                  <div className="space-y-6">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-3 mb-1"><div className="w-1.5 h-6 rounded-full bg-emerald-600" /><div><h3 className="text-base md:text-lg font-black uppercase tracking-wider text-[#022c22]">Título Académico</h3></div></div>
                      <p className="text-sm text-slate-600 font-medium ml-4.5 italic">Carga el soporte de tu grado académico seleccionado.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="md:col-span-2">
                        <FileUpload
                          label={formData.nivelProfesional === 'Bachiller' ? "Título de Bachiller (Opcional)" : "Título Académico"}
                          accept="image/*,.pdf"
                          folder="titulos"
                          required={formData.nivelProfesional !== 'Bachiller'}
                          initialUrl={formData.url_titulo || undefined}
                          initialFileName={formData.name_titulo || undefined}
                          onUploadSuccess={(url, fileName) => setFormData(prev => ({ ...prev, url_titulo: url, name_titulo: fileName || '' }))}
                          onClear={() => setFormData(prev => ({ ...prev, url_titulo: '', name_titulo: '' }))}
                        />
                      </div>
                    </div>

                    {/* Año de Inicio como Asesor */}
                    {isAfiliacion && (
                      <div className="space-y-4 pt-4 border-t border-slate-100/60">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-3 mb-1"><div className="w-1.5 h-6 rounded-full bg-emerald-500" /><div><h3 className="text-base md:text-lg font-black uppercase tracking-wider text-[#022c22]">Año de Inicio como Asesor</h3></div></div>
                          <p className="text-sm text-slate-600 font-medium ml-4.5 italic">Indica el año en el que comenzaste a ejercer como asesor o corredor inmobiliario.</p>
                        </div>
                        <div className="relative group">
                          <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors">
                            <Briefcase size={18} />
                          </div>
                          <input
                            type="number"
                            min="1950"
                            max={new Date().getFullYear()}
                            required
                            value={formData.ano_inicio_servicio}
                            onChange={(e) => setFormData(prev => ({ ...prev, ano_inicio_servicio: e.target.value }))}
                            placeholder="Ej. 2015"
                            className={`w-full pl-14 pr-5 bg-white border-2 border-slate-100 rounded-2xl outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-colors text-base font-bold text-slate-700 ${INPUT_H}`}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Sección de Especializaciones (Solo si es Postgrado) */}
              {isPostgrado && (
                <div className="space-y-6 pt-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-3 mb-1"><div className="w-1.5 h-6 rounded-full bg-emerald-600" /><div><h3 className="text-base md:text-lg font-black uppercase tracking-wider text-[#022c22]">Postgrados</h3></div></div>
                      <p className="text-sm text-slate-600 font-medium ml-4.5 italic">Si posees estudios adicionales de postgrado, puedes registrarlos aquí.</p>
                    </div>

                  </div>
                  <div className="space-y-4">
                    {/* Lista de especializaciones cargadas */}
                    {formData.especializaciones.length > 0 && (
                      <div className="space-y-2">
                        {formData.especializaciones.map((esp, idx) => (
                          <div key={(esp as any).id || esp.url || `${esp.nombre}-${idx}`} className="group flex items-center gap-3 p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl">
                            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                              <FileText size={14} className="text-emerald-600" />
                            </div>
                            <div className="flex-1 min-w-0 space-y-1">
                              <input
                                type="text"
                                value={esp.nombre}
                                onChange={(e) => setFormData(prev => ({
                                  ...prev,
                                  especializaciones: prev.especializaciones.map((item, i) =>
                                    i === idx ? { ...item, nombre: e.target.value } : item
                                  )
                                }))}
                                placeholder="Título obtenido..."
                                className="w-full text-sm font-bold text-slate-700 bg-transparent border-none outline-none focus:ring-0 placeholder:text-slate-400 truncate"
                              />
                              <div className="flex items-center gap-4">
                                <div className="flex items-center gap-1.5">
                                  <Calendar size={10} className="text-slate-400" />
                                  <input
                                    type="date"
                                    value={esp.fecha}
                                    onChange={(e) => setFormData(prev => ({
                                      ...prev,
                                      especializaciones: prev.especializaciones.map((item, i) =>
                                        i === idx ? { ...item, fecha: e.target.value } : item
                                      )
                                    }))}
                                    className="text-xs font-medium text-slate-500 bg-transparent border-none p-0 focus:ring-0 w-24"
                                  />
                                </div>
                                <a href={esp.url} target="_blank" rel="noopener noreferrer"
                                  className="text-xs text-emerald-500 font-bold hover:underline uppercase tracking-widest">
                                  Ver archivo
                                </a>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setFormData(prev => ({ ...prev, especializaciones: prev.especializaciones.filter((_, i) => i !== idx) }))}
                              className="p-1.5 hover:bg-rose-50 text-slate-300 hover:text-rose-500 rounded-lg transition-colors shrink-0"
                            >
                              <XCircle size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Input nombre + Fecha + Uploader para nueva especialización */}
                    <div className="space-y-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-xs md:text-sm font-black uppercase tracking-wider text-slate-400 ml-1">Nombre del Postgrado</label>
                          <input
                            type="text"
                            value={pendingEspecializacionNombre}
                            onChange={(e) => setPendingEspecializacionNombre(e.target.value)}
                            placeholder="Especialidad (ej: Maestría en Finanzas)..."
                            className="w-full h-10 px-4 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400 placeholder:text-slate-400 bg-white transition"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs md:text-sm font-black uppercase tracking-wider text-slate-400 ml-1">Fecha de Finalización</label>
                          <div className="relative">
                            <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                              type="date"
                              value={pendingEspecializacionFecha}
                              onChange={(e) => setPendingEspecializacionFecha(e.target.value)}
                              className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400 bg-white transition"
                            />
                          </div>
                        </div>
                      </div>
                      <FileUpload
                        key={formData.especializaciones.length}
                        label="Cargar soporte del postgrado"
                        accept="image/*,.pdf"
                        folder="especializaciones"
                        onUploadSuccess={(url) => {
                          setFormData(prev => ({
                            ...prev,
                            especializaciones: [...prev.especializaciones, {
                              nombre: pendingEspecializacionNombre.trim() || `Postgrado #${prev.especializaciones.length + 1}`,
                              url,
                              fecha: pendingEspecializacionFecha
                            }]
                          }))
                          setPendingEspecializacionNombre('')
                          setPendingEspecializacionFecha('')
                        }}
                        onClear={() => { }}
                      />
                    </div>
                  </div>
                </div>
              )}


              {/* Sección de Otros Cursos */}
              <div className="space-y-6 pt-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-3 mb-1"><div className="w-1.5 h-6 rounded-full bg-amber-500" /><div><h3 className="text-base md:text-lg font-black uppercase tracking-wider text-[#022c22]">Otros Cursos Realizados</h3></div></div>
                    <p className="text-sm text-slate-600 font-medium ml-4.5 italic">Certificados de cursos, talleres o seminarios relevantes de los últimos 5 años</p>
                  </div>
                  <span className="text-xs font-bold text-slate-400 uppercase bg-slate-100 px-2.5 py-0.5 rounded-full">Opcional</span>
                </div>

                {/* Lista de cursos cargados */}
                {formData.cursos_extras.length > 0 && (
                  <div className="space-y-2">
                    {formData.cursos_extras.map((curso, idx) => (
                      <div key={(curso as any).id || curso.url || `${curso.nombre}-${idx}`} className="group flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                        <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                          <FileText size={14} className="text-amber-600" />
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <input
                            type="text"
                            value={curso.nombre}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              cursos_extras: prev.cursos_extras.map((c, i) =>
                                i === idx ? { ...c, fontName: e.target.value } : c
                              )
                            }))}
                            placeholder="Nombre del curso..."
                            className="w-full text-sm font-bold text-slate-700 bg-transparent border-none outline-none focus:ring-0 placeholder:text-slate-400 truncate"
                          />
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1.5">
                              <Calendar size={10} className="text-slate-400" />
                              <input
                                type="date"
                                value={curso.fecha}
                                onChange={(e) => setFormData(prev => ({
                                  ...prev,
                                  cursos_extras: prev.cursos_extras.map((c, i) =>
                                    i === idx ? { ...c, fecha: e.target.value } : c
                                  )
                                }))}
                                className="text-xs font-medium text-slate-500 bg-transparent border-none p-0 focus:ring-0 w-24"
                              />
                            </div>
                            <a href={curso.url} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-emerald-500 font-bold hover:underline uppercase tracking-widest">
                              Ver archivo
                            </a>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, cursos_extras: prev.cursos_extras.filter((_, i) => i !== idx) }))}
                          className="p-1.5 hover:bg-rose-50 text-slate-300 hover:text-rose-500 rounded-lg transition-colors shrink-0"
                        >
                          <XCircle size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Input nombre + Fecha + Uploader para nuevo curso */}
                <div className="space-y-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs md:text-sm font-black uppercase tracking-wider text-slate-400 ml-1">Nombre del Curso</label>
                      <input
                        type="text"
                        value={pendingCursoNombre}
                        onChange={(e) => setPendingCursoNombre(e.target.value)}
                        placeholder="Nombre del curso (ej: Valuación Inmobiliaria UCAB)..."
                        className="w-full h-10 px-4 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-emerald-400 placeholder:text-slate-400 bg-white transition"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs md:text-sm font-black uppercase tracking-wider text-slate-400 ml-1">Fecha del Certificado</label>
                      <div className="relative">
                        <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="date"
                          value={pendingCursoFecha}
                          max={new Date().toISOString().split('T')[0]}
                          min={new Date(new Date().setFullYear(new Date().getFullYear() - 5)).toISOString().split('T')[0]}
                          onChange={(e) => setPendingCursoFecha(e.target.value)}
                          className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-emerald-400 bg-white transition"
                        />
                      </div>
                    </div>
                  </div>
                  <FileUpload
                    key={formData.cursos_extras.length}
                    label="Cargar certificado del curso"
                    accept="image/*,.pdf"
                    folder="cursos_extras"
                    onUploadSuccess={(url) => {
                      if (!pendingCursoFecha) {
                        Swal.fire({
                          title: '¡Atención!',
                          text: 'Por favor, selecciona primero la fecha del certificado.',
                          icon: 'warning',
                          confirmButtonColor: '#059669',
                        });
                        return;
                      }

                      const courseDate = new Date(pendingCursoFecha);
                      const fiveYearsAgo = new Date();
                      fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

                      if (courseDate < fiveYearsAgo) {
                        Swal.fire({
                          title: 'Fecha no válida',
                          text: 'Lo sentimos, el certificado no debe tener más de 5 años de antigüedad.',
                          icon: 'error',
                          confirmButtonColor: '#059669',
                        });
                        return;
                      }

                      setFormData(prev => ({
                        ...prev,
                        cursos_extras: [...prev.cursos_extras, {
                          nombre: pendingCursoNombre.trim() || `Curso #${prev.cursos_extras.length + 1}`,
                          url,
                          fecha: pendingCursoFecha
                        }]
                      }))
                      setPendingCursoNombre('')
                      setPendingCursoFecha('')
                    }}
                    onClear={() => { }}
                  />
                </div>
              </div>

              {/* Sección de Otros Documentos */}
              <div className="transition-opacity transition-transform space-y-6 pt-4 fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center justify-between">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-3 mb-1"><div className="w-1.5 h-6 rounded-full bg-slate-500" /><div><h3 className="text-base md:text-lg font-black uppercase tracking-wider text-[#022c22]">Otros Documentos Relevantes</h3></div></div>
                    <p className="text-sm text-slate-600 font-medium ml-4.5 italic">Cualquier otra documentación que consideres relevante para tu aplicación</p>
                  </div>
                  <span className="text-xs font-bold text-slate-400 uppercase bg-slate-100 px-2.5 py-0.5 rounded-full">Opcional</span>
                </div>

                {/* Lista de otros cargados */}
                {formData.otros_docs.length > 0 && (
                  <div className="space-y-2">
                    {formData.otros_docs.map((doc, idx) => (
                      <div key={(doc as any).id || doc.url || `${doc.nombre}-${idx}`} className="group flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                          <FileText size={14} className="text-slate-600" />
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <input
                            type="text"
                            value={doc.nombre}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              otros_docs: prev.otros_docs.map((item, i) =>
                                i === idx ? { ...item, nombre: e.target.value } : item
                              )
                            }))}
                            placeholder="Nombre del documento..."
                            className="w-full text-sm font-bold text-slate-700 bg-transparent border-none outline-none focus:ring-0 placeholder:text-slate-400 truncate"
                          />
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1.5">
                              <Calendar size={10} className="text-slate-400" />
                              <input
                                type="date"
                                value={doc.fecha}
                                onChange={(e) => setFormData(prev => ({
                                  ...prev,
                                  otros_docs: prev.otros_docs.map((item, i) =>
                                    i === idx ? { ...item, fecha: e.target.value } : item
                                  )
                                }))}
                                className="text-xs font-medium text-slate-500 bg-transparent border-none p-0 focus:ring-0 w-24"
                              />
                            </div>
                            <a href={doc.url} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-emerald-500 font-bold hover:underline uppercase tracking-widest">
                              Ver archivo
                            </a>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, otros_docs: prev.otros_docs.filter((_, i) => i !== idx) }))}
                          className="p-1.5 hover:bg-rose-50 text-slate-300 hover:text-rose-500 rounded-lg transition-colors shrink-0"
                        >
                          <XCircle size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Input nombre + Fecha + Uploader para nuevo otro documento */}
                <div className="space-y-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs md:text-sm font-black uppercase tracking-wider text-slate-400 ml-1">Nombre del Documento</label>
                      <input
                        type="text"
                        value={pendingOtroNombre}
                        onChange={(e) => setPendingOtroNombre(e.target.value)}
                        placeholder="Nombre o descripción..."
                        className="w-full h-10 px-4 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400/40 focus:border-emerald-400 placeholder:text-slate-400 bg-white transition"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs md:text-sm font-black uppercase tracking-wider text-slate-400 ml-1">Fecha del Documento</label>
                      <div className="relative">
                        <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="date"
                          value={pendingOtroFecha}
                          max={new Date().toISOString().split('T')[0]}
                          onChange={(e) => setPendingOtroFecha(e.target.value)}
                          className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400/40 focus:border-emerald-400 bg-white transition"
                        />
                      </div>
                    </div>
                  </div>
                  <FileUpload
                    key={formData.otros_docs.length}
                    label="Cargar otro documento"
                    accept="image/*,.pdf"
                    folder="otros_docs"
                    onUploadSuccess={(url) => {
                      setFormData(prev => ({
                        ...prev,
                        otros_docs: [...prev.otros_docs, {
                          nombre: pendingOtroNombre.trim() || `Documento #${prev.otros_docs.length + 1}`,
                          url,
                          fecha: pendingOtroFecha
                        }]
                      }))
                      setPendingOtroNombre('')
                      setPendingOtroFecha('')
                    }}
                    onClear={() => { }}
                  />
                </div>
              </div>              {!isCorporativo && renderAcreditacionSection()}

              {/* SECCIÓN EMPRESA AL FINAL PARA CORPORATIVOS */}
              {isCorporativo && (
                <div className="space-y-6 pt-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-3 mb-1"><div className="w-1.5 h-6 rounded-full bg-emerald-600" /><div><h3 className="text-base md:text-lg font-black uppercase tracking-wider text-[#022c22]">Soportes de la Empresa</h3></div></div>
                    <p className="text-sm text-slate-600 font-medium ml-4.5 italic">RIF y Acta Constitutiva vigentes.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FileUpload
                      label="RIF de la Empresa"
                      accept="image/*,.pdf"
                      folder="afiliados/empresas"
                      required
                      initialUrl={formData.url_titulo || undefined}
                      onUploadSuccess={(url) => setFormData(prev => ({ ...prev, url_titulo: url }))}
                      onClear={() => setFormData(prev => ({ ...prev, url_titulo: '' }))}
                    />
                    <FileUpload
                      label="Acta Constitutiva"
                      accept=".pdf"
                      folder="afiliados/empresas"
                      required
                      maxSizeMB={10}
                      initialUrl={formData.url_registro_mercantil || undefined}
                      onUploadSuccess={(url) => setFormData(prev => ({ ...prev, url_registro_mercantil: url }))}
                      onClear={() => setFormData(prev => ({ ...prev, url_registro_mercantil: '' }))}
                    />
                  </div>
                </div>
              )}

              {isCorporativo && renderAcreditacionSection()}

              {/* SECCIÓN REFERENCIAS DE AFILIADOS AL FINAL */}
              {showReferencesSection && (
                <div className="transition-opacity transition-transform space-y-6 pt-4 fade-in slide-in-from-bottom-4 duration-500">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-3 mb-1">
                      <div className="w-1.5 h-6 rounded-full bg-emerald-600" />
                      <div>
                        <h3 className="text-base md:text-lg font-black uppercase tracking-wider text-[#022c22]">
                          Referencias de Afiliados Activos
                        </h3>
                      </div>
                    </div>
                    <p className="text-sm text-slate-600 font-medium ml-4.5 italic">
                      Adjunta dos cartas de recomendación moral emitidas por afiliados activos de la Cámara.
                      Puedes buscar por cédula personal o por RIF de empresa.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* ── Referencia 1 ─────────────────────────────────── */}
                    {([
                      {
                        label: 'Recomendante 1 (Opcional)',
                        tipo: searchTipo1,
                        setTipo: (t: TipoReferencia) => { setSearchTipo1(t); resetRef1() },
                        query: searchQuery1,
                        onQueryChange: handleRefQuery1Change,
                        searching: searching1,
                        selected: selectedAffiliate1,
                        notFound: notFound1,
                        urlField: 'url_referencia1' as const,
                        nameField: 'nombre_referencia1' as const,
                        uploadLabel: 'Carta de referencia 1',
                      },
                      {
                        label: 'Recomendante 2 (Opcional)',
                        tipo: searchTipo2,
                        setTipo: (t: TipoReferencia) => { setSearchTipo2(t); resetRef2() },
                        query: searchQuery2,
                        onQueryChange: handleRefQuery2Change,
                        searching: searching2,
                        selected: selectedAffiliate2,
                        notFound: notFound2,
                        urlField: 'url_referencia2' as const,
                        nameField: 'nombre_referencia2' as const,
                        uploadLabel: 'Carta de referencia 2',
                      },
                    ] as const).map((ref) => (
                      <div key={ref.urlField} className="space-y-4 bg-slate-50/50 p-5 rounded-2xl border border-slate-100/80">

                        {/* Label */}
                        <label className="text-xs md:text-sm font-black uppercase tracking-wider text-emerald-600 ml-1">
                          {ref.label.replace('(Opcional)', '(Obligatorio)')}
                        </label>

                        {/* Tipo dropdown + search input */}
                        <div className="flex gap-2 items-stretch">

                          {/* Dropdown tipo */}
                          <div className="relative shrink-0">
                            <select
                              value={ref.tipo}
                              onChange={e => ref.setTipo(e.target.value as TipoReferencia)}
                              className="h-10 pl-2 pr-6 min-w-[64px] rounded-xl border border-slate-200 text-xs font-black uppercase tracking-wider text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400 appearance-none cursor-pointer transition"
                            >
                              <option value="V">V</option>
                              <option value="E">E</option>
                              <option value="J">J</option>
                              <option value="G">G</option>
                              <option value="P">P</option>
                            </select>
                            <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" />
                          </div>

                          {/* Search input */}
                          <div className="relative group flex-1">
                            {ref.searching
                              ? <Loader2 size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-500 animate-spin" />
                              : <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                            }
                            <input
                              type="text"
                              value={ref.query}
                              onChange={e => ref.onQueryChange(e.target.value)}
                              placeholder="Ej: 12345678 (solo dígitos)"
                              className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400 placeholder:text-slate-400 bg-white transition"
                            />
                          </div>
                        </div>

                        {/* Preloaded reference display */}
                        {!ref.query && formData[ref.nameField] && (
                          <div className="transition-opacity flex items-start gap-2 p-2.5 bg-emerald-50/50 border border-emerald-100 rounded-xl text-emerald-800 text-xs font-bold fade-in duration-200">
                            <ShieldCheck size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                            <div className="min-w-0">
                              <span className="text-[11px] uppercase font-black tracking-widest block text-emerald-600 leading-none">Miembro Recomendante Cargado</span>
                              <span className="truncate block mt-0.5 font-bold">{formData[ref.nameField]}</span>
                            </div>
                          </div>
                        )}

                        {/* Result card */}
                        {ref.query.replace(/\D/g, '').length >= 5 && !ref.searching && (
                          <div className="transition-opacity transition-transform fade-in slide-in-from-top-1 duration-200">
                            {ref.selected ? (
                              <div className="flex items-start gap-2 p-2.5 bg-emerald-50/50 border border-emerald-100 rounded-xl text-emerald-800 text-xs font-bold">
                                <ShieldCheck size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                                <div className="min-w-0">
                                  <span className="text-[11px] uppercase font-black tracking-widest block text-emerald-600 leading-none">Miembro Activo Encontrado</span>
                                  <span className="truncate block mt-0.5 font-bold">{ref.selected.nombre_completo}</span>
                                  {['J', 'G'].includes(ref.tipo) && ref.selected.representante_nombre && (
                                    <span className="block mt-0.5 text-emerald-700 font-medium">Rep. Legal: {ref.selected.representante_nombre}</span>
                                  )}
                                  <span className="block mt-0.5 text-emerald-600 font-medium">
                                    {['J', 'G'].includes(ref.tipo)
                                      ? `RIF: ${ref.selected.empresa_rif_tipo ?? 'J'}-${ref.selected.empresa_rif_numero}`
                                      : `C.I.: ${ref.selected.cedula}`
                                    }
                                  </span>
                                </div>
                              </div>
                            ) : ref.notFound ? (
                              <div className="flex items-center gap-2 p-2.5 bg-rose-50/50 border border-rose-100 rounded-xl text-rose-800 text-xs font-bold">
                                <AlertCircle size={14} className="text-rose-500 shrink-0" />
                                <div>
                                  <span className="text-[11px] uppercase font-black tracking-widest block text-rose-600 leading-none">No encontrado</span>
                                  <span className="block mt-0.5">
                                    {['J', 'G'].includes(ref.tipo)
                                      ? 'No existe empresa afiliada activa con ese RIF.'
                                      : 'No existe afiliado activo con ese documento.'}
                                  </span>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        )}

                        <FileUpload
                          label={ref.uploadLabel}
                          accept="image/*,.pdf"
                          folder="afiliados/referencias"
                          initialUrl={formData[ref.urlField] || undefined}
                          initialFileName={formData[ref.nameField] || undefined}
                          onUploadSuccess={(url, fileName) => setFormData(prev => ({ ...prev, [ref.urlField]: url }))}
                          onClear={() => setFormData(prev => ({ ...prev, [ref.urlField]: '', [ref.nameField]: '' }))}
                        />
                      </div>
                    ))}

                  </div>
                </div>
              )}

              <div className="pt-6 border-t border-slate-100/80">
                <button type="submit" disabled={submitLoading} className={`w-full font-black rounded-xl flex items-center justify-center gap-3 transition-transform hover:-translate-y-0.5 shadow-xl bg-emerald-600 text-white disabled:opacity-60 uppercase tracking-widest text-sm ${INPUT_H}`}>
                  {submitLoading ? <Loader2 size={20} className="animate-spin" /> : <>Finalizar Registro<ArrowRight size={16} /></>}
                </button>
              </div>
            </form>
          )}

          {status === 'error' && (
            <div className="transition-opacity transition-transform flex flex-col items-center justify-center py-16 px-6 text-center space-y-8 fade-in zoom-in-95 duration-500 min-h-[50vh]">
              <div className="w-20 h-20 rounded-[2rem] flex items-center justify-center bg-rose-50 text-rose-500 shadow-xl shadow-rose-500/10">
                <XCircle size={44} strokeWidth={1.5} />
              </div>
              <div className="space-y-3 max-w-md">
                <h2 className="text-2xl font-black text-rose-950 uppercase tracking-tight">Error de Verificación</h2>
                <p className="text-slate-600 text-sm leading-relaxed">{message}</p>
              </div>
              <Link to="/" className={`px-8 flex items-center gap-2 rounded-xl bg-[#022c22] text-white font-black uppercase tracking-widest text-xs shadow-lg hover:-translate-y-1 transition-transform ${INPUT_H}`}>
                <Home size={16} /> Volver al Inicio
              </Link>
            </div>
          )}

          {status === 'success' && (
            <div className="transition-opacity transition-transform flex flex-col items-center py-16 text-center space-y-8 fade-in zoom-in duration-500">
              <div className="w-24 h-24 rounded-[2rem] flex items-center justify-center bg-emerald-50 text-emerald-500 shadow-xl shadow-emerald-500/10"><CheckCircle2 size={52} strokeWidth={1.5} /></div>
              <div className="space-y-3">
                <h2 className="text-3xl font-black text-[#022c22] uppercase tracking-tighter">
                  {isAfiliacion ? 'Solicitud Enviada' : '¡Preinscripción Exitosa!'}
                </h2>
                <p className="text-slate-600 text-sm md:text-base max-w-md mx-auto leading-relaxed">
                  {isAfiliacion
                    ? 'Tus documentos han sido cargados correctamente. La Cámara revisará tu perfil y se pondrá en contacto contigo para los siguientes pasos de tu afiliación.'
                    : userData?.programaCodigo === 'PEGI'
                      ? 'Hemos recibido tus documentos. Te enviaremos un correo con los detalles de la entrevista y el proceso de admisión al programa.'
                      : 'Hemos recibido tus documentos. La coordinación de formación revisará tu expediente y te enviaremos un correo con los detalles para la formalización y admisión al programa.'
                  }
                </p>
              </div>
              <Link to="/" className={`px-8 flex items-center gap-2 rounded-xl bg-[#022c22] text-white font-black uppercase tracking-widest text-xs shadow-lg hover:-translate-y-1 transition-transform ${INPUT_H}`}><Home size={16} />Volver al Inicio</Link>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
