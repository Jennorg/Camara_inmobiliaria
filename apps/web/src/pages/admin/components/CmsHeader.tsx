import React from 'react';
import NotificationCenter from '@/components/NotificationCenter';

interface CmsHeaderProps {
  title?: string;
  subtitle?: string;
  searchPlaceholder?: string;
  buttonText?: string;
  onSearch?: (value: string) => void;
  onNewPost?: () => void;
  /** Called when hamburger is tapped on mobile */
  onMenuOpen?: () => void;
}

const HamburgerIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
)

const CmsHeader = ({
  title = 'Dashboard',
  subtitle = 'Resumen general',
  searchPlaceholder = 'Buscar...',
  buttonText = 'Nuevo',
  onSearch,
  onNewPost,
  onMenuOpen,
}: CmsHeaderProps) => {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center w-full py-4 px-4 sm:px-8 bg-white border-b border-gray-100 gap-3 sm:gap-0">

      {/* Left: hamburger (mobile only) + icon + title */}
      <div className="flex items-center gap-3 w-full sm:w-auto">

        {/* Hamburger – only visible on mobile */}
        <button
          onClick={onMenuOpen}
          className="md:hidden flex items-center justify-center w-9 h-9 rounded-xl text-slate-500 hover:bg-slate-100 transition-colors flex-shrink-0"
          aria-label="Abrir menú"
        >
          <HamburgerIcon />
        </button>

        {/* Icon */}
        <div
          className="flex items-center justify-center w-9 h-9 rounded-full text-white shadow-sm flex-shrink-0"
          style={{ backgroundColor: 'var(--color-admin-accent)' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
        </div>

        {/* Text */}
        <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-3 min-w-0">
          <h1 className="text-lg sm:text-[22px] font-bold text-slate-900 leading-none truncate">{title}</h1>
          {subtitle && (
            <span className="text-xs sm:text-sm font-medium text-slate-400 leading-none truncate">{subtitle}</span>
          )}
        </div>
      </div>

      {/* Right: search + action button */}
      <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
        <NotificationCenter />

        {/* Search */}
        <div className="relative flex-1 sm:w-[240px] sm:flex-none">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <input
            type="text"
            className="block w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-100 rounded-full text-sm placeholder-gray-400 outline-none transition-colors"
            style={{ '--tw-ring-color': 'var(--color-admin-accent)' } as React.CSSProperties}
            placeholder={searchPlaceholder}
            onChange={(e) => onSearch?.(e.target.value)}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--color-admin-accent)')}
            onBlur={(e)  => (e.currentTarget.style.borderColor = '')}
          />
        </div>

        {/* Action button */}
        <button
          onClick={onNewPost}
          className="flex-shrink-0 inline-flex items-center justify-center px-3 sm:px-4 py-2 border border-transparent rounded-full font-semibold text-white transition-colors shadow-sm text-sm whitespace-nowrap"
          style={{ backgroundColor: 'var(--color-admin-accent)' }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-admin-accent-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-admin-accent)')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span className="hidden xs:inline sm:inline">{buttonText}</span>
        </button>
      </div>
    </div>
  );
}

export default CmsHeader;