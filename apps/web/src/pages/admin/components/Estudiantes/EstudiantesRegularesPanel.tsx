import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { API_URL } from '@/config/env'
import { useAuth } from '@/context/AuthContext'
import { formatNombreCard } from '@/utils/formatters'


type Estudiante = {
  id_estudiante: number
  id_persona: number | null
  id_empresa: number | null
  cedula: string | null
  nombre_completo: string
  email: string
  telefono: string | null
  tipo: 'Regular' | 'Afiliado'
  creado_en: string
}

type Inscripcion = {
  id_inscripcion: number
  id_estudiante: number
  id_curso: number | null
  programa_codigo: string | null
  estatus: 'Preinscrito' | 'Inscrito' | 'Rechazado' | 'Cancelado'
  creado_en: string
  curso_nombre: string | null
  curso_estatus: string | null
}

export default function EstudiantesRegularesPanel() {
  const { token } = useAuth()
  const authHeaders = useMemo(() => {
    const h: Record<string, string> = {}
    if (token) h.Authorization = `Bearer ${token}`
    return h
  }, [token])

  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [items, setItems] = useState<Estudiante[]>([])
  const [selected, setSelected] = useState<Estudiante | null>(null)
  const [detail, setDetail] = useState<{ estudiante: Estudiante; inscripciones: Inscripcion[] } | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const qs = new URLSearchParams()
      if (query.trim()) qs.set('query', query.trim())
      const res = await fetch(`${API_URL}/api/academia/estudiantes?${qs.toString()}`, { headers: authHeaders })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'Error cargando estudiantes')
      setItems(json.data as Estudiante[])
      if (selected) {
        const still = (json.data as Estudiante[]).find(e => e.id_estudiante === selected.id_estudiante) || null
        setSelected(still)
      }
    } catch (e: unknown) {
      const err = e as Error
      setError(err.message || 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }, [query, authHeaders, selected])

  const loadDetail = useCallback(async (id: number, signal?: AbortSignal) => {
    setDetailLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_URL}/api/academia/estudiantes-regulares/${id}`, { headers: authHeaders, signal })
      const json = await res.json()
      if (signal?.aborted) return
      if (!res.ok || !json.success) throw new Error(json.message || 'Error cargando detalle')
      setDetail(json.data)
    } catch (e: unknown) {
      if (signal?.aborted) return
      const err = e as Error
      setError(err.message || 'Error inesperado')
    } finally {
      if (!signal?.aborted) setDetailLoading(false)
    }
  }, [authHeaders])

  useEffect(() => { load() }, [load]) // initial

  useEffect(() => {
    if (!selected) { setDetail(null); return }
    const controller = new AbortController()
    loadDetail(selected.id_estudiante, controller.signal)
    return () => controller.abort()
  }, [selected, loadDetail])

  const procesar = async (idInscripcion: number, action: 'aprobar' | 'rechazar') => {
    setError('')
    try {
      const res = await fetch(`${API_URL}/api/academia/inscripciones/${idInscripcion}/${action}`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: action === 'rechazar' ? JSON.stringify({ notaAdmin: '' }) : undefined,
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'No se pudo procesar')
      if (selected) await loadDetail(selected.id_estudiante)
    } catch (e: unknown) {
      const err = e as Error
      setError(err.message || 'Error inesperado')
    }
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-[360px_1fr] grid-rows-1 h-full w-full overflow-hidden relative">
      {/* List */}
      <div className="flex flex-col bg-white border-r border-gray-100 overflow-hidden min-h-0">
        <div className="p-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-slate-800">Estudiantes Regulares</h3>
          <p className="text-xs text-slate-400 mt-0.5">Registro y preinscripción/inscripción (sin LMS).</p>
          <div className="mt-3 flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre / email / cédula..."
              className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#00D084]/40 focus:border-[#00D084]"
            />
            <button
              onClick={load}
              className="px-3 py-2 rounded-xl bg-slate-100 text-slate-600 text-sm font-semibold hover:bg-slate-200 transition-colors"
            >
              Buscar
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {loading ? (
            <div className="p-4 text-center text-xs text-slate-400 font-semibold uppercase tracking-widest mt-10">Cargando...</div>
          ) : error ? (
            <div className="p-4 text-center text-xs text-red-500 mt-10">{error}</div>
          ) : items.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-400 mt-10">Sin resultados.</div>
          ) : (
            items.map(e => (
              <button
                key={e.id_estudiante}
                onClick={() => setSelected(e)}
                className={['w-full text-left px-4 py-3.5 transition-colors flex flex-col gap-1',
                  selected?.id_estudiante === e.id_estudiante ? 'bg-[#E9FAF4]' : 'hover:bg-slate-50',
                ].join(' ')}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold truncate text-slate-800">{formatNombreCard(e.nombre_completo)}</span>

                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    #{e.id_estudiante}
                  </span>
                </div>
                <span className="text-xs text-slate-400 truncate">{e.email}</span>
                <span className="text-[10px] text-slate-300">
                  {e.cedula || '—'} · {new Date(e.creado_en).toLocaleDateString('es-ES')}
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Detail */}
      <div className="bg-gray-50 overflow-hidden relative min-h-0 hidden sm:block">
        {!selected ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-300">
            <p className="text-sm font-medium">Selecciona un estudiante</p>
          </div>
        ) : detailLoading || !detail ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-300">
            <p className="text-sm font-medium">Cargando detalle...</p>
          </div>
        ) : (
          <div className="absolute inset-0 overflow-y-auto p-4 sm:p-6">
            <div className="bg-white rounded-2xl p-4 border border-gray-100">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-900 leading-tight">{formatNombreCard(detail.estudiante.nombre_completo)}</h3>

                  <p className="text-xs text-slate-400 mt-0.5 truncate">{detail.estudiante.email}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{detail.estudiante.telefono || 'Teléfono: —'}</p>
                </div>
                <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-slate-100 text-slate-600">
                  {detail.estudiante.tipo}
                </span>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-gray-100">
              <h4 className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-3">Inscripciones</h4>
              {detail.inscripciones.length === 0 ? (
                <p className="text-sm text-slate-400">Sin inscripciones registradas.</p>
              ) : (
                <div className="space-y-2">
                  {detail.inscripciones.map(i => (
                    <div key={i.id_inscripcion} className="rounded-xl border border-gray-100 p-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">
                          {i.programa_codigo ? `Programa ${i.programa_codigo}` : (i.curso_nombre || `Curso #${i.id_curso}`)}
                        </p>
                        <p className="text-xs text-slate-400">
                          {new Date(i.creado_en).toLocaleString('es-ES')} · Estatus: <span className="font-semibold">{i.estatus}</span>
                        </p>
                      </div>
                      {i.estatus === 'Preinscrito' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => procesar(i.id_inscripcion, 'aprobar')}
                            className="px-3 py-2 rounded-xl bg-[#00D084] text-white text-xs font-semibold hover:bg-[#00B870] transition-colors"
                          >
                            Aprobar
                          </button>
                          <button
                            onClick={() => procesar(i.id_inscripcion, 'rechazar')}
                            className="px-3 py-2 rounded-xl bg-red-50 text-red-500 text-xs font-semibold hover:bg-red-100 transition-colors"
                          >
                            Rechazar
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {error && (
              <div className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-2xl p-4">{error}</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

