import { useEffect, useState } from 'react'
import { History } from 'lucide-react'
import { API_URL } from '@/config/env'
import { useAuth } from '@/context/AuthContext'

const ACCION: Record<string, string> = { crear: 'Creado', editar: 'Editado', eliminar: 'Eliminado', eliminar_definitivo: 'Eliminado', restaurar: 'Restaurado', aprobar: 'Aprobado', rechazar: 'Rechazado', verificar: 'Verificado', cambiar_etapa: 'Cambio de etapa' }
const fecha = (iso: string) => { const d = new Date(iso); const p = (n: number) => String(n).padStart(2, '0'); return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)} ${p(d.getHours())}:${p(d.getMinutes())}` }

/** «Editado por Ana Contreras el 08/11/26 18:30»: lo último que se hizo sobre un registro, según la auditoría. Por ahora solo lo ve el súper administrador. */
const UltimaModificacion = ({ entidad, id, className = '' }: { entidad: string; id: number | string | null | undefined; className?: string }) => {
  const { authHeaders, isSuperAdmin } = useAuth()
  const [dato, setDato] = useState<{ accion: string; usuario: string; fecha: string } | null>(null)
  useEffect(() => {
    setDato(null)
    if (!isSuperAdmin || id === null || id === undefined || id === '') return // por ahora, solo el súper administrador
    let activo = true
    fetch(`${API_URL}/api/auditoria/ultimo?entidad=${encodeURIComponent(entidad)}&ids=${id}`, { headers: authHeaders })
      .then(r => r.json()).then(r => { if (activo && r.success && r.data?.[String(id)]) setDato(r.data[String(id)]) }).catch(() => { })
    return () => { activo = false }
  }, [entidad, id, authHeaders, isSuperAdmin])
  if (!dato) return null
  return <p className={`flex items-center gap-1.5 text-xs text-slate-600 ${className}`}><History size={12} aria-hidden="true" />{ACCION[dato.accion] ?? dato.accion} por <strong className="font-semibold text-slate-800">{dato.usuario}</strong> el {fecha(dato.fecha)}</p>
}

export default UltimaModificacion
