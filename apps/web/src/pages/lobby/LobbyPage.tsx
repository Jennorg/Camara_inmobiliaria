import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, GraduationCap, ArrowRight } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

export default function LobbyPage() {
  const navigate = useNavigate()
  const { user, logout, isAdmin, isAsistente, isAfiliado } = useAuth()

  // Si por alguna razón cae acá con 1 solo rol, redirigir al módulo correspondiente.
  React.useEffect(() => {
    if (!user) return
    if (user.roles.length > 1) return
    if (user.rol === 'admin' || user.rol === 'super_admin') {
      navigate('/admin', { replace: true })
      return
    }
    navigate('/panel', { replace: true })
  }, [navigate, user])

  const options = [
    (isAdmin || isAsistente)
      ? {
        key: 'admin',
        title: 'Intranet Administrativa',
        desc: 'Gestión interna, directorio, control de acceso, afiliados y administración del sistema.',
        icon: Building2,
        onClick: () => navigate('/admin'),
        accent: 'from-emerald-500/10 to-emerald-500/0',
        border: 'border-emerald-200/60',
        text: 'text-emerald-700',
        button: 'bg-emerald-600 hover:bg-emerald-500',
      }
      : null,
    isAfiliado
      ? {
        key: 'academico',
        title: 'Módulo Académico',
        desc: 'Acceso al panel académico para registro, formalización de inscripción y certificados.',
        icon: GraduationCap,
        onClick: () => navigate('/panel'),
        accent: 'from-slate-900/5 to-slate-900/0',
        border: 'border-slate-200',
        text: 'text-slate-800',
        button: 'bg-slate-900 hover:bg-slate-800',
      }
      : null,
  ].filter(Boolean) as Array<{
    key: string
    title: string
    desc: string
    icon: React.ElementType
    onClick: () => void
    accent: string
    border: string
    text: string
    button: string
  }>

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-6 py-16">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-10">
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-600">Lobby</p>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900">
              ¿A qué módulo deseas ingresar hoy?
            </h1>
            <p className="text-sm text-slate-500">
              Tu cuenta tiene múltiples perfiles. Selecciona el entorno para esta sesión.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => logout()}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-white transition-colors"
            >
              Cerrar sesión
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {options.map(opt => {
            const Icon = opt.icon
            return (
              <div
                key={opt.key}
                className={['bg-white rounded-[2rem] border p-7 shadow-sm overflow-hidden relative', opt.border].join(' ')}
              >
                <div className={['absolute inset-0 bg-gradient-to-br pointer-events-none', opt.accent].join(' ')} />
                <div className="relative">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-5">
                    <Icon className={['w-6 h-6', opt.text].join(' ')} />
                  </div>
                  <h2 className="text-xl font-black text-slate-900">{opt.title}</h2>
                  <p className="text-sm text-slate-500 mt-2 leading-relaxed">{opt.desc}</p>

                  <button
                    onClick={opt.onClick}
                    className={['mt-6 w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl text-white text-sm font-bold transition-colors', opt.button].join(' ')}
                  >
                    Entrar <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        <p className="mt-10 text-[10px] uppercase tracking-[0.15em] font-bold text-slate-400 text-center">
          Nota: este sistema no ofrece progreso de estudio ni módulos LMS.
        </p>
      </div>
    </div>
  )
}

