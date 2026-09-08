import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { api, FormField, Input, Textarea, BtnPrimary, BtnDanger, BtnSecondary, uploadFileStorage, CmsPanelHeader } from '@/pages/admin/components/Cms/CmsShared'
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { 
  Upload, CheckCircle, Trash2, ArrowLeft, Calendar, Clock, MapPin, 
  ArrowUpLeft, ArrowUpRight, ArrowDownLeft, ArrowDownRight, ArrowLeft as ArrowLeftIcon, 
  ArrowRight as ArrowRightIcon, Dot, Plus, Search, LayoutGrid, List, Edit3, 
  Image as ImageIcon, Newspaper, GripVertical, Eye, EyeOff, Loader2 
} from 'lucide-react'

interface NoticiaItem {
  id: string | number;
  titulo: string;
  contenido: string;
  extracto: string;
  imagen_url: string;
  categoria: string;
  tag: string;
  fecha: string;
  publicado: number | boolean;
  fecha_evento: string;
  hora_evento: string;
  lugar_evento: string;
  posicion_imagen: string;
  orden?: number;
}

// ── Componente de Card con Pragmatic Drag and Drop ──────────────────────────
const PragmaticNewsCard = ({ 
  item, 
  index, 
  onReorder, 
  onSelect, 
  onEdit, 
  onRemove 
}: {
  item: NoticiaItem;
  index: number;
  onReorder: (from: number, to: number) => void;
  onSelect: (id: string | number) => void;
  onEdit: (item: NoticiaItem, e: React.MouseEvent) => void;
  onRemove: (item: NoticiaItem, e: React.MouseEvent) => void;
}) => {
  const cardRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isOver, setIsOver] = useState(false)

  useEffect(() => {
    const el = cardRef.current
    if (!el) return

    const unbindDraggable = draggable({
      element: el,
      dragHandle: handleRef.current || undefined,
      getInitialData: () => ({ index, id: item.id }),
      onDragStart: () => setIsDragging(true),
      onDrop: () => setIsDragging(false),
    })

    const unbindDropTarget = dropTargetForElements({
      element: el,
      getData: () => ({ index, id: item.id }),
      onDragEnter: ({ source }) => {
        if (source.data.index !== index) setIsOver(true)
      },
      onDragLeave: () => setIsOver(false),
      onDrop: ({ source }) => {
        setIsOver(false)
        const fromIdx = source.data.index as number
        if (fromIdx !== undefined && fromIdx !== index) {
          onReorder(fromIdx, index)
        }
      },
    })

    return () => {
      unbindDraggable()
      unbindDropTarget()
    }
  }, [index, item.id, onReorder])

  const isSoloImg = item.tag === 'solo_imagen' || item.extracto === '[SOLO_IMAGEN]';

  return (
    <div
      ref={cardRef}
      onClick={() => onSelect(item.id)}
      className={`bg-white border rounded-3xl p-3.5 shadow-xs transition-all duration-300 flex flex-col justify-between group cursor-pointer relative overflow-hidden ${
        isDragging
          ? 'opacity-40 scale-95 border-dashed border-emerald-500 ring-2 ring-emerald-500/50'
          : isOver
          ? 'border-2 border-emerald-500 scale-[1.03] shadow-2xl bg-emerald-50/40 ring-4 ring-emerald-500/20 z-20'
          : 'border-slate-200/80 hover:border-emerald-400/80 hover:shadow-lg'
      }`}
    >
      <div className="space-y-2.5">
        {/* PORTADA EN CARD CON BADGES (Format Vertical Instagram / Afiche) */}
        <div className="relative w-full aspect-[3/4] bg-slate-900/5 rounded-2xl overflow-hidden border border-slate-200/60 shadow-inner flex items-center justify-center">
          {item.imagen_url ? (
            <img
              src={item.imagen_url}
              alt={item.titulo}
              className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500 ease-out"
              style={{ objectPosition: item.posicion_imagen }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-slate-400 space-y-1 p-3 text-center">
              <ImageIcon size={26} className="opacity-30" />
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-50">Sin Portada</span>
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

          {/* Badges superiores */}
          <div className="absolute top-2 left-2 flex items-center gap-1 z-10">
            <span className="bg-slate-900/80 backdrop-blur-md text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-white/20">
              {item.categoria}
            </span>
            {isSoloImg && (
              <span className="bg-emerald-600/90 backdrop-blur-md text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-white/20">
                Informativo
              </span>
            )}
          </div>
        </div>

        {/* INFORMACIÓN DE LA NOTICIA */}
        <div className="space-y-1 px-0.5">
          <div className="flex items-center justify-between gap-2 text-[10px] text-emerald-700 font-extrabold uppercase tracking-wider">
            <span>{item.fecha_evento ? item.fecha_evento : (item.fecha?.split('T')[0] || 'Sin fecha')}</span>
            {item.lugar_evento && (
              <span className="text-[10px] text-slate-400 font-bold truncate max-w-[120px]">
                {item.lugar_evento}
              </span>
            )}
          </div>

          <h4 className="text-sm font-black text-slate-800 leading-snug line-clamp-1 group-hover:text-emerald-700 transition-colors">
            {item.titulo || 'Sin Título'}
          </h4>

          {!isSoloImg && item.extracto && (
            <p className="text-[11px] text-slate-500 font-medium leading-relaxed line-clamp-1">
              {item.extracto}
            </p>
          )}
        </div>
      </div>

      {/* FOOTER DE LA CARD CON DRAG HANDLE DE PRAGMATIC DND Y BOTONES DE ACCIÓN */}
      <div className="pt-2 mt-2 border-t border-slate-100 flex items-center justify-between gap-2">
        {/* Pragmatic Drag & Drop Handle */}
        <div
          ref={handleRef}
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-emerald-100 text-slate-500 hover:text-emerald-700 font-extrabold text-[9px] uppercase tracking-wider cursor-grab active:cursor-grabbing transition-colors border border-slate-200/60 select-none"
          title="Arrastrar para reordenar"
        >
          <GripVertical size={13} className="shrink-0" />
          <span>Arrastrar</span>
        </div>

        {/* Acciones principales */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={(e) => onEdit(item, e)}
            className="p-1.5 rounded-lg text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
            title="Editar noticia"
          >
            <Edit3 size={14} />
          </button>
          <button
            type="button"
            onClick={(e) => onRemove(item, e)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
            title="Eliminar noticia"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Componente de Fila en Lista con Pragmatic Drag and Drop ──────────────────
const PragmaticNewsListItem = ({ 
  item, 
  index, 
  onReorder, 
  onSelect, 
  onEdit, 
  onRemove 
}: {
  item: NoticiaItem;
  index: number;
  onReorder: (from: number, to: number) => void;
  onSelect: (id: string | number) => void;
  onEdit: (item: NoticiaItem, e: React.MouseEvent) => void;
  onRemove: (item: NoticiaItem, e: React.MouseEvent) => void;
}) => {
  const rowRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isOver, setIsOver] = useState(false)

  useEffect(() => {
    const el = rowRef.current
    if (!el) return

    const unbindDraggable = draggable({
      element: el,
      dragHandle: handleRef.current || undefined,
      getInitialData: () => ({ index, id: item.id }),
      onDragStart: () => setIsDragging(true),
      onDrop: () => setIsDragging(false),
    })

    const unbindDropTarget = dropTargetForElements({
      element: el,
      getData: () => ({ index, id: item.id }),
      onDragEnter: ({ source }) => {
        if (source.data.index !== index) setIsOver(true)
      },
      onDragLeave: () => setIsOver(false),
      onDrop: ({ source }) => {
        setIsOver(false)
        const fromIdx = source.data.index as number
        if (fromIdx !== undefined && fromIdx !== index) {
          onReorder(fromIdx, index)
        }
      },
    })

    return () => {
      unbindDraggable()
      unbindDropTarget()
    }
  }, [index, item.id, onReorder])

  return (
    <div
      ref={rowRef}
      onClick={() => onSelect(item.id)}
      className={`p-4 flex items-center justify-between gap-4 transition-all cursor-pointer ${
        isDragging
          ? 'opacity-30 bg-emerald-50/50'
          : isOver
          ? 'bg-emerald-100/70 border-l-4 border-emerald-500 scale-[1.01]'
          : 'hover:bg-slate-50'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Handle de arrastre de Pragmatic DnD */}
        <div
          ref={handleRef}
          onClick={(e) => e.stopPropagation()}
          className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 cursor-grab active:cursor-grabbing transition-colors shrink-0"
          title="Arrastrar para reordenar"
        >
          <GripVertical size={16} />
        </div>

        {/* Thumbnail Mini */}
        <div className="w-12 h-16 bg-slate-100 rounded-xl overflow-hidden shrink-0 border border-slate-200 flex items-center justify-center">
          {item.imagen_url ? (
            <img src={item.imagen_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <ImageIcon size={18} className="text-slate-300" />
          )}
        </div>

        <div className="space-y-0.5 min-w-0 flex-1">
          <h4 className="text-sm font-bold text-slate-800 truncate">{item.titulo}</h4>
          <p className="text-xs text-slate-400 truncate">
            {item.categoria} · {item.fecha?.split('T')[0]} {item.lugar_evento ? `· ${item.lugar_evento}` : ''}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={(e) => onEdit(item, e)}
          className="p-2 rounded-xl text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
        >
          <Edit3 size={16} />
        </button>
        <button
          type="button"
          onClick={(e) => onRemove(item, e)}
          className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  )
}

// ── Panel Principal de Noticias ─────────────────────────────────────────────
export const NoticiasPanel = () => {
  const [items, setItems] = useState<NoticiaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | number | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('cms_noticias_view_mode')
      if (saved === 'grid' || saved === 'list') return saved
    }
    return 'grid'
  })

  const changeViewMode = (mode: 'grid' | 'list') => {
    setViewMode(mode)
    if (typeof window !== 'undefined') {
      localStorage.setItem('cms_noticias_view_mode', mode)
    }
  }

  const [form, setForm] = useState({ 
    titulo: '', 
    extracto: '', 
    contenido: '', 
    imagen_url: '', 
    categoria: 'Noticias', 
    tag: '', 
    fecha: '', 
    publicado: true,
    fecha_evento: '',
    hora_evento: '',
    lugar_evento: '',
    posicion_imagen: 'center center'
  })
  const [saving, setSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isHiding, setIsHiding] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [isDraggingFileInWindow, setIsDraggingFileInWindow] = useState(false)

  const dragCounter = useRef(0)

  // Detectar cuándo el usuario está arrastrando una imagen desde cualquier parte de la pantalla
  useEffect(() => {
    const handleWindowDragEnter = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes('Files')) {
        dragCounter.current += 1
        setIsDraggingFileInWindow(true)
      }
    }

    const handleWindowDragLeave = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes('Files')) {
        dragCounter.current -= 1
        if (dragCounter.current <= 0) {
          dragCounter.current = 0
          setIsDraggingFileInWindow(false)
        }
      }
    }

    const handleWindowDrop = () => {
      dragCounter.current = 0
      setIsDraggingFileInWindow(false)
    }

    window.addEventListener('dragenter', handleWindowDragEnter)
    window.addEventListener('dragleave', handleWindowDragLeave)
    window.addEventListener('drop', handleWindowDrop)

    return () => {
      window.removeEventListener('dragenter', handleWindowDragEnter)
      window.removeEventListener('dragleave', handleWindowDragLeave)
      window.removeEventListener('drop', handleWindowDrop)
    }
  }, [])

  const closeForm = () => {
    setIsHiding(true)
    setTimeout(() => {
      setSelectedId(null)
      setIsEditing(false)
      setIsHiding(false)
    }, 180)
  }

  const uploadImage = async (file: File) => {
    setUploadError(null)
    setUploading(true)
    try {
      const publicUrl = await uploadFileStorage(file, 'noticias')
      setForm((p) => ({ ...p, imagen_url: publicUrl }))
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Error al subir archivo')
    } finally {
      setUploading(false)
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.get('/api/cms/noticias')
      if (data.success && Array.isArray(data.data)) {
        const mapped: NoticiaItem[] = data.data.map((x: any) => ({
          id: x.id_noticia,
          titulo: x.titulo || '',
          contenido: x.contenido || '',
          extracto: x.resumen || '',
          imagen_url: x.imagen_url || '',
          categoria: x.categoria || 'Noticias',
          tag: x.tag || '',
          fecha: x.fecha_publicacion || '',
          publicado: x.publicado === 1 || x.publicado === true,
          fecha_evento: x.fecha_evento || '',
          hora_evento: x.hora_evento || '',
          lugar_evento: x.lugar_evento || '',
          posicion_imagen: x.posicion_imagen || 'center center',
          orden: x.orden !== undefined && x.orden !== null ? Number(x.orden) : 0
        }))
        setItems(mapped)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const openEdit = (item: NoticiaItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setSelectedId(item.id)
    setForm({ 
      titulo: item.titulo, 
      extracto: item.extracto, 
      contenido: item.contenido, 
      imagen_url: item.imagen_url || '', 
      categoria: item.categoria, 
      tag: item.tag || '', 
      fecha: item.fecha?.split('T')[0] || '', 
      publicado: item.publicado === 1 || item.publicado === true,
      fecha_evento: item.fecha_evento || '',
      hora_evento: item.hora_evento || '',
      lugar_evento: item.lugar_evento || '',
      posicion_imagen: item.posicion_imagen || 'center center'
    })
    setIsEditing(true)
  }

  const openNew = () => {
    setSelectedId('new')
    setForm({ 
      titulo: '', 
      extracto: '', 
      contenido: '', 
      imagen_url: '', 
      categoria: 'Noticias', 
      tag: '', 
      fecha: new Date().toISOString().split('T')[0], 
      publicado: true,
      fecha_evento: '',
      hora_evento: '',
      lugar_evento: '',
      posicion_imagen: 'center center'
    })
    setIsEditing(true)
  }

  const save = async () => {
    setSaving(true)
    try {
      const isSoloImagen = form.tag === 'solo_imagen' || form.extracto === '[SOLO_IMAGEN]';
      const payload = {
        titulo: form.titulo.trim() || (isSoloImagen ? 'Afiche Informativo' : 'Sin título'),
        contenido: isSoloImagen ? '' : form.contenido,
        resumen: isSoloImagen ? '[SOLO_IMAGEN]' : form.extracto,
        imagen_url: form.imagen_url,
        categoria: form.categoria || 'Noticias',
        tag: isSoloImagen ? 'solo_imagen' : form.tag,
        publicado: form.publicado,
        fecha_evento: form.fecha_evento || null,
        hora_evento: form.hora_evento || null,
        lugar_evento: form.lugar_evento || null,
        posicion_imagen: form.posicion_imagen
      }

      const res = selectedId === 'new' 
        ? await api.post('/api/cms/noticias', payload)
        : await api.put(`/api/cms/noticias/${selectedId}`, payload)

      if (res.success) {
        setSelectedId(null)
        setIsEditing(false)
        load()
      } else {
        alert(res.message || 'Error al guardar la noticia')
      }
    } catch (error) {
      console.error(error)
      alert('Error de conexión con el servidor')
    } finally {
      setSaving(false)
    }
  }

  const [itemToDelete, setItemToDelete] = useState<NoticiaItem | null>(null)
  const [deletingNoticia, setDeletingNoticia] = useState(false)

  const remove = (item: NoticiaItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setItemToDelete(item)
  }

  const confirmDeleteNoticia = async () => {
    if (!itemToDelete || deletingNoticia) return
    setDeletingNoticia(true)
    try {
      await api.delete(`/api/cms/noticias/${itemToDelete.id}`)
      if (String(selectedId) === String(itemToDelete.id)) {
        setSelectedId(null)
        setIsEditing(false)
      }
      setItemToDelete(null)
      load()
    } catch (error) {
      console.error(error)
      alert('Error de conexión al eliminar la noticia')
    } finally {
      setDeletingNoticia(false)
    }
  }

  // Handler de reordenamiento con Pragmatic Drag and Drop
  const handleReorder = useCallback(async (sourceIndex: number, targetIndex: number) => {
    if (sourceIndex === targetIndex) return

    setItems(prevItems => {
      const currentFiltered = prevItems.filter(item => {
        return searchQuery === '' || 
          item.titulo.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.categoria.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.extracto.toLowerCase().includes(searchQuery.toLowerCase());
      })

      const sourceItem = currentFiltered[sourceIndex]
      const targetItem = currentFiltered[targetIndex]
      if (!sourceItem || !targetItem) return prevItems

      const newItems = [...prevItems]
      const sourceRealIdx = newItems.findIndex(i => String(i.id) === String(sourceItem.id))
      const targetRealIdx = newItems.findIndex(i => String(i.id) === String(targetItem.id))

      if (sourceRealIdx !== -1 && targetRealIdx !== -1) {
        const [itemToMove] = newItems.splice(sourceRealIdx, 1)
        newItems.splice(targetRealIdx, 0, itemToMove)

        // API update in background
        api.put('/api/cms/noticias/reorder', {
          items: newItems.map((item, idx) => ({ id: item.id, orden: idx + 1 }))
        }).catch(err => console.error('Error al guardar nuevo orden:', err))

        return newItems
      }
      return prevItems
    })
  }, [searchQuery])

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(p => ({ ...p, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }))

  const filteredItems = items.filter(item => {
    return searchQuery === '' || 
      item.titulo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.categoria.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.extracto.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Formulario de edición/creación
  const renderForm = () => (
    <div className={`flex flex-col gap-6 bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-xl max-w-5xl mx-auto transition-colors duration-200 ${
      isHiding ? 'opacity-0 scale-95 -translate-x-4 pointer-events-none' : 'animate-in fade-in zoom-in-95 duration-200'
    }`}>
      {/* Encabezado del Formulario */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 pb-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={closeForm}
            className="p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors transition-transform hover:scale-105 active:scale-95 border border-slate-200/60 shadow-xs cursor-pointer shrink-0"
            title="Volver a la lista"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h3 className="text-xl font-black text-slate-800 tracking-tight">
              {selectedId === 'new' ? 'Nueva Noticia' : 'Editar Noticia'}
            </h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              Publicación en Portal Web de la Cámara
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setForm(p => ({ ...p, publicado: !p.publicado }))}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-black transition-all cursor-pointer shadow-xs ${
              form.publicado
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200'
            }`}
            title={form.publicado ? 'Noticia visible en el portal web (Clic para ocultar)' : 'Noticia oculta en el portal web (Clic para mostrar)'}
          >
            {form.publicado ? <Eye size={16} /> : <EyeOff size={16} />}
            <span>{form.publicado ? 'Visible en Web' : 'Oculto en Web'}</span>
          </button>
        </div>
      </div>

      {/* Grid Principal: Izquierda Formulario / Derecha Previsualización de Portada */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* COLUMNA IZQUIERDA: Campos de la noticia (7 columnas) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Opción Solo Imagen (Afiche / Volante / Anuncio Visual) */}
          <div className="bg-gradient-to-r from-emerald-50 via-teal-50/60 to-emerald-50 border border-emerald-200/80 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-xs">
            <div className="space-y-0.5">
              <p className="font-extrabold text-xs sm:text-sm text-slate-800 flex items-center gap-2">
                <span>Modo Informativo (Afiche / Volante)</span>
              </p>
              <p className="text-[11px] text-slate-500 font-medium">
                Muestra la imagen subida en grande sin texto ni título debajo en el portal web.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={form.tag === 'solo_imagen' || form.extracto === '[SOLO_IMAGEN]'}
                onChange={(e) => {
                  const checked = e.target.checked
                  setForm(p => ({
                    ...p,
                    tag: checked ? 'solo_imagen' : p.tag === 'solo_imagen' ? '' : p.tag,
                    extracto: checked ? '[SOLO_IMAGEN]' : p.extracto === '[SOLO_IMAGEN]' ? '' : p.extracto,
                    contenido: checked ? '' : p.contenido,
                    titulo: checked && !p.titulo ? 'Afiche Informativo' : p.titulo
                  }))
                }}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-colors peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          <FormField label={form.tag === 'solo_imagen' ? 'Título / Identificación Interna (Opcional)' : 'Título de la Noticia'}>
            <Input 
              value={form.titulo} 
              onChange={f('titulo')} 
              placeholder={form.tag === 'solo_imagen' ? 'Ej. Afiche de Conferencia Marzo...' : 'Ej. Nuevas tendencias del mercado inmobiliario...'} 
              className="!text-sm !py-3 bg-slate-50/70 border-slate-200 focus:bg-white transition-colors font-bold"
            />
          </FormField>

          <FormField label="Categoría">
            <Input 
              value={form.categoria} 
              onChange={f('categoria')} 
              placeholder="Noticias, Eventos..." 
              className="!text-xs !py-2.5 bg-slate-50/70 border-slate-200" 
            />
          </FormField>

          {form.tag !== 'solo_imagen' && (
            <>
              <FormField label="Extracto / Resumen Corto (Aparece en la Tarjeta)">
                <Textarea 
                  value={form.extracto} 
                  onChange={f('extracto')} 
                  placeholder="Breve resumen de 1 a 2 líneas para la tarjeta de la landing..." 
                  rows={2} 
                  className="!text-sm bg-slate-50/70 border-slate-200 focus:bg-white transition-colors resize-none font-medium"
                />
              </FormField>

              <FormField label="Cuerpo / Contenido Completo">
                <Textarea 
                  value={form.contenido} 
                  onChange={f('contenido')} 
                  placeholder="Escriba aquí el contenido detallado de la noticia..." 
                  rows={6} 
                  className="!text-sm bg-slate-50/70 border-slate-200 focus:bg-white transition-colors resize-y min-h-[140px]"
                />
              </FormField>
            </>
          )}

        </div>

        {/* COLUMNA DERECHA: Carga de Imagen y Vista Previa Real en Landing (5 columnas) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-600">
                Imagen de Portada
              </span>
              {form.imagen_url && (
                <button 
                  onClick={() => setForm(p => ({ ...p, imagen_url: '' }))}
                  className="flex items-center gap-1 text-[10px] font-bold text-rose-500 hover:text-rose-700 transition-colors"
                >
                  <Trash2 size={12} />
                  Quitar imagen
                </button>
              )}
            </div>

            {/* Zona de Drop & Upload */}
            <div className="relative group">
              <input
                type="file"
                accept="image/*,.svg,.png,.jpg,.jpeg,.webp"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) uploadImage(file)
                }}
                disabled={uploading}
                onDragEnter={() => setIsDraggingOver(true)}
                onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true) }}
                onDragLeave={() => setIsDraggingOver(false)}
                onDrop={() => setIsDraggingOver(false)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-30 disabled:cursor-not-allowed"
              />
              <div className={`relative flex flex-col items-center justify-center py-6 px-4 border-2 border-dashed rounded-2xl transition-all duration-300 ${
                uploading 
                  ? 'border-emerald-300 bg-emerald-50/50' 
                  : isDraggingOver
                    ? 'border-emerald-600 bg-emerald-100 scale-[1.04] shadow-2xl shadow-emerald-500/30 ring-4 ring-emerald-500/40'
                    : isDraggingFileInWindow
                      ? 'border-emerald-500 bg-emerald-50/90 scale-[1.02] shadow-xl shadow-emerald-500/20 ring-4 ring-emerald-500/30 animate-pulse'
                      : form.imagen_url 
                        ? 'border-emerald-300 bg-emerald-50/20' 
                        : 'border-slate-200 group-hover:border-emerald-400 group-hover:bg-emerald-50/10'
              }`}>
                {/* Banner de animación cuando la página detecta arrastre de archivo en pantalla */}
                {isDraggingFileInWindow && !uploading && (
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/15 via-teal-500/10 to-emerald-600/20 rounded-2xl flex flex-col items-center justify-center text-center p-4 backdrop-blur-[2px] z-20 pointer-events-none border-2 border-emerald-500 animate-in fade-in zoom-in-95 duration-200">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-600/40 animate-bounce mb-2">
                      <Upload size={24} />
                    </div>
                    <p className="text-sm font-black text-emerald-950 uppercase tracking-wider">
                      {isDraggingOver ? '¡Suelta la imagen ahora!' : '¡Suelta tu imagen aquí!'}
                    </p>
                    <p className="text-[11px] text-emerald-700 font-extrabold mt-0.5">
                      PNG, JPG, WEBP recomendados
                    </p>
                  </div>
                )}

                {uploading ? (
                  <div className="flex flex-col items-center gap-2 py-2">
                    <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-[11px] font-bold text-emerald-700">Subiendo archivo...</span>
                  </div>
                ) : form.imagen_url ? (
                  <div className="flex items-center gap-2 py-1">
                    <CheckCircle size={16} className="text-emerald-500" />
                    <span className="text-xs font-bold text-emerald-700">Imagen cargada correctamente</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase ml-2">(Clic para reemplazar)</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center py-2 text-center">
                    <Upload size={22} className="text-slate-400 group-hover:text-emerald-500 transition-colors mb-1.5" />
                    <p className="text-xs font-bold text-slate-700">Seleccionar o arrastrar imagen</p>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">PNG, JPG, WEBP recomendados</p>
                  </div>
                )}
              </div>
            </div>
            {uploadError && <p className="text-[11px] text-rose-600 font-bold px-2">× {uploadError}</p>}
          </div>

          {/* VISTA PREVIA REALISTA DE LA TARJETA EN LA LANDING */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-700">
                Vista previa de la Tarjeta (Landing Page)
              </span>
              <span className="text-[9px] font-extrabold uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                Foco Real
              </span>
            </div>

            {/* Simulación exacta de la card vertical en la Landing */}
            <div className="w-full max-w-[300px] mx-auto bg-white border border-slate-200/80 rounded-[2.5rem] p-4 shadow-md space-y-3 flex flex-col">
              <div className="relative w-full aspect-[3/4] bg-slate-900/5 rounded-[2rem] overflow-hidden shadow-inner flex items-center justify-center border border-slate-200/60">
                {form.imagen_url ? (
                  <img 
                    src={form.imagen_url} 
                    alt="Preview Noticia" 
                    className="w-full h-full object-contain transition-all duration-300"
                    style={{ objectPosition: form.posicion_imagen }}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-400 space-y-1">
                    <Upload size={28} className="opacity-40" />
                    <span className="text-[11px] font-bold uppercase tracking-wider opacity-60">Sin portada</span>
                  </div>
                )}
              </div>

              {/* Simulación del contenido de la tarjeta */}
              <div className="space-y-2 px-1 pt-1">
                <div className="flex items-center justify-between gap-2 text-[10px] text-emerald-600 font-black uppercase tracking-[0.2em]">
                  <span>{form.fecha_evento ? form.fecha_evento : (form.fecha?.split('T')[0] || 'Próximamente')}</span>
                  {form.lugar_evento && (
                    <span className="text-[10px] text-slate-400 font-bold truncate max-w-[120px]">{form.lugar_evento}</span>
                  )}
                </div>
                <h4 className="text-base sm:text-lg font-bold text-[#022c22] leading-tight line-clamp-2">
                  {form.titulo || 'Título de la Noticia...'}
                </h4>
                {form.tag !== 'solo_imagen' && (
                  <p className="text-xs text-slate-500 line-clamp-2 font-normal leading-relaxed">
                    {form.extracto || 'Extracto de la noticia...'}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Barra de Acciones */}
      <div className="flex items-center justify-end gap-3 pt-5 border-t border-slate-100">
        <BtnSecondary 
          onClick={closeForm}
          className="!rounded-2xl !px-6 !py-3 font-bold"
        >
          Cancelar
        </BtnSecondary>
        <BtnPrimary 
          onClick={save} 
          disabled={saving || uploading}
          className="!rounded-2xl !px-8 !py-3 font-bold shadow-lg shadow-emerald-500/20"
        >
          {saving ? 'Guardando Noticia...' : (selectedId === 'new' ? 'Crear Noticia' : 'Guardar Cambios')}
        </BtnPrimary>
      </div>
    </div>
  );

  // Detalle individual cuando se selecciona una card
  const selectedItem = items.find(i => String(i.id) === String(selectedId));

  if (isEditing || selectedId === 'new') {
    return (
      <div className="p-4 sm:p-6 min-h-full bg-slate-50/50">
        {renderForm()}
      </div>
    );
  }

  if (selectedId !== null && selectedItem) {
    return (
      <div className="p-4 sm:p-6 min-h-full bg-slate-50/50 max-w-5xl mx-auto space-y-5">
        <button
          onClick={() => setSelectedId(null)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white border border-slate-200 text-slate-700 text-xs font-extrabold hover:bg-slate-100 transition-all cursor-pointer shadow-xs"
        >
          <ArrowLeft size={16} />
          Volver a Noticias (Cards)
        </button>

        <div className="flex flex-col gap-6 bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-sm">
          {/* Header Bar */}
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3.5">
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors transition-transform hover:scale-105 active:scale-95 border border-slate-200/60 shadow-xs cursor-pointer shrink-0"
                title="Volver a las noticias"
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">
                  {selectedItem.categoria} · {selectedItem.fecha?.split('T')[0]}
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-slate-800 leading-tight mt-0.5">{selectedItem.titulo}</h3>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <BtnSecondary onClick={() => openEdit(selectedItem)}>Editar</BtnSecondary>
              <BtnDanger onClick={() => remove(selectedItem)}>Eliminar</BtnDanger>
            </div>
          </div>

          {/* 2 Columns: Left Photo / Right Details */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            {/* Left Column: Photo / Vertical Poster */}
            {selectedItem.imagen_url ? (
              <div className="md:col-span-5 lg:col-span-5 w-full aspect-[3/4] bg-slate-50 rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm flex items-center justify-center">
                <img 
                  src={selectedItem.imagen_url} 
                  alt={selectedItem.titulo} 
                  className="w-full h-full object-contain transition-colors duration-300" 
                  style={{ objectPosition: selectedItem.posicion_imagen }}
                />
              </div>
            ) : (
              <div className="md:col-span-5 lg:col-span-5 w-full aspect-[3/4] bg-slate-100 rounded-2xl border border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 p-4 text-center">
                <ImageIcon size={36} className="opacity-40 mb-2" />
                <span className="text-xs font-bold uppercase tracking-wider">Sin portada</span>
              </div>
            )}

            {/* Right Column: Information & Body */}
            <div className={`space-y-4 ${selectedItem.imagen_url ? 'md:col-span-7 lg:col-span-7' : 'md:col-span-12'}`}>
              {(selectedItem.fecha_evento || selectedItem.hora_evento || selectedItem.lugar_evento) && (
                <div className="bg-emerald-50/70 rounded-2xl p-4 border border-emerald-100 text-xs text-emerald-950 space-y-2 shadow-xs">
                  <span className="font-black uppercase tracking-wider block text-[10px] text-emerald-700">Detalles Destacados del Evento:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-semibold">
                    {selectedItem.fecha_evento && <div className="flex items-center gap-1.5"><Calendar size={13} className="text-emerald-600 shrink-0" /> <strong>Fecha:</strong> {selectedItem.fecha_evento}</div>}
                    {selectedItem.hora_evento && <div className="flex items-center gap-1.5"><Clock size={13} className="text-emerald-600 shrink-0" /> <strong>Hora:</strong> {selectedItem.hora_evento}</div>}
                    {selectedItem.lugar_evento && <div className="sm:col-span-2 flex items-center gap-1.5"><MapPin size={13} className="text-emerald-600 shrink-0" /> <strong>Lugar:</strong> {selectedItem.lugar_evento}</div>}
                  </div>
                </div>
              )}

              {selectedItem.extracto && selectedItem.tag !== 'solo_imagen' && (
                <p className="text-sm text-slate-700 leading-relaxed font-bold border-l-4 border-emerald-500 pl-3 py-1 italic bg-slate-50/50 rounded-r-xl">
                  {selectedItem.extracto}
                </p>
              )}

              {selectedItem.contenido && selectedItem.tag !== 'solo_imagen' && (
                <div className="text-xs text-slate-600 leading-relaxed whitespace-pre-line border-t border-slate-100 pt-3">
                  <span className="font-bold text-slate-800 block mb-1">Cuerpo Completo:</span>
                  {selectedItem.contenido}
                </div>
              )}

              <div className="flex flex-wrap gap-2 text-xs text-slate-400 pt-2 border-t border-slate-100">
                <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase">{selectedItem.categoria}</span>
                {selectedItem.tag && <span className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border border-emerald-100">#{selectedItem.tag}</span>}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Vista Principal de Noticias: Cards Grid con Previews Visuales y Pragmatic Drag and Drop
  return (
    <div className="p-4 sm:p-5 pb-16 sm:pb-24 min-h-full space-y-4 max-w-[1600px] mx-auto">
      {/* BANNER / BARRA SUPERIOR UNIFICADA DE CONTROL Y BÚSQUEDA */}
      <CmsPanelHeader
        icon={<Newspaper size={22} />}
        title="Noticias & Publicaciones"
        subtitle="Administra las noticias, afiches y eventos del portal web"
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Buscar por título, categoría..."
        viewMode={viewMode}
        onViewModeChange={changeViewMode}
        actionButtonText="Nueva Noticia"
        onActionClick={openNew}
      />

      {/* ESTADO DE CARGA */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-100">
          <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cargando noticias...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-slate-200 text-center px-4">
          <ImageIcon size={44} className="text-slate-300 mb-3" />
          <h3 className="text-base font-extrabold text-slate-700 mb-1">No se encontraron noticias</h3>
          <p className="text-xs text-slate-400 max-w-sm mb-4">
            {searchQuery 
              ? 'Prueba cambiando la búsqueda.' 
              : 'Empieza publicando la primera noticia o afiche para la landing.'}
          </p>
          <button
            onClick={openNew}
            className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors"
          >
            + Crear Noticia
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* VISTA GRID CON CARDS PRAGMATIC DRAG AND DROP */
        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-12">
          {filteredItems.map((item, index) => (
            <PragmaticNewsCard
              key={item.id}
              item={item}
              index={index}
              onReorder={handleReorder}
              onSelect={(id) => setSelectedId(id)}
              onEdit={openEdit}
              onRemove={remove}
            />
          ))}
        </div>
      ) : (
        /* VISTA LISTA COMPACTA CON PRAGMATIC DRAG AND DROP */
        <div className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-xs divide-y divide-slate-100">
          {filteredItems.map((item, index) => (
            <PragmaticNewsListItem
              key={item.id}
              item={item}
              index={index}
              onReorder={handleReorder}
              onSelect={(id) => setSelectedId(id)}
              onEdit={openEdit}
              onRemove={remove}
            />
          ))}
        </div>
      )}

      {/* Modal de confirmación de eliminación (Esquema Control de Acceso) */}
      {itemToDelete && createPortal(
        <div className='fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm'>
          <div className='transition-opacity transition-transform bg-white rounded-2xl shadow-2xl border border-slate-100 p-8 w-full max-w-sm fade-in zoom-in duration-200 text-center'>
            <div className='w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 mx-auto mb-4'>
              <Trash2 size={32} />
            </div>
            <h3 className='text-lg font-black text-slate-800 mb-2'>¿Eliminar noticia?</h3>
            <p className='text-sm text-slate-500 mb-6'>
              Estás a punto de eliminar <span className='font-bold text-slate-700'>{itemToDelete.titulo || 'esta noticia'}</span>. Esta acción no se puede deshacer.
            </p>
            
            <div className='flex flex-col gap-2'>
              <button
                type='button'
                disabled={deletingNoticia}
                onClick={confirmDeleteNoticia}
                className='w-full py-3 bg-rose-500 text-white rounded-xl text-sm font-black hover:bg-rose-600 disabled:opacity-50 shadow-lg shadow-rose-500/25 transition-colors transition-opacity flex items-center justify-center gap-2 cursor-pointer'
              >
                {deletingNoticia ? <Loader2 size={18} className='animate-spin' /> : <Trash2 size={18} />}
                <span>Confirmar Eliminación</span>
              </button>
              <button 
                type='button' 
                onClick={() => setItemToDelete(null)} 
                className='w-full py-3 text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors cursor-pointer'
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
