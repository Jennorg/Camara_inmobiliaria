import React, { useState, useEffect, useCallback, useRef } from 'react'
import { api, Input, Textarea, BtnPrimary, Loading } from '@/pages/admin/components/Cms/CmsShared'
import { LandingPreviewPane, sendToPreview } from '@/pages/admin/components/Cms/LandingPreviewPane'
import { Instagram, Facebook, Linkedin, Phone, Mail, FileText } from 'lucide-react'

// ─── Field Types ─────────────────────────────────────────────────────────────
type FieldType = 'text' | 'textarea' | 'url_img' | 'number' | 'url' | 'social'

interface ConfigKey {
  clave: string
  descripcion: string
  type?: FieldType
  placeholder?: string
  rows?: number
}

// ─── Config Groups ────────────────────────────────────────────────────────────
// ─── Config Groups ────────────────────────────────────────────────────────────
// IMPORTANT: Only fields listed here are read from the CMS at runtime.
// Content hardcoded in `staticContent.ts` must NOT appear here — it requires
// a code change, not a CMS update.
const CONFIG_GROUPS: Array<{
  label: string
  anchor: string
  color: string
  keys: ConfigKey[]
}> = [
    {
      label: 'Portada / Hero (Landing)',
      anchor: '#inicio',
      color: '#10b981',
      keys: [
        { clave: 'hero_titulo', descripcion: 'Título de Bienvenida (HTML soportado)', type: 'textarea', placeholder: 'Cámara Inmobiliaria <br/> de Bolívar' },
        { clave: 'hero_subtitulo', descripcion: 'Subtítulo Principal', type: 'textarea', placeholder: 'Formación profesional y red de corredores certificados...' },
        { clave: 'hero_img', descripcion: 'Imagen de Fondo del Hero (URL)', type: 'url_img', placeholder: 'https://...' },
      ],
    },
    {
      label: 'Convenios & Beneficios (Landing)',
      anchor: '#convenios',
      color: '#8b5cf6',
      keys: [
        { clave: 'convenios_marquee_titulo', descripcion: 'Título de la marquesina', type: 'text', placeholder: 'Convenios y Beneficios' },
        { clave: 'convenios_link', descripcion: 'Texto de enlace / informativo', type: 'text', placeholder: 'Conoce nuestros programas de formación inmobiliaria' },
      ],
    },
    {
      label: 'Redes Sociales',
      anchor: '#footer',
      color: '#1d4ed8',
      keys: [
        { clave: 'redes_instagram', descripcion: 'URL Instagram', type: 'social', placeholder: 'https://instagram.com/...' },
        { clave: 'redes_facebook', descripcion: 'URL Facebook', type: 'social', placeholder: 'https://facebook.com/...' },
        { clave: 'redes_linkedin', descripcion: 'URL LinkedIn', type: 'social', placeholder: 'https://linkedin.com/...' },
        { clave: 'redes_twitter', descripcion: 'URL Twitter / X', type: 'social', placeholder: 'https://x.com/...' },
        { clave: 'redes_whatsapp', descripcion: 'Número WhatsApp (con código de país)', type: 'text', placeholder: '+58 412 ...' },
      ],
    },
    {
      label: 'Contacto Institucional',
      anchor: '#nosotros',
      color: '#0284c7',
      keys: [
        { clave: 'contacto_email', descripcion: 'Email de contacto principal', type: 'url', placeholder: 'correo@ciebo.org.ve' },
        { clave: 'contacto_telefono', descripcion: 'Teléfono de contacto', type: 'text', placeholder: '+58 ...' },
        { clave: 'rif', descripcion: 'RIF de la cámara', type: 'text', placeholder: 'J-...' },
      ],
    },
  ]


const ALL_CONFIG_KEYS = CONFIG_GROUPS.flatMap(g => g.keys)

const getSocialIcon = (clave: string) => {
  if (clave.includes('instagram')) return <Instagram size={16} className="text-pink-600" />
  if (clave.includes('facebook')) return <Facebook size={16} className="text-blue-600" />
  if (clave.includes('linkedin')) return <Linkedin size={16} className="text-blue-700" />
  if (clave.includes('twitter')) return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-slate-800" xmlns="http://www.w3.org/2000/svg">
      <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932 6.064-6.932zm-1.294 19.486h2.039L6.486 3.24H4.298l13.31 17.399z"/>
    </svg>
  )
  if (clave.includes('whatsapp')) return <Phone size={16} className="text-emerald-600" />
  if (clave.includes('email')) return <Mail size={16} className="text-sky-600" />
  if (clave.includes('telefono')) return <Phone size={16} className="text-slate-500" />
  if (clave.includes('rif')) return <FileText size={16} className="text-amber-600" />
  return <span className="text-slate-400">🔗</span>
}

// ─── Field renderer ───────────────────────────────────────────────────────────
const FieldInput = ({
  field,
  value,
  onChange,
}: {
  field: ConfigKey
  value: string
  onChange: (v: string) => void
}) => {
  const base = 'w-full text-sm rounded-xl border px-3 py-2 text-slate-700 placeholder-slate-300 transition-all focus:outline-none focus:ring-2 focus:ring-[#00D084]/40 focus:border-[#00D084]'

  if (field.type === 'textarea') {
    return (
      <Textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={field.placeholder ?? field.descripcion}
        rows={field.rows ?? 3}
      />
    )
  }

  if (field.type === 'url_img') {
    return (
      <div className="flex flex-col gap-2">
        <Input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="https://..."
          type="url"
        />
        {value && (
          <div className="relative group overflow-hidden rounded-xl border border-gray-100">
            <img
              src={value}
              alt="preview"
              className="w-full h-32 object-cover"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <span className="text-white text-xs font-bold">Preview</span>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (field.type === 'number') {
    return (
      <input
        type="number"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={field.placeholder ?? field.descripcion}
        className={`${base} border-gray-200`}
      />
    )
  }

  const hasIcon = ['social', 'url', 'text'].includes(field.type ?? '') || ['contacto_email', 'contacto_telefono', 'rif', 'redes_whatsapp'].includes(field.clave);

  return (
    <div className="flex items-center gap-2 w-full">
      {hasIcon && (
        <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center shrink-0 border border-slate-150">
          {getSocialIcon(field.clave)}
        </div>
      )}
      <input
        type={field.type === 'social' ? 'url' : 'text'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={field.placeholder ?? field.descripcion}
        className={`${base} border-gray-200 flex-1`}
      />
    </div>
  )
}

// ─── Accordion Group ──────────────────────────────────────────────────────────
const AccordionGroup = ({
  group,
  localForms,
  savedForms,
  onChange,
  onSectionClick,
  searchQuery,
}: {
  group: (typeof CONFIG_GROUPS)[number]
  localForms: Record<string, string>
  savedForms: Record<string, string>
  onChange: (clave: string, value: string) => void
  onSectionClick: (anchor: string) => void
  searchQuery: string
}) => {
  const [open, setOpen] = useState(true)

  const filteredKeys = searchQuery
    ? group.keys.filter(
      k =>
        k.descripcion.toLowerCase().includes(searchQuery.toLowerCase()) ||
        k.clave.toLowerCase().includes(searchQuery.toLowerCase())
    )
    : group.keys

  const isDirty = group.keys.some(k => (localForms[k.clave] ?? '') !== (savedForms[k.clave] ?? ''))

  if (searchQuery && filteredKeys.length === 0) return null

  return (
    <div
      className="bg-white rounded-2xl border border-gray-100 overflow-hidden transition-shadow hover:shadow-md"
      style={{ borderLeft: `4px solid ${group.color}` }}
    >
      {/* Header */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(o => !o)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setOpen(o => !o)
          }
        }}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-slate-700">{group.label}</span>
          {isDirty && (
            <span
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ backgroundColor: group.color }}
              title="Cambios sin guardar"
            />
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Jump to section button */}
          <button
            onClick={e => { e.stopPropagation(); onSectionClick(group.anchor) }}
            title="Ver en preview"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all text-xs"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
            </svg>
          </button>
          <span className="text-slate-400 transition-transform duration-200" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6" /></svg>
          </span>
        </div>
      </div>

      {/* Accordion body — smooth height animation via CSS grid trick */}
      <div className={`cms-accordion-body ${open ? '' : 'closed'}`}>
        <div className="px-4 pb-4 pt-1 flex flex-col gap-4 border-t border-gray-50">
          {filteredKeys.map(k => (
            <div key={k.clave} className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                  {k.descripcion}
                </label>
                {(localForms[k.clave] ?? '') !== (savedForms[k.clave] ?? '') && (
                  <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: group.color }}>
                    modificado
                  </span>
                )}
              </div>
              <FieldInput
                field={k}
                value={localForms[k.clave] ?? ''}
                onChange={v => onChange(k.clave, v)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export const ConfigPanel = () => {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [localForms, setLocalForms] = useState<Record<string, string>>({})
  const [savedForms, setSavedForms] = useState<Record<string, string>>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [previewVisible, setPreviewVisible] = useState(true)
  const [leftWidth, setLeftWidth] = useState(650)
  const [dividerDragging, setDividerDragging] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(650)

  const onDividerMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true
    startX.current = e.clientX
    startWidth.current = leftWidth
    e.preventDefault()
    setDividerDragging(true)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [leftWidth])

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return
      const containerW = containerRef.current.getBoundingClientRect().width
      const delta = e.clientX - startX.current
      const next = startWidth.current + delta
      setLeftWidth(Math.max(280, Math.min(next, containerW - 260)))
    }
    const onMouseUp = () => {
      if (!isDragging.current) return
      isDragging.current = false
      setDividerDragging(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  // ── Load config ──────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    const data = await api.get('/api/cms/config')
    if (data.success) {
      const initial: Record<string, string> = {}
      ALL_CONFIG_KEYS.forEach(k => { initial[k.clave] = data.config?.[k.clave] ?? '' })
      setLocalForms(initial)
      setSavedForms(initial)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ── Live preview: push every change to the shared iframe ─────────────────
  useEffect(() => {
    sendToPreview({ type: 'preview_cfg', cfg: localForms })
  }, [localForms])

  // ── Save all ─────────────────────────────────────────────────────────────
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
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
      } else {
        alert(res.message || 'Error al guardar la configuración')
      }
    } catch (error) {
      console.error(error)
      alert('Error de conexión con el servidor')
    } finally {
      setSaving(false)
    }
  }


  // ── Field change ─────────────────────────────────────────────────────────
  const handleChange = useCallback((clave: string, value: string) => {
    setLocalForms(prev => ({ ...prev, [clave]: value }))
  }, [])

  // ── Scroll iframe to section ──────────────────────────────────────────────
  const scrollToSection = (anchor: string) => {
    sendToPreview({ type: 'scroll_to', anchor })
  }

  const totalDirty = ALL_CONFIG_KEYS.filter(
    k => (localForms[k.clave] ?? '') !== (savedForms[k.clave] ?? '')
  ).length

  if (loading) return <Loading />

  return (
    <div ref={containerRef} className="flex w-full h-full overflow-hidden select-none">
      {/* ── LEFT PANEL (form) */}
      <div
        className="flex flex-col flex-shrink-0 bg-gray-50 overflow-hidden max-lg:!w-full max-lg:!flex-1"
        style={{
          width: previewVisible ? leftWidth : undefined,
          flex: previewVisible ? 'none' : '1 1 0%',
          transition: dividerDragging ? 'none' : 'width 0.26s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {/* Sticky header */}
        <div className="flex-shrink-0 bg-white border-b border-gray-100 px-4 py-3 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Configuración Dinámica</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {totalDirty > 0
                  ? <span className="text-amber-500 font-semibold">{totalDirty} campo{totalDirty !== 1 ? 's' : ''} modificado{totalDirty !== 1 ? 's' : ''}</span>
                  : 'Imagen del hero, redes sociales y contacto'
                }
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Toggle preview */}
              <button
                onClick={() => setPreviewVisible(v => !v)}
                title={previewVisible ? 'Ocultar preview' : 'Mostrar preview'}
                className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all text-slate-500 hover:text-slate-700 hover:bg-slate-100"
              >
                <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  {previewVisible
                    ? <polyline points="15 18 9 12 15 6" />
                    : <polyline points="9 18 15 12 9 6" />
                  }
                </svg>
                {previewVisible ? 'Ocultar' : 'Preview'}
              </button>
              <BtnPrimary onClick={saveAll} disabled={saving || totalDirty === 0}>
                {saving ? '...' : saved ? '✓ Guardado' : `Guardar${totalDirty > 0 ? ` (${totalDirty})` : ''}`}
              </BtnPrimary>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
            <input
              type="text"
              placeholder="Buscar campo..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm rounded-xl border border-gray-200 text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-[#00D084]/40 focus:border-[#00D084] transition-all bg-gray-50"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Static content notice */}
          <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5">
            <svg className="w-3.5 h-3.5 text-blue-400 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
            <p className="text-[10px] text-blue-600 leading-relaxed">
              Los textos de secciones (Nosotros, Afiliados, Formación, etc.) son <strong>contenido estático</strong> y no aparecen aquí.
              Los módulos de <strong>Noticias, Cursos y Directiva</strong> se gestionan en sus propias secciones del menú lateral.
            </p>
          </div>
        </div>

        {/* Scrollable groups */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {CONFIG_GROUPS.map(group => (
            <AccordionGroup
              key={group.label}
              group={group}
              localForms={localForms}
              savedForms={savedForms}
              onChange={handleChange}
              onSectionClick={scrollToSection}
              searchQuery={searchQuery}
            />
          ))}

          {/* Bottom save */}
          <div className="pt-2 pb-4 flex justify-end">
            <BtnPrimary onClick={saveAll} disabled={saving || totalDirty === 0}>
              {saving ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar todo'}
            </BtnPrimary>
          </div>
        </div>
      </div>

      {/* ── DIVIDER (drag handle) */}
      {previewVisible && (
        <div
          onMouseDown={onDividerMouseDown}
          className="hidden lg:flex flex-shrink-0 w-1.5 cursor-col-resize items-center justify-center bg-gray-200 hover:bg-[#00D084] transition-colors duration-150 z-10"
          title="Arrastrar para redimensionar"
        >
          <div className="w-0.5 h-10 rounded-full bg-gray-400" />
        </div>
      )}

      {/* ── RIGHT PANEL: shared reusable preview */}
      <div className={`hidden lg:flex flex-col overflow-hidden ${previewVisible ? 'flex-1' : 'w-0'}`}>
        <LandingPreviewPane
          visible={previewVisible}
          onToggle={() => setPreviewVisible(v => !v)}
        />
      </div>

      {/* Mobile floating button */}
      <div className="lg:hidden fixed bottom-4 right-4 z-50">
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2.5 bg-[#00D084] text-white text-xs font-bold rounded-full shadow-lg shadow-emerald-500/30 hover:bg-[#00B870] transition-colors"
        >
          Ver landing
        </a>
      </div>

      {/* ── DRAG OVERLAY: captura eventos sobre el iframe durante el resize ─────── */}
      {dividerDragging && (
        <div className="fixed inset-0 z-[9999] cursor-col-resize" />
      )}
    </div>
  )
}
