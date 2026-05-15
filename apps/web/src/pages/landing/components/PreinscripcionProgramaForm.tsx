import React, { useState } from 'react'
import { Building2, User, Mail, Briefcase, GraduationCap, School, Award, ChevronDown, Check, ArrowRight, Loader2, AlertCircle, Info, UserCheck } from 'lucide-react'
import AffiliationForm from '@/components/forms/AffiliationForm'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

interface Props {
  programaCodigo: string
  ctaLabel?: string
  initialData?: any
}

const COUNTRIES = [
  { code: '+58', flag: '🇻🇪', label: 'Venezuela' },
  { code: '+1',  flag: '🇺🇸', label: 'USA' },
  { code: '+34', flag: '🇪🇸', label: 'España' },
  { code: '+57', flag: '🇨🇴', label: 'Colombia' },
  { code: '+5 Panama', flag: '🇵🇦', label: 'Panamá' },
  { code: '+1',  flag: '🇵🇷', label: 'Puerto Rico' },
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
    esCorredorInmobiliario: initialData?.esCorredorInmobiliario === true ? 'si' : initialData?.esCorredorInmobiliario === false ? 'no' : '',
    nivelProfesional: initialData?.nivelProfesional || '',
    profesion: initialData?.profesion || '',
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

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
            esCorredorInmobiliario: formData.esCorredorInmobiliario === 'si',
            nivelProfesional: formData.nivelProfesional || null,
            profesion: formData.profesion.trim() || null,
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
      <div className="text-center py-20 px-6 animate-in fade-in zoom-in duration-500">
        <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-8 ring-8 ring-emerald-500/5">
          <Check className="text-emerald-400" size={40} />
        </div>
        <h3 className="text-3xl font-black text-white mb-4 uppercase tracking-tighter italic">¡Solicitud Enviada!</h3>
        <p className="text-emerald-100/60 max-w-md mx-auto leading-relaxed font-medium">
          Hemos recibido tus datos. Te enviamos un correo electrónico para confirmar tu dirección y continuar con el proceso.
        </p>
        <p className="mt-6 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400/40">
          Revisa tu bandeja de entrada o SPAM
        </p>
      </div>
    )
  }

  return (
    <div className="pb-10 space-y-8">
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

      {isCorporativo ? (
        <AffiliationForm 
          programaCodigo={programaCodigo} 
          onSuccess={() => setSubmitted(true)}
        />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest ml-1 text-emerald-100/60">Nombres</label>
              <div className="relative group">
                <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                <input type="text" name="nombres" required value={formData.nombres} onChange={handleChange} placeholder="Ej. Carlos" className={`w-full pl-11 pr-5 ${BOX_H} bg-white rounded-xl outline-none border border-slate-200 text-slate-800 focus:border-emerald-500 shadow-sm text-sm font-medium`} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest ml-1 text-emerald-100/60">Apellidos</label>
              <div className="relative group">
                <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                <input type="text" name="apellidos" required value={formData.apellidos} onChange={handleChange} placeholder="Ej. Mendoza" className={`w-full pl-11 pr-5 ${BOX_H} bg-white rounded-xl outline-none border border-slate-200 text-slate-800 focus:border-emerald-500 shadow-sm text-sm font-medium`} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest ml-1 text-emerald-100/60">Cédula de Identidad</label>
              <div className={`flex border border-slate-200 rounded-xl overflow-hidden focus-within:border-emerald-500 shadow-sm ${BOX_H}`}>
                <select name="cedulaPrefix" value={formData.cedulaPrefix} onChange={handleChange} className="bg-slate-50 border-r border-slate-200 px-4 h-full text-sm font-black text-slate-700 outline-none">
                  {['V', 'E'].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <input type="text" name="cedulaNumber" required value={formData.cedulaNumber} onChange={handleChange} placeholder="00000000" className="flex-1 px-5 h-full bg-white outline-none text-sm font-medium text-slate-800" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest ml-1 text-emerald-100/60">Correo Electrónico</label>
              <div className="relative group">
                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                <input type="email" name="email" required value={formData.email} onChange={handleChange} placeholder="usuario@ejemplo.com" className={`w-full pl-11 pr-5 ${BOX_H} bg-white rounded-xl outline-none border border-slate-200 text-slate-800 focus:border-emerald-500 shadow-sm text-sm font-medium`} />
              </div>
            </div>

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

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest ml-1 text-emerald-100/60">Nivel Académico</label>
              <div className={`flex border border-slate-200 rounded-xl overflow-hidden focus-within:border-emerald-500 shadow-sm ${BOX_H}`}>
                <select name="nivelProfesional" value={formData.nivelProfesional} onChange={handleChange} className="flex-1 px-5 h-full bg-white outline-none text-sm font-medium text-slate-800">
                  <option value="">Selecciona tu nivel</option>
                  <option value="Bachiller">Bachiller</option>
                  <option value="TSU">TSU</option>
                  <option value="Universitario">Universitario</option>
                  <option value="Postgrado">Postgrado</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest ml-1 text-emerald-100/60">Profesión</label>
              <div className="relative group">
                <Briefcase size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                <input type="text" name="profesion" value={formData.profesion} onChange={handleChange} placeholder="Ej. Abogado, Ingeniero" className={`w-full pl-11 pr-5 ${BOX_H} bg-white rounded-xl outline-none border border-slate-200 text-slate-800 focus:border-emerald-500 shadow-sm text-sm font-medium`} />
              </div>
            </div>
          </div>

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
      )}
    </div>
  )
}
