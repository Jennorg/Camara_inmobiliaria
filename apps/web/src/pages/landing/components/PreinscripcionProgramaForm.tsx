import React, { useState, useEffect, useRef } from 'react'
import { Building2, User, Mail, Briefcase, Search, X, CheckCircle2, ArrowRight, Loader2, AlertCircle, Check } from 'lucide-react'
import AffiliationForm from '@/components/forms/AffiliationForm'
import { apiUrl } from '@/config/env'

interface Props {
  programaCodigo: string
  ctaLabel?: string
  initialData?: any
}

interface EmpresaAfiliada {
  id_afiliado: number
  nombre_completo: string
  empresa_razon_social?: string
  empresa_rif_numero?: string
  codigo?: string
  tipo_afiliado: string
  id_empresa?: number
}

const COUNTRIES = [
  { code: '+58', flag: '🇻🇪', label: 'Venezuela' },
  { code: '+1',  flag: '🇺🇸', label: 'USA' },
  { code: '+34', flag: '🇪🇸', label: 'España' },
  { code: '+57', flag: '🇨🇴', label: 'Colombia' },
  { code: '+1',  flag: '🇵🇷', label: 'Puerto Rico' },
]

const BOX_H = "h-[58px]"

export default function PreinscripcionProgramaForm({ programaCodigo, ctaLabel, initialData }: Props) {
  const [formData, setFormData] = useState({
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
  })

  const [tipoAfiliado, setTipoAfiliado] = useState<'Natural' | 'Agente Corporativo' | 'Corporativo'>('Natural')
  const isAgenteCorporativo = programaCodigo === 'AFILIACION' && tipoAfiliado === 'Agente Corporativo'
  const isCorporativo = programaCodigo === 'AFILIACION' && tipoAfiliado === 'Corporativo'

  // Búsqueda de empresa para Agente Corporativo
  const [searchType, setSearchType] = useState<'nombre' | 'rif'>('nombre')
  const [rifPrefix, setRifPrefix] = useState('J')
  const [empresaQuery, setEmpresaQuery] = useState('')
  const [empresaOptions, setEmpresaOptions] = useState<EmpresaAfiliada[]>([])
  const [empresaSelected, setEmpresaSelected] = useState<EmpresaAfiliada | null>(null)
  const [empresaLoading, setEmpresaLoading] = useState(false)
  const [empresaOpen, setEmpresaOpen] = useState(false)
  const [empresaPerformedSearch, setEmpresaPerformedSearch] = useState(false)
  const empresaRef = useRef<HTMLDivElement>(null)

  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Cerrar dropdown empresa al hacer click fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (empresaRef.current && !empresaRef.current.contains(e.target as Node)) {
        setEmpresaOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Buscar empresas afiliadas
  useEffect(() => {
    if (!isAgenteCorporativo || empresaQuery.trim().length < 2) {
      setEmpresaOptions([])
      setEmpresaLoading(false)
      setEmpresaPerformedSearch(false)
      return
    }
    setEmpresaLoading(true)
    setEmpresaPerformedSearch(false)
    setEmpresaOptions([]) // Limpiar resultados anteriores al iniciar nueva búsqueda
    const controller = new AbortController()
    fetch(apiUrl(`/api/public/afiliados/buscar`), { signal: controller.signal })
      .then(r => r.json())
      .then(json => {
        if (json.success) {
          const q = empresaQuery.trim().toLowerCase()
          const qDigits = q.replace(/\D/g, '') // Normalizar query (solo dígitos)
          
          const corporativas: EmpresaAfiliada[] = json.data
            .filter((a: any) => a.tipo_afiliado === 'Corporativo')
            .filter((a: any) => {
              const nombre = (a.empresa_razon_social || a.nombre_completo || '').toLowerCase()
              const rifNum = (a.empresa_rif_numero || '').toLowerCase()
              const rifNumDigits = rifNum.replace(/\D/g, '') // Normalizar RIF de DB
              const rifTipo = (a.empresa_rif_tipo || '').toLowerCase()
              
              if (searchType === 'rif') {
                const matchPrefix = rifTipo === rifPrefix.toLowerCase()
                // Comparar usando solo dígitos para permitir nomenclaturas con guión o sin él
                const matchNum = rifNumDigits.includes(qDigits)
                // Si coincide el prefijo y parte del número, o si el número coincide y no hay prefijo (fallback)
                return (matchPrefix && matchNum) || (matchNum && !rifTipo && qDigits.length > 0)
              }
              return nombre.includes(q) || rifNum.includes(q)
            })
            .slice(0, 8)
          setEmpresaOptions(corporativas)
          setEmpresaOpen(corporativas.length > 0)
        }
        setEmpresaPerformedSearch(true)
      })
      .catch(() => {})
      .finally(() => setEmpresaLoading(false))
    return () => controller.abort()
  }, [empresaQuery, isAgenteCorporativo, searchType, rifPrefix])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    if (isAgenteCorporativo && !empresaSelected) {
      setErrorMsg('Debes seleccionar la empresa a la que perteneces.')
      return
    }

    setLoading(true)
    try {
      const body: Record<string, any> = {
        programaCodigo,
        tipoAfiliado: tipoAfiliado,
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

      if (isAgenteCorporativo && empresaSelected) {
        body.id_empresa = empresaSelected.id_empresa
      }

      const res = await fetch(apiUrl('/api/public/preinscripciones'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'Error al registrar')
      
      const isDev = import.meta.env.MODE === 'development' || import.meta.env.DEV || import.meta.env.VITE_NODE_ENV === 'development'
      if (isDev && json.data?.token) {
        // Redirigir según el flujo correspondiente
        const redirectUrl = programaCodigo === 'AFILIACION' 
          ? `/cursos/verificar?token=${json.data.token}`
          : `/cursos/verificar?token=${json.data.token}` // Ambos usan el mismo verificador ahora
        
        window.location.href = redirectUrl
        return
      }

      setSubmitted(true)
    } catch (err: any) {
      let msg = err.message || 'Error al procesar el registro.'
      if (msg === 'Failed to fetch') {
        msg = 'No se pudo establecer conexión con el servidor. Por favor, comprueba tu conexión a internet.'
      }
      setErrorMsg(msg)
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
          <label className="text-xs font-black uppercase tracking-widest ml-1 text-emerald-100/60">Tipo de Afiliación</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-white/5 p-1.5 rounded-2xl border border-white/10">
            {([
              { val: 'Natural' as const, label: 'Agente Independiente', icon: User },
              { val: 'Agente Corporativo' as const, label: 'Agente Corporativo', icon: Building2 },
              { val: 'Corporativo' as const, label: 'Corporativo', icon: Building2 },
            ]).map(({ val, label, icon: Icon }) => (
              <button
                key={val}
                type="button"
                onClick={() => {
                  setTipoAfiliado(val)
                  setEmpresaSelected(null)
                  setEmpresaQuery('')
                }}
                className={`min-h-[56px] sm:min-h-[72px] px-4 py-2.5 sm:px-2 sm:py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex flex-row sm:flex-col items-center justify-center gap-3 sm:gap-2 text-center leading-tight ${
                  tipoAfiliado === val ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25' : 'text-white/40 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon size={18} className="shrink-0" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* Descripción contextual del tipo seleccionado */}
          <div className="text-[10px] font-medium px-3 py-2 rounded-lg transition-all text-emerald-300/90 bg-emerald-500/10 border border-emerald-500/20">
            {tipoAfiliado === 'Agente Corporativo'
              ? 'Agente que opera bajo una empresa ya afiliada a la Cámara'
              : tipoAfiliado === 'Corporativo'
              ? 'Registro de una nueva empresa o institución inmobiliaria que aún no está en la Cámara.'
              : 'Agente inmobiliario independiente que opera por cuenta propia.'}
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

          {/* Campo de búsqueda de empresa (solo Agente Corporativo) */}
          {isAgenteCorporativo && (
            <div className="space-y-2" ref={empresaRef}>
              <label className="text-[10px] font-black uppercase tracking-widest ml-1 text-emerald-100/60">
                Empresa a la que perteneces <span className="text-red-400">*</span>
              </label>

              {empresaSelected ? (
                <div className="flex items-center gap-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl px-5 py-4 animate-in fade-in slide-in-from-top-2 duration-300 shadow-lg shadow-emerald-500/5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                    <CheckCircle2 size={24} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] mb-0.5">Empresa Vinculada</p>
                    <p className="text-sm font-black text-white truncate leading-tight">
                      {empresaSelected.empresa_razon_social || empresaSelected.nombre_completo}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {empresaSelected.empresa_rif_numero && (
                        <span className="text-[10px] text-emerald-100/40 font-bold">
                          RIF: {empresaSelected.empresa_rif_numero}
                        </span>
                      )}
                      <span className="text-[10px] text-emerald-100/20">•</span>
                      <span className="text-[10px] text-emerald-500/80 font-black">
                        CÓDIGO: {empresaSelected.codigo || '—'}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setEmpresaSelected(null); setEmpresaQuery('') }}
                    className="p-2 text-white/20 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all flex-shrink-0"
                    title="Eliminar selección"
                  >
                    <X size={18} />
                  </button>
                </div>
              ) : (
                <div className="relative space-y-3">
                  {/* Selector de Criterio */}
                  <div className="flex gap-2 p-1 bg-white/5 border border-white/10 rounded-xl">
                    <button 
                      type="button" 
                      onClick={() => { 
                        setSearchType('nombre'); 
                        setEmpresaQuery(''); 
                        setEmpresaOptions([]); 
                        setEmpresaLoading(false);
                      }}
                      className={`flex-1 py-2 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all ${searchType === 'nombre' ? 'bg-emerald-500 text-white shadow-lg' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
                    >
                      Buscar por Nombre
                    </button>
                    <button 
                      type="button" 
                      onClick={() => { 
                        setSearchType('rif'); 
                        setEmpresaQuery(''); 
                        setEmpresaOptions([]); 
                        setEmpresaLoading(false);
                      }}
                      className={`flex-1 py-2 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all ${searchType === 'rif' ? 'bg-emerald-500 text-white shadow-lg' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
                    >
                      Buscar por RIF
                    </button>
                  </div>

                  <div className={`relative flex items-center border border-slate-200 rounded-xl overflow-hidden focus-within:border-emerald-500 shadow-sm ${BOX_H} bg-white transition-all`}>
                    {searchType === 'rif' && (
                      <select 
                        value={rifPrefix} 
                        onChange={(e) => {
                          setRifPrefix(e.target.value);
                          if (empresaQuery.length >= 2) setEmpresaLoading(true);
                        }}
                        className="bg-slate-50 border-r border-slate-200 px-4 h-full text-sm font-black text-slate-700 outline-none cursor-pointer hover:bg-slate-100 transition-colors"
                      >
                        {['J', 'G', 'C'].map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    )}
                    
                    <div className="flex items-center px-4 text-slate-400 shrink-0">
                      {empresaLoading ? <Loader2 size={16} className="animate-spin text-emerald-500" /> : <Search size={16} />}
                    </div>

                    <input
                      type="text"
                      value={empresaQuery}
                      onChange={e => {
                        const val = e.target.value;
                        setEmpresaQuery(val);
                        if (val.trim().length >= 2) {
                          setEmpresaLoading(true);
                          setEmpresaOptions([]); // Limpiar para evitar parpadeo de resultados viejos
                        } else {
                          setEmpresaLoading(false);
                          setEmpresaOptions([]);
                        }
                      }}
                      onFocus={() => empresaOptions.length > 0 && setEmpresaOpen(true)}
                      placeholder={searchType === 'nombre' ? "Ej: Inmobiliaria Bolívar..." : "00000000-0"}
                      className="flex-1 pr-5 h-full outline-none text-sm font-medium text-slate-800 bg-transparent placeholder:text-slate-400"
                    />
                  </div>

                  {/* Dropdown resultados */}
                  {empresaOpen && empresaOptions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-2xl border border-slate-200 shadow-2xl z-50 max-h-[280px] overflow-y-auto p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-200 origin-top">
                      {empresaOptions.map((emp) => (
                        <button
                          key={emp.id_afiliado}
                          type="button"
                          onClick={() => {
                            setEmpresaSelected(emp)
                            setEmpresaOpen(false)
                            setEmpresaQuery('')
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-emerald-50 transition-all rounded-xl group flex items-center gap-3"
                        >
                          <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-white transition-all shrink-0">
                            <Building2 size={18} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-black text-slate-800 truncate group-hover:text-emerald-700 transition-colors">
                              {emp.empresa_razon_social || emp.nombre_completo}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {emp.empresa_rif_numero && (
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                  RIF: {emp.empresa_rif_numero}
                                </span>
                              )}
                              <span className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">•</span>
                              <span className="text-[10px] text-emerald-600 font-black uppercase tracking-widest">
                                Cód: {emp.codigo || '—'}
                              </span>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {empresaQuery.length >= 2 && !empresaLoading && empresaPerformedSearch && empresaOptions.length === 0 && (
                    <p className="text-[10px] text-amber-300/80 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 mt-1 font-bold">
                      No se encontraron empresas afiliadas. Solo puedes elegir este tipo si tu empresa ya está registrada en la Cámara.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

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
                <button type="button" className="bg-slate-50 border-r border-slate-200 px-4 h-full flex items-center gap-2 text-sm font-black text-slate-700">
                  <span>{COUNTRIES.find(c => c.code === formData.phonePrefix)?.flag}</span>
                  <span>{formData.phonePrefix}</span>
                </button>
                <input type="tel" name="telefono" required value={formData.telefono} onChange={handleChange} placeholder="4XX 0000000" className="flex-1 px-5 h-full bg-white outline-none text-sm font-medium text-slate-800" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest ml-1 text-emerald-100/60">¿Eres actualmente corredor inmobiliario?</label>
              <div className={`grid grid-cols-2 bg-white/5 rounded-xl border border-white/10 overflow-hidden ${BOX_H}`}>
                {['si', 'no'].map(opt => (
                  <button key={opt} type="button" onClick={() => setFormData(prev => ({ ...prev, esCorredorInmobiliario: opt }))} className={`h-full text-[10px] font-black uppercase tracking-widest transition-all ${formData.esCorredorInmobiliario === opt ? 'bg-emerald-500 text-white shadow-lg' : 'text-white/30 hover:text-white hover:bg-white/5'}`}>
                    {opt === 'si' ? 'Sí, lo soy' : 'No'}
                  </button>
                ))}
              </div>
            </div>

            {!['AFILIACION', 'CIBIR'].includes(programaCodigo) && (
              <>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-1 text-emerald-100/60">Nivel Académico</label>
                  <div className={`flex border border-slate-200 rounded-xl overflow-hidden focus-within:border-emerald-500 shadow-sm ${BOX_H}`}>
                    <select name="nivelProfesional" value={formData.nivelProfesional} onChange={handleChange} className="flex-1 px-5 h-full bg-white outline-none text-sm font-medium text-slate-800">
                      <option value="">Selecciona tu nivel</option>
                      <option value="Bachiller">Bachiller</option>
                      <option value="TSU">TSU</option>
                      <option value="Nivel Profesional">Nivel Profesional</option>
                      <option value="Postgrado">Postgrado</option>
                    </select>
                  </div>
                </div>

                {formData.nivelProfesional !== 'Bachiller' && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest ml-1 text-emerald-100/60">Profesión</label>
                    <div className="relative group">
                      <Briefcase size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                      <input type="text" name="profesion" value={formData.profesion} onChange={handleChange} placeholder="Ej. Abogado, Ingeniero" className={`w-full pl-11 pr-5 ${BOX_H} bg-white rounded-xl outline-none border border-slate-200 text-slate-800 focus:border-emerald-500 shadow-sm text-sm font-medium`} />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

        {/* Botón Submit */}
        <button type="submit" disabled={loading || (isAgenteCorporativo && !empresaSelected)} className={`w-full ${BOX_H} rounded-xl flex items-center justify-center gap-3 transition-all hover:-translate-y-0.5 shadow-xl bg-emerald-600 text-white hover:bg-[#022c22] disabled:opacity-50 disabled:cursor-not-allowed font-black uppercase tracking-widest text-xs`}>
          {loading
            ? <Loader2 size={18} className="animate-spin" />
            : isAgenteCorporativo
              ? <><Building2 size={16} />Enviar Solicitud como Agente Corporativo<ArrowRight size={14} /></>
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
