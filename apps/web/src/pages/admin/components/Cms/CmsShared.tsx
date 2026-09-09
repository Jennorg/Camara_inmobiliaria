import React, { useRef, useState, useEffect, useCallback } from 'react'
import { Search, Plus, LayoutGrid, List } from 'lucide-react'
import { API_URL } from '@/config/env'
import { compressImage } from '@/utils/imageCompressor'

export const API = API_URL

export interface CmsPanelHeaderProps {
  icon: React.ReactNode
  title: string
  subtitle?: string
  searchQuery?: string
  onSearchChange?: (query: string) => void
  searchPlaceholder?: string
  viewMode?: 'grid' | 'list'
  onViewModeChange?: (mode: 'grid' | 'list') => void
  actionButtonText?: string
  onActionClick?: () => void
  actionIcon?: React.ReactNode
  extraControls?: React.ReactNode
  className?: string
}

export const CmsPanelHeader = ({
  icon,
  title,
  subtitle,
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'Buscar...',
  viewMode,
  onViewModeChange,
  actionButtonText,
  onActionClick,
  actionIcon = <Plus size={16} />,
  extraControls,
  className = '',
}: CmsPanelHeaderProps) => {
  return (
    <div className={`flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs ${className}`}>
      {/* Título e Info */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100/60">
          {icon}
        </div>
        <div>
          <h2 className="text-lg sm:text-xl font-black text-slate-800 tracking-tight leading-tight">
            {title}
          </h2>
          {subtitle && (
            <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Controles: Búsqueda, Grid/List Toggle, Extra Controls, Botón de Acción */}
      <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 flex-1 max-w-2xl justify-end">
        {onSearchChange !== undefined && (
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery || ''}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
            />
          </div>
        )}

        {onViewModeChange !== undefined && viewMode !== undefined && (
          <div className="flex items-center p-1 bg-slate-100 rounded-xl shrink-0 border border-slate-200/50">
            <button
              type="button"
              onClick={() => onViewModeChange('grid')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'grid' ? 'bg-white text-emerald-700 shadow-xs font-bold' : 'text-slate-400 hover:text-slate-600'
              }`}
              title="Vista en Cards Grid"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('list')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'list' ? 'bg-white text-emerald-700 shadow-xs font-bold' : 'text-slate-400 hover:text-slate-600'
              }`}
              title="Vista en Lista"
            >
              <List size={16} />
            </button>
          </div>
        )}

        {extraControls}

        {actionButtonText && onActionClick && (
          <button
            type="button"
            onClick={onActionClick}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold text-xs shadow-md shadow-emerald-600/20 transition-all cursor-pointer shrink-0"
          >
            {actionIcon}
            <span>{actionButtonText}</span>
          </button>
        )}
      </div>
    </div>
  )
}

const getAuthHeaders = (extra: Record<string, string> = {}) => {
  return {
    ...extra,
  }
}

const handleResponse = async (r: Response) => {
  if (!r.ok) {
    const errorText = await r.text().catch(() => '')
    let errorJson: any = null
    try { errorJson = JSON.parse(errorText) } catch {}
    throw new Error(errorJson?.message || `HTTP error ${r.status}`)
  }
  return r.json()
}

export const api = {
  get: (path: string) =>
    fetch(`${API}${path}`, {
      credentials: 'include',
      headers: getAuthHeaders(),
    }).then(handleResponse),
  post: <T,>(path: string, body: T) => {
    return fetch(`${API}${path}`, { 
      method: 'POST', 
      credentials: 'include',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }), 
      body: JSON.stringify(body) 
    }).then(handleResponse)
  },
  put: <T,>(path: string, body: T) => {
    return fetch(`${API}${path}`, { 
      method: 'PUT', 
      credentials: 'include',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }), 
      body: JSON.stringify(body) 
    }).then(handleResponse)
  },
  delete: (path: string) => {
    return fetch(`${API}${path}`, { 
      method: 'DELETE',
      credentials: 'include',
      headers: getAuthHeaders(),
    }).then(handleResponse)
  },
}


export const uploadFileStorage = async (file: File, folder: string, skipCompress = false): Promise<string> => {
  // Compress image client-side if it is an image
  let fileToUpload = file;
  if (file.type.startsWith('image/') && !skipCompress) {
    try {
      fileToUpload = await compressImage(file, 1000, 0.82);
    } catch (compressErr) {
      console.error('Error compressing image before upload:', compressErr);
    }
  }

  // 1. Intentar subir mediante presigned URL
  try {
    const presignRes = await fetch(`${API_URL}/api/public/uploads/presign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filename: fileToUpload.name,
        contentType: fileToUpload.type || 'application/octet-stream',
        folder,
      }),
    });
    const presignJson = await presignRes.json();
    if (presignRes.ok && presignJson?.success && presignJson?.data?.signedUploadUrl) {
      const { signedUploadUrl, publicUrl } = presignJson.data as { signedUploadUrl: string; publicUrl: string };
      const putRes = await fetch(signedUploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': fileToUpload.type || 'application/octet-stream',
        },
        body: fileToUpload,
      });
      if (putRes.ok) {
        return publicUrl;
      }
    }
  } catch (err) {
    console.warn('Presigned upload falló o fue bloqueado por CORS, intentando subida directa al servidor:', err);
  }

  // 2. Fallback: Subida directa al servidor (base64)
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(fileToUpload);
  });

  const directRes = await fetch(`${API_URL}/api/public/uploads/direct`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      filename: fileToUpload.name,
      contentType: fileToUpload.type || 'application/octet-stream',
      folder,
      fileData: base64,
    }),
  });

  const directJson = await directRes.json();
  if (!directRes.ok || !directJson?.success) {
    throw new Error(directJson?.message || 'No se pudo subir el archivo a Storage');
  }

  return directJson.data.publicUrl;
}

// Alias para retrocompatibilidad
export const uploadFileSupabase = uploadFileStorage

export const FormField = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1">
    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{label}</label>
    {children}
  </div>
)

export const Input = ({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    {...props}
    className={["text-sm rounded-xl border border-gray-200 px-3 py-2 text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-[#00D084]/40 focus:border-[#00D084] transition-colors bg-white", className].join(' ')}
  />
)

export const Textarea = ({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea
    {...props}
    rows={props.rows || 3}
    className={["text-sm rounded-xl border border-gray-200 px-3 py-2 text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-[#00D084]/40 focus:border-[#00D084] transition-colors resize-none bg-white", className].join(' ')}
  />
)

interface BtnProps {
  onClick?: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

export const BtnPrimary = ({ onClick, children, disabled, className }: BtnProps) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={["px-4 py-2 rounded-xl bg-[#00D084] text-white text-xs font-semibold hover:bg-[#00B870] active:scale-95 transition-colors transition-transform disabled:opacity-50", className].join(' ')}
  >
    {children}
  </button>
)

export const BtnDanger = ({ onClick, children, className }: BtnProps) => (
  <button
    onClick={onClick}
    className={["px-3 py-1.5 rounded-xl bg-red-50 text-red-500 text-xs font-semibold hover:bg-red-100 active:scale-95 transition-colors transition-transform", className].join(' ')}
  >
    {children}
  </button>
)

export const BtnSecondary = ({ onClick, children, className }: BtnProps) => (
  <button
    onClick={onClick}
    className={["px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 text-xs font-semibold hover:bg-slate-200 active:scale-95 transition-colors transition-transform", className].join(' ')}
  >
    {children}
  </button>
)

import { Skeleton, SkeletonList, SkeletonCard } from '@/components/Skeleton'

export const SkeletonDetail = () => (
  <div className="flex flex-col gap-6 bg-white rounded-3xl p-6 border border-gray-100 shadow-xs animate-pulse">
    <div className="flex items-center justify-between">
       <div className="flex items-center gap-3 w-full">
         <Skeleton className="w-12 h-12 rounded-full" />
         <div className="flex flex-col gap-2 flex-1">
           <Skeleton className="h-5 w-1/2" />
           <Skeleton className="h-3 w-1/4" />
         </div>
       </div>
    </div>
    <Skeleton className="w-full h-32 rounded-2xl" />
    <div className="space-y-3">
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  </div>
)

export const Loading = () => <SkeletonList />

// ── Resize constants ───────────────────────────────────────────────────────────
const LIST_MIN     = 280
const LIST_MAX     = 650
const LIST_DEFAULT = 440   // Wider default starting width for titles and action badges

export function ListDetail<T extends { id?: string | number }>({
  listHeader,
  items,
  loading,
  renderRow,
  renderDetail,
  renderForm,
  onNew,
  selectedId,
  setSelectedId,
  isEditing,
  setIsEditing,
  hideNewButton,
}: {
  listHeader?: React.ReactNode
  items: T[]
  loading: boolean
  renderRow: (item: T, selected: boolean, index: number) => React.ReactNode
  renderDetail: (item: T) => React.ReactNode
  renderForm: () => React.ReactNode
  onNew: () => void
  selectedId: string | number | null
  setSelectedId: (id: string | number | null) => void
  isEditing?: boolean
  setIsEditing?: (val: boolean) => void
  hideNewButton?: boolean
}) {
  const selected    = items.find(i => String(i.id) === String(selectedId)) ?? null
  const showDetail  = !!(selected || selectedId === 'new')

  // ── Column resize & persistence ─────────────────────────────────────────────
  const [listWidth, setListWidth] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('cms_list_width')
      if (saved) {
        const parsed = Number(saved)
        if (!isNaN(parsed) && parsed >= LIST_MIN && parsed <= LIST_MAX) return parsed
      }
    }
    return LIST_DEFAULT
  })
  const [dragging,  setDragging]  = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging   = useRef(false)
  const startX       = useRef(0)
  const startW       = useRef(LIST_DEFAULT)
  const currentW     = useRef(listWidth)

  useEffect(() => {
    currentW.current = listWidth
  }, [listWidth])

  const onDividerDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true
    startX.current     = e.clientX
    startW.current     = listWidth
    setDragging(true)
    e.preventDefault()
    document.body.style.cursor     = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [listWidth])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return
      const containerW = containerRef.current.getBoundingClientRect().width
      const delta = e.clientX - startX.current
      const nextW = Math.max(LIST_MIN, Math.min(startW.current + delta, Math.min(LIST_MAX, containerW - 200)))
      currentW.current = nextW
      setListWidth(nextW)
    }
    const onUp = () => {
      if (!isDragging.current) return
      isDragging.current = false
      setDragging(false)
      document.body.style.cursor     = ''
      document.body.style.userSelect = ''
      if (typeof window !== 'undefined') {
        localStorage.setItem('cms_list_width', String(currentW.current))
      }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',   onUp)
    }
  }, [])

  // ── Breadcrumb integration ──────────────────────────────────────────────────
  useEffect(() => {
    const titleObj = selected as any
    const titleStr = titleObj ? (titleObj.titulo || titleObj.nombre || titleObj.etiqueta || 'Elemento') : null
    const finalTitle = selectedId === 'new' ? 'Nuevo' : titleStr
    window.dispatchEvent(new CustomEvent('cms-breadcrumb', { detail: finalTitle }))
    return () => { window.dispatchEvent(new CustomEvent('cms-breadcrumb', { detail: null })) }
  }, [selectedId, selected])

  useEffect(() => {
    const handler = () => setSelectedId(null)
    window.addEventListener('cms-clear-selection', handler)
    return () => window.removeEventListener('cms-clear-selection', handler)
  }, [setSelectedId])

  // Transition string — disabled during drag to avoid jitter
  const colTransition = dragging ? 'none' : 'width 0.26s cubic-bezier(0.4,0,0.2,1)'

  return (
    <div ref={containerRef} className="flex h-full overflow-hidden">

      {/* ── LIST column ────────────────────────────────────────────────────── */}
      <div
        className={[
          'flex flex-col bg-white border-gray-100 overflow-hidden flex-shrink-0',
          !showDetail ? 'flex w-full' : 'hidden sm:flex',
        ].join(' ')}
        style={showDetail ? { width: listWidth, transition: colTransition } : undefined}
      >
        {listHeader && (
          <div className="p-3 border-b border-slate-100 bg-slate-50/50 flex flex-col gap-2 flex-shrink-0">
            {listHeader}
          </div>
        )}
        {/* Item list with stagger entrance */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden divide-y divide-gray-50">
          {loading ? <Loading /> : (
            <div className="cms-stagger">
              {items.map((item, idx) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedId(item.id ?? null)}
                  className={[
                    'w-full text-left px-2 py-2.5 transition-colors duration-150 group cursor-pointer select-none relative',
                    String(selectedId) === String(item.id)
                      ? 'bg-[#E9FAF4] border-l-2 border-[#00D084]'
                      : 'hover:bg-slate-50 border-l-2 border-transparent',
                  ].join(' ')}
                >
                  {renderRow(item, String(selectedId) === String(item.id), idx)}
                </div>
              ))}
              {items.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-10">Sin registros</p>
              )}
            </div>
          )}
        </div>

        {/* + New button */}
        {!hideNewButton && (
          <div className="p-4 border-t border-gray-100 bg-white">
            <button
              onClick={onNew}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#00D084] text-white text-sm font-semibold hover:bg-[#00B870] active:scale-[0.98] transition-colors transition-transform"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Nuevo
            </button>
          </div>
        )}
      </div>

      {/* ── DIVIDER ─────────────────────────────────────────────────────────── */}
      {showDetail && (
        <div
          onMouseDown={onDividerDown}
          className="hidden sm:flex flex-shrink-0 w-1.5 cursor-col-resize bg-gray-200 hover:bg-[#00D084] transition-colors duration-150 items-center justify-center z-10"
          title="Arrastrar para redimensionar"
        >
          <div className="w-0.5 h-8 rounded-full bg-gray-400 opacity-50" />
        </div>
      )}

      {/* ── DETAIL / FORM column ──────────────────────────────────────────── */}
      <div
        className={[
          'flex-1 min-w-0 bg-gray-50 overflow-y-auto',
          showDetail ? 'flex flex-col' : 'hidden sm:flex sm:flex-col',
        ].join(' ')}
      >
        {showDetail ? (
          /* key forces re-mount animation on every selection change */
          <div key={String(selectedId)} className="p-5 cms-slide-left">
            {(selectedId === 'new' || isEditing) ? renderForm() : selected && renderDetail(selected)}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-300 cms-fade-up">
            <svg viewBox="0 0 24 24" className="w-12 h-12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm font-medium">Selecciona un elemento</p>
          </div>
        )}
      </div>

      {/* Global drag overlay — prevents content from stealing mouse events */}
      {dragging && <div className="fixed inset-0 z-[9999] cursor-col-resize" />}
    </div>
  )
}
