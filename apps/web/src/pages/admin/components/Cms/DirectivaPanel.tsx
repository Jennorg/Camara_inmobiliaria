import React, { useState, useEffect, useCallback } from 'react'
import { api, FormField, Input, BtnPrimary, BtnDanger, BtnSecondary, ListDetail, uploadFileSupabase } from '@/pages/admin/components/Cms/CmsShared'
import { Edit, Upload, CheckCircle, Trash2 } from 'lucide-react'
import { sendToPreview } from '@/pages/admin/components/Cms/LandingPreviewPane'
import { formatNombreCard } from '@/utils/formatters'

import { invalidateDirectivaCache } from '@/pages/landing/junta-directiva/JuntaDirectivaPage'

interface DirectivaItem {
  id: string | number;
  nombre: string;
  cargo: string;
  foto_url?: string;
  orden: number;
  activo: number | boolean;
}

/** Invalida caché local y emite evento para que la landing recargue si está abierta en la misma pestaña */
function purgeCache() {
  invalidateDirectivaCache()
  window.dispatchEvent(new CustomEvent('directiva-cache-invalidated'))
}

export const DirectivaPanel = () => {
  const [items, setItems] = useState<DirectivaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | number | null>(null)
  const [form, setForm] = useState({ nombre: '', cargo: '', foto_url: '', orden: 0, activo: true })
  const [saving, setSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isDraggingOver, setIsDraggingOver] = useState(false)

  const uploadImage = async (file: File) => {
    setUploadError(null)
    setUploading(true)
    try {
      const publicUrl = await uploadFileSupabase(file, 'directiva')
      setForm((p) => ({ ...p, foto_url: publicUrl }))
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Error al subir archivo')
    } finally {
      setUploading(false)
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    const resp = await api.get('/api/cms/directiva');
    if (resp.success && Array.isArray(resp.data)) {
      const normalized = resp.data.map((item: any) => ({
        ...item,
        id: item.id_miembro,
        activo: item.activo === 1 || item.activo === true,
      }));
      setItems(normalized);
    }
    setLoading(false);
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (selectedId && selectedId !== 'new') {
      const item = items.find(i => i.id === selectedId)
      if (item) {
        setForm({ 
          nombre: item.nombre, 
          cargo: item.cargo, 
          foto_url: item.foto_url || '', 
          orden: item.orden, 
          activo: item.activo === 1 || item.activo === true 
        })
      }
    }
  }, [selectedId, items])
  const openEdit = (item: DirectivaItem) => { setSelectedId(item.id); setForm({ nombre: item.nombre, cargo: item.cargo, foto_url: item.foto_url || '', orden: item.orden, activo: item.activo === 1 }); setIsEditing(true) }
  const openNew = () => { setSelectedId('new'); setForm({ nombre: '', cargo: '', foto_url: '', orden: 0, activo: true }); setIsEditing(true) }
  const save = async () => {
    setSaving(true)
    try {
      const res = selectedId === 'new'
        ? await api.post('/api/cms/directiva', form)
        : await api.put(`/api/cms/directiva/${selectedId}`, form)

      if (res.success) {
        setSelectedId(null)
        setIsEditing(false)
        load()
        purgeCache()
        setTimeout(() => sendToPreview({ type: 'refresh_data' }), 500)
      } else {
        alert(res.message || 'Error al guardar el miembro')
      }
    } catch (error) {
      console.error(error)
      alert('Error de conexión con el servidor')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string | number) => { if (!confirm('¿Eliminar?')) return; await api.delete(`/api/cms/directiva/${id}`); setSelectedId(null); load(); purgeCache(); setTimeout(() => sendToPreview({ type: 'refresh_data' }), 500) }
  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.type === 'number' ? Number(e.target.value) : e.target.value }))

  const formBody = () => (
    <div className="flex flex-col gap-6 bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-50 pb-4">
        <div>
          <h3 className="text-base font-black text-slate-800 leading-tight">
            {selectedId === 'new' ? 'Nuevo Miembro' : 'Editar Miembro'}
          </h3>
          <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Junta Directiva</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5">
        <FormField label="Nombre Completo">
          <Input
            value={form.nombre}
            onChange={f('nombre')}
            placeholder="Ej. Francisco Piñango"
            className="!text-sm !py-3 bg-slate-50/50 border-slate-200 focus:bg-white transition-all"
          />
        </FormField>

        <FormField label="Cargo / Posición">
          <Input
            value={form.cargo}
            onChange={f('cargo')}
            placeholder="Ej. Presidente, Secretario..."
            className="!text-sm !py-3 bg-slate-50/50 border-slate-200 focus:bg-white transition-all"
          />
        </FormField>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">Fotografía</span>
            {form.foto_url && (
              <button
                onClick={() => setForm(p => ({ ...p, foto_url: '' }))}
                className="flex items-center gap-1 text-[10px] font-bold text-rose-500 hover:text-rose-700 transition-colors"
              >
                <Trash2 size={12} />
                Quitar foto
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
            <div className={`flex flex-col items-center justify-center py-8 px-4 border-2 border-dashed rounded-2xl transition-all duration-300 ${uploading
                ? 'border-emerald-200 bg-emerald-50/30'
                : isDraggingOver
                  ? 'border-emerald-500 bg-emerald-100 scale-[1.02] shadow-xl shadow-emerald-500/10'
                  : form.foto_url
                    ? 'border-emerald-400 bg-emerald-50/50'
                    : 'border-slate-200 group-hover:border-emerald-400 group-hover:bg-emerald-50/10'
              }`}>

              {uploading ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-[11px] font-bold text-emerald-700">Subiendo fotografía...</span>
                </div>
              ) : form.foto_url ? (
                <div className="flex flex-col items-center gap-3 animate-in fade-in zoom-in duration-300">
                  <div className="relative">
                    <img src={form.foto_url} alt="Preview" className="w-24 h-24 object-cover rounded-full shadow-md border-2 border-white ring-4 ring-emerald-50" />
                    <div className="absolute -top-1 -right-1 bg-emerald-500 text-white p-1 rounded-full shadow-lg ring-2 ring-white">
                      <CheckCircle size={14} strokeWidth={3} />
                    </div>
                  </div>
                  <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest bg-emerald-100/50 px-3 py-1 rounded-full">¡Foto cargada!</p>
                </div>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mb-3 group-hover:bg-emerald-50 group-hover:text-emerald-500 transition-colors">
                    <Upload size={24} className="text-slate-400 group-hover:text-emerald-500 transition-colors" />
                  </div>
                  <p className="text-[11px] font-bold text-slate-600 group-hover:text-emerald-700">
                    Arrastre la foto aquí
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-tighter font-bold">o haga clic para seleccionar</p>
                </>
              )}
            </div>
          </div>
          {uploadError && <p className="text-[11px] text-rose-600 font-bold px-2">× {uploadError}</p>}
        </div>

        <FormField label="Orden de Aparición">
          <Input type="number" value={form.orden} onChange={f('orden')} className="!text-xs !py-2.5 bg-slate-50 border-slate-200" />
        </FormField>

        <div className="flex gap-3 pt-4 border-t border-gray-50">
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
              Eliminar Miembro
            </BtnDanger>
          )}
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
      items={items} loading={loading} selectedId={selectedId} setSelectedId={(id) => { setSelectedId(id); if(id) setIsEditing(true) }}
      isEditing={isEditing} setIsEditing={setIsEditing}
      onNew={openNew}
      renderRow={(item, sel) => (
        <div className="flex items-center justify-between gap-3 p-1 w-full">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-[#E9FAF4] flex items-center justify-center text-[#00B870] font-black text-sm flex-shrink-0 overflow-hidden">
              {item.foto_url ? <img src={item.foto_url} className="w-full h-full object-cover" /> : item.nombre.charAt(0)}
            </div>
            <div className="flex flex-col min-w-0">
              <span className={`text-sm font-semibold truncate ${sel ? 'text-[#00B870]' : 'text-slate-800'}`}>
                {formatNombreCard(item.nombre)}
              </span>
              <span className="text-[10px] text-slate-400 truncate uppercase font-bold tracking-tighter">{item.cargo}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={(e) => { e.stopPropagation(); openEdit(item); }} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded" title="Editar"><Edit size={14} /></button>
            <button onClick={(e) => { e.stopPropagation(); remove(item.id); }} className="p-1 text-rose-600 hover:bg-rose-50 rounded" title="Eliminar"><Trash2 size={14} /></button>
          </div>
        </div>
      )}
      renderDetail={(item) => (
        <div className="flex flex-col gap-4 bg-white rounded-2xl p-5 border border-gray-100">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#E9FAF4] flex items-center justify-center text-[#00B870] font-black text-lg overflow-hidden">
                {item.foto_url ? <img src={item.foto_url} className="w-full h-full object-cover" /> : item.nombre.charAt(0)}
              </div>
              <div><h3 className="text-sm font-bold text-slate-800">{formatNombreCard(item.nombre)}</h3><p className="text-xs text-slate-400">{item.cargo}</p></div>
            </div>
            <div className="flex gap-2"><BtnSecondary onClick={() => openEdit(item)}>Editar</BtnSecondary><BtnDanger onClick={() => remove(item.id)}>Eliminar</BtnDanger></div>
          </div>
        </div>
      )}
      renderForm={formBody}
    />
  )
}
