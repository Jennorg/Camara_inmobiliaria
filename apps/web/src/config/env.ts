/** Base de la API sin barras finales (evita `//api/...` y redirects 308 sin CORS). */
export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000')
  .trim()
  .replace(/\/+$/, '')

/**
 * Une la base de la API con un path (`/api/...`).
 * Usar siempre esto en lugar de `` `${API_URL}/api/...` ``.
 */
export function apiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${API_URL}${normalized}`
}
