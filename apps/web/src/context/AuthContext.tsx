import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_URL } from '@/config/env'

// ── Interceptor de Fetch Global (Manejo de Access + Refresh Tokens) ────────────

let activeAccessToken: string | null = null;
let isRefreshing = false;
let refreshSubscribers: ((token: string | null) => void)[] = [];

function subscribeTokenRefresh(cb: (token: string | null) => void) {
  refreshSubscribers.push(cb);
}

function onRefreshed(token: string | null) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

async function safeParseResponse(res: Response): Promise<any> {
  try {
    const text = await res.text()
    if (!text || text.trim().length === 0) return null
    return JSON.parse(text)
  } catch {
    return null
  }
}

const originalFetch = window.fetch;

window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = typeof input === 'string' ? input : (input instanceof URL ? input.href : input.url);
  
  // Solo interceptar peticiones a nuestra API
  const isApiCall = url.startsWith(API_URL) || url.startsWith('/api');
  
  let headers = new Headers(init?.headers);
  if (isApiCall && activeAccessToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${activeAccessToken}`);
  }
  
  let newInit: RequestInit = { ...init, headers };
  if (isApiCall) {
    newInit.credentials = 'include'; // Permitir envío de cookies HttpOnly
  }
  
  let response = await originalFetch(input, newInit);
  
  const isAuthEndpoint = url.includes('/api/auth/login') || url.includes('/api/auth/refresh') || url.includes('/api/auth/logout');
  if (isApiCall && response.status === 401 && !isAuthEndpoint) {
    if (!isRefreshing) {
      isRefreshing = true;
      const oldToken = activeAccessToken; // Guardar para saber si teníamos sesión
      try {
        const refreshRes = await originalFetch(`${API_URL}/api/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });
        const refreshData = await safeParseResponse(refreshRes);
        
        if (refreshRes.ok && refreshData?.success && refreshData?.token) {
          activeAccessToken = refreshData.token;
          isRefreshing = false;
          onRefreshed(refreshData.token);
          
          window.dispatchEvent(new CustomEvent('ciebo_auth_refresh', { 
            detail: { token: refreshData.token, user: refreshData.user } 
          }));
        } else {
          isRefreshing = false;
          activeAccessToken = null;
          onRefreshed(null); // Desbloquear colas aunque falle
          // Solo disparar evento de expiración si teníamos un token previo
          if (oldToken) {
            window.dispatchEvent(new CustomEvent('ciebo_auth_expired'));
          }
          return response;
        }
      } catch (err) {
        isRefreshing = false;
        onRefreshed(null); // Desbloquear colas
        return response;
      }
    }
    
    // Encolar peticiones mientras se refresca el token
    return new Promise((resolveRequest) => {
      subscribeTokenRefresh((newToken) => {
        if (newToken) {
          headers.set('Authorization', `Bearer ${newToken}`);
          resolveRequest(originalFetch(input, { ...init, headers, credentials: 'include' }));
        } else {
          resolveRequest(response); // Resolver con el 401 original
        }
      });
    });
  }
  
  return response;
};

// ── Types ─────────────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'afiliado' | 'super_admin' | 'estudiante' | 'asistente' | 'administrativo' | 'secretario' | 'secretaria' | 'personal' | 'personal_admin' | 'personal_administrativo'

export interface AuthUser {
  id: number
  email: string
  rol: UserRole              // rol primario (más alto en jerarquía)
  roles: UserRole[]          // todos los roles del usuario
  
  // Relaciones con perfiles (poblado por enrichUser middleware)
  id_persona?: number
  id_empresa?: number
  id_afiliado?: number
  id_estudiante?: number
  
  // Datos de perfil
  nombre_completo?: string
  codigo?: string | null
  cedula?: string
  tipo_afiliado?: string
  telefono?: string
  nivel_profesional?: string
  es_corredor_inmobiliario?: boolean
  estatus?: string
}

interface AuthContextValue {
  user: AuthUser | null
  token: string | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  /** Helpers de conveniencia */
  hasRole: (role: UserRole) => boolean
  isAdmin: boolean
  isSuperAdmin: boolean
  isAsistente: boolean
  isAfiliado: boolean
  isEstudiante: boolean
  refreshUser: () => Promise<void>
  /** Impersonación */
  isImpersonating: boolean
  originalAdmin: { id: number; email: string; nombre_completo: string } | null
  impersonateUser: (userId: number) => Promise<void>
  stopImpersonation: () => void
}

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const TOKEN_KEY = 'ciebo_token'
const ORIGINAL_ADMIN_TOKEN_KEY = 'ciebo_original_admin_token'
const ORIGINAL_ADMIN_INFO_KEY = 'ciebo_original_admin_info'

/** Normalizar el usuario recibido del servidor, garantizando que siempre haya `roles[]` */
function normalizeUser(rawUser: any): AuthUser {
  const roles: UserRole[] = Array.isArray(rawUser.roles)
    ? rawUser.roles
    : [rawUser.rol ?? 'afiliado']

  const isStaffRoleName = (r: string) => {
    const norm = r.toLowerCase().trim().replace(/[\s_-]+/g, '_')
    return ['asistente', 'administrativo', 'secretaria', 'secretario', 'personal', 'personal_admin', 'personal_administrativo'].includes(norm)
  }

  const rol: UserRole = roles.includes('super_admin')
    ? 'super_admin'
    : roles.includes('admin')
      ? 'admin'
      : roles.some(isStaffRoleName)
        ? 'asistente'
        : roles.includes('estudiante')
          ? 'estudiante'
          : 'afiliado'

  return { 
    ...rawUser, 
    rol, 
    roles,
    es_corredor_inmobiliario: rawUser.es_corredor_inmobiliario === 1 || rawUser.es_corredor_inmobiliario === true
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────

async function requestRefreshSession(signal: AbortSignal) {
  const res = await fetch(`${API_URL}/api/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    signal,
  })
  if (!res.ok) return null
  return safeParseResponse(res)
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]         = useState<AuthUser | null>(null)
  const [token, setTokenState]  = useState<string | null>(null)
  const [isLoading, setLoading] = useState(true)
  const navigate                = useNavigate()

  // Sincronizar el token con el interceptor global
  const setToken = useCallback((t: string | null) => {
    activeAccessToken = t;
    setTokenState(t);
  }, []);

  // Listen to custom auth events from global fetch interceptor
  useEffect(() => {
    const handleRefresh = (e: Event) => {
      const { token: newToken, user: newUser } = (e as CustomEvent).detail
      setToken(newToken)
      setUser(normalizeUser(newUser))
    };
    
    const handleExpired = () => {
      localStorage.removeItem(TOKEN_KEY)
      const hadUser = !!activeAccessToken || !!localStorage.getItem(TOKEN_KEY)
      setToken(null)
      setUser(null)
      // Solo redirigir si realmente había una sesión activa que falló
      if (hadUser) {
        navigate('/')
      }
    };
    
    window.addEventListener('ciebo_auth_refresh', handleRefresh)
    window.addEventListener('ciebo_auth_expired', handleExpired)
    
    return () => {
      window.removeEventListener('ciebo_auth_refresh', handleRefresh)
      window.removeEventListener('ciebo_auth_expired', handleExpired)
    };
  }, [navigate, setToken])

  const restoreSession = useCallback(async (signal: AbortSignal, failsafe: NodeJS.Timeout) => {
    try {
      const data = await requestRefreshSession(signal)
      if (!signal.aborted && data && data.success && data.token && data.user) {
        setToken(data.token)
        setUser(normalizeUser(data.user))
      }
    } catch {
      /* ignore */
    } finally {
      if (!signal.aborted) {
        setLoading(false)
        clearTimeout(failsafe)
      }
    }
  }, [setToken])

  // Restore session on mount
  useEffect(() => {
    const controller = new AbortController()
    // Failsafe timeout: si en 10 segundos no ha cargado, forzar setLoading(false)
    const failsafe = setTimeout(() => {
      setLoading(false);
    }, 10000);

    // 1. Verificar si viene un token por URL (para saltos de subdominio)
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');
    
    if (urlToken) {
      setToken(urlToken);
      // Limpiar el token de la URL para seguridad y estética
      window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
    }

    restoreSession(controller.signal, failsafe)

    return () => {
      controller.abort()
      clearTimeout(failsafe)
    }
  }, [setToken, restoreSession])

  // Login function
  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password }),
    })

    const data = await safeParseResponse(res)
    if (!res.ok || !data?.success) {
      throw new Error(data?.message || `Error HTTP ${res.status}: Credenciales incorrectas`)
    }

    const newUser = normalizeUser(data.user)

    setToken(data.token)
    setUser(newUser)
    
    // Remover token legacy si iniciamos sesión con cookie
    localStorage.removeItem(TOKEN_KEY)

    // Selector general si tiene múltiples roles al panel unificado
    if (newUser.roles.length > 1) {
      navigate('/panel')
      return
    }

    // Redirección directa si solo tiene 1 rol
    if (newUser.rol === 'admin') {
      navigate('/admin')
      return
    }

    if (newUser.rol === 'estudiante') {
      navigate('/panel?tab=formacion')
      return
    }

    navigate('/panel')
  }, [navigate, setToken])

  const [originalAdmin, setOriginalAdmin] = useState<{ id: number; email: string; nombre_completo: string } | null>(() => {
    try {
      const raw = localStorage.getItem(ORIGINAL_ADMIN_INFO_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })

  const impersonateUser = useCallback(async (targetUserId: number) => {
    if (!token) return
    const res = await fetch(`${API_URL}/api/users/${targetUserId}/impersonate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    })
    const data = await safeParseResponse(res)
    if (!res.ok || !data?.success) {
      throw new Error(data?.message || `Error HTTP ${res.status} al ingresar como usuario`)
    }

    setToken(data.data.token)
    setUser(normalizeUser(data.data.user))
    setOriginalAdmin(data.data.originalAdmin)

    navigate('/panel')
  }, [token, navigate, setToken])

  const stopImpersonation = useCallback(async () => {
    setOriginalAdmin(null)

    fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include'
    })
      .then(r => {
        if (!r.ok) return null
        return safeParseResponse(r)
      })
      .then(data => {
        if (data && data.success && data.token && data.user) {
          setToken(data.token)
          setUser(normalizeUser(data.user))
        }
      })
      .catch(() => {})

    navigate('/panel')
  }, [navigate, setToken])

  // Logout function
  const logout = useCallback(() => {
    fetch(`${API_URL}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include'
    }).catch(err => console.error('Error logging out on backend:', err))

    setOriginalAdmin(null)
    setToken(null)
    setUser(null)

    navigate('/')
  }, [navigate, setToken])

  const refreshUser = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      const data = await safeParseResponse(res)
      if (data?.success && data?.user) {
        setUser(normalizeUser(data.user))
      }
    } catch (err) {
      console.error('Error refreshing user:', err)
    }
  }, [token])

  // Helpers de roles
  const hasRole = useCallback((role: UserRole) => {
    if (!user?.roles) return false
    const normTarget = role.toLowerCase().trim().replace(/[\s_-]+/g, '_')
    return user.roles.some(r => r === role || r.toLowerCase().trim().replace(/[\s_-]+/g, '_') === normTarget)
  }, [user])

  const isAdminVal      = (user?.roles?.includes('admin') || user?.roles?.includes('super_admin')) ?? false
  const isSuperAdminVal = user?.roles?.includes('super_admin') ?? false
  const staffRoleNames  = ['asistente', 'administrativo', 'secretario', 'secretaria', 'personal', 'personal_admin', 'personal_administrativo']
  const isAsistenteVal  = (user?.roles?.some(r => staffRoleNames.includes(r.toLowerCase().trim().replace(/[\s_-]+/g, '_')))) ?? false
  const isAfiliadoVal   = user?.roles?.includes('afiliado') ?? false
  const isEstudianteVal = user?.roles?.includes('estudiante') ?? false

  const value = useMemo(() => ({
    user, token, isLoading, login, logout,
    hasRole,
    isAdmin: isAdminVal,
    isSuperAdmin: isSuperAdminVal,
    isAsistente: isAsistenteVal,
    isAfiliado: isAfiliadoVal,
    isEstudiante: isEstudianteVal,
    refreshUser,
    isImpersonating: !!originalAdmin,
    originalAdmin,
    impersonateUser,
    stopImpersonation
  }), [
    user, token, isLoading, login, logout,
    hasRole, isAdminVal, isSuperAdminVal, isAsistenteVal,
    isAfiliadoVal, isEstudianteVal, refreshUser,
    originalAdmin, impersonateUser, stopImpersonation
  ])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
