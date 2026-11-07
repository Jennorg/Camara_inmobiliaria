import { useEffect, useState } from 'react'
import { API_URL } from '@/config/env'
import { apiFetch } from '@/lib/apiClient'

export interface SeccionMarcoLegal {
  nombre: string
  slug: string
  total: number
}

// Una sola petición por carga de página (navbar + página la comparten). Si falla, se reintenta en el próximo montaje.
let cache: Promise<SeccionMarcoLegal[]> | null = null
const cargar = () => {
  cache ??= apiFetch(`${API_URL}/api/public/normativas/secciones`)
    .then(j => (j?.success && Array.isArray(j.data) ? (j.data as SeccionMarcoLegal[]) : []))
    .catch(e => {
      cache = null
      throw e
    })
  return cache
}

/** Secciones públicas del Marco Legal con documentos. `secciones` es null mientras carga; `error` si falló. */
export function useSeccionesMarcoLegal() {
  const [estado, setEstado] = useState<{ secciones: SeccionMarcoLegal[] | null; error: boolean }>({ secciones: null, error: false })
  useEffect(() => {
    let activo = true
    cargar().then(
      secciones => activo && setEstado({ secciones, error: false }),
      () => activo && setEstado({ secciones: [], error: true }),
    )
    return () => {
      activo = false
    }
  }, [])
  return estado
}
