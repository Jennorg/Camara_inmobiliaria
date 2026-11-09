import { Fragment, useCallback, useEffect, useState } from 'react'
import { ArchiveRestore, ChevronDown, ChevronRight, ClipboardList, Loader2, ShieldAlert, Trash2 } from 'lucide-react'
import { API_URL } from '@/config/env'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'

interface Registro {
  id: number; creado_en: string; email: string | null; nombre_usuario: string | null; rol: string | null; suplantado_por: number | null
  accion: string; modulo: string | null; entidad: string | null; id_entidad: string | null; resumen: string | null; antes: string | null; despues: string | null; ip: string | null
}
interface Filtros { acciones: string[]; modulos: string[]; usuarios: string[] }
interface ItemPapelera { tipo: string; etiqueta: string; id: number | string; nombre: string; eliminado_en: string; eliminado_por: string | null }

const ACCION: Record<string, string> = {
  crear: 'Creó', editar: 'Editó', eliminar: 'Eliminó', eliminar_definitivo: 'Eliminó definitivamente', restaurar: 'Restauró', aprobar: 'Aprobó',
  rechazar: 'Rechazó', verificar: 'Verificó', cambiar_etapa: 'Cambió de etapa', remitir: 'Remitió', finalizar: 'Finalizó', reordenar: 'Reordenó',
  generar: 'Generó', suplantar: 'Suplantó', cobrar: 'Cobró', cerrar: 'Cerró', asignar: 'Asignó', anular: 'Anuló', agendar: 'Agendó',
}
const nombreAccion = (a: string) => ACCION[a] ?? a.charAt(0).toUpperCase() + a.slice(1).replace(/_/g, ' ')
const FOCO = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1'
const SELECT = `rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 cursor-pointer`
const BOTON = `inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer ${FOCO}`
const BOTON_ICONO = `inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 hover:text-emerald-700 cursor-pointer disabled:opacity-50 ${FOCO}`
const POR_PAGINA = 50

const fecha = (iso: string) => {
  const d = new Date(iso); const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** Muestra un JSON guardado (antes/después) como lista de «campo: valor». */
const Datos = ({ titulo, json }: { titulo: string; json: string | null }) => {
  if (!json) return null
  let v: any; try { v = JSON.parse(json) } catch { return null }
  const texto = (x: unknown) => (x === null || x === undefined ? '—' : typeof x === 'object' ? JSON.stringify(x) : String(x))
  const filas: [string, string][] = Array.isArray(v) ? v.map((x, i) => [`#${i + 1}`, texto(x)]) : Object.entries(v).map(([k, x]) => [k, texto(x)])
  return (
    <div className="min-w-0 flex-1">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-600">{titulo}</p>
      <dl className="space-y-1 text-xs">
        {filas.map(([k, x]) => <div key={k} className="grid grid-cols-[9rem_1fr] gap-2"><dt className="truncate font-semibold text-slate-600">{k}</dt><dd className="break-words text-slate-800">{x}</dd></div>)}
      </dl>
    </div>
  )
}

const AuditoriaPanel = () => {
  const { authHeaders, puede } = useAuth()
  const toast = useToast()
  const permitido = puede('auditoria', 'ver')
  const [pestana, setPestana] = useState<'auditoria' | 'papelera'>('auditoria')

  // Auditoría
  const [filtros, setFiltros] = useState<Filtros>({ acciones: [], modulos: [], usuarios: [] })
  const [f, setF] = useState({ usuario: '', accion: '', modulo: '', desde: '', hasta: '' })
  const [pagina, setPagina] = useState(1)
  const [registros, setRegistros] = useState<Registro[]>([])
  const [total, setTotal] = useState(0)
  const [abierto, setAbierto] = useState<number | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  // Papelera
  const [tipo, setTipo] = useState('')
  const [items, setItems] = useState<ItemPapelera[]>([])
  const [tipos, setTipos] = useState<Record<string, string>>({})
  const [cargandoP, setCargandoP] = useState(false)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [aBorrar, setABorrar] = useState<ItemPapelera | null>(null)
  const [palabra, setPalabra] = useState('')

  const cargarAuditoria = useCallback(async () => {
    setCargando(true)
    try {
      const qs = new URLSearchParams({ pagina: String(pagina), porPagina: String(POR_PAGINA), ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)) })
      const r = await fetch(`${API_URL}/api/auditoria?${qs}`, { headers: authHeaders }).then(x => x.json())
      if (!r.success) throw new Error(r.message || 'Error al cargar la auditoría')
      setRegistros(r.data); setTotal(r.total); setError('')
    } catch (e: any) { setError(e?.message || 'Error de conexión al cargar la auditoría') } finally { setCargando(false) }
  }, [authHeaders, f, pagina])

  const cargarPapelera = useCallback(async () => {
    setCargandoP(true)
    try {
      const r = await fetch(`${API_URL}/api/auditoria/papelera${tipo ? `?tipo=${tipo}` : ''}`, { headers: authHeaders }).then(x => x.json())
      if (!r.success) throw new Error(r.message || 'Error al cargar la papelera')
      setItems(r.data); setTipos(r.tipos)
    } catch (e: any) { toast.error(e?.message || 'Error al cargar la papelera') } finally { setCargandoP(false) }
  }, [authHeaders, tipo, toast])

  useEffect(() => {
    if (!permitido) return
    fetch(`${API_URL}/api/auditoria/filtros`, { headers: authHeaders }).then(r => r.json()).then(r => r.success && setFiltros(r.data)).catch(() => { })
  }, [permitido, authHeaders])
  useEffect(() => { if (permitido && pestana === 'auditoria') cargarAuditoria() }, [permitido, pestana, cargarAuditoria])
  useEffect(() => { if (permitido && pestana === 'papelera') cargarPapelera() }, [permitido, pestana, cargarPapelera])

  const cambiar = (campo: keyof typeof f, valor: string) => { setF(x => ({ ...x, [campo]: valor })); setPagina(1); setAbierto(null) }
  const llave = (i: ItemPapelera) => `${i.tipo}:${i.id}`

  const restaurar = async (i: ItemPapelera) => {
    setOcupado(llave(i))
    try {
      const r = await fetch(`${API_URL}/api/auditoria/papelera/${i.tipo}/${i.id}/restaurar`, { method: 'POST', headers: authHeaders }).then(x => x.json())
      if (!r.success) throw new Error(r.message)
      toast.success(`«${i.nombre}» restaurado`); cargarPapelera()
    } catch (e: any) { toast.error(e?.message || 'No se pudo restaurar') } finally { setOcupado(null) }
  }
  const eliminarDefinitivo = async () => {
    if (!aBorrar || palabra !== 'ELIMINAR') return
    setOcupado(llave(aBorrar))
    try {
      const r = await fetch(`${API_URL}/api/auditoria/papelera/${aBorrar.tipo}/${aBorrar.id}?confirmacion=ELIMINAR`, { method: 'DELETE', headers: authHeaders }).then(x => x.json())
      if (!r.success) throw new Error(r.message)
      toast.success('Eliminado definitivamente'); setABorrar(null); setPalabra(''); cargarPapelera()
    } catch (e: any) { toast.error(e?.message || 'No se pudo eliminar') } finally { setOcupado(null) }
  }

  if (!permitido) {
    return <div className="flex h-full items-center justify-center p-8 text-center text-slate-600"><div><ShieldAlert className="mx-auto mb-3 text-slate-500" size={36} /><p className="font-bold text-slate-800">Acceso restringido</p><p className="text-sm">Solo el súper administrador ve la auditoría y la papelera.</p></div></div>
  }

  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA))
  const TAB = (id: typeof pestana, texto: string) => (
    <button type="button" role="tab" aria-selected={pestana === id} onClick={() => setPestana(id)}
      className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors cursor-pointer ${FOCO} ${pestana === id ? 'bg-emerald-600 text-white' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'}`}>{texto}</button>
  )

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6 lg:p-8">
      <header className="mb-6">
        <h2 className="flex items-center gap-2 text-2xl font-black tracking-tight text-[#022c22]"><ClipboardList size={26} className="text-emerald-600" /> Auditoría y papelera</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">Quién hizo qué en la plataforma, y lo que se eliminó y aún se puede restaurar.</p>
        <div role="tablist" className="mt-4 flex gap-2">{TAB('auditoria', 'Auditoría')}{TAB('papelera', 'Papelera')}</div>
      </header>

      {pestana === 'auditoria' ? (
        <>
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <label className="text-xs font-bold text-slate-600">Usuario<select className={`${SELECT} mt-1 block`} value={f.usuario} onChange={e => cambiar('usuario', e.target.value)}><option value="">Todos</option>{filtros.usuarios.map(u => <option key={u}>{u}</option>)}</select></label>
            <label className="text-xs font-bold text-slate-600">Acción<select className={`${SELECT} mt-1 block`} value={f.accion} onChange={e => cambiar('accion', e.target.value)}><option value="">Todas</option>{filtros.acciones.map(a => <option key={a} value={a}>{nombreAccion(a)}</option>)}</select></label>
            <label className="text-xs font-bold text-slate-600">Módulo<select className={`${SELECT} mt-1 block`} value={f.modulo} onChange={e => cambiar('modulo', e.target.value)}><option value="">Todos</option>{filtros.modulos.map(m => <option key={m}>{m}</option>)}</select></label>
            <label className="text-xs font-bold text-slate-600">Desde<input type="date" className={`${SELECT} mt-1 block`} value={f.desde} onChange={e => cambiar('desde', e.target.value)} /></label>
            <label className="text-xs font-bold text-slate-600">Hasta<input type="date" className={`${SELECT} mt-1 block`} value={f.hasta} onChange={e => cambiar('hasta', e.target.value)} /></label>
          </div>

          {cargando ? <div className="flex items-center gap-2 py-10 text-slate-600"><Loader2 size={18} className="animate-spin" /> Cargando…</div>
            : error ? <p className="rounded-xl bg-slate-100 px-5 py-4 text-sm text-slate-700">{error}</p>
              : (
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600"><tr><th className="w-10 px-3 py-3" /><th className="px-3 py-3">Fecha</th><th className="px-3 py-3">Usuario</th><th className="px-3 py-3">Acción</th><th className="px-3 py-3">Detalle</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {registros.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-600">No hay registros con estos filtros.</td></tr>}
                      {registros.map(r => (
                        <Fragment key={r.id}>
                          <tr className="hover:bg-slate-50/60">
                            <td className="px-3 py-3">{(r.antes || r.despues) && <button type="button" aria-label={abierto === r.id ? 'Ocultar detalle' : 'Ver antes y después'} aria-expanded={abierto === r.id} onClick={() => setAbierto(abierto === r.id ? null : r.id)} className={`rounded p-1 text-slate-600 hover:bg-slate-100 cursor-pointer ${FOCO}`}>{abierto === r.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button>}</td>
                            <td className="whitespace-nowrap px-3 py-3 font-bold tabular-nums text-slate-800">{fecha(r.creado_en)}</td>
                            <td className="px-3 py-3 text-slate-700"><span className="font-semibold">{r.nombre_usuario || r.email || 'Sistema'}</span>{r.nombre_usuario && r.email ? <span className="block text-xs text-slate-500">{r.email}</span> : null}{r.suplantado_por ? <span className="mt-1 block text-[11px] font-bold text-amber-800">Sesión suplantada por el usuario #{r.suplantado_por}</span> : null}</td>
                            <td className="px-3 py-3"><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${r.accion === 'eliminar_definitivo' ? 'bg-slate-800 text-white' : 'bg-emerald-50 text-emerald-800'}`}>{nombreAccion(r.accion)}</span></td>
                            <td className="px-3 py-3 text-slate-700">{r.resumen}</td>
                          </tr>
                          {abierto === r.id && <tr><td /><td colSpan={4} className="bg-slate-50 px-3 py-4"><div className="flex flex-col gap-6 md:flex-row"><Datos titulo="Antes" json={r.antes} /><Datos titulo="Después" json={r.despues} /></div></td></tr>}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
          <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
            <span>{total.toLocaleString('es-VE')} registros</span>
            <div className="flex items-center gap-2">
              <button type="button" className={`${BOTON} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`} disabled={pagina <= 1} onClick={() => setPagina(p => p - 1)}>Anterior</button>
              <span className="tabular-nums">Página {pagina} de {paginas}</span>
              <button type="button" className={`${BOTON} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`} disabled={pagina >= paginas} onClick={() => setPagina(p => p + 1)}>Siguiente</button>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="mb-4"><label className="text-xs font-bold text-slate-600">Tipo<select className={`${SELECT} mt-1 block`} value={tipo} onChange={e => setTipo(e.target.value)}><option value="">Todos</option>{Object.entries(tipos).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label></div>
          {cargandoP ? <div className="flex items-center gap-2 py-10 text-slate-600"><Loader2 size={18} className="animate-spin" /> Cargando…</div> : (
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600"><tr><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Nombre</th><th className="px-4 py-3">Eliminado por</th><th className="px-4 py-3">Fecha</th><th className="px-4 py-3 text-right">Acciones</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {items.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-600">La papelera está vacía.</td></tr>}
                  {items.map(i => (
                    <tr key={llave(i)} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3"><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800">{i.etiqueta}</span></td>
                      <td className="px-4 py-3 font-semibold text-slate-800">{i.nombre}</td>
                      <td className="px-4 py-3 text-slate-700">{i.eliminado_por ?? '—'}</td>
                      <td className="px-4 py-3 font-bold tabular-nums text-slate-800">{fecha(i.eliminado_en)}</td>
                      <td className="px-4 py-3"><div className="flex justify-end gap-2">
                        <button type="button" title="Restaurar" aria-label={`Restaurar ${i.nombre}`} disabled={ocupado === llave(i)} onClick={() => restaurar(i)} className={BOTON_ICONO}>{ocupado === llave(i) ? <Loader2 size={16} className="animate-spin" /> : <ArchiveRestore size={16} />}</button>
                        <button type="button" title="Eliminar definitivamente" aria-label={`Eliminar definitivamente ${i.nombre}`} onClick={() => { setABorrar(i); setPalabra('') }} className={BOTON_ICONO}><Trash2 size={16} /></button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {aBorrar && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="titulo-borrar">
          <div className="absolute inset-0 bg-[#022c22]/60" aria-hidden="true" onClick={() => setABorrar(null)} />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 id="titulo-borrar" className="text-xl font-black text-[#022c22]">Eliminar definitivamente</h3>
            <p className="mt-2 text-sm text-slate-700">«<strong>{aBorrar.nombre}</strong>» se borrará para siempre y no se podrá restaurar. Quedará una copia de sus datos en la auditoría.</p>
            <label htmlFor="confirmar-borrar" className="mt-5 block text-sm font-bold text-slate-800">Escribe <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono">ELIMINAR</span> para confirmar</label>
            <input id="confirmar-borrar" value={palabra} onChange={e => setPalabra(e.target.value)} autoComplete="off" autoFocus className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 font-mono text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20" />
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setABorrar(null)} className={`${BOTON} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}>Cancelar</button>
              <button type="button" onClick={eliminarDefinitivo} disabled={palabra !== 'ELIMINAR' || ocupado !== null} className={`${BOTON} bg-[#022c22] text-white hover:bg-[#04432f]`}>{ocupado ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AuditoriaPanel
