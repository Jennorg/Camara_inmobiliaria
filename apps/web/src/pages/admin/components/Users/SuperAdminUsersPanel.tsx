import React, { useState, useEffect, useCallback, useRef } from 'react'
import { API_URL } from '@/config/env'
import { useAuth } from '@/context/AuthContext'
import { Trash2, ShieldCheck, Loader2, KeyRound, Eye, EyeOff } from 'lucide-react'



interface UserAdmin {
  id: number
  email: string
  rol: string
  activo: number
  creado_en: string
}

const SuperAdminUsersPanel = () => {
  const { token, user } = useAuth()
  const [users, setUsers] = useState<UserAdmin[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [newRol, setNewRol] = useState('admin')
  const [userToDelete, setUserToDelete] = useState<UserAdmin | null>(null)
  const [saving, setSaving] = useState(false)

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/users`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
      const data = await res.json()
      if (data.success) {
        // Filramos para mostrar solo admin y super_admin
        setUsers(data.data.filter((u: UserAdmin) => ['admin', 'super_admin'].includes(u.rol)))
      }
    } catch (err) {
      setError('Error al obtener administradores')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const confirmDelete = async () => {
    if (!userToDelete) return
    setSaving(true)
    try {
      const res = await fetch(`${API_URL}/api/users/${userToDelete.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
      const data = await res.json()
      if (data.success) {
        setUsers(users.filter(u => u.id !== userToDelete.id))
        setUserToDelete(null)
      } else {
        alert(data.message)
      }
    } catch (err) {
      alert('Error de conexión')
    } finally {
      setSaving(false)
    }
  }


  const busyCreateUserRef = useRef(false)
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busyCreateUserRef.current) return
    busyCreateUserRef.current = true
    try {
      const res = await fetch(`${API_URL}/api/users`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ email: newEmail, password: newPassword, rol: newRol })
      })
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
      const data = await res.json()
      if (data.success) {
        setIsModalOpen(false)
        setNewEmail('')
        setNewPassword('')
        fetchUsers() // Refresh list
      } else {
        alert(data.message || 'Error al crear usuario')
      }
    } catch (err) {
      alert('Error de conexión')
    } finally {
      busyCreateUserRef.current = false
    }
  }

  const toggleActive = async (userObj: UserAdmin) => {
    if (userObj.id === user?.id) {
       alert("No puedes desactivar tu propia cuenta activa en esta sesión");
       return;
    }
    try {
      const res = await fetch(`${API_URL}/api/users/${userObj.id}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ activo: userObj.activo ? 0 : 1 })
      })
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
      const data = await res.json()
      if (data.success) {
        setUsers(users.map(u => u.id === userObj.id ? { ...u, activo: u.activo ? 0 : 1 } : u))
      } else {
        alert(data.message)
      }
    } catch (err) {
      alert('Error al cambiar estado')
    }
  }

  if (loading) return <div className="p-8">Cargando administradores...</div>

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="flex flex-col sm:flex-row px-6 sm:px-8 py-5 items-start sm:items-center justify-between border-b border-slate-100 gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-800">
            Administradores del Sistema
          </h2>
          <p className="text-sm text-slate-500 font-medium">Gestión exclusiva para super administradores</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-[#00D084] hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-colors w-full sm:w-auto text-center"
        >
          + Nuevo Admin
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-8">
        {/* Desktop Table View */}
        <div className="hidden md:block bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-bold">Usuario</th>
                <th className="px-6 py-4 font-bold">Rol</th>
                <th className="px-6 py-4 font-bold">Estado</th>
                <th className="px-6 py-4 font-bold">Creación</th>
                <th className="px-6 py-4 font-bold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                     <span className="font-semibold text-slate-700">{u.email}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full inline-flex text-xs font-bold leading-5 ${u.rol === 'super_admin' ? 'bg-purple-50 text-purple-700 border border-purple-100' : 'bg-blue-50 text-blue-700 border border-blue-100'}`}>
                      {u.rol}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button 
                      onClick={() => toggleActive(u)}
                      className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${u.activo ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
                    >
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-slate-500 font-medium">
                     {new Date(u.creado_en).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right space-x-3">
                     <button 
                       onClick={() => setUserToDelete(u)}
                       disabled={u.id === user?.id}
                       className="text-red-400 hover:text-red-600 font-bold disabled:opacity-30 transition-colors"
                     >
                       Eliminar
                     </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                   <td colSpan={5} className="text-center py-8 text-slate-500">Ningún administrador encontrado... algo anda mal.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card List */}
        <div className="block md:hidden space-y-4">
          {users.map((u) => (
            <div key={u.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 relative overflow-hidden">
              <div className={`absolute top-0 left-0 w-1 h-full ${
                u.rol === 'super_admin' ? 'bg-purple-400' : 'bg-blue-400'
              }`} />
              
              <div className="flex items-start justify-between gap-2 pl-1">
                <div className="space-y-1 min-w-0">
                  <span className="font-bold text-slate-800 text-sm truncate block">{u.email}</span>
                  <span className="text-[10px] text-slate-400 font-medium block">
                    Creado: {new Date(u.creado_en).toLocaleDateString()}
                  </span>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                  u.rol === 'super_admin' ? 'bg-purple-50 text-purple-700 border border-purple-100' : 'bg-blue-50 text-blue-700 border border-blue-100'
                }`}>
                  {u.rol}
                </span>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100 pl-1">
                <button 
                  onClick={() => toggleActive(u)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                    u.activo 
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100' 
                      : 'bg-red-50 text-red-700 border border-red-100 hover:bg-red-100'
                  }`}
                >
                  {u.activo ? 'Activo' : 'Inactivo'}
                </button>

                <button 
                  onClick={() => setUserToDelete(u)}
                  disabled={u.id === user?.id}
                  className="text-xs font-bold text-red-500 hover:text-red-700 disabled:opacity-30 transition-colors px-3 py-1.5 rounded-xl border border-red-100 hover:bg-red-50"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
          {users.length === 0 && (
            <div className="text-center py-8 text-slate-500 text-sm bg-white border border-slate-200 rounded-2xl">Ningún administrador encontrado.</div>
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {userToDelete && (
        <div className='fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm'>
          <div className='transition-opacity transition-transform bg-white rounded-2xl shadow-2xl border border-slate-100 p-8 w-full max-w-sm fade-in zoom-in duration-200 text-center'>
            <div className='w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 mx-auto mb-4'>
              <Trash2 size={32} />
            </div>
            <h3 className='text-lg font-black text-slate-800 mb-2'>¿Eliminar administrador?</h3>
            <p className='text-sm text-slate-500 mb-6'>
              Estás a punto de eliminar a <span className='font-bold text-slate-700'>{userToDelete.email}</span>. Perderá todo acceso al panel administrativo.
            </p>
            
            <div className='flex flex-col gap-2'>
              <button
                type='button'
                disabled={saving}
                onClick={confirmDelete}
                className='w-full py-3 bg-rose-500 text-white rounded-xl text-sm font-black hover:bg-rose-600 disabled:opacity-50 shadow-lg shadow-rose-500/25 transition-colors transition-opacity flex items-center justify-center gap-2'
              >
                {saving ? <Loader2 size={18} className='animate-spin' /> : <Trash2 size={18} />}
                Confirmar Eliminación
              </button>
              <button 
                type='button' 
                onClick={() => setUserToDelete(null)} 
                className='w-full py-3 text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors'
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}


      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="transition-opacity transition-transform bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden relative fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
               <div>
                 <h3 className="text-lg font-bold text-slate-800">Registrar Administrador</h3>
                 <p className="text-xs text-slate-500 font-medium tracking-wide">Crea una nueva credencial segura</p>
               </div>
               <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
               </button>
            </div>
            
            <form onSubmit={handleCreate} className="p-6 space-y-4">
               <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 ml-1">Correo Electrónico</label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={e => setNewEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-[#00D084]/20 focus:border-[#00D084] focus:bg-white transition-colors placeholder:text-slate-400 text-slate-800"
                    placeholder="ejemplo@ciebo.org.ve"
                  />
               </div>
               
               <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 ml-1">Contraseña</label>
                  <div className="relative flex items-center">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      className="w-full pl-4 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-[#00D084]/20 focus:border-[#00D084] focus:bg-white transition-colors placeholder:text-slate-400 text-slate-800"
                      placeholder="Min. 6 caracteres"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 text-slate-300 hover:text-[#00D084] focus:outline-none transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
               </div>

               <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 ml-1">Asignar Rol</label>
                  <select 
                     value={newRol} 
                     onChange={e => setNewRol(e.target.value)}
                     className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-[#00D084]/20 focus:border-[#00D084] focus:bg-white transition-colors text-slate-800"
                  >
                     <option value="admin">Administrador Regular</option>
                     <option value="super_admin">[Peligro] Super Administrador</option>
                  </select>
               </div>

               <div className="pt-2">
                 <button type="submit" className="w-full py-3.5 bg-[#00D084] hover:bg-emerald-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-500/20 transition-colors transition-transform hover:-translate-y-0.5">
                   Crear Credencial
                 </button>
               </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default SuperAdminUsersPanel
