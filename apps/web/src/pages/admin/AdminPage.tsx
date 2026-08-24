import React, { useState, useRef, useEffect, useCallback } from 'react'
import CmsHeader from '@/pages/admin/components/CmsHeader'
import CmsAside from '@/pages/admin/components/CmsAside'
import CmsContent from '@/pages/admin/components/CmsContent'

const NAV_META: Record<string, { title: string; subtitle: string }> = {
  articles: { title: 'Artículos', subtitle: 'Gestionar el contenido del sitio' },
  formacion: { title: 'Formación', subtitle: 'Cursos, talleres y asignación de estudiantes' },
  preinscripciones: {
    title: 'Preinscripciones',
    subtitle: '',
  },
  solicitudes_cambio: {
    title: 'Solicitudes de Cambio',
    subtitle: 'Revisión y aprobación de solicitudes de actualización de datos de afiliados',
  },
  cms: { title: 'Contenido', subtitle: 'Todas las secciones de la Landing' },
  noticias: { title: 'Noticias', subtitle: 'Últimas novedades y artículos' },
  convenios: { title: 'Convenios', subtitle: 'Alianzas y beneficios para afiliados' },
  normativas: { title: 'Normativas', subtitle: 'Enlaces a documentos oficiales (PDF u otros)' },
  directiva: { title: 'Directiva', subtitle: 'Miembros de la Junta Directiva' },
  paginas: { title: 'Páginas públicas', subtitle: 'Contenido JSON de rutas /beneficios, /pegi, etc.' },
  config: { title: 'Configuración de Contenido', subtitle: 'Textos fijos e imágenes de la Landing' },
  media: { title: 'Medios', subtitle: 'Gestionar archivos e imágenes' },
  afiliados: { title: 'Afiliados', subtitle: '' },
  estudiantes: { title: 'Estudiantes', subtitle: 'Estudiantes regulares e inscripciones activas' },
  admin_users: { title: 'Administradores', subtitle: 'Cuentas con acceso al panel administrativo' },
  users: { title: 'Usuarios', subtitle: 'Cuentas de acceso al sistema' },
  finanzas: { title: 'Finanzas', subtitle: 'Libros contables y flujo de caja' },
  analytics: { title: 'Análisis', subtitle: 'Métricas y rendimiento general' },
  settings: { title: 'Configuración del Sistema', subtitle: 'Ajustes del sistema y preferencias' },
  denuncias: { title: 'Denuncias', subtitle: 'Gestión y seguimiento de denuncias ciudadanas e institucionales' },
}

const SIDEBAR_COLLAPSED = 72    // icon-only width
const SIDEBAR_MIN_DRAG = 100   // minimum width while dragging before snapping to icon mode
const SIDEBAR_MAX = 340
const SIDEBAR_DEFAULT = 220

import { useAuth } from '@/context/AuthContext'

const AdminPage = () => {
  const { isAsistente, isAdmin } = useAuth()
  const [activeId, setActiveId] = useState(() => (isAsistente && !isAdmin ? 'afiliados' : 'analytics'))
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT)
  const [sidebarDragging, setSidebarDragging] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(SIDEBAR_DEFAULT)
  /** Remembers the last expanded width so toggle can restore it */
  const prevExpandedWidth = useRef(SIDEBAR_DEFAULT)

  const meta = NAV_META[activeId] ?? NAV_META['analytics']
  const isCollapsed = sidebarWidth <= SIDEBAR_COLLAPSED

  // ── Toggle: icon-only ↔ last expanded width ──────────────────────────────
  const toggleSidebar = useCallback(() => {
    if (isCollapsed) {
      setSidebarWidth(prevExpandedWidth.current)
    } else {
      prevExpandedWidth.current = sidebarWidth
      setSidebarWidth(SIDEBAR_COLLAPSED)
    }
  }, [isCollapsed, sidebarWidth])

  // ── Drag resize ───────────────────────────────────────────────────────────
  const onSidebarDividerDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return // ignore button clicks
    isDragging.current = true
    startX.current = e.clientX
    startWidth.current = sidebarWidth
    e.preventDefault()
    setSidebarDragging(true)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [sidebarWidth])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      const delta = e.clientX - startX.current
      const next = startWidth.current + delta
      // Snap to icon-only if dragged below min
      const clamped = next < SIDEBAR_MIN_DRAG
        ? SIDEBAR_COLLAPSED
        : Math.min(next, SIDEBAR_MAX)
      setSidebarWidth(clamped)
      if (clamped > SIDEBAR_COLLAPSED) prevExpandedWidth.current = clamped
    }
    const onUp = () => {
      if (!isDragging.current) return
      isDragging.current = false
      setSidebarDragging(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  return (
    <div ref={containerRef} className="fixed inset-0 flex bg-gray-50 overflow-hidden w-full h-full">

      {/* ── SIDEBAR ──────────────────────────────────────────────────────── */}
      <CmsAside
        activeId={activeId}
        onNavigate={setActiveId}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
        width={sidebarWidth}
        isCollapsed={isCollapsed}
        animating={!sidebarDragging}
      />

      {/* ── SIDEBAR DIVIDER + TOGGLE BUTTON ──────────────────────────────── */}
      <div
        onMouseDown={onSidebarDividerDown}
        className="hidden md:flex flex-shrink-0 w-1.5 cursor-col-resize bg-gray-200 hover:bg-[#00D084] active:bg-[#00D084] transition-colors duration-150 relative z-20 items-center justify-center"
        title="Arrastrar para redimensionar"
      >
        {/* Grip line — always visible */}
        <div className="absolute pointer-events-none w-0.5 h-8 rounded-full bg-gray-400 opacity-40" />

        {/* ◀ / ▶ toggle button — always visible, vertically centered */}
        <button
          onClick={toggleSidebar}
          title={isCollapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
          style={{ cursor: 'pointer' }}
          className="absolute top-[72px] -translate-y-1/2 left-1/2 -translate-x-1/2 z-10
            flex items-center justify-center w-5 h-5 rounded-full
            bg-white border border-gray-200 text-slate-400 shadow-sm
            hover:bg-[#00D084] hover:text-white hover:border-[#00D084]
            transition-colors duration-150"
        >
          <svg
            viewBox="0 0 24 24"
            className="w-3 h-3"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {isCollapsed
              ? <polyline points="9 18 15 12 9 6" />  /* ▶ expand  */
              : <polyline points="15 18 9 12 15 6" /> /* ◀ collapse */
            }
          </svg>
        </button>
      </div>

      {/* ── MAIN CONTENT ─────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <CmsHeader
          title={meta.title}
          subtitle={meta.subtitle}
          onMenuOpen={() => setMobileMenuOpen(true)}
        />
        <main className="relative flex-1 min-h-0 overflow-hidden">
          <CmsContent activeId={activeId} />
        </main>
      </div>
    </div>
  )
}

export default AdminPage
