export async function apiFetch<T = any>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options)
  if (!res.ok) {
    let msg = `Request failed with status ${res.status}`
    try {
      const body = await res.json()
      if (body && body.message) msg = body.message
    } catch {}
    throw new Error(msg)
  }
  return res.json()
}
