import React, { useState, useEffect, useCallback } from 'react'
import { api, FormField, Input, Textarea, BtnPrimary, BtnDanger, BtnSecondary, ListDetail, uploadFileSupabase } from '@/pages/admin/components/Cms/CmsShared'
import { Upload, CheckCircle, Trash2 } from 'lucide-react'

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
}

export const NoticiasPanel = () => {
  const [items, setItems] = useState<NoticiaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | number | null>(null)
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
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isDraggingOver, setIsDraggingOver] = useState(false)

  const uploadImage = async (file: File) => {
    setUploadError(null)
    setUploading(true)
    try {
      const publicUrl = await uploadFileSupabase(file, 'noticias')
      setForm((p) => ({ ...p, imagen_url: publicUrl }))
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Error al subir archivo')
    } finally {
      setUploading(false)
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    const data = await api.get('/api/cms/noticias')
    if (data.success && Array.isArray(data.data)) {
      // Map API database columns to matches in the component's NoticiaItem interface
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
        posicion_imagen: x.posicion_imagen || 'center center'
      }))
      setItems(mapped)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const openEdit = (item: NoticiaItem) => {
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
      const payload = {
        titulo: form.titulo,
        contenido: form.contenido,
        resumen: form.extracto,
        imagen_url: form.imagen_url,
        categoria: form.categoria,
        tag: form.tag,
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

  const remove = async (id: string | number) => {
    if (!confirm('¿Eliminar esta noticia?')) return
    await api.delete(`/api/cms/noticias/${id}`)
    setSelectedId(null)
    load()
  }

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(p => ({ ...p, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }))

  const formBody = () => (
    <div className="flex flex-col gap-6 bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-50 pb-4">
        <div>
          <h3 className="text-base font-black text-slate-800 leading-tight">
            {selectedId === 'new' ? 'Nueva Noticia' : 'Editar Noticia'}
          </h3>
          <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Portal de Actualidad</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5">
        <FormField label="Título de la Noticia">
          <Input 
            value={form.titulo} 
            onChange={f('titulo')} 
            placeholder="Ej. Nuevas tendencias del mercado inmobiliario..." 
            className="!text-sm !py-3 bg-slate-50/50 border-slate-200 focus:bg-white transition-all"
          />
        </FormField>

        <FormField label="Extracto / Resumen (Vista previa)">
          <Textarea 
            value={form.extracto} 
            onChange={f('extracto')} 
            placeholder="Breve resumen de 1 o 2 líneas para la tarjeta de vista previa..." 
            rows={2} 
            className="!text-sm bg-slate-50/50 border-slate-200 focus:bg-white transition-all resize-none"
          />
        </FormField>

        <FormField label="Cuerpo / Contenido Completo">
          <Textarea 
            value={form.contenido} 
            onChange={f('contenido')} 
            placeholder="Desarrolle el contenido completo de la noticia aquí..." 
            rows={5} 
            className="!text-sm bg-slate-50/50 border-slate-200 focus:bg-white transition-all resize-y min-h-[120px]"
          />
        </FormField>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">Imagen de Portada</span>
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
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
            />
            <div className={`flex flex-col items-center justify-center py-8 px-4 border-2 border-dashed rounded-2xl transition-all duration-300 ${
              uploading 
                ? 'border-emerald-200 bg-emerald-50/30' 
                : isDraggingOver
                  ? 'border-emerald-500 bg-emerald-100 scale-[1.02] shadow-xl shadow-emerald-500/10'
                  : form.imagen_url 
                    ? 'border-emerald-400 bg-emerald-50/50' 
                    : 'border-slate-200 group-hover:border-emerald-400 group-hover:bg-emerald-50/10'
            }`}>
              
              {uploading ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-[11px] font-bold text-emerald-700">Subiendo imagen...</span>
                </div>
              ) : form.imagen_url ? (
                <div className="flex flex-col items-center gap-3 animate-in fade-in zoom-in duration-300">
                  <div className="relative">
                    <img 
                      src={form.imagen_url} 
                      alt="Preview" 
                      className="w-24 h-24 object-cover rounded-xl shadow-md border-2 border-white ring-4 ring-emerald-50"
                      style={{ objectPosition: form.posicion_imagen }}
                    />
                    <div className="absolute -top-2 -right-2 bg-emerald-500 text-white p-1 rounded-full shadow-lg ring-2 ring-white">
                      <CheckCircle size={14} strokeWidth={3} />
                    </div>
                  </div>
                  <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest bg-emerald-100/50 px-3 py-1 rounded-full">¡Imagen cargada!</p>
                  <p className="text-[9px] text-emerald-600/60 font-bold uppercase tracking-widest">Haga clic o arrastre para cambiar</p>
                </div>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mb-3 group-hover:bg-emerald-50 group-hover:text-emerald-500 transition-colors">
                    <Upload size={24} className="text-slate-400 group-hover:text-emerald-500 transition-colors" />
                  </div>
                  <p className="text-[11px] font-bold text-slate-600 group-hover:text-emerald-700">
                    Arrastre su imagen aquí
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-tighter font-bold">o haga clic para seleccionar archivo</p>
                </>
              )}
            </div>
          </div>
          {uploadError && <p className="text-[11px] text-rose-600 font-bold px-2">× {uploadError}</p>}
        </div>

        {/* Control de Encuadre de Imagen (object-position) */}
        {form.imagen_url && (
          <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 space-y-3">
            <div>
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-700">Ajuste de Encuadre / Foco</span>
              <p className="text-[9px] text-slate-400 font-bold uppercase">Seleccione el punto de anclaje para encuadrar la imagen dentro de la tarjeta.</p>
            </div>
            
            <div className="flex gap-6 items-center">
              {/* Mini previsualizador con recorte */}
              <div className="w-24 h-24 rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-white">
                <img 
                  src={form.imagen_url} 
                  alt="Previsualización" 
                  className="w-full h-full object-cover transition-all duration-300"
                  style={{ objectPosition: form.posicion_imagen }}
                />
              </div>
              
              {/* Selector táctil/clic 3x3 */}
              <div className="grid grid-cols-3 gap-1 p-1 bg-slate-200/60 rounded-2xl w-24 h-24 border border-slate-200/30">
                {[
                  { val: 'top left', label: '↖️' },
                  { val: 'top center', label: '⬆️' },
                  { val: 'top right', label: '↗️' },
                  { val: 'center left', label: '⬅️' },
                  { val: 'center center', label: '•' },
                  { val: 'center right', label: '➡️' },
                  { val: 'bottom left', label: '↙️' },
                  { val: 'bottom center', label: '⬇️' },
                  { val: 'bottom right', label: '↘️' }
                ].map((pos) => (
                  <button
                    key={pos.val}
                    type="button"
                    onClick={() => setForm(p => ({ ...p, posicion_imagen: pos.val }))}
                    className={`flex items-center justify-center text-[10px] rounded-lg font-bold transition-all ${
                      form.posicion_imagen === pos.val 
                        ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20 scale-[1.08]' 
                        : 'hover:bg-slate-200 text-slate-400 hover:text-slate-600'
                    }`}
                    title={`Alineación: ${pos.val}`}
                  >
                    {pos.label}
                  </button>
                ))}
              </div>
              
              <div className="text-[10px] text-slate-500 font-bold max-w-[160px] leading-relaxed uppercase">
                Haga clic en las flechas para alinear la imagen (ej: use la flecha arriba si se cortan las cabezas).
              </div>
            </div>
          </div>
        )}

        {/* Resaltado de Evento (Fecha, Hora, Lugar) */}
        <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 space-y-4">
          <div>
            <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-700">Resaltar Evento (Fecha, Hora, Lugar)</h4>
            <p className="text-[9px] text-slate-400 font-bold uppercase">Si la noticia corresponde a un evento, complete estos campos para destacarlos visualmente.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <FormField label="Fecha del Evento">
              <Input type="date" value={form.fecha_evento} onChange={f('fecha_evento')} className="!text-xs !py-2 bg-white" />
            </FormField>
            <FormField label="Hora del Evento">
              <Input type="time" value={form.hora_evento} onChange={f('hora_evento')} className="!text-xs !py-2 bg-white" />
            </FormField>
            <FormField label="Lugar del Evento">
              <Input value={form.lugar_evento} onChange={f('lugar_evento')} placeholder="Ej. Altavista, Puerto Ordaz" className="!text-xs !py-2 bg-white" />
            </FormField>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Categoría">
            <Input value={form.categoria} onChange={f('categoria')} className="!text-xs !py-2.5 bg-slate-50 border-slate-200" />
          </FormField>
          <FormField label="Etiqueta (Tag)">
            <Input value={form.tag} onChange={f('tag')} placeholder="Legal, Mercado..." className="!text-xs !py-2.5 bg-slate-50 border-slate-200" />
          </FormField>
          <FormField label="Fecha de Publicación">
            <Input type="date" value={form.fecha} onChange={f('fecha')} className="!text-xs !py-2.5 bg-slate-50 border-slate-200" />
          </FormField>
          <div className="flex items-center h-full pt-4">
            <label className="flex items-center gap-3 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition-all w-full">
              <input 
                type="checkbox" 
                checked={form.publicado} 
                onChange={f('publicado')} 
                className="w-4 h-4 rounded accent-emerald-500 border-slate-300" 
              />
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-600">Publicar noticia</span>
            </label>
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t border-gray-50">
          <BtnPrimary 
            onClick={save} 
            disabled={saving || uploading}
            className="!rounded-xl !py-3 flex-1"
          >
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </BtnPrimary>
          <BtnSecondary 
            onClick={() => { setSelectedId(null); setIsEditing(false) }}
            className="!rounded-xl !py-3 flex-1"
          >
            Cancelar
          </BtnSecondary>
        </div>
      </div>
    </div>
  )

  return (
    <ListDetail
      items={items} loading={loading} selectedId={selectedId} setSelectedId={(id) => { setSelectedId(id); setIsEditing(false) }}
      isEditing={isEditing} setIsEditing={setIsEditing}
      onNew={openNew}
      renderRow={(item, sel) => (
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center justify-between gap-2">
            <span className={['text-sm font-semibold truncate', sel ? 'text-[#00B870]' : 'text-slate-800'].join(' ')}>{item.titulo}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${item.publicado ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>{item.publicado ? 'Publicado' : 'Borrador'}</span>
          </div>
          <span className="text-xs text-slate-400 truncate">{item.categoria} · {item.fecha?.split('T')[0]}</span>
        </div>
      )}
      renderDetail={(item) => (
        <div className="flex flex-col gap-4 bg-white rounded-2xl p-5 border border-gray-100">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-800">{item.titulo}</h3>
            <div className="flex gap-2 flex-shrink-0">
              <BtnSecondary onClick={() => openEdit(item)}>Editar</BtnSecondary>
              <BtnDanger onClick={() => remove(item.id)}>Eliminar</BtnDanger>
            </div>
          </div>
          {item.imagen_url && (
            <img 
              src={item.imagen_url} 
              alt="" 
              className="w-full h-40 object-cover rounded-xl shadow-xs" 
              style={{ objectPosition: item.posicion_imagen }}
            />
          )}
          
          {(item.fecha_evento || item.hora_evento || item.lugar_evento) && (
            <div className="bg-emerald-50/50 rounded-xl p-3 border border-emerald-100/50 text-[11px] text-emerald-800 space-y-1">
              <span className="font-black uppercase tracking-wider block mb-1 text-[10px] text-emerald-600">Detalles del Evento Resaltados:</span>
              {item.fecha_evento && <div>📅 <strong>Fecha:</strong> {item.fecha_evento}</div>}
              {item.hora_evento && <div>⏰ <strong>Hora:</strong> {item.hora_evento}</div>}
              {item.lugar_evento && <div>📍 <strong>Lugar:</strong> {item.lugar_evento}</div>}
            </div>
          )}

          <p className="text-sm text-slate-600 leading-relaxed font-bold">{item.extracto}</p>
          
          {item.contenido && (
            <div className="text-xs text-slate-500 whitespace-pre-line border-t border-slate-50 pt-3">
              <span className="font-bold text-slate-700 block mb-1">Cuerpo Completo:</span>
              {item.contenido}
            </div>
          )}

          <div className="flex flex-wrap gap-2 text-xs text-slate-400 pt-2">
            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{item.categoria}</span>
            {item.tag && <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">#{item.tag}</span>}
            <span>{item.fecha?.split('T')[0]}</span>
          </div>
        </div>
      )}
      renderForm={formBody}
    />
  )
}
