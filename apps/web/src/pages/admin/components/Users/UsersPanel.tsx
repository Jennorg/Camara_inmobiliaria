import React, { useState, useEffect, useMemo } from 'react'
import {
  UserPlus,
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
} from 'lucide-react'


const ic = 'shrink-0 opacity-95'
const icBtn = (active: boolean) => (active ? 'text-white' : 'text-slate-500')
import { useAuth } from '@/context/AuthContext'
import { API_URL } from '@/config/env'
import EstablecerAccesoAfiliado from '@/pages/admin/components/Users/EstablecerAccesoAfiliado'

interface SystemUser {
  id: number
  email: string
  rol: 'admin' | 'afiliado' | 'super_admin'
  activo: number
  creado_en: string
  id_afiliado: number | null
  nombre_completo: string | null
  codigo_cibir: string | null
}

interface CreateForm {
  email: string
  password: string
  rol: 'admin' | 'afiliado' | 'super_admin'
}

const EMPTY_FORM: CreateForm = { email: '', password: '', rol: 'afiliado' }

type FiltroRol    = 'todos' | 'admin' | 'afiliado' | 'super_admin'
type FiltroActivo = 'todos' | 'activo' | 'inactivo'

export default function UsersPanel() {
  const { token, user, isSuperAdmin } = useAuth()
  const [users, setUsers]       = useState<SystemUser[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState<CreateForm>(EMPTY_FORM)
  const [saving, setSaving]     = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)
  const [resetMsg, setResetMsg] = useState<Record<number, string>>({})

  // ── Filtros ────────────────────────────────────────────────────────────────
  const [search, setSearch]             = useState('')
  const [filtroRol, setFiltroRol]       = useState<FiltroRol>('todos')
  const [filtroActivo, setFiltroActivo] = useState<FiltroActivo>('todos')

  const authHeaders = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch(`${API_URL}/api/users`, { headers: authHeaders })
      const d = await r.json()
      if (d.success) setUsers(d.data)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  // ── Filtrado local ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users.filter(u => {
      if (filtroRol !== 'todos' && u.rol !== filtroRol) return false
      if (filtroActivo === 'activo'   && !u.activo)   return false
      if (filtroActivo === 'inactivo' &&  u.activo)   return false
      if (q) {
        const hayMatch =
          u.email.toLowerCase().includes(q) ||
          (u.nombre_completo?.toLowerCase().includes(q) ?? false) ||
          (u.codigo_cibir?.toLowerCase().includes(q) ?? false)
        if (!hayMatch) return false
      }
      return true
    })
  }, [users, search, filtroRol, filtroActivo])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setFeedback(null)
    try {
      const r = await fetch(`${API_URL}/api/users`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          email:        form.email,
          password:     form.password,
          rol:          form.rol,
        }),
      })
      const d = await r.json()
      if (d.success) {
        setFeedback({ type: 'ok', msg: 'Usuario creado correctamente' })
        setForm(EMPTY_FORM)
        setShowForm(false)
        load()
      } else {
        setFeedback({ type: 'err', msg: d.message })
      }
    } finally { setSaving(false) }
  }

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
    setFeedback(null)
    try {
      const r = await fetch(`${API_URL}/api/users/${u.id}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ rol: newRol }),
      })
      const d = await r.json()
      if (d.success) {
        setFeedback({ type: 'ok', msg: `Rol de ${u.email} actualizado correctamente` })
        load()
      } else {
        setFeedback({ type: 'err', msg: d.message || 'Error al actualizar el rol' })
      }
    } catch (e) {
      setFeedback({ type: 'err', msg: 'Error de conexión al actualizar el rol' })
    } finally {
      setSaving(false)
    }
  }

  const [resettingUser, setResettingUser] = useState<SystemUser | null>(null)
  const [userToDelete, setUserToDelete]   = useState<SystemUser | null>(null)
  const [newPassword, setNewPassword] = useState('')

  const handleResetClick = (u: SystemUser) => {
    setResettingUser(u)
    setNewPassword('')
    setFeedback(null)
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
      const d = await r.json()
      if (d.success) {
        setFeedback({ type: 'ok', msg: `Contraseña de ${resettingUser.email} actualizada` })
        setResettingUser(null)
      } else {
        setFeedback({ type: 'err', msg: d.message })
      }
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
      const d = await r.json()
      if (d.success) {
        setFeedback({ type: 'ok', msg: 'Usuario eliminado correctamente' })
        setUserToDelete(null)
        load()
      } else {
        setFeedback({ type: 'err', msg: d.message })
      }
    } catch (e) {
      setFeedback({ type: 'err', msg: 'Error al eliminar usuario' })
    } finally {
      setSaving(false)
    }
  }


  const filterBtnCls = (active: boolean) =>

    `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-colors border ${
      active
        ? 'bg-slate-800 border-slate-800 text-white shadow-sm'
        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
    }`

  return (
    <div className='h-full w-full overflow-y-auto'>
      <div className='p-6 max-w-5xl mx-auto space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-black text-slate-800'>Gestión de Usuarios</h1>
          <p className='text-sm text-slate-400 mt-1'>
            Administra cuentas y establece contraseñas de afiliados para el panel
          </p>
        </div>
        <div className='flex gap-3'>
          <button
            type='button'
            onClick={load}
            className='flex items-center gap-2 px-4 py-2 text-slate-600 border border-slate-200 rounded-xl text-sm font-semibold hover:bg-slate-50 hover:border-slate-300 transition'
          >
            <RefreshCw size={16} strokeWidth={2} className={ic} /> Actualizar
          </button>
          <button
            type='button'
            onClick={() => { setShowForm(!showForm); setFeedback(null); setResettingUser(null) }}
            className='flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl text-sm font-bold hover:bg-emerald-600 transition shadow-sm shadow-emerald-500/20'
          >
            <UserPlus size={16} strokeWidth={2} className={ic} /> Nuevo usuario
          </button>
        </div>
      </div>

      <EstablecerAccesoAfiliado
        token={token}
        onSuccess={msg => setFeedback({ type: 'ok', msg })}
      />

      {/* Feedback */}
      {feedback && (
        <div className={`px-4 py-3 rounded-xl text-sm font-medium ${feedback.type === 'ok' ? 'bg-emerald-50 text-emerald-700 shadow-sm border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100 shadow-sm'}`}>
          {feedback.msg}
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className='bg-white border border-slate-100 rounded-[2rem] p-8 shadow-xl shadow-slate-200/40 animate-in fade-in slide-in-from-top-4 duration-300 space-y-6 relative overflow-hidden'
        >
          {/* Decoración sutil */}
          <div className="absolute top-0 left-0 w-1 bg-emerald-500 h-full" />
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
              <UserPlus size={20} />
            </div>
            <div>
              <h2 className='text-lg font-black text-slate-800 leading-none'>Nuevo Usuario</h2>
              <p className="text-xs text-slate-400 mt-1 font-medium">Define las credenciales y el nivel de acceso</p>
            </div>
          </div>

          <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
            <div className="space-y-1.5">
              <label className='block text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1'>Email</label>
              <div className="relative group">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-emerald-500 transition-colors" />
                <input
                  type='email' required
                  value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  className='w-full bg-slate-50 border border-slate-100 rounded-2xl pl-11 pr-4 py-3 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-400 focus:bg-white transition-all placeholder:text-slate-300'
                  placeholder='correo@ejemplo.com'
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className='block text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1'>Contraseña inicial</label>
              <div className="relative group">
                <KeyRound size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-emerald-500 transition-colors" />
                <input
                  type='text' required
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  className='w-full bg-slate-50 border border-slate-100 rounded-2xl pl-11 pr-4 py-3 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-400 focus:bg-white transition-all placeholder:text-slate-300'
                  placeholder='Mínimo 8 caracteres'
                  minLength={8}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className='block text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1'>Rol / Nivel de Acceso</label>
              <div className="relative group">
                <ShieldCheck size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-emerald-500 transition-colors pointer-events-none" />
                <select
                  value={form.rol}
                  onChange={e => setForm(p => ({ ...p, rol: e.target.value as any }))}
                  className='w-full bg-slate-50 border border-slate-100 rounded-2xl pl-11 pr-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-400 focus:bg-white transition-all appearance-none cursor-pointer'
                >
                  <option value='afiliado'>Afiliado</option>
                  <option value='admin'>Administrador</option>
                  <option value='super_admin'>Súper Administrador</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300">
                  <LayoutGrid size={14} />
                </div>
              </div>
            </div>
          </div>

          <div className='flex justify-end items-center gap-4 pt-4 border-t border-slate-50'>
            <button 
              type='button' 
              onClick={() => setShowForm(false)} 
              className='px-6 py-2.5 text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors'
            >
              Cancelar
            </button>
            <button
              type='submit' 
              disabled={saving}
              className='px-8 py-3 bg-emerald-500 text-white rounded-2xl text-sm font-black hover:bg-emerald-600 disabled:opacity-50 shadow-lg shadow-emerald-500/25 transition-all hover:-translate-y-0.5 active:scale-95 flex items-center gap-2'
            >
              {saving ? <Loader2 size={18} className='animate-spin' /> : <UserPlus size={18} />}
              Crear Usuario
            </button>
          </div>
        </form>
      )}

      {/* Reset password modal */}
      {resettingUser && (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm'>
          <div className='bg-white rounded-2xl shadow-xl border border-slate-100 p-6 w-full max-w-md animate-in fade-in zoom-in duration-200'>
            <div className='flex items-center gap-3 mb-4'>
              <div className='w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-500'>
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
                <input
                  type='text'
                  autoFocus
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className='w-full border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-amber-400'
                  placeholder='Mínimo 8 caracteres'
                  minLength={8}
                />
              </div>
              <p className='text-[10px] text-slate-400 leading-relaxed italic'>
                El afiliado podrá iniciar sesión de inmediato con esta clave (se activa la cuenta).
              </p>
            </div>

            <div className='flex justify-end gap-3 mt-6'>
              <button 
                type='button' 
                onClick={() => setResettingUser(null)} 
                className='px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-colors'
              >
                Cancelar
              </button>
              <button
                type='button'
                disabled={saving || !newPassword}
                onClick={confirmPasswordReset}
                className='px-5 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-900 disabled:opacity-50 shadow-sm transition-all active:scale-95 flex items-center gap-2'
              >
                {saving ? <Loader2 size={14} className='animate-spin' /> : <ShieldCheck size={14} />}
                Confirmar cambio
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {userToDelete && (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm'>
          <div className='bg-white rounded-2xl shadow-2xl border border-slate-100 p-8 w-full max-w-sm animate-in fade-in zoom-in duration-200 text-center'>
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
                className='w-full py-3 bg-rose-500 text-white rounded-xl text-sm font-black hover:bg-rose-600 disabled:opacity-50 shadow-lg shadow-rose-500/25 transition-all flex items-center justify-center gap-2'
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


      {/* ── Filtros ──────────────────────────────────────────────────────────── */}
      <div className='bg-white border border-slate-100 rounded-2xl px-4 py-3 shadow-sm flex flex-wrap items-center gap-3'>
        {/* Búsqueda */}
        <div className='relative flex-1 min-w-[180px]'>
          <Search size={15} strokeWidth={2} className='absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none' />
          <input
            type='text'
            placeholder='Buscar por email o afiliado...'
            value={search}
            onChange={e => setSearch(e.target.value)}
            className='w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-700 placeholder-slate-400 focus:outline-none focus:border-emerald-400 focus:bg-white transition-colors'
          />
        </div>

        {/* Filtro Rol */}
        <div className='flex items-center gap-1.5'>
          <span className='text-[10px] font-bold text-slate-400 uppercase tracking-wide mr-1'>Rol</span>
          {(['todos', 'admin', 'afiliado', 'super_admin'] as FiltroRol[]).map(r => (
            <button
              key={r}
              type='button'
              onClick={() => setFiltroRol(r)}
              className={filterBtnCls(filtroRol === r)}
            >
              {r === 'todos' && (
                <>
                  <LayoutGrid size={14} strokeWidth={2} className={`${ic} ${icBtn(filtroRol === r)}`} />
                  Todos
                </>
              )}
              {r === 'admin' && (
                <>
                  <ShieldCheck size={14} strokeWidth={2} className={`${ic} ${icBtn(filtroRol === r)}`} />
                  Admin
                </>
              )}
              {r === 'afiliado' && (
                <>
                  <UserCircle2 size={14} strokeWidth={2} className={`${ic} ${icBtn(filtroRol === r)}`} />
                  Afiliado
                </>
              )}
              {r === 'super_admin' && (
                <>
                  <UserPlus size={14} strokeWidth={2} className={`${ic} ${icBtn(filtroRol === r)}`} />
                  Super Admin
                </>
              )}
            </button>
          ))}
        </div>

        {/* Filtro Estado */}
        <div className='flex items-center gap-1.5'>
          <span className='text-[10px] font-bold text-slate-400 uppercase tracking-wide mr-1'>Estado</span>
          {(['todos', 'activo', 'inactivo'] as FiltroActivo[]).map(s => (
            <button
              key={s}
              type='button'
              onClick={() => setFiltroActivo(s)}
              className={filterBtnCls(filtroActivo === s)}
            >
              {s === 'todos' && (
                <>
                  <ListFilter size={14} strokeWidth={2} className={`${ic} ${icBtn(filtroActivo === s)}`} />
                  Todos
                </>
              )}
              {s === 'activo' && (
                <>
                  <CheckCircle2 size={14} strokeWidth={2} className={`${ic} ${filtroActivo === s ? 'text-emerald-200' : 'text-emerald-600'}`} />
                  Activo
                </>
              )}
              {s === 'inactivo' && (
                <>
                  <XCircle size={14} strokeWidth={2} className={`${ic} ${filtroActivo === s ? 'text-rose-200' : 'text-slate-500'}`} />
                  Inactivo
                </>
              )}
            </button>
          ))}
        </div>

        {/* Contador */}
        <span className='ml-auto text-[11px] text-slate-400 font-medium whitespace-nowrap'>
          {filtered.length} de {users.length} usuario{users.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className='bg-white border border-slate-100 rounded-2xl shadow-sm overflow-x-auto'>
        {loading ? (
          <div className='flex justify-center py-16'>
            <Loader2 size={24} className='animate-spin text-emerald-500' />
          </div>
        ) : filtered.length === 0 ? (
          <p className='text-center py-16 text-slate-400 text-sm'>
            {users.length === 0 ? 'No hay usuarios registrados aún.' : 'Ningún usuario coincide con los filtros.'}
          </p>
        ) : (
          <table className='w-full text-sm'>
            <thead className='bg-slate-50 border-b border-slate-100'>
              <tr>
                {['Usuario', 'Rol', 'Estado', 'Acciones'].map(h => (
                  <th key={h} className={`px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider ${h === 'Acciones' ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className='divide-y divide-slate-50'>
              {filtered.map(u => (
                <tr key={u.id} className='hover:bg-slate-50 transition'>
                  <td className='px-5 py-4'>
                    <p className='font-semibold text-slate-700'>{u.email}</p>
                    {u.nombre_completo && (
                      <p className='text-xs text-slate-500 mt-0.5 truncate max-w-[220px]'>
                        {u.nombre_completo}
                        {u.codigo_cibir ? ` · ${u.codigo_cibir}` : ''}
                      </p>
                    )}
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
                          className={`appearance-none inline-flex items-center gap-1.5 pl-3 pr-8 py-1.5 rounded-xl text-xs font-bold border cursor-pointer focus:outline-none focus:ring-4 transition-all ${
                            u.rol === 'super_admin'
                              ? 'bg-amber-50 text-amber-800 border-amber-200/80 focus:ring-amber-500/10 focus:border-amber-400'
                              : u.rol === 'admin'
                              ? 'bg-violet-50 text-violet-800 border-violet-200/80 focus:ring-violet-500/10 focus:border-violet-400'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-200/80 focus:ring-emerald-500/10 focus:border-emerald-400'
                          }`}
                        >
                          <option value='afiliado'>Afiliado</option>
                          <option value='admin'>Admin</option>
                          <option value='super_admin'>Super Admin</option>
                        </select>
                        <div className={`absolute right-2.5 pointer-events-none transition-colors ${
                          u.rol === 'super_admin' ? 'text-amber-600' : u.rol === 'admin' ? 'text-violet-600' : 'text-emerald-600'
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
                          : 'bg-emerald-50 text-emerald-800 border-emerald-200/80'
                      }`}>
                        {u.rol === 'super_admin' ? (
                          <ShieldCheck size={14} strokeWidth={2} className='shrink-0 text-amber-600' />
                        ) : u.rol === 'admin' ? (
                          <ShieldCheck size={14} strokeWidth={2} className='shrink-0 text-violet-600' />
                        ) : (
                          <UserCircle2 size={14} strokeWidth={2} className='shrink-0 text-emerald-600' />
                        )}
                        {u.rol === 'super_admin' ? 'Super Admin' : u.rol === 'admin' ? 'Admin' : 'Afiliado'}
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
                        onClick={() => handleResetClick(u)}
                        className='inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-100 hover:border-slate-300 transition shadow-sm'
                      >
                        <KeyRound size={14} strokeWidth={2} className='shrink-0 text-slate-500' />
                        Contraseña
                      </button>
                      <button
                        type='button'
                        onClick={() => setUserToDelete(u)}
                        className='inline-flex items-center gap-1.5 px-3 py-2 border border-rose-100 text-rose-600 rounded-xl text-xs font-semibold hover:bg-rose-50 hover:border-rose-200 transition shadow-sm'
                        title='Eliminar usuario'
                      >

                        <Trash2 size={14} strokeWidth={2} className='shrink-0 text-rose-500' />
                      </button>
                    </div>

                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  </div>
  )
}
