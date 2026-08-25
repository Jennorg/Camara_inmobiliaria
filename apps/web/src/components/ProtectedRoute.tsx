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
    return <Navigate to="/" replace />
  }

  // Si hay roles requeridos, verificar que el usuario tenga al menos uno
  if (requiredRoles && requiredRoles.length > 0) {
    let effectiveRoles: UserRole[] = [...requiredRoles]
    if (requiredRoles.includes('admin') && !effectiveRoles.includes('super_admin')) {
      effectiveRoles.push('super_admin')
    }
    const staffRoles: UserRole[] = ['asistente', 'administrativo', 'secretario', 'secretaria', 'personal', 'personal_admin', 'personal_administrativo']
    if (requiredRoles.some(r => staffRoles.includes(r))) {
      for (const r of staffRoles) {
        if (!effectiveRoles.includes(r)) effectiveRoles.push(r)
      }
      if (!effectiveRoles.includes('admin')) effectiveRoles.push('admin')
      if (!effectiveRoles.includes('super_admin')) effectiveRoles.push('super_admin')
    }

    const hasAccess = effectiveRoles.some(r => hasRole(r))
    if (!hasAccess) {
      return <Navigate to="/panel" replace />
    }
  }

  return children ? <>{children}</> : <Outlet />
}
