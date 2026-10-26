import { useEffect, useState } from 'react'
import { Loader2, Plus, X } from 'lucide-react'
import { API_URL } from '@/config/env'

type Regla = { dia_semana: number; hora_inicio: string; hora_fin: string }

// Se muestra de lunes a domingo; el valor guardado es 0 = domingo … 6 = sábado
const DIAS = [
  { valor: 1, nombre: 'Lunes' }, { valor: 2, nombre: 'Martes' }, { valor: 3, nombre: 'Miércoles' }, { valor: 4, nombre: 'Jueves' },
  { valor: 5, nombre: 'Viernes' }, { valor: 6, nombre: 'Sábado' }, { valor: 0, nombre: 'Domingo' },
]
const orden = (d: number) => (d === 0 ? 7 : d)
const CAMPO = 'min-h-9 rounded-xl border border-gray-200 bg-white px-2 text-xs text-slate-700'

/** Editor de los días y horas en que la Cámara hace entrevistas (hora de Caracas); de ahí eligen los aspirantes. */
export default function DisponibilidadEntrevistasModal({ onCerrar, authHeaders }: { onCerrar: () => void; authHeaders: Record<string, string> }) {
  const [reglas, setReglas] = useState<Regla[]>([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  // Si la carga falló no se puede guardar: una lista vacía borraría la disponibilidad que ya existe
  const [falloCarga, setFalloCarga] = useState(false)

  useEffect(() => {
    let activo = true
    fetch(`${API_URL}/api/academia/agenda/disponibilidad`, { headers: { ...authHeaders } })
      .then(r => r.json())
      .then(j => {
        if (!activo) return
        if (j.success) setReglas(j.data)
        else { setFalloCarga(true); setError(j.message || 'No se pudo cargar la disponibilidad.') }
      })
      .catch(() => { if (activo) { setFalloCarga(true); setError('No se pudo cargar la disponibilidad.') } })
      .finally(() => { if (activo) setCargando(false) })
    return () => { activo = false }
  }, [authHeaders])

  const cambiar = (i: number, parcial: Partial<Regla>) => setReglas(rs => rs.map((r, k) => (k === i ? { ...r, ...parcial } : r)))

  const guardar = async () => {
    setGuardando(true)
    setError('')
    try {
      const res = await fetch(`${API_URL}/api/academia/agenda/disponibilidad`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ reglas }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'No se pudo guardar')
      onCerrar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar')
    } finally {
      setGuardando(false)
    }
  }

  const ordenadas = reglas.map((r, i) => ({ r, i })).sort((a, b) => orden(a.r.dia_semana) - orden(b.r.dia_semana) || a.r.hora_inicio.localeCompare(b.r.hora_inicio))

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 p-4" onClick={onCerrar}>
      <div role="dialog" aria-modal="true" aria-label="Mi disponibilidad para entrevistas" className="flex max-h-[85vh] w-full max-w-md flex-col rounded-3xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h3 className="text-sm font-black uppercase tracking-tight text-slate-900">Mi disponibilidad</h3>
            <p className="text-[11px] text-slate-500">Horario de Caracas. Las citas duran 30 minutos.</p>
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"><X size={16} aria-hidden="true" /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          {cargando ? (
            <div role="status" className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-slate-300" aria-label="Cargando" /></div>
          ) : ordenadas.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-500">Aún no hay horarios. Agrega los días y horas en que puedes entrevistar.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {ordenadas.map(({ r, i }) => (
                <li key={i} className="flex items-center gap-2">
                  <select aria-label="Día" value={r.dia_semana} onChange={e => cambiar(i, { dia_semana: Number(e.target.value) })} className={`${CAMPO} flex-1`}>
                    {DIAS.map(d => <option key={d.valor} value={d.valor}>{d.nombre}</option>)}
                  </select>
                  <input aria-label="Desde" type="time" value={r.hora_inicio} onChange={e => cambiar(i, { hora_inicio: e.target.value })} className={CAMPO} />
                  <input aria-label="Hasta" type="time" value={r.hora_fin} onChange={e => cambiar(i, { hora_fin: e.target.value })} className={CAMPO} />
                  <button type="button" onClick={() => setReglas(rs => rs.filter((_, k) => k !== i))} aria-label="Quitar horario" className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><X size={14} aria-hidden="true" /></button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" onClick={() => setReglas(rs => [...rs, { dia_semana: 1, hora_inicio: '09:00', hora_fin: '12:00' }])}
            className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-800 hover:bg-emerald-100">
            <Plus size={14} aria-hidden="true" /> Agregar horario
          </button>
          {error && <p role="alert" className="mt-3 text-xs font-semibold text-red-600">{error}</p>}
        </div>

        <div className="border-t border-gray-100 p-4">
          <button type="button" onClick={guardar} disabled={guardando || cargando || falloCarga}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-xs font-black uppercase tracking-widest text-white hover:bg-emerald-700 disabled:pointer-events-none disabled:opacity-50">
            {guardando ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /><span>Guardando…</span></> : 'Guardar disponibilidad'}
          </button>
        </div>
      </div>
    </div>
  )
}
