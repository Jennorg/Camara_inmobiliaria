import React, { useState, useEffect, useCallback } from 'react'
import { api, FormField, Input, Textarea, BtnPrimary, BtnDanger, BtnSecondary, ListDetail, uploadFileSupabase } from '@/pages/admin/components/Cms/CmsShared'
import { Upload, CheckCircle, Trash2, ArrowLeft, ArrowUp, ArrowDown, Calendar, Clock, MapPin, ArrowUpLeft, ArrowUpRight, ArrowDownLeft, ArrowDownRight, ArrowLeft as ArrowLeftIcon, ArrowRight as ArrowRightIcon, Dot } from 'lucide-react'

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
  const [isHiding, setIsHiding] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isDraggingOver, setIsDraggingOver] = useState(false)

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
    try {
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

  const remove = async (id: string | number) => {
    if (!confirm('¿Eliminar esta noticia?')) return
    await api.delete(`/api/cms/noticias/${id}`)
    setSelectedId(null)
    load()
  }

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(p => ({ ...p, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }))

  const formBody = () => (
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
          <label className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors select-none">
            <input 
              type="checkbox" 
              checked={form.publicado} 
              onChange={f('publicado')} 
              className="w-4 h-4 rounded accent-emerald-500 border-slate-300" 
            />
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-700">Publicar</span>
          </label>
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
                <span>🖼️ Modo Solo Imagen (Afiche / Volante)</span>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Categoría">
              <Input 
                value={form.categoria} 
                onChange={f('categoria')} 
                placeholder="Noticias, Eventos..." 
                className="!text-xs !py-2.5 bg-slate-50/70 border-slate-200" 
              />
            </FormField>

            <FormField label="Etiqueta / Tag">
              <Input 
                value={form.tag} 
                onChange={f('tag')} 
                placeholder="Ej. solo_imagen, Mercado, Legal..." 
                className="!text-xs !py-2.5 bg-slate-50/70 border-slate-200" 
              />
            </FormField>
          </div>

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

          {/* Resaltado de Evento (Opcional) */}
          <div className="bg-emerald-50/40 border border-emerald-100 rounded-2xl p-4 space-y-3">
            <div>
              <h4 className="text-[11px] font-black uppercase tracking-wider text-emerald-950">
                Resaltar Evento (Opcional)
              </h4>
              <p className="text-[10px] text-emerald-700/70 font-medium">
                Complete estos datos si la noticia corresponde a una actividad con fecha y hora.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <FormField label="Fecha Evento">
                <Input type="date" value={form.fecha_evento} onChange={f('fecha_evento')} className="!text-xs !py-2 bg-white" />
              </FormField>
              <FormField label="Hora Evento">
                <Input type="time" value={form.hora_evento} onChange={f('hora_evento')} className="!text-xs !py-2 bg-white" />
              </FormField>
              <FormField label="Lugar Evento">
                <Input value={form.lugar_evento} onChange={f('lugar_evento')} placeholder="Puerto Ordaz..." className="!text-xs !py-2 bg-white" />
              </FormField>
            </div>
          </div>
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
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
              />
              <div className={`flex flex-col items-center justify-center py-6 px-4 border-2 border-dashed rounded-2xl transition-colors duration-300 ${
                uploading 
                  ? 'border-emerald-300 bg-emerald-50/50' 
                  : isDraggingOver
                    ? 'border-emerald-500 bg-emerald-100 scale-[1.01] shadow-lg shadow-emerald-500/10'
                    : form.imagen_url 
                      ? 'border-emerald-300 bg-emerald-50/20' 
                      : 'border-slate-200 group-hover:border-emerald-400 group-hover:bg-emerald-50/10'
              }`}>
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
                    className="w-full h-full object-contain transition-colors duration-300"
                    style={{ objectPosition: form.posicion_imagen }}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-400 space-y-1">
                    <Upload size={28} className="opacity-40" />
                    <span className="text-[11px] font-bold uppercase tracking-wider opacity-60">Sin portada</span>
                  </div>
                )}
              </div>

              {/* Ajuste de Foco / Encuadre (flechas 3x3) */}
              {form.imagen_url && (
                <div className="flex items-center justify-between gap-3 bg-slate-50 p-2.5 rounded-2xl border border-slate-200/70">
                  <div className="space-y-0.5 flex-1 min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 block">Alineación</span>
                  </div>
                  
                  {/* Selector 3x3 mini */}
                  <div className="grid grid-cols-3 gap-1 p-1 bg-white rounded-xl shrink-0 border border-slate-200/60">
                    {[
                      { val: 'top left', icon: <ArrowUpLeft size={10} /> },
                      { val: 'top center', icon: <ArrowUp size={10} /> },
                      { val: 'top right', icon: <ArrowUpRight size={10} /> },
                      { val: 'center left', icon: <ArrowLeftIcon size={10} /> },
                      { val: 'center center', icon: <Dot size={10} /> },
                      { val: 'center right', icon: <ArrowRightIcon size={10} /> },
                      { val: 'bottom left', icon: <ArrowDownLeft size={10} /> },
                      { val: 'bottom center', icon: <ArrowDown size={10} /> },
                      { val: 'bottom right', icon: <ArrowDownRight size={10} /> }
                    ].map((pos) => (
                      <button
                        key={pos.val}
                        type="button"
                        onClick={() => setForm(p => ({ ...p, posicion_imagen: pos.val }))}
                        className={`w-4 h-4 flex items-center justify-center rounded font-bold transition-colors ${
                          form.posicion_imagen === pos.val 
                            ? 'bg-emerald-500 text-white shadow-xs scale-110' 
                            : 'hover:bg-slate-200 text-slate-400'
                        }`}
                        title={`Alineación: ${pos.val}`}
                      >
                        {pos.icon}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Simulación del contenido de la tarjeta */}
              <div className="space-y-2 px-1 pt-1">
                <div className="flex items-center justify-between gap-2 text-[10px] text-emerald-600 font-black uppercase tracking-[0.2em]">
                  <span>{form.fecha_evento ? form.fecha_evento : (form.fecha?.split('T')[0] || 'Próximamente')}</span>
                  {form.lugar_evento && (
                    <span className="text-[10px] text-slate-400 font-bold truncate max-w-[120px]">📍 {form.lugar_evento}</span>
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
  )

  const handleMove = async (index: number, direction: 'up' | 'down', e: React.MouseEvent) => {
    e.stopPropagation()
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= items.length) return

    const newItems = [...items]
    const [movedItem] = newItems.splice(index, 1)
    newItems.splice(targetIndex, 0, movedItem)
    setItems(newItems)

    try {
      await api.put('/api/cms/noticias/reorder', {
        items: newItems.map((item, idx) => ({ id: item.id, orden: idx + 1 }))
      })
    } catch (err) {
      console.error('Error al reordenar noticias:', err)
    }
  }

  return (
    <ListDetail
      items={items} loading={loading} selectedId={selectedId} setSelectedId={(id) => { setSelectedId(id); setIsEditing(false) }}
      isEditing={isEditing} setIsEditing={setIsEditing}
      onNew={openNew}
      renderRow={(item, sel, index) => (
        <div className="flex items-center justify-between gap-2 w-full">
          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className={['text-sm font-semibold truncate', sel ? 'text-[#00B870]' : 'text-slate-800'].join(' ')}>{item.titulo}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${item.publicado ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>{item.publicado ? 'Publicado' : 'Borrador'}</span>
            </div>
            <span className="text-xs text-slate-400 truncate">{item.categoria} · {item.fecha?.split('T')[0]}</span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              disabled={index === 0}
              onClick={(e) => handleMove(index, 'up', e)}
              className="p-1 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 disabled:opacity-30 disabled:hover:bg-transparent transition-colors transition-opacity cursor-pointer"
              title="Subir orden"
            >
              <ArrowUp size={14} />
            </button>
            <button
              type="button"
              disabled={index === items.length - 1}
              onClick={(e) => handleMove(index, 'down', e)}
              className="p-1 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 disabled:opacity-30 disabled:hover:bg-transparent transition-colors transition-opacity cursor-pointer"
              title="Bajar orden"
            >
              <ArrowDown size={14} />
            </button>
          </div>
        </div>
      )}
      renderDetail={(item) => (
        <div className="flex flex-col gap-6 bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
          {/* Header Bar */}
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">
                {item.categoria} · {item.fecha?.split('T')[0]}
              </span>
              <h3 className="text-xl font-bold text-slate-800 leading-tight mt-0.5">{item.titulo}</h3>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <BtnSecondary onClick={() => openEdit(item)}>Editar</BtnSecondary>
              <BtnDanger onClick={() => remove(item.id)}>Eliminar</BtnDanger>
            </div>
          </div>

          {/* 2 Columns: Left Photo / Right Details */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            {/* Left Column: Photo / Vertical Poster */}
            {item.imagen_url && (
              <div className="md:col-span-5 lg:col-span-5 w-full aspect-[3/4] bg-slate-50 rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm flex items-center justify-center">
                <img 
                  src={item.imagen_url} 
                  alt={item.titulo} 
                  className="w-full h-full object-contain transition-colors duration-300" 
                  style={{ objectPosition: item.posicion_imagen }}
                />
              </div>
            )}

            {/* Right Column: Information & Body */}
            <div className={`space-y-4 ${item.imagen_url ? 'md:col-span-7 lg:col-span-7' : 'md:col-span-12'}`}>
              {(item.fecha_evento || item.hora_evento || item.lugar_evento) && (
                <div className="bg-emerald-50/70 rounded-2xl p-4 border border-emerald-100 text-xs text-emerald-950 space-y-2 shadow-xs">
                  <span className="font-black uppercase tracking-wider block text-[10px] text-emerald-700">Detalles Destacados del Evento:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-semibold">
                    {item.fecha_evento && <div className="flex items-center gap-1.5"><Calendar size={13} className="text-emerald-600 shrink-0" /> <strong>Fecha:</strong> {item.fecha_evento}</div>}
                    {item.hora_evento && <div className="flex items-center gap-1.5"><Clock size={13} className="text-emerald-600 shrink-0" /> <strong>Hora:</strong> {item.hora_evento}</div>}
                    {item.lugar_evento && <div className="sm:col-span-2 flex items-center gap-1.5"><MapPin size={13} className="text-emerald-600 shrink-0" /> <strong>Lugar:</strong> {item.lugar_evento}</div>}
                  </div>
                </div>
              )}

              {item.extracto && item.tag !== 'solo_imagen' && (
                <p className="text-sm text-slate-700 leading-relaxed font-bold border-l-4 border-emerald-500 pl-3 py-1 italic bg-slate-50/50 rounded-r-xl">
                  {item.extracto}
                </p>
              )}

              {item.contenido && item.tag !== 'solo_imagen' && (
                <div className="text-xs text-slate-600 leading-relaxed whitespace-pre-line border-t border-slate-100 pt-3">
                  <span className="font-bold text-slate-800 block mb-1">Cuerpo Completo:</span>
                  {item.contenido}
                </div>
              )}

              <div className="flex flex-wrap gap-2 text-xs text-slate-400 pt-2 border-t border-slate-100">
                <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase">{item.categoria}</span>
                {item.tag && <span className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border border-emerald-100">#{item.tag}</span>}
              </div>
            </div>
          </div>
        </div>
      )}
      renderForm={formBody}
    />
  )
}
