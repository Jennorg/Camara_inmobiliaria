import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  X,
  Info,
  AlertTriangle,
  AlertCircle,
  Inbox,
  CheckCheck,
  MailOpen,
  Clock,
  Filter,
} from 'lucide-react';
import { Notification } from '@/hooks/useNotifications';
import { API_URL } from '@/config/env';
import { useAuth } from '@/context/AuthContext';
import { formatDistanceToNow, format } from 'date-fns';
import { es } from 'date-fns/locale';

// ─── Sub-componentes ────────────────────────────────────────────────────────

const PriorityIcon = ({ priority }: { priority: string }) => {
  switch (priority) {
    case 'URGENTE': return <AlertCircle size={15} className="text-rose-500 shrink-0" />;
    case 'ALTA':    return <AlertTriangle size={15} className="text-amber-500 shrink-0" />;
    default:        return <Info size={15} className="text-emerald-500 shrink-0" />;
  }
};

const PriorityBadge = ({ priority }: { priority: string }) => {
  const map: Record<string, string> = {
    URGENTE: 'bg-rose-50 text-rose-600 border-rose-100',
    ALTA:    'bg-amber-50 text-amber-600 border-amber-100',
    NORMAL:  'bg-emerald-50 text-emerald-600 border-emerald-100',
    BAJA:    'bg-slate-50 text-slate-500 border-slate-100',
  };
  return (
    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${map[priority] ?? map.NORMAL}`}>
      {priority}
    </span>
  );
};

// ─── Tipos ──────────────────────────────────────────────────────────────────

type FilterType = 'TODAS' | 'NO_LEIDAS' | 'LEIDAS';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Para actualizar el badge del centro de notificaciones al marcar como leída */
  onMarkAsRead?: (id: number) => void;
  onMarkAllAsRead?: () => void;
}

// ─── Componente principal ────────────────────────────────────────────────────

const PAGE_SIZE = 15;

export const NotificationHistoryModal = ({ isOpen, onClose, onMarkAsRead, onMarkAllAsRead }: Props) => {
  const { token }                         = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading]             = useState(false);
  const [loadingMore, setLoadingMore]     = useState(false);
  const [hasMore, setHasMore]             = useState(true);
  const [filter, setFilter]               = useState<FilterType>('TODAS');
  const [unreadCount, setUnreadCount]     = useState(0);
  const offsetRef                         = useRef(0);
  const listRef                           = useRef<HTMLDivElement>(null);

  // ── Fetch página ──────────────────────────────────────────────────────────
  const fetchPage = useCallback(async (offset: number, reset = false) => {
    if (!token) return;
    if (reset) setLoading(true); else setLoadingMore(true);
    try {
      const res  = await fetch(`${API_URL}/api/notifications?limit=${PAGE_SIZE}&offset=${offset}`, {
        credentials: 'include',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) return;
      const json = await res.json();
      if (json.success) {
        const incoming: Notification[] = json.data || [];
        setNotifications(prev => reset ? incoming : [...prev, ...incoming]);
        setUnreadCount(json.unreadCount ?? 0);
        setHasMore(incoming.length === PAGE_SIZE);
        offsetRef.current = offset + incoming.length;
      }
    } catch (e) {
      console.error('[NotificationHistoryModal] Error al cargar:', e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [token]);

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (prevIsOpen !== isOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setFilter('TODAS');
    }
  }

  // ── Carga inicial cuando se abre ─────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    offsetRef.current = 0;
    fetchPage(0, true);
  }, [isOpen, fetchPage]);

  // ── Bloquear scroll del body ──────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // ── Marcar como leída (local + callback) ─────────────────────────────────
  const markingReadSetRef = useRef(new Set<number>());
  const handleMarkAsRead = async (id: number) => {
    if (!token || markingReadSetRef.current.has(id)) return;
    markingReadSetRef.current.add(id);
    try {
      const res = await fetch(`${API_URL}/api/notifications/${id}/read`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) return;
      const json = await res.json();
      if (json.success) {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, leido: 1 } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
        onMarkAsRead?.(id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      markingReadSetRef.current.delete(id);
    }
  };

  // ── Marcar todas como leídas ──────────────────────────────────────────────
  const markingAllRef = useRef(false);
  const handleMarkAllAsRead = async () => {
    if (!token || markingAllRef.current) return;
    markingAllRef.current = true;
    try {
      const res = await fetch(`${API_URL}/api/notifications/read-all`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) return;
      const json = await res.json();
      if (json.success) {
        setNotifications(prev => prev.map(n => ({ ...n, leido: 1 })));
        setUnreadCount(0);
        onMarkAllAsRead?.();
      }
    } catch (e) {
      console.error(e);
    } finally {
      markingAllRef.current = false;
    }
  };

  // ── Scroll infinito ───────────────────────────────────────────────────────
  const handleScroll = () => {
    const el = listRef.current;
    if (!el || loadingMore || !hasMore) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 80) {
      fetchPage(offsetRef.current);
    }
  };

  // ── Filtrado local (sin re-fetch) ────────────────────────────────────────
  const visible = notifications.filter(n => {
    if (filter === 'NO_LEIDAS') return n.leido === 0;
    if (filter === 'LEIDAS')    return n.leido === 1;
    return true;
  });

  if (!isOpen) return null;

  return (
    <>
      {/* ── Overlay ─────────────────────────────────────────────────────── */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* ── Modal ───────────────────────────────────────────────────────── */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Historial de notificaciones"
        className={[
          'fixed z-[61] bg-white shadow-2xl flex flex-col',
          'transition-opacity transition-transform duration-200',
          // Móvil: full-screen sheet
          'inset-x-0 bottom-0 top-[5%] rounded-t-3xl',
          // sm+: modal centrado
          'sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2',
          'sm:w-[600px] sm:max-h-[85vh] sm:rounded-2xl',
        ].join(' ')}
      >
        {/* ── Cabecera ────────────────────────────────────────────────── */}
        <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-slate-100 flex items-start gap-4 shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-black text-slate-900 tracking-tight">Historial de Notificaciones</h2>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">
              {unreadCount > 0
                ? <><span className="text-emerald-600 font-black">{unreadCount}</span> sin leer · Intranet Cámara</>
                : 'Todas al día · Intranet Cámara'}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                className="hidden sm:flex items-center gap-1.5 text-[10px] font-black text-emerald-600 uppercase tracking-widest hover:text-emerald-700 transition-colors px-2 py-1 rounded-lg hover:bg-emerald-50"
              >
                <CheckCheck size={13} />
                Marcar todas
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar historial"
              className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Filtros ─────────────────────────────────────────────────── */}
        <div className="px-5 sm:px-6 py-3 flex items-center gap-2 border-b border-slate-50 shrink-0 overflow-x-auto scrollbar-hide">
          <Filter size={13} className="text-slate-400 shrink-0" />
          {(['TODAS', 'NO_LEIDAS', 'LEIDAS'] as FilterType[]).map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={[
                'text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full whitespace-nowrap transition-colors',
                filter === f
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'text-slate-500 hover:bg-slate-100',
              ].join(' ')}
            >
              {f === 'TODAS' ? 'Todas' : f === 'NO_LEIDAS' ? 'Sin leer' : 'Leídas'}
            </button>
          ))}

          {/* Marcar todas – solo móvil */}
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllAsRead}
              className="sm:hidden ml-auto flex items-center gap-1.5 text-[10px] font-black text-emerald-600 uppercase tracking-widest whitespace-nowrap"
            >
              <CheckCheck size={12} />
              Marcar todas
            </button>
          )}
        </div>

        {/* ── Lista ───────────────────────────────────────────────────── */}
        <div
          ref={listRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto custom-scrollbar overscroll-contain"
        >
          {loading ? (
            <div className="p-12 text-center space-y-4">
              <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mx-auto" />
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Cargando historial...</p>
            </div>
          ) : visible.length === 0 ? (
            <div className="p-14 text-center space-y-4">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300">
                <Inbox size={32} />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Sin resultados</p>
                <p className="text-[11px] text-slate-400 font-medium">No hay notificaciones para este filtro.</p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {visible.map((n) => (
                <div
                  key={n.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => n.leido === 0 && handleMarkAsRead(n.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      if (n.leido === 0) handleMarkAsRead(n.id)
                    }
                  }}
                  className={[
                    'group px-5 sm:px-6 py-4 flex gap-3 sm:gap-4 transition-colors focus:outline-none focus-visible:bg-slate-50',
                    n.leido === 0
                      ? 'bg-emerald-50/30 hover:bg-emerald-50/60 cursor-pointer'
                      : 'hover:bg-slate-50/70 cursor-default',
                  ].join(' ')}
                >
                  {/* Icono prioridad */}
                  <div className="shrink-0 mt-0.5 pt-0.5">
                    <PriorityIcon priority={n.prioridad} />
                  </div>

                  {/* Contenido */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-start gap-2 flex-wrap">
                      <p className={`text-xs font-bold flex-1 min-w-0 leading-snug ${n.leido === 0 ? 'text-slate-900' : 'text-slate-500'}`}>
                        {n.titulo}
                      </p>
                      <PriorityBadge priority={n.prioridad} />
                    </div>
                    <p className={`text-[11px] leading-relaxed line-clamp-3 ${n.leido === 0 ? 'text-slate-600 font-medium' : 'text-slate-400'}`}>
                      {n.mensaje}
                    </p>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                        <Clock size={10} />
                        {formatDistanceToNow(new Date(n.creado_en), { addSuffix: true, locale: es })}
                      </span>
                      <span className="text-[10px] text-slate-300 font-medium">
                        {format(new Date(n.creado_en), "d MMM yyyy 'a las' HH:mm", { locale: es })}
                      </span>
                      {n.tipo !== 'SISTEMA' && (
                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{n.tipo}</span>
                      )}
                    </div>
                  </div>

                  {/* Estado leído */}
                  <div className="shrink-0 self-start pt-1">
                    {n.leido === 0 ? (
                      <div className="w-2 h-2 bg-emerald-500 rounded-full shadow-sm shadow-emerald-500/40" />
                    ) : (
                      <MailOpen size={13} className="text-slate-300" />
                    )}
                  </div>
                </div>
              ))}

              {/* Cargar más */}
              {loadingMore && (
                <div className="py-6 flex justify-center">
                  <div className="w-6 h-6 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                </div>
              )}
              {!hasMore && visible.length > 0 && (
                <div className="py-6 text-center">
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Fin del historial</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default NotificationHistoryModal;
