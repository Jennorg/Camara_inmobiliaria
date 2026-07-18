/**
 * useExpedienteProgress
 *
 * Persiste el progreso del formulario de carga de expediente en localStorage.
 * La clave se construye con los primeros 12 caracteres del token verificado
 * para que cada usuario tenga su propio espacio de almacenamiento.
 *
 * NOTA: No se guardan archivos (Blob/File) porque el componente FileUpload
 * los sube a Supabase Storage en el momento de la selección y devuelve
 * una URL pública permanente. Lo que persiste son esas URLs y los metadatos.
 */

const STORAGE_PREFIX = 'expediente_progress_'
const STORAGE_VERSION = 1

export interface ExpedienteProgressData {
  _version: number
  _savedAt: string
  nivelProfesional: string
  profesion: string
  optarAcreditacion?: boolean
  ano_inicio_servicio: string
  url_cv: string
  name_cv?: string
  url_titulo: string
  name_titulo?: string
  url_registro_mercantil: string
  name_registro_mercantil?: string
  url_titulo_representante: string
  name_titulo_representante?: string
  especializaciones: { nombre: string; url: string; fecha: string }[]
  cursos_extras: { nombre: string; url: string; fecha: string }[]
  diplomados: { nombre: string; url: string; fecha: string }[]
  otros_docs: { nombre: string; url: string; fecha: string }[]
  url_referencia1: string
  nombre_referencia1: string
  url_referencia2: string
  nombre_referencia2: string
}

function buildKey(token: string): string {
  // Usamos los primeros 12 caracteres del token como identificador único
  const shortId = token.slice(0, 12).replace(/[^a-zA-Z0-9_-]/g, '_')
  return `${STORAGE_PREFIX}${shortId}`
}

export function useExpedienteProgress(token: string) {
  const storageKey = token ? buildKey(token) : null

  /**
   * Guarda el progreso actual del formulario en localStorage.
   */
  function saveProgress(
    formData: Omit<ExpedienteProgressData, '_version' | '_savedAt'>
  ): void {
    if (!storageKey) return
    try {
      const payload: ExpedienteProgressData = {
        _version: STORAGE_VERSION,
        _savedAt: new Date().toISOString(),
        ...formData,
      }
      localStorage.setItem(storageKey, JSON.stringify(payload))
    } catch {
      // ignore storage errors
    }
  }

  /**
   * Carga el progreso guardado. Devuelve null si no hay datos o son inválidos.
   */
  function loadProgress(): ExpedienteProgressData | null {
    if (!storageKey) return null
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return null
      const parsed = JSON.parse(raw) as ExpedienteProgressData
      if (parsed._version !== STORAGE_VERSION) {
        // clean outdated version
        localStorage.removeItem(storageKey)
        return null
      }
      return parsed
    } catch {
      return null
    }
  }

  /**
   * Elimina el progreso guardado. Llamar al confirmar el envío exitoso.
   */
  function clearProgress(): void {
    if (!storageKey) return
    try {
      localStorage.removeItem(storageKey)
    } catch {
      //
    }
  }

  /**
   * Devuelve si existe progreso guardado (sin cargarlo completamente).
   */
  function hasProgress(): boolean {
    if (!storageKey) return false
    try {
      return localStorage.getItem(storageKey) !== null
    } catch {
      return false
    }
  }

  return { saveProgress, loadProgress, clearProgress, hasProgress }
}
