import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Building2, User, Mail, CheckCircle2, Loader2, AlertCircle,
  ChevronDown, GraduationCap, School, Award, Briefcase, Check,
  ShieldCheck, ArrowRight
} from 'lucide-react'
import { API_URL } from '@/config/env'
import Navbar from '@/pages/landing/components/navbar/Navbar'
import Footer from '@/pages/landing/components/Footer'

const NIVELES = [
  { value: 'Bachiller', label: 'Bachiller', icon: School },
  { value: 'TSU', label: 'Técnico Superior (TSU)', icon: Briefcase },
  { value: 'Nivel Profesional', label: 'Nivel Profesional', icon: GraduationCap },
  { value: 'Postgrado', label: 'Postgrado', icon: Award },
]

const BOX_H = 'h-[58px]'

type Status = 'loading' | 'form' | 'success' | 'error'

export default function InvitacionCorporativaPage() {
  const { token } = useParams<{ token: string }>()

  const [darkMode, setDarkMode] = useState(false)
  const [status, setStatus] = useState<Status>('loading')
  const [empresa, setEmpresa] = useState<{ nombreEmpresa: string; idEmpresa: number } | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [submitLoading, setSubmitLoading] = useState(false)
  const [showNivelDropdown, setShowNivelDropdown] = useState(false)

  const [form, setForm] = useState({
    nombres: '',
    apellidos: '',
    cedulaPrefix: 'V',
    cedulaNumber: '',
    email: '',
    phonePrefix: '+58',
    telefono: '',
    nivelProfesional: '',
    profesion: '',
    esCorredorInmobiliario: '',
  })

  useEffect(() => {
    let active = true
    if (!token) { setStatus('error'); setErrorMsg('Token de invitación no encontrado.'); return }
    const controller = new AbortController()
    const validar = async () => {
      try {
        const res = await fetch(`${API_URL}/api/public/invitaciones/${token}`, { signal: controller.signal })
        const json = await res.json()
        if (!active || controller.signal.aborted) return
        if (res.ok && json.success) {
          setEmpresa(json.data)
          setStatus('form')
        } else {
          setStatus('error')
          setErrorMsg(json.message || 'Invitación inválida o expirada.')
        }
      } catch (err: unknown) {
        if (!active || (err as Error).name === 'AbortError' || controller.signal.aborted) return
        setStatus('error')
        setErrorMsg('Error de conexión. Intenta más tarde.')
      }
    }
    validar()
    return () => {
      active = false
      controller.abort()
    }
  }, [token])

  const selectedNivel = NIVELES.find(n => n.value === form.nivelProfesional)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nivelProfesional || !form.esCorredorInmobiliario) {
      setErrorMsg('Por favor completa todos los campos.')
      return
    }
    setErrorMsg('')
    setSubmitLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/public/invitaciones/${token}/registrar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombres: form.nombres.trim(),
          apellidos: form.apellidos.trim(),
          nombreCompleto: `${form.nombres} ${form.apellidos}`.trim(),
          cedulaRif: `${form.cedulaPrefix}-${form.cedulaNumber}`,
          email: form.email,
          telefono: `${form.phonePrefix}${form.telefono}`,
          nivelProfesional: form.nivelProfesional,
          profesion: form.profesion.trim(),
          esCorredorInmobiliario: form.esCorredorInmobiliario === 'si',
        }),
      })
      const json = await res.json()
      if (res.ok && json.success) {
        const isDev = import.meta.env.MODE === 'development' || import.meta.env.DEV || import.meta.env.VITE_NODE_ENV === 'development'
        if (isDev && json.data?.token) {
          window.location.href = `/cursos/verificar?token=${json.data.token}`
          return
        }
        setStatus('success')
      } else {
        setErrorMsg(json.message || 'Error al registrar.')
      }
    } catch {
      setErrorMsg('Error de conexión.')
    } finally {
      setSubmitLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar darkMode={darkMode} setDarkMode={setDarkMode} />

      {/* Hero */}
      <section className="bg-[#022c22] pt-28 pb-14 text-center">
        <div className="max-w-2xl mx-auto px-6">
          <div className="inline-flex items-center gap-2 mb-6 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <Building2 size={14} className="text-emerald-400" />
            <span className="text-xs font-black uppercase tracking-widest text-emerald-400">Invitación Corporativa</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tighter mb-3">
            {status === 'success' ? '¡Registro Completado!' : empresa ? `Únete a ${empresa.nombreEmpresa}` : 'Invitación de Afiliación'}
          </h1>
          {empresa && status === 'form' && (
            <p className="text-white/70 text-sm">
              <span className="font-bold text-emerald-400">{empresa.nombreEmpresa}</span> te ha invitado a registrarte como afiliado a la Cámara Inmobiliaria.
            </p>
          )}
        </div>
      </section>

      <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-12">

        {/* Loading */}
        {status === 'loading' && (
          <div className="flex flex-col items-center py-20 gap-4 text-slate-400">
            <Loader2 size={36} className="animate-spin text-emerald-500" />
            <p className="text-sm">Validando invitación...</p>
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div className="flex flex-col items-center py-20 gap-5 text-center">
            <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center text-red-400">
              <AlertCircle size={32} />
            </div>
            <h2 className="text-xl font-black text-slate-800 uppercase">Invitación no válida</h2>
            <p className="text-slate-500 text-sm max-w-sm">{errorMsg}</p>
            <Link to="/" className="px-6 py-3 rounded-xl bg-[#022c22] text-white text-xs font-black uppercase tracking-widest">
              Volver al inicio
            </Link>
          </div>
        )}

        {/* Success */}
        {status === 'success' && (
          <div className="flex flex-col items-center py-16 gap-6 text-center">
            <div className="w-20 h-20 rounded-[2rem] bg-emerald-50 flex items-center justify-center text-emerald-500">
              <CheckCircle2 size={44} strokeWidth={1.5} />
            </div>
            <h2 className="text-2xl font-black text-[#022c22] uppercase tracking-tight">¡Todo listo!</h2>
            <p className="text-slate-500 text-sm max-w-sm leading-relaxed">
              Hemos registrado tu información. <span className="font-bold text-emerald-600">Revisa tu correo electrónico</span> para completar tu perfil y cargar tus documentos obligatorios (Cédula y Título).
            </p>
            <Link to="/" className={`px-8 flex items-center gap-2 rounded-xl bg-[#022c22] text-white font-black uppercase tracking-widest text-[10px] shadow-lg ${BOX_H}`}>
              Volver al Inicio
            </Link>
          </div>
        )}

        {/* Formulario */}
        {status === 'form' && empresa && (
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Banner empresa */}
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-emerald-50 border border-emerald-100 shadow-sm">
              <div className="w-11 h-11 rounded-xl bg-emerald-600 flex items-center justify-center text-white shrink-0">
                <ShieldCheck size={20} />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-emerald-600">Empresa invitante</p>
                <p className="text-sm font-black text-[#022c22]">{empresa.nombreEmpresa}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Nombres */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest ml-1 text-slate-500">Nombres</label>
                <div className="relative">
                  <User size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input required type="text" value={form.nombres} onChange={e => setForm(p => ({ ...p, nombres: e.target.value }))}
                    placeholder="Ej. Ana" className={`w-full pl-11 pr-5 ${BOX_H} bg-white rounded-xl border border-slate-200 outline-none focus:border-emerald-500 text-slate-800 text-sm font-medium shadow-sm`} />
                </div>
              </div>

              {/* Apellidos */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest ml-1 text-slate-500">Apellidos</label>
                <div className="relative">
                  <User size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input required type="text" value={form.apellidos} onChange={e => setForm(p => ({ ...p, apellidos: e.target.value }))}
                    placeholder="Ej. García" className={`w-full pl-11 pr-5 ${BOX_H} bg-white rounded-xl border border-slate-200 outline-none focus:border-emerald-500 text-slate-800 text-sm font-medium shadow-sm`} />
                </div>
              </div>

              {/* Cédula */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest ml-1 text-slate-500">Cédula de Identidad</label>
                <div className={`flex border border-slate-200 rounded-xl overflow-hidden focus-within:border-emerald-500 shadow-sm ${BOX_H}`}>
                  <select value={form.cedulaPrefix} onChange={e => setForm(p => ({ ...p, cedulaPrefix: e.target.value }))}
                    className="bg-slate-50 border-r border-slate-200 px-4 h-full text-sm font-black text-slate-700 outline-none">
                    {['V', 'E'].map(p => <option key={p}>{p}</option>)}
                  </select>
                  <input required type="text" value={form.cedulaNumber} onChange={e => setForm(p => ({ ...p, cedulaNumber: e.target.value }))}
                    placeholder="00000000" className="flex-1 px-5 h-full bg-white outline-none text-sm font-medium text-slate-800" />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest ml-1 text-slate-500">Correo Electrónico</label>
                <div className="relative">
                  <Mail size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input required type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                    placeholder="usuario@ejemplo.com" className={`w-full pl-11 pr-5 ${BOX_H} bg-white rounded-xl border border-slate-200 outline-none focus:border-emerald-500 text-slate-800 text-sm font-medium shadow-sm`} />
                </div>
              </div>

              {/* Teléfono */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest ml-1 text-slate-500">Teléfono</label>
                <div className={`flex border border-slate-200 rounded-xl overflow-hidden focus-within:border-emerald-500 shadow-sm ${BOX_H}`}>
                  <span className="bg-slate-50 border-r border-slate-200 px-4 h-full flex items-center text-sm font-black text-slate-700">🇻🇪 +58</span>
                  <input type="tel" value={form.telefono} onChange={e => setForm(p => ({ ...p, telefono: e.target.value }))}
                    placeholder="4XX 0000000" className="flex-1 px-5 h-full bg-white outline-none text-sm font-medium text-slate-800" />
                </div>
              </div>

              {/* Profesión */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest ml-1 text-slate-500">Profesión</label>
                <div className="relative">
                  <Briefcase size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input required type="text" value={form.profesion} onChange={e => setForm(p => ({ ...p, profesion: e.target.value }))}
                    placeholder="Ej. Abogado, Ingeniero..." className={`w-full pl-11 pr-5 ${BOX_H} bg-white rounded-xl border border-slate-200 outline-none focus:border-emerald-500 text-slate-800 text-sm font-medium shadow-sm`} />
                </div>
              </div>

              {/* Nivel Profesional */}
              <div className="space-y-2 relative">
                <label className="text-xs font-black uppercase tracking-widest ml-1 text-slate-500">Nivel Profesional</label>
                <button type="button" onClick={() => setShowNivelDropdown(!showNivelDropdown)}
                  className={`w-full px-4 ${BOX_H} bg-white rounded-xl border transition-colors flex items-center justify-between group shadow-sm ${showNivelDropdown ? 'border-emerald-500 ring-4 ring-emerald-500/10' : 'border-slate-200 hover:border-emerald-400'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${selectedNivel ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                      {selectedNivel ? <selectedNivel.icon size={18} /> : <Briefcase size={18} />}
                    </div>
                    <span className={`text-sm font-bold ${selectedNivel ? 'text-slate-800' : 'text-slate-300'}`}>
                      {selectedNivel ? selectedNivel.label : 'Selecciona una opción'}
                    </span>
                  </div>
                  <ChevronDown size={18} className={`text-slate-400 transition-transform ${showNivelDropdown ? 'rotate-180 text-emerald-500' : ''}`} />
                </button>
                {showNivelDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowNivelDropdown(false)} />
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden">
                      <div className="p-1.5 space-y-1">
                        {NIVELES.map(n => (
                          <button key={n.value} type="button"
                            onClick={() => { setForm(p => ({ ...p, nivelProfesional: n.value })); setShowNivelDropdown(false) }}
                            className={`w-full flex items-center justify-between px-4 h-[50px] rounded-xl transition-colors ${form.nivelProfesional === n.value ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'}`}>
                            <div className="flex items-center gap-3">
                              <n.icon size={18} className={form.nivelProfesional === n.value ? 'text-white' : 'text-slate-400'} />
                              <span className="text-xs font-black uppercase tracking-tight">{n.label}</span>
                            </div>
                            {form.nivelProfesional === n.value && <Check size={16} />}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Corredor */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest ml-1 text-slate-500">¿Eres actualmente corredor inmobiliario?</label>
                <div className={`grid grid-cols-2 bg-slate-100 rounded-xl border border-slate-200 overflow-hidden ${BOX_H}`}>
                  {['si', 'no'].map(opt => (
                    <button key={opt} type="button"
                      onClick={() => setForm(p => ({ ...p, esCorredorInmobiliario: opt }))}
                      className={`h-full text-xs font-black uppercase tracking-widest transition-colors ${form.esCorredorInmobiliario === opt ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:bg-white hover:text-slate-700'}`}>
                      {opt === 'si' ? 'Sí, lo soy' : 'No'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {errorMsg && (
              <div className="flex items-center gap-2 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold">
                <AlertCircle size={14} />{errorMsg}
              </div>
            )}

            <button type="submit" disabled={submitLoading}
              className={`w-full ${BOX_H} rounded-xl flex items-center justify-center gap-3 bg-emerald-600 text-white font-black uppercase tracking-widest text-xs shadow-xl hover:-translate-y-0.5 transition-transform disabled:opacity-60`}>
              {submitLoading ? <Loader2 size={18} className="animate-spin" /> : <><span>Enviar Solicitud</span><ArrowRight size={14} /></>}
            </button>

            <p className="text-[9px] text-center text-slate-400 uppercase tracking-widest">
              Cámara Inmobiliaria de Venezuela • 2026
            </p>
          </form>
        )}
      </main>

      <Footer />
    </div>
  )
}
