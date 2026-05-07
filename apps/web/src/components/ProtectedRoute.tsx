import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth, type UserRole } from '@/context/AuthContext'

interface ProtectedRouteProps {
  /** Si se especifica, el usuario debe tener al menos uno de estos roles */
  requiredRoles?: UserRole[]
  children?: React.ReactNode
}

/**
 * Protege rutas según el estado de autenticación y los roles requeridos.
 * - Si está cargando: muestra spinner.
 * - Si no hay usuario autenticado: redirige a `/`.
 * - Si los roles no coinciden: redirige a `/panel` (vista unificada).
 * - Si todo OK: renderiza los hijos o <Outlet />.
 */
export default function ProtectedRoute({ requiredRoles, children }: ProtectedRouteProps) {
  const { user, isLoading, hasRole } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
          <span className="text-sm text-slate-400 font-medium">Verificando sesión...</span>
        </div>
      </div>
    )
  }

  if (!user) {
    const hostname = window.location.hostname;
    const isApp = hostname.startsWith('app.') || hostname.includes('.app.');
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.includes('192.168.');

    if (isApp && !isLocal) {
      const baseDomain = hostname.replace('app.', '');
      const protocol = window.location.protocol;
      const port = window.location.port ? `:${window.location.port}` : '';
      window.location.href = `${protocol}//${baseDomain}${port}/`;
      return null;
    }
    return <Navigate to="/" replace />
  }

  // Si hay roles requeridos, verificar que el usuario tenga al menos uno
  if (requiredRoles && requiredRoles.length > 0) {
    // super_admin tiene acceso a todo lo que requiera admin
    const effectiveRoles: UserRole[] = requiredRoles.includes('admin')
      ? [...requiredRoles, 'super_admin']
      : requiredRoles

    const hasAccess = effectiveRoles.some(r => hasRole(r))
    if (!hasAccess) {
      return <Navigate to="/panel" replace />
    }
  }

  return children ? <>{children}</> : <Outlet />
}
