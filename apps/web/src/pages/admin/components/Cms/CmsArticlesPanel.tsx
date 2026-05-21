import React, { useState, useRef, useEffect, useCallback } from 'react'
import { NoticiasPanel } from '@/pages/admin/components/Cms/NoticiasPanel'
import { DirectivaPanel } from '@/pages/admin/components/Cms/DirectivaPanel'
import { ConfigPanel } from '@/pages/admin/components/Cms/ConfigPanel'
import { PaginasPanel } from '@/pages/admin/components/Cms/PaginasPanel'
import { NormativasPanel } from '@/pages/admin/components/Cms/NormativasPanel'
import { ConveniosPanel } from '@/pages/admin/components/Cms/ConveniosPanel'
import { LandingPreviewPane } from '@/pages/admin/components/Cms/LandingPreviewPane'

export type CmsTab = 'noticias' | 'normativas' | 'directiva' | 'config' | 'paginas' | 'leyes' | 'reglamentos' | 'normas' | 'actas' | 'cursos' | 'hitos' | 'convenios';

/** Maps each CMS tab to its relevant landing section anchor */
const SECTION_ANCHORS: Record<CmsTab, string> = {
  noticias: '#noticias',
  normativas: '',
  directiva: '#directiva',
  config: '',
  paginas: '',
  leyes: '',
  reglamentos: '',
  normas: '',
  actas: '',
  cursos: '',
  hitos: '',
  convenios: '',
}

const MIN_LEFT = 360   // px
const MIN_RIGHT = 260   // px
const DEFAULT_LEFT = 650 // content column wider, preview narrower by default

export default function CmsArticlesPanel({ externalTab = 'config' }: { externalTab?: CmsTab }) {
  const [previewVisible, setPreviewVisible] = useState(false)
  const [leftWidth, setLeftWidth] = useState(DEFAULT_LEFT)
  const [dividerDragging, setDividerDragging] = useState(false)
  const [detailName, setDetailName] = useState<string | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(DEFAULT_LEFT)

  // ── Resize divider handlers ────────────────────────────────────────────────
  const onDividerMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true
    startX.current = e.clientX
    startWidth.current = leftWidth
    e.preventDefault()
    setDividerDragging(true)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [leftWidth])

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return
      const containerW = containerRef.current.getBoundingClientRect().width
      const delta = e.clientX - startX.current
      const next = startWidth.current + delta
      setLeftWidth(Math.max(MIN_LEFT, Math.min(next, containerW - MIN_RIGHT)))
    }
    const onMouseUp = () => {
      if (!isDragging.current) return
      isDragging.current = false
      setDividerDragging(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  useEffect(() => {
    const handler = (e: any) => setDetailName(e.detail)
    window.addEventListener('cms-breadcrumb', handler)
    return () => window.removeEventListener('cms-breadcrumb', handler)
  }, [])

  // ── ConfigPanel renders its own split screen ───────────────────────────────
  if (externalTab === 'config') {
    return (
      <div className="flex h-full overflow-hidden">
        <ConfigPanel />
      </div>
    )
  }

  if (externalTab === 'paginas') {
    return (
      <div className="flex h-full overflow-hidden">
        <PaginasPanel />
      </div>
    )
  }

  const sectionAnchor = SECTION_ANCHORS[externalTab]
  const previewIframeSrc = externalTab === 'normativas' ? '/normativas' : '/'
  const previewOpenTabHref = externalTab === 'normativas' ? '/normativas' : undefined
  const mobileLandingHref =
    externalTab === 'normativas' ? '/normativas' : sectionAnchor ? `/${sectionAnchor}` : '/'

  // Desactivamos el preview para normativas y config según petición del usuario
  const hasPreview = !['normativas', 'leyes', 'reglamentos', 'normas', 'actas', 'config', 'paginas'].includes(externalTab)
  const isPreviewActuallyVisible = previewVisible && hasPreview

  return (
    <div ref={containerRef} className="flex w-full h-full overflow-hidden bg-white select-none">

      {/* ── LEFT: content panel ───────────────────────────────────────────── */}
      <div
        className="flex flex-col overflow-hidden flex-shrink-0 max-lg:!w-full max-lg:!flex-1"
        style={{
          width: isPreviewActuallyVisible ? leftWidth : undefined,
          flex: isPreviewActuallyVisible ? 'none' : '1 1 0%',
          transition: dividerDragging ? 'none' : 'width 0.26s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {/* Mini toolbar with interactive breadcrumb */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-1.5 bg-gray-50 border-b border-gray-100">
          <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-slate-400">
            {detailName ? (
              <>
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('cms-clear-selection'))}
                  className="uppercase hover:text-slate-700 transition-colors cursor-pointer outline-none"
                  title="Volver a la lista completa"
                >
                  {externalTab}
                </button>
                <span className="text-slate-300">/</span>
                <span className="uppercase text-slate-600 truncate max-w-[140px] sm:max-w-[200px]" title={detailName}>
                  {detailName}
                </span>
              </>
            ) : (
              <span className="uppercase">{externalTab}</span>
            )}
          </div>
          {/* Show-preview button when hidden */}
          {!isPreviewActuallyVisible && hasPreview && (
            <button
              onClick={() => setPreviewVisible(true)}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-semibold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 transition-all"
            >
              <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              Mostrar preview
            </button>
          )}
        </div>

        {/* Tab content — key forces remount+animation on every tab switch */}
        <div key={externalTab} className="flex-1 overflow-hidden relative cms-fade-up">
          {externalTab === 'noticias' && <NoticiasPanel />}
          {externalTab === 'normativas' && <NormativasPanel />}
          {externalTab === 'leyes' && <NormativasPanel fixedCategory="Leyes y Decretos" />}
          {externalTab === 'reglamentos' && <NormativasPanel fixedCategory="Reglamentos y Estatutos" />}
          {externalTab === 'normas' && <NormativasPanel fixedCategory="Normas y Procedimientos" />}
          {externalTab === 'actas' && <NormativasPanel fixedCategory="Actas de Asamblea" />}
          {externalTab === 'directiva' && <DirectivaPanel />}
          {externalTab === 'convenios' && <ConveniosPanel />}
        </div>
      </div>

      {/* ── DIVIDER (drag handle) ─────────────────────────────────────────── */}
      {isPreviewActuallyVisible && (
        <div
          onMouseDown={onDividerMouseDown}
          className="hidden lg:flex flex-shrink-0 w-1.5 cursor-col-resize items-center justify-center bg-gray-200 hover:bg-[#00D084] transition-colors duration-150 z-10"
          title="Arrastrar para redimensionar"
        >
          <div className="w-0.5 h-10 rounded-full bg-gray-400" />
        </div>
      )}

      {/* ── RIGHT: landing preview ────────────────────────────────────────── */}
      {hasPreview && (
        <div className={`hidden lg:flex flex-col overflow-hidden ${previewVisible ? 'flex-1' : 'w-0'}`}>
          <LandingPreviewPane
            visible={previewVisible}
            onToggle={() => setPreviewVisible(v => !v)}
            sectionAnchor={sectionAnchor}
            iframeSrc={previewIframeSrc}
            openInTabHref={previewOpenTabHref}
          />
        </div>
      )}

      {/* Mobile: open in new tab */}
      <div className="lg:hidden fixed bottom-4 right-4 z-50">
        <a
          href={mobileLandingHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2.5 bg-[#00D084] text-white text-xs font-bold rounded-full shadow-lg shadow-emerald-500/30 hover:bg-[#00B870] transition-colors"
        >
          Ver landing
        </a>
      </div>

      {/* ── DRAG OVERLAY: captures mouse events over the iframe during resize ── */}
      {dividerDragging && (
        <div className="fixed inset-0 z-[9999] cursor-col-resize" />
      )}
    </div>
  )
}

