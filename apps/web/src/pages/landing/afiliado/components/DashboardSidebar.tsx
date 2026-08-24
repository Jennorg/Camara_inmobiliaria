import React, { useState } from 'react';
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
        className={`flex items-center gap-3 px-5 py-3 border-b border-white/10 ${isCollapsed ? 'justify-center' : ''}`}
      >
        <div
          className="w-9 h-9 flex items-center justify-center flex-shrink-0"
        >
          <img src={logo} alt="Logo" className="w-full h-full object-contain brightness-0 invert" />
        </div>
        <div className={`flex flex-col leading-tight transition-colors duration-300 overflow-hidden ${isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
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
        {navItems.map((item) => {
          const hasChildren = !!item.children?.length;
          const itemId = item.id || item.label;
          const isExpanded = expandedTabs.includes(itemId);
          
          return item.isDivider ? (
            <div key={item.label} className={['transition-colors duration-300 px-3', isCollapsed ? 'py-2 px-4' : 'pt-2 pb-0.5'].join(' ')}>
              <div className={`overflow-hidden transition-colors duration-300 ${isCollapsed ? 'h-0 opacity-0' : 'h-auto opacity-100'}`}>
                <span className="text-[9px] font-black tracking-widest uppercase opacity-40 text-white leading-none whitespace-nowrap">
                  {item.label.replace('— ', '').replace(' —', '')}
                </span>
              </div>
              <div className={`${!isCollapsed ? 'mt-1' : ''} border-t border-white/10`} />
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
                  'flex items-center gap-3 w-full rounded-xl py-2 transition-colors duration-150 text-left group',
                  isCollapsed ? 'justify-center px-2' : 'px-3',
                  activeTab === itemId
                    ? 'shadow-lg'
                    : 'text-white/60 hover:text-white hover:bg-white/10',
                ].join(' ')}
              >
                <div className="relative flex-shrink-0">
                  <item.icon size={20} className={activeTab === itemId ? '' : 'group-hover:scale-110 transition-transform'} />
                  {(item.hasPendingDot || (item.count !== undefined && item.count > 0)) && (
                    <span
                      className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#00D084] ring-2 ring-slate-900 animate-pulse"
                      title={`${item.count || 1} pendiente(s)`}
                    />
                  )}
                </div>
                <div className={`flex-1 flex items-center justify-between overflow-hidden transition-colors duration-300 ${isCollapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-full opacity-100 ml-3'}`}>
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

              {hasChildren && isExpanded && !isCollapsed && (
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
              )}
            </React.Fragment>
          );
        })}
      </nav>

      {/* Logout */}
      <div className={`p-2 border-t border-white/10 ${isCollapsed ? 'flex justify-center' : ''}`}>
        <button
          onClick={onLogout}
          className={`flex items-center gap-3 w-full px-3 py-1.5 rounded-xl transition-colors hover:bg-white/10 ${isCollapsed ? 'justify-center' : ''}`}
          style={{ color: 'var(--color-danger)' }}
        >
          <LogOut size={20} className="flex-shrink-0" />
          <div className={`overflow-hidden transition-colors duration-300 ${isCollapsed ? 'w-0 opacity-0 ml-0' : 'w-auto opacity-100 ml-3'}`}>
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

      {/* Desktop sidebar */}
      <aside
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={[
          'relative hidden md:flex flex-col h-screen sticky top-0 shadow-2xl transition-colors duration-300 ease-in-out flex-shrink-0 overflow-hidden',
          isHovered ? 'w-72' : 'w-20',
        ].join(' ')}
        style={{ backgroundColor: 'var(--color-primary)' }}
      >
        <SidebarContent
          navItems={navItems}
          activeTab={activeTab}
          onTabChange={onTabChange}
          isCollapsed={!isHovered}
          onLogout={onLogout}
        />
      </aside>
    </>
  );
};

export default DashboardSidebar;
