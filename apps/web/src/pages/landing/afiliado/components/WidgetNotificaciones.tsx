import React from 'react';
import { Bell, AlertTriangle, Info, AlertCircle } from 'lucide-react';
import DashboardCard from '@/pages/landing/afiliado/components/DashboardCard';
import { SkeletonNotification } from '@/components/Skeleton';
import { useNotifications } from '@/hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

const WidgetNotificaciones = () => {
  const { notifications, loading, markAllAsRead } = useNotifications();

  const getIcon = (prioridad: string) => {
    switch (prioridad) {
      case 'URGENTE': return AlertCircle;
      case 'ALTA': return AlertTriangle;
      default: return Bell;
    }
  };

  const getColor = (prioridad: string) => {
    switch (prioridad) {
      case 'URGENTE': return 'var(--color-danger)';
      case 'ALTA': return '#f59e0b';
      default: return 'var(--color-accent)';
    }
  };

  return (
    <DashboardCard 
      title="Alertas y Avisos" 
      icon={Bell} 
      actionText={notifications.some(n => n.leido === 0) ? "Marcar leídas" : undefined} 
      onAction={markAllAsRead}
    >
      <div className="space-y-3">
        {loading && notifications.length === 0 ? (
          <>
            <SkeletonNotification />
            <SkeletonNotification />
            <SkeletonNotification />
          </>
        ) : notifications.length > 0 ? (
          <>
            {notifications.slice(0, 3).map((notif) => {
              const Icon = getIcon(notif.prioridad);
              return (
                <div
                  key={notif.id}
                  className={`flex gap-3 p-3.5 rounded-xl transition-colors cursor-pointer group ${notif.leido === 0 ? 'bg-emerald-50/10' : ''}`}
                  style={{ backgroundColor: 'var(--color-bg-subtle)', border: '1px solid var(--color-border)' }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-border-accent)';
                    (e.currentTarget as HTMLDivElement).style.backgroundColor = 'var(--color-accent-subtle)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-border)';
                    (e.currentTarget as HTMLDivElement).style.backgroundColor = notif.leido === 0 ? 'var(--color-accent-muted)' : 'var(--color-bg-subtle)';
                  }}
                >
                  <div
                    className="mt-0.5 w-1 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: getColor(notif.prioridad) }}
                  />
                  <div className="flex-grow min-w-0">
                    <h4 className="font-extrabold text-sm leading-tight truncate" style={{ color: 'var(--color-text-base)' }}>
                      {notif.titulo}
                    </h4>
                    <p className="text-xs mt-1 leading-relaxed line-clamp-2" style={{ color: 'var(--color-text-muted)' }}>
                      {notif.mensaje}
                    </p>
                    <span className="text-[9px] font-bold uppercase mt-2 block tracking-wider" style={{ color: 'var(--color-text-faint)' }}>
                      {formatDistanceToNow(new Date(notif.creado_en), { addSuffix: true, locale: es })}
                    </span>
                  </div>
                </div>
              );
            })}

            <button
              className="w-full text-center py-2 text-xs font-bold uppercase tracking-widest mt-2 transition-colors"
              style={{ color: 'var(--color-text-faint)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-accent-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-faint)')}
            >
              Ver historial completo
            </button>
          </>
        ) : (
          <div className="py-10 text-center opacity-40">
            <Bell size={32} className="mx-auto mb-2" />
            <p className="text-xs font-bold uppercase tracking-widest">Sin notificaciones</p>
          </div>
        )}
      </div>
    </DashboardCard>
  );
};

export default WidgetNotificaciones;
