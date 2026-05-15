import React, { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Loader2, ArrowRight, Home, GraduationCap, Briefcase, Award, School, ChevronDown, XCircle, FileText, AlertCircle, Calendar, ShieldCheck, Check } from 'lucide-react'
import { API_URL } from '@/config/env'
import Swal from 'sweetalert2'
import FileUpload from '@/components/common/FileUpload'
import Navbar from '@/pages/landing/components/navbar/Navbar'
import Footer from '@/pages/landing/components/Footer'

const NIVELES = [
  { value: 'Bachiller', label: 'Bachiller', icon: School },
  { value: 'TSU', label: 'Técnico Superior (TSU)', icon: Briefcase },
  { value: 'Universitario', label: 'Universitario', icon: GraduationCap },
  { value: 'Postgrado', label: 'Postgrado', icon: Award },
]

const INPUT_H = "h-[62px]" // Altura unificada

export default function VerificarPreinscripcionProgramaPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [status, setStatus] = useState<'loading' | 'verifying' | 'form' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('Verificando tu enlace...')
  const [userData, setUserData] = useState<any>(null)
  const [darkMode, setDarkMode] = useState(false)
  const [showNivelDropdown, setShowNivelDropdown] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    nivelProfesional: '' as 'Bachiller' | 'TSU' | 'Universitario' | 'Postgrado' | '',
    profesion: '',
    url_titulo: '',
    url_cv: '',
    url_registro_mercantil: '',
    url_titulo_representante: '',
    especializaciones: [] as { nombre: string; url: string; fecha: string }[],
    cursos_extras: [] as { nombre: string; url: string; fecha: string }[],
  })
  const [pendingCursoNombre, setPendingCursoNombre] = useState('')
  const [pendingCursoFecha, setPendingCursoFecha] = useState('')
  const [pendingEspecializacionNombre, setPendingEspecializacionNombre] = useState('')
  const [pendingEspecializacionFecha, setPendingEspecializacionFecha] = useState('')
  const [submitLoading, setSubmitLoading] = useState(false)

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('No se encontró el token de verificación en la URL.')
      return
    }
    const verificarToken = async () => {
      try {
        const res = await fetch(`${API_URL}/api/public/preinscripciones/token/${token}`)
        const json = await res.json()
        if (res.ok && json.success) {
          setUserData(json.data)
          
          // Si es uno de los 4 grandes cursos, saltamos el formulario y confirmamos automáticamente
          if (['PADI', 'PEGI', 'PREANI', 'CIBIR'].includes(json.data.programaCodigo)) {
            submitConfirmation({ token })
          } else {
            setFormData(prev => ({
              ...prev,
              nivelProfesional: (json.data.nivelProfesional as any) || '',
              profesion: json.data.profesion || '',
              url_titulo: '',
              url_cv: '',
              url_registro_mercantil: '',
              url_titulo_representante: '',
              especializaciones: [],
              cursos_extras: [],
            }))
            setStatus('form')
          }
        } else {
          setStatus('error')
          setMessage(json.message || 'Token inválido.')
        }
      } catch {
        setStatus('error')
        setMessage('Error de conexión.')
      }
    }
    verificarToken()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const isAfiliacion = userData?.programaCodigo === 'AFILIACION'
  const isCorporativo = isAfiliacion && userData?.tipoAfiliado === 'Corporativo'
  const isPostgrado = formData.nivelProfesional === 'Postgrado'
  const currentNivel = NIVELES.find(n => n.value === formData.nivelProfesional)
  const displayName = userData?.nombreCompleto

  const submitConfirmation = async (dataToSubmit: any) => {
    setSubmitLoading(true)
    setStatus('verifying')
    try {
      const res = await fetch(`${API_URL}/api/public/preinscripciones/confirmar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSubmit),
      })
      const json = await res.json()
      if (res.ok && json.success) setStatus('success')
      else { setStatus('error'); setMessage(json.message); }
    } catch { setStatus('error'); setMessage('Error de conexión.'); }
    finally { setSubmitLoading(false); }
  }

  const handleConfirmar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return

    if (isCorporativo) {
      if (!formData.url_titulo) {
        Swal.fire({ title: '¡Atención!', text: 'Por favor, carga el RIF de la Empresa.', icon: 'warning', confirmButtonColor: '#059669' });
        return;
      }
      if (!formData.url_registro_mercantil) {
        Swal.fire({ title: '¡Atención!', text: 'Por favor, carga el Registro Mercantil de la Empresa.', icon: 'warning', confirmButtonColor: '#059669' });
        return;
      }
      if (!formData.url_titulo_representante) {
        Swal.fire({ title: '¡Atención!', text: 'Por favor, carga el Título Académico del Representante Legal.', icon: 'warning', confirmButtonColor: '#059669' });
        return;
      }
    } else {
      if (!formData.url_cv) {
        Swal.fire({ title: '¡Atención!', text: 'Por favor, carga tu Resumen Curricular.', icon: 'warning', confirmButtonColor: '#059669' });
        return;
      }
      if (!formData.url_titulo) {
        Swal.fire({ title: '¡Atención!', text: 'Por favor, carga tu Título Académico.', icon: 'warning', confirmButtonColor: '#059669' });
        return;
      }
    }

    if (formData.nivelProfesional === 'Postgrado' && formData.especializaciones.length === 0) {
      Swal.fire({
        title: 'Documentación incompleta',
        text: 'Como indicaste que tienes nivel de Postgrado, es obligatorio cargar al menos un soporte de especialización o maestría.',
        icon: 'info',
        confirmButtonColor: '#059669'
      });
      return
    }

    submitConfirmation({
      token,
      nivelProfesional: formData.nivelProfesional,
      profesion: formData.profesion.trim(),
      url_titulo: formData.url_titulo,
      url_cv: formData.url_cv,
      url_registro_mercantil: formData.url_registro_mercantil,
      url_titulo_representante: formData.url_titulo_representante,
      especializaciones: JSON.stringify(formData.especializaciones),
      cursos_extras: JSON.stringify(formData.cursos_extras),
    });
  }

  const selectedNivel = NIVELES.find(n => n.value === userData?.nivel_profesional)
  const programaLabel = userData?.programaCodigo === 'AFILIACION' ? 'la Cámara Inmobiliaria' : (userData?.programaCodigo || 'CIEBO')
  const tituloLabel = userData?.programaCodigo === 'AFILIACION' ? 'Solicitud de Afiliación' : `Programa ${userData?.programaCodigo}`

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar darkMode={darkMode} setDarkMode={setDarkMode} />
      <section className="relative bg-[#022c22] pt-28 pb-16 overflow-hidden text-center">
        <div className="relative z-10 max-w-4xl mx-auto px-6">
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-white"><CheckCircle2 size={16} /></div><span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Paso 1</span></div>
            <div className="w-12 h-px bg-emerald-500/30" />
            <div className="flex items-center gap-2"><div className={`w-8 h-8 rounded-lg flex items-center justify-center ${status === 'success' ? 'bg-emerald-500' : 'bg-emerald-500/20 border border-emerald-500/40'}`}>{status === 'success' ? <CheckCircle2 size={16} className="text-white" /> : <span className="text-emerald-400 text-xs font-black">2</span>}</div><span className="text-[10px] font-black uppercase tracking-widest text-emerald-100/60">Paso 2</span></div>
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-white uppercase tracking-tighter mb-3">
            {status === 'success' ? '¡Todo Listo!' : (isAfiliacion ? 'Validación de Afiliado' : 'Completa tu Perfil')}
          </h1>
          <p className="text-white/90 text-sm max-w-lg mx-auto">
            {status === 'form' && userData
              ? <>Hola <span className="text-white font-bold">{displayName || 'aspirante'}</span>, falta poco para finalizar tu <span className="text-emerald-400 font-bold">{isAfiliacion ? 'solicitud de afiliación' : `inscripción al programa ${programaLabel}`}</span>.</>
              : message
            }
          </p>
        </div>
      </section>

      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-6 py-12">
          {status === 'form' && userData && (
            <form onSubmit={handleConfirmar} className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">

              <div className="space-y-2">
                <h2 className="text-xl font-black text-[#022c22] uppercase tracking-tight">Carga de Documentación</h2>
                <p className="text-slate-500 text-xs leading-relaxed">
                  Para finalizar tu proceso, por favor verifica tu nivel académico y adjunta los archivos solicitados.
                </p>
              </div>

              {!isCorporativo && (
                <>
                  {/* Selector de Nivel Académico */}
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3 mb-1"><div className="w-1 h-6 rounded-full bg-blue-600" /><div><h3 className="text-xs font-black uppercase tracking-[0.2em] text-[#022c22]">Nivel Académico Alcanzado</h3></div></div>
                      <p className="text-[10px] text-slate-400 font-medium ml-4 italic">Confirma tu grado de instrucción actual.</p>
                    </div>

                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowNivelDropdown(!showNivelDropdown)}
                        className={`w-full px-5 flex items-center justify-between bg-white border-2 transition-all duration-300 rounded-2xl ${showNivelDropdown ? 'border-blue-500 ring-4 ring-blue-500/10' : 'border-slate-100 hover:border-blue-300'} ${INPUT_H}`}
                      >
                        <div className="flex items-center gap-3">
                          {currentNivel ? (
                            <>
                              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                                <currentNivel.icon size={18} />
                              </div>
                              <span className="text-sm font-bold text-slate-700">{currentNivel.label}</span>
                            </>
                          ) : (
                            <span className="text-sm font-bold text-slate-400 italic">Selecciona tu nivel académico...</span>
                          )}
                        </div>
                        <ChevronDown size={20} className={`text-slate-400 transition-transform duration-300 ${showNivelDropdown ? 'rotate-180' : ''}`} />
                      </button>

                      {showNivelDropdown && (
                        <div className="absolute z-50 w-full mt-2 bg-white border border-slate-100 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                          <div className="p-2 grid grid-cols-1 gap-1">
                            {NIVELES.map((nivel) => (
                              <button
                                key={nivel.value}
                                type="button"
                                onClick={() => {
                                  setFormData(prev => ({ ...prev, nivelProfesional: nivel.value as any }))
                                  setShowNivelDropdown(false)
                                }}
                                className={`flex items-center gap-4 p-3 rounded-xl transition-all ${formData.nivelProfesional === nivel.value ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-50 text-slate-600'}`}
                              >
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${formData.nivelProfesional === nivel.value ? 'bg-white/20' : 'bg-slate-100'}`}>
                                  <nivel.icon size={20} />
                                </div>
                                <div className="flex flex-col items-start">
                                  <span className="text-sm font-bold">{nivel.label}</span>
                                  {formData.nivelProfesional === nivel.value && <span className="text-[10px] opacity-80 font-black uppercase tracking-widest">Seleccionado</span>}
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
                      <div className="space-y-1">
                        <div className="flex items-center gap-3 mb-1"><div className="w-1 h-6 rounded-full bg-blue-400" /><div><h3 className="text-xs font-black uppercase tracking-[0.2em] text-[#022c22]">Área de Especialización</h3></div></div>
                        <p className="text-[10px] text-slate-400 font-medium ml-4 italic">Indica el área de especialización de tu título.</p>
                      </div>
                      <div className="relative group">
                        <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors">
                          <Briefcase size={18} />
                        </div>
                        <input
                          type="text"
                          required
                          value={formData.profesion}
                          onChange={(e) => setFormData(prev => ({ ...prev, profesion: e.target.value }))}
                          placeholder="Ej. Derecho, Ingeniería, Administración..."
                          className={`w-full pl-14 pr-5 bg-white border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-bold text-slate-700 ${INPUT_H}`}
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
                      <div className="space-y-1">
                        <div className="flex items-center gap-3 mb-1"><div className="w-1 h-6 rounded-full bg-blue-600" /><div><h3 className="text-xs font-black uppercase tracking-[0.2em] text-[#022c22]">Representante Legal</h3></div></div>
                        <p className="text-[10px] text-slate-400 font-medium ml-4 italic">Información profesional y soportes de identidad.</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Selector de Nivel Académico (Inyectado aquí para Corporativos) */}
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Nivel Académico</label>
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setShowNivelDropdown(!showNivelDropdown)}
                              className={`w-full px-4 flex items-center justify-between bg-white border-2 transition-all duration-300 rounded-xl ${showNivelDropdown ? 'border-blue-500 ring-4 ring-blue-500/10' : 'border-slate-100 hover:border-blue-300'} h-[50px]`}
                            >
                              <div className="flex items-center gap-2">
                                {currentNivel ? (
                                  <>
                                    <currentNivel.icon size={14} className="text-blue-600" />
                                    <span className="text-xs font-bold text-slate-700">{currentNivel.label}</span>
                                  </>
                                ) : (
                                  <span className="text-xs font-bold text-slate-400 italic">Nivel...</span>
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
                                      className={`flex items-center gap-3 p-2 rounded-lg transition-all ${formData.nivelProfesional === nivel.value ? 'bg-blue-600 text-white' : 'hover:bg-slate-50 text-slate-600'}`}
                                    >
                                      <nivel.icon size={14} />
                                      <span className="text-[11px] font-bold">{nivel.label}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Área de Especialización (Inyectado aquí para Corporativos) */}
                        {formData.nivelProfesional && formData.nivelProfesional !== 'Bachiller' && (
                          <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Área de Especialización</label>
                            <div className="relative group">
                              <Briefcase size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                              <input
                                type="text"
                                required
                                value={formData.profesion}
                                onChange={(e) => setFormData(prev => ({ ...prev, profesion: e.target.value }))}
                                placeholder="Ej. Derecho, Ingeniería, Administración..."
                                className="w-full pl-10 pr-4 bg-white border-2 border-slate-100 rounded-xl outline-none focus:border-blue-500 transition-all text-xs font-bold text-slate-700 h-[50px]"
                              />
                            </div>
                          </div>
                        )}

                        <div className="md:col-span-2">
                          <FileUpload
                            label="Título del Representante"
                            accept="image/*,.pdf"
                            folder="afiliados/representantes"
                            onUploadSuccess={(url) => setFormData(prev => ({ ...prev, url_titulo_representante: url }))}
                            onClear={() => setFormData(prev => ({ ...prev, url_titulo_representante: '' }))}
                          />
                        </div>
                      </div>
                    </div>

                  </>
                ) : (
                  <div className="space-y-6">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3 mb-1"><div className="w-1 h-6 rounded-full bg-emerald-600" /><div><h3 className="text-xs font-black uppercase tracking-[0.2em] text-[#022c22]">Documentación Obligatoria</h3></div></div>
                      <p className="text-[10px] text-slate-400 font-medium ml-4 italic">Estos documentos son indispensables para validar tu perfil.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FileUpload
                        label="Resumen Curricular (CV)"
                        accept=".pdf"
                        folder="cvs"
                        required
                        onUploadSuccess={(url) => setFormData(prev => ({ ...prev, url_cv: url }))}
                        onClear={() => setFormData(prev => ({ ...prev, url_cv: '' }))}
                      />
                      <FileUpload
                        label="Título Académico"
                        accept="image/*,.pdf"
                        folder="titulos"
                        required
                        onUploadSuccess={(url) => setFormData(prev => ({ ...prev, url_titulo: url }))}
                        onClear={() => setFormData(prev => ({ ...prev, url_titulo: '' }))}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Sección de Especializaciones (Solo si es Postgrado) */}
              {isPostgrado && (
                <div className="space-y-6 pt-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3 mb-1"><div className="w-1 h-6 rounded-full bg-blue-600" /><div><h3 className="text-xs font-black uppercase tracking-[0.2em] text-[#022c22]">Postgrados</h3></div></div>
                      <p className="text-[10px] text-slate-400 font-medium ml-4 italic">Si posees estudios adicionales de postgrado, puedes registrarlos aquí.</p>
                    </div>

                  </div>
                  <div className="space-y-4">
                    {/* Lista de especializaciones cargadas */}
                    {formData.especializaciones.length > 0 && (
                      <div className="space-y-2">
                        {formData.especializaciones.map((esp, idx) => (
                          <div key={idx} className="group flex items-center gap-3 p-3 bg-blue-50/50 border border-blue-100 rounded-xl">
                            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                              <FileText size={14} className="text-blue-600" />
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
                                className="w-full text-xs font-bold text-slate-700 bg-transparent border-none outline-none focus:ring-0 placeholder:text-slate-400 truncate"
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
                                    className="text-[10px] font-medium text-slate-500 bg-transparent border-none p-0 focus:ring-0 w-24"
                                  />
                                </div>
                                <a href={esp.url} target="_blank" rel="noopener noreferrer"
                                  className="text-[9px] text-blue-500 font-bold hover:underline uppercase tracking-widest">
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
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Nombre del Postgrado</label>
                          <input
                            type="text"
                            value={pendingEspecializacionNombre}
                            onChange={(e) => setPendingEspecializacionNombre(e.target.value)}
                            placeholder="Especialidad (ej: Maestría en Finanzas)..."
                            className="w-full h-10 px-4 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400 placeholder:text-slate-400 bg-white transition"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Fecha de Finalización</label>
                          <div className="relative">
                            <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                              type="date"
                              value={pendingEspecializacionFecha}
                              onChange={(e) => setPendingEspecializacionFecha(e.target.value)}
                              className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400 bg-white transition"
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
                  <div className="space-y-1">
                    <div className="flex items-center gap-3 mb-1"><div className="w-1 h-6 rounded-full bg-amber-500" /><div><h3 className="text-xs font-black uppercase tracking-[0.2em] text-[#022c22]">Otros Cursos Realizados</h3></div></div>
                    <p className="text-[10px] text-slate-400 font-medium ml-4 italic">Certificados de cursos, talleres o seminarios relevantes de los últimos 5 años</p>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-100 px-2 py-0.5 rounded-full">Opcional</span>
                </div>

                {/* Lista de cursos cargados */}
                {formData.cursos_extras.length > 0 && (
                  <div className="space-y-2">
                    {formData.cursos_extras.map((curso, idx) => (
                      <div key={idx} className="group flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
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
                                i === idx ? { ...c, nombre: e.target.value } : c
                              )
                            }))}
                            placeholder="Nombre del curso..."
                            className="w-full text-xs font-bold text-slate-700 bg-transparent border-none outline-none focus:ring-0 placeholder:text-slate-400 truncate"
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
                                className="text-[10px] font-medium text-slate-500 bg-transparent border-none p-0 focus:ring-0 w-24"
                              />
                            </div>
                            <a href={curso.url} target="_blank" rel="noopener noreferrer"
                              className="text-[9px] text-blue-500 font-bold hover:underline uppercase tracking-widest">
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
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Nombre del Curso</label>
                      <input
                        type="text"
                        value={pendingCursoNombre}
                        onChange={(e) => setPendingCursoNombre(e.target.value)}
                        placeholder="Nombre del curso (ej: Valuación Inmobiliaria UCAB)..."
                        className="w-full h-10 px-4 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-blue-400 placeholder:text-slate-400 bg-white transition"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Fecha del Certificado</label>
                      <div className="relative">
                        <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="date"
                          value={pendingCursoFecha}
                          max={new Date().toISOString().split('T')[0]}
                          min={new Date(new Date().setFullYear(new Date().getFullYear() - 5)).toISOString().split('T')[0]}
                          onChange={(e) => setPendingCursoFecha(e.target.value)}
                          className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-blue-400 bg-white transition"
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

              {/* SECCIÓN EMPRESA AL FINAL PARA CORPORATIVOS */}
              {isCorporativo && (
                <div className="space-y-6 pt-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3 mb-1"><div className="w-1 h-6 rounded-full bg-emerald-600" /><div><h3 className="text-xs font-black uppercase tracking-[0.2em] text-[#022c22]">Soportes de la Empresa</h3></div></div>
                    <p className="text-[10px] text-slate-400 font-medium ml-4 italic">RIF y Registro Mercantil vigentes.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FileUpload
                      label="RIF de la Empresa"
                      accept="image/*,.pdf"
                      folder="afiliados/empresas"
                      required
                      onUploadSuccess={(url) => setFormData(prev => ({ ...prev, url_titulo: url }))}
                      onClear={() => setFormData(prev => ({ ...prev, url_titulo: '' }))}
                    />
                    <FileUpload
                      label="Registro Mercantil"
                      accept=".pdf"
                      folder="afiliados/empresas"
                      required
                      onUploadSuccess={(url) => setFormData(prev => ({ ...prev, url_registro_mercantil: url }))}
                      onClear={() => setFormData(prev => ({ ...prev, url_registro_mercantil: '' }))}
                    />
                  </div>
                </div>
              )}
              <button type="submit" disabled={submitLoading || (isCorporativo ? (!formData.url_titulo || !formData.url_registro_mercantil || !formData.url_titulo_representante) : (!formData.url_cv || !formData.url_titulo)) || (formData.nivelProfesional === 'Postgrado' && formData.especializaciones.length === 0)} className={`w-full font-black rounded-xl flex items-center justify-center gap-3 transition-all hover:-translate-y-0.5 shadow-xl bg-emerald-600 text-white disabled:opacity-60 uppercase tracking-widest text-xs ${INPUT_H}`}>
                {submitLoading ? <Loader2 size={20} className="animate-spin" /> : <>Finalizar Registro<ArrowRight size={16} /></>}
              </button>
            </form>
          )}

          {status === 'verifying' && (
            <div className="flex flex-col items-center py-16 text-center space-y-8 animate-in fade-in duration-500">
              <Loader2 size={48} className="animate-spin text-emerald-600" />
              <div className="space-y-2">
                <h2 className="text-xl font-black text-[#022c22] uppercase tracking-tight">Procesando Solicitud</h2>
                <p className="text-slate-500 text-xs leading-relaxed">Por favor espera un momento mientras cargamos tus datos y generamos tu expediente...</p>
              </div>
            </div>
          )}

          {status === 'success' && (
            <div className="flex flex-col items-center py-16 text-center space-y-8 animate-in fade-in zoom-in duration-500">
              <div className="w-24 h-24 rounded-[2rem] flex items-center justify-center bg-emerald-50 text-emerald-500 shadow-xl shadow-emerald-500/10"><CheckCircle2 size={52} strokeWidth={1.5} /></div>
              <div className="space-y-3">
                <h2 className="text-3xl font-black text-[#022c22] uppercase tracking-tighter">
                  {isAfiliacion ? 'Solicitud Enviada' : '¡Preinscripción Exitosa!'}
                </h2>
                <p className="text-slate-500 max-w-md mx-auto leading-relaxed">
                  {isAfiliacion
                    ? 'Tus documentos han sido cargados correctamente. La Cámara revisará tu perfil y se pondrá en contacto contigo para los siguientes pasos de tu afiliación.'
                    : 'Hemos recibido tus documentos. Te enviaremos un correo con los detalles de la entrevista y el proceso de admisión al programa.'
                  }
                </p>
              </div>
              <Link to="/" className={`px-8 flex items-center gap-2 rounded-xl bg-[#022c22] text-white font-black uppercase tracking-widest text-[10px] shadow-lg hover:-translate-y-1 transition-all ${INPUT_H}`}><Home size={16} />Volver al Inicio</Link>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
