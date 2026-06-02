import React from 'react';
import { Menu, User } from 'lucide-react';

import NotificationCenter from '@/components/NotificationCenter';

interface DashboardHeaderProps {
  onMenuOpen: () => void;
  userName?: string;
  userCode?: string;
}

const DashboardHeader = ({
  onMenuOpen,
  userName = 'Juan Pérez',
  userCode = 'CIBIR-2026-001',
}: DashboardHeaderProps) => (
  <header
    className="sticky top-0 z-40 px-4 sm:px-8 py-3 h-18 flex items-center justify-between gap-4 shadow-sm border-b"
    style={{
      backgroundColor: 'var(--color-bg-surface)',
      borderColor: 'var(--color-border-accent)',
    }}
  >
    {/* Left: Hamburger */}
    <div className="flex items-center gap-3 flex-grow max-w-xl">
      <button
        onClick={onMenuOpen}
        className="md:hidden p-2 rounded-lg transition-colors flex-shrink-0"
        style={{ color: 'var(--color-text-muted)' }}
        aria-label="Abrir menú"
      >
        <Menu size={20} />
      </button>
    </div>

    {/* Right: Notifications + Profile */}
    <div className="flex items-center gap-4 flex-shrink-0">
      <div className="flex items-center gap-1 pr-4" style={{ borderRight: '1px solid var(--color-border)' }}>
        <NotificationCenter />
      </div>

      <div className="flex items-center gap-3 cursor-pointer group">
        <div className="hidden sm:flex flex-col text-right leading-tight">
          <span className="font-bold text-sm" style={{ color: 'var(--color-text-base)' }}>{userName}</span>
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-accent-hover)' }}>{userCode}</span>
        </div>
        <div
          className="w-9 h-9 rounded-full border-2 border-white shadow-sm flex items-center justify-center overflow-hidden transition-all"
          style={{ backgroundColor: 'var(--color-accent-muted)' }}
        >
          <User size={18} style={{ color: 'var(--color-accent-hover)' }} />
        </div>
      </div>
    </div>
  </header>
);

export default DashboardHeader;
