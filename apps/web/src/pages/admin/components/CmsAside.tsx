import React, { useState, useEffect } from 'react'
import logo from '@/assets/Logo.png'
import { useAuth } from '@/context/AuthContext'

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
}

interface NavGroup {
  id: string
  label: string
  icon: React.ReactNode
  children?: NavItem[]
}

const CMS_CHILDREN: NavItem[] = [
  { id: 'cms_noticias', label: 'Noticias', icon: icons.news },
  {
    id: 'cms_normativas',
    label: 'Marco Legal',
    icon: icons.fileDoc,
    children: [
      { id: 'cms_leyes', label: 'Leyes y Decretos', icon: icons.fileDoc },
      { id: 'cms_reglamentos', label: 'Reglamentos y Estatutos', icon: icons.fileDoc },
      { id: 'cms_normas', label: 'Normas y Procedimientos', icon: icons.fileDoc },
      { id: 'cms_actas', label: 'Actas de Asamblea', icon: icons.fileDoc },
    ]
  },
  { id: 'cms_directiva', label: 'Directiva', icon: icons.team },
  { id: 'cms_config', label: 'Configuración', icon: icons.sliders },
]

const NAV_MAIN: NavGroup[] = [
  { id: 'dashboard', label: 'Dashboard', icon: icons.dashboard },
  { id: 'cms', label: 'Contenido', icon: icons.cms, children: CMS_CHILDREN },
  { id: 'formacion', label: 'Formación', icon: icons.formacion },
  { id: 'preinscripciones', label: 'Preinscripciones', icon: icons.solicitudes },
  { id: 'media', label: 'Medios', icon: icons.media },
  { id: 'afiliados', label: 'Afiliados', icon: icons.users },
  { id: 'solicitudes_cambio', label: 'Solicitudes Cambio', icon: icons.solicitudes },
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
      'relative flex items-center gap-3 rounded-xl transition-all duration-150 w-full text-left group',
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

const SidebarContent = ({
  isCollapsed,
  activeId,
  onNav,
  onClose,
  onLogout,
  isMobile = false,
}: {
  isCollapsed: boolean
  activeId: string
  onNav: (id: string) => void
  onClose?: () => void
  onLogout?: () => void
  isMobile?: boolean
}) => {
  const { user } = useAuth()
  // Auto-expand CMS group if any child is active
  // Auto-expand CMS group if any child (even nested) is active
  const getAllIds = (items: NavItem[]): string[] => {
    const ids: string[] = []
    items.forEach(i => {
      ids.push(i.id)
      if (i.children) ids.push(...getAllIds(i.children))
    })
    return ids
  }
  const cmsChildIds = getAllIds(CMS_CHILDREN)
  const [cmsOpen, setCmsOpen] = React.useState(cmsChildIds.includes(activeId) || activeId === 'cms')
  const [expandedIds, setExpandedIds] = React.useState<string[]>(['cms_normativas'])

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  // Sync cmsOpen when activeId changes externally
  useEffect(() => {
    if (cmsChildIds.includes(activeId) || activeId === 'cms') {
      setCmsOpen(true)
    }
  }, [activeId, cmsChildIds])

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
        {NAV_MAIN.filter(i => i.id !== 'admin_users' || user?.rol === 'super_admin').map((item) => {
          const isCmsGroup = item.id === 'cms'
          const isGroupActive = isCmsGroup
            ? cmsChildIds.includes(activeId) || activeId === 'cms'
            : activeId === item.id

          return (
            <React.Fragment key={item.id}>
              <button
                onClick={() => {
                  if (isCmsGroup) {
                    setCmsOpen(o => !o)
                  } else {
                    onNav(item.id)
                  }
                }}
                title={isCollapsed ? item.label : undefined}
                style={isGroupActive && !isCmsGroup
                  ? { backgroundColor: 'var(--color-admin-accent-muted)', color: 'var(--color-admin-active-text)' }
                  : undefined}
                className={[
                  'relative flex items-center gap-3 rounded-xl py-1.5 transition-all duration-150 w-full text-left group',
                  isCollapsed ? 'justify-center px-0' : 'px-3',
                  isGroupActive && !isCmsGroup ? '' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800',
                  isCmsGroup && cmsOpen ? 'text-slate-700 font-semibold' : ''
                ].join(' ')}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                {!isCollapsed && <span className="text-sm font-medium truncate flex-1">{item.label}</span>}
                {!isCollapsed && isCmsGroup && (
                  <span className={['transition-transform duration-200 text-slate-400', cmsOpen ? 'rotate-90' : ''].join(' ')}>
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
                  </span>
                )}
              </button>

              {/* CMS sub-items */}
              {isCmsGroup && cmsOpen && !isCollapsed && (
                <div className="ml-3 pl-3 border-l border-gray-100 flex flex-col gap-0.5 mb-1">
                  {CMS_CHILDREN.map(child => {
                    const hasSubChildren = !!child.children?.length
                    const subChildIds = child.children?.map(sc => sc.id) || []
                    const isSubActive = activeId === child.id || subChildIds.includes(activeId)
                    const isExpanded = expandedIds.includes(child.id)

                    return (
                      <React.Fragment key={child.id}>
                        <button
                          onClick={() => {
                            onNav(child.id)
                            if (hasSubChildren) toggleExpand(child.id)
                          }}
                          style={activeId === child.id
                            ? { backgroundColor: 'var(--color-admin-accent-muted)', color: 'var(--color-admin-active-text)' }
                            : undefined}
                          className={[
                            'flex items-center gap-2.5 rounded-xl py-1.5 px-3 text-[13px] transition-all duration-150 w-full text-left',
                            isSubActive ? 'text-[#00D084]' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                          ].join(' ')}
                        >
                          <span className="flex-shrink-0">{child.icon}</span>
                          <span className="truncate font-medium flex-1">{child.label}</span>
                          {hasSubChildren && (
                            <span className={['transition-transform duration-200 opacity-40', isExpanded ? 'rotate-90' : ''].join(' ')}>
                              <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
                            </span>
                          )}
                        </button>

                        {hasSubChildren && isExpanded && (
                          <div className="ml-4 pl-3 border-l border-emerald-100 flex flex-col gap-0.5 mb-1 mt-0.5">
                            {child.children?.map(sc => (
                              <button
                                key={sc.id}
                                onClick={() => onNav(sc.id)}
                                className={[
                                  'py-1 px-2 text-[10px] font-medium transition-all rounded-lg text-left',
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
        {NAV_BOTTOM.map((item) => (
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
            'flex items-center gap-3 rounded-xl py-1.5 w-full text-left transition-all duration-150 mt-0.5',
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
  const [internalActiveId, setInternalActiveId] = useState('dashboard')
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

