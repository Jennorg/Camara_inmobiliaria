import React, { useRef, useState, useEffect } from 'react'

interface LandingPreviewPaneProps {
  /** Si false, el panel queda oculto pero el iframe NO se destruye (evita recargas) */
  visible: boolean
  onToggle: () => void
  /**
   * Anchor de la sección a la que el iframe hará scroll automático.
   * Ej: '#noticias', '#formacion', '#convenios'
   * Cuando cambia, manda scroll_to al iframe.
   */
  sectionAnchor?: string
  /** Ruta distinta de la home para previsualizar (p. ej. `/normativas`). */
  iframeSrc?: string
  /** Enlace "abrir en pestaña" cuando no basta con `/${sectionAnchor}`. */
  openInTabHref?: string
}

type CmsPreviewWindow = Window & typeof globalThis & {
  __cmsPreviewIframe?: HTMLIFrameElement | null
}

/**
 * Panel reutilizable de preview de la landing en un iframe.
 * Se monta una sola vez en CmsArticlesPanel y persiste al cambiar de módulo.
 */
export const LandingPreviewPane = ({
  visible,
  onToggle,
  sectionAnchor,
  iframeSrc = '/',
  openInTabHref,
}: LandingPreviewPaneProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [iframeReady, setIframeReady] = useState(false)

  // ── Expose iframe ref globally so any panel can use sendToPreview() ─────────
  useEffect(() => {
    ; (window as CmsPreviewWindow).__cmsPreviewIframe = iframeRef.current
    return () => {
      ; (window as CmsPreviewWindow).__cmsPreviewIframe = null
    }
  }, [iframeReady])

  // ── Listen for 'ready' signal from inside the iframe ───────────────────────
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'iframe_ready') setIframeReady(true)
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  const scrollNow = (anchor: string) => {
    if (!anchor) return
    iframeRef.current?.contentWindow?.postMessage({ type: 'scroll_to', anchor }, '*')
  }

  const handleLoad = () => {
    setIframeReady(true)
    setTimeout(() => {
      // Push current config (ConfigPanel broadcasts via sendToPreview)
      iframeRef.current?.contentWindow?.postMessage({ type: 'request_cfg' }, '*')
      // Then scroll to section
      if (sectionAnchor) scrollNow(sectionAnchor)
    }, 400)
  }

  // ── Auto-scroll when sectionAnchor prop changes (tab switch) ───────────────
  useEffect(() => {
    if (!iframeReady || !sectionAnchor) return
    // Small delay so the iframe has time to settle
    const t = setTimeout(() => scrollNow(sectionAnchor), 200)
    return () => clearTimeout(t)
  }, [sectionAnchor, iframeReady])  

  return (
    <div
      className="flex flex-col bg-slate-900 overflow-hidden h-full"
      style={{ visibility: visible ? 'visible' : 'hidden', width: '100%' }}
    >
      {/* Toolbar */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">

        <div className="flex items-center gap-3">
          {/* Live indicator */}
          {iframeReady ? (
            <span className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </span>
          ) : (
            <span className="text-[10px] text-slate-500">Cargando…</span>
          )}

          {/* Open in tab */}
          <a
            href={openInTabHref ?? (sectionAnchor ? `/${sectionAnchor}` : '/')}
            target="_blank"
            rel="noopener noreferrer"
            title="Abrir en nueva pestaña"
            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>

          {/* Hide button */}
          <button
            onClick={onToggle}
            title="Ocultar preview"
            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        </div>
      </div>

      {/* iframe — always in DOM */}
      <div className="flex-1 overflow-hidden relative">
        <iframe
          ref={iframeRef}
          key={iframeSrc}
          src={iframeSrc}
          onLoad={handleLoad}
          className="w-full h-full border-0"
          title="Landing Page Preview"
          sandbox="allow-scripts allow-forms allow-popups"
          style={{ colorScheme: 'normal' }}
        />
        {/* Overlay prevents accidental iframe interaction while typing */}
        <div className="absolute inset-0 pointer-events-none" />
      </div>
    </div>
  )
}

/**
 * Helper para que cualquier panel CMS pueda enviar mensajes al iframe de preview
 * sin prop drilling.
 */
export function sendToPreview(message: Record<string, unknown>) {
  const iframe = (window as CmsPreviewWindow).__cmsPreviewIframe
  iframe?.contentWindow?.postMessage(message, '*')
}
