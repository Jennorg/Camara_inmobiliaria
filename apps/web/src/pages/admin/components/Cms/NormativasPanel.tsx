import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { FileText, Upload, FolderSearch, CheckCircle, Edit, Trash2, GripVertical, ArrowUp, ArrowDown, Eye, EyeOff, ArrowLeft, ExternalLink, Loader2 } from 'lucide-react'
import { api, FormField, Input, Textarea, BtnPrimary, BtnDanger, BtnSecondary, ListDetail, uploadFileStorage, CmsPanelHeader } from '@/pages/admin/components/Cms/CmsShared'

interface NormativaItem {
  id: string | number
  titulo: string
  descripcion: string | null
  url_archivo: string
  categoria: string | null
  orden: number
  activo: boolean | number
}

export const NormativasPanel = ({ fixedCategory }: { fixedCategory?: string }) => {
  const [items, setItems] = useState<NormativaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | number | null>(null)
  const [activeTab, setActiveTab] = useState<string>(fixedCategory || 'Todas')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('cms_view_mode_normativas')
      if (saved === 'grid' || saved === 'list') return saved
    }
    return 'grid'
  })

  const changeViewMode = (mode: 'grid' | 'list') => {
    setViewMode(mode)
    if (typeof window !== 'undefined') {
      localStorage.setItem('cms_view_mode_normativas', mode)
    }
  }
  const [form, setForm] = useState({
    titulo: '',
    descripcion: '',
    url_archivo: '',
    categoria: fixedCategory || '',
    orden: 0,
    activo: true,
  })
  const [saving, setSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [fileUpload, setFileUpload] = useState({
    uploading: false,
    error: null as string | null,
    fileName: null as string | null,
    isDraggingOver: false,
  })
  const [isDraggingFileInWindow, setIsDraggingFileInWindow] = useState(false)
  const dragCounter = useRef(0)

  // Detectar cuándo el usuario está arrastrando un archivo en la ventana del navegador
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

  const uploading = fileUpload.uploading
  const uploadError = fileUpload.error
  const uploadedFileName = fileUpload.fileName
  const isDraggingOver = fileUpload.isDraggingOver

  const setUploading = (uploading: boolean) => setFileUpload(f => ({ ...f, uploading }))
  const setUploadError = (error: string | null) => setFileUpload(f => ({ ...f, error }))
  const setUploadedFileName = (fileName: string | null) => setFileUpload(f => ({ ...f, fileName }))
  const setIsDraggingOver = (isDraggingOver: boolean) => setFileUpload(f => ({ ...f, isDraggingOver }))

  const [deleteState, setDeleteState] = useState({
    selectedIds: [] as (string | number)[],
    deletingBatch: false,
    itemToDelete: null as NormativaItem | null,
    showBatchDeleteModal: false,
  })

  const selectedIds = deleteState.selectedIds
  const deletingBatch = deleteState.deletingBatch
  const itemToDelete = deleteState.itemToDelete
  const showBatchDeleteModal = deleteState.showBatchDeleteModal

  const setSelectedIds = (updater: (string | number)[] | ((prev: (string | number)[]) => (string | number)[])) => setDeleteState(d => ({ ...d, selectedIds: typeof updater === 'function' ? updater(d.selectedIds) : updater }))
  const setDeletingBatch = (deletingBatch: boolean) => setDeleteState(d => ({ ...d, deletingBatch }))
  const setItemToDelete = (itemToDelete: NormativaItem | null) => setDeleteState(d => ({ ...d, itemToDelete }))
  const setShowBatchDeleteModal = (showBatchDeleteModal: boolean) => setDeleteState(d => ({ ...d, showBatchDeleteModal }))
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [isHiding, setIsHiding] = useState(false)

  const closeForm = () => {
    setIsHiding(true)
    setTimeout(() => {
      setSelectedId(null)
      setIsEditing(false)
      setIsHiding(false)
    }, 180)
  }

  const persistReorder = async (reordered: NormativaItem[]) => {
    const sorted = [...reordered].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
    setItems(sorted)
    try {
      await api.put('/api/cms/normativas-reorder', {
        items: sorted.map((it, idx) => ({ id: it.id, orden: idx }))
      })
    } catch (e) {
      console.error('Error reordering normativas:', e)
    }
  }

  const moveUp = (index: number) => {
    if (index <= 0) return
    const newFiltered = [...filteredItems]
    const temp = newFiltered[index]
    newFiltered[index] = newFiltered[index - 1]
    newFiltered[index - 1] = temp

    const updatedItems = [...items]
    newFiltered.forEach((item, idx) => {
      const globalIdx = updatedItems.findIndex(x => String(x.id) === String(item.id))
      if (globalIdx !== -1) updatedItems[globalIdx] = { ...item, orden: idx }
    })
    persistReorder(updatedItems)
  }

  const moveDown = (index: number) => {
    if (index >= filteredItems.length - 1) return
    const newFiltered = [...filteredItems]
    const temp = newFiltered[index]
    newFiltered[index] = newFiltered[index + 1]
    newFiltered[index + 1] = temp

    const updatedItems = [...items]
    newFiltered.forEach((item, idx) => {
      const globalIdx = updatedItems.findIndex(x => String(x.id) === String(item.id))
      if (globalIdx !== -1) updatedItems[globalIdx] = { ...item, orden: idx }
    })
    persistReorder(updatedItems)
  }

  const handleDrop = (srcIdx: number, dropIndex: number) => {
    if (srcIdx === dropIndex || srcIdx < 0 || srcIdx >= filteredItems.length) return
    const newFiltered = [...filteredItems]
    const [moved] = newFiltered.splice(srcIdx, 1)
    newFiltered.splice(dropIndex, 0, moved)

    const updatedItems = [...items]
    newFiltered.forEach((item, idx) => {
      const globalIdx = updatedItems.findIndex(x => String(x.id) === String(item.id))
      if (globalIdx !== -1) updatedItems[globalIdx] = { ...item, orden: idx }
    })
    setDraggedIndex(null)
    persistReorder(updatedItems)
  }

  const toggleSelect = (id: string | number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredItems.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(filteredItems.map(it => it.id))
    }
  }

  const busyBatchRemoveRef = useRef(false)
  const confirmRemoveBatch = async () => {
    if (selectedIds.length === 0 || busyBatchRemoveRef.current) return
    busyBatchRemoveRef.current = true
    setDeletingBatch(true)
    try {
      const res = await api.post('/api/cms/normativas-batch-delete', { ids: selectedIds })
      if (res.success) {
        setSelectedIds([])
        setSelectedId(null)
        setIsEditing(false)
        setShowBatchDeleteModal(false)
        load()
      } else {
        alert(res.message || 'Error al eliminar documentos')
      }
    } catch (e) {
      console.error(e)
      alert('Error de conexión al eliminar los documentos seleccionados')
    } finally {
      setDeletingBatch(false)
      busyBatchRemoveRef.current = false
    }
  }

  const busySingleRemoveRef = useRef(false)
  const confirmRemoveSingle = async () => {
    if (!itemToDelete || busySingleRemoveRef.current) return
    busySingleRemoveRef.current = true
    const id = itemToDelete.id
    try {
      await api.delete(`/api/cms/normativas/${id}`)
      setSelectedId(null)
      setSelectedIds(prev => prev.filter(i => i !== id))
      setItemToDelete(null)
      load()
    } catch (e) {
      console.error(e)
      alert('Error de conexión al eliminar el documento')
    } finally {
      busySingleRemoveRef.current = false
    }
  }

  const tabs = ['Todas', 'Leyes y Decretos', 'Reglamentos y Estatutos', 'Normas y Procedimientos', 'Actas de Asamblea', 'Otros']

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.get('/api/cms/normativas')
      if (data.success && Array.isArray(data.data)) {
        setItems(data.data.map((it: any) => ({ ...it, id: it.id_normativa })))
      }
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const [prevFixedCategory, setPrevFixedCategory] = useState(fixedCategory)
  if (prevFixedCategory !== fixedCategory) {
    setPrevFixedCategory(fixedCategory)
    if (fixedCategory) {
      setActiveTab(fixedCategory)
      setForm(p => ({ ...p, categoria: fixedCategory }))
      setSelectedId(null)
      setIsEditing(false)
      setSelectedIds([])
    }
  }

  const openEdit = (item: NormativaItem) => {
    setSelectedId(item.id)
    setForm({
      titulo: item.titulo,
      descripcion: item.descripcion ?? '',
      url_archivo: item.url_archivo,
      categoria: item.categoria ?? '',
      orden: item.orden,
      activo: item.activo === 1 || item.activo === true,
    })
    setIsEditing(true)
    if (item.url_archivo) {
      const fileName = item.url_archivo.split('/').pop() || 'documento.pdf'
      setUploadedFileName(fileName)
    } else {
      setUploadedFileName(null)
    }
  }

  // Efecto para poblar el formulario cuando cambia la selección
  useEffect(() => {
    if (selectedId && selectedId !== 'new') {
      const item = items.find(it => String(it.id) === String(selectedId))
      if (item) {
        setForm({
          titulo: item.titulo,
          descripcion: item.descripcion ?? '',
          url_archivo: item.url_archivo,
          categoria: item.categoria ?? '',
          orden: item.orden,
          activo: item.activo === 1 || item.activo === true,
        })
        if (item.url_archivo) {
          const fileName = item.url_archivo.split('/').pop() || 'documento.pdf'
          setUploadedFileName(fileName)
        } else {
          setUploadedFileName(null)
        }
      }
    }
  }, [selectedId, items])

  const openNew = () => {
    setSelectedId('new')
    setForm({ 
      titulo: '', 
      descripcion: '', 
      url_archivo: '', 
      categoria: fixedCategory || (activeTab !== 'Todas' ? activeTab : ''), 
      orden: items.length, 
      activo: true 
    })
    setIsEditing(true)
    setUploadedFileName(null)
  }

  const busySaveRef = useRef(false)
  const save = async () => {
    if (saving || busySaveRef.current) return
    busySaveRef.current = true
    setSaving(true)
    try {
      const res = selectedId === 'new' 
        ? await api.post('/api/cms/normativas', form)
        : await api.put(`/api/cms/normativas/${selectedId}`, form)

      if (res.success) {
        setSelectedId(null)
        setIsEditing(false)
        load()
      } else {
        alert(res.message || 'Error al guardar el documento')
      }
    } catch (error) {
      console.error(error)
      alert('Error de conexión con el servidor')
    } finally {
      setSaving(false)
      busySaveRef.current = false
    }
  }

  const remove = (item: NormativaItem) => {
    setItemToDelete(item)
  }

  const toggleVisibility = async (item: NormativaItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    const newActivo = !(item.activo === 1 || item.activo === true)
    setItems(prev => prev.map(it => String(it.id) === String(item.id) ? { ...it, activo: newActivo } : it))
    try {
      await api.put(`/api/cms/normativas/${item.id}`, {
        titulo: item.titulo,
        descripcion: item.descripcion,
        url_archivo: item.url_archivo,
        categoria: item.categoria,
        orden: item.orden,
        activo: newActivo
      })
    } catch (err) {
      console.error('Error toggling visibility:', err)
      load()
    }
  }

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    let val = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.type === 'number' ? Number(e.target.value) : e.target.value;
    if (k === 'titulo' && typeof val === 'string') {
      val = val.toUpperCase();
    }
    setForm((p) => ({
      ...p,
      [k]: val,
    }));
  };

  const uploadFile = async (file: File) => {
    setUploadError(null)
    setUploading(true)
    try {
      setUploadedFileName(file.name)
      const publicUrl = await uploadFileStorage(file, 'normativas')
      setForm((p) => ({ ...p, url_archivo: publicUrl }))
    } catch (e) {
      setUploadedFileName(null)
      setUploadError(e instanceof Error ? e.message : 'Error al subir archivo')
    } finally {
      setUploading(false)
    }
  }

  const filteredItems = items.filter(it => {
    const matchesTab = activeTab === 'Todas' || it.categoria === activeTab
    const matchesSearch = searchQuery === '' ||
      it.titulo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (it.categoria && it.categoria.toLowerCase().includes(searchQuery.toLowerCase()))
    return matchesTab && matchesSearch
  })

  const formBody = () => (
    <div className={`flex flex-col gap-6 bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-xl transition-colors duration-200 ${
      isHiding ? 'opacity-0 scale-95 -translate-x-4 pointer-events-none' : 'animate-in fade-in zoom-in-95 duration-200'
    }`}>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 pb-4 mb-2">
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
              {selectedId === 'new' ? 'Nuevo Documento' : 'Editar Documento'}
            </h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">Marco Legal de la Cámara</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setForm(p => ({ ...p, activo: !p.activo }))}
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-black transition-all cursor-pointer shadow-xs ${
            form.activo
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
              : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200'
          }`}
          title={form.activo ? 'Documento visible en el portal web (Clic para ocultar)' : 'Documento oculto en el portal web (Clic para mostrar)'}
        >
          {form.activo ? <Eye size={16} /> : <EyeOff size={16} />}
          <span>{form.activo ? 'Visible en Web' : 'Oculto en Web'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="md:col-span-2">
          <FormField label="Título del Documento">
            <Input 
              value={form.titulo} 
              onChange={f('titulo')} 
              placeholder="Ej. Ley de Arrendamiento Inmobiliario" 
              className="!text-sm !py-3 !text-slate-800 bg-slate-50/50 border-slate-200 focus:bg-white transition-colors font-bold"
            />
          </FormField>
        </div>

        <div className="md:col-span-2">
          <FormField label="Documento PDF / Archivo">
            <div 
              onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
              onDragLeave={() => setIsDraggingOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDraggingOver(false);
                const file = e.dataTransfer.files?.[0];
                if (file) uploadFile(file);
              }}
              className={[
                "relative border-2 border-dashed rounded-2xl p-6 text-center transition-all duration-300 cursor-pointer flex flex-col items-center justify-center gap-3 overflow-hidden",
                uploading 
                  ? "border-emerald-400 bg-emerald-100" 
                  : isDraggingOver
                    ? "border-emerald-600 bg-emerald-100 scale-[1.03] shadow-2xl shadow-emerald-500/30 ring-4 ring-emerald-500/40"
                    : isDraggingFileInWindow
                      ? "border-emerald-500 bg-emerald-100 scale-[1.02] shadow-xl shadow-emerald-500/20 ring-4 ring-emerald-500/30 animate-pulse"
                      : form.url_archivo
                        ? "border-emerald-300 bg-emerald-50 shadow-xs"
                        : "border-slate-300 bg-slate-100/80 hover:bg-slate-100 hover:border-slate-400"
              ].join(' ')}
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.pdf,application/pdf';
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) uploadFile(file);
                };
                input.click();
              }}
            >
              {/* Banner de animación cuando la página detecta arrastre de documento en pantalla */}
              {isDraggingFileInWindow && !uploading && (
                <div className="absolute inset-0 bg-emerald-100 rounded-2xl flex flex-col items-center justify-center text-center p-4 z-20 pointer-events-none border-2 border-emerald-500 animate-in fade-in zoom-in-95 duration-200">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-600/40 animate-bounce mb-2">
                    <Upload size={24} />
                  </div>
                  <p className="text-sm font-black text-emerald-950 uppercase tracking-wider">
                    {isDraggingOver ? '¡Suelta el documento ahora!' : '¡Suelta tu archivo PDF aquí!'}
                  </p>
                  <p className="text-[11px] text-emerald-700 font-extrabold mt-0.5">
                    Documento PDF (Máx. 25MB)
                  </p>
                </div>
              )}

              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm transition-colors ${
                form.url_archivo ? 'bg-emerald-600 text-white' : 'bg-white text-slate-500 border border-slate-200'
              }`}>
                <Upload size={22} strokeWidth={2.5} />
              </div>
              <div className="flex flex-col gap-0.5 max-w-full">
                <span className="text-xs font-black text-slate-800 break-all px-2">
                  {uploading 
                    ? 'Subiendo archivo...' 
                    : uploadedFileName 
                      ? uploadedFileName 
                      : form.url_archivo 
                        ? decodeURIComponent(form.url_archivo.split('/').pop() || '').replace(/^[a-f0-9-]{30,}-/i, '') 
                        : 'Haz clic o arrastra un archivo PDF aquí'}
                </span>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  {uploadedFileName || form.url_archivo ? 'Archivo PDF cargado correctamente' : 'PDF (Máx. 25MB)'}
                </span>
              </div>
              {uploadError && (
                <span className="text-xs font-bold text-red-500 mt-1">{uploadError}</span>
              )}
            </div>
          </FormField>
        </div>

        <div className="md:col-span-2">
          <FormField label="Categoría">
            <select
              value={form.categoria}
              onChange={(e) => setForm(p => ({ ...p, categoria: e.target.value }))}
              className="w-full text-sm rounded-xl border border-slate-200 px-3 py-3 text-slate-700 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-semibold"
            >
              <option value="">Selecciona una categoría</option>
              <option value="Leyes y Decretos">Leyes y Decretos</option>
              <option value="Reglamentos y Estatutos">Reglamentos y Estatutos</option>
              <option value="Normas y Procedimientos">Normas y Procedimientos</option>
              <option value="Actas de Asamblea">Actas de Asamblea</option>
              <option value="Otros">Otros</option>
            </select>
          </FormField>
        </div>
      </div>

      <div className="flex gap-3 pt-6 border-t border-gray-50 mt-auto">
        <BtnPrimary 
          onClick={save} 
          disabled={saving || uploading}
          className="flex-1 !py-3.5 !rounded-xl !text-xs !font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 active:scale-95 transition-transform"
        >
          {saving ? 'Guardando cambios...' : 'Confirmar y Guardar'}
        </BtnPrimary>
        {selectedId && selectedId !== 'new' && (
          <BtnDanger
            onClick={() => {
              const item = items.find(it => String(it.id) === String(selectedId))
              if (item) remove(item)
            }}
            className="flex-1 !py-3.5 !rounded-xl !text-xs !font-black uppercase tracking-widest bg-red-50 text-red-500 hover:bg-red-100"
          >
            Eliminar Documento
          </BtnDanger>
        )}
        <BtnSecondary
          onClick={closeForm}
          className="px-6 !py-3.5 !rounded-xl !text-xs !font-black uppercase tracking-widest"
        >
          Descartar
        </BtnSecondary>
      </div>
    </div>
  )

  if (isEditing || selectedId === 'new') {
    return (
      <>
        <div className="p-4 sm:p-5 min-h-full bg-slate-50/50">
          {formBody()}
        </div>

        {/* Modal de confirmación individual */}
        {itemToDelete && createPortal(
          <div className='fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm'>
            <div className='transition-opacity transition-transform bg-white rounded-2xl shadow-2xl border border-slate-100 p-8 w-full max-w-sm fade-in zoom-in duration-200 text-center'>
              <div className='w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 mx-auto mb-4'>
                <Trash2 size={32} />
              </div>
              <h3 className='text-lg font-black text-slate-800 mb-2'>¿Eliminar documento?</h3>
              <p className='text-sm text-slate-500 mb-6'>
                Estás a punto de eliminar <span className='font-bold text-slate-700'>{itemToDelete.titulo}</span> del Marco Legal. Esta acción no se puede deshacer.
              </p>
              
              <div className='flex flex-col gap-2'>
                <button
                  type='button'
                  onClick={confirmRemoveSingle}
                  className='w-full py-3 bg-rose-500 text-white rounded-xl text-sm font-black hover:bg-rose-600 disabled:opacity-50 shadow-lg shadow-rose-500/25 transition-colors transition-opacity flex items-center justify-center gap-2 cursor-pointer'
                >
                  <Trash2 size={18} />
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
      </>
    )
  }

  return (
    <div className="flex flex-col h-full relative p-4 sm:p-5 pb-16 sm:pb-24 space-y-4 max-w-[1600px] mx-auto w-full">
      <CmsPanelHeader
        icon={<FileText size={22} />}
        title={fixedCategory || "Marco Legal & Normativas"}
        subtitle="Administra las leyes, reglamentos, estatutos y documentos del portal web"
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Buscar por título o categoría..."
        viewMode={viewMode}
        onViewModeChange={changeViewMode}
        actionButtonText="Nuevo Documento"
        onActionClick={openNew}
      />

      {!fixedCategory && (
        <div className="flex-shrink-0 px-4 pt-2 bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-x-auto no-scrollbar">
          <div className="flex gap-6">
            {tabs.map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setActiveTab(tab)
                  setSelectedId(null)
                  setSelectedIds([])
                }}
                className={[
                  'pb-2.5 text-[11px] font-bold uppercase tracking-widest transition-colors relative whitespace-nowrap cursor-pointer',
                  activeTab === tab ? 'text-emerald-600 font-black' : 'text-slate-400 hover:text-slate-600'
                ].join(' ')}
              >
                {tab}
                {activeTab === tab && (
                  <div className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-500 rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Control bar de selección múltiple */}
      {filteredItems.length > 0 && (
        <div className="px-4 py-2 bg-slate-50/80 border border-slate-200/60 rounded-2xl flex items-center justify-between gap-3 text-xs">
          <label className="flex items-center gap-2 cursor-pointer select-none font-bold text-slate-600">
            <input
              type="checkbox"
              checked={filteredItems.length > 0 && selectedIds.length === filteredItems.length}
              onChange={toggleSelectAll}
              className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
            />
            <span>
              {selectedIds.length === filteredItems.length ? 'Desmarcar todos' : 'Seleccionar todos'} ({selectedIds.length}/{filteredItems.length})
            </span>
          </label>

          {selectedIds.length > 0 && (
            <button
              type="button"
              onClick={() => setShowBatchDeleteModal(true)}
              disabled={deletingBatch}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg font-bold text-xs transition-colors shadow-xs cursor-pointer"
            >
              <Trash2 size={13} />
              {deletingBatch ? 'Eliminando...' : `Eliminar ${selectedIds.length} seleccionados`}
            </button>
          )}
        </div>
      )}

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-12">
          {filteredItems.map((item) => {
            const isPublic = item.activo === 1 || item.activo === true
            const isSelected = selectedIds.includes(item.id)
            return (
              <div
                key={item.id}
                onClick={() => openEdit(item)}
                className={`bg-white border rounded-3xl p-4 shadow-xs hover:border-emerald-400 hover:shadow-lg transition-all duration-300 flex flex-col justify-between group cursor-pointer relative overflow-hidden ${
                  isSelected
                    ? 'border-emerald-500 ring-2 ring-emerald-500/30 bg-emerald-50/10'
                    : 'border-slate-200/80'
                }`}
              >
                <div className="space-y-2.5">
                  {/* Top Bar with Selection Checkbox, Category Badge & Visibility Badge */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => toggleSelect(item.id)}
                        className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer shrink-0"
                      />
                      <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-100/80 shadow-2xs truncate max-w-[150px]">
                        <FileText size={12} className="text-rose-500 shrink-0" strokeWidth={2.5} />
                        <span className="truncate">{item.categoria || 'Normativa'}</span>
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => toggleVisibility(item, e)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border cursor-pointer transition-colors shrink-0 ${
                        isPublic
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                      }`}
                      title={isPublic ? 'Clic para ocultar en la web' : 'Clic para mostrar en la web'}
                    >
                      {isPublic ? <Eye size={12} /> : <EyeOff size={12} />}
                      <span>{isPublic ? 'Público' : 'Oculto'}</span>
                    </button>
                  </div>

                  <div>
                    <h4 className="text-sm font-black text-slate-800 leading-snug line-clamp-2 group-hover:text-emerald-700 transition-colors">
                      {item.titulo || 'Sin título'}
                    </h4>
                  </div>
                </div>

                <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  {item.url_archivo ? (
                    <a
                      href={item.url_archivo}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-emerald-600 transition-colors"
                    >
                      <ExternalLink size={12} />
                      <span>Abrir PDF</span>
                    </a>
                  ) : (
                    <span className="text-[10px] text-slate-400 font-medium">Sin archivo</span>
                  )}

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); openEdit(item); }}
                      className="p-1.5 rounded-lg text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                      title="Editar documento"
                    >
                      <Edit size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); remove(item); }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Eliminar documento"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="flex-1 overflow-hidden min-h-0">
          <ListDetail
            items={filteredItems}
            loading={loading}
            selectedId={selectedId}
            setSelectedId={(id) => setSelectedId(id)}
            isEditing={isEditing}
            setIsEditing={setIsEditing}
            onNew={openNew}
            hideNewButton={true}
            renderRow={(item, sel) => {
              const index = filteredItems.findIndex(it => String(it.id) === String(item.id))
              const isPublic = item.activo === 1 || item.activo === true
              return (
                <div 
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', String(index))
                    e.dataTransfer.effectAllowed = 'move'
                    setDraggedIndex(index)
                  }}
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    const rawSrc = e.dataTransfer.getData('text/plain')
                    const srcIdx = rawSrc !== '' ? Number(rawSrc) : draggedIndex
                    if (srcIdx !== null && !isNaN(srcIdx)) {
                      handleDrop(srcIdx, index)
                    }
                  }}
                  className={`relative flex items-center justify-between gap-2 min-w-0 group cursor-pointer pr-1 transition-colors rounded-xl p-1 border border-transparent ${
                    draggedIndex === index ? 'opacity-40 bg-emerald-50 border-emerald-300' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {/* Grip / Drag & Drop handle */}
                    <div 
                      className="p-1 text-slate-300 group-hover:text-slate-500 cursor-grab active:cursor-grabbing shrink-0 hover:bg-slate-100 rounded-md transition-colors"
                      title="Arrastrar para reordenar"
                    >
                      <GripVertical size={16} />
                    </div>

                    <input
                      type="checkbox"
                      checked={selectedIds.includes(item.id)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => toggleSelect(item.id)}
                      className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer shrink-0"
                    />

                    <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-red-500 shrink-0">
                      <FileText size={18} strokeWidth={2.5} />
                    </div>

                    <div className="flex flex-col min-w-0 flex-1 py-0.5 pr-1">
                      <span 
                        className={['text-sm font-bold leading-snug break-words', sel ? 'text-emerald-600 font-extrabold' : 'text-slate-800 group-hover:text-slate-900'].join(' ')}
                        title={item.titulo}
                      >
                        {item.titulo}
                      </span>
                      <div className="flex items-center gap-2 mt-1">
                        {isPublic ? (
                          <button
                            type="button"
                            onClick={(e) => toggleVisibility(item, e)}
                            className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-100 shrink-0 transition-colors cursor-pointer"
                            title="Clic para ocultar en el portal web"
                          >
                            <Eye size={10} /> Público
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => toggleVisibility(item, e)}
                            className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-amber-600 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded-full border border-amber-100 shrink-0 transition-colors cursor-pointer"
                            title="Clic para mostrar en el portal web"
                          >
                            <EyeOff size={10} /> Oculto
                          </button>
                        )}
                        {item.categoria && (
                          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full truncate max-w-[120px]">
                            {item.categoria}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); openEdit(item); }}
                      className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors"
                      title="Editar documento"
                    >
                      <Edit size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); remove(item); }}
                      className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Eliminar documento"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )
            }}
            renderDetail={(item) => (
              <div className="flex flex-col gap-5 bg-white rounded-2xl p-6 border border-gray-100 h-full">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center text-red-500 shrink-0">
                      <FileText size={24} strokeWidth={2.5} />
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">
                        {item.categoria || 'Normativa Legal'}
                      </span>
                      <h3 className="text-lg font-black text-slate-800 leading-tight">{item.titulo}</h3>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => toggleVisibility(item, e)}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-black transition-all cursor-pointer shadow-xs ${
                        item.activo
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                          : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200'
                      }`}
                      title={item.activo ? 'Clic para ocultar en la web' : 'Clic para mostrar en la web'}
                    >
                      {item.activo ? <Eye size={14} /> : <EyeOff size={14} />}
                      <span>{item.activo ? 'Visible en Web' : 'Oculto en Web'}</span>
                    </button>
                    <BtnSecondary onClick={() => openEdit(item)} className="!py-2 px-4 !text-xs font-bold">Editar</BtnSecondary>
                    <BtnDanger onClick={() => remove(item)} className="!py-2 px-4 !text-xs font-bold">Eliminar</BtnDanger>
                  </div>
                </div>

                {item.url_archivo && (
                  <div className="pt-2">
                    <a
                      href={item.url_archivo}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs uppercase tracking-wider shadow-md transition-colors transition-transform active:scale-95 mt-1"
                    >
                      <ExternalLink size={15} />
                      <span>Abrir documento en ventana nueva</span>
                    </a>
                  </div>
                )}
              </div>
            )}
            renderForm={formBody}
          />
        </div>
      )}

      {/* Modal de confirmación individual (Esquema Control de Acceso) */}
      {itemToDelete && createPortal(
        <div className='fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm'>
          <div className='transition-opacity transition-transform bg-white rounded-2xl shadow-2xl border border-slate-100 p-8 w-full max-w-sm fade-in zoom-in duration-200 text-center'>
            <div className='w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 mx-auto mb-4'>
              <Trash2 size={32} />
            </div>
            <h3 className='text-lg font-black text-slate-800 mb-2'>¿Eliminar documento?</h3>
            <p className='text-sm text-slate-500 mb-6'>
              Estás a punto de eliminar <span className='font-bold text-slate-700'>{itemToDelete.titulo}</span> del Marco Legal. Esta acción no se puede deshacer.
            </p>
            
            <div className='flex flex-col gap-2'>
              <button
                type='button'
                onClick={confirmRemoveSingle}
                className='w-full py-3 bg-rose-500 text-white rounded-xl text-sm font-black hover:bg-rose-600 disabled:opacity-50 shadow-lg shadow-rose-500/25 transition-colors transition-opacity flex items-center justify-center gap-2 cursor-pointer'
              >
                <Trash2 size={18} />
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

      {/* Modal de confirmación masiva (Esquema Control de Acceso) */}
      {showBatchDeleteModal && createPortal(
        <div className='fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm'>
          <div className='transition-opacity transition-transform bg-white rounded-2xl shadow-2xl border border-slate-100 p-8 w-full max-w-sm fade-in zoom-in duration-200 text-center'>
            <div className='w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 mx-auto mb-4'>
              <Trash2 size={32} />
            </div>
            <h3 className='text-lg font-black text-slate-800 mb-2'>¿Eliminar selección?</h3>
            <p className='text-sm text-slate-500 mb-6'>
              Estás a punto de eliminar <span className='font-bold text-slate-700'>{selectedIds.length} documentos</span> del Marco Legal. Esta acción no se puede deshacer.
            </p>
            
            <div className='flex flex-col gap-2'>
              <button
                type='button'
                disabled={deletingBatch}
                onClick={confirmRemoveBatch}
                className='w-full py-3 bg-rose-500 text-white rounded-xl text-sm font-black hover:bg-rose-600 disabled:opacity-50 shadow-lg shadow-rose-500/25 transition-colors transition-opacity flex items-center justify-center gap-2 cursor-pointer'
              >
                {deletingBatch ? <Loader2 size={18} className='animate-spin' /> : <Trash2 size={18} />}
                <span>Confirmar Eliminación</span>
              </button>
              <button 
                type='button' 
                disabled={deletingBatch}
                onClick={() => setShowBatchDeleteModal(false)} 
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
  )
}
