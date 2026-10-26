import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CalendarCheck, Loader2, Video } from 'lucide-react'
import { API_URL } from '@/config/env'
import SEO from '@/components/SEO'

type Horario = { inicio: string; fin: string }
type Reserva = { meetUrl: string; fecha: string; hora: string }
type Estado = 'cargando' | 'listo' | 'invalido' | 'error'

const ZONA = 'America/Caracas'
const dia = (iso: string) => new Intl.DateTimeFormat('es-VE', { timeZone: ZONA, weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(iso))
const hora = (iso: string) => new Intl.DateTimeFormat('es-VE', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date(iso))
const claveDia = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(new Date(iso))

/** Página pública: el aspirante elige uno de los horarios libres de la Cámara para su entrevista. */
export default function AgendarEntrevistaPage() {
  const { token = '' } = useParams()
  const [estado, setEstado] = useState<Estado>('cargando')
  const [horarios, setHorarios] = useState<Horario[]>([])
  const [elegido, setElegido] = useState<string | null>(null)
  const [aviso, setAviso] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [reserva, setReserva] = useState<Reserva | null>(null)

  const cargar = useCallback(async (mensaje = '') => {
    setEstado('cargando')
    try {
      const res = await fetch(`${API_URL}/api/public/agenda/${encodeURIComponent(token)}`)
      const json = await res.json()
      if (res.status === 410) { setEstado('invalido'); return }
      if (!res.ok || !json.success) throw new Error(json.message)
      setHorarios(json.data.horarios)
      setElegido(null)
      setAviso(mensaje)
      setEstado('listo')
    } catch {
      setEstado('error')
    }
  }, [token])

  useEffect(() => { cargar() }, [cargar])

  const confirmar = async () => {
    if (!elegido || enviando) return
    setEnviando(true)
    try {
      const res = await fetch(`${API_URL}/api/public/agenda/${encodeURIComponent(token)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ inicio: elegido }),
      })
      const json = await res.json()
      if (res.ok && json.success) { setReserva(json.data); return }
      if (res.status === 410) { setEstado('invalido'); return }
      if (res.status === 409) { await cargar(json.message || 'Ese horario ya no está disponible. Elige otro.'); return }
      setAviso(json.message || 'No se pudo reservar. Intenta de nuevo en unos minutos.')
    } catch {
      setAviso('No se pudo reservar. Revisa tu conexión e intenta de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  const porDia = useMemo(() => {
    const grupos = new Map<string, Horario[]>()
    horarios.forEach(h => grupos.set(claveDia(h.inicio), [...(grupos.get(claveDia(h.inicio)) ?? []), h]))
    return [...grupos.values()]
  }, [horarios])

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <SEO index={false} title="Elige el horario de tu entrevista" />
      <div className="mx-auto w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-xl font-black tracking-tight text-slate-900">Elige el horario de tu entrevista</h1>
        <p className="mt-1 text-sm text-slate-500">Cámara Inmobiliaria del Estado Bolívar · videollamada de Google Meet · horario de Venezuela</p>

        {reserva ? (
          <div role="status" className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <p className="flex items-center gap-2 font-bold text-emerald-800"><CalendarCheck size={18} aria-hidden="true" /> ¡Entrevista agendada!</p>
            <p className="mt-2 text-sm text-slate-700">{dia(`${reserva.fecha}T${reserva.hora}:00-04:00`)} a las {hora(`${reserva.fecha}T${reserva.hora}:00-04:00`)}.</p>
            <a href={reserva.meetUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700">
              <Video size={16} aria-hidden="true" /> Enlace de Google Meet
            </a>
            <p className="mt-3 text-xs text-slate-500">También te llegó la invitación de Google Calendar a tu correo.</p>
          </div>
        ) : estado === 'cargando' ? (
          <div role="status" className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-slate-300" aria-label="Cargando horarios" /></div>
        ) : estado === 'invalido' ? (
          <p role="alert" className="mt-6 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">Este enlace ya no es válido. Pide uno nuevo a la Cámara.</p>
        ) : estado === 'error' ? (
          <div role="alert" className="mt-6 rounded-2xl bg-red-50 p-4 text-sm text-red-800">
            No pudimos cargar los horarios. Intenta de nuevo en unos minutos.
            <button type="button" onClick={() => cargar()} className="mt-2 block font-bold underline">Reintentar</button>
          </div>
        ) : (
          <>
            {aviso && <p role="alert" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{aviso}</p>}
            {porDia.length === 0 ? (
              <p className="mt-6 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">No hay horarios disponibles por ahora. Vuelve a intentarlo más tarde o escríbenos.</p>
            ) : (
              <div className="mt-6 flex flex-col gap-5">
                {porDia.map(grupo => (
                  <section key={grupo[0].inicio} aria-label={dia(grupo[0].inicio)}>
                    <h2 className="text-sm font-bold capitalize text-slate-800">{dia(grupo[0].inicio)}</h2>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {grupo.map(h => (
                        <button key={h.inicio} type="button" aria-pressed={elegido === h.inicio} onClick={() => setElegido(h.inicio)}
                          className={`min-h-10 rounded-xl border px-3 text-sm font-semibold transition-colors ${elegido === h.inicio ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-400'}`}>
                          {hora(h.inicio)}
                        </button>
                      ))}
                    </div>
                  </section>
                ))}
                <button type="button" onClick={confirmar} disabled={!elegido || enviando}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 text-sm font-black uppercase tracking-widest text-white hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-40">
                  {enviando ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /><span>Reservando…</span></> : 'Confirmar horario'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}
