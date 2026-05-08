import React, { useEffect, useMemo, useState } from 'react'
import { API_URL } from '@/config/env'
import { useAuth } from '@/context/AuthContext'
import { formatNombreCard } from '@/utils/formatters'
import { EstatusAfiliado, AfiliadoDTO } from '@/types/afiliados'

import {
  UserPlus, Search, Filter, RefreshCw, Trash2, Edit3, Save, X,
  ChevronRight, Building2, User as UserIcon, CheckCircle2, AlertCircle,
  Mail, Phone, MapPin, BadgeCheck, FileText, Calendar, CreditCard,
  ShieldAlert, ArrowUpDown
} from 'lucide-react'


const ID_PREFIXES = ['V', 'E', 'J', 'G', 'P']

export default function MiembrosPanel() {
  const { token } = useAuth()
  const authHeaders = useMemo(() => ({
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }), [token])

  const [items, setItems] = useState<AfiliadoDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filterTipo, setFilterTipo] = useState<'Todos' | 'Natural' | 'Corporativo' | 'Agente'>('Todos')
  const [sortState, setSortState] = useState<'nombre_asc' | 'nombre_desc' | 'codigo_asc' | 'codigo_desc'>('nombre_asc')

  const [selected, setSelected] = useState<AfiliadoDTO | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState<Partial<AfiliadoDTO>>({})
  const [companies, setCompanies] = useState<AfiliadoDTO[]>([])

  const [showNewModal, setShowNewModal] = useState(false)
  const [newForm, setNewForm] = useState<Partial<AfiliadoDTO>>({
    tipo_afiliado: 'Natural',
    estatus: 'Afiliado'
  })

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_URL}/api/afiliados`, { headers: authHeaders })
      const json = await res.json()
      if (json.success) {
        setItems(json.data)
        // Guardar empresas (tipo Corporativo) para el selector de vinculación
        setCompanies(json.data.filter((a: AfiliadoDTO) => a.tipo_afiliado === 'Corporativo'))
      }
    } catch (err) {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleSelect = (item: AfiliadoDTO) => {
    setSelected(item)
    setIsEditing(false)
    setEditForm(item)
  }

  const updateField = async (field: keyof AfiliadoDTO, value: any) => {
    if (!selected) return
    try {
      const res = await fetch(`${API_URL}/api/afiliados/${selected.id_afiliado}`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value })
      })
      if (res.ok) {
        const updated = { ...selected, [field]: value }
        setSelected(updated)
        setItems(items.map(item => item.id_afiliado === selected.id_afiliado ? updated : item))
      }
    } catch (err) {
      console.error(err)
    }
  }

  const associatedMembers = useMemo(() => {
    if (!selected || selected.tipo_afiliado !== 'Corporativo' || !selected.id_empresa) return []
    return items.filter(item => item.id_empresa === selected.id_empresa && item.id_afiliado !== selected.id_afiliado)
  }, [items, selected])

  const filteredItems = useMemo(() => {
    let result = items.filter(item => {
      const nombre = (item.nombre_completo || '').toLowerCase()
      const cedula = (item.cedula || '').toLowerCase()
      const rif = (item.empresa_rif_numero || '').toLowerCase()
      const email = (item.email || '').toLowerCase()
      const s = search.toLowerCase()

      const matchSearch = nombre.includes(s) || cedula.includes(s) || rif.includes(s) || email.includes(s)

      let matchTipo = filterTipo === 'Todos' || item.tipo_afiliado === filterTipo
      if (filterTipo === 'Agente') {
        matchTipo = item.tipo_afiliado === 'Agente'
      }

      return matchSearch && matchTipo
    })

    result.sort((a, b) => {
      if (sortState.startsWith('codigo')) {
        const codA = parseInt(a.codigo_cibir || '0', 10) || 0;
        const codB = parseInt(b.codigo_cibir || '0', 10) || 0;
        return sortState === 'codigo_asc' ? codA - codB : codB - codA;
      } else {
        const nomA = (a.nombre_completo || '').toLowerCase();
        const nomB = (b.nombre_completo || '').toLowerCase();
        if (nomA < nomB) return sortState === 'nombre_asc' ? -1 : 1;
        if (nomA > nomB) return sortState === 'nombre_asc' ? 1 : -1;
        return 0;
      }
    });

    return result;
  }, [items, search, filterTipo, sortState])

  const handleEdit = (item: AfiliadoDTO) => {
    setSelected(item)
    setEditForm(item)
    setIsEditing(true)
  }

  const handleSave = async () => {
    if (!selected) return
    try {
      const res = await fetch(`${API_URL}/api/afiliados/${selected.id_afiliado}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify(editForm)
      })
      const json = await res.json()
      if (res.ok && json.success) {
        setIsEditing(false)
        load()
        setSelected(json.data)
      } else {
        alert(json.message || 'Error al actualizar')
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('¿Estás seguro de eliminar este afiliado? Esta acción no se puede deshacer.')) return
    try {
      const res = await fetch(`${API_URL}/api/afiliados/${id}`, {
        method: 'DELETE',
        headers: authHeaders
      })
      if (res.ok) {
        setSelected(null)
        load()
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleCreate = async () => {
    try {
      const res = await fetch(`${API_URL}/api/afiliados`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(newForm)
      })
      const json = await res.json()
      if (res.ok && json.success) {
        setShowNewModal(false)
        setNewForm({ tipo_afiliado: 'Natural', estatus: 'Afiliado' })
        load()
      } else {
        alert(json.message || 'Error al crear')
      }
    } catch (err) {
      console.error(err)
    }
  }

  const ACADEMIC_OPTIONS = [
    { value: 'Bachiller', label: 'Bachiller' },
    { value: 'TSU', label: 'Técnico Superior (TSU)' },
    { value: 'Universitario', label: 'Universitario' },
    { value: 'Postgrado', label: 'Postgrado' },
  ]

  return (
    <div className="flex h-full w-full bg-white overflow-hidden">
      {/* Sidebar de Lista */}
      <div className="w-full sm:w-80 border-r border-gray-100 flex flex-col min-h-0 overflow-hidden shrink-0">
        <div className="p-4 border-b border-gray-100 space-y-4 shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-800">Directorio</h2>
            <button
              onClick={() => setShowNewModal(true)}
              className="p-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors shadow-sm shadow-emerald-500/20"
            >
              <UserPlus size={18} />
            </button>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="Buscar miembro..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-gray-100 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button
              onClick={() => {
                setSortState(prev => {
                  if (prev === 'nombre_asc') return 'nombre_desc';
                  if (prev === 'nombre_desc') return 'codigo_asc';
                  if (prev === 'codigo_asc') return 'codigo_desc';
                  return 'nombre_asc';
                });
              }}
              className="px-3 bg-slate-50 border border-gray-100 rounded-xl text-slate-600 flex items-center justify-center gap-1.5 hover:bg-slate-100 transition-colors shrink-0"
              title="Cambiar criterio de ordenación"
            >
              <ArrowUpDown size={14} />
              <span className="text-[10px] font-bold uppercase tracking-widest">
                {sortState === 'nombre_asc' && 'A-Z'}
                {sortState === 'nombre_desc' && 'Z-A'}
                {sortState === 'codigo_asc' && 'CÓD. ↑'}
                {sortState === 'codigo_desc' && 'CÓD. ↓'}
              </span>
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setFilterTipo('Todos')}
              className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest border transition-all ${filterTipo === 'Todos' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-gray-200 hover:border-slate-300'}`}
            >
              Todos
            </button>
            <button
              onClick={() => setFilterTipo('Natural')}
              className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest border transition-all ${filterTipo === 'Natural' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-gray-200 hover:border-slate-300'}`}
            >
              Indep.
            </button>
            <button
              onClick={() => setFilterTipo('Corporativo')}
              className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest border transition-all ${filterTipo === 'Corporativo' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-500 border-gray-200 hover:border-slate-300'}`}
            >
              Corp.
            </button>
            <button
              onClick={() => setFilterTipo('Agente')}
              className={`flex-1 py-1 rounded-lg text-[8px] leading-tight font-black uppercase tracking-tighter border transition-all flex flex-col items-center justify-center ${filterTipo === 'Agente' ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-slate-500 border-gray-200 hover:border-slate-300'}`}
            >
              <span>Agentes</span>
              <span>Corporativos</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 divide-y divide-gray-50">
          {loading ? (
            <div className="p-8 text-center"><RefreshCw size={24} className="animate-spin text-emerald-500 mx-auto" /></div>
          ) : filteredItems.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">No se encontraron miembros</div>
          ) : (
            filteredItems.map(item => (
              <button
                key={item.id_afiliado}
                onClick={() => { setSelected(item); setIsEditing(false); }}
                className={`w-full p-4 text-left hover:bg-slate-50 transition-colors group flex items-center justify-between ${selected?.id_afiliado === item.id_afiliado ? 'bg-emerald-50/50 border-l-4 border-emerald-500' : 'border-l-4 border-transparent'}`}
              >
                <div className="min-w-0">
                  <p className="font-bold text-slate-800 text-sm truncate">{formatNombreCard(item.nombre_completo)}</p>

                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[8px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded-md ${item.tipo_afiliado === 'Corporativo' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                      {item.tipo_afiliado === 'Corporativo' ? 'Corporativo' : 'Independiente'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {item.empresa_rif_tipo ? `${item.empresa_rif_tipo}-${item.empresa_rif_numero}` : item.cedula}
                    </span>
                  </div>
                </div>
                <ChevronRight size={14} className={`text-slate-300 group-hover:translate-x-1 transition-transform ${selected?.id_afiliado === item.id_afiliado ? 'text-emerald-500' : ''}`} />
              </button>
            ))
          )}
        </div>
      </div>

      {/* Panel de Detalle / Edición */}
      <div className="flex-1 overflow-y-auto min-h-0 bg-slate-50/30 p-6 sm:p-8">
        {!selected ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
            <div className="w-20 h-20 bg-white rounded-3xl shadow-sm flex items-center justify-center">
              <BadgeCheck size={40} strokeWidth={1} />
            </div>
            <div className="text-center">
              <p className="font-bold text-slate-600">Selecciona un miembro</p>
              <p className="text-xs">Para visualizar o editar su información completa</p>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* Cabecera de Detalle */}
            <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 flex gap-2">
                {!isEditing ? (
                  <>
                    <button
                      onClick={() => handleEdit(selected)}
                      className="p-2.5 bg-slate-100 text-slate-600 rounded-2xl hover:bg-slate-200 transition-colors"
                      title="Editar"
                    >
                      <Edit3 size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(selected.id_afiliado)}
                      className="p-2.5 bg-rose-50 text-rose-500 rounded-2xl hover:bg-rose-100 transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 size={18} />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleSave}
                      className="p-2.5 bg-emerald-500 text-white rounded-2xl hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/20"
                      title="Guardar"
                    >
                      <Save size={18} />
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="p-2.5 bg-slate-100 text-slate-500 rounded-2xl hover:bg-slate-200 transition-colors"
                      title="Cancelar"
                    >
                      <X size={18} />
                    </button>
                  </>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                <div className={`w-24 h-24 rounded-[2rem] flex items-center justify-center shrink-0 shadow-inner ${selected.tipo_afiliado === 'Corporativo' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                  {selected.tipo_afiliado === 'Corporativo' ? <Building2 size={40} /> : <UserIcon size={40} />}
                </div>

                <div className="text-center sm:text-left space-y-1">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">
                      {/* nombre_completo es columna VIRTUAL GENERATED — se muestra, no se edita */}
                      {formatNombreCard(selected.nombre_completo)}
                    </h2>
                  </div>

                  {isEditing && (
                    <div className="flex items-center gap-3 py-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Estado en Directorio:</span>
                      <button
                        onClick={() => setEditForm({ ...editForm, activo: editForm.activo ? 0 : 1 })}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${editForm.activo ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-slate-200 text-slate-600'}`}
                      >
                        {editForm.activo ? <CheckCircle2 size={14} /> : <X size={14} />}
                        {editForm.activo ? 'Activo' : 'Inactivo'}
                      </button>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-1">
                    <DataField
                      label="Código CIBIR"
                      value={selected.codigo_cibir || 'Sin Código'}
                      isEditing={isEditing}
                      fieldName="codigo_cibir"
                      form={editForm}
                      setForm={setEditForm}
                      className="!bg-transparent !p-0 !border-none !text-slate-400 !font-bold !text-sm !uppercase !tracking-widest"
                      labelClassName="hidden"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Grid de Datos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Información Personal / Legal */}
              <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
                    <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                      <BadgeCheck size={16} />
                    </div>
                    <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">Identidad y Documentación</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <DataField label="Nombres" value={selected.nombres} isEditing={isEditing} fieldName="nombres" form={editForm} setForm={setEditForm} />
                    <DataField label="Apellidos" value={selected.apellidos} isEditing={isEditing} fieldName="apellidos" form={editForm} setForm={setEditForm} />
                    <DataField label="Razón Social (Si aplica)" value={selected.empresa_razon_social || 'N/A'} isEditing={isEditing} fieldName="empresa_razon_social" form={editForm} setForm={setEditForm} />
                    <DataField label="Código CIBIR" value={selected.codigo_cibir || 'No asignado'} isEditing={isEditing} fieldName="codigo_cibir" form={editForm} setForm={setEditForm} />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cédula / RIF</label>
                    {isEditing ? (
                      <div className="flex gap-2">
                        <select
                          className="w-20 bg-slate-50 border border-gray-100 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500/10 transition-all appearance-none cursor-pointer"
                          value={editForm.cedula?.split('-')[0] || 'V'}
                          onChange={(e) => {
                            const parts = (editForm.cedula || '').split('-');
                            const rest = parts.slice(1).join('-');
                            setEditForm({ ...editForm, cedula: `${e.target.value}-${rest}` })
                          }}
                        >
                          {ID_PREFIXES.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <input
                          type="text"
                          className="flex-1 bg-slate-50 border border-gray-100 rounded-xl px-4 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all"
                          value={(editForm.cedula || '').split('-').slice(1).join('-')}
                          onChange={(e) => {
                            const pre = (editForm.cedula || '').split('-')[0] || 'V'
                            setEditForm({ ...editForm, cedula: `${pre}-${e.target.value}` })
                          }}
                        />
                      </div>
                    ) : (
                      <p className="bg-slate-50/50 border border-transparent rounded-xl px-4 py-2 text-sm font-bold text-slate-700">
                        {selected.empresa_rif_numero ? `${selected.empresa_rif_tipo}-${selected.empresa_rif_numero}` : selected.cedula}
                      </p>
                    )}
                  </div>

                  {/* Identificación de Tipo de Afiliado y Corporativo */}
                  <div className="p-4 bg-slate-50 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo de Afiliación</p>
                      {isEditing ? (
                        <select
                          className="text-[10px] font-black uppercase px-2 py-1 rounded-md bg-white border border-gray-200 outline-none focus:ring-2 focus:ring-emerald-500/10"
                          value={editForm.tipo_afiliado}
                          onChange={(e) => setEditForm({ ...editForm, tipo_afiliado: e.target.value as any })}
                        >
                          <option value="Natural">Independiente / Persona</option>
                          <option value="Corporativo">Corporativo</option>
                          <option value="Agente">Agente (Vinculado)</option>
                        </select>
                      ) : (
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${selected.tipo_afiliado === 'Corporativo' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                          {selected.tipo_afiliado}
                        </span>
                      )}
                    </div>

                    {(isEditing ? editForm.tipo_afiliado === 'Agente' : selected.tipo_afiliado === 'Agente') && (
                      <div className="pt-2 border-t border-gray-200 space-y-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Vinculación a Corporativo</p>
                        {isEditing ? (
                          <select
                            className="w-full bg-white border border-gray-100 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500/10 transition-all appearance-none cursor-pointer"
                            value={editForm.id_empresa || ''}
                            onChange={(e) => setEditForm({ ...editForm, id_empresa: e.target.value ? Number(e.target.value) : null })}
                          >
                            <option value="">Sin vinculación</option>
                            {companies.map(c => (
                              <option key={c.id_afiliado} value={c.id_afiliado}>
                                {c.empresa_razon_social} (RIF: {c.empresa_rif_numero})
                              </option>
                            ))}
                          </select>
                        ) : selected.id_empresa ? (
                          <>
                            <div className="flex items-center gap-2">
                              <Building2 size={14} className="text-emerald-500" />
                              <span className="text-xs font-bold text-slate-700">{selected.empresa_razon_social}</span>
                            </div>
                            <p className="text-[10px] text-slate-400 font-medium">RIF: {selected.empresa_rif_numero}</p>
                          </>
                        ) : (
                          <p className="text-xs font-bold text-slate-400 italic">No vinculado</p>
                        )}
                      </div>
                    )}
                  </div>

                  {selected.tipo_afiliado === 'Corporativo' && (
                    <DataField
                      label="Razón Social"
                      value={selected.empresa_razon_social || 'N/A'}
                      isEditing={isEditing}
                      fieldName="empresa_razon_social"
                      form={editForm}
                      setForm={setEditForm}
                    />
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <DataField
                      label="Nombres"
                      value={selected.nombres || 'N/A'}
                      isEditing={isEditing}
                      fieldName="nombres"
                      form={editForm}
                      setForm={setEditForm}
                    />
                    <DataField
                      label="Apellidos"
                      value={selected.apellidos || 'N/A'}
                      isEditing={isEditing}
                      fieldName="apellidos"
                      form={editForm}
                      setForm={setEditForm}
                    />
                  </div>
                  <DataField
                    label="Nivel Académico"
                    value={selected.nivel_academico || 'No especificado'}
                    isEditing={isEditing}
                    fieldName="nivel_academico"
                    form={editForm}
                    setForm={setEditForm}
                    type="select"
                    options={ACADEMIC_OPTIONS}
                  />
                </div>
              </div>

              {/* Información de Contacto y Ubicación */}
              <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100 space-y-6">
                <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
                  <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                    <MapPin size={16} />
                  </div>
                  <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">Contacto y Ubicación</h3>
                </div>

                <div className="space-y-4">
                  <DataField
                    label="Correo Electrónico"
                    value={selected.email}
                    isEditing={isEditing}
                    fieldName="email"
                    form={editForm}
                    setForm={setEditForm}
                  />
                  <DataField
                    label="Teléfono"
                    value={selected.telefono || 'Sin teléfono'}
                    isEditing={isEditing}
                    fieldName="telefono"
                    form={editForm}
                    setForm={setEditForm}
                  />
                  <DataField
                    label="Dirección"
                    value={selected.direccion || 'Sin dirección'}
                    isEditing={isEditing}
                    fieldName="direccion"
                    form={editForm}
                    setForm={setEditForm}
                  />
                  <DataField
                    label="Fecha Nacimiento"
                    value={selected.fecha_nacimiento || 'N/A'}
                    isEditing={isEditing}
                    fieldName="fecha_nacimiento"
                    form={editForm}
                    setForm={setEditForm}
                    type="date"
                  />
                </div>
              </div>

              {/* Redes Sociales y Web (Full Width) */}
              <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100 md:col-span-2 space-y-6">
                <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
                  <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                    <BadgeCheck size={16} />
                  </div>
                  <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">Redes Sociales y Web</h3>
                </div>

                <div className="space-y-4">
                  <DataField
                    label="Instagram"
                    value={selected.instagram || 'No configurado'}
                    isEditing={isEditing}
                    fieldName="instagram"
                    form={editForm}
                    setForm={setEditForm}
                  />
                  <DataField
                    label="Facebook"
                    value={selected.facebook || 'No configurado'}
                    isEditing={isEditing}
                    fieldName="facebook"
                    form={editForm}
                    setForm={setEditForm}
                  />
                  <DataField
                    label="LinkedIn"
                    value={selected.linkedin || 'No configurado'}
                    isEditing={isEditing}
                    fieldName="linkedin"
                    form={editForm}
                    setForm={setEditForm}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 text-[10px] text-slate-400 font-medium pt-2">
              <Calendar size={12} /> Registrado el {new Date(selected.fecha_registro).toLocaleDateString()}
            </div>

            {/* Nueva Sección: Afiliados Asociados (Solo para Corporativos) */}
            {selected.tipo_afiliado === 'Corporativo' && (
              <div className="bg-slate-50/50 rounded-[2rem] p-6 border border-slate-100 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-slate-400 shadow-sm">
                      <UserIcon size={16} />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">Afiliados Asociados</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Trabajadores directos del corporativo</p>
                    </div>
                  </div>
                  <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black px-2 py-0.5 rounded-full">
                    {associatedMembers.length} MIEMBROS
                  </span>
                </div>

                {associatedMembers.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {associatedMembers.map(m => (
                      <div
                        key={m.id_afiliado}
                        onClick={() => setSelected(m)}
                        className="group flex items-center gap-3 p-3 bg-white rounded-2xl border border-slate-100 hover:border-emerald-200 transition-all cursor-pointer shadow-sm hover:shadow-md"
                      >
                        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-500 transition-colors">
                          <UserIcon size={18} />
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-xs font-black text-slate-700 truncate group-hover:text-emerald-600 transition-colors">
                            {m.nombres} {m.apellidos}
                          </p>
                          <p className="text-[9px] text-slate-400 font-bold uppercase">
                            {m.cedula}
                          </p>
                        </div>
                        <ChevronRight size={14} className="ml-auto text-slate-300 group-hover:text-emerald-500 transition-transform group-hover:translate-x-1" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-slate-200">
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wide">No hay trabajadores asociados todavía</p>
                    <p className="text-[10px] text-slate-300 mt-1">Los trabajadores aparecerán aquí una vez vinculados a este RIF.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Nuevo Miembro */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl max-h-[90vh] rounded-[3rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
            <div className="bg-slate-50 p-8 border-b border-gray-100 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-xl font-black text-slate-800">Registrar Nuevo Miembro</h3>
                <p className="text-sm text-slate-400 font-medium">Carga un nuevo afiliado directamente al directorio</p>
              </div>
              <button onClick={() => setShowNewModal(false)} className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-slate-400 hover:text-slate-600 shadow-sm transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-8 overflow-y-auto space-y-8 flex-1">
              {/* Información de Identidad */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
                  <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                    <UserIcon size={16} />
                  </div>
                  <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">Identidad del Afiliado</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <DataInput label="Nombres" placeholder="Ej: Juan" value={(newForm as any).nombres || ''} onChange={(v: string) => setNewForm({ ...newForm, nombres: v } as any)} />
                  <DataInput label="Apellidos" placeholder="Ej: Pérez" value={(newForm as any).apellidos || ''} onChange={(v: string) => setNewForm({ ...newForm, apellidos: v } as any)} />
                  <DataInput
                    label="Razón Social (si es corporativo)"
                    placeholder="Inmobiliaria XYZ C.A."
                    value={newForm.empresa_razon_social || ''}
                    onChange={(v: string) => setNewForm({
                      ...newForm,
                      empresa_razon_social: v,
                      tipo_afiliado: v.trim() ? 'Corporativo' : (newForm.id_empresa ? 'Agente' : 'Natural')
                    })}
                  />
                  <DataInput label="Cédula / RIF" placeholder="V-12345678" value={newForm.cedula || ''} onChange={(v: string) => setNewForm({ ...newForm, cedula: v })} />
                  <DataInput label="Código CIBIR (Opcional)" placeholder="359" value={newForm.codigo_cibir || ''} onChange={(v: string) => setNewForm({ ...newForm, codigo_cibir: v })} />
                </div>

                <div className="p-4 bg-emerald-50/50 border border-emerald-100/50 rounded-2xl space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 size={14} className="text-emerald-500" />
                    <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Afiliación Corporativa (Opcional)</span>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Corporativo al que pertenece</label>
                    <select
                      className="w-full bg-white border border-gray-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all appearance-none cursor-pointer"
                      value={newForm.id_empresa || ''}
                      onChange={(e) => {
                        const corpId = e.target.value ? Number(e.target.value) : null;
                        setNewForm({
                          ...newForm,
                          id_empresa: corpId,
                          tipo_afiliado: corpId ? 'Agente' : 'Natural'
                        });
                      }}
                    >
                      <option value="">Independiente (Sin Corporativo)</option>
                      {companies.map(c => (
                        <option key={c.id_afiliado} value={c.id_afiliado}>
                          {c.empresa_razon_social || c.nombre_completo} (RIF: {c.empresa_rif_numero || c.cedula})
                        </option>
                      ))}
                    </select>
                    {newForm.id_empresa && (
                      <p className="text-[10px] text-emerald-600 font-bold ml-1 mt-1">
                        * Se registrará como afiliado vinculado al RIF del corporativo seleccionado.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Contacto y Perfil */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
                  <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                    <Mail size={16} />
                  </div>
                  <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">Contacto y Perfil</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <DataInput label="Correo Electrónico" placeholder="juan@ejemplo.com" value={newForm.email || ''} onChange={(v: string) => setNewForm({ ...newForm, email: v })} />
                  <DataInput label="Teléfono" placeholder="+58 412..." value={newForm.telefono || ''} onChange={(v: string) => setNewForm({ ...newForm, telefono: v })} />

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nivel Académico</label>
                    <select
                      className="w-full bg-slate-50 border border-gray-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all appearance-none cursor-pointer"
                      value={newForm.nivel_academico || ''}
                      onChange={(e) => setNewForm({ ...newForm, nivel_academico: e.target.value })}
                    >
                      <option value="">No especificado</option>
                      <option value="Bachiller">Bachiller</option>
                      <option value="TSU">TSU</option>
                      <option value="Universitario">Universitario</option>
                      <option value="Postgrado">Postgrado</option>
                    </select>
                  </div>

                  <DataInput label="Fecha Nacimiento" type="date" value={newForm.fecha_nacimiento || ''} onChange={(v: string) => setNewForm({ ...newForm, fecha_nacimiento: v })} />
                </div>

                <DataInput label="Dirección" placeholder="Av. Principal..." value={newForm.direccion || ''} onChange={(v: string) => setNewForm({ ...newForm, direccion: v })} />
              </div>

              {/* Redes Sociales */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
                  <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                    <BadgeCheck size={16} />
                  </div>
                  <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">Redes Sociales</h3>
                </div>

                <div className="space-y-4">
                  <DataInput label="Instagram" placeholder="@usuario" value={newForm.instagram || ''} onChange={(v: string) => setNewForm({ ...newForm, instagram: v })} />
                  <DataInput label="Facebook" placeholder="facebook.com/usuario" value={newForm.facebook || ''} onChange={(v: string) => setNewForm({ ...newForm, facebook: v })} />
                  <DataInput label="LinkedIn" placeholder="linkedin.com/in/usuario" value={newForm.linkedin || ''} onChange={(v: string) => setNewForm({ ...newForm, linkedin: v })} />
                </div>
              </div>
            </div>

            <div className="p-8 border-t border-gray-50 flex gap-4 shrink-0 bg-white">
              <button
                onClick={() => setShowNewModal(false)}
                className="flex-1 px-8 py-4 rounded-2xl text-sm font-bold text-slate-400 hover:bg-slate-50 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                className="flex-[2] bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-4 rounded-2xl text-sm font-bold shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
              >
                <Save size={18} />
                Registrar Miembro
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function DataField({ label, value, isEditing, fieldName, form, setForm, type = 'text', options = [], className = '', labelClassName = '' }: any) {
  return (
    <div className="space-y-1">
      <label className={`text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 ${labelClassName}`}>{label}</label>
      {isEditing ? (
        type === 'select' ? (
          <select
            className="w-full bg-slate-50 border border-gray-100 rounded-xl px-4 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all appearance-none cursor-pointer"
            value={form[fieldName] || ''}
            onChange={(e) => setForm({ ...form, [fieldName]: e.target.value })}
          >
            <option value="">Seleccionar...</option>
            {options.map((opt: any) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        ) : (
          <input
            type={type}
            className="w-full bg-slate-50 border border-gray-100 rounded-xl px-4 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all"
            value={form[fieldName] || ''}
            onChange={(e) => setForm({ ...form, [fieldName]: e.target.value })}
          />
        )
      ) : (
        <p className={`bg-slate-50/50 border border-transparent rounded-xl px-4 py-2 text-sm font-bold text-slate-700 ${className}`}>{value}</p>
      )}
    </div>
  )
}

function DataInput({ label, placeholder, value, onChange, type = 'text' }: any) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        className="w-full bg-slate-50 border border-gray-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}
