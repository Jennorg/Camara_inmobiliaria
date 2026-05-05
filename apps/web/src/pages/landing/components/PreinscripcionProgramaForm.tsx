import React, { useState } from 'react'
import { User, Mail, CheckCircle2, Loader2, AlertCircle, ChevronDown, GraduationCap, School, Award, Briefcase, Check, Building2, UserCheck, ArrowRight, Info } from 'lucide-react'
import { API_URL } from '@/config/env'

type ProgramaCodigo = 'PADI' | 'PEGI' | 'PREANI' | 'CIBIR' | 'AFILIACION'

interface Props {
  programaCodigo: ProgramaCodigo
  ctaLabel?: string
  initialData?: Partial<{
    nombreCompleto: string
    email: string
    telefono: string
    cedulaRif: string
    nivelProfesional: string
    esCorredorInmobiliario: boolean
  }>
}

const COUNTRIES = [
  { code: '+58', flag: '🇻🇪', label: 'Venezuela' },
  { code: '+57', flag: '🇨🇴', label: 'Colombia' },
  { code: '+34', flag: '🇪🇸', label: 'España' },
  { code: '+1',  flag: '🇺🇸', label: 'Estados Unidos' },
  { code: '+507',flag: '🇵🇦', label: 'Panamá' },
  { code: '+52', flag: '🇲🇽', label: 'México' },
  { code: '+54', flag: '🇦🇷', label: 'Argentina' },
  { code: '+56', flag: '🇨🇱', label: 'Chile' },
  { code: '+51', flag: '🇵🇪', label: 'Perú' },
  { code: '+593',flag: '🇪🇨', label: 'Ecuador' },
  { code: '+1',  flag: '🇩🇴', label: 'Rep. Dominicana' },
  { code: '+506',flag: '🇨🇷', label: 'Costa Rica' },
  { code: '+502',flag: '🇬🇹', label: 'Guatemala' },
  { code: '+504',flag: '🇭🇳', label: 'Honduras' },
  { code: '+503',flag: '🇸🇻', label: 'El Salvador' },
  { code: '+505',flag: '🇳🇮', label: 'Nicaragua' },
  { code: '+595',flag: '🇵🇾', label: 'Paraguay' },
  { code: '+598',flag: '🇺🇾', label: 'Uruguay' },
  { code: '+591',flag: '🇧🇴', label: 'Bolivia' },
  { code: '+1',  flag: '🇵🇷', label: 'Puerto Rico' },
]

const NIVELES = [
  { value: 'Bachiller', label: 'Bachiller', icon: School },
  { value: 'TSU', label: 'Técnico Superior (TSU)', icon: Briefcase },
  { value: 'Universitario', label: 'Universitario', icon: GraduationCap },
  { value: 'Postgrado', label: 'Postgrado', icon: Award },
]

const BOX_H = "h-[58px]"

export default function PreinscripcionProgramaForm({ programaCodigo, ctaLabel, initialData }: Props) {
  const [formData, setFormData] = useState({
    // Campos Natural
    nombres: initialData?.nombreCompleto?.split(' ')[0] || '',
    apellidos: initialData?.nombreCompleto?.split(' ').slice(1).join(' ') || '',
    cedulaPrefix: initialData?.cedulaRif?.includes('-') ? initialData.cedulaRif.split('-')[0] : 'V',
    cedulaNumber: initialData?.cedulaRif?.includes('-') ? initialData.cedulaRif.split('-')[1] : (initialData?.cedulaRif || ''),
    email: initialData?.email || '',
    phonePrefix: '+58',
    telefono: '',
    nivelProfesional: initialData?.nivelProfesional || '',
    profesion: '',
    esCorredorInmobiliario: initialData?.esCorredorInmobiliario === true ? 'si' : initialData?.esCorredorInmobiliario === false ? 'no' : '',
    // Campos exclusivos Corporativo
    razonSocial: '',
    rifPrefix: 'J',
    rifNumber: '',
    representanteNombres: '',
    representanteApellidos: '',
    cedulaRepresentante: '',
    emailRepresentante: '',
    emailEmpresa: '',
  })
  const [tipoAfiliado, setTipoAfiliado] = useState<'Natural' | 'Corporativo'>('Natural')
  const isCorporativo = programaCodigo === 'AFILIACION' && tipoAfiliado === 'Corporativo'
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [showCountryDropdown, setShowCountryDropdown] = useState(false)
  const [showNivelDropdown, setShowNivelDropdown] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    // Para Natural: validar nivel profesional
    if (!isCorporativo && !formData.nivelProfesional) {
      setErrorMsg('Por favor, selecciona tu nivel profesional.')
      return
    }

    setLoading(true)
    try {
      const body = isCorporativo
        ? {
            programaCodigo,
            tipoAfiliado: 'Corporativo',
            razonSocial: formData.razonSocial.trim(),
            rif_tipo: formData.rifPrefix,
            rif_numero: formData.rifNumber.replace(/\D/g, ''),
            cedulaRif: `${formData.rifPrefix}-${formData.rifNumber.replace(/\D/g, '')}`,
            email: formData.emailEmpresa,
            telefono: `${formData.phonePrefix}${formData.telefono.replace(/\D/g, '')}`,
            representanteLegal: `${formData.representanteNombres} ${formData.representanteApellidos}`.trim(),
            representanteLegalNombres: formData.representanteNombres.trim(),
            representanteLegalApellidos: formData.representanteApellidos.trim(),
            cedulaRepresentante: formData.cedulaRepresentante.trim(),
            emailRepresentante: formData.emailRepresentante.trim(),
          }
        : {
            programaCodigo,
            tipoAfiliado: 'Natural',
            nombres: formData.nombres.trim(),
            apellidos: formData.apellidos.trim(),
            nombreCompleto: `${formData.nombres} ${formData.apellidos}`.trim(),
            cedulaRif: `${formData.cedulaPrefix}-${formData.cedulaNumber.replace(/\D/g, '')}`,
            email: formData.email,
            telefono: `${formData.phonePrefix}${formData.telefono.replace(/\D/g, '')}`,
            nivelProfesional: formData.nivelProfesional,
            profesion: formData.profesion.trim(),
            esCorredorInmobiliario: formData.esCorredorInmobiliario === 'si',
          }

      const res = await fetch(`${API_URL}/api/public/preinscripciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'Error al registrar')
      setSubmitted(true)
    } catch (err: any) {
      setErrorMsg(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="py-10 flex flex-col items-center text-center space-y-5">
        <div className="w-16 h-16 rounded-full flex items-center justify-center bg-emerald-50 text-emerald-500">
          <CheckCircle2 size={34} />
        </div>
        <h3 className="text-2xl font-black text-white uppercase tracking-tighter">
          {isCorporativo ? '¡Empresa Registrada!' : '¡Paso 1 Completado!'}
        </h3>
        <p className="text-sm text-emerald-100/80 max-w-sm leading-relaxed">
          {isCorporativo
            ? <>Revisaremos la solicitud de <span className="font-bold text-white">{formData.razonSocial}</span>. Una vez aprobada, podrás invitar a tus afiliados por correo.</>
            : <>Revisa tu bandeja de entrada en <span className="font-bold text-white">{formData.email}</span>. Te enviamos un enlace para continuar con los documentos.</>
          }
        </p>
      </div>
    )
  }

  const selectedNivel = NIVELES.find(n => n.value === formData.nivelProfesional)

  return (
    <div className="pb-10">
      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Selector Tipo Afiliado */}
        {programaCodigo === 'AFILIACION' && (
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest ml-1 text-emerald-100/60">Tipo de Afiliación</label>
            <div className="grid grid-cols-2 gap-2 bg-white/5 p-1 rounded-xl border border-white/10 h-[52px]">
              {([
                { val: 'Natural', label: 'Independiente', icon: User },
                { val: 'Corporativo', label: 'Corporativo', icon: Building2 },
              ] as const).map(({ val, label, icon: Icon }) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setTipoAfiliado(val)}
                  className={`h-full rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                    tipoAfiliado === val ? 'bg-emerald-500 text-white shadow-lg' : 'text-white/40 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon size={13} />
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════
            FORMULARIO CORPORATIVO
        ══════════════════════════════════ */}
        {isCorporativo && (
          <>
            {/* Banner informativo corporativo */}
            <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-left">
              <Info size={16} className="text-emerald-400 mt-0.5 shrink-0" />
              <p className="text-[11px] leading-relaxed text-emerald-100/80">
                <span className="font-black text-emerald-300 block mb-0.5 uppercase tracking-wide">Flujo Corporativo</span>
                Registra tu empresa primero. Una vez aprobada por la Cámara, recibirás un enlace para invitar a tus afiliados individuales.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Razón Social */}
              <div className="space-y-2 md:col-span-2">
                <label className="text-[10px] font-black uppercase tracking-widest ml-1 text-emerald-100/60">Razón Social</label>
                <div className="relative group">
                  <Building2 size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                  <input type="text" name="razonSocial" required value={formData.razonSocial} onChange={handleChange} placeholder="Ej. Inversiones Mendoza, C.A." className={`w-full pl-11 pr-5 ${BOX_H} bg-white rounded-xl outline-none border border-slate-200 text-slate-800 focus:border-emerald-500 shadow-sm text-sm font-medium`} />
                </div>
              </div>

              {/* RIF Empresa */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest ml-1 text-emerald-100/60">RIF de la Empresa</label>
                <div className={`flex border border-slate-200 rounded-xl overflow-hidden focus-within:border-emerald-500 shadow-sm ${BOX_H}`}>
                  <select name="rifPrefix" value={formData.rifPrefix} onChange={handleChange} className="bg-slate-50 border-r border-slate-200 px-4 h-full text-sm font-black text-slate-700 outline-none">
                    {['J', 'G', 'C'].map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <input type="text" name="rifNumber" required value={formData.rifNumber} onChange={handleChange} placeholder="000000000" className="flex-1 px-5 h-full bg-white outline-none text-sm font-medium text-slate-800" />
                </div>
              </div>

              {/* Email Empresa */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest ml-1 text-emerald-100/60">Correo Corporativo</label>
                <div className="relative group">
                  <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                  <input type="email" name="emailEmpresa" required value={formData.emailEmpresa} onChange={handleChange} placeholder="info@empresa.com" className={`w-full pl-11 pr-5 ${BOX_H} bg-white rounded-xl outline-none border border-slate-200 text-slate-800 focus:border-emerald-500 shadow-sm text-sm font-medium`} />
                </div>
              </div>

              {/* Representante Legal + Cédula + Email */}
              <div className="space-y-4 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-1 text-emerald-100/60">Nombres del Representante</label>
                  <div className="relative group">
                    <UserCheck size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                    <input type="text" name="representanteNombres" required value={formData.representanteNombres} onChange={handleChange} placeholder="Ej. Carlos" className={`w-full pl-11 pr-5 ${BOX_H} bg-white rounded-xl outline-none border border-slate-200 text-slate-800 focus:border-emerald-500 shadow-sm text-sm font-medium`} />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-1 text-emerald-100/60">Apellidos del Representante</label>
                  <div className="relative group">
                    <UserCheck size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                    <input type="text" name="representanteApellidos" required value={formData.representanteApellidos} onChange={handleChange} placeholder="Ej. Mendoza" className={`w-full pl-11 pr-5 ${BOX_H} bg-white rounded-xl outline-none border border-slate-200 text-slate-800 focus:border-emerald-500 shadow-sm text-sm font-medium`} />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-1 text-emerald-100/60">Cédula del Representante</label>
                  <div className="relative group">
                    <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                    <input type="text" name="cedulaRepresentante" required value={formData.cedulaRepresentante} onChange={handleChange} placeholder="00000000" className={`w-full pl-11 pr-5 ${BOX_H} bg-white rounded-xl outline-none border border-slate-200 text-slate-800 focus:border-emerald-500 shadow-sm text-sm font-medium`} />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-1 text-emerald-100/60">Correo del Representante</label>
                  <div className="relative group">
                    <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                    <input type="email" name="emailRepresentante" required value={formData.emailRepresentante} onChange={handleChange} placeholder="personal@representante.com" className={`w-full pl-11 pr-5 ${BOX_H} bg-white rounded-xl outline-none border border-slate-200 text-slate-800 focus:border-emerald-500 shadow-sm text-sm font-medium`} />
                  </div>
                </div>
                {/* Teléfono (Ahora dentro del grid del representante) */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-1 text-emerald-100/60">Teléfono del Representante</label>
                  <div className={`flex border border-slate-200 rounded-xl overflow-hidden focus-within:border-emerald-500 shadow-sm ${BOX_H}`}>
                    <button type="button" onClick={() => setShowCountryDropdown(!showCountryDropdown)} className="bg-slate-50 border-r border-slate-200 px-4 h-full flex items-center gap-2 text-sm font-black text-slate-700">
                      <span>{COUNTRIES.find(c => c.code === formData.phonePrefix)?.flag}</span>
                      <span>{formData.phonePrefix}</span>
                    </button>
                    <input type="tel" name="telefono" required value={formData.telefono} onChange={handleChange} placeholder="4XX 0000000" className="flex-1 px-5 h-full bg-white outline-none text-sm font-medium text-slate-800" />
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ══════════════════════════════════
            FORMULARIO INDEPENDIENTE (Natural o no-Afiliacion)
        ══════════════════════════════════ */}
        {!isCorporativo && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Nombres */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest ml-1 text-emerald-100/60">Nombres</label>
              <div className="relative group">
                <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                <input type="text" name="nombres" required value={formData.nombres} onChange={handleChange} placeholder="Ej. Carlos" className={`w-full pl-11 pr-5 ${BOX_H} bg-white rounded-xl outline-none border border-slate-200 text-slate-800 focus:border-emerald-500 shadow-sm text-sm font-medium`} />
              </div>
            </div>

            {/* Apellidos */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest ml-1 text-emerald-100/60">Apellidos</label>
              <div className="relative group">
                <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                <input type="text" name="apellidos" required value={formData.apellidos} onChange={handleChange} placeholder="Ej. Mendoza" className={`w-full pl-11 pr-5 ${BOX_H} bg-white rounded-xl outline-none border border-slate-200 text-slate-800 focus:border-emerald-500 shadow-sm text-sm font-medium`} />
              </div>
            </div>

            {/* Cédula */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest ml-1 text-emerald-100/60">Cédula de Identidad</label>
              <div className={`flex border border-slate-200 rounded-xl overflow-hidden focus-within:border-emerald-500 shadow-sm ${BOX_H}`}>
                <select name="cedulaPrefix" value={formData.cedulaPrefix} onChange={handleChange} className="bg-slate-50 border-r border-slate-200 px-4 h-full text-sm font-black text-slate-700 outline-none">
                  {['V', 'E'].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <input type="text" name="cedulaNumber" required value={formData.cedulaNumber} onChange={handleChange} placeholder="00000000" className="flex-1 px-5 h-full bg-white outline-none text-sm font-medium text-slate-800" />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest ml-1 text-emerald-100/60">Correo Electrónico</label>
              <div className="relative group">
                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                <input type="email" name="email" required value={formData.email} onChange={handleChange} placeholder="usuario@ejemplo.com" className={`w-full pl-11 pr-5 ${BOX_H} bg-white rounded-xl outline-none border border-slate-200 text-slate-800 focus:border-emerald-500 shadow-sm text-sm font-medium`} />
              </div>
            </div>

            {/* Teléfono */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest ml-1 text-emerald-100/60">Teléfono</label>
              <div className={`flex border border-slate-200 rounded-xl overflow-hidden focus-within:border-emerald-500 shadow-sm ${BOX_H}`}>
                <button type="button" onClick={() => setShowCountryDropdown(!showCountryDropdown)} className="bg-slate-50 border-r border-slate-200 px-4 h-full flex items-center gap-2 text-sm font-black text-slate-700">
                  <span>{COUNTRIES.find(c => c.code === formData.phonePrefix)?.flag}</span>
                  <span>{formData.phonePrefix}</span>
                </button>
                <input type="tel" name="telefono" required value={formData.telefono} onChange={handleChange} placeholder="4XX 0000000" className="flex-1 px-5 h-full bg-white outline-none text-sm font-medium text-slate-800" />
              </div>
            </div>

            {/* Profesión */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest ml-1 text-emerald-100/60">Profesión</label>
              <div className="relative group">
                <Briefcase size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                <input type="text" name="profesion" required value={formData.profesion} onChange={handleChange} placeholder="Ej. Abogado, Ingeniero..." className={`w-full pl-11 pr-5 ${BOX_H} bg-white rounded-xl outline-none border border-slate-200 text-slate-800 focus:border-emerald-500 shadow-sm text-sm font-medium`} />
              </div>
            </div>
          </div>
        )}

        {/* NIVEL PROFESIONAL + CORREDOR — Solo para no-corporativos */}
        {!isCorporativo && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* Dropdown Custom Nivel */}
            <div className="space-y-2 relative">
              <label className="text-[10px] font-black uppercase tracking-widest ml-1 text-emerald-100/60">Nivel Profesional</label>
              <button
                type="button"
                onClick={() => setShowNivelDropdown(!showNivelDropdown)}
                className={`w-full px-4 ${BOX_H} bg-white rounded-xl border transition-all flex items-center justify-between group shadow-sm ${
                  showNivelDropdown ? 'border-emerald-500 ring-4 ring-emerald-500/10' : 'border-slate-200 hover:border-emerald-400'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${selectedNivel ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400 group-hover:text-emerald-500'}`}>
                    {selectedNivel ? <selectedNivel.icon size={18} /> : <Briefcase size={18} />}
                  </div>
                  <span className={`text-sm font-bold ${selectedNivel ? 'text-slate-800' : 'text-slate-300'}`}>
                    {selectedNivel ? selectedNivel.label : 'Selecciona una opción'}
                  </span>
                </div>
                <ChevronDown size={18} className={`text-slate-400 transition-transform duration-300 ${showNivelDropdown ? 'rotate-180 text-emerald-500' : ''}`} />
              </button>

              {showNivelDropdown && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowNivelDropdown(false)} />
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-1.5 space-y-1">
                      {NIVELES.map(n => (
                        <button key={n.value} type="button" onClick={() => { setFormData(prev => ({ ...prev, nivelProfesional: n.value })); setShowNivelDropdown(false) }} className={`w-full flex items-center justify-between px-4 h-[50px] rounded-xl transition-all ${formData.nivelProfesional === n.value ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'}`}>
                          <div className="flex items-center gap-3">
                            <n.icon size={18} className={formData.nivelProfesional === n.value ? 'text-white' : 'text-slate-400'} />
                            <span className="text-xs font-black uppercase tracking-tight">{n.label}</span>
                          </div>
                          {formData.nivelProfesional === n.value && <Check size={16} />}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Selector Corredor */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest ml-1 text-emerald-100/60">¿Eres corredor inmobiliario?</label>
              <div className={`grid grid-cols-2 bg-white/5 rounded-xl border border-white/10 overflow-hidden ${BOX_H}`}>
                {['si', 'no'].map(opt => (
                  <button key={opt} type="button" onClick={() => setFormData(prev => ({ ...prev, esCorredorInmobiliario: opt }))} className={`h-full text-[10px] font-black uppercase tracking-widest transition-all ${formData.esCorredorInmobiliario === opt ? 'bg-emerald-500 text-white shadow-lg' : 'text-white/30 hover:text-white hover:bg-white/5'}`}>
                    {opt === 'si' ? 'Sí, lo soy' : 'No'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Botón Submit */}
        <button type="submit" disabled={loading} className={`w-full ${BOX_H} rounded-xl flex items-center justify-center gap-3 transition-all hover:-translate-y-0.5 shadow-xl bg-emerald-600 text-white hover:bg-[#022c22] disabled:opacity-50 font-black uppercase tracking-widest text-xs`}>
          {loading
            ? <Loader2 size={18} className="animate-spin" />
            : isCorporativo
              ? <><Building2 size={16} />Registrar Empresa<ArrowRight size={14} /></>
              : (ctaLabel ?? 'Enviar Solicitud')
          }
        </button>

        {errorMsg && (
          <div className="flex items-center gap-2 text-red-100 bg-red-500/20 border border-red-400/40 p-4 rounded-xl text-xs font-bold justify-center">
            <AlertCircle size={14} />{errorMsg}
          </div>
        )}


        <p className="text-[9px] text-center uppercase tracking-[0.2em] font-bold text-emerald-100/40">
          Cámara Inmobiliaria • Todos los derechos reservados • 2026
        </p>
      </form>
    </div>
  )
}
