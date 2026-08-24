/**
 * useCachedConfig.ts
 *
 * Tier 2: Semi-Dynamic Config Hook.
 *
 * Fetches CMS configuration keys from the API once and caches them in
 * localStorage for 24 hours. On subsequent loads, the cached values are
 * served instantly while a background refresh occurs silently.
 *
 * This prevents the API round-trip from blocking the initial page render.
 */
import { useState, useEffect, useCallback } from 'react'
import { API_URL } from '@/config/env'

const CACHE_KEY = 'ciebo_cms_config:v1'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

interface CacheEntry {
  timestamp: number
  config: Record<string, string>
}

function readCache(): Record<string, string> | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const entry: CacheEntry = JSON.parse(raw)
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) return null
    return entry.config
  } catch {
    return null
  }
}

function writeCache(config: Record<string, string>) {
  try {
    const entry: CacheEntry = { timestamp: Date.now(), config }
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry))
  } catch {
    // Silently fail if localStorage is unavailable
  }
}

async function fetchConfig(signal?: AbortSignal): Promise<Record<string, string>> {
  const response = await fetch(`${API_URL}/api/cms/config`, { signal })
  if (!response.ok) throw new Error('Config fetch failed')
  const data = await response.json()
  if (!data.success) throw new Error('Config fetch failed')
  return data.config as Record<string, string>
}

/**
 * Returns the cached (or freshly fetched) CMS config.
 * The hook serves stale data instantly and refreshes in the background.
 */
export function useCachedConfig(): Record<string, string> {
  const [config, setConfig] = useState<Record<string, string>>(() => readCache() ?? {})

  const syncConfig = useCallback(async (signal: AbortSignal) => {
    try {
      const fresh = await fetchConfig(signal)
      if (!signal.aborted) {
        writeCache(fresh)
        setConfig(fresh)
      }
    } catch {
      /* keep stale cache or defaults on error */
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const cached = readCache()
    if (cached) {
      setConfig(cached)
    }

    syncConfig(controller.signal)

    return () => {
      controller.abort()
    }
  }, [syncConfig])

  return config
}
