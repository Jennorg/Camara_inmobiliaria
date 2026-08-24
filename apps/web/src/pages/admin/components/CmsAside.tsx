import React, { useState, useEffect } from 'react'
import logo from '@/assets/Logo.webp'
import { useAuth } from '@/context/AuthContext'
import { API_URL } from '@/config/env'

interface NavItem {
  id: string
  label: string
  icon: React.ReactNode
  children?: NavItem[]
}

const icons = {
  dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  cms: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  ),
  media: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  analytics: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  formacion: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
      <path d="M6 12v5c3 3 9 3 12 0v-5" />
    </svg>
  ),
  admin_users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  chevronLeft: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  ),
  chevronRight: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),
  close: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  news: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M4 22h16a2 2 0 002-2V4a2 2 0 00-2-2H8a2 2 0 00-2 2v16a2 2 0 01-2 2zm0 0a2 2 0 01-2-2v-9" />
      <path d="M18 14h-8M15 18h-5M10 6h8v4h-8z" />
    </svg>
  ),
  courses: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
      <path d="M6 12v5c3 3 9 3 12 0v-5" />
    </svg>
  ),
  handshake: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M20.42 4.58a5.4 5.4 0 00-7.65 0l-.77.78-.77-.78a5.4 5.4 0 00-7.65 7.65l.77.79L12 21l-2.39-2.39" />
      <path d="M16 8l1.5 1.5" />
    </svg>
  ),
  fileDoc: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  ),
  team: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  ),
  history: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  sliders: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" />
    </svg>
  ),
  building: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
      <path d="M9 22v-4h6v4" />
      <path d="M8 6h.01" />
      <path d="M16 6h.01" />
      <path d="M8 10h.01" />
      <path d="M16 10h.01" />
      <path d="M8 14h.01" />
      <path d="M16 14h.01" />
      <path d="M12 6h.01" />
      <path d="M12 10h.01" />
      <path d="M12 14h.01" />
    </svg>
  ),
  solicitudes: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </svg>
  ),
  solicitudesCambio: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M19 8l3 3-3 3" />
      <path d="M14 11h8" />
    </svg>
  ),
  balance: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  denuncias: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
}

interface NavGroup {
  id: string
  label: string
  icon: React.ReactNode
  children?: NavItem[]
}

const NAV_MAIN: NavGroup[] = [
  { id: 'finanzas', label: 'Finanzas', icon: icons.balance },
  { id: 'noticias', label: 'Noticias', icon: icons.news },
  {
    id: 'normativas',
    label: 'Marco Legal',
    icon: icons.fileDoc,
    children: [
      { id: 'leyes', label: 'Leyes y Decretos', icon: icons.fileDoc },
      { id: 'reglamentos', label: 'Reglamentos y Estatutos', icon: icons.fileDoc },
      { id: 'normas', label: 'Normas y Procedimientos', icon: icons.fileDoc },
      { id: 'actas', label: 'Actas de Asamblea', icon: icons.fileDoc },
    ]
  },
  { id: 'directiva', label: 'Directiva', icon: icons.team },
  { id: 'config', label: 'Configuración', icon: icons.sliders },
  { id: 'formacion', label: 'Formación', icon: icons.formacion },
  { id: 'preinscripciones', label: 'Preinscripciones', icon: icons.solicitudes },
  { id: 'media', label: 'Medios', icon: icons.media },
  { id: 'afiliados', label: 'Afiliados', icon: icons.users },
  { id: 'solicitudes_cambio', label: 'Solicitudes de Cambio', icon: icons.solicitudesCambio },
  { id: 'denuncias', label: 'Denuncias', icon: icons.denuncias },
  { id: 'estudiantes', label: 'Estudiantes', icon: icons.formacion },
  { id: 'users', label: 'Usuarios', icon: icons.users },
  { id: 'admin_users', label: 'Administradores', icon: icons.admin_users },
  { id: 'analytics', label: 'Análisis', icon: icons.analytics },
]

const NAV_BOTTOM: NavItem[] = [
  { id: 'settings', label: 'Configuración', icon: icons.settings },
]

interface CmsAsideProps {
  mobileOpen?: boolean
  onMobileClose?: () => void
  activeId?: string
  onNavigate?: (id: string) => void
  width?: number
  isCollapsed?: boolean
  /** When true, apply CSS width transition (toggle). False during drag to avoid lag. */
  animating?: boolean
}

const NavButton = ({
  item,
  isActive,
  isCollapsed,
  onClick,
  compact = false,
}: {
  item: NavItem
  isActive: boolean
  isCollapsed: boolean
  onClick: () => void
  compact?: boolean
}) => (
  <button
    onClick={onClick}
    title={isCollapsed ? item.label : undefined}
    style={isActive
      ? { backgroundColor: 'var(--color-admin-accent-muted)', color: 'var(--color-admin-active-text)' }
      : undefined}
    className={[
      'relative flex items-center gap-3 rounded-xl transition-colors duration-150 w-full text-left group',
      isCollapsed ? 'justify-center px-0' : 'px-3',
      compact ? 'py-1.5' : 'py-2',
      isActive
        ? ''
        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800',
    ].join(' ')}
  >
    <span className="flex-shrink-0">{item.icon}</span>
    {!isCollapsed && <span className="text-sm font-medium truncate">{item.label}</span>}
    {isCollapsed && isActive && (
      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full" style={{ backgroundColor: 'var(--color-admin-active-text)' }} />
    )}
  </button>
)

async function fetchSolicitudesCambioCountData(token: string, signal?: AbortSignal) {
  const res = await fetch(`${API_URL}/api/afiliados/admin/solicitudes-cambio`, {
    headers: { Authorization: `Bearer ${token}` },
    signal
  })
  if (!res.ok) return 0
  const json = await res.json()
  if (json.success && Array.isArray(json.data)) {
    const pending = json.data.filter((s: any) =>
      ['Pendiente_Admin', 'Pendiente_Empresa'].includes(s.estatus)
    )
    return pending.length > 0 ? pending.length : json.data.length
  }
  return 0
}

async function fetchPreinscripcionesCountData(token: string, signal?: AbortSignal) {
  const res = await fetch(`${API_URL}/api/academia/preinscripciones?estatus=Preinscrito`, {
    headers: { Authorization: `Bearer ${token}` },
    signal
  })
  if (!res.ok) return 0
  const json = await res.json()
  if (json.success && Array.isArray(json.data)) {
    return json.data.length
  }
  return 0
}

const SidebarContent = ({
  isCollapsed = false,
  activeId,
  onNav,
  onClose,
  onLogout,
  isMobile = false,
}: {
  isCollapsed?: boolean
  activeId: string
  onNav: (id: string) => void
  onClose?: () => void
  onLogout?: () => void
  isMobile?: boolean
}) => {
  const { token, user, isAsistente, isAdmin } = useAuth()
  const [expandedGroups, setExpandedGroups] = React.useState<string[]>(['normativas'])
  const [solicitudesCambioCount, setSolicitudesCambioCount] = React.useState(0)
  const [preinscripcionesCount, setPreinscripcionesCount] = React.useState(0)

  const loadCounts = React.useCallback(async (signal: AbortSignal) => {
    if (!token) return
    try {
      const [solicitudesCount, preinscripCount] = await Promise.all([
        fetchSolicitudesCambioCountData(token, signal).catch(() => 0),
        fetchPreinscripcionesCountData(token, signal).catch(() => 0),
      ])
      if (!signal.aborted) {
        setSolicitudesCambioCount(solicitudesCount)
        setPreinscripcionesCount(preinscripCount)
      }
    } catch {
      /* ignore */
    }
  }, [token])

  useEffect(() => {
    if (!token) return
    const controller = new AbortController()
    loadCounts(controller.signal)
    return () => controller.abort()
  }, [token, loadCounts])

  const toggleGroup = (id: string) => {
    setExpandedGroups(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id])
  }

  // Auto-expand group if any of its children is active
  useEffect(() => {
    NAV_MAIN.forEach(item => {
      if (item.children?.some(child => child.id === activeId || child.children?.some(sc => sc.id === activeId))) {
        setExpandedGroups(prev => prev.includes(item.id) ? prev : [...prev, item.id])
      }
    })
  }, [activeId])

  return (
    <>
      {/* Logo area */}
      <div className={['flex items-center gap-2.5 px-3 py-2 border-b border-gray-100 overflow-hidden', isCollapsed ? 'justify-center px-0' : ''].join(' ')}>
        <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 overflow-hidden">
          <img src={logo} alt="Logo" className="w-full h-full object-contain grayscale brightness-0" />
        </div>
        {!isCollapsed && (
          <div className="flex flex-col leading-tight min-w-0 flex-1">
            <span className="text-slate-800 font-black text-[10px] tracking-tighter uppercase">Cámara Inmobiliaria</span>
            <span className="text-slate-400 font-black text-[9px] tracking-widest uppercase">de Bolívar</span>
          </div>
        )}
        {isMobile && onClose && (
          <button onClick={onClose} className="ml-auto p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors">
            {icons.close}
          </button>
        )}
      </div>

      {/* Main nav */}
      <nav className="flex-1 py-1 flex flex-col gap-0 px-2 overflow-y-auto custom-scrollbar">
        {NAV_MAIN.filter(i => {
          if (isAsistente && !isAdmin) {
            return ['afiliados', 'users'].includes(i.id);
          }
          if (i.id === 'admin_users') return user?.rol === 'super_admin';
          return true;
        }).map((item) => {
          const hasChildren = !!item.children?.length
          const childIds = item.children?.map(c => c.id) || []
          
          // Also check nested sub-children
          const allChildIds: string[] = [...childIds]
          item.children?.forEach(c => {
            if (c.children) allChildIds.push(...c.children.map(sc => sc.id))
          })

          const isGroupActive = activeId === item.id || allChildIds.includes(activeId)
          const isOpen = expandedGroups.includes(item.id)

          const hasPendingSolicitudes = item.id === 'solicitudes_cambio' && solicitudesCambioCount > 0
          const hasPendingPreinscripciones = item.id === 'preinscripciones' && preinscripcionesCount > 0

          return (
            <React.Fragment key={item.id}>
              <button
                onClick={() => {
                  if (hasChildren) {
                    toggleGroup(item.id)
                  } else {
                    onNav(item.id)
                  }
                }}
                title={isCollapsed ? item.label : undefined}
                style={isGroupActive && !hasChildren
                  ? { backgroundColor: 'var(--color-admin-accent-muted)', color: 'var(--color-admin-active-text)' }
                  : undefined}
                className={[
                  'relative flex items-center gap-3 rounded-xl py-1.5 transition-colors duration-150 w-full text-left group',
                  isCollapsed ? 'justify-center px-0' : 'px-3',
                  isGroupActive && !hasChildren ? '' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800',
                  hasChildren && isOpen ? 'text-slate-700 font-semibold' : ''
                ].join(' ')}
              >
                <span className="flex-shrink-0 relative">
                  {item.icon}
                  {/* Punto distintivo encima del ícono para solicitudes pendientes */}
                  {(hasPendingSolicitudes || hasPendingPreinscripciones) && (
                    <span 
                      className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#00D084] rounded-full ring-2 ring-white animate-pulse"
                      title={hasPendingSolicitudes ? `${solicitudesCambioCount} solicitudes pendientes` : `${preinscripcionesCount} preinscripciones pendientes`}
                    />
                  )}
                </span>
                {!isCollapsed && <span className="text-sm font-medium truncate flex-1">{item.label}</span>}
                {!isCollapsed && hasPendingSolicitudes && (
                  <span className="min-w-[18px] h-[18px] px-1.5 bg-[#00D084] text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-xs shrink-0">
                    {solicitudesCambioCount}
                  </span>
                )}
                {!isCollapsed && hasPendingPreinscripciones && (
                  <span className="min-w-[18px] h-[18px] px-1.5 bg-[#00D084] text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-xs shrink-0">
                    {preinscripcionesCount}
                  </span>
                )}
                {!isCollapsed && hasChildren && (
                  <span className={['transition-transform duration-200 text-slate-400', isOpen ? 'rotate-90' : ''].join(' ')}>
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
                  </span>
                )}
              </button>

              {/* Sub-items */}
              {hasChildren && isOpen && !isCollapsed && (
                <div className="ml-3 pl-3 border-l border-gray-100 flex flex-col gap-0.5 mb-1">
                  {item.children?.map(child => {
                    const hasSubChildren = !!child.children?.length
                    const subChildIds = child.children?.map(sc => sc.id) || []
                    const isSubActive = activeId === child.id || subChildIds.includes(activeId)
                    const isSubOpen = expandedGroups.includes(child.id)

                    return (
                      <React.Fragment key={child.id}>
                        <button
                          onClick={() => {
                            onNav(child.id)
                            if (hasSubChildren) toggleGroup(child.id)
                          }}
                          style={activeId === child.id && !hasSubChildren
                            ? { backgroundColor: 'var(--color-admin-accent-muted)', color: 'var(--color-admin-active-text)' }
                            : undefined}
                          className={[
                            'flex items-center gap-2.5 rounded-xl py-1.5 px-3 text-[13px] transition-colors duration-150 w-full text-left',
                            isSubActive ? 'text-[#00D084]' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                          ].join(' ')}
                        >
                          <span className="flex-shrink-0">{child.icon}</span>
                          <span className="truncate font-medium flex-1">{child.label}</span>
                          {hasSubChildren && (
                            <span className={['transition-transform duration-200 opacity-40', isSubOpen ? 'rotate-90' : ''].join(' ')}>
                              <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
                            </span>
                          )}
                        </button>

                        {hasSubChildren && isSubOpen && (
                          <div className="ml-4 pl-3 border-l border-emerald-100 flex flex-col gap-0.5 mb-1 mt-0.5">
                            {child.children?.map(sc => (
                              <button
                                key={sc.id}
                                onClick={() => onNav(sc.id)}
                                className={[
                                  'py-1 px-2 text-[10px] font-medium transition-colors rounded-lg text-left',
                                  activeId === sc.id
                                    ? 'text-emerald-600 bg-emerald-50'
                                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                                ].join(' ')}
                              >
                                {sc.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </React.Fragment>
                    )
                  })}
                </div>
              )}
            </React.Fragment>
          )
        })}
      </nav>

      {/* Bottom nav */}
      <div className="pb-3 px-2 flex flex-col gap-0.5 border-t border-gray-100 pt-2">
        {NAV_BOTTOM.filter(i => {
          if (isAsistente && !isAdmin && i.id === 'settings') return false;
          return true;
        }).map((item) => (
          <NavButton
            key={item.id}
            item={item}
            isActive={activeId === item.id}
            isCollapsed={isCollapsed}
            onClick={() => onNav(item.id)}
            compact
          />
        ))}
        {/* Logout */}
        <button
          onClick={onLogout}
          title={isCollapsed ? 'Cerrar sesión' : undefined}
          className={[
            'flex items-center gap-3 rounded-xl py-1.5 w-full text-left transition-colors duration-150 mt-0.5',
            isCollapsed ? 'justify-center px-0' : 'px-3',
            'text-red-400 hover:bg-red-50 hover:text-red-600',
          ].join(' ')}
        >
          <span className="flex-shrink-0">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </span>
          {!isCollapsed && <span className="text-sm font-medium">Cerrar sesión</span>}
        </button>
      </div>
    </>
  )
}

const CmsAside = ({
  mobileOpen = false,
  onMobileClose,
  activeId: controlledActiveId,
  onNavigate,
  width = 220,
  isCollapsed = false,
  animating = true,
}: CmsAsideProps) => {
  const [internalActiveId, setInternalActiveId] = useState('analytics')
  const { logout } = useAuth()

  const activeId = controlledActiveId !== undefined ? controlledActiveId : internalActiveId

  const handleNav = (id: string) => {
    setInternalActiveId(id)
    onNavigate?.(id)
    // Close mobile drawer on navigation
    onMobileClose?.()
  }

  return (
    <>
      {/* ── MOBILE DRAWER ─────────────────────────────────────────────── */}
      {/* Backdrop */}
      <div
        className={[
          'fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300 md:hidden',
          mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        ].join(' ')}
        onClick={onMobileClose}
      />

      {/* Drawer panel */}
      <aside
        className={[
          'fixed inset-y-0 left-0 z-50 flex flex-col w-[260px] bg-white border-r border-gray-100 shadow-2xl transition-transform duration-300 ease-in-out md:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <SidebarContent
          isCollapsed={false}
          activeId={activeId}
          onNav={handleNav}
          onClose={onMobileClose}
          onLogout={logout}
          isMobile
        />
      </aside>

      {/* ── DESKTOP SIDEBAR ───────────────────────────────────────────── */}
      <aside
        className="relative hidden md:flex flex-col justify-between h-full bg-white border-gray-100 overflow-hidden flex-shrink-0"
        style={{
          width,
          transition: animating ? 'width 0.28s cubic-bezier(0.4,0,0.2,1)' : 'none',
        }}
      >
        <SidebarContent
          isCollapsed={isCollapsed}
          activeId={activeId}
          onNav={handleNav}
          onLogout={logout}
        />
      </aside>
    </>
  )
}

export default CmsAside

