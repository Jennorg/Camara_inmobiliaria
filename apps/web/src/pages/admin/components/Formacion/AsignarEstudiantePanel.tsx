import React, { useEffect, useMemo, useState } from 'react'
import { API_URL } from '@/config/env'
import { useAuth } from '@/context/AuthContext'

type Curso = {
  id_curso: number
  nombre: string
  estatus: 'Abierto' | 'Cerrado' | 'En curso'
  cupos_disponibles: number
  cupos_totales: number
}

export default function AsignarEstudiantePanel() {
  const { token } = useAuth()
  const [cursos, setCursos] = useState<Curso[]>([])
  const [loadingCursos, setLoadingCursos] = useState(true)
  const [errorCursos, setErrorCursos] = useState('')

  const [idCurso, setIdCurso] = useState<number | ''>('')
  const [nombreCompleto, setNombreCompleto] = useState('')
  const [cedulaRif, setCedulaRif] = useState('')
  const [email, setEmail] = useState('')
  const [telefono, setTelefono] = useState('')
  const [nivelProfesional, setNivelProfesional] = useState('')
  const [esCorredorInmobiliario, setEsCorredorInmobiliario] = useState<'si' | 'no' | ''>('')

  const [submitting, setSubmitting] = useState(false)
  const [resultMsg, setResultMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const authHeaders = useMemo(() => {
    const h: Record<string, string> = {}
    if (token) h.Authorization = `Bearer ${token}`
    return h
  }, [token])

  useEffect(() => {
    const run = async () => {
      setLoadingCursos(true)
      setErrorCursos('')
      try {
        const res = await fetch(`${API_URL}/api/academia/cursos?estatus=Abierto`, {
          headers: { ...authHeaders },
        })
        const json = await res.json()
        if (!res.ok || !json.success) throw new Error(json.message || 'Error cargando cursos')
        setCursos(json.data as Curso[])
      } catch (e: unknown) {
        const err = e as Error
        setErrorCursos(err.message || 'Error inesperado')
      } finally {
        setLoadingCursos(false)
      }
    }
    run()
  }, [authHeaders])

  const selectedCurso = cursos.find(c => c.id_curso === idCurso)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setResultMsg(null)
    try {
      if (!idCurso) throw new Error('Selecciona un curso abierto')
      const res = await fetch(`${API_URL}/api/academia/cursos/${idCurso}/asignar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          nombreCompleto,
          cedulaRif,
          email,
          telefono,
          nivelProfesional,
          esCorredorInmobiliario: esCorredorInmobiliario === 'si',
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'No se pudo asignar')
      setResultMsg({ type: 'ok', text: json.message || 'Asignado correctamente' })
      setNombreCompleto('')
      setCedulaRif('')
      setEmail('')
      setTelefono('')
      setNivelProfesional('')
      setEsCorredorInmobiliario('')
    } catch (e: unknown) {
      const err = e as Error
      setResultMsg({ type: 'err', text: err.message || 'Error inesperado' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 overflow-y-auto h-full">
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Cargar / Asignar estudiante</h3>
          <p className="text-xs text-slate-400 mt-0.5">Asignación manual a un curso abierto (sin LMS, solo registro e inscripción).</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-6">
        <div className="mb-4">
          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Curso abierto</label>
          <div className="mt-2">
            {loadingCursos ? (
              <div className="text-xs text-slate-400">Cargando cursos...</div>
            ) : errorCursos ? (
              <div className="text-xs text-red-500">{errorCursos}</div>
            ) : (
              <select
                value={idCurso}
                onChange={(e) => setIdCurso(e.target.value ? Number(e.target.value) : '')}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#00D084]/40 focus:border-[#00D084]"
              >
                <option value="">Selecciona un curso...</option>
                {cursos.map(c => (
                  <option key={c.id_curso} value={c.id_curso}>
                    #{c.id_curso} · {c.nombre} ({c.cupos_disponibles}/{c.cupos_totales})
                  </option>
                ))}
              </select>
            )}
          </div>
          {selectedCurso && (
            <p className="mt-2 text-[11px] text-slate-400">
              Estatus: <span className="font-semibold text-slate-600">{selectedCurso.estatus}</span> · Cupos disponibles:{' '}
              <span className="font-semibold text-slate-600">{selectedCurso.cupos_disponibles}</span>
            </p>
          )}
        </div>

        <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Nombre completo</label>
            <input
              value={nombreCompleto}
              onChange={(e) => setNombreCompleto(e.target.value)}
              required
              className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#00D084]/40 focus:border-[#00D084]"
              placeholder="Ej. María Fernanda Rojas"
            />
          </div>

          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Cédula/RIF (opcional)</label>
            <input
              value={cedulaRif}
              onChange={(e) => setCedulaRif(e.target.value)}
              className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#00D084]/40 focus:border-[#00D084]"
              placeholder="V-00.000.000"
            />
          </div>

          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Teléfono (opcional)</label>
            <input
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#00D084]/40 focus:border-[#00D084]"
              placeholder="+58 4XX 0000000"
            />
          </div>

          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Nivel profesional</label>
            <div className="relative mt-2">
              <select
                value={nivelProfesional}
                onChange={(e) => setNivelProfesional(e.target.value)}
                required
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#00D084]/40 focus:border-[#00D084] appearance-none bg-white"
              >
                <option value="" disabled>
                  Selecciona…
                </option>
                <option value="Bachiller">Bachiller</option>
                <option value="Nivel Profesional">Nivel Profesional</option>
                <option value="Postgrado">Postgrado</option>
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">▼</span>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">¿Ya es corredor inmobiliario?</label>
            <div className="mt-2 rounded-xl border border-gray-200 bg-gray-50 p-1">
              <div className="grid grid-cols-2 gap-1" role="radiogroup" aria-label="¿Ya es corredor inmobiliario?">
                {(['si', 'no'] as const).map((v) => {
                  const selected = esCorredorInmobiliario === v
                  return (
                    <label
                      key={v}
                      className={[
                        'h-10 rounded-lg cursor-pointer text-xs font-semibold flex items-center justify-center transition-all',
                        selected ? 'bg-[#00D084] text-white shadow-sm' : 'text-slate-600 hover:bg-white',
                      ].join(' ')}
                    >
                      <input
                        type="radio"
                        name="esCorredorInmobiliario"
                        value={v}
                        checked={selected}
                        onChange={() => setEsCorredorInmobiliario(v)}
                        required
                        className="sr-only"
                      />
                      {v === 'si' ? 'Sí' : 'No'}
                    </label>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              type="email"
              className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#00D084]/40 focus:border-[#00D084]"
              placeholder="usuario@ejemplo.com"
            />
          </div>

          <div className="md:col-span-2 flex items-center gap-2 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#00D084] text-white text-sm font-semibold hover:bg-[#00B870] transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {submitting ? 'Procesando...' : 'Asignar e Inscribir'}
            </button>
            {resultMsg && (
              <span className={['text-xs font-semibold', resultMsg.type === 'ok' ? 'text-emerald-600' : 'text-red-500'].join(' ')}>
                {resultMsg.text}
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

