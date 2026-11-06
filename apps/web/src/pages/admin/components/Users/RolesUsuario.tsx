import { useEffect, useId, useState } from 'react'
import { AlertTriangle, Loader2, ShieldCheck, UserPlus, X } from 'lucide-react'
import { toast } from 'sonner'
import { API_URL } from '@/config/env'
import { useAuth } from '@/context/AuthContext'

export interface RolCatalogo { clave: string; nombre: string; es_sistema: number }

// Roles que la gestión clásica de usuarios entiende; cualquier otro es personalizado.
const BASE = ['admin', 'super_admin', 'afiliado', 'estudiante', 'asistente', 'administrativo', 'secretario', 'secretaria', 'personal', 'personal_admin', 'personal_administrativo']
// Ya los representa la etiqueta de rol existente.
const EN_ETIQUETA = ['super_admin', 'admin', 'afiliado', 'asistente', 'administrativo']
const NIVEL_ADMIN = ['admin', 'super_admin']

export const tieneRolCustom = (roles?: string[]) => (roles ?? []).some(r => !BASE.includes(r))

/** Etiqueta de la columna Rol; el staff con rol personalizado no es «Afiliado». */
export const etiquetaRol = (u: { rol: string; roles?: string[] }) =>
  u.rol === 'super_admin' ? 'Super Admin'
    : u.rol === 'admin' ? 'Admin'
    : u.rol === 'asistente' || u.rol === 'administrativo' ? 'Personal Admin'
    : u.rol === 'personal' || (tieneRolCustom(u.roles) && !u.roles?.includes('afiliado')) ? 'Personal'
    : 'Afiliado'

const FOCO = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1'
const CHECK = `h-4 w-4 rounded border-slate-300 accent-emerald-600 cursor-pointer ${FOCO}`
const INPUT = 'w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus:border-emerald-400'

const nombreDe = (catalogo: RolCatalogo[], clave: string) =>
  clave === 'estudiante' ? 'Estudiante' : catalogo.find(r => r.clave === clave)?.nombre ?? clave

/** Chips con los roles que la etiqueta de rol no muestra. */
export function ChipsRoles({ roles, catalogo }: { roles?: string[]; catalogo: RolCatalogo[] }) {
  const extra = (roles ?? []).filter(r => !EN_ETIQUETA.includes(r))
  if (!extra.length) return null
  return (
    <span className='inline-flex flex-wrap gap-1 mt-1'>
      {extra.map(r => (
        <span key={r} className='px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200'>
          {nombreDe(catalogo, r)}
        </span>
      ))}
    </span>
  )
}

function Modal({ titulo, onClose, bloqueado, children }: { titulo: string; onClose: () => void; bloqueado: boolean; children: React.ReactNode }) {
  const id = useId()
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    return () => opener?.focus()
  }, [])
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape' && !bloqueado) onClose() }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [bloqueado, onClose])
  return (
    <div className='fixed -inset-10 z-[999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs'>
      <div role='dialog' aria-modal='true' aria-labelledby={id} className='bg-white rounded-2xl shadow-xl border border-slate-100 p-6 w-full max-w-md max-h-[85vh] overflow-y-auto'>
        <div className='flex items-start justify-between gap-3 mb-4'>
          <h3 id={id} className='font-bold text-slate-800'>{titulo}</h3>
          <button type='button' onClick={onClose} disabled={bloqueado} aria-label='Cerrar' className={`p-1 rounded-lg text-slate-400 hover:text-slate-700 disabled:opacity-50 ${FOCO}`}>
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function ListaRoles({ opciones, catalogo, marcados, onToggle, leyenda }: {
  opciones: string[]; catalogo: RolCatalogo[]; marcados: string[]; onToggle: (c: string) => void; leyenda: string
}) {
  return (
    <fieldset className='space-y-1.5'>
      <legend className='block text-xs font-semibold text-slate-500 mb-1'>{leyenda}</legend>
      {opciones.map(c => (
        <label key={c} className='flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer text-sm text-slate-700'>
          <input type='checkbox' className={CHECK} checked={marcados.includes(c)} onChange={() => onToggle(c)} />
          <span>{nombreDe(catalogo, c)}</span>
          {catalogo.find(r => r.clave === c)?.es_sistema === 1 && (
            <span className='px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase bg-slate-100 text-slate-500'>Sistema</span>
          )}
        </label>
      ))}
    </fieldset>
  )
}

const asignables = (catalogo: RolCatalogo[]) => catalogo.map(r => r.clave).filter(c => !NIVEL_ADMIN.includes(c))
const toggle = (xs: string[], c: string) => (xs.includes(c) ? xs.filter(x => x !== c) : [...xs, c])

export function AsignarRolesModal({ usuario, catalogo, onClose, onSaved }: {
  usuario: { id: number; email: string; roles?: string[] }; catalogo: RolCatalogo[]; onClose: () => void; onSaved: () => void
}) {
  const { authHeaders } = useAuth()
  const actuales = usuario.roles ?? []
  // estudiante no está en la tabla de roles pero el servidor lo acepta: se ofrece para no perderlo.
  const opciones = [...asignables(catalogo), 'estudiante']
  const [marcados, setMarcados] = useState(actuales.filter(r => opciones.includes(r)))
  const [saving, setSaving] = useState(false)
  const conservados = actuales.filter(r => r === 'afiliado' || r === 'admin')
  // Roles que ya no están en el catálogo (inactivos o borrados): el PUT los quitará.
  const huerfanos = actuales.filter(r => !opciones.includes(r) && r !== 'afiliado' && r !== 'admin')
  const sinSeleccion = huerfanos.length > 0 && marcados.length === 0

  const guardar = async () => {
    setSaving(true)
    try {
      const r = await fetch(`${API_URL}/api/roles/usuarios/${usuario.id}`, {
        method: 'PUT',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ roles: marcados }),
      })
      const d = await r.json().catch(() => null)
      if (!r.ok || !d?.success) throw new Error(d?.message || `Error ${r.status} al asignar los roles`)
      toast.success(`Roles de ${usuario.email} actualizados`)
      onSaved()
      onClose()
    } catch (e: any) {
      toast.error(e?.message || 'Error de conexión al asignar los roles')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal titulo={`Roles de ${usuario.email}`} onClose={onClose} bloqueado={saving}>
      <ListaRoles opciones={opciones} catalogo={catalogo} marcados={marcados} onToggle={c => setMarcados(m => toggle(m, c))} leyenda='Roles asignados' />
      {conservados.length > 0 && (
        <p className='mt-3 text-[11px] text-slate-500 leading-relaxed'>
          Se conservan automáticamente: {conservados.map(r => (r === 'admin' ? 'Admin' : 'Afiliado')).join(' y ')}.
          {conservados.includes('admin') && ' El rol Admin solo se quita desde el selector de rol.'}
        </p>
      )}
      {huerfanos.length > 0 && (
        <p className='mt-3 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2 leading-relaxed'>
          No están en la lista de roles y se quitarán al guardar: {huerfanos.join(', ')}.
          {sinSeleccion && ' Marca al menos un rol para poder guardar.'}
        </p>
      )}
      <div className='flex justify-end gap-3 mt-6'>
        <button type='button' onClick={onClose} disabled={saving} className={`px-5 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-50 rounded-xl ${FOCO}`}>
          Cancelar
        </button>
        <button type='button' onClick={guardar} disabled={saving || sinSeleccion} className={`px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black disabled:opacity-60 flex items-center gap-2 ${FOCO}`}>
          {saving ? <Loader2 size={14} className='animate-spin' /> : <ShieldCheck size={14} />}
          Guardar roles
        </button>
      </div>
    </Modal>
  )
}

export function NuevoStaffModal({ catalogo, onClose, onSaved }: { catalogo: RolCatalogo[]; onClose: () => void; onSaved: () => void }) {
  const { authHeaders } = useAuth()
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [roles, setRoles] = useState<string[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [sinCorreo, setSinCorreo] = useState<string | null>(null) // email creado cuya invitación falló

  const crear = async (e: React.FormEvent) => {
    e.preventDefault()
    const correo = email.trim()
    if (!nombre.trim()) return setError('Escribe el nombre.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return setError('Escribe un correo válido.')
    if (!roles.length) return setError('Marca al menos un rol.')
    setError('')
    setSaving(true)
    try {
      const r = await fetch(`${API_URL}/api/roles/staff`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nombre.trim(), email: correo, roles }),
      })
      const d = await r.json().catch(() => null)
      if (!r.ok || !d?.success) throw new Error(d?.message || `Error ${r.status} al crear el usuario`)
      onSaved()
      if (d.data?.invitacion_enviada === false) return setSinCorreo(correo)
      toast.success(`Usuario creado; se envió la invitación a ${correo}`)
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Error de conexión al crear el usuario')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal titulo='Nuevo usuario de staff' onClose={onClose} bloqueado={saving}>
      {sinCorreo ? (
        <div className='space-y-4'>
          <div role='alert' className='flex gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm'>
            <AlertTriangle size={18} className='shrink-0 text-amber-600' />
            <p>
              El usuario <strong>{sinCorreo}</strong> fue creado, pero falló el envío del correo de invitación.
              Puedes reenviarla con el botón «Invitar» de ese usuario.
            </p>
          </div>
          <div className='flex justify-end'>
            <button type='button' autoFocus onClick={onClose} className={`px-5 py-2.5 bg-slate-800 text-white rounded-xl text-xs font-black ${FOCO}`}>Entendido</button>
          </div>
        </div>
      ) : (
        <form onSubmit={crear} noValidate className='space-y-4'>
          <div>
            <label htmlFor='staff-nombre' className='block text-xs font-semibold text-slate-500 mb-1'>Nombre</label>
            <input id='staff-nombre' name='nombre' autoComplete='off' autoFocus value={nombre} onChange={e => setNombre(e.target.value)} className={INPUT} />
          </div>
          <div>
            <label htmlFor='staff-email' className='block text-xs font-semibold text-slate-500 mb-1'>Correo</label>
            <input id='staff-email' name='email' type='email' autoComplete='off' spellCheck={false} value={email} onChange={e => setEmail(e.target.value)} className={INPUT} />
          </div>
          <ListaRoles opciones={asignables(catalogo)} catalogo={catalogo} marcados={roles} onToggle={c => setRoles(m => toggle(m, c))} leyenda='Roles' />
          <p className='text-[10px] text-slate-400 italic'>Recibirá un correo para establecer su contraseña.</p>
          {error && <p role='alert' className='text-xs font-semibold text-rose-600'>{error}</p>}
          <div className='flex justify-end gap-3'>
            <button type='button' onClick={onClose} disabled={saving} className={`px-5 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-50 rounded-xl ${FOCO}`}>
              Cancelar
            </button>
            <button type='submit' disabled={saving} className={`px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black disabled:opacity-60 flex items-center gap-2 ${FOCO}`}>
              {saving ? <Loader2 size={14} className='animate-spin' /> : <UserPlus size={14} />}
              Crear usuario
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}
