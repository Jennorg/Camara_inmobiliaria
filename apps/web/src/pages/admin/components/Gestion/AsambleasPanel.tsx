import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, FileText, Gavel, Globe, Loader2, Plus, Trash2, Upload, Users, X } from 'lucide-react'
import Swal from 'sweetalert2'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import { API_URL } from '@/config/env'
import { apiFetch } from '@/lib/apiClient'
import { Skeleton } from '@/components/Skeleton'
import { uploadFileStorage } from '@/pages/admin/components/Cms/CmsShared'

type Tipo = 'Ordinaria' | 'Extraordinaria'
interface Asamblea {
  id_asamblea: number; tipo: Tipo; numero_acta: string | null; titulo: string; fecha: string; hora: string | null; lugar: string | null
  convocatoria: string | null; orden_del_dia: string | null; resumen: string | null; acuerdos: string | null; url_acta: string | null
  quorum_pct: number; total_miembros: number; publicada: number; asistentes: number; quorum_requeridos: number; quorum_alcanzado: boolean
}
interface Asistente { id_afiliado: number; codigo: string | null; nombre: string; documento: string | null; condicion: 'Presente' | 'Representado'; representante: string | null }
interface Detalle extends Asamblea { asistencia: Asistente[] }
interface AfiliadoBusqueda { id_afiliado: number; codigo: string | null; nombre: string; documento: string | null }

const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Caracas' })
const fechaLarga = (f: string) => new Date(`${f}T12:00:00`).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' })
const CAMPO = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'

const Etiqueta = ({ id, texto, children, ancho = '' }: { id: string; texto: string; children: React.ReactNode; ancho?: string }) => (
  <div className={ancho}>
    <label htmlFor={id} className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">{texto}</label>
    {children}
  </div>
)

const ChipTipo = ({ tipo }: { tipo: Tipo }) => (
  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${tipo === 'Extraordinaria' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{tipo}</span>
)

const Quorum = ({ a }: { a: Pick<Asamblea, 'asistentes' | 'total_miembros' | 'quorum_requeridos' | 'quorum_alcanzado'> }) => (
  <span className={`text-xs font-bold tabular-nums ${a.quorum_alcanzado ? 'text-emerald-700' : 'text-slate-500'}`}>
    {a.asistentes}/{a.total_miembros} · {a.quorum_alcanzado ? 'Quórum alcanzado' : `Faltan ${Math.max(0, a.quorum_requeridos - a.asistentes)}`}
  </span>
)

export default function AsambleasPanel() {
  const { authHeaders } = useAuth()
  const [lista, setLista] = useState<Asamblea[] | null>(null)
  const [tipo, setTipo] = useState('')
  const [anio, setAnio] = useState('')
  const [vista, setVista] = useState<number | 'nueva' | null>(null)

  const cargar = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ ...(tipo && { tipo }), ...(anio && { anio }) })
      const r = await apiFetch<{ data: Asamblea[] }>(`${API_URL}/api/asambleas?${qs}`, { headers: authHeaders })
      setLista(r.data)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'No se pudieron cargar las asambleas'); setLista([]) }
  }, [authHeaders, tipo, anio])
  useEffect(() => { cargar() }, [cargar])

  const anios = useMemo(() => [...new Set((lista ?? []).map(a => a.fecha.slice(0, 4)))].sort().reverse(), [lista])

  if (vista !== null) return <Ficha id={vista} onVolver={() => { setVista(null); cargar() }} onCreada={id => setVista(id)} />

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4 sm:p-6">
      <header>
        <h1 className="text-lg font-black text-slate-800">Gestión de Asambleas</h1>
        <p className="text-xs text-slate-500">Actas, asistencia y quórum de las asambleas ordinarias y extraordinarias.</p>
      </header>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          <Etiqueta id="f-tipo" texto="Tipo">
            <select id="f-tipo" value={tipo} onChange={e => setTipo(e.target.value)} className={`${CAMPO} !w-44`}>
              <option value="">Todas</option><option value="Ordinaria">Ordinarias</option><option value="Extraordinaria">Extraordinarias</option>
            </select>
          </Etiqueta>
          <Etiqueta id="f-anio" texto="Año">
            <select id="f-anio" value={anio} onChange={e => setAnio(e.target.value)} className={`${CAMPO} !w-32`}>
              <option value="">Todos</option>
              {anio && !anios.includes(anio) && <option value={anio}>{anio}</option>}
              {anios.map(a => <option key={a}>{a}</option>)}
            </select>
          </Etiqueta>
          {(tipo || anio) && <button type="button" onClick={() => { setTipo(''); setAnio('') }} className="self-end pb-2 text-[11px] font-bold text-emerald-700 hover:underline">Limpiar filtros</button>}
        </div>
        <button type="button" onClick={() => setVista('nueva')} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black uppercase tracking-wider text-white hover:bg-emerald-700">
          <Plus size={14} aria-hidden="true" /> Nueva asamblea
        </button>
      </div>

      {lista === null ? (
        <div role="status" aria-label="Cargando asambleas" className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)}</div>
      ) : lista.length === 0 ? (
        <div className="flex flex-col items-center rounded-3xl border-2 border-dashed border-emerald-200 bg-gradient-to-b from-emerald-50/60 to-white px-6 py-14 text-center">
          <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 shadow-sm"><Gavel size={30} aria-hidden="true" /></span>
          {tipo || anio ? (
            <>
              <h2 className="text-base font-black text-slate-800">Sin resultados para estos filtros</h2>
              <p className="mt-1 max-w-sm text-sm text-slate-500">Prueba con otro tipo o año para ver más asambleas.</p>
              <button type="button" onClick={() => { setTipo(''); setAnio('') }} className="mt-5 rounded-xl border border-emerald-300 bg-white px-4 py-2 text-xs font-black uppercase tracking-wider text-emerald-700 hover:bg-emerald-50">Limpiar filtros</button>
            </>
          ) : (
            <>
              <h2 className="text-base font-black text-slate-800">Aún no hay asambleas registradas</h2>
              <p className="mt-1 max-w-md text-sm text-slate-500">Archiva las actas de asambleas ordinarias y extraordinarias, registra la asistencia de los miembros y controla el quórum. Las que publiques aparecerán en Actas de Asamblea del sitio.</p>
              <ul className="mt-5 flex flex-wrap justify-center gap-2 text-[11px] font-bold text-slate-600">
                {[[FileText, 'Acta en PDF'], [Users, 'Asistencia y quórum'], [Globe, 'Publicación opcional']].map(([Icono, txt]) => {
                  const I = Icono as typeof FileText
                  return <li key={txt as string} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1"><I size={12} className="text-emerald-600" aria-hidden="true" />{txt as string}</li>
                })}
              </ul>
              <button type="button" onClick={() => setVista('nueva')} className="mt-6 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-sm hover:bg-emerald-700">
                <Plus size={14} aria-hidden="true" /> Registrar la primera asamblea
              </button>
            </>
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {lista.map(a => (
            <li key={a.id_asamblea}>
              <button type="button" onClick={() => setVista(a.id_asamblea)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition-colors hover:border-emerald-400">
                <span className="w-24 shrink-0 text-xs font-bold tabular-nums text-slate-500">{fechaLarga(a.fecha)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-black text-slate-800">{a.titulo}</span>
                  <span className="block text-[11px] text-slate-500">{a.numero_acta ? `Acta N° ${a.numero_acta}` : 'Sin número de acta'}{a.lugar ? ` · ${a.lugar}` : ''}</span>
                </span>
                <ChipTipo tipo={a.tipo} />
                <Quorum a={a} />
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${a.publicada ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>{a.publicada ? 'Publicada' : 'Interna'}</span>
                {a.url_acta && <FileText size={14} className="text-slate-400" aria-label="Tiene acta en PDF" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const VACIA = { tipo: 'Ordinaria' as Tipo, numero_acta: '', titulo: '', fecha: hoy(), hora: '', lugar: '', convocatoria: '', orden_del_dia: '', resumen: '', acuerdos: '', url_acta: '', quorum_pct: 50, total_miembros: '' as number | '', publicada: false }

function Ficha({ id, onVolver, onCreada }: { id: number | 'nueva'; onVolver: () => void; onCreada: (id: number) => void }) {
  const { authHeaders } = useAuth()
  const nueva = id === 'nueva'
  const [det, setDet] = useState<Detalle | null>(null)
  const [f, setF] = useState(VACIA)
  const [guardando, setGuardando] = useState(false)
  const [subiendo, setSubiendo] = useState(false)

  const cargar = useCallback(async () => {
    if (nueva) {
      // Sugiere como total los afiliados activos de hoy; se puede ajustar
      apiFetch<{ data: { total: number } }>(`${API_URL}/api/asambleas/miembros`, { headers: authHeaders }).then(r => setF(v => ({ ...v, total_miembros: r.data.total }))).catch(() => {})
      return
    }
    try {
      const r = await apiFetch<{ data: Detalle }>(`${API_URL}/api/asambleas/${id}`, { headers: authHeaders })
      setDet(r.data)
      setF({ ...VACIA, ...Object.fromEntries(Object.entries(r.data).map(([k, v]) => [k, v ?? ''])) as any, publicada: !!r.data.publicada })
    } catch (e) { toast.error(e instanceof Error ? e.message : 'No se pudo cargar la asamblea'); onVolver() }
  }, [id, nueva, authHeaders, onVolver])
  useEffect(() => { cargar() }, [cargar])

  const set = (k: keyof typeof VACIA) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF(v => ({ ...v, [k]: e.target.value }))

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!f.titulo.trim() || !f.fecha) { toast.error('El título y la fecha son obligatorios'); return }
    setGuardando(true)
    try {
      const body = JSON.stringify({ ...f, quorum_pct: Number(f.quorum_pct), total_miembros: f.total_miembros === '' ? undefined : Number(f.total_miembros) })
      const r = await apiFetch<{ data?: { id_asamblea: number } }>(nueva ? `${API_URL}/api/asambleas` : `${API_URL}/api/asambleas/${id}`, {
        method: nueva ? 'POST' : 'PUT', headers: { 'Content-Type': 'application/json', ...authHeaders }, body,
      })
      toast.success(nueva ? 'Asamblea creada: ahora puedes registrar la asistencia' : 'Cambios guardados')
      if (nueva && r.data) onCreada(r.data.id_asamblea); else cargar()
    } catch (err) { toast.error(err instanceof Error ? err.message : 'No se pudo guardar') }
    finally { setGuardando(false) }
  }

  const subirActa = async (file: File) => {
    if (file.size > 20 * 1024 * 1024) { toast.error('El archivo supera los 20 MB'); return }
    setSubiendo(true)
    try { setF(v => ({ ...v, url_acta: '' })); const url = await uploadFileStorage(file, 'actas', true); setF(v => ({ ...v, url_acta: url })); toast.success('Acta cargada: guarda para confirmar') }
    catch (e) { toast.error(e instanceof Error ? e.message : 'No se pudo subir el acta') }
    finally { setSubiendo(false) }
  }

  const eliminar = async () => {
    const c = await Swal.fire({ title: 'Eliminar asamblea', text: 'Se quita del listado y del sitio público. La asistencia registrada se conserva en la base de datos.', icon: 'warning', showCancelButton: true, confirmButtonText: 'Eliminar', cancelButtonText: 'Cancelar', confirmButtonColor: '#dc2626' })
    if (!c.isConfirmed) return
    try { await apiFetch(`${API_URL}/api/asambleas/${id}`, { method: 'DELETE', headers: authHeaders }); toast.success('Asamblea eliminada'); onVolver() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'No se pudo eliminar') }
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={onVolver} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900"><ArrowLeft size={14} aria-hidden="true" /> Volver al listado</button>
        {!nueva && <button type="button" onClick={eliminar} className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50"><Trash2 size={13} aria-hidden="true" /> Eliminar</button>}
      </div>

      <form onSubmit={guardar} noValidate className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-6">
        <h3 className="text-base font-black text-slate-900 sm:col-span-6">{nueva ? 'Nueva asamblea' : 'Datos de la asamblea'}</h3>
        <Etiqueta id="a-tipo" texto="Tipo" ancho="sm:col-span-2"><select id="a-tipo" value={f.tipo} onChange={set('tipo')} className={CAMPO}><option>Ordinaria</option><option>Extraordinaria</option></select></Etiqueta>
        <Etiqueta id="a-acta" texto="N° de acta" ancho="sm:col-span-2"><input id="a-acta" value={f.numero_acta} onChange={set('numero_acta')} className={CAMPO} /></Etiqueta>
        <Etiqueta id="a-fecha" texto="Fecha" ancho="sm:col-span-1"><input id="a-fecha" type="date" value={f.fecha} onChange={set('fecha')} className={CAMPO} /></Etiqueta>
        <Etiqueta id="a-hora" texto="Hora" ancho="sm:col-span-1"><input id="a-hora" type="time" value={f.hora} onChange={set('hora')} className={CAMPO} /></Etiqueta>
        <Etiqueta id="a-titulo" texto="Título" ancho="sm:col-span-4"><input id="a-titulo" value={f.titulo} onChange={set('titulo')} placeholder="Ej. Asamblea ordinaria anual 2026" className={CAMPO} /></Etiqueta>
        <Etiqueta id="a-lugar" texto="Lugar" ancho="sm:col-span-2"><input id="a-lugar" value={f.lugar} onChange={set('lugar')} className={CAMPO} /></Etiqueta>
        <Etiqueta id="a-quorum" texto="Quórum exigido (%)" ancho="sm:col-span-3"><input id="a-quorum" type="number" min={1} max={100} value={f.quorum_pct} onChange={set('quorum_pct')} className={CAMPO} /></Etiqueta>
        <Etiqueta id="a-miembros" texto="Miembros con derecho a participar" ancho="sm:col-span-3"><input id="a-miembros" type="number" min={0} value={f.total_miembros} onChange={set('total_miembros')} className={CAMPO} /></Etiqueta>
        {([['convocatoria', 'Convocatoria'], ['orden_del_dia', 'Orden del día'], ['resumen', 'Resumen'], ['acuerdos', 'Acuerdos']] as const).map(([k, t]) => (
          <Etiqueta key={k} id={`a-${k}`} texto={t} ancho="sm:col-span-6"><textarea id={`a-${k}`} rows={3} value={f[k]} onChange={set(k)} className={CAMPO} /></Etiqueta>
        ))}

        <div className="sm:col-span-6">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Acta firmada (PDF)</span>
          <div className="flex flex-wrap items-center gap-2">
            <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-dashed border-gray-300 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 ${subiendo ? 'pointer-events-none opacity-60' : ''}`}>
              {subiendo ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Upload size={14} aria-hidden="true" />}
              {subiendo ? 'Subiendo…' : f.url_acta ? 'Reemplazar archivo' : 'Subir archivo'}
              <input type="file" accept="application/pdf,image/*" className="sr-only" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) subirActa(file) }} />
            </label>
            {f.url_acta && <a href={f.url_acta} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:underline"><FileText size={13} aria-hidden="true" /> Ver acta</a>}
            {f.url_acta && <button type="button" onClick={() => setF(v => ({ ...v, url_acta: '' }))} aria-label="Quitar acta" className="rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"><X size={14} aria-hidden="true" /></button>}
          </div>
        </div>

        <label className="flex items-start gap-2.5 sm:col-span-6">
          <input type="checkbox" checked={f.publicada} onChange={e => setF(v => ({ ...v, publicada: e.target.checked }))} className="mt-0.5 h-4 w-4 accent-emerald-600" />
          <span><span className="block text-sm font-bold text-slate-800">Publicar en el sitio</span><span className="block text-[11px] text-slate-500">Aparece en «Actas de Asamblea» del Marco Legal. Requiere el acta en PDF.</span></span>
        </label>
        <div className="flex justify-end sm:col-span-6">
          <button type="submit" disabled={guardando || subiendo} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-black uppercase tracking-wider text-white hover:bg-emerald-700 disabled:opacity-60">
            {guardando && <Loader2 size={13} className="animate-spin" aria-hidden="true" />} {nueva ? 'Crear asamblea' : 'Guardar cambios'}
          </button>
        </div>
      </form>

      {!nueva && det && <Asistencia det={det} recargar={cargar} />}
    </div>
  )
}

/** Pide el nombre de quien representa a un afiliado; devuelve null si se cancela */
async function pedirRepresentante(actual = ''): Promise<string | null> {
  const r = await Swal.fire({ title: '¿Quién lo representa?', input: 'text', inputValue: actual, inputAttributes: { 'aria-label': 'Nombre del representante' }, showCancelButton: true, confirmButtonText: 'Guardar', cancelButtonText: 'Cancelar', confirmButtonColor: '#059669', inputValidator: v => (v.trim() ? null : 'Escribe el nombre') })
  return r.isConfirmed ? String(r.value).trim() : null
}

function Asistencia({ det, recargar }: { det: Detalle; recargar: () => void }) {
  const { authHeaders } = useAuth()
  const [q, setQ] = useState('')
  const [res, setRes] = useState<AfiliadoBusqueda[]>([])
  const ya = useMemo(() => new Set(det.asistencia.map(a => a.id_afiliado)), [det.asistencia])

  useEffect(() => {
    if (q.trim().length < 2) { setRes([]); return }
    const t = setTimeout(() => {
      apiFetch<{ data: AfiliadoBusqueda[] }>(`${API_URL}/api/asambleas/afiliados?q=${encodeURIComponent(q)}`, { headers: authHeaders }).then(r => setRes(r.data)).catch(() => setRes([]))
    }, 250)
    return () => clearTimeout(t)
  }, [q, authHeaders])

  const registrar = async (idAfiliado: number, condicion: 'Presente' | 'Representado', representante?: string) => {
    try {
      await apiFetch(`${API_URL}/api/asambleas/${det.id_asamblea}/asistencia`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders }, body: JSON.stringify({ id_afiliado: idAfiliado, condicion, representante }) })
      setQ(''); setRes([]); recargar()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'No se pudo registrar') }
  }
  const quitar = async (idAfiliado: number) => {
    try { await apiFetch(`${API_URL}/api/asambleas/${det.id_asamblea}/asistencia/${idAfiliado}`, { method: 'DELETE', headers: authHeaders }); recargar() }
    catch (e) { toast.error(e instanceof Error ? e.message : 'No se pudo quitar') }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-black text-slate-900">Asistencia y quórum</h3>
        <Quorum a={det} />
      </div>
      <p className="mb-3 text-[11px] text-slate-500">Se necesitan {det.quorum_requeridos} de {det.total_miembros} miembros ({det.quorum_pct}%). Cuentan los presentes y los representados.</p>

      <div className="relative mb-3">
        <label htmlFor="as-buscar" className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Agregar asistente</label>
        <input id="as-buscar" value={q} onChange={e => setQ(e.target.value)} autoComplete="off" placeholder="Nombre, cédula, RIF o código de afiliado…" className={CAMPO} />
        {res.length > 0 && (
          <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-gray-100 bg-white py-1 shadow-xl">
            {res.map(a => (
              <li key={a.id_afiliado} className="flex flex-wrap items-center gap-2 px-3 py-2">
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-slate-800">{a.nombre}</span><span className="block text-[11px] text-slate-500">{a.codigo ?? 'Sin código'} · {a.documento ?? 'S/D'}</span></span>
                {ya.has(a.id_afiliado) ? <span className="text-[11px] font-bold text-slate-400">Ya registrado</span> : (
                  <>
                    <button type="button" onClick={() => registrar(a.id_afiliado, 'Presente')} className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-white hover:bg-emerald-700">Presente</button>
                    <button type="button" onClick={async () => { const r = await pedirRepresentante(); if (r) registrar(a.id_afiliado, 'Representado', r) }} className="rounded-lg border border-gray-200 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50">Representado</button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {det.asistencia.length === 0 ? <p className="py-4 text-center text-xs text-slate-400">Aún no hay asistentes registrados.</p> : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
          {det.asistencia.map(a => (
            <li key={a.id_afiliado} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-slate-800">{a.nombre}</span><span className="block text-[11px] text-slate-500">{a.codigo ?? 'Sin código'} · {a.documento ?? 'S/D'}{a.representante ? ` · Representado por ${a.representante}` : ''}</span></span>
              <select aria-label={`Condición de ${a.nombre}`} value={a.condicion} onChange={async e => {
                if (e.target.value === 'Presente') registrar(a.id_afiliado, 'Presente')
                else { const r = await pedirRepresentante(a.representante ?? ''); if (r) registrar(a.id_afiliado, 'Representado', r) }
              }} className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-bold text-slate-700"><option>Presente</option><option>Representado</option></select>
              <button type="button" onClick={() => quitar(a.id_afiliado)} aria-label={`Quitar a ${a.nombre}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} aria-hidden="true" /></button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
