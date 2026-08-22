import React from 'react'
import { useAuth } from '@/context/AuthContext'
import { LogOut, ShieldAlert } from 'lucide-react'

export default function ImpersonationBanner() {
  const { isImpersonating, user, originalAdmin, stopImpersonation } = useAuth()

  if (!isImpersonating || !user) return null

  return (
    <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-white px-4 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-2 shadow-md z-[9999] text-xs font-semibold tracking-wide border-b border-amber-400 sticky top-0">
      <div className="flex items-center gap-2 text-center sm:text-left">
        <ShieldAlert size={16} className="shrink-0 text-amber-200 animate-pulse" />
        <span>
          Modo Soporte: Navegando la cuenta de{' '}
          <strong className="underline decoration-amber-300 uppercase">{user.nombre_completo || user.email}</strong>
          {originalAdmin && (
            <span className="opacity-90 font-normal ml-1">
              (Sesión Admin: {originalAdmin.nombre_completo || originalAdmin.email})
            </span>
          )}
        </span>
      </div>
      <button
        type="button"
        onClick={stopImpersonation}
        className="inline-flex items-center gap-1.5 px-3 py-1 bg-white text-amber-900 rounded-lg hover:bg-amber-50 active:scale-95 transition shadow-sm font-bold shrink-0 cursor-pointer"
        title="Volver a la cuenta de Administrador"
      >
        <LogOut size={13} />
        <span>Volver a mi cuenta Admin</span>
      </button>
    </div>
  )
}
