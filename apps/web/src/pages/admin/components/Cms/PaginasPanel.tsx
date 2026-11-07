import React, { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { api, BtnPrimary, Loading } from '@/pages/admin/components/Cms/CmsShared'

type PaginaRow = { slug: string; actualizado_en: string; contenido_len?: number }

const SLUG_HINT = `Slugs usados en rutas públicas: beneficios, requisitos, convenios-institucionales, convenios-comerciales, convenios-internacionales, normativas, galeria, comunicados, eventos, contacto, pegi, padi, preani`

export function PaginasPanel() {
  const { puede } = useAuth()
  const puedeEditar = puede('config', 'editar') // páginas dinámicas se guardan con PUT (upsert)
  const [list, setList] = useState<PaginaRow[]>([])
  const [slug, setSlug] = useState('')
  const [jsonText, setJsonText] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  const loadList = useCallback(async () => {
    const data = await api.get('/api/cms/paginas')
    if (data.success) setList(data.data as PaginaRow[])
  }, [])

  useEffect(() => {
    setLoading(true)
    loadList().finally(() => setLoading(false))
  }, [loadList])

  const loadSlug = async (s: string) => {
    setError('')
    setMsg('')
    const data = await api.get(`/api/cms/paginas/${encodeURIComponent(s)}`)
    if (!data.success) {
      setError(data.message || 'No encontrado')
      setJsonText('')
      return
    }
    const row = data.data as { contenido: string }
    setSlug(s)
    try {
      const parsed = JSON.parse(row.contenido)
      setJsonText(JSON.stringify(parsed, null, 2))
    } catch {
      setJsonText(row.contenido)
    }
  }

  const save = async () => {
    setSaving(true)
    setError('')
    setMsg('')
    try {
      JSON.parse(jsonText)
    } catch {
      setError('JSON inválido')
      setSaving(false)
      return
    }
    const s = slug.trim()
    if (!s) {
      setError('Indica un slug')
      setSaving(false)
      return
    }
    try {
      const data = await api.put(`/api/cms/paginas/${encodeURIComponent(s)}`, { contenido: jsonText })
      if (!data.success) {
        setError(data.message || 'Error al guardar')
        return
      }
      setMsg('Guardado')
      await loadList()
      setTimeout(() => setMsg(''), 2000)
    } catch (error) {
      console.error(error)
      setError('Error de conexión con el servidor')
    } finally {
      setSaving(false)
    }
  }


  const crearNueva = () => {
    setSlug('')
    setJsonText(JSON.stringify({
      version: 1,
      kind: 'generic',
      title: 'Título',
      subtitle: 'Subtítulo',
      icon: 'Award',
      blocks: [{ heading: 'Bloque', body: 'Texto del bloque.' }],
      footerBrand: 'Cámara Inmobiliaria del Estado Bolívar (CIBIR) — Afiliada a la CIV',
      footerLinks: [{ label: 'Inicio', to: '/' }],
      footerCopyright: '© 2026 CIBIR Bolívar. Todos los derechos reservados.',
    }, null, 2))
    setError('')
    setMsg('')
  }

  if (loading) return <Loading />

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-50">
      <div className="flex-shrink-0 px-4 py-3 border-b border-gray-100 bg-white flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Páginas dinámicas (JSON)</h3>
          <p className="text-[11px] text-slate-400 mt-0.5 max-w-xl">{SLUG_HINT}</p>
        </div>
        {puedeEditar && <div className="flex gap-2">
          <button type="button" onClick={crearNueva} className="text-xs font-semibold px-3 py-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200">
            Plantilla nueva
          </button>
          <BtnPrimary onClick={save} disabled={saving || !slug.trim()}>
            {saving ? 'Guardando…' : 'Guardar'}
          </BtnPrimary>
        </div>}
      </div>

      <div className="flex-1 flex min-h-0 overflow-hidden">
        <aside className="w-56 border-r border-gray-100 bg-white overflow-y-auto flex-shrink-0 p-2">
          {list.length === 0 ? (
            <p className="text-xs text-slate-400 p-2">No hay páginas. Ejecuta el seed o crea una.</p>
          ) : (
            list.map((p) => (
              <button
                key={p.slug}
                type="button"
                onClick={() => loadSlug(p.slug)}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold mb-1 transition-colors ${
                  slug === p.slug ? 'bg-[#E9FAF4] text-emerald-800' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {p.slug}
              </button>
            ))
          )}
        </aside>
        <div className="flex-1 flex flex-col min-w-0 p-4 gap-3 overflow-hidden">
          <div>
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Slug</label>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value.trim().toLowerCase())}
              readOnly={!puedeEditar}
              placeholder="ej. beneficios"
              className="mt-1 w-full max-w-md rounded-xl border border-gray-200 px-3 py-2 text-sm"
            />
          </div>
          {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
          {msg && <p className="text-xs text-emerald-600 font-medium">{msg}</p>}
          <textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            readOnly={!puedeEditar}
            rows={28}
            spellCheck={false}
            className="flex-1 min-h-[320px] w-full font-mono text-xs rounded-xl border border-gray-200 px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#00D084]/40 focus:border-[#00D084] resize-y bg-white"
            placeholder="{ ... JSON ... }"
          />
        </div>
      </div>
    </div>
  )
}
