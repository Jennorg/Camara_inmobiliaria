import { useState } from 'react'
import { FileCheck2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { API_URL } from '@/config/env'
import { useAuth } from '@/context/AuthContext'

/** Emite (o reabre la del mes) la constancia de solvencia y la abre en una pestaña nueva. */
export default function BotonConstanciaSolvencia({ idAfiliado }: { idAfiliado: number }) {
  const { authHeaders } = useAuth()
  const [cargando, setCargando] = useState(false)

  const emitir = async () => {
    // Abrir la pestaña dentro del clic evita el bloqueador de ventanas emergentes
    const pestana = window.open('', '_blank')
    setCargando(true)
    try {
      const res = await fetch(`${API_URL}/api/pagos/constancia-solvencia`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ id_afiliado: idAfiliado }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'No se pudo emitir la constancia')
      const url = `/constancia-solvencia/${encodeURIComponent(json.data.codigo_validacion)}`
      if (pestana) pestana.location.href = url
      else window.location.href = url
    } catch (err) {
      pestana?.close()
      toast.error(err instanceof Error ? err.message : 'No se pudo emitir la constancia')
    } finally {
      setCargando(false)
    }
  }

  return (
    <button type="button" onClick={emitir} disabled={cargando}
      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-black uppercase tracking-wider disabled:opacity-60 transition-colors">
      {cargando ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <FileCheck2 size={14} aria-hidden="true" />}
      Constancia de solvencia
    </button>
  )
}
