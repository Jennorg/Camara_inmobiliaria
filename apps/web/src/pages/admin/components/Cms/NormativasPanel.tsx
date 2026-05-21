import React, { useState, useEffect, useCallback } from 'react'
import { FileText, Upload, FolderSearch, CheckCircle, Edit, Trash2 } from 'lucide-react'
import { api, FormField, Input, Textarea, BtnPrimary, BtnDanger, BtnSecondary, ListDetail, uploadFileSupabase } from '@/pages/admin/components/Cms/CmsShared'

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
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null)
  const [isDraggingOver, setIsDraggingOver] = useState(false)



  const tabs = ['Todas', 'Leyes y Decretos', 'Reglamentos y Estatutos', 'Normas y Procedimientos', 'Actas de Asamblea', 'Otros']

  const load = useCallback(async () => {
    setLoading(true)
    const data = await api.get('/api/cms/normativas')
    if (data.success && Array.isArray(data.data)) {
      setItems(data.data.map((it: any) => ({ ...it, id: it.id_normativa })))
    }
    setLoading(false)
  }, [])
  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (fixedCategory) {
      setActiveTab(fixedCategory)
      setForm(p => ({ ...p, categoria: fixedCategory }))
      setSelectedId(null)
      setIsEditing(false)
    }
  }, [fixedCategory])

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
      orden: 0, 
      activo: true 
    })
    setIsEditing(true)
    setUploadedFileName(null)
  }

  const save = async () => {
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
    }
  }

  const remove = async (id: string | number) => {
    if (!confirm('¿Eliminar este documento legal?')) return
    await api.delete(`/api/cms/normativas/${id}`)
    setSelectedId(null)
    load()
  }
  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((p) => ({
      ...p,
      [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.type === 'number' ? Number(e.target.value) : e.target.value,
    }))

  const uploadFile = async (file: File) => {
    setUploadError(null)
    setUploading(true)
    try {
      setUploadedFileName(file.name)
      const publicUrl = await uploadFileSupabase(file, 'normativas')
      setForm((p) => ({ ...p, url_archivo: publicUrl }))
    } catch (e) {
      setUploadedFileName(null)
      setUploadError(e instanceof Error ? e.message : 'Error al subir archivo')
    } finally {
      setUploading(false)
    }
  }


  const filteredItems = activeTab === 'Todas' ? items : items.filter(it => it.categoria === activeTab)

  const formBody = () => (
    <div className="flex flex-col gap-6 bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-50 pb-4 mb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-red-50 flex items-center justify-center text-red-500">
            <FileText size={20} strokeWidth={2.5} />
          </div>

          <div>
            <h3 className="text-base font-black text-slate-800 leading-tight">
              {selectedId === 'new' ? 'Nuevo documento' : 'Editar documento'}
            </h3>
            <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Marco Legal</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="md:col-span-2">
          <FormField label="Título del Documento">
            <Input 
              value={form.titulo} 
              onChange={f('titulo')} 
              placeholder="Ej. Ley de Arrendamiento Inmobiliario" 
              className="!text-sm !py-3 bg-slate-50/50 border-slate-200 focus:bg-white transition-all"
            />
          </FormField>
        </div>

        <div className="md:col-span-2">
          <FormField label="Descripción / Resumen (Opcional)">
            <Textarea 
              value={form.descripcion} 
              onChange={f('descripcion')} 
              placeholder="Escribe un breve resumen del contenido para facilitar la búsqueda..." 
              rows={3} 
              className="!text-sm bg-slate-50/50 border-slate-200 focus:bg-white transition-all resize-none"
            />
          </FormField>
        </div>

        <div className="md:col-span-2">
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/60 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">Documento PDF</span>
              {form.url_archivo && (
                <a 
                  href={form.url_archivo} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
                >
                  <FolderSearch size={12} />
                  Ver actual
                </a>
              )}
            </div>

            <div className="relative group">
              <input
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) uploadFile(file)
                }}
                disabled={uploading}
                onDragEnter={() => setIsDraggingOver(true)}
                onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true) }}
                onDragLeave={() => setIsDraggingOver(false)}
                onDrop={() => setIsDraggingOver(false)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
              />
              <div className={`flex flex-col items-center justify-center py-6 px-4 border-2 border-dashed rounded-xl transition-all duration-200 ${
                uploading 
                  ? 'border-emerald-200 bg-emerald-50/30' 
                  : isDraggingOver
                    ? 'border-emerald-500 bg-emerald-100 scale-[1.02] shadow-xl shadow-emerald-500/10'
                    : form.url_archivo 
                      ? 'border-emerald-400 bg-emerald-50/50' 
                      : 'border-slate-200 group-hover:border-emerald-400 group-hover:bg-emerald-50/10'
              }`}>

                {uploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-[11px] font-bold text-emerald-700">Subiendo archivo...</span>
                  </div>
                ) : form.url_archivo ? (
                  <div className="flex flex-col items-center gap-1 text-center animate-in fade-in zoom-in duration-300">
                    <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center mb-1 shadow-md shadow-emerald-200 ring-4 ring-emerald-50">
                      <CheckCircle size={22} strokeWidth={3} />
                    </div>
                    <p className="text-[11px] font-black text-emerald-700 uppercase tracking-tight">¡Documento listo!</p>
                    {uploadedFileName && (
                      <p className="text-[10px] text-slate-500 font-bold truncate max-w-[200px] bg-white px-2 py-0.5 rounded-lg border border-emerald-100 mt-1">
                        {uploadedFileName}
                      </p>
                    )}
                    <p className="text-[9px] text-emerald-600/60 font-bold mt-1 uppercase tracking-widest">Haga clic para cambiar</p>
                  </div>

                ) : (
                  <>
                    <Upload size={20} className="text-slate-400 group-hover:text-emerald-500 transition-colors mb-2" />
                    <p className="text-[11px] font-bold text-slate-600 group-hover:text-emerald-700">
                      Haga clic o arrastre para subir el PDF
                    </p>
                    <p className="text-[9px] text-slate-400 mt-1 uppercase tracking-wider">Solo archivos .pdf</p>
                  </>
                )}
              </div>

            </div>
            {uploadError && <p className="text-[10px] font-bold text-red-500 animate-pulse">{uploadError}</p>}
          </div>
        </div>

        <div>
          <FormField label="Categoría">
            <select 
              value={form.categoria} 
              onChange={(e) => setForm(p => ({ ...p, categoria: e.target.value }))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all appearance-none cursor-pointer"
            >
              <option value="">Seleccionar categoría...</option>
              <option value="Leyes y Decretos">Leyes y Decretos</option>
              <option value="Reglamentos y Estatutos">Reglamentos y Estatutos</option>
              <option value="Normas y Procedimientos">Normas y Procedimientos</option>
              <option value="Actas de Asamblea">Actas de Asamblea</option>
              <option value="Otros">Otros</option>
            </select>
          </FormField>
        </div>

        <div>
          <FormField label="Prioridad / Orden">
            <Input 
              type="number" 
              value={form.orden} 
              onChange={f('orden')} 
              className="!text-sm !py-3 bg-slate-50/50 border-slate-200"
            />
          </FormField>
        </div>

        <div className="md:col-span-2 pt-2">
          <label className="flex items-center gap-3 p-4 rounded-xl bg-slate-50/50 border border-slate-100 cursor-pointer hover:bg-white hover:border-emerald-200 transition-all group">
            <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
              form.activo ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 bg-white group-hover:border-emerald-400'
            }`}>
              <input 
                type="checkbox" 
                checked={form.activo} 
                onChange={(e) => setForm((p) => ({ ...p, activo: e.target.checked }))} 
                className="hidden"
              />
              {form.activo && <CheckCircle size={14} strokeWidth={3} />}
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-black text-slate-700">Visibilidad Pública</span>
              <span className="text-[10px] text-slate-400">Si está activo, aparecerá en el portal web público.</span>
            </div>
          </label>
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
            onClick={() => remove(selectedId)}
            className="flex-1 !py-3.5 !rounded-xl !text-xs !font-black uppercase tracking-widest bg-red-50 text-red-500 hover:bg-red-100"
          >
            Eliminar Documento
          </BtnDanger>
        )}
        <BtnSecondary
          onClick={() => {
            setSelectedId(null)
            setIsEditing(false)
          }}
          className="px-6 !py-3.5 !rounded-xl !text-xs !font-black uppercase tracking-widest"
        >
          Descartar
        </BtnSecondary>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col h-full">
      {!fixedCategory && (
        <div className="flex-shrink-0 px-4 pt-4 bg-white border-b border-gray-100 overflow-x-auto no-scrollbar">
          <div className="flex gap-6">
            {tabs.map(tab => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab)
                  setSelectedId(null)
                }}
                className={[
                  'pb-3 text-[11px] font-bold uppercase tracking-widest transition-all relative whitespace-nowrap',
                  activeTab === tab ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'
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

      <div className="flex-1 overflow-hidden">
        <ListDetail
          items={filteredItems}
          loading={loading}
          selectedId={selectedId}
          setSelectedId={(id) => {
            setSelectedId(id)
            if (id) setIsEditing(true)
          }}
          isEditing={isEditing}
          setIsEditing={setIsEditing}
          onNew={openNew}
          renderRow={(item, sel) => (
            <div className="flex items-center justify-between gap-3 min-w-0 group cursor-pointer pr-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-red-500 shrink-0">
                  <FileText size={18} strokeWidth={2.5} />
                </div>

                <div className="flex flex-col min-w-0">
                  <span className={['text-sm font-semibold truncate', sel ? 'text-[#00B870]' : 'text-slate-800'].join(' ')}>{item.titulo}</span>
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">{item.categoria || 'Sin categoría'}</span>
                </div>
              </div>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={(e) => { e.stopPropagation(); openEdit(item); }}
                  className="p-1.5 rounded-lg hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition-colors"
                >
                  <Edit size={14} />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); remove(item.id); }}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          )}
          renderDetail={(item) => (
            <div className="flex flex-col gap-4 bg-white rounded-2xl p-5 border border-gray-100">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-800">{item.titulo}</h3>
                <div className="flex gap-2 shrink-0">
                  <BtnSecondary onClick={() => openEdit(item)}>Editar</BtnSecondary>
                  <BtnDanger onClick={() => remove(item.id)}>Eliminar</BtnDanger>
                </div>
              </div>
              {item.descripcion && <p className="text-xs text-slate-600">{item.descripcion}</p>}
              {item.categoria && (
                <span className="inline-block text-[10px] font-bold uppercase text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg w-fit">{item.categoria}</span>
              )}
              <a
                href={item.url_archivo}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-white hover:border-red-200 hover:shadow-sm transition-all"
              >
                <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center text-red-600 group-hover:scale-110 transition-transform">
                  <FileText size={24} strokeWidth={2.5} />
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-xs font-black text-slate-700 uppercase tracking-tight">Archivo PDF</span>
                  <span className="text-[10px] text-slate-400 truncate max-w-[280px]">
                    {item.url_archivo.split('/').pop() || 'Ver documento legal'}
                  </span>
                </div>
                <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400 group-hover:text-red-500 group-hover:border-red-100 transition-colors">
                   <FolderSearch size={16} />
                </div>
              </a>

              <p className="text-xs text-slate-400">Orden: {item.orden} · {item.activo === 1 || item.activo === true ? 'Activo' : 'Oculto'}</p>
            </div>
          )}
          renderForm={formBody}
        />
      </div>
    </div>
  )
}
