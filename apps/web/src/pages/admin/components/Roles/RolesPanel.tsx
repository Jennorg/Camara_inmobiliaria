import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, Save, ShieldAlert, Trash2 } from 'lucide-react'
import { API_URL } from '@/config/env'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'

const ACCIONES = ['ver', 'crear', 'editar', 'eliminar'] as const
type Accion = (typeof ACCIONES)[number]
type Fila = Record<Accion, boolean>
type Matriz = Record<string, Fila>
interface Seccion { id: string; label: string }
interface Rol { id: number; clave: string; nombre: string; es_sistema: number; usuarios: number; permisos: Partial<Matriz> }

const ETIQUETA: Record<Accion, string> = { ver: 'Ver', crear: 'Crear', editar: 'Editar', eliminar: 'Eliminar' }
const vacia = (): Fila => ({ ver: false, crear: false, editar: false, eliminar: false })
// Matriz completa (todas las secciones) para comparar y enviar siempre el mismo formato.
const completa = (secs: Seccion[], p: Partial<Matriz>): Matriz =>
  Object.fromEntries(secs.map(s => [s.id, { ...vacia(), ...p[s.id] }]))

const FOCO = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1'
const CHECK = `h-4 w-4 rounded border-slate-300 accent-emerald-600 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 ${FOCO}`

const RolesPanel = () => {
  const { authHeaders, puede } = useAuth()
  const toast = useToast()
  const [secciones, setSecciones] = useState<Seccion[]>([])
  const [roles, setRoles] = useState<Rol[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selId, setSelId] = useState<number | null>(null)
  const [draft, setDraft] = useState<Matriz>({})
  const [nombre, setNombre] = useState('')
  const [saving, setSaving] = useState(false)
  const [nuevo, setNuevo] = useState<string | null>(null) // null = formulario cerrado
  const [confirmando, setConfirmando] = useState(false)

  const permitido = puede('roles', 'ver')
  const sel = roles.find(r => r.id === selId) ?? null

  const cargar = useCallback(async (seleccionar?: number) => {
    try {
      const [rs, rr] = await Promise.all([
        fetch(`${API_URL}/api/roles/secciones`, { headers: authHeaders }).then(r => r.json()),
        fetch(`${API_URL}/api/roles`, { headers: authHeaders }).then(r => r.json()),
      ])
      if (!rs.success || !rr.success) throw new Error(rs.message || rr.message || 'Error al cargar los roles')
      setSecciones(rs.data.map((x: { id: string; etiqueta: string }) => ({ id: x.id, label: x.etiqueta })))
      setRoles(rr.data)
      setSelId(prev => seleccionar ?? (rr.data.some((r: Rol) => r.id === prev) ? prev : (rr.data[0]?.id ?? null)))
      setError('')
    } catch (e: any) {
      setError(e?.message || 'Error de conexión al cargar los roles')
    } finally {
      setLoading(false)
    }
  }, [authHeaders])

  useEffect(() => { if (permitido) cargar(); else setLoading(false) }, [permitido, cargar])

  // Reinicia el borrador al cambiar de rol o recargar los datos guardados.
  useEffect(() => {
    if (!sel) return
    setDraft(completa(secciones, sel.permisos))
    setNombre(sel.nombre)
  }, [sel, secciones])

  const original = useMemo(() => (sel ? JSON.stringify(completa(secciones, sel.permisos)) : ''), [sel, secciones])
  const sucio = !!sel && (JSON.stringify(draft) !== original || nombre.trim() !== sel.nombre)
  const sistema = sel?.es_sistema === 1

  const fijar = (ids: string[], accion: Accion, valor: boolean) =>
    setDraft(d => {
      const n = { ...d }
      for (const id of ids) {
        const f = { ...n[id], [accion]: valor }
        if (accion === 'ver' && !valor) { f.crear = f.editar = f.eliminar = false }
        // Marcar crear/editar/eliminar implica poder ver.
        if (accion !== 'ver' && valor) f.ver = true
        n[id] = f
      }
      return n
    })
  const fijarFila = (id: string, valor: boolean) =>
    setDraft(d => ({ ...d, [id]: { ver: valor, crear: valor, editar: valor, eliminar: valor } }))
  const columna = (a: Accion) => draft && secciones.length > 0 && secciones.every(s => draft[s.id]?.[a])

  const seleccionar = (id: number) => {
    if (id === selId) return
    if (sucio && !window.confirm('Tienes cambios sin guardar. ¿Descartarlos?')) return
    setSelId(id)
  }

  const llamar = async (url: string, method: string, body?: unknown) => {
    const res = await fetch(`${API_URL}/api/roles${url}`, {
      method,
      headers: { ...authHeaders, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.success) throw new Error(data.message || 'Error al procesar la solicitud')
    return data
  }

  const guardar = async () => {
    if (!sel || !nombre.trim()) return toast.error('El nombre del rol no puede quedar vacío')
    setSaving(true)
    try {
      await llamar(`/${sel.id}`, 'PUT', sistema ? { permisos: draft } : { nombre: nombre.trim(), permisos: draft })
      toast.success('Rol guardado')
      await cargar(sel.id)
    } catch (e: any) { toast.error('No se pudo guardar', e.message) } finally { setSaving(false) }
  }

  const crear = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nuevo?.trim() || saving) return
    setSaving(true)
    try {
      const data = await llamar('', 'POST', { nombre: nuevo.trim(), permisos: {} })
      toast.success('Rol creado')
      setNuevo(null)
      await cargar(data.data.id)
    } catch (e: any) { toast.error('No se pudo crear el rol', e.message) } finally { setSaving(false) }
  }

  const eliminar = async () => {
    if (!sel) return
    setSaving(true)
    try {
      await llamar(`/${sel.id}`, 'DELETE')
      toast.success('Rol eliminado')
      setConfirmando(false)
      setSelId(null)
      await cargar()
    } catch (e: any) { toast.error('No se pudo eliminar', e.message); setConfirmando(false) } finally { setSaving(false) }
  }

  if (!permitido) {
    return (
      <div role="alert" className="flex flex-1 items-center justify-center gap-2 p-8 text-slate-500">
        <ShieldAlert size={20} /> Acceso denegado
      </div>
    )
  }
  if (loading) return <div className="flex flex-1 items-center justify-center p-8 text-slate-500"><Loader2 className="mr-2 animate-spin" size={18} /> Cargando roles...</div>
  if (error) {
    return (
      <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-slate-600">
        <p>{error}</p>
        <button type="button" onClick={() => { setLoading(true); cargar() }} className={`rounded-xl bg-slate-800 px-4 py-2 text-sm font-bold text-white ${FOCO}`}>Reintentar</button>
      </div>
    )
  }

  const bloqueoBorrado = sistema ? 'Los roles del sistema no se pueden eliminar' : (sel?.usuarios ?? 0) > 0 ? 'El rol tiene usuarios asignados; quítaselo antes de eliminarlo' : ''

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-white md:flex-row">
      {/* Lista de roles */}
      <aside className="flex max-h-[40%] shrink-0 flex-col border-b border-slate-100 md:max-h-none md:w-72 md:border-b-0 md:border-r">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-4">
          <h2 className="text-lg font-bold tracking-tight text-slate-800">Roles y permisos</h2>
          <button type="button" onClick={() => setNuevo('')} className={`flex items-center gap-1 rounded-xl bg-[#00D084] px-3 py-2 text-sm font-bold text-white hover:bg-emerald-500 ${FOCO}`}>
            <Plus size={16} aria-hidden="true" /> Nuevo rol
          </button>
        </div>
        {nuevo !== null && (
          <form onSubmit={crear} className="flex gap-2 border-b border-slate-100 p-3">
            <input
              autoFocus aria-label="Nombre del nuevo rol" placeholder="Nombre del rol" value={nuevo} maxLength={60}
              onChange={e => setNuevo(e.target.value)} onKeyDown={e => e.key === 'Escape' && setNuevo(null)}
              className={`min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm ${FOCO}`}
            />
            <button type="submit" disabled={saving || !nuevo.trim()} className={`rounded-lg bg-slate-800 px-3 text-sm font-bold text-white disabled:opacity-40 ${FOCO}`}>Crear</button>
          </form>
        )}
        <ul className="flex-1 overflow-y-auto p-2" aria-label="Roles">
          {roles.map(r => (
            <li key={r.id}>
              <button
                type="button" onClick={() => seleccionar(r.id)} aria-current={r.id === selId ? 'true' : undefined}
                className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm ${FOCO} ${r.id === selId ? 'bg-emerald-50 font-bold text-emerald-800' : 'text-slate-700 hover:bg-slate-50'}`}
              >
                <span className="min-w-0 truncate">{r.nombre}</span>
                <span className="flex shrink-0 items-center gap-2 text-xs text-slate-500">
                  {r.es_sistema === 1 && <span className="rounded-full border border-purple-100 bg-purple-50 px-2 py-0.5 font-bold text-purple-700">Sistema</span>}
                  <span>{r.usuarios} {r.usuarios === 1 ? 'usuario' : 'usuarios'}</span>
                </span>
              </button>
            </li>
          ))}
          {roles.length === 0 && <li className="p-4 text-sm text-slate-500">Aún no hay roles. Crea el primero con «Nuevo rol».</li>}
        </ul>
      </aside>

      {/* Matriz */}
      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        {!sel ? (
          <div className="flex flex-1 items-center justify-center p-8 text-slate-500">Selecciona un rol para editar sus permisos</div>
        ) : (
          <>
            <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0 flex-1 sm:max-w-sm">
                <label htmlFor="rol-nombre" className="text-xs font-bold uppercase tracking-wider text-slate-500">Nombre del rol</label>
                <input
                  id="rol-nombre" value={nombre} onChange={e => setNombre(e.target.value)} disabled={sistema} maxLength={60}
                  className={`mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 disabled:bg-slate-50 ${FOCO}`}
                />
                {sistema && <p className="mt-1 text-xs text-slate-500">El nombre de un rol del sistema no se puede cambiar.</p>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span role="status" className="min-w-[9rem] text-xs font-bold text-amber-600">{sucio ? 'Cambios sin guardar' : ''}</span>
                <button type="button" onClick={guardar} disabled={!sucio || saving} className={`flex items-center gap-1.5 rounded-xl bg-[#00D084] px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-40 ${FOCO}`}>
                  {saving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Save size={16} aria-hidden="true" />} Guardar
                </button>
                <button
                  type="button" onClick={() => setConfirmando(true)} disabled={!!bloqueoBorrado || saving} title={bloqueoBorrado || undefined}
                  aria-describedby={bloqueoBorrado ? 'rol-borrado-aviso' : undefined}
                  className={`flex items-center gap-1.5 rounded-xl border border-rose-200 px-4 py-2 text-sm font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-40 ${FOCO}`}
                >
                  <Trash2 size={16} aria-hidden="true" /> Eliminar
                </button>
              </div>
              {bloqueoBorrado && <p id="rol-borrado-aviso" className="text-xs text-slate-500">{bloqueoBorrado}</p>}
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-4">
              <table className="w-full min-w-[34rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                    <th scope="col" className="px-3 py-3 text-left font-bold">Sección</th>
                    {ACCIONES.map(a => (
                      <th key={a} scope="col" className="px-3 py-3 text-center font-bold">
                        <label className="flex cursor-pointer flex-col items-center gap-1.5">
                          {ETIQUETA[a]}
                          <input type="checkbox" className={CHECK} checked={columna(a)} aria-label={`Marcar todo: ${ETIQUETA[a]}`}
                            onChange={e => fijar(secciones.map(s => s.id), a, e.target.checked)} />
                        </label>
                      </th>
                    ))}
                    <th scope="col" className="px-3 py-3 text-center font-bold">Fila</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {secciones.map(s => {
                    const f = draft[s.id] ?? vacia()
                    return (
                      <tr key={s.id} className="hover:bg-slate-50/50">
                        <th scope="row" className="px-3 py-2.5 text-left font-semibold text-slate-700">{s.label}</th>
                        {ACCIONES.map(a => (
                          <td key={a} className="px-3 py-2.5 text-center">
                            <input type="checkbox" className={CHECK} checked={f[a]} disabled={a !== 'ver' && !f.ver}
                              aria-label={`${ETIQUETA[a]} — ${s.label}`} onChange={e => fijar([s.id], a, e.target.checked)} />
                          </td>
                        ))}
                        <td className="px-3 py-2.5 text-center">
                          <input type="checkbox" className={CHECK} checked={ACCIONES.every(a => f[a])} aria-label={`Marcar fila — ${s.label}`}
                            onChange={e => fijarFila(s.id, e.target.checked)} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {confirmando && sel && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm" onKeyDown={e => e.key === 'Escape' && setConfirmando(false)}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="rol-del-t" aria-describedby="rol-del-d" className="w-full max-w-sm rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-2xl">
            <h3 id="rol-del-t" className="mb-2 text-lg font-black text-slate-800">¿Eliminar rol?</h3>
            <p id="rol-del-d" className="mb-6 text-sm text-slate-500">Se eliminará el rol <b className="text-slate-700">{sel.nombre}</b> y todos sus permisos.</p>
            <div className="flex flex-col gap-2">
              <button type="button" disabled={saving} onClick={eliminar} className={`flex w-full items-center justify-center gap-2 rounded-xl bg-rose-500 py-3 text-sm font-black text-white hover:bg-rose-600 disabled:opacity-50 ${FOCO}`}>
                {saving ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Trash2 size={18} aria-hidden="true" />} Confirmar eliminación
              </button>
              <button type="button" autoFocus onClick={() => setConfirmando(false)} className={`w-full rounded-xl py-3 text-sm font-bold text-slate-500 hover:text-slate-700 ${FOCO}`}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RolesPanel
