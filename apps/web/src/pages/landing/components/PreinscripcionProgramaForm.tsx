import React, { useState, useEffect } from 'react'
import { Building2, User, Mail, Briefcase, Search, X, CheckCircle2, ArrowRight, Loader2, AlertCircle, Check } from 'lucide-react'
import AffiliationForm from '@/components/forms/AffiliationForm'
import CompanySearchSelector from '@/components/CompanySearchSelector'
import { apiUrl } from '@/config/env'
import { apiFetch } from '@/lib/apiClient'

interface Props {
  programaCodigo: string
  ctaLabel?: string
  initialData?: any
}

interface EmpresaAfiliada {
  id_afiliado: number
  id_empresa?: number
  nombre_completo: string
  empresa_razon_social?: string
  empresa_rif_numero?: string
  codigo?: string
  tipo_afiliado: string
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
  const [allEmpresas, setAllEmpresas] = useState<any[]>([])
  const [empresaSelected, setEmpresaSelected] = useState<EmpresaAfiliada | null>(null)

  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Cargar lista de empresas para Agente Corporativo
  useEffect(() => {
    if (!isAgenteCorporativo) return
    let isMounted = true

    Promise.all([
      apiFetch(apiUrl('/api/public/empresas')).catch(() => ({ success: false, data: [] })),
      apiFetch(apiUrl('/api/public/afiliados/buscar')).catch(() => ({ success: false, data: [] }))
    ]).then(([resEmpresas, resAfiliados]) => {
      if (!isMounted) return
      const rawList: any[] = []
      if (resEmpresas.success && Array.isArray(resEmpresas.data)) {
        rawList.push(...resEmpresas.data.map((e: any) => ({
          id_empresa: e.id_empresa,
          razon_social: e.razon_social,
          rif_numero: e.rif_numero,
          rif_tipo: e.rif_tipo,
          representante_legal: e.representante_legal,
          codigo: e.codigo
        })))
      }
      if (resAfiliados.success && Array.isArray(resAfiliados.data)) {
        const corpAfiliados = resAfiliados.data
          .filter((a: any) => a.tipo_afiliado === 'Corporativo')
          .map((a: any) => ({
            id_empresa: a.id_empresa || a.id_afiliado,
            razon_social: a.empresa_razon_social || a.nombre_completo,
            rif_numero: a.empresa_rif_numero || '',
            rif_tipo: a.empresa_rif_tipo || 'J',
            representante_legal: a.representante_nombre || a.nombre_completo,
            codigo: a.codigo
          }))
        rawList.push(...corpAfiliados)
      }

      const seen = new Set<string>()
      const uniqueList = rawList.filter(e => {
        const key = String(e.id_empresa)
        if (!e.id_empresa || seen.has(key)) return false
        seen.add(key)
        return true
      })
      setAllEmpresas(uniqueList)
    })

    return () => { isMounted = false }
  }, [isAgenteCorporativo])

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
      <div className="transition-opacity transition-transform text-center py-20 px-6 fade-in zoom-in duration-500">
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
                }}
                className={`min-h-[56px] sm:min-h-[72px] px-4 py-2.5 sm:px-2 sm:py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors flex flex-row sm:flex-col items-center justify-center gap-3 sm:gap-2 text-center leading-tight ${
                  tipoAfiliado === val ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25' : 'text-white/40 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon size={18} className="shrink-0" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* Descripción contextual del tipo seleccionado */}
          <div className="text-[10px] font-medium px-3 py-2 rounded-lg transition-colors text-emerald-300/90 bg-emerald-500/10 border border-emerald-500/20">
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
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest ml-1 text-emerald-100/60">
                Empresa a la que perteneces <span className="text-red-400">*</span>
              </label>
              <CompanySearchSelector
                empresas={allEmpresas}
                selectedId={empresaSelected ? String(empresaSelected.id_empresa) : ''}
                onSelect={(id, company) => {
                  if (!id || !company) {
                    setEmpresaSelected(null);
                  } else {
                    setEmpresaSelected({
                      id_afiliado: Number(company.id_empresa),
                      id_empresa: Number(company.id_empresa),
                      nombre_completo: company.razon_social || company.empresa_razon_social || company.nombre_completo || '',
                      empresa_razon_social: company.razon_social || company.empresa_razon_social,
                      empresa_rif_numero: company.rif_numero || company.empresa_rif_numero,
                      codigo: company.codigo || company.empresa_codigo,
                      tipo_afiliado: 'Corporativo'
                    });
                  }
                }}
                darkTheme={false}
              />
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
                  <button key={opt} type="button" onClick={() => setFormData(prev => ({ ...prev, esCorredorInmobiliario: opt }))} className={`h-full text-[10px] font-black uppercase tracking-widest transition-colors ${formData.esCorredorInmobiliario === opt ? 'bg-emerald-500 text-white shadow-lg' : 'text-white/30 hover:text-white hover:bg-white/5'}`}>
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
        <button type="submit" disabled={loading || (isAgenteCorporativo && !empresaSelected)} className={`w-full ${BOX_H} rounded-xl flex items-center justify-center gap-3 transition-colors transition-transform hover:-translate-y-0.5 shadow-xl bg-emerald-600 text-white hover:bg-[#022c22] disabled:opacity-50 disabled:cursor-not-allowed font-black uppercase tracking-widest text-xs`}>
          {loading
            ? <Loader2 size={18} className="animate-spin" />
            : isAgenteCorporativo
              ? <><Building2 size={16} />Enviar Solicitud como Agente Corporativo<ArrowRight size={14} /></>
              : (ctaLabel ?? 'Enviar Solicitud')
          }
        </button>

          {errorMsg && (
            <div className="flex items-center gap-2 text-white bg-red-600 border border-red-700 p-4 rounded-xl text-xs font-bold justify-center shadow-md shadow-red-600/20">
              <AlertCircle size={16} className="text-white shrink-0" />
              {errorMsg}
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
