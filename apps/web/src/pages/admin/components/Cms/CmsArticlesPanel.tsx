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
      <div className="flex-1 w-full h-full min-w-0 overflow-y-auto bg-slate-50">
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

  return (
    <div className="flex w-full h-full min-w-0 overflow-y-auto bg-slate-50">
      <div className="flex flex-col flex-1 w-full min-w-0">
        {/* Mini toolbar with interactive breadcrumb */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-white border-b border-gray-100 shadow-2xs">
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
              <span className="uppercase text-slate-600 font-extrabold">{externalTab}</span>
            )}
          </div>
        </div>

        {/* Tab content */}
        <div key={externalTab} className="flex-1 w-full h-full min-w-0 overflow-y-auto relative cms-fade-up">
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
    </div>
  )
}

