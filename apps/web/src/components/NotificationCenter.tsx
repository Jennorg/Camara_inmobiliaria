import React, { useState, useRef, useEffect } from 'react';
import { Bell, CheckCheck, Info, AlertTriangle, AlertCircle, Inbox, X } from 'lucide-react';
import { useNotifications, Notification } from '@/hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { NotificationHistoryModal } from './NotificationHistoryModal';

const PriorityIcon = ({ priority, leido }: { priority: string, leido: boolean }) => {
  const baseClass = leido ? "text-slate-400" : "";
  switch (priority) {
    case 'URGENTE': return <AlertCircle size={16} className={`${baseClass} text-rose-500`} />;
    case 'ALTA': return <AlertTriangle size={16} className={`${baseClass} text-amber-500`} />;
    default: return <Info size={16} className={`${baseClass} text-emerald-500`} />;
  }
};

const NotificationCenter = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead, loading } = useNotifications();
  const dropdownRef = useRef<HTMLDivElement>(null);

  /* ── Cerrar al click fuera ── */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /* ── Bloquear scroll del body en móvil cuando está abierto ── */
  useEffect(() => {
    const isMobile = window.innerWidth < 640;
    if (isOpen && isMobile) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>

      {/* ── Botón campana ── */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notificaciones"
        aria-expanded={isOpen}
        className="p-2 rounded-full transition-colors hover:bg-slate-100 group"
      >
        <div className="relative inline-block">
          <Bell
            size={20}
            className={`${unreadCount > 0 ? 'text-emerald-600' : 'text-slate-500'} group-hover:scale-110 transition-transform`}
          />
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white text-[9px] font-black flex items-center justify-center rounded-full border-2 border-white shadow-sm select-none">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
      </button>

      {/* ── Overlay oscuro en móvil ── */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 sm:hidden"
          aria-hidden="true"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* ── Panel de notificaciones ── */}
      {isOpen && (
        <div
          className={[
            // Base
            'bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden',
            'animate-in fade-in zoom-in-95 duration-200',
            // Móvil: sheet desde abajo, ancho completo
            'fixed bottom-0 left-0 right-0 rounded-b-none rounded-t-2xl w-full',
            // sm+: dropdown flotante anclado a la derecha del botón
            'sm:absolute sm:bottom-auto sm:left-auto sm:right-0 sm:top-full sm:mt-3 sm:w-[22rem] sm:rounded-2xl',
          ].join(' ')}
        >
          {/* Cabecera */}
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Notificaciones</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Intranet Cámara</p>
            </div>
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="flex items-center gap-1.5 text-[10px] font-black text-emerald-600 uppercase tracking-widest hover:text-emerald-700 transition-colors"
                >
                  <CheckCheck size={14} />
                  <span className="hidden xs:inline sm:inline">Marcar todas</span>
                </button>
              )}
              {/* Botón cerrar – visible en móvil */}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Cerrar notificaciones"
                className="sm:hidden p-1.5 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Lista */}
          <div className="max-h-[55vh] sm:max-h-[420px] overflow-y-auto custom-scrollbar">
            {loading && notifications.length === 0 ? (
              <div className="p-10 text-center space-y-3">
                <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mx-auto" />
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Cargando...</p>
              </div>
            ) : notifications.length > 0 ? (
              <div className="divide-y divide-slate-50">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => n.leido === 0 && markAsRead(n.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        if (n.leido === 0) markAsRead(n.id)
                      }
                    }}
                    className={`px-4 sm:px-5 py-4 transition-colors cursor-pointer hover:bg-slate-50 flex gap-3 sm:gap-4 ${n.leido === 0 ? 'bg-emerald-50/20' : ''}`}
                  >
                    <div className="shrink-0 mt-1">
                      <PriorityIcon priority={n.prioridad} leido={n.leido === 1} />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-xs font-bold truncate ${n.leido === 0 ? 'text-slate-900' : 'text-slate-500'}`}>
                          {n.titulo}
                        </p>
                        <span className="text-[9px] font-medium text-slate-400 shrink-0 whitespace-nowrap">
                          {formatDistanceToNow(new Date(n.creado_en), { addSuffix: true, locale: es })}
                        </span>
                      </div>
                      <p className={`text-xs leading-relaxed line-clamp-2 ${n.leido === 0 ? 'text-slate-600 font-medium' : 'text-slate-400'}`}>
                        {n.mensaje}
                      </p>
                    </div>
                    {n.leido === 0 && (
                      <div className="shrink-0 self-center">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full shadow-sm shadow-emerald-500/40" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center space-y-4">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300">
                  <Inbox size={32} />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Bandeja Vacía</p>
                  <p className="text-[11px] text-slate-400 font-medium leading-tight">No tienes notificaciones pendientes en este momento.</p>
                </div>
              </div>
            )}
          </div>

          {/* Pie */}
          <div className="px-5 py-3 border-t border-slate-50 text-center">
            <button
              type="button"
              onClick={() => { setIsOpen(false); setIsHistoryOpen(true); }}
              className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-emerald-600 transition-colors"
            >
              Ver Historial Completo
            </button>
          </div>
        </div>
      )}

      {/* ── Modal de historial completo ── */}
      {/* Los callbacks sincronizan el badge de la campana sin re-fetch */}
      <NotificationHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        onMarkAsRead={markAsRead}
        onMarkAllAsRead={markAllAsRead}
      />
    </div>
  );
};

export default NotificationCenter;
