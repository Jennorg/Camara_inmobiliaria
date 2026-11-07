import { useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import { FolderCog, Globe, Lock, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/pages/admin/components/Cms/CmsShared'

export interface SeccionNormativa {
  id: number
  nombre: string
  slug: string
  orden: number
  publica: number | boolean
  total: number
}

const esPublica = (s: SeccionNormativa) => s.publica === 1 || s.publica === true
const FOCO = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1'
const error = (e: unknown, def: string) => toast.error(e instanceof Error && e.message ? e.message : def)

/** Gestión de las secciones (categorías) del Marco Legal: crear, renombrar, pública/privada y eliminar. */
export function SeccionesMarcoLegal({ secciones, onCambio }: { secciones: SeccionNormativa[]; onCambio: () => void }) {
  const { puede } = useAuth()
  const [abierto, setAbierto] = useState(false)
  const [nuevo, setNuevo] = useState({ nombre: '', publica: true })
  const [editando, setEditando] = useState<{ id: number; nombre: string } | null>(null)
  const [aBorrar, setABorrar] = useState<SeccionNormativa | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const ejecutar = async (accion: () => Promise<unknown>, ok: string, def: string) => {
    if (ocupado) return false
    setOcupado(true)
    try {
      await accion()
      toast.success(ok)
      onCambio()
      return true
    } catch (e) {
      error(e, def)
      return false
    } finally {
      setOcupado(false)
    }
  }

  const crear = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nuevo.nombre.trim()) return toast.error('Escribe el nombre de la sección')
    if (await ejecutar(() => api.post('/api/cms/normativas-secciones', { nombre: nuevo.nombre.trim(), publica: nuevo.publica }), 'Sección creada', 'No se pudo crear la sección')) {
      setNuevo({ nombre: '', publica: true })
    }
  }
  const renombrar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editando) return
    if (await ejecutar(() => api.put(`/api/cms/normativas-secciones/${editando.id}`, { nombre: editando.nombre.trim() }), 'Sección renombrada', 'No se pudo renombrar la sección')) {
      setEditando(null)
    }
  }
  const alternar = (s: SeccionNormativa) =>
    ejecutar(() => api.put(`/api/cms/normativas-secciones/${s.id}`, { publica: !esPublica(s) }), esPublica(s) ? 'La sección ahora es privada' : 'La sección ahora es pública', 'No se pudo cambiar la visibilidad')
  const borrar = async () => {
    if (!aBorrar) return
    if (await ejecutar(() => api.delete(`/api/cms/normativas-secciones/${aBorrar.id}`), 'Sección eliminada', 'No se pudo eliminar la sección')) setABorrar(null)
  }

  const puedeCrear = puede('marco_legal', 'crear')
  const puedeEditar = puede('marco_legal', 'editar')
  const puedeEliminar = puede('marco_legal', 'eliminar')

  return (
    <section aria-labelledby="secciones-marco-legal" className="bg-white rounded-2xl border border-slate-200/80 shadow-xs">
      <button
        type="button"
        onClick={() => setAbierto(a => !a)}
        aria-expanded={abierto}
        aria-controls="secciones-marco-legal-contenido"
        className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl text-left cursor-pointer hover:bg-slate-50 ${FOCO}`}
      >
        <span id="secciones-marco-legal" className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-700">
          <FolderCog size={16} className="text-emerald-600" aria-hidden /> Secciones ({secciones.length})
        </span>
        <span className="text-[11px] font-bold text-slate-400">{abierto ? 'Ocultar' : 'Gestionar secciones'}</span>
      </button>

      {abierto && (
        <div id="secciones-marco-legal-contenido" className="px-4 pb-4 space-y-3">
          <p className="text-[11px] text-slate-500">
            En la web solo aparecen las secciones <strong>públicas</strong> que tengan al menos un documento visible. Las privadas solo se ven aquí.
          </p>

          {puedeCrear && (
            <form onSubmit={crear} className="flex flex-wrap items-end gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
                <label htmlFor="nueva-seccion-nombre" className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Nueva sección</label>
                <input
                  id="nueva-seccion-nombre"
                  value={nuevo.nombre}
                  maxLength={80}
                  onChange={e => setNuevo(n => ({ ...n, nombre: e.target.value }))}
                  placeholder="Ej. Circulares"
                  className={`text-sm rounded-xl border border-gray-200 px-3 py-2 bg-white text-slate-700 ${FOCO}`}
                />
              </div>
              <label className="flex items-center gap-2 text-xs font-bold text-slate-600 py-2 cursor-pointer">
                <input
                  type="checkbox"
                  role="switch"
                  checked={nuevo.publica}
                  onChange={e => setNuevo(n => ({ ...n, publica: e.target.checked }))}
                  className={`w-4 h-4 accent-emerald-600 cursor-pointer ${FOCO}`}
                />
                Pública
              </label>
              <button
                type="submit"
                disabled={ocupado}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold disabled:opacity-50 cursor-pointer ${FOCO}`}
              >
                <Plus size={14} aria-hidden /> Crear sección
              </button>
            </form>
          )}

          <ul className="divide-y divide-slate-100" aria-label="Secciones del Marco Legal">
            {secciones.map(s => {
              const motivoBorrar = s.total > 0 ? `No se puede eliminar: tiene ${s.total} documento${s.total === 1 ? '' : 's'}. Muévelos o elimínalos primero.` : ''
              return (
                <li key={s.id} data-testid={`seccion-${s.slug}`} className="flex flex-wrap items-center gap-2 py-2">
                  {editando?.id === s.id ? (
                    <form onSubmit={renombrar} className="flex flex-1 flex-wrap items-center gap-2 min-w-0">
                      <label htmlFor={`renombrar-${s.id}`} className="sr-only">Nuevo nombre de {s.nombre}</label>
                      <input
                        id={`renombrar-${s.id}`}
                        autoFocus
                        maxLength={80}
                        value={editando.nombre}
                        onChange={e => setEditando({ id: s.id, nombre: e.target.value })}
                        className={`flex-1 min-w-[160px] text-sm rounded-xl border border-gray-200 px-3 py-1.5 ${FOCO}`}
                      />
                      <button type="submit" disabled={ocupado} className={`px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold disabled:opacity-50 cursor-pointer ${FOCO}`}>Guardar</button>
                      <button type="button" onClick={() => setEditando(null)} className={`p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer ${FOCO}`} aria-label="Cancelar cambio de nombre">
                        <X size={14} aria-hidden />
                      </button>
                    </form>
                  ) : (
                    <>
                      <span className="flex-1 min-w-0 text-sm font-bold text-slate-800 truncate" title={s.nombre}>{s.nombre}</span>
                      <span className="text-[11px] font-bold text-slate-400">{s.total} doc.</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider border ${esPublica(s) ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                        {esPublica(s) ? <Globe size={10} aria-hidden /> : <Lock size={10} aria-hidden />}
                        {esPublica(s) ? 'Pública' : 'Privada'}
                      </span>
                      {puedeEditar && (
                        <>
                          <button
                            type="button"
                            disabled={ocupado}
                            onClick={() => alternar(s)}
                            aria-label={esPublica(s) ? `Hacer privada «${s.nombre}»` : `Hacer pública «${s.nombre}»`}
                            className={`px-2 py-1 rounded-lg text-[11px] font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-50 cursor-pointer ${FOCO}`}
                          >
                            {esPublica(s) ? 'Hacer privada' : 'Hacer pública'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditando({ id: s.id, nombre: s.nombre })}
                            className={`p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 cursor-pointer ${FOCO}`}
                            aria-label={`Renombrar «${s.nombre}»`}
                            title="Renombrar sección"
                          >
                            <Pencil size={14} aria-hidden />
                          </button>
                        </>
                      )}
                      {puedeEliminar && (
                        <>
                          <button
                            type="button"
                            disabled={s.total > 0 || ocupado}
                            onClick={() => setABorrar(s)}
                            aria-label={`Eliminar «${s.nombre}»`}
                            aria-describedby={motivoBorrar ? `motivo-borrar-${s.id}` : undefined}
                            title={motivoBorrar || 'Eliminar sección'}
                            className={`p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-400 cursor-pointer ${FOCO}`}
                          >
                            <Trash2 size={14} aria-hidden />
                          </button>
                          {motivoBorrar && <span id={`motivo-borrar-${s.id}`} className="sr-only">{motivoBorrar}</span>}
                        </>
                      )}
                    </>
                  )}
                </li>
              )
            })}
            {secciones.length === 0 && <li className="py-3 text-xs text-slate-400">Todavía no hay secciones.</li>}
          </ul>
        </div>
      )}

      {aBorrar && createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="borrar-seccion-titulo" className="bg-white rounded-2xl shadow-2xl border border-slate-100 p-8 w-full max-w-sm text-center">
            <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 mx-auto mb-4">
              <Trash2 size={32} aria-hidden />
            </div>
            <h3 id="borrar-seccion-titulo" className="text-lg font-black text-slate-800 mb-2">¿Eliminar sección?</h3>
            <p className="text-sm text-slate-500 mb-6">
              Se eliminará la sección <span className="font-bold text-slate-700">{aBorrar.nombre}</span> del Marco Legal. Esta acción no se puede deshacer.
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={ocupado}
                onClick={borrar}
                className={`w-full py-3 bg-rose-500 text-white rounded-xl text-sm font-black hover:bg-rose-600 disabled:opacity-50 cursor-pointer ${FOCO}`}
              >
                Confirmar eliminación
              </button>
              <button type="button" onClick={() => setABorrar(null)} className={`w-full py-3 text-sm font-bold text-slate-500 hover:text-slate-700 cursor-pointer ${FOCO}`}>
                Cancelar
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </section>
  )
}
