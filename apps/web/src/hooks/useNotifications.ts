import { useState, useEffect, useCallback } from 'react';
import { API_URL } from '@/config/env';
import { useAuth } from '@/context/AuthContext';

export interface Notification {
  id: number;
  id_user: number;
  tipo: string;
  prioridad: 'BAJA' | 'NORMAL' | 'ALTA' | 'URGENTE';
  titulo: string;
  mensaje: string;
  data_json: string;
  leido: number;
  creado_en: string;
}

export function useNotifications() {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/notifications`, {
        credentials: 'include',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) return;
      const json = await res.json();
      if (json.success) {
        setNotifications(json.data || []);
        setUnreadCount(json.unreadCount ?? (json.data ? json.data.filter((n: Notification) => n.leido === 0).length : 0));
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const markAsRead = async (id: number) => {
    if (!token) return;
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
        setNotifications(prev =>
          prev.map(n => (n.id === id ? { ...n, leido: 1 } : n))
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!token) return;
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
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Polling cada 2 minutos
    const interval = setInterval(fetchNotifications, 120000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  return {
    notifications,
    loading,
    unreadCount,
    markAsRead,
    markAllAsRead,
    refresh: fetchNotifications,
  };
}
