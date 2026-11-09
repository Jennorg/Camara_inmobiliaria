import { useCallback, useEffect, useRef, useState } from 'react'
import { ArchiveRestore, DatabaseBackup, Download, Loader2, ShieldAlert, Trash2, Upload } from 'lucide-react'
import { API_URL } from '@/config/env'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'

type Tipo = 'manual' | 'automatico' | 'previo_restauracion'
interface Respaldo { id: number; tipo: Tipo; creado_en: string; creado_por: string | null; tablas: number; filas: number; bytes: number }
interface Resumen { generado_en: string; tablas: number; filas: number }
// Qué se va a restaurar: un archivo subido o un respaldo del historial
type Origen = { tipo: 'archivo'; archivo: File } | { tipo: 'historial'; id: number }

const ETIQUETA_TIPO: Record<Tipo, string> = { manual: 'Manual', automatico: 'Automático', previo_restauracion: 'Previo a restauración' }
const PALABRA = 'RESTAURAR'
const FOCO = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1'
const BOTON = `inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer ${FOCO}`
const BOTON_ICONO = `inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 hover:text-emerald-700 cursor-pointer ${FOCO}`

const fecha = (iso: string) => {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)} ${p(d.getHours())}:${p(d.getMinutes())}`
}
const tamano = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)

/** Guarda un Blob como archivo descargado. */
const guardarArchivo = (blob: Blob, nombre: string) => {
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: nombre })
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
const nombreDe = (r: Response, defecto: string) => /filename="([^"]+)"/.exec(r.headers.get('Content-Disposition') ?? '')?.[1] ?? defecto

const RespaldosPanel = () => {
  const { authHeaders, puede } = useAuth()
  const toast = useToast()
  const permitido = puede('respaldos', 'ver')
  const entrada = useRef<HTMLInputElement>(null)

  const [almacenamiento, setAlmacenamiento] = useState(false)
  const [respaldos, setRespaldos] = useState<Respaldo[]>([])
  const [conservar, setConservar] = useState<Record<Tipo, number> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [generando, setGenerando] = useState(false)
  const [validando, setValidando] = useState(false)
  // Confirmación de restauración
  const [origen, setOrigen] = useState<Origen | null>(null)
  const [resumen, setResumen] = useState<Resumen | null>(null)
  const [palabra, setPalabra] = useState('')
  const [restaurando, setRestaurando] = useState(false)
  const [eliminando, setEliminando] = useState<number | null>(null)

  const cargar = useCallback(async () => {
    try {
      const r = await fetch(`${API_URL}/api/respaldos`, { headers: authHeaders }).then(x => x.json())
      if (!r.success) throw new Error(r.message || 'Error al cargar los respaldos')
      setAlmacenamiento(r.data.almacenamiento); setRespaldos(r.data.respaldos); setConservar(r.data.conservar); setError('')
    } catch (e: any) {
      setError(e?.message || 'Error de conexión al cargar los respaldos')
    } finally {
      setLoading(false)
    }
  }, [authHeaders])
  useEffect(() => { if (permitido) cargar(); else setLoading(false) }, [permitido, cargar])

  const generar = async () => {
    setGenerando(true)
    try {
      const r = await fetch(`${API_URL}/api/respaldos/generar`, { method: 'POST', headers: authHeaders })
      if (!r.ok) throw new Error((await r.json().catch(() => null))?.message || 'No se pudo generar el respaldo')
      guardarArchivo(await r.blob(), nombreDe(r, 'ciebo-respaldo.zip'))
      toast.success(almacenamiento ? 'Respaldo generado, descargado y guardado en el historial' : 'Respaldo generado y descargado')
      cargar()
    } catch (e: any) { toast.error(e?.message || 'No se pudo generar el respaldo') } finally { setGenerando(false) }
  }

  const descargar = async (id: number) => {
    try {
      const r = await fetch(`${API_URL}/api/respaldos/${id}/descargar`, { headers: authHeaders })
      if (!r.ok) throw new Error((await r.json().catch(() => null))?.message || 'No se pudo descargar')
      guardarArchivo(await r.blob(), nombreDe(r, `ciebo-respaldo-${id}.zip`))
    } catch (e: any) { toast.error(e?.message || 'No se pudo descargar el respaldo') }
  }

  const eliminar = async (id: number) => {
    if (!window.confirm('¿Eliminar este respaldo del historial? Esta acción no se puede deshacer.')) return
    setEliminando(id)
    try {
      const r = await fetch(`${API_URL}/api/respaldos/${id}`, { method: 'DELETE', headers: authHeaders }).then(x => x.json())
      if (!r.success) throw new Error(r.message)
      toast.success('Respaldo eliminado'); cargar()
    } catch (e: any) { toast.error(e?.message || 'No se pudo eliminar') } finally { setEliminando(null) }
  }

  // Paso 1: validar el archivo y mostrar qué contiene antes de pedir confirmación
  const elegirArchivo = async (archivo: File | undefined) => {
    if (!archivo) return
    setValidando(true)
    try {
      const r = await fetch(`${API_URL}/api/respaldos/validar`, { method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/octet-stream' }, body: archivo }).then(x => x.json())
      if (!r.success) throw new Error(r.message || 'El archivo no es un respaldo válido')
      setResumen(r.data); setOrigen({ tipo: 'archivo', archivo }); setPalabra('')
    } catch (e: any) { toast.error(e?.message || 'No se pudo leer el archivo') } finally { setValidando(false); if (entrada.current) entrada.current.value = '' }
  }
  const elegirGuardado = (r: Respaldo) => { setResumen({ generado_en: r.creado_en, tablas: r.tablas, filas: r.filas }); setOrigen({ tipo: 'historial', id: r.id }); setPalabra('') }
  const cerrar = () => { if (!restaurando) { setOrigen(null); setResumen(null); setPalabra('') } }

  // Paso 2: restaurar. El servidor guarda y devuelve un respaldo del estado actual, que se descarga de inmediato.
  const restaurar = async () => {
    if (!origen || palabra !== PALABRA) return
    setRestaurando(true)
    try {
      const r = origen.tipo === 'archivo'
        ? await fetch(`${API_URL}/api/respaldos/restaurar`, { method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/octet-stream', 'X-Confirmacion': PALABRA }, body: origen.archivo })
        : await fetch(`${API_URL}/api/respaldos/${origen.id}/restaurar`, { method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmacion: PALABRA }) })
      const j = await r.json()
      if (!j.success) throw new Error(j.message || 'No se pudo restaurar')
      const { respaldo_previo: previo } = j.data
      guardarArchivo(new Blob([Uint8Array.from(atob(previo.contenido), c => c.charCodeAt(0))], { type: 'application/zip' }), previo.nombre)
      toast.success(`Restauración completa: ${j.data.filas.toLocaleString('es-VE')} registros en ${j.data.tablas} tablas. Se descargó un respaldo del estado anterior.`)
      setOrigen(null); setResumen(null); setPalabra(''); cargar()
    } catch (e: any) { toast.error(e?.message || 'No se pudo restaurar') } finally { setRestaurando(false) }
  }

  if (!permitido) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-slate-600">
        <div><ShieldAlert className="mx-auto mb-3 text-slate-500" size={36} /><p className="font-bold text-slate-800">Acceso restringido</p><p className="text-sm">Solo el súper administrador gestiona los respaldos.</p></div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6 lg:p-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-black tracking-tight text-[#022c22]"><DatabaseBackup size={26} className="text-emerald-600" /> Respaldos</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">Copias de seguridad de todos los datos de la plataforma. Cada respaldo se descarga a tu equipo y, si el historial está activo, también se conserva aquí.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={entrada} type="file" accept=".zip,.gz,.json,application/zip,application/gzip,application/json" className="hidden" onChange={e => elegirArchivo(e.target.files?.[0])} />
          <button type="button" onClick={() => entrada.current?.click()} disabled={validando} className={`${BOTON} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}>
            {validando ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} Restaurar desde un archivo
          </button>
          <button type="button" onClick={generar} disabled={generando} className={`${BOTON} bg-emerald-600 text-white hover:bg-emerald-700`}>
            {generando ? <Loader2 size={16} className="animate-spin" /> : <DatabaseBackup size={16} />} Generar respaldo ahora
          </button>
        </div>
      </header>

      {!almacenamiento && !loading && !error && (
        <div className="mb-6 rounded-xl bg-slate-100 px-5 py-4 text-sm text-slate-700">
          <strong className="text-slate-900">El historial no está activo.</strong> Puedes generar y restaurar respaldos con archivos. Para conservarlos aquí y activar el respaldo diario automático, configura la base de respaldo (<code className="rounded bg-white px-1.5 py-0.5 text-xs">BACKUP_DATABASE_URL</code>) en el servidor.
        </div>
      )}
      {almacenamiento && conservar && (
        <p className="mb-4 text-sm text-slate-600">Se conservan los últimos {conservar.automatico} automáticos (uno por día), {conservar.manual} manuales y {conservar.previo_restauracion} previos a una restauración.</p>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-10 text-slate-600"><Loader2 size={18} className="animate-spin" /> Cargando…</div>
      ) : error ? (
        <p className="rounded-xl bg-slate-100 px-5 py-4 text-sm text-slate-700">{error}</p>
      ) : almacenamiento && (
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600">
              <tr><th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Registros</th><th className="px-4 py-3">Tamaño</th><th className="px-4 py-3">Creado por</th><th className="px-4 py-3 text-right">Acciones</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {respaldos.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-600">Aún no hay respaldos guardados. Genera el primero con «Generar respaldo ahora».</td></tr>}
              {respaldos.map(r => (
                <tr key={r.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-bold tabular-nums text-slate-800">{fecha(r.creado_en)}</td>
                  <td className="px-4 py-3"><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800">{ETIQUETA_TIPO[r.tipo]}</span></td>
                  <td className="px-4 py-3 tabular-nums text-slate-700">{r.filas.toLocaleString('es-VE')} <span className="text-slate-500">· {r.tablas} tablas</span></td>
                  <td className="px-4 py-3 tabular-nums text-slate-700">{tamano(r.bytes)}</td>
                  <td className="px-4 py-3 text-slate-700">{r.creado_por ?? 'Sistema'}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button type="button" title="Descargar" aria-label="Descargar respaldo" onClick={() => descargar(r.id)} className={BOTON_ICONO}><Download size={16} /></button>
                      <button type="button" title="Restaurar este respaldo" aria-label="Restaurar este respaldo" onClick={() => elegirGuardado(r)} className={BOTON_ICONO}><ArchiveRestore size={16} /></button>
                      <button type="button" title="Eliminar" aria-label="Eliminar respaldo" disabled={eliminando === r.id} onClick={() => eliminar(r.id)} className={BOTON_ICONO}>{eliminando === r.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {origen && resumen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="titulo-restaurar">
          <div className="absolute inset-0 bg-[#022c22]/60" aria-hidden="true" onClick={cerrar} />
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <h3 id="titulo-restaurar" className="text-xl font-black text-[#022c22]">Restaurar este respaldo</h3>
            <p className="mt-2 text-sm text-slate-700">Respaldo del <strong>{fecha(resumen.generado_en)}</strong> con <strong>{resumen.filas.toLocaleString('es-VE')} registros</strong> en {resumen.tablas} tablas.</p>
            <div className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-bold">Esto reemplaza TODOS los datos actuales.</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                <li>Todo lo registrado después de esa fecha se perderá.</li>
                <li>Antes de restaurar se genera un respaldo del estado actual y se descarga a tu equipo.</li>
                <li>Si algo falla, no se modifica ningún dato.</li>
              </ul>
            </div>
            <label htmlFor="confirmar-restaurar" className="mt-5 block text-sm font-bold text-slate-800">Escribe <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono">{PALABRA}</span> para confirmar</label>
            <input id="confirmar-restaurar" value={palabra} onChange={e => setPalabra(e.target.value)} autoComplete="off" autoFocus disabled={restaurando}
              className={`mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 font-mono text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20`} />
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={cerrar} disabled={restaurando} className={`${BOTON} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}>Cancelar</button>
              <button type="button" onClick={restaurar} disabled={palabra !== PALABRA || restaurando} className={`${BOTON} bg-[#022c22] text-white hover:bg-[#04432f]`}>
                {restaurando ? <Loader2 size={16} className="animate-spin" /> : <ArchiveRestore size={16} />} {restaurando ? 'Restaurando…' : 'Restaurar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RespaldosPanel
