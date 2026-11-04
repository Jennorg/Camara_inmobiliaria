import { useState } from 'react'
import { FileText, Loader2, Plus, Trash2, X } from 'lucide-react'
import { etiquetaDocumento } from '@/utils/formatters'
import { uploadFileStorage } from '@/pages/admin/components/Cms/CmsShared'
import { API_URL } from '@/config/env'

interface Props {
  programa: string
  authHeaders: Record<string, string>
  onCerrar: () => void
  onCreado: (tipo: 'educacion' | 'afiliacion') => void
}

const TIPOS_SOPORTE = ['cv', 'titulo', 'registro_mercantil', 'rif_empresa', 'titulo_representante', 'especializacion', 'curso_extra', 'diplomado', 'referencia_afiliado_1', 'referencia_afiliado_2', 'otro_documento']
const MAX_MB = 15
const NIVELES = ['Bachiller', 'TSU', 'Nivel Profesional', 'Postgrado']
const CAMPO = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'

const Campo = ({ id, etiqueta, children, ancho }: { id: string; etiqueta: string; children: React.ReactNode; ancho?: string }) => (
  <div className={ancho}>
    <label htmlFor={id} className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">{etiqueta}</label>
    {children}
  </div>
)

/** Agrega manualmente a una persona a un programa con cohortes (queda como Preinscrito). */
export default function AgregarInscritoModal({ programa, authHeaders, onCerrar, onCreado }: Props) {
  const [tipo, setTipo] = useState<'educacion' | 'afiliacion'>('educacion')
  const [f, setF] = useState({ nombres: '', apellidos: '', pref: 'V', ced: '', email: '', tel: '', nivel: 'Nivel Profesional' })
  const [error, setError] = useState<string | null>(null)
  const [conExpediente, setConExpediente] = useState(false)
  const [docs, setDocs] = useState<{ tipo: string; file: File | null }[]>([{ tipo: 'cv', file: null }])
  const [creado, setCreado] = useState(false) // el registro ya existe; solo faltan soportes por reintentar desde la ficha
  const [guardando, setGuardando] = useState(false)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF(v => ({ ...v, [k]: e.target.value }))

  const cerrar = () => (creado ? onCreado(tipo) : onCerrar())

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!f.nombres.trim() || !f.apellidos.trim() || !f.ced.trim()) { setError('Nombres, apellidos y cédula son obligatorios'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) { setError('Escribe un correo válido'); return }
    const adjuntos = conExpediente ? docs.filter(d => d.file) : []
    if (adjuntos.some(d => d.file!.size > MAX_MB * 1024 * 1024)) { setError(`Cada soporte debe pesar menos de ${MAX_MB} MB`); return }
    setGuardando(true); setError(null)
    try {
      const resp = await fetch(`${API_URL}/api/academia/inscripciones/manual`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          programa_codigo: programa, tipo_registro: tipo, nombres: f.nombres.trim(), apellidos: f.apellidos.trim(), cedulaRif: `${f.pref || 'V'}-${f.ced.trim()}`,
          email: f.email.trim(), telefono: f.tel.trim(), nivelProfesional: f.nivel,
        }),
      })
      const j = await resp.json().catch(() => null)
      if (!resp.ok || !j?.success) throw new Error(j?.message || 'No se pudo agregar el inscrito')
      // Expediente opcional: sin soportes la solicitud queda en "Sin expediente"
      const fallidos: string[] = []
      for (const d of adjuntos) {
        try {
          const url = await uploadFileStorage(d.file!, 'expedientes')
          const r2 = await fetch(`${API_URL}/api/academia/estudiantes/${j.data.id_estudiante}/documentos`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders },
            body: JSON.stringify({ tipo_doc: d.tipo, url, nombre_archivo: d.file!.name }),
          })
          if (!r2.ok) throw new Error()
        } catch { fallidos.push(d.file!.name) }
      }
      if (fallidos.length) {
        setCreado(true); setGuardando(false)
        setError(`El inscrito se registró, pero no se pudieron subir: ${fallidos.join(', ')}. Agrégalos desde su ficha.`)
        return
      }
      onCreado(tipo)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo agregar el inscrito')
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={guardando ? undefined : cerrar}>
      <form role="dialog" aria-modal="true" aria-label={`Agregar inscrito a ${programa}`} onSubmit={guardar} noValidate
        className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div>
            <h3 className="text-base font-black text-slate-900">Agregar inscrito</h3>
            <p className="mt-0.5 text-xs text-slate-500">Se registra en <b className="text-slate-700">{programa}</b> como preinscrito, sin cohorte: la eliges después desde su ficha.</p>
          </div>
          <button type="button" onClick={cerrar} disabled={guardando} aria-label="Cerrar" className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"><X size={16} aria-hidden="true" /></button>
        </div>

        <div className="grid grid-cols-1 gap-x-3 gap-y-3 overflow-y-auto px-5 py-4 sm:grid-cols-2">
          {programa === 'CIBIR' && (
            <fieldset className="sm:col-span-2">
              <legend className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">Tipo de registro</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {([
                  ['educacion', 'Solo el CIBIR', 'Cursa el CIBIR como educación, sin afiliarse.'],
                  ['afiliacion', 'CIBIR y afiliación', 'Flujo regular: expediente, entrevista, CIBIR y luego afiliado.'],
                ] as const).map(([valor, titulo, detalle]) => (
                  <label key={valor} className={`flex cursor-pointer flex-col rounded-xl border px-3 py-2 transition-colors ${tipo === valor ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:bg-slate-50'}`}>
                    <span className="flex items-center gap-2 text-sm font-bold text-slate-800">
                      <input type="radio" name="tipo-registro" value={valor} checked={tipo === valor} onChange={() => setTipo(valor)} className="accent-emerald-600" />
                      {titulo}
                    </span>
                    <span className="mt-0.5 pl-6 text-[11px] text-slate-500">{detalle}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <Campo id="ai-nombres" etiqueta="Nombres"><input id="ai-nombres" autoFocus autoComplete="off" value={f.nombres} onChange={set('nombres')} className={CAMPO} /></Campo>
          <Campo id="ai-apellidos" etiqueta="Apellidos"><input id="ai-apellidos" autoComplete="off" value={f.apellidos} onChange={set('apellidos')} className={CAMPO} /></Campo>
          <Campo id="ai-ced" etiqueta="Cédula">
            <div className="flex gap-2">
              <select aria-label="Tipo de documento" value={f.pref} onChange={set('pref')} className={`${CAMPO} !w-20 shrink-0`}>
                {['V', 'E', 'P'].map(t => <option key={t}>{t}</option>)}
              </select>
              <input id="ai-ced" inputMode="numeric" autoComplete="off" value={f.ced} onChange={set('ced')} placeholder="12345678" className={CAMPO} />
            </div>
          </Campo>
          <Campo id="ai-tel" etiqueta="Teléfono"><input id="ai-tel" type="tel" autoComplete="off" value={f.tel} onChange={set('tel')} placeholder="0414-0000000" className={CAMPO} /></Campo>
          <Campo id="ai-email" etiqueta="Correo" ancho="sm:col-span-2"><input id="ai-email" type="email" autoComplete="off" value={f.email} onChange={set('email')} placeholder="correo@ejemplo.com" className={CAMPO} /></Campo>
          <Campo id="ai-nivel" etiqueta="Nivel académico" ancho="sm:col-span-2">
            <select id="ai-nivel" value={f.nivel} onChange={set('nivel')} className={CAMPO}>{NIVELES.map(n => <option key={n}>{n}</option>)}</select>
          </Campo>
          <div className="sm:col-span-2 rounded-xl border border-gray-200">
            <label className="flex cursor-pointer items-start gap-2.5 px-3 py-2.5">
              <input type="checkbox" checked={conExpediente} onChange={e => setConExpediente(e.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-600" />
              <span>
                <span className="block text-sm font-bold text-slate-800">Cargar el expediente ahora</span>
                <span className="block text-[11px] text-slate-500">Mínimo: currículum (empresas: currículum, registro mercantil y RIF). Si no lo marcas, queda «Sin expediente» y los soportes se agregan después.</span>
              </span>
            </label>
            {conExpediente && (
              <div className="space-y-2 border-t border-gray-100 px-3 py-3">
                {docs.map((d, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <select aria-label="Tipo de soporte" value={d.tipo} onChange={e => setDocs(v => v.map((x, k) => k === i ? { ...x, tipo: e.target.value } : x))} className={`${CAMPO} !w-44 shrink-0`}>
                      {TIPOS_SOPORTE.map(t => <option key={t} value={t}>{etiquetaDocumento(t)}</option>)}
                    </select>
                    <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-gray-300 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50">
                      <FileText size={14} className="shrink-0 text-slate-400" aria-hidden="true" />
                      <span className="truncate">{d.file ? d.file.name : 'Elegir archivo (imagen o PDF)'}</span>
                      <input type="file" accept="image/*,application/pdf" className="sr-only" onChange={e => { const file = e.target.files?.[0] ?? null; setDocs(v => v.map((x, k) => k === i ? { ...x, file } : x)) }} />
                    </label>
                    <button type="button" aria-label="Quitar soporte" onClick={() => setDocs(v => v.length > 1 ? v.filter((_, k) => k !== i) : [{ tipo: 'cv', file: null }])} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} aria-hidden="true" /></button>
                  </div>
                ))}
                <button type="button" onClick={() => setDocs(v => [...v, { tipo: 'otro_documento', file: null }])} className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-emerald-700 hover:text-emerald-900"><Plus size={12} aria-hidden="true" /> Otro soporte</button>
              </div>
            )}
          </div>
          {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 sm:col-span-2">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-3">
          <button type="button" onClick={cerrar} disabled={guardando} className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">{creado ? 'Cerrar' : 'Cancelar'}</button>
          <button type="submit" disabled={guardando || creado} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black uppercase tracking-wider text-white hover:bg-emerald-700 disabled:opacity-60">
            {guardando && <Loader2 size={13} className="animate-spin" aria-hidden="true" />}
            {guardando ? 'Agregando…' : 'Agregar inscrito'}
          </button>
        </div>
      </form>
    </div>
  )
}
