import React, { useEffect, useRef, useState } from 'react';
import logo from '@/assets/Logo.webp';
import { LogOut, X, ChevronLeft, ChevronRight, Building2 } from 'lucide-react';

export interface NavItem {
  id?: string;
  icon: React.ElementType;
  label: string;
  isDivider?: boolean;
  count?: number;
  hasPendingDot?: boolean;
  children?: NavItem[];
}

interface DashboardSidebarProps {
  navItems: NavItem[];
  activeTab: string;
  onTabChange: (label: string) => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
  onLogout?: () => void;
}

// Curva de salida suave (rápida al inicio, asienta al final) compartida por las animaciones del aside
const EASE = 'ease-[cubic-bezier(0.22,1,0.36,1)]';

/** Etiqueta que se desvanece y se desliza al expandir el aside; entra un poco después de que empiece a abrirse. */
const etiquetaAnim = (isCollapsed: boolean) =>
  `transition-[opacity,transform] duration-300 ${EASE} motion-reduce:transition-none ${
    isCollapsed ? 'opacity-0 -translate-x-2' : 'opacity-100 translate-x-0'
  }`;

// ─── Nav Button ───────────────────────────────────────────────────────────────

const NavButton = ({
  icon: Icon,
  label,
  isActive,
  isCollapsed,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  isActive: boolean;
  isCollapsed: boolean;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    title={isCollapsed ? label : undefined}
    style={
      isActive
        ? { backgroundColor: 'var(--color-accent)', color: 'var(--color-text-on-accent)' }
        : undefined
    }
    className={[
      'flex items-center gap-3 w-full rounded-xl py-3 transition-colors duration-150 text-left group',
      isCollapsed ? 'justify-center px-2' : 'px-3',
      isActive
        ? 'shadow-lg'
        : 'text-white/60 hover:text-white hover:bg-white/10',
    ].join(' ')}
  >
    <Icon size={20} className={isActive ? '' : 'group-hover:scale-110 transition-transform'} />
    {!isCollapsed && <span className="font-semibold text-sm tracking-tight">{label}</span>}
  </button>
);

// ─── Sidebar Content ──────────────────────────────────────────────────────────

const SidebarContent = ({
  navItems,
  activeTab,
  onTabChange,
  isCollapsed,
  onMobileClose,
  onLogout,
  isMobile = false,
}: {
  navItems: NavItem[];
  activeTab: string;
  onTabChange: (label: string) => void;
  isCollapsed: boolean;
  onMobileClose?: () => void;
  onLogout?: () => void;
  isMobile?: boolean;
}) => {
  const [expandedTabs, setExpandedTabs] = useState<string[]>([]);

  const toggleExpand = (label: string) => {
    setExpandedTabs(prev => prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div
        className="flex items-center gap-3 px-[22px] py-3 border-b border-white/10"
      >
        <div
          className="w-9 h-9 flex items-center justify-center flex-shrink-0"
        >
          <img src={logo} alt="Logo" className="w-full h-full object-contain brightness-0 invert" />
        </div>
        <div className={`flex flex-col leading-tight shrink-0 ${etiquetaAnim(isCollapsed)}`} style={{ transitionDelay: isCollapsed ? '0ms' : '90ms' }}>
          <div className="flex flex-col leading-tight whitespace-nowrap">
            <span className="font-extrabold text-[11px] tracking-tighter uppercase leading-none text-white">
              Cámara Inmobiliaria
            </span>
            <span className="text-[10px] font-bold tracking-widest uppercase text-white/50">
              de Bolívar
            </span>
          </div>
        </div>
        {isMobile && onMobileClose && (
          <button
            onClick={onMobileClose}
            className="ml-auto p-1.5 rounded-lg text-white/40 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className={`flex-grow py-2 px-2 space-y-0.5 overflow-y-auto custom-scrollbar ${isCollapsed ? 'scrollbar-collapsed' : 'scrollbar-expanded'}`}>
        {navItems.map((item, idx) => {
          const retardo = isCollapsed ? '0ms' : `${90 + Math.min(idx, 12) * 20}ms`;
          const hasChildren = !!item.children?.length;
          const itemId = item.id || item.label;
          const isExpanded = expandedTabs.includes(itemId);
          
          return item.isDivider ? (
            <div key={item.label} className="px-3 pt-2 pb-0.5">
              {/* El rótulo de sección abre su altura con la rejilla (0fr → 1fr) para no dar un salto */}
              <div className={`grid transition-[grid-template-rows,opacity] duration-300 ${EASE} motion-reduce:transition-none ${isCollapsed ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'}`} style={{ transitionDelay: retardo }}>
                <div className="overflow-hidden min-h-0">
                  <span className="block pb-1 text-[9px] font-black tracking-widest uppercase opacity-40 text-white leading-none whitespace-nowrap">
                    {item.label.replace('— ', '').replace(' —', '')}
                  </span>
                </div>
              </div>
              <div className="border-t border-white/10" />
            </div>
          ) : (
            <React.Fragment key={item.id ? `id-${item.id}` : `label-${item.label}`}>
              <button
                onClick={() => {
                  onTabChange(itemId);
                  if (hasChildren) toggleExpand(itemId);
                  if (!hasChildren) onMobileClose?.();
                }}
                title={isCollapsed ? item.label : undefined}
                style={
                  activeTab === itemId
                    ? { backgroundColor: 'var(--color-accent)', color: 'var(--color-text-on-accent)' }
                    : undefined
                }
                className={[
                  'relative flex items-center gap-3 w-full rounded-xl py-2 pl-[22px] pr-3 transition-[background-color,color,box-shadow] duration-200 text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60',
                  activeTab === itemId
                    ? 'shadow-lg'
                    : 'text-white/60 hover:text-white hover:bg-white/10',
                ].join(' ')}
              >
                {/* Marca de la pestaña activa: crece desde el centro del borde izquierdo */}
                <span
                  aria-hidden="true"
                  className={`absolute left-1 top-1/2 -translate-y-1/2 w-1 rounded-full bg-white/90 transition-[height,opacity] duration-300 ${EASE} motion-reduce:transition-none ${activeTab === itemId ? 'h-5 opacity-100' : 'h-0 opacity-0'}`}
                />
                <div className="relative flex-shrink-0">
                  <item.icon size={20} className={activeTab === itemId ? '' : 'group-hover:scale-110 transition-transform'} />
                  {(item.hasPendingDot || (item.count !== undefined && item.count > 0)) && (
                    <span
                      className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#00D084] ring-2 ring-slate-900 animate-pulse"
                      title={`${item.count || 1} pendiente(s)`}
                    />
                  )}
                </div>
                <div className={`w-[190px] shrink-0 flex items-center justify-between ml-3 ${etiquetaAnim(isCollapsed)}`} style={{ transitionDelay: retardo }}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-semibold text-sm tracking-tight truncate whitespace-nowrap">{item.label}</span>
                    {item.count !== undefined && item.count > 0 && (
                      <span className="px-1.5 py-0.5 rounded-md bg-[#00D084] text-white text-[9px] font-black leading-none">
                        {item.count}
                      </span>
                    )}
                  </div>
                  {hasChildren && (
                    <ChevronRight size={14} className={['transition-transform duration-200 opacity-40 flex-shrink-0', isExpanded ? 'rotate-90' : ''].join(' ')} />
                  )}
                </div>
              </button>

              {hasChildren && (
                <div
                  inert={!(isExpanded && !isCollapsed)}
                  className={`grid transition-[grid-template-rows,opacity] duration-300 ${EASE} motion-reduce:transition-none ${isExpanded && !isCollapsed ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
                >
                <div className="min-h-0 overflow-hidden">
                <div className="ml-6 pl-3 border-l border-white/10 flex flex-col gap-0 mt-0.5 mb-1">
                  {item.children?.map(child => {
                    const childId = child.id || child.label;
                    return (
                      <button
                        key={childId}
                        onClick={() => {
                          onTabChange(childId);
                          onMobileClose?.();
                        }}
                        className={[
                          'py-1.5 px-2 text-xs font-bold transition-colors rounded-lg text-left',
                          activeTab === childId 
                            ? 'text-white bg-white/10' 
                            : 'text-white/40 hover:text-white hover:bg-white/5'
                        ].join(' ')}
                      >
                        {child.label}
                      </button>
                    );
                  })}
                </div>
                </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-2 border-t border-white/10">
        <button
          onClick={onLogout}
          className="flex items-center gap-3 w-full pl-[22px] pr-3 py-1.5 rounded-xl transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          style={{ color: 'var(--color-danger)' }}
        >
          <LogOut size={20} className="flex-shrink-0" />
          <div className={`ml-3 shrink-0 ${etiquetaAnim(isCollapsed)}`} style={{ transitionDelay: isCollapsed ? '0ms' : '200ms' }}>
            <span className="font-bold text-sm uppercase tracking-tighter whitespace-nowrap">Cerrar Sesión</span>
          </div>
        </button>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const DashboardSidebar = ({
  navItems,
  activeTab,
  onTabChange,
  mobileOpen,
  onMobileClose,
  onLogout,
}: DashboardSidebarProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const [hasFocus, setHasFocus] = useState(false);
  const abierto = isHovered || hasFocus;
  // Pequeña tolerancia para que rozar el borde con el cursor no abra y cierre el aside a destellos
  const temporizador = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pasarCursor = (dentro: boolean) => {
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setIsHovered(dentro), dentro ? 70 : 140);
  };
  useEffect(() => () => clearTimeout(temporizador.current), []);

  return (
    <>
      {/* Mobile backdrop */}
      <div
        onClick={onMobileClose}
        className={[
          'fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 md:hidden',
          mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        ].join(' ')}
      />

      {/* Mobile drawer */}
      <aside
        className={[
          'fixed inset-y-0 left-0 z-50 flex flex-col w-72 shadow-2xl transition-transform duration-300 ease-in-out md:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
        style={{ backgroundColor: 'var(--color-primary)' }}
      >
        <SidebarContent navItems={navItems} activeTab={activeTab} onTabChange={onTabChange} isCollapsed={false} onMobileClose={onMobileClose} onLogout={onLogout} isMobile />
      </aside>

      {/* Desktop sidebar: ocupa su ancho en el layout y empuja el contenido al abrirse */}
      <aside
        onMouseEnter={() => pasarCursor(true)}
        onMouseLeave={() => pasarCursor(false)}
        onFocus={() => setHasFocus(true)}
        onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setHasFocus(false); }}
        className={[
          'hidden md:flex flex-col h-full sticky top-0 flex-shrink-0 overflow-hidden shadow-2xl',
          `transition-[width] duration-300 ${EASE} motion-reduce:transition-none`,
          abierto ? 'w-72' : 'w-20',
        ].join(' ')}
        style={{ backgroundColor: 'var(--color-primary)' }}
      >
        <SidebarContent
          navItems={navItems}
          activeTab={activeTab}
          onTabChange={onTabChange}
          isCollapsed={!abierto}
          onLogout={onLogout}
        />
      </aside>
    </>
  );
};

export default DashboardSidebar;
