import React, { useState, useEffect, useCallback } from 'react'
import { api, FormField, Input, Textarea, BtnPrimary, BtnDanger, BtnSecondary, ListDetail } from '@/pages/admin/components/Cms/CmsShared'
import { sendToPreview } from '@/pages/admin/components/Cms/LandingPreviewPane'

interface HitoItem {
  id: string | number;
  anio: string;
  titulo: string;
  descripcion: string;
  orden: number;
}

export const HitosPanel = () => {
  const [items, setItems] = useState<HitoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | number | null>(null)
  const [form, setForm] = useState({ anio: '', titulo: '', descripcion: '', orden: 0 })
  const [saving, setSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  const load = useCallback(async () => { 
    setLoading(true); 
    const data = await api.get('/api/cms/hitos'); 
    if (data.success && Array.isArray(data.data)) {
      setItems(data.data.map((it: any) => ({
        ...it,
        id: it.id_hito,
        anio: it.año // Map DB 'año' to frontend 'anio'
      })));
    } 
    setLoading(false) 
  }, [])
  useEffect(() => { load() }, [load])
  const openEdit = (item: HitoItem) => { setSelectedId(item.id); setForm({ anio: item.anio, titulo: item.titulo, descripcion: item.descripcion, orden: item.orden }); setIsEditing(true) }
  const openNew = () => { setSelectedId('new'); setForm({ anio: '', titulo: '', descripcion: '', orden: items.length }); setIsEditing(true) }
  const save = async () => {
    setSaving(true)
    try {
      const res = selectedId === 'new' 
        ? await api.post('/api/cms/hitos', form)
        : await api.put(`/api/cms/hitos/${selectedId}`, form)

      if (res.success) {
        setSelectedId(null)
        setIsEditing(false)
        load()
        setTimeout(() => sendToPreview({ type: 'refresh_data' }), 500)
      } else {
        alert(res.message || 'Error al guardar el hito')
      }
    } catch (error) {
      console.error(error)
      alert('Error de conexión con el servidor')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string | number) => { if (!confirm('¿Eliminar?')) return; await api.delete(`/api/cms/hitos/${id}`); setSelectedId(null); setIsEditing(false); load(); setTimeout(() => sendToPreview({ type: 'refresh_data' }), 500) }
  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(p => ({ ...p, [k]: e.target.type === 'number' ? Number(e.target.value) : e.target.value }))

  const formBody = () => (
    <div className="flex flex-col gap-4 bg-white rounded-2xl p-5 border border-gray-100">
      <h3 className="text-sm font-bold text-slate-800">{selectedId === 'new' ? 'Nuevo Hito' : 'Editar Hito'}</h3>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Año"><Input value={form.anio} onChange={f('anio')} placeholder="1994" /></FormField>
        <FormField label="Orden"><Input type="number" value={form.orden} onChange={f('orden')} /></FormField>
      </div>
      <FormField label="Título"><Input value={form.titulo} onChange={f('titulo')} placeholder="Fundación..." /></FormField>
      <FormField label="Descripción"><Textarea value={form.descripcion} onChange={f('descripcion')} placeholder="Descripción del hito..." /></FormField>
      <div className="flex gap-2 pt-2"><BtnPrimary onClick={save} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</BtnPrimary><BtnSecondary onClick={() => { setSelectedId(null); setIsEditing(false) }}>Cancelar</BtnSecondary></div>
    </div>
  )

  return (
    <ListDetail
      items={items} loading={loading} selectedId={selectedId} setSelectedId={(id) => { setSelectedId(id); setIsEditing(false) }}
      isEditing={isEditing} setIsEditing={setIsEditing}
      onNew={openNew}
      renderRow={(item, sel) => (
        <div className="flex items-center gap-3">
          <span className="text-lg font-black text-[#00D084] flex-shrink-0 w-12">{item.anio}</span>
          <div className="flex flex-col min-w-0">
            <span className={['text-sm font-semibold truncate', sel ? 'text-[#00B870]' : 'text-slate-800'].join(' ')}>{item.titulo}</span>
            <span className="text-xs text-slate-400 truncate">{item.descripcion}</span>
          </div>
        </div>
      )}
      renderDetail={(item) => (
        <div className="flex flex-col gap-4 bg-white rounded-2xl p-5 border border-gray-100">
          <div className="flex items-start justify-between gap-2">
            <div><span className="text-3xl font-black text-[#00D084]">{item.anio}</span><h3 className="text-sm font-bold text-slate-800 mt-1">{item.titulo}</h3></div>
            <div className="flex gap-2"><BtnSecondary onClick={() => openEdit(item)}>Editar</BtnSecondary><BtnDanger onClick={() => remove(item.id)}>Eliminar</BtnDanger></div>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">{item.descripcion}</p>
        </div>
      )}
      renderForm={formBody}
    />
  )
}
