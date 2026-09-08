import React, { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { api, FormField, Input, Textarea, BtnPrimary, BtnDanger, BtnSecondary, ListDetail, uploadFileStorage, CmsPanelHeader } from '@/pages/admin/components/Cms/CmsShared'
import { Edit, Upload, CheckCircle, Trash2, Globe, ArrowLeft, Loader2, Handshake } from 'lucide-react'
import { sendToPreview } from '@/pages/admin/components/Cms/LandingPreviewPane'

interface ConvenioItem {
  id: string | number;
  nombre: string;
  descripcion: string | null;
  logo_url: string | null;
  link_web: string | null;
}

export const ConveniosPanel = () => {
  const [items, setItems] = useState<ConvenioItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | number | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('cms_view_mode_convenios')
      if (saved === 'grid' || saved === 'list') return saved
    }
    return 'grid'
  })

  const changeViewMode = (mode: 'grid' | 'list') => {
    setViewMode(mode)
    if (typeof window !== 'undefined') {
      localStorage.setItem('cms_view_mode_convenios', mode)
    }
  }
  const [form, setForm] = useState({ nombre: '', descripcion: '', logo_url: '', link_web: '' })
  const [saving, setSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [isHiding, setIsHiding] = useState(false)

  const closeForm = () => {
    setIsHiding(true)
    setTimeout(() => {
      setSelectedId(null)
      setIsEditing(false)
      setIsHiding(false)
    }, 180)
  }

  const uploadLogo = async (file: File) => {
    setUploadError(null)
    setUploading(true)
    try {
      const publicUrl = await uploadFileStorage(file, 'convenios')
      setForm((p) => ({ ...p, logo_url: publicUrl }))
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Error al subir logo')
    } finally {
      setUploading(false)
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await api.get('/api/cms/convenios');
      if (resp.success && Array.isArray(resp.data)) {
        const normalized = resp.data.map((item: any) => ({
          ...item,
          id: item.id_convenio
        }));
        setItems(normalized);
      }
    } finally {
      setLoading(false);
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (selectedId && selectedId !== 'new') {
      const item = items.find(i => String(i.id) === String(selectedId))
      if (item) {
        setForm({ 
          nombre: item.nombre, 
          descripcion: item.descripcion || '', 
          logo_url: item.logo_url || '', 
          link_web: item.link_web || ''
        })
      }
    }
  }, [selectedId, items])

  const openEdit = (item: ConvenioItem) => { 
    setSelectedId(item.id); 
    setForm({ 
      nombre: item.nombre, 
      descripcion: item.descripcion || '', 
      logo_url: item.logo_url || '', 
      link_web: item.link_web || ''
    }); 
    setIsEditing(true) 
  }

  const openNew = () => { 
    setSelectedId('new'); 
    setForm({ nombre: '', descripcion: '', logo_url: '', link_web: '' }); 
    setIsEditing(true) 
  }

  const save = async () => {
    setSaving(true)
    try {
      const res = selectedId === 'new'
        ? await api.post('/api/cms/convenios', form)
        : await api.put(`/api/cms/convenios/${selectedId}`, form)

      if (res.success) {
        setSelectedId(null)
        setIsEditing(false)
        load()
        setTimeout(() => sendToPreview({ type: 'refresh_data' }), 500)
      } else {
        alert(res.message || 'Error al guardar convenio')
      }
    } catch (error) {
      console.error(error)
      alert('Error de conexión con el servidor')
    } finally {
      setSaving(false)
    }
  }

  const [itemToDelete, setItemToDelete] = useState<ConvenioItem | null>(null)
  const [deletingConvenio, setDeletingConvenio] = useState(false)

  const remove = (target: ConvenioItem | string | number, e?: React.MouseEvent) => { 
    if (e) e.stopPropagation()
    const item = typeof target === 'object' ? target : items.find(i => String(i.id) === String(target)) || null
    if (item) setItemToDelete(item)
  }

  const confirmDeleteConvenio = async () => {
    if (!itemToDelete || deletingConvenio) return
    setDeletingConvenio(true)
    try {
      await api.delete(`/api/cms/convenios/${itemToDelete.id}`)
      if (String(selectedId) === String(itemToDelete.id)) {
        setSelectedId(null)
        setIsEditing(false)
      }
      setItemToDelete(null)
      load()
      setTimeout(() => sendToPreview({ type: 'refresh_data' }), 500)
    } catch (e) {
      console.error(e)
      alert('Error de conexión al eliminar el convenio')
    } finally {
      setDeletingConvenio(false)
    }
  }

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => 
    setForm(p => ({ ...p, [k]: e.target.value }))

  const formBody = () => (
    <div className={`flex flex-col gap-6 bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-xl transition-colors duration-200 h-full overflow-y-auto ${
      isHiding ? 'opacity-0 scale-95 -translate-x-4 pointer-events-none' : 'animate-in fade-in zoom-in-95 duration-200'
    }`}>
      <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-2">
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
              {selectedId === 'new' ? 'Nuevo Convenio' : 'Editar Convenio'}
            </h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">Alianzas y Convenios</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5">
        <FormField label="Nombre del Aliado / Empresa">
          <Input
            value={form.nombre}
            onChange={f('nombre')}
            placeholder="Ej. Banco de Venezuela, UCAB, etc."
            className="!text-sm !py-3 bg-slate-50/50 border-slate-200 focus:bg-white transition-colors font-bold"
          />
        </FormField>

        <FormField label="Descripción del Convenio">
          <Textarea
            value={form.descripcion}
            onChange={f('descripcion')}
            placeholder="Describe brevemente en qué consiste el beneficio para el afiliado..."
            rows={3}
            className="!text-sm bg-slate-50/50 border-slate-200 focus:bg-white transition-colors resize-none"
          />
        </FormField>

        <FormField label="Enlace Web (Opcional)">
          <div className="relative flex items-center">
             <div className="absolute left-3 text-slate-400"><Globe size={14} /></div>
             <Input
                value={form.link_web}
                onChange={f('link_web')}
                placeholder="https://aliado.com"
                className="!text-sm !py-3 !pl-10 bg-slate-50/50 border-slate-200 focus:bg-white transition-colors"
              />
          </div>
        </FormField>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">Logo del Aliado</span>
            {form.logo_url && (
              <button
                onClick={() => setForm(p => ({ ...p, logo_url: '' }))}
                className="flex items-center gap-1 text-[10px] font-bold text-rose-500 hover:text-rose-700 transition-colors"
              >
                <Trash2 size={12} />
                Quitar logo
              </button>
            )}
          </div>

          <div className="relative group">
            <input
              type="file"
              accept="image/*,.svg,.png,.jpg,.jpeg,.webp"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) uploadLogo(file)
              }}
              disabled={uploading}
              onDragEnter={() => setIsDraggingOver(true)}
              onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true) }}
              onDragLeave={() => setIsDraggingOver(false)}
              onDrop={() => setIsDraggingOver(false)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
            />
            <div className={`flex flex-col items-center justify-center py-8 px-4 border-2 border-dashed rounded-2xl transition-colors duration-300 ${uploading
                ? 'border-emerald-200 bg-emerald-50/30'
                : isDraggingOver
                  ? 'border-emerald-500 bg-emerald-100 scale-[1.02] shadow-xl shadow-emerald-500/10'
                  : form.logo_url
                    ? 'border-emerald-400 bg-emerald-50/50'
                    : 'border-slate-200 group-hover:border-emerald-400 group-hover:bg-emerald-50/10'
              }`}>

              {uploading ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-[11px] font-bold text-emerald-700">Subiendo logo...</span>
                </div>
              ) : form.logo_url ? (
                <div className="transition-opacity transition-transform flex flex-col items-center gap-3 fade-in zoom-in duration-300">
                  <div className="relative">
                    <img src={form.logo_url} alt="Preview" className="w-24 h-24 object-contain bg-white rounded-xl shadow-md border border-gray-100 p-2 ring-4 ring-emerald-50" />
                    <div className="absolute -top-1 -right-1 bg-emerald-500 text-white p-1 rounded-full shadow-lg ring-2 ring-white">
                      <CheckCircle size={14} strokeWidth={3} />
                    </div>
                  </div>
                  <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest bg-emerald-100/50 px-3 py-1 rounded-full">¡Logo cargado!</p>
                </div>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mb-3 group-hover:bg-emerald-50 group-hover:text-emerald-500 transition-colors">
                    <Upload size={24} className="text-slate-400 group-hover:text-emerald-500 transition-colors" />
                  </div>
                  <p className="text-[11px] font-bold text-slate-600 group-hover:text-emerald-700">
                    Arrastre el logo aquí
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-tighter font-bold">o haga clic para seleccionar</p>
                </>
              )}
            </div>
          </div>
          {uploadError && <p className="text-[11px] text-rose-600 font-bold px-2">× {uploadError}</p>}
        </div>

        <div className="flex gap-3 pt-4 border-t border-gray-50 mt-auto">
          <BtnPrimary
            onClick={save}
            disabled={saving || uploading}
            className="!rounded-xl !py-3 flex-1"
          >
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </BtnPrimary>
          {selectedId && selectedId !== 'new' && (
            <BtnDanger
              onClick={() => remove(selectedId)}
              className="!rounded-xl !py-3 flex-1 bg-red-50 text-red-500 hover:bg-red-100"
            >
              Eliminar Convenio
            </BtnDanger>
          )}
          <BtnSecondary
            onClick={closeForm}
            className="!rounded-xl !py-3 flex-1"
          >
            Cancelar
          </BtnSecondary>
        </div>
      </div>
    </div>
  )

  const filteredItems = items.filter(item => {
    return searchQuery === '' ||
      item.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.descripcion && item.descripcion.toLowerCase().includes(searchQuery.toLowerCase()))
  })

  if (isEditing || selectedId === 'new') {
    return (
      <>
        <div className="p-4 sm:p-5 min-h-full bg-slate-50/50">
          {formBody()}
        </div>

        {/* Modal de confirmación de eliminación */}
        {itemToDelete && createPortal(
          <div className='fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm'>
            <div className='transition-opacity transition-transform bg-white rounded-2xl shadow-2xl border border-slate-100 p-8 w-full max-w-sm fade-in zoom-in duration-200 text-center'>
              <div className='w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 mx-auto mb-4'>
                <Trash2 size={32} />
              </div>
              <h3 className='text-lg font-black text-slate-800 mb-2'>¿Eliminar convenio?</h3>
              <p className='text-sm text-slate-500 mb-6'>
                Estás a punto de eliminar <span className='font-bold text-slate-700'>{itemToDelete.nombre}</span>. Esta acción no se puede deshacer.
              </p>
              
              <div className='flex flex-col gap-2'>
                <button
                  type='button'
                  disabled={deletingConvenio}
                  onClick={confirmDeleteConvenio}
                  className='w-full py-3 bg-rose-500 text-white rounded-xl text-sm font-black hover:bg-rose-600 disabled:opacity-50 shadow-lg shadow-rose-500/25 transition-colors transition-opacity flex items-center justify-center gap-2 cursor-pointer'
                >
                  {deletingConvenio ? <Loader2 size={18} className='animate-spin' /> : <Trash2 size={18} />}
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
    <>
      <div className="flex flex-col h-full relative p-4 sm:p-5 pb-16 sm:pb-24 space-y-4 max-w-[1600px] mx-auto w-full">
      <CmsPanelHeader
        icon={<Handshake size={22} />}
        title="Convenios Institucionales"
        subtitle="Administra las alianzas y convenios con empresas e instituciones"
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Buscar por nombre o descripción..."
        viewMode={viewMode}
        onViewModeChange={changeViewMode}
        actionButtonText="Nuevo Convenio"
        onActionClick={openNew}
      />

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-12">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              onClick={() => openEdit(item)}
              className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs hover:border-emerald-400 hover:shadow-lg transition-all duration-300 flex flex-col justify-between group cursor-pointer relative overflow-hidden"
            >
              <div className="space-y-3">
                {/* LOGO CONTAINER PROTAGÓNICO */}
                <div className="relative w-full h-36 sm:h-40 bg-gradient-to-b from-slate-50/80 to-slate-100/50 rounded-2xl border border-slate-200/60 shadow-inner flex items-center justify-center p-4 overflow-hidden group-hover:border-emerald-300 transition-colors">
                  {item.logo_url ? (
                    <img 
                      src={item.logo_url} 
                      alt={item.nombre || 'Logo Convenio'} 
                      className="max-h-24 max-w-[85%] object-contain group-hover:scale-105 transition-transform duration-500 ease-out drop-shadow-xs" 
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-400 font-black text-2xl uppercase">
                      {item.nombre?.charAt(0) || '?'}
                    </div>
                  )}

                  {/* Acciones flotantes en la esquina superior */}
                  <div className="absolute top-2.5 right-2.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-white/90 backdrop-blur-md p-1 rounded-xl border border-slate-200/80 shadow-sm">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); openEdit(item); }}
                      className="p-1.5 rounded-lg text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                      title="Editar convenio"
                    >
                      <Edit size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); remove(item.id); }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Eliminar convenio"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="space-y-1 px-1">
                  <h4 className="text-base font-black text-slate-800 leading-snug group-hover:text-emerald-700 transition-colors line-clamp-1">
                    {item.nombre || 'Sin nombre'}
                  </h4>
                  {item.descripcion && (
                    <p className="text-xs text-slate-500 font-medium leading-relaxed line-clamp-2">
                      {item.descripcion}
                    </p>
                  )}
                </div>
              </div>

              {item.link_web && (
                <div className="pt-3 mt-3 border-t border-slate-100">
                  <a
                    href={item.link_web}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1.5 text-xs text-emerald-600 font-bold hover:underline"
                  >
                    <Globe size={13} />
                    <span>Visitar sitio web</span>
                  </a>
                </div>
              )}
            </div>
          ))}
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
            renderRow={(item, sel) => (
              <div className="flex items-center justify-between gap-3 p-1 w-full group cursor-pointer">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-10 h-10 rounded-xl bg-white border border-gray-100 flex items-center justify-center text-slate-400 font-black text-sm flex-shrink-0 overflow-hidden p-1.5 shadow-xs">
                    {item.logo_url ? <img src={item.logo_url} alt={item.nombre || 'Logo Convenio'} className="w-full h-full object-contain" /> : (item.nombre?.charAt(0) || '?')}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className={`text-sm font-semibold truncate ${sel ? 'text-[#00B870]' : 'text-slate-800'}`}>
                      {item.nombre}
                    </span>
                    <span className="text-[10px] text-slate-400 truncate uppercase font-bold tracking-tighter line-clamp-1">{item.descripcion || 'Sin descripción'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button onClick={(e) => { e.stopPropagation(); openEdit(item); }} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Editar"><Edit size={14} /></button>
                  <button onClick={(e) => { e.stopPropagation(); remove(item.id); }} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Eliminar"><Trash2 size={14} /></button>
                </div>
              </div>
            )}
            renderDetail={(item) => (
              <div className="flex flex-col gap-5 bg-white rounded-2xl p-6 border border-gray-100 h-full">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-white border border-gray-100 flex items-center justify-center text-slate-400 font-black text-xl overflow-hidden p-2 shadow-sm">
                      {item.logo_url ? <img src={item.logo_url} alt={item.nombre || 'Logo Convenio'} className="w-full h-full object-contain" /> : (item.nombre?.charAt(0) || '?')}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-800 leading-tight">{item.nombre}</h3>
                      {item.link_web && (
                         <a href={item.link_web} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs text-emerald-600 hover:underline mt-1 font-medium">
                           <Globe size={12} />
                           Visitar sitio web
                         </a>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                     <BtnSecondary onClick={() => openEdit(item)} className="!py-2 px-4 !text-xs">Editar</BtnSecondary>
                     <BtnDanger onClick={() => remove(item.id)} className="!py-2 px-4 !text-xs">Eliminar</BtnDanger>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Acerca del convenio</h4>
                  <p className="text-sm text-slate-600 leading-relaxed bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                     {item.descripcion || 'No hay descripción disponible para este convenio.'}
                  </p>
                </div>
              </div>
            )}
            renderForm={formBody}
          />
        </div>
      )}
    </div>
      {/* Modal de confirmación de eliminación (Esquema Control de Acceso) */}
      {itemToDelete && createPortal(
        <div className='fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm'>
          <div className='transition-opacity transition-transform bg-white rounded-2xl shadow-2xl border border-slate-100 p-8 w-full max-w-sm fade-in zoom-in duration-200 text-center'>
            <div className='w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 mx-auto mb-4'>
              <Trash2 size={32} />
            </div>
            <h3 className='text-lg font-black text-slate-800 mb-2'>¿Eliminar convenio?</h3>
            <p className='text-sm text-slate-500 mb-6'>
              Estás a punto de eliminar <span className='font-bold text-slate-700'>{itemToDelete.nombre}</span>. Esta acción no se puede deshacer.
            </p>
            
            <div className='flex flex-col gap-2'>
              <button
                type='button'
                disabled={deletingConvenio}
                onClick={confirmDeleteConvenio}
                className='w-full py-3 bg-rose-500 text-white rounded-xl text-sm font-black hover:bg-rose-600 disabled:opacity-50 shadow-lg shadow-rose-500/25 transition-colors transition-opacity flex items-center justify-center gap-2 cursor-pointer'
              >
                {deletingConvenio ? <Loader2 size={18} className='animate-spin' /> : <Trash2 size={18} />}
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
