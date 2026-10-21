import { useEffect, useState } from 'react'
import { AlertTriangle, Lock } from 'lucide-react'
import { API_URL } from '@/config/env'
import { useAuth } from '@/context/AuthContext'

interface Deuda {
  meses_deuda: number
  deuda_usd: number
  bloqueado: boolean
  meses_gracia: number
}

/** Aviso fijo en el panel del afiliado cuando tiene mensualidades vencidas (o documentos bloqueados). */
export default function BannerMora({ idAfiliado, onIrAPagar }: { idAfiliado: number; onIrAPagar: () => void }) {
  const { authHeaders } = useAuth()
  const [deuda, setDeuda] = useState<Deuda | null>(null)

  useEffect(() => {
    const ctrl = new AbortController()
    fetch(`${API_URL}/api/pagos/solvencia/afiliado/${idAfiliado}`, { headers: authHeaders, signal: ctrl.signal })
      .then(r => r.json())
      .then(j => { if (j.success) setDeuda(j.data) })
      .catch(() => {})
    return () => ctrl.abort()
  }, [idAfiliado, authHeaders])

  if (!deuda || (deuda.meses_deuda === 0 && !deuda.bloqueado)) return null

  const Icono = deuda.bloqueado ? Lock : AlertTriangle
  return (
    <div role="status" className={`flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-2xl border ${deuda.bloqueado ? 'bg-red-50 border-red-200 text-red-900' : 'bg-amber-50 border-amber-200 text-amber-900'}`}>
      <Icono className={`w-5 h-5 shrink-0 ${deuda.bloqueado ? 'text-red-600' : 'text-amber-600'}`} aria-hidden="true" />
      <div className="flex-1 text-sm">
        {deuda.meses_deuda > 0 ? (
          <p className="font-bold">
            Tienes {deuda.meses_deuda} {deuda.meses_deuda === 1 ? 'mensualidad pendiente' : 'mensualidades pendientes'} por <span className="tabular-nums">${deuda.deuda_usd.toFixed(2)}</span>.
          </p>
        ) : (
          <p className="font-bold">Tu pago está en revisión.</p>
        )}
        <p className="text-xs font-medium opacity-80">
          {deuda.bloqueado
            ? 'Tu carnet, constancia de solvencia y certificados están bloqueados hasta que Finanzas verifique el pago.'
            : `Con más de ${deuda.meses_gracia} ${deuda.meses_gracia === 1 ? 'mes' : 'meses'} de deuda se bloquean tu carnet, constancia y certificados.`}
        </p>
      </div>
      {deuda.meses_deuda > 0 && (
        <button type="button" onClick={onIrAPagar}
          className={`shrink-0 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-colors ${deuda.bloqueado ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'}`}>
          Reportar pago
        </button>
      )}
    </div>
  )
}
