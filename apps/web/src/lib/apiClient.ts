export async function apiFetch<T = any>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options)
  
  let data: any = null
  try {
    const text = await res.text()
    if (text && text.trim().length > 0) {
      try {
        data = JSON.parse(text)
      } catch {
        data = { message: text }
      }
    }
  } catch {
    data = null
  }

  if (!res.ok) {
    const msg = data?.message || `Error HTTP (${res.status})`
    throw new Error(msg)
  }

  return (data ?? { success: true }) as T
}
