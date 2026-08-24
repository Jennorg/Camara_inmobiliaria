import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import {
  RefreshCw,
  ShieldCheck,
  UserCircle2,
  LayoutGrid,
  CheckCircle2,
  XCircle,
  KeyRound,
  Loader2,
  Search,
  ListFilter,
  Trash2,
  Eye,
  EyeOff,
  Mail,
  LogIn
} from 'lucide-react'


const ic = 'shrink-0 opacity-95'
import { useAuth } from '@/context/AuthContext'
import { API_URL } from '@/config/env'
import { toast } from 'sonner'

interface SystemUser {
  id: number
  email: string
  rol: 'admin' | 'afiliado' | 'super_admin' | 'asistente' | 'administrativo'
  activo: number
  creado_en: string
  id_afiliado: number | null
  tipo_afiliado: string | null
  persona_email: string | null
  empresa_email: string | null
  nombre_completo: string | null
  nombres?: string | null
  apellidos?: string | null
  razon_social?: string | null
  codigo: string | null
  cedula_tipo: string | null
  cedula: string | null
  rif_tipo: string | null
  rif_numero: string | null
}

type FiltroRol    = 'todos' | 'admin' | 'afiliado' | 'super_admin' | 'asistente'
type FiltroActivo = 'todos' | 'activo' | 'inactivo'

export default function UsersPanel() {
  const { token, user, isSuperAdmin, isAdmin, impersonateUser } = useAuth()
  const [users, setUsers]       = useState<SystemUser[]>([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)
  const [resetMsg, setResetMsg] = useState<Record<number, string>>({})
  const [sendingInvite, setSendingInvite] = useState<Record<number, boolean>>({})
  const [userToInvite, setUserToInvite] = useState<SystemUser | null>(null)
  const [impersonatingId, setImpersonatingId] = useState<number | null>(null)

  const handleImpersonateClick = async (u: SystemUser) => {
    try {
      setImpersonatingId(u.id)
      await impersonateUser(u.id)
      toast.success(`Ingresando a la cuenta de ${u.nombre_completo || u.email}`)
    } catch (err: any) {
      toast.error(err.message || 'Error al ingresar como usuario')
    } finally {
      setImpersonatingId(null)
    }
  }
  
  const [showResetPassword, setShowResetPassword] = useState(false)

  // ── Filtros ────────────────────────────────────────────────────────────────
  const [search, setSearch]             = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [searchField, setSearchField]   = useState<'nombre' | 'codigo' | 'email' | 'cedula' | 'rif'>('nombre')
  const [filtroRol, setFiltroRol]       = useState<FiltroRol>('todos')
  const [filtroActivo, setFiltroActivo] = useState<FiltroActivo>('todos')

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
    }, 120)
    return () => clearTimeout(timer)
  }, [search])

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }), [token])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`${API_URL}/api/users`, { headers: authHeaders })
      if (!r.ok) throw new Error(`HTTP error! status: ${r.status}`)
      const d = await r.json()
      if (d.success) setUsers(d.data)
    } finally { setLoading(false) }
  }, [authHeaders])

  useEffect(() => { load() }, [load])

  // ── Pre-procesado de llaves de búsqueda ─────────────────────────────────────
  const normalizedUsers = useMemo(() => {
    return users.map(u => {
      const nomComp = (u.nombre_completo || '').toLowerCase()
      const persona = `${u.nombres || ''} ${u.apellidos || ''}`.trim().toLowerCase()
      const razon = (u.razon_social || '').toLowerCase()
      const cod = (u.codigo || '').toLowerCase()
      const codClean = cod.replace(/[^a-z0-9]/g, '')
      const uEmail = (u.email || '').toLowerCase()
      const pEmail = (u.persona_email || '').toLowerCase()
      const eEmail = (u.empresa_email || '').toLowerCase()
      const ced = (u.cedula || '').toLowerCase()
      const cedTip = (u.cedula_tipo || '').toLowerCase()
      const rif = (u.rif_numero || '').toLowerCase()
      const rifTip = (u.rif_tipo || '').toLowerCase()

      return {
        ...u,
        _searchNombre: `${nomComp} ${persona} ${razon}`,
        _searchCodigo: `${cod} ${codClean}`,
        _searchEmail: `${uEmail} ${pEmail} ${eEmail}`,
        _searchCedula: `${cedTip}-${ced} ${ced}`,
        _searchRif: `${rifTip}-${rif} ${rif}`
      }
    })
  }, [users])

  // ── Filtrado local ultra-rápido ─────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    const terms = q.split(/\s+/).filter(Boolean)

    return normalizedUsers.filter(u => {
      if (filtroRol !== 'todos' && u.rol !== filtroRol) return false
      if (filtroActivo === 'activo'   && !u.activo)   return false
      if (filtroActivo === 'inactivo' &&  u.activo)   return false
      if (terms.length === 0) return true

      if (searchField === 'nombre') {
        return terms.every(term => u._searchNombre.includes(term))
      }
      if (searchField === 'codigo') {
        return terms.every(term => {
          const termClean = term.replace(/[^a-z0-9]/g, '')
          return u._searchCodigo.includes(term) || (termClean !== '' && u._searchCodigo.includes(termClean))
        })
      }
      if (searchField === 'email') {
        return terms.every(term => u._searchEmail.includes(term))
      }
      if (searchField === 'cedula') {
        return terms.every(term => u._searchCedula.includes(term))
      }
      if (searchField === 'rif') {
        return terms.every(term => u._searchRif.includes(term))
      }
      return false
    })
  }, [normalizedUsers, debouncedSearch, filtroRol, filtroActivo, searchField])

  // ── Paginación e Infinite Scroll (30 en 30) ──────────────────────────────────
  const [visibleLimit, setVisibleLimit] = useState(30)
  const observerTarget = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setVisibleLimit(30)
  }, [debouncedSearch, filtroRol, filtroActivo, searchField])

  useEffect(() => {
    const target = observerTarget.current
    if (!target) return

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          setVisibleLimit(prev => Math.min(prev + 30, filtered.length))
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(target)
    return () => observer.disconnect()
  }, [filtered.length])

  const visibleUsers = useMemo(() => {
    return filtered.slice(0, visibleLimit)
  }, [filtered, visibleLimit])

  const toggleActive = async (u: SystemUser) => {
    await fetch(`${API_URL}/api/users/${u.id}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ activo: !u.activo }),
    })
    load()
  }

  const handleRoleChange = async (u: SystemUser, newRol: 'admin' | 'afiliado' | 'super_admin') => {
    if (saving) return
    setSaving(true)
    try {
      const r = await fetch(`${API_URL}/api/users/${u.id}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ rol: newRol }),
      })
      if (!r.ok) throw new Error(`HTTP error! status: ${r.status}`)
      const d = await r.json()
      if (d.success) {
        toast.success(`Rol de ${u.email} actualizado correctamente`)
        load()
      } else {
        toast.error(d.message || 'Error al actualizar el rol')
      }
    } catch (e) {
      toast.error('Error de conexión al actualizar el rol')
    } finally {
      setSaving(false)
    }
  }

  const [resettingUser, setResettingUser] = useState<SystemUser | null>(null)
  const [userToDelete, setUserToDelete]   = useState<SystemUser | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [updatingEmailId, setUpdatingEmailId] = useState<number | null>(null)

  const handleResetClick = (u: SystemUser) => {
    setResettingUser(u)
    setNewPassword('')
  }

  const busyInviteRef = useRef(false)
  const confirmSendInvite = async () => {
    if (!userToInvite || busyInviteRef.current) return
    busyInviteRef.current = true
    const u = userToInvite
    setUserToInvite(null)
    
    if (sendingInvite[u.id]) {
      busyInviteRef.current = false
      return
    }
    setSendingInvite(prev => ({ ...prev, [u.id]: true }))
    try {
      const r = await fetch(`${API_URL}/api/users/${u.id}/invite`, {
        method: 'POST',
        headers: authHeaders,
      })
      if (!r.ok) throw new Error(`HTTP error! status: ${r.status}`)
      const d = await r.json()
      if (d.success) {
        toast.success(`Correo de invitación enviado con éxito a ${u.email}`)
      } else {
        toast.error(d.message || 'Error al enviar el correo de invitación')
      }
    } catch (e) {
      toast.error('Error de conexión al enviar la invitación')
    } finally {
      setSendingInvite(prev => ({ ...prev, [u.id]: false }))
      busyInviteRef.current = false
    }
  }

  const handleEmailTipoChange = async (u: SystemUser, tipo: 'personal' | 'empresa') => {
    // Determinar el tipo actual comparando u.email con empresa_email
    const tipoActual = u.empresa_email && u.email?.trim().toLowerCase() === u.empresa_email?.trim().toLowerCase() ? 'empresa' : 'personal'
    if (tipo === tipoActual) return
    setUpdatingEmailId(u.id)
    try {
      const r = await fetch(`${API_URL}/api/afiliados/${u.id_afiliado}/acceso-email`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ tipo }),
      })
      if (!r.ok) throw new Error(`HTTP error! status: ${r.status}`)
      const d = await r.json()
      if (d.success) {
        toast.success(`Correo de acceso de ${u.nombre_completo || u.email} cambiado a ${d.acceso_email}`)
        load()
      } else {
        toast.error(d.message || 'Error al cambiar el correo de acceso')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setUpdatingEmailId(null)
    }
  }

  const confirmPasswordReset = async () => {
    if (!resettingUser || !newPassword) return
    setSaving(true)
    try {
      const r = await fetch(`${API_URL}/api/users/${resettingUser.id}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ password: newPassword }),
      })
      if (!r.ok) throw new Error(`HTTP error! status: ${r.status}`)
      const d = await r.json()
      if (d.success) {
        toast.success(`Contraseña de ${resettingUser.email} actualizada con éxito.`)
        setResettingUser(null)
        load()
      } else {
        toast.error(d.message || 'Error al actualizar la contraseña')
      }
    } catch (e: any) {
      toast.error(e.message || 'Error de conexión')
    } finally {
      setSaving(false)
    }
  }
  
  const confirmDelete = async () => {
    if (!userToDelete) return
    setSaving(true)
    try {
      const r = await fetch(`${API_URL}/api/users/${userToDelete.id}`, {
        method: 'DELETE',
        headers: authHeaders,
      })
      if (!r.ok) throw new Error(`HTTP error! status: ${r.status}`)
      const d = await r.json()
      if (d.success) {
        toast.success('Usuario eliminado correctamente')
        setUserToDelete(null)
        load()
      } else {
        toast.error(d.message || 'Error al eliminar usuario')
      }
    } catch (e) {
      toast.error('Error al eliminar usuario')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className='h-full w-full overflow-y-auto'>
      <div className='p-4 sm:p-6 lg:p-8 max-w-7xl lg:max-w-full mx-auto space-y-6'>
      {/* Header */}
      <div className='flex flex-col sm:flex-row items-center justify-between gap-2'>
        <div>
          <h1 className='text-2xl font-black text-slate-800'>Gestión de Usuarios</h1>
          <p className='text-sm text-slate-400 mt-1'>
            Administra cuentas y establece contraseñas de afiliados para el panel
          </p>
        </div>
        <div className='flex gap-3 w-full sm:w-auto justify-end'>
          <button
            type='button'
            onClick={load}
            className='flex items-center justify-center gap-2 px-4 py-2 text-slate-600 border border-slate-200 rounded-xl text-sm font-semibold hover:bg-slate-50 hover:border-slate-300 transition w-full sm:w-auto'
          >
            <RefreshCw size={16} strokeWidth={2} className={ic} /> Actualizar
          </button>
        </div>
      </div>



      {/* Reset password modal */}
      {resettingUser && (
        <div className='fixed -inset-10 z-[999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs'>
          <div className='transition-opacity transition-transform bg-white rounded-2xl shadow-xl border border-slate-100 p-6 w-full max-w-md fade-in zoom-in duration-200'>
            <div className='flex items-center gap-3 mb-4'>
              <div className='w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center text-orange-500'>
                <KeyRound size={20} />
              </div>
              <div>
                <h3 className='font-bold text-slate-800'>Establecer contraseña</h3>
                <p className='text-xs text-slate-500'>{resettingUser.email}</p>
              </div>
            </div>

            <div className='space-y-4'>
              <div>
                <label className='block text-xs font-semibold text-slate-500 mb-1'>Nueva contraseña</label>
                <div className="relative flex items-center">
                  <input
                    type={showResetPassword ? 'text' : 'password'}
                    autoFocus
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className='w-full border border-slate-200 rounded-xl pl-4 pr-10 py-2 text-sm focus:outline-none focus:border-orange-400'
                    placeholder='Mínimo 8 caracteres'
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    className="absolute right-3 text-slate-300 hover:text-orange-500 focus:outline-none transition-colors"
                    tabIndex={-1}
                  >
                    {showResetPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <p className='text-[10px] text-slate-400 leading-relaxed italic'>
                El afiliado podrá iniciar sesión de inmediato con esta clave (se activa la cuenta).
              </p>
            </div>

            <div className='flex justify-end gap-3 mt-6'>
              <button 
                type='button' 
                onClick={() => setResettingUser(null)} 
                className='px-5 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-xl transition-colors transition-transform duration-200 active:scale-95'
              >
                Cancelar
              </button>
              <button
                type='button'
                disabled={saving || !newPassword}
                onClick={confirmPasswordReset}
                className='px-5 py-2.5 bg-orange-700 hover:bg-orange-800 text-white rounded-xl text-xs font-black shadow-sm hover:shadow-md hover:shadow-orange-700/20 disabled:bg-orange-400 disabled:text-orange-100 border border-transparent transition-colors transition-transform duration-200 active:scale-95 flex items-center justify-center gap-2'
              >
                {saving && <Loader2 size={14} className='animate-spin' />}
                Confirmar cambio
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {userToDelete && (
        <div className='fixed -inset-10 z-[999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs'>
          <div className='transition-opacity transition-transform bg-white rounded-2xl shadow-2xl border border-slate-100 p-8 w-full max-w-sm fade-in zoom-in duration-200 text-center'>
            <div className='w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 mx-auto mb-4'>
              <Trash2 size={32} />
            </div>
            <h3 className='text-lg font-black text-slate-800 mb-2'>¿Eliminar usuario?</h3>
            <p className='text-sm text-slate-500 mb-6'>
              Estás a punto de eliminar a <span className='font-bold text-slate-700'>{userToDelete.email}</span>. Esta acción no se puede deshacer.
            </p>
            
            <div className='flex flex-col gap-2'>
              <button
                type='button'
                disabled={saving}
                onClick={confirmDelete}
                className='w-full py-3 bg-rose-500 text-white rounded-xl text-sm font-black hover:bg-rose-600 disabled:opacity-50 shadow-lg shadow-rose-500/25 transition-colors transition-opacity flex items-center justify-center gap-2'
              >
                {saving ? <Loader2 size={18} className='animate-spin' /> : <Trash2 size={18} />}
                Eliminar Permanentemente
              </button>
              <button 
                type='button' 
                onClick={() => setUserToDelete(null)} 
                className='w-full py-3 text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors'
              >
                Mantener usuario
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite confirmation modal */}
      {userToInvite && (
        <div className='fixed -inset-10 z-[999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs'>
          <div className='transition-opacity transition-transform bg-white rounded-2xl shadow-2xl border border-slate-100 p-8 w-full max-w-sm fade-in zoom-in duration-200 text-center'>
            <div className='w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 mx-auto mb-4'>
              <Mail size={32} />
            </div>
            <h3 className='text-lg font-black text-slate-800 mb-2'>¿Enviar invitación?</h3>
            <p className='text-sm text-slate-500 mb-6'>
              Estás a punto de enviar un correo de invitación a <span className='font-bold text-slate-700'>{userToInvite.email}</span> para que pueda acceder al panel.
            </p>
            
            <div className='flex flex-col gap-2'>
              <button
                type='button'
                onClick={confirmSendInvite}
                className='w-full py-3 bg-emerald-600 text-white rounded-xl text-sm font-black hover:bg-emerald-700 shadow-lg shadow-emerald-600/25 transition-colors flex items-center justify-center gap-2'
              >
                <Mail size={18} />
                Enviar Invitación
              </button>
              <button 
                type='button' 
                onClick={() => setUserToInvite(null)} 
                className='w-full py-3 text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors'
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ── Filtros ──────────────────────────────────────────────────────────── */}
      <div className='bg-white border border-slate-100 rounded-2xl px-4 py-3 shadow-sm flex flex-wrap items-center gap-4'>
        {/* Búsqueda */}
        <div className='flex items-center gap-2 flex-1 min-w-[280px]'>
          <div className='relative flex-1'>
            <Search size={15} strokeWidth={2} className='absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none' />
            <input
              type='text'
              placeholder={
                searchField === 'nombre' ? 'Buscar por nombre...' :
                searchField === 'codigo' ? 'Buscar por código...' :
                searchField === 'email' ? 'Buscar por email...' :
                searchField === 'cedula' ? 'Buscar por cédula...' : 'Buscar por RIF...'
              }
              value={search}
              onChange={e => setSearch(e.target.value)}
              className='w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-700 placeholder-slate-400 focus:outline-none focus:border-emerald-400 focus:bg-white transition-colors'
            />
          </div>
          <select
            value={searchField}
            onChange={e => setSearchField(e.target.value as any)}
            className='rounded-xl border border-slate-200 px-2 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 focus:outline-none focus:border-emerald-400 focus:bg-white transition-colors cursor-pointer shrink-0'
          >
            <option value='nombre'>Nombre</option>
            <option value='codigo'>Código</option>
            <option value='email'>Email</option>
            <option value='cedula'>Cédula</option>
            <option value='rif'>RIF</option>
          </select>
        </div>

        {/* Filtro Rol Dropdown */}
        <div className='flex items-center gap-2 w-full md:w-auto'>
          <span className='text-[10px] font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap'>Rol:</span>
          <select
            value={filtroRol}
            onChange={e => setFiltroRol(e.target.value as FiltroRol)}
            className='w-full md:w-auto rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 focus:outline-none focus:border-emerald-400 focus:bg-white transition-colors cursor-pointer'
          >
            <option value='todos'>Todos los roles</option>
            <option value='afiliado'>Afiliado</option>
            <option value='asistente'>Personal Admin</option>
            <option value='admin'>Admin</option>
            <option value='super_admin'>Super Admin</option>
          </select>
        </div>

        {/* Filtro Estado Dropdown */}
        <div className='flex items-center gap-2 w-full md:w-auto'>
          <span className='text-[10px] font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap'>Estado:</span>
          <select
            value={filtroActivo}
            onChange={e => setFiltroActivo(e.target.value as FiltroActivo)}
            className='w-full md:w-auto rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 focus:outline-none focus:border-emerald-400 focus:bg-white transition-colors cursor-pointer'
          >
            <option value='todos'>Todos los estados</option>
            <option value='activo'>Activo</option>
            <option value='inactivo'>Inactivo</option>
          </select>
        </div>

        {/* Contador */}
        <span className='ml-auto text-[11px] text-slate-400 font-medium whitespace-nowrap'>
          {filtered.length} de {users.length} usuario{users.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table & Mobile View */}
      {loading ? (
        <div className='flex justify-center py-16 bg-white border border-slate-100 rounded-2xl shadow-sm'>
          <Loader2 size={24} className='animate-spin text-emerald-500' />
        </div>
      ) : filtered.length === 0 ? (
        <div className='bg-white border border-slate-100 rounded-2xl shadow-sm py-16 text-center text-slate-400 text-sm'>
          {users.length === 0 ? 'No hay usuarios registrados aún.' : 'Ningún usuario coincide con los filtros.'}
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className='hidden md:block bg-white border border-slate-100 rounded-2xl shadow-sm overflow-x-auto'>
            <table className='w-full text-sm'>
              <thead className='bg-slate-50 border-b border-slate-100'>
                <tr>
                  {['Usuario', 'Rol', 'Estado', 'Acciones'].map(h => (
                    <th key={h} className={`px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider ${h === 'Acciones' ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className='divide-y divide-slate-50'>
                {visibleUsers.map(u => (
                  <tr key={u.id} className='hover:bg-slate-50 transition'>
                    <td className='px-5 py-4'>
                      {u.tipo_afiliado === 'Corporativo' ? (
                        <div className='relative inline-flex items-center group/select-email'>
                          <select
                            value={u.empresa_email && u.email?.trim().toLowerCase() === u.empresa_email?.trim().toLowerCase() ? 'empresa' : 'personal'}
                            onChange={e => handleEmailTipoChange(u, e.target.value as 'personal' | 'empresa')}
                            disabled={updatingEmailId === u.id}
                            className='appearance-none text-sm font-semibold text-slate-700 bg-transparent border-0 outline-none focus:outline-none focus:ring-0 rounded-sm py-0.5 pl-1.5 -ml-1.5 pr-6 cursor-pointer max-w-[240px] truncate hover:bg-slate-100 hover:text-slate-900 transition-colors'
                          >
                            <option value='personal' className='bg-white text-slate-800 font-semibold'>
                              {u.persona_email || 'No definido'}
                            </option>
                            {u.empresa_email && (
                              <option value='empresa' className='bg-white text-slate-800 font-semibold'>
                                {u.empresa_email}
                              </option>
                            )}
                          </select>
                          <div className='absolute right-1 pointer-events-none text-slate-400 group-hover/select-email:text-slate-600 transition-colors'>
                            <svg className='w-3.5 h-3.5' fill='none' stroke='currentColor' strokeWidth='2.5' viewBox='0 0 24 24'>
                              <path strokeLinecap='round' strokeLinejoin='round' d='M19 9l-7 7-7-7' />
                            </svg>
                          </div>
                          {updatingEmailId === u.id && (
                            <Loader2 size={12} className='animate-spin text-emerald-500 ml-1 shrink-0' />
                          )}
                        </div>
                      ) : (
                        <p className='font-semibold text-slate-700'>{u.email}</p>
                      )}
                      <div className='flex items-center gap-1.5 mt-0.5'>
                        {u.nombre_completo && u.nombre_completo !== 'Sin registro de persona' && u.nombre_completo !== 'Nombre no definido' ? (
                          <p className='text-xs font-medium text-slate-600 truncate max-w-[200px]'>
                            {u.nombre_completo}
                          </p>
                        ) : (
                          <span className='text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md tracking-tight'>
                            {u.email ? u.email.split('@')[0] : 'Cuenta sin vincular'}
                          </span>
                        )}
                        {u.codigo && (
                          <>
                            <span className='text-slate-300'>·</span>
                            <span className='text-[10px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md uppercase tracking-tighter'>
                              {u.codigo}
                            </span>
                          </>
                        )}
                      </div>
                      <p className='text-[10px] text-slate-400 mt-0.5'>
                        {new Date(u.creado_en).toLocaleDateString('es-VE')}
                        {u.id_afiliado ? ` · Afiliado #${u.id_afiliado}` : ''}
                      </p>
                    </td>
                    <td className='px-5 py-4'>
                      {isSuperAdmin && u.id !== user?.id ? (
                        <div className='relative inline-flex items-center group/select'>
                          <select
                            value={u.rol}
                            onChange={e => handleRoleChange(u, e.target.value as any)}
                            disabled={saving}
                            className={`appearance-none inline-flex items-center gap-1.5 pl-3 pr-8 py-1.5 rounded-xl text-xs font-bold border cursor-pointer focus:outline-none focus:ring-4 transition-colors ${
                              u.rol === 'super_admin'
                                ? 'bg-amber-50 text-amber-800 border-amber-200/80 focus:ring-amber-500/10 focus:border-amber-400'
                                : u.rol === 'admin'
                                ? 'bg-violet-50 text-violet-800 border-violet-200/80 focus:ring-violet-500/10 focus:border-violet-400'
                                : u.rol === 'asistente' || u.rol === 'administrativo'
                                ? 'bg-blue-50 text-blue-800 border-blue-200/80 focus:ring-blue-500/10 focus:border-blue-400'
                                : 'bg-emerald-50 text-emerald-800 border-emerald-200/80 focus:ring-emerald-500/10 focus:border-emerald-400'
                            }`}
                          >
                            <option value='afiliado'>Afiliado</option>
                            <option value='asistente'>Personal Admin</option>
                            <option value='admin'>Admin</option>
                            <option value='super_admin'>Super Admin</option>
                          </select>
                          <div className={`absolute right-2.5 pointer-events-none transition-colors ${
                            u.rol === 'super_admin' ? 'text-amber-600' : u.rol === 'admin' ? 'text-violet-600' : u.rol === 'asistente' || u.rol === 'administrativo' ? 'text-blue-600' : 'text-emerald-600'
                          }`}>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
                      ) : (
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${
                          u.rol === 'super_admin'
                            ? 'bg-amber-50 text-amber-800 border-amber-200/80 shadow-sm shadow-amber-500/10'
                            : u.rol === 'admin'
                            ? 'bg-violet-50 text-violet-800 border-violet-200/80'
                            : u.rol === 'asistente' || u.rol === 'administrativo'
                            ? 'bg-blue-50 text-blue-800 border-blue-200/80'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-200/80'
                        }`}>
                          {u.rol === 'super_admin' ? (
                            <ShieldCheck size={14} strokeWidth={2} className='shrink-0 text-amber-600' />
                          ) : u.rol === 'admin' ? (
                            <ShieldCheck size={14} strokeWidth={2} className='shrink-0 text-violet-600' />
                          ) : u.rol === 'asistente' || u.rol === 'administrativo' ? (
                            <ShieldCheck size={14} strokeWidth={2} className='shrink-0 text-blue-600' />
                          ) : (
                            <UserCircle2 size={14} strokeWidth={2} className='shrink-0 text-emerald-600' />
                          )}
                          {u.rol === 'super_admin' ? 'Super Admin' : u.rol === 'admin' ? 'Admin' : u.rol === 'asistente' || u.rol === 'administrativo' ? 'Personal Admin' : 'Afiliado'}
                        </span>
                      )}
                    </td>
                    <td className='px-5 py-4'>
                      <button
                        type='button'
                        onClick={() => toggleActive(u)}
                        className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition hover:bg-slate-50 ${
                          u.activo ? 'border-emerald-200/80 bg-emerald-50/50' : 'border-slate-200 bg-slate-50/80'
                        }`}
                      >
                        {u.activo ? (
                          <CheckCircle2 size={18} strokeWidth={2} className='shrink-0 text-emerald-600' />
                        ) : (
                          <XCircle size={18} strokeWidth={2} className='shrink-0 text-slate-400' />
                        )}
                        <span className={`text-xs font-semibold ${u.activo ? 'text-emerald-800' : 'text-slate-500'}`}>
                          {u.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </button>
                    </td>
                    <td className='px-5 py-4 text-right'>
                      <div className='flex justify-end gap-2'>
                        <button
                          type='button'
                          disabled={sendingInvite[u.id]}
                          onClick={() => setUserToInvite(u)}
                          className='inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-100 hover:border-slate-300 disabled:opacity-50 transition shadow-sm'
                          title='Enviar correo de invitación'
                        >
                          {sendingInvite[u.id] ? (
                            <Loader2 size={14} className='animate-spin shrink-0 text-emerald-500' />
                          ) : (
                            <Mail size={14} className='shrink-0 text-slate-500' />
                          )}
                          <span>Invitar</span>
                        </button>
                        <button
                          type='button'
                          onClick={() => handleResetClick(u)}
                          className='inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-100 hover:border-slate-300 transition shadow-sm'
                        >
                          <KeyRound size={14} strokeWidth={2} className='shrink-0 text-slate-500' />
                          Contraseña
                        </button>
                        {(isAdmin || isSuperAdmin) && (
                          <>
                            <button
                              type='button'
                              disabled={impersonatingId === u.id || u.id === user?.id}
                              onClick={() => handleImpersonateClick(u)}
                              className='inline-flex items-center gap-1.5 px-3 py-2 border border-emerald-200 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold hover:bg-emerald-100 transition shadow-sm cursor-pointer disabled:opacity-50'
                              title='Ingresar como este usuario (Suplantación)'
                            >
                              {impersonatingId === u.id ? (
                                <Loader2 size={14} className='animate-spin shrink-0 text-emerald-600' />
                              ) : (
                                <LogIn size={14} className='shrink-0 text-emerald-600' />
                              )}
                              <span>Ingresar</span>
                            </button>
                            <button
                              type='button'
                              onClick={() => setUserToDelete(u)}
                              className='inline-flex items-center gap-1.5 px-3 py-2 border border-rose-100 text-rose-600 rounded-xl text-xs font-semibold hover:bg-rose-50 hover:border-rose-200 transition shadow-sm'
                              title='Eliminar usuario'
                            >
                              <Trash2 size={14} strokeWidth={2} className='shrink-0 text-rose-500' />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards View */}
          <div className='block md:hidden space-y-4'>
            {visibleUsers.map(u => (
              <div key={u.id} className='bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4 relative overflow-hidden'>
                {/* Visual Accent */}
                <div className={`absolute top-0 left-0 w-1 h-full ${
                  u.rol === 'super_admin' ? 'bg-amber-400' : u.rol === 'admin' ? 'bg-violet-400' : 'bg-emerald-400'
                }`} />

                <div className='flex items-start justify-between gap-3'>
                  <div className='space-y-1 min-w-0 pl-1'>
                     {u.tipo_afiliado === 'Corporativo' ? (
                      <div className='relative inline-flex items-center group/select-email mb-1.5'>
                        <select
                          value={u.empresa_email && u.email?.trim().toLowerCase() === u.empresa_email?.trim().toLowerCase() ? 'empresa' : 'personal'}
                          onChange={e => handleEmailTipoChange(u, e.target.value as 'personal' | 'empresa')}
                          disabled={updatingEmailId === u.id}
                          className='appearance-none text-sm font-semibold text-slate-700 bg-transparent border-0 outline-none focus:outline-none focus:ring-0 rounded-sm py-0.5 pl-1.5 -ml-1.5 pr-6 cursor-pointer max-w-[200px] truncate hover:bg-slate-100 hover:text-slate-900 transition-colors'
                        >
                          <option value='personal' className='bg-white text-slate-800 font-semibold'>
                            {u.persona_email || 'No definido'}
                          </option>
                          {u.empresa_email && (
                            <option value='empresa' className='bg-white text-slate-800 font-semibold'>
                              {u.empresa_email}
                            </option>
                          )}
                        </select>
                        <div className='absolute right-1 pointer-events-none text-slate-400 group-hover/select-email:text-slate-600 transition-colors'>
                          <svg className='w-3.5 h-3.5' fill='none' stroke='currentColor' strokeWidth='2.5' viewBox='0 0 24 24'>
                            <path strokeLinecap='round' strokeLinejoin='round' d='M19 9l-7 7-7-7' />
                          </svg>
                        </div>
                        {updatingEmailId === u.id && (
                          <Loader2 size={12} className='animate-spin text-emerald-500 ml-1 shrink-0' />
                        )}
                      </div>
                    ) : (
                      <p className='font-bold text-slate-700 text-sm truncate'>{u.email}</p>
                    )}
                    {u.nombre_completo ? (
                      <p className='text-xs text-slate-500 font-semibold truncate'>{u.nombre_completo}</p>
                    ) : (
                      <p className='text-[10px] font-bold text-slate-300 uppercase tracking-wider'>Sin nombre</p>
                    )}
                    <div className='flex items-center gap-1.5 flex-wrap text-[10px] text-slate-400 pt-0.5'>
                      <span>{new Date(u.creado_en).toLocaleDateString('es-VE')}</span>
                      {u.codigo && (
                        <>
                          <span>·</span>
                          <span className='font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md uppercase tracking-tighter'>
                            {u.codigo}
                          </span>
                        </>
                      )}
                      {u.id_afiliado && (
                        <>
                          <span>·</span>
                          <span>Afiliado #{u.id_afiliado}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Role badge or dropdown & Status toggle directly below */}
                  <div className='flex flex-col items-end gap-2 shrink-0'>
                    {isSuperAdmin && u.id !== user?.id ? (
                      <div className='relative inline-flex items-center group/select'>
                        <select
                          value={u.rol}
                          onChange={e => handleRoleChange(u, e.target.value as any)}
                          disabled={saving}
                          className={`appearance-none inline-flex items-center gap-1.5 pl-2.5 pr-7 py-1 rounded-xl text-[11px] font-bold border cursor-pointer focus:outline-none focus:ring-4 transition-colors ${
                            u.rol === 'super_admin'
                              ? 'bg-amber-50 text-amber-800 border-amber-200/80'
                              : u.rol === 'admin'
                              ? 'bg-violet-50 text-violet-800 border-violet-200/80'
                              : u.rol === 'asistente'
                              ? 'bg-blue-50 text-blue-800 border-blue-200/80'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-200/80'
                          }`}
                        >
                          <option value='afiliado'>Afiliado</option>
                          <option value='asistente'>Personal Admin</option>
                          <option value='admin'>Admin</option>
                          <option value='super_admin'>Super Admin</option>
                        </select>
                        <div className={`absolute right-2 pointer-events-none ${
                          u.rol === 'super_admin' ? 'text-amber-600' : u.rol === 'admin' ? 'text-violet-600' : u.rol === 'asistente' ? 'text-blue-600' : 'text-emerald-600'
                        }`}>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                    ) : (
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                        u.rol === 'super_admin'
                          ? 'bg-amber-50 text-amber-800 border-amber-200/80'
                          : u.rol === 'admin'
                          ? 'bg-violet-50 text-violet-800 border-violet-200/80'
                          : u.rol === 'asistente'
                          ? 'bg-blue-50 text-blue-800 border-blue-200/80'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-200/80'
                      }`}>
                        {u.rol === 'super_admin' ? 'Super Admin' : u.rol === 'admin' ? 'Admin' : u.rol === 'asistente' ? 'Personal Admin' : 'Afiliado'}
                      </span>
                    )}

                    <button
                      type='button'
                      onClick={() => toggleActive(u)}
                      className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 transition hover:bg-slate-50 ${
                        u.activo ? 'border-emerald-200/80 bg-emerald-50/50' : 'border-slate-200 bg-slate-50/80'
                      }`}
                    >
                      {u.activo ? (
                        <CheckCircle2 size={13} strokeWidth={2} className='shrink-0 text-emerald-600' />
                      ) : (
                        <XCircle size={13} strokeWidth={2} className='shrink-0 text-slate-400' />
                      )}
                      <span className={`text-[11px] font-semibold ${u.activo ? 'text-emerald-800' : 'text-slate-500'}`}>
                        {u.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Actions Row */}
                <div className='flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-50 pl-1'>
                  <button
                      type='button'
                      disabled={sendingInvite[u.id]}
                      onClick={() => setUserToInvite(u)}
                      className='inline-flex items-center justify-center gap-1 px-3 py-1.5 border border-slate-200 text-slate-600 rounded-xl text-[11px] font-bold hover:bg-slate-100 transition shadow-sm'
                      title='Enviar correo de invitación'
                    >
                      {sendingInvite[u.id] ? (
                        <Loader2 size={13} className='animate-spin shrink-0 text-emerald-500' />
                      ) : (
                        <Mail size={13} className='shrink-0 text-slate-500' />
                      )}
                      <span>Invitar</span>
                    </button>
                    
                    <button
                      type='button'
                      onClick={() => handleResetClick(u)}
                      className='inline-flex items-center justify-center gap-1 px-3 py-1.5 border border-slate-200 text-slate-600 rounded-xl text-[11px] font-bold hover:bg-slate-100 transition shadow-sm'
                    >
                      <KeyRound size={13} strokeWidth={2} className='shrink-0 text-slate-500' />
                      <span>Clave</span>
                    </button>

                    {(isAdmin || isSuperAdmin) && (
                      <>
                        <button
                          type='button'
                          disabled={impersonatingId === u.id || u.id === user?.id}
                          onClick={() => handleImpersonateClick(u)}
                          className='inline-flex items-center justify-center gap-1 px-3 py-1.5 border border-emerald-200 bg-emerald-50 text-emerald-700 rounded-xl text-[11px] font-bold hover:bg-emerald-100 transition shadow-sm cursor-pointer disabled:opacity-50'
                          title='Ingresar como este usuario'
                        >
                          {impersonatingId === u.id ? (
                            <Loader2 size={13} className='animate-spin shrink-0 text-emerald-600' />
                          ) : (
                            <LogIn size={13} className='shrink-0 text-emerald-600' />
                          )}
                          <span>Ingresar</span>
                        </button>
                        <button
                          type='button'
                          onClick={() => setUserToDelete(u)}
                          className='inline-flex items-center justify-center p-2 border border-rose-100 text-rose-600 rounded-xl hover:bg-rose-50 transition shadow-sm'
                          title='Eliminar usuario'
                        >
                          <Trash2 size={14} strokeWidth={2} className='shrink-0 text-rose-500' />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
          </div>

          {/* Infinite Scroll Sentinel / Indicator */}
          {visibleLimit < filtered.length && (
            <div ref={observerTarget} className="flex flex-col items-center justify-center py-6 gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500 bg-slate-100/80 px-4 py-2 rounded-xl border border-slate-200/60 shadow-2xs">
                <Loader2 size={14} className="animate-spin text-emerald-500" />
                <span>Cargando más usuarios... (mostrando {visibleUsers.length} de {filtered.length})</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  </div>
  )
}
