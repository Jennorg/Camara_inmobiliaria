import React, { useState, useEffect, useCallback } from 'react'
import { api, Loading } from '@/pages/admin/components/Cms/CmsShared'
import {
  Instagram,
  Facebook,
  Linkedin,
  Phone,
  Mail,
  FileText,
  Save,
  CheckCircle2,
  ExternalLink,
  Search,
  Sparkles,
  RotateCcw,
  Globe,
  Building2,
  Share2
} from 'lucide-react'

// ─── Field Types ─────────────────────────────────────────────────────────────
type FieldType = 'text' | 'url' | 'social'

interface ConfigKey {
  clave: string
  descripcion: string
  label: string
  type?: FieldType
  placeholder?: string
  helpText?: string
}

interface ConfigSection {
  id: string
  label: string
  subtitle: string
  icon: React.ReactNode
  color: string
  badgeColor: string
  keys: ConfigKey[]
}

// ─── Config Sections Definition ───────────────────────────────────────────────
const CONFIG_SECTIONS: ConfigSection[] = [
  {
    id: 'redes',
    label: 'Presencia Digital & Redes Sociales',
    subtitle: 'Enlaces oficiales a perfiles institucionales en plataformas sociales y mensajería',
    icon: <Share2 className="w-5 h-5 text-indigo-600" />,
    color: 'from-indigo-500/10 to-blue-500/5',
    badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    keys: [
      {
        clave: 'redes_instagram',
        label: 'Instagram Oficial',
        descripcion: 'Enlace al perfil institucional de Instagram',
        type: 'social',
        placeholder: 'https://instagram.com/camarainmobiliariabolivar',
        helpText: 'Utilizado en el pie de página y botones de redes'
      },
      {
        clave: 'redes_facebook',
        label: 'Facebook Fanpage',
        descripcion: 'Enlace a la página oficial de Facebook',
        type: 'social',
        placeholder: 'https://facebook.com/camarainmobiliariabolivar',
        helpText: 'Utilizado en el pie de página institucional'
      },
      {
        clave: 'redes_linkedin',
        label: 'LinkedIn Institucional',
        descripcion: 'Enlace a la página de empresa en LinkedIn',
        type: 'social',
        placeholder: 'https://linkedin.com/company/ciebo',
        helpText: 'Para red profesional e institucional'
      },
      {
        clave: 'redes_twitter',
        label: 'Cuenta X / Twitter',
        descripcion: 'Enlace al usuario de X (Twitter)',
        type: 'social',
        placeholder: 'https://x.com/ciebo_oficial',
        helpText: 'Novedades y comunicados de prensa'
      },
      {
        clave: 'redes_whatsapp',
        label: 'Atención por WhatsApp',
        descripcion: 'Número con código de país para atención inmediata',
        type: 'text',
        placeholder: '+58 412 1234567',
        helpText: 'Formato internacional: +58 4XX XXXXXXX'
      },
    ],
  },
  {
    id: 'contacto',
    label: 'Identificación & Contacto Institucional',
    subtitle: 'Datos oficiales de correo, teléfono de atención y Registro de Información Fiscal (RIF)',
    icon: <Building2 className="w-5 h-5 text-sky-600" />,
    color: 'from-sky-500/10 to-emerald-500/5',
    badgeColor: 'bg-sky-50 text-sky-700 border-sky-100',
    keys: [
      {
        clave: 'contacto_email',
        label: 'Correo Electrónico Oficial',
        descripcion: 'Email principal para consultas generales y afiliaciones',
        type: 'url',
        placeholder: 'contacto@ciebo.org.ve',
        helpText: 'Recibe mensajes del formulario y contacto público'
      },
      {
        clave: 'contacto_telefono',
        label: 'Teléfono Central / Máster',
        descripcion: 'Número telefónico de la oficina o secretaría',
        type: 'text',
        placeholder: '+58 286 9230000',
        helpText: 'Línea fija o atención a miembros'
      },
      {
        clave: 'rif',
        label: 'RIF de la Cámara',
        descripcion: 'Registro de Información Fiscal institucional',
        type: 'text',
        placeholder: 'J-12345678-9',
        helpText: 'Aparece en pie de página y comprobantes'
      },
    ],
  },
]

const ALL_CONFIG_KEYS = CONFIG_SECTIONS.flatMap(s => s.keys)

const getBrandIcon = (clave: string) => {
  if (clave.includes('instagram')) {
    return (
      <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white flex items-center justify-center shrink-0 shadow-sm">
        <Instagram size={18} />
      </div>
    )
  }
  if (clave.includes('facebook')) {
    return (
      <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
        <Facebook size={18} />
      </div>
    )
  }
  if (clave.includes('linkedin')) {
    return (
      <div className="w-9 h-9 rounded-xl bg-sky-700 text-white flex items-center justify-center shrink-0 shadow-sm">
        <Linkedin size={18} />
      </div>
    )
  }
  if (clave.includes('twitter')) {
    return (
      <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-sm">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932 6.064-6.932zm-1.294 19.486h2.039L6.486 3.24H4.298l13.31 17.399z"/>
        </svg>
      </div>
    )
  }
  if (clave.includes('whatsapp')) {
    return (
      <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm">
        <Phone size={18} />
      </div>
    )
  }
  if (clave.includes('email')) {
    return (
      <div className="w-9 h-9 rounded-xl bg-sky-500 text-white flex items-center justify-center shrink-0 shadow-sm">
        <Mail size={18} />
      </div>
    )
  }
  if (clave.includes('telefono')) {
    return (
      <div className="w-9 h-9 rounded-xl bg-slate-700 text-white flex items-center justify-center shrink-0 shadow-sm">
        <Phone size={18} />
      </div>
    )
  }
  if (clave.includes('rif')) {
    return (
      <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
        <FileText size={18} />
      </div>
    )
  }
  return (
    <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
      <Globe size={18} />
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export const ConfigPanel = () => {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)
  const [localForms, setLocalForms] = useState<Record<string, string>>({})
  const [savedForms, setSavedForms] = useState<Record<string, string>>({})
  const [searchQuery, setSearchQuery] = useState('')

  // ── Load Config ──────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.get('/api/cms/config')
      if (data.success) {
        const initial: Record<string, string> = {}
        ALL_CONFIG_KEYS.forEach(k => {
          initial[k.clave] = data.config?.[k.clave] ?? ''
        })
        setLocalForms(initial)
        setSavedForms(initial)
      }
    } catch (err) {
      console.error('Error al cargar configuración:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // ── Save Config ──────────────────────────────────────────────────────────
  const saveAll = async () => {
    setSaving(true)
    try {
      const entries = ALL_CONFIG_KEYS.map(k => ({
        clave: k.clave,
        valor: localForms[k.clave] || '',
        descripcion: k.descripcion,
      }))
      const res = await api.post('/api/cms/config/batch', entries)
      if (res.success) {
        setSavedForms({ ...localForms })
        setSavedSuccess(true)
        setTimeout(() => setSavedSuccess(false), 3000)
      } else {
        alert(res.message || 'Error al guardar la configuración')
      }
    } catch (error) {
      console.error(error)
      alert('Error de conexión al guardar los datos.')
    } finally {
      setSaving(false)
    }
  }

  // ── Field Change ─────────────────────────────────────────────────────────
  const handleChange = useCallback((clave: string, value: string) => {
    setLocalForms(prev => ({ ...prev, [clave]: value }))
  }, [])

  // ── Revert Changes ───────────────────────────────────────────────────────
  const revertChanges = () => {
    setLocalForms({ ...savedForms })
  }

  const modifiedKeys = ALL_CONFIG_KEYS.filter(
    k => (localForms[k.clave] ?? '') !== (savedForms[k.clave] ?? '')
  )
  const totalDirty = modifiedKeys.length

  if (loading) return <Loading />

  return (
    <div className="w-full flex-1 min-h-full bg-slate-50/50 flex flex-col justify-between overflow-y-auto">
      <div className="p-6 md:p-10 max-w-6xl w-full mx-auto space-y-8">
        
        {/* Header Hero Card */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 md:p-8 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-emerald-500/10 via-indigo-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 text-[11px] font-black uppercase tracking-wider">
                <Sparkles size={12} className="text-emerald-500" />
                Configuración Oficial
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">
                Canales de Contacto & Redes
              </h1>
              <p className="text-sm text-slate-500 leading-relaxed">
                Gestiona los enlaces de redes sociales y los datos de contacto institucional que se muestran públicamente en el sitio web y pie de página de la Cámara Inmobiliaria.
              </p>
            </div>

            {/* Quick Actions Header */}
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              {totalDirty > 0 && (
                <button
                  type="button"
                  onClick={revertChanges}
                  disabled={saving}
                  className="px-4 py-2.5 rounded-2xl text-xs font-bold text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors transition-transform flex items-center gap-2 active:scale-95"
                >
                  <RotateCcw size={14} />
                  Descartar ({totalDirty})
                </button>
              )}

              <button
                type="button"
                onClick={saveAll}
                disabled={saving || totalDirty === 0}
                className={`px-6 py-3 rounded-2xl text-xs font-black tracking-wide uppercase transition-colors transition-transform shadow-lg flex items-center justify-center gap-2.5 ${
                  savedSuccess
                    ? 'bg-emerald-600 text-white shadow-emerald-500/25'
                    : totalDirty > 0
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/25 active:scale-95'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                }`}
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Guardando...
                  </>
                ) : savedSuccess ? (
                  <>
                    <CheckCircle2 size={16} />
                    ¡Guardado con Éxito!
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    {totalDirty > 0 ? `Guardar (${totalDirty})` : 'Sin Cambios'}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Search Bar & Status Bar */}
          <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar red o campo de contacto..."
                className="w-full pl-10 pr-8 py-2.5 text-xs font-semibold rounded-2xl border border-slate-200 bg-slate-50/50 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs font-medium text-slate-500">
              {totalDirty > 0 ? (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200/60 font-bold">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  {totalDirty} campo{totalDirty !== 1 ? 's' : ''} pendiente{totalDirty !== 1 ? 's' : ''} por guardar
                </span>
              ) : (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-600 font-bold">
                  <CheckCircle2 size={13} className="text-emerald-500" />
                  Todos los campos sincronizados
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 2-Section Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {CONFIG_SECTIONS.map(section => {
            const filteredKeys = searchQuery
              ? section.keys.filter(
                  k =>
                    k.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    k.descripcion.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    k.clave.toLowerCase().includes(searchQuery.toLowerCase())
                )
              : section.keys

            if (searchQuery && filteredKeys.length === 0) return null

            return (
              <div
                key={section.id}
                className="bg-white border border-slate-200/80 rounded-3xl p-6 md:p-8 shadow-sm flex flex-col justify-between space-y-6"
              >
                <div className="space-y-6">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-4 pb-5 border-b border-slate-100">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-100">
                          {section.icon}
                        </div>
                        <h2 className="text-lg font-black text-slate-800 tracking-tight">
                          {section.label}
                        </h2>
                      </div>
                      <p className="text-xs text-slate-400 font-medium pl-1">
                        {section.subtitle}
                      </p>
                    </div>
                  </div>

                  {/* Field Inputs */}
                  <div className="space-y-5">
                    {filteredKeys.map(k => {
                      const val = localForms[k.clave] ?? ''
                      const isModified = val !== (savedForms[k.clave] ?? '')
                      const isUrl = val.startsWith('http://') || val.startsWith('https://')

                      return (
                        <div
                          key={k.clave}
                          className={`p-4 rounded-2xl border transition-colors space-y-2 ${
                            isModified
                              ? 'border-amber-200 bg-amber-50/30 ring-2 ring-amber-500/10'
                              : 'border-slate-150 bg-slate-50/40 hover:bg-slate-50 hover:border-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <label className="text-xs font-black text-slate-700 uppercase tracking-wide">
                              {k.label}
                            </label>
                            {isModified && (
                              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200">
                                Modificado
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3">
                            {getBrandIcon(k.clave)}

                            <div className="relative flex-1">
                              <input
                                type={k.type === 'social' ? 'url' : 'text'}
                                value={val}
                                onChange={e => handleChange(k.clave, e.target.value)}
                                placeholder={k.placeholder}
                                className="w-full text-xs font-semibold rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-colors"
                              />
                            </div>

                            {isUrl && (
                              <a
                                href={val}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-emerald-600 hover:border-emerald-300 transition-colors shrink-0 shadow-xs"
                                title="Abrir enlace en pestaña nueva"
                              >
                                <ExternalLink size={15} />
                              </a>
                            )}
                          </div>

                          {k.helpText && (
                            <p className="text-[10px] text-slate-400 font-medium pl-1">
                              {k.helpText}
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Sticky Bottom Actions Bar (appears when changes exist) */}
      {totalDirty > 0 && (
        <div className="transition-transform sticky bottom-0 z-40 bg-white/90 backdrop-blur-md border-t border-slate-200/80 px-6 py-4 shadow-xl slide-in-from-bottom-4 duration-300">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-amber-500 animate-ping" />
              <p className="text-xs font-bold text-slate-700">
                Tienes <span className="text-amber-600 font-black">{totalDirty} cambio{totalDirty !== 1 ? 's' : ''}</span> sin guardar en el formulario.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={revertChanges}
                disabled={saving}
                className="px-5 py-2.5 rounded-2xl text-xs font-bold text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors transition-transform active:scale-95"
              >
                Descartar cambios
              </button>
              <button
                type="button"
                onClick={saveAll}
                disabled={saving}
                className="px-6 py-2.5 rounded-2xl text-xs font-black tracking-wide uppercase bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/25 transition-colors transition-transform flex items-center gap-2 active:scale-95"
              >
                {saving ? 'Guardando...' : 'Guardar Todo Ahora'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
