import React, { useEffect, useMemo, useRef, useState } from 'react'
import { API_URL } from '@/config/env'
import { useAuth } from '@/context/AuthContext'
import { formatNombreCard, formatRif, getInitials } from '@/utils/formatters'
import { EstatusAfiliado, AfiliadoDTO } from '@/types/afiliados'
import { uploadFileSupabase } from '@/pages/admin/components/Cms/CmsShared'

import {
  UserPlus, Search, Filter, RefreshCw, Trash2, Edit3, Save, X,
  ChevronRight, Building2, User as UserIcon, CheckCircle2, AlertCircle,
  Mail, Phone, MapPin, BadgeCheck, FileText, Calendar, CreditCard,
  ShieldAlert, ArrowUpDown, ChevronDown, ImageIcon, Upload, Loader2,
  Briefcase, StickyNote, Globe, FileDown, Music2, Facebook, Instagram, Linkedin
} from 'lucide-react'
import ExportAfiliadosModal from '@/pages/admin/components/Afiliados/export/ExportAfiliadosModal'
import type { ExportTipoFilter } from '@/pages/admin/components/Afiliados/export/filterAfiliadosForExport'


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
  const [filterTipo, setFilterTipo] = useState<'Todos' | 'Natural' | 'Corporativo' | 'Agente Corporativo'>('Todos')
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)
  const [sortState, setSortState] = useState<'nombre_asc' | 'nombre_desc' | 'codigo_asc' | 'codigo_desc'>('codigo_asc')

  const [selected, setSelected] = useState<AfiliadoDTO | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState<Partial<AfiliadoDTO>>({})
  const [companies, setCompanies] = useState<AfiliadoDTO[]>([])
  type ImageEditKind = 'logo' | 'foto'
  const [imageEditKind, setImageEditKind] = useState<ImageEditKind | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageUploading, setImageUploading] = useState(false)
  const [imageError, setImageError] = useState('')
  const [imageDragOver, setImageDragOver] = useState(false)
  const imageFileInputRef = useRef<HTMLInputElement>(null)

  const [showNewModal, setShowNewModal] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
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
        // Solo mostrar afiliados que han completado el proceso de afiliación
        const approved = json.data.filter((a: AfiliadoDTO) =>
          ['Afiliado', 'Moroso', 'Suspendido', 'Rechazado'].includes(a.estatus)
        )
        setItems(approved)
        // Guardar empresas (tipo Corporativo) para el selector de vinculación
        setCompanies(approved.filter((a: AfiliadoDTO) => a.tipo_afiliado === 'Corporativo'))
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
    setImageEditKind(null)
    setImagePreview(null)
    setImageFile(null)
    setImageError('')
  }

  const openImageEditor = (kind: ImageEditKind) => {
    if (!selected) return
    setImageEditKind(kind)
    setImageError('')
    setImageFile(null)
    setImagePreview(
      kind === 'logo'
        ? selected.empresa_logo_url || null
        : selected.foto_url || null
    )
  }

  const closeImageEditor = () => {
    setImageEditKind(null)
    setImageFile(null)
    setImagePreview(null)
    setImageError('')
  }

  const handleImageFileChange = (file: File) => {
    setImageFile(file)
    setImageError('')
    const reader = new FileReader()
    reader.onload = (e) => setImagePreview(e.target?.result as string)
    reader.readAsDataURL(file)
  }

  const handleSaveImage = async () => {
    if (!selected || !imageEditKind) return
    setImageUploading(true)
    setImageError('')
    try {
      const isLogo = imageEditKind === 'logo'
      let finalUrl = imagePreview || (isLogo ? selected.empresa_logo_url : selected.foto_url) || ''
      if (imageFile) {
        finalUrl = await uploadFileSupabase(
          imageFile,
          isLogo ? 'logos/empresas' : 'fotos/afiliados'
        )
      }
      const payload = isLogo ? { empresa_logo_url: finalUrl } : { foto_url: finalUrl }
      const res = await fetch(`${API_URL}/api/afiliados/${selected.id_afiliado}`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        const updated = isLogo
          ? { ...selected, empresa_logo_url: finalUrl }
          : { ...selected, foto_url: finalUrl }
        setSelected(updated)
        setItems(items.map(item => item.id_afiliado === selected.id_afiliado ? updated : item))
        closeImageEditor()
      } else {
        setImageError('Error al guardar en el servidor')
      }
    } catch (err: any) {
      setImageError(err?.message || 'Error al subir la imagen')
    } finally {
      setImageUploading(false)
    }
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
      const razonSocial = (item.empresa_razon_social || '').toLowerCase()
      const cedula = (item.cedula || '').toLowerCase()
      const rif = (item.empresa_rif_numero || '').toLowerCase()
      const email = (item.email || '').toLowerCase()
      const s = search.toLowerCase()

      const matchSearch = nombre.includes(s) || razonSocial.includes(s) || cedula.includes(s) || rif.includes(s) || email.includes(s)

       let matchTipo = filterTipo === 'Todos' || item.tipo_afiliado === filterTipo
       if (filterTipo === 'Agente Corporativo') {
         matchTipo = item.tipo_afiliado === 'Agente' || item.tipo_afiliado === 'Agente Corporativo'
       }

      return matchSearch && matchTipo
    })

    result.sort((a, b) => {
      if (sortState.startsWith('codigo')) {
        const codA = parseInt(a.codigo || '0', 10) || 0;
        const codB = parseInt(b.codigo || '0', 10) || 0;
        return sortState === 'codigo_asc' ? codA - codB : codB - codA;
      } else {
        const nomA = (a.tipo_afiliado === 'Corporativo' && a.empresa_razon_social ? a.empresa_razon_social : a.nombre_completo || '').toLowerCase();
        const nomB = (b.tipo_afiliado === 'Corporativo' && b.empresa_razon_social ? b.empresa_razon_social : b.nombre_completo || '').toLowerCase();
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

  const newTipo = newForm.tipo_afiliado || 'Natural'
  const isNewCorporativo = newTipo === 'Corporativo'

  const openNewMemberModal = () => {
    setNewForm({ tipo_afiliado: 'Natural', estatus: 'Afiliado' })
    setShowNewModal(true)
  }

  const handleNewTipoChange = (tipo: 'Natural' | 'Corporativo' | 'Agente Corporativo') => {
    setNewForm((prev) => ({
      ...prev,
      tipo_afiliado: tipo,
      ...(tipo === 'Corporativo'
        ? { id_empresa: null }
        : { empresa_razon_social: undefined, empresa_rif_tipo: undefined, empresa_rif_numero: undefined, empresa_email: undefined, empresa_telefono: undefined, empresa_website: undefined }),
      ...(tipo !== 'Agente Corporativo' ? { id_empresa: null } : {})
    }))
  }

  const [createError, setCreateError] = useState<string | null>(null)
  const [formErrors, setFormErrors] = useState<Record<string, boolean>>({})

  const handleCreate = async () => {
    setCreateError(null)
    setFormErrors({})
    const errors: Record<string, boolean> = {}

    try {
      const tipoFinal = newTipo;
      
      // Basic validation
      if (!newForm.nombres?.trim()) errors.nombres = true
      if (!newForm.apellidos?.trim()) errors.apellidos = true
      if (!newForm.email?.trim()) errors.email = true
      if (!newForm.cedula?.trim()) errors.cedula = true

      if (tipoFinal === 'Agente Corporativo' && !newForm.id_empresa) {
        errors.id_empresa = true
      }

      if (tipoFinal === 'Corporativo') {
        if (!newForm.empresa_razon_social?.trim()) errors.empresa_razon_social = true
        if (!newForm.empresa_rif_numero?.trim()) errors.empresa_rif_numero = true
      }

      if (Object.keys(errors).length > 0) {
        setFormErrors(errors)
        setCreateError('Por favor, complete todos los campos obligatorios marcados en rojo.')
        return
      }

      const rifEmpresa = newForm.empresa_rif_numero?.trim();
      const payload = {
        ...newForm,
        tipo_afiliado: tipoFinal,
        id_empresa: tipoFinal === 'Agente Corporativo' ? newForm.id_empresa : null,
        cedula: tipoFinal === 'Corporativo' && rifEmpresa
          ? rifEmpresa
          : (newForm.cedula || ''),
        email: tipoFinal === 'Corporativo'
          ? (newForm.empresa_email || newForm.email)
          : newForm.email,
        telefono: tipoFinal === 'Corporativo'
          ? (newForm.empresa_telefono || newForm.telefono)
          : newForm.telefono,
      }

      const res = await fetch(`${API_URL}/api/afiliados`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(payload)
      })
      const json = await res.json()
      if (res.ok && json.success) {
        setShowNewModal(false)
        setNewForm({ tipo_afiliado: 'Natural', estatus: 'Afiliado' })
        setFormErrors({})
        load()
      } else {
        setCreateError(json.message || 'Error al crear')
      }
    } catch (err) {
      console.error(err)
      setCreateError('Error de conexión al servidor.')
    }
  }

  const ACADEMIC_OPTIONS = [
    { value: 'Bachiller', label: 'Bachiller' },
    { value: 'TSU', label: 'TSU' },
    { value: 'Nivel Profesional', label: 'Nivel Profesional' },
    { value: 'Postgrado', label: 'Postgrado' },
    ];

  return (
    <div className="flex h-full w-full bg-white overflow-hidden">
      {/* Sidebar de Lista */}
      <div className={`w-full sm:w-80 border-r border-gray-100 flex flex-col min-h-0 overflow-hidden shrink-0 ${selected ? 'hidden sm:flex' : 'flex'}`}>
        <div className="p-4 border-b border-gray-100 space-y-4 shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-800">Directorio</h2>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowExportModal(true)}
                title="Exportar listado en PDF"
                className="p-2 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl hover:bg-emerald-100 transition-colors"
              >
                <FileDown size={18} />
              </button>
              <button
                onClick={openNewMemberModal}
                className="p-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors shadow-sm shadow-emerald-500/20"
              >
                <UserPlus size={18} />
              </button>
            </div>
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

          <div className="relative w-full">
            <button
              type="button"
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className="w-full flex items-center justify-between gap-1.5 px-2 py-2 bg-slate-50 border border-gray-100 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <Filter size={14} className="text-slate-400 shrink-0" />
                <span className="text-[10px] font-bold uppercase tracking-widest truncate">
                  Filtro: {filterTipo === 'Todos' ? 'Todos' : filterTipo === 'Natural' ? 'Agentes Independientes' : filterTipo === 'Agente Corporativo' ? 'Agentes Corporativos' : 'Corporativos'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className={`w-2 h-2 rounded-full ${
                  filterTipo === 'Todos' ? 'bg-slate-400' :
                  filterTipo === 'Natural' ? 'bg-blue-500' :
                  filterTipo === 'Corporativo' ? 'bg-emerald-500' : 'bg-amber-500'
                }`} />
                <ChevronDown size={14} className={`text-slate-400 transition-transform ${showFilterDropdown ? 'rotate-180' : ''}`} />
              </div>
            </button>

            {showFilterDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowFilterDropdown(false)} />
                <div className="absolute left-0 right-0 mt-1.5 rounded-xl bg-white shadow-xl border border-gray-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="py-1">
                    {[
                      { id: 'Todos', label: 'Todos' },
                      { id: 'Natural', label: 'Agentes Independientes' },
                      { id: 'Corporativo', label: 'Corporativos' },
                      { id: 'Agente Corporativo', label: 'Agentes Corporativos' },
                    ].map((f) => (
                      <button
                        key={f.id}
                        onClick={() => {
                          setFilterTipo(f.id as any);
                          setShowFilterDropdown(false);
                        }}
                        className={`w-full text-left px-2 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors duration-200 flex items-center justify-between ${
                          filterTipo === f.id
                            ? f.id === 'Todos' ? 'bg-slate-800 text-white' : f.id === 'Natural' ? 'bg-blue-600 text-white' : f.id === 'Corporativo' ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'
                            : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span className="truncate mr-2">{f.label}</span>
                        {filterTipo === f.id ? (
                          <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />
                        ) : (
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            f.id === 'Todos' ? 'bg-slate-300' :
                            f.id === 'Natural' ? 'bg-blue-400' :
                            f.id === 'Corporativo' ? 'bg-emerald-400' : 'bg-amber-400'
                          }`} />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
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
                  <p className="font-bold text-slate-800 text-sm truncate">
                    {item.tipo_afiliado === 'Corporativo' && item.empresa_razon_social
                      ? item.empresa_razon_social
                      : formatNombreCard(item.nombre_completo)}
                  </p>

                  <div className="flex items-center gap-2 mt-1">
                     <span className={`text-[8px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded-md ${
                       item.tipo_afiliado === 'Corporativo' ? 'bg-emerald-100 text-emerald-700' : 
                       item.tipo_afiliado === 'Agente' || item.tipo_afiliado === 'Agente Corporativo' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                     }`}>
                       {item.tipo_afiliado === 'Corporativo' ? 'Corporativos' : 
                        item.tipo_afiliado === 'Agente' || item.tipo_afiliado === 'Agente Corporativo' ? 'Agentes Corporativos' : 'Agentes Independientes'}
                     </span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {item.empresa_rif_numero ? formatRif(item.empresa_rif_tipo, item.empresa_rif_numero) : item.cedula}
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
      <div className={`flex-1 overflow-y-auto min-h-0 bg-slate-50/30 p-6 sm:p-8 ${!selected ? 'hidden sm:block' : 'block'}`}>
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
            <button
              onClick={() => setSelected(null)}
              className="sm:hidden flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors mb-4"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
              Volver a la lista
            </button>
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
                {/* Avatar / Logo */}
                {selected.tipo_afiliado === 'Corporativo' ? (
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="relative">
                      <div
                        className="w-24 h-24 rounded-[2rem] flex items-center justify-center overflow-hidden bg-emerald-50 border-2 border-emerald-100 shadow-inner cursor-pointer hover:border-emerald-300 transition-colors"
                        onClick={() => openImageEditor('logo')}
                        title="Haz clic para cambiar el logo de la empresa"
                      >
                        {selected.empresa_logo_url ? (
                          <img src={selected.empresa_logo_url} alt="Logo" className="w-full h-full object-contain p-1" />
                        ) : (
                          <Building2 size={36} className="text-emerald-400" />
                        )}
                      </div>
                      <button
                        type="button"
                        className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white border border-gray-200 shadow flex items-center justify-center hover:bg-emerald-50 transition-colors"
                        onClick={() => openImageEditor('logo')}
                        title="Editar logo"
                      >
                        <Edit3 size={12} className="text-slate-500" />
                      </button>
                    </div>
                    <div className="relative">
                      <div
                        className="w-16 h-16 rounded-full flex items-center justify-center overflow-hidden bg-slate-100 border-2 border-slate-200 shadow-inner cursor-pointer hover:border-emerald-300 transition-colors"
                        onClick={() => openImageEditor('foto')}
                        title="Haz clic para cambiar la foto del representante"
                      >
                        {selected.foto_url ? (
                          <img src={selected.foto_url} alt="Representante" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-sm font-black text-emerald-700 uppercase">
                            {getInitials(selected.nombres, selected.apellidos)}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-white border border-gray-200 shadow flex items-center justify-center hover:bg-emerald-50 transition-colors"
                        onClick={() => openImageEditor('foto')}
                        title="Editar foto del representante"
                      >
                        <Edit3 size={10} className="text-slate-500" />
                      </button>
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider text-center mt-1.5 max-w-[4.5rem]">
                        Representante
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="relative shrink-0">
                    <div
                      className="w-24 h-24 rounded-[2rem] flex items-center justify-center overflow-hidden bg-blue-50 border-2 border-blue-100 shadow-inner cursor-pointer hover:border-emerald-300 transition-colors"
                      onClick={() => openImageEditor('foto')}
                      title="Haz clic para cambiar la foto de perfil"
                    >
                      {selected.foto_url ? (
                        <img src={selected.foto_url} alt="Foto de perfil" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xl font-black text-blue-600 uppercase tracking-tighter">
                          {getInitials(selected.nombres, selected.apellidos)}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white border border-gray-200 shadow flex items-center justify-center hover:bg-emerald-50 transition-colors"
                      onClick={() => openImageEditor('foto')}
                      title="Editar foto de perfil"
                    >
                      <Edit3 size={12} className="text-slate-500" />
                    </button>
                  </div>
                )}


                <div className="text-center sm:text-left space-y-1">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">
                      {/* nombre_completo es columna VIRTUAL GENERATED — se muestra, no se edita */}
                      {selected.tipo_afiliado === 'Corporativo' && selected.empresa_razon_social
                        ? selected.empresa_razon_social
                        : formatNombreCard(selected.nombre_completo)}
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
                      label="Código de Afiliado"
                      value={selected.codigo || 'Sin Código'}
                      isEditing={isEditing}
                      fieldName="codigo"
                      form={editForm}
                      setForm={setEditForm}
                      className="!bg-transparent !p-0 !border-none !text-slate-400 !font-bold !text-sm !uppercase !tracking-widest"
labelClassName="hidden"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Grid de Datos — Secciones dinámicas por tipo de afiliado */}
            <div className="grid grid-cols-1 gap-6">

              {/* ── SECCIÓN: INFORMACIÓN DE LA EMPRESA (solo Corporativo) ── */}
              {(isEditing ? editForm.tipo_afiliado === 'Corporativo' : selected.tipo_afiliado === 'Corporativo') && (
                <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-emerald-100">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
                      <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-500">
                        <Building2 size={16} />
                      </div>
                      <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">Información de la Empresa</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <DataField label="Razón Social" value={selected.empresa_razon_social || 'Sin razón social'} isEditing={isEditing} fieldName="empresa_razon_social" form={editForm} setForm={setEditForm} />
                      <DataField label="Correo de la Empresa" value={selected.empresa_email || 'Sin correo'} isEditing={isEditing} fieldName="empresa_email" form={editForm} setForm={setEditForm} />
                      <DataField label="Teléfono de la Empresa" value={selected.empresa_telefono || 'Sin teléfono'} isEditing={isEditing} fieldName="empresa_telefono" form={editForm} setForm={setEditForm} />
                      <DataField label="Sitio Web" value={selected.empresa_website || 'Sin sitio web'} isEditing={isEditing} fieldName="empresa_website" form={editForm} setForm={setEditForm} />
                    </div>
                  </div>
                </div>
              )}

              {/* ── SECCIÓN PERSONAL: Representante Legal / Agente / Info Personal ── */}
              <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                      (isEditing ? editForm.tipo_afiliado : selected.tipo_afiliado) === 'Corporativo' ? 'bg-emerald-50 text-emerald-500' :
                      ((isEditing ? editForm.tipo_afiliado : selected.tipo_afiliado) === 'Agente' || selected.tipo_afiliado === 'Agente Corporativo') ? 'bg-amber-50 text-amber-500' :
                      'bg-blue-50 text-blue-500'
                    }`}>
                      <UserIcon size={16} />
                    </div>
                    <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">
                      {(isEditing ? editForm.tipo_afiliado : selected.tipo_afiliado) === 'Corporativo' ? 'Representante Legal' :
                       ((isEditing ? editForm.tipo_afiliado : selected.tipo_afiliado) === 'Agente' || selected.tipo_afiliado === 'Agente Corporativo') ? 'Información del Agente' :
                       'Información Personal'}
                    </h3>
                  </div>

                  {/* Datos en grid 3 columnas */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <DataField label="Nombres" value={selected.nombres} isEditing={isEditing} fieldName="nombres" form={editForm} setForm={setEditForm} />
                    <DataField label="Apellidos" value={selected.apellidos} isEditing={isEditing} fieldName="apellidos" form={editForm} setForm={setEditForm} />
                    <DataField label="Código de Afiliado" value={selected.codigo || 'No asignado'} isEditing={isEditing} fieldName="codigo" form={editForm} setForm={setEditForm} />
                    <DataField label="Correo Electrónico" value={selected.email} isEditing={isEditing} fieldName="email" form={editForm} setForm={setEditForm} />
                    <DataField label="Teléfono" value={selected.telefono || 'Sin teléfono'} isEditing={isEditing} fieldName="telefono" form={editForm} setForm={setEditForm} />
                    <DataField label="Dirección" value={selected.direccion || 'Sin dirección'} isEditing={isEditing} fieldName="direccion" form={editForm} setForm={setEditForm} />
                    <DataField label="Fecha de Nacimiento" value={selected.fecha_nacimiento || 'N/A'} isEditing={isEditing} fieldName="fecha_nacimiento" form={editForm} setForm={setEditForm} type="date" />
                    <DataField label="Nivel Académico" value={selected.nivel_academico || 'No especificado'} isEditing={isEditing} fieldName="nivel_academico" form={editForm} setForm={setEditForm} type="select" options={ACADEMIC_OPTIONS} />
                    <DataField label="Profesión / Especialidad" value={selected.profesion || 'No especificada'} isEditing={isEditing} fieldName="profesion" form={editForm} setForm={setEditForm} />
                  </div>

                  {/* Cédula con editor de prefijo */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cédula</label>
                    {isEditing ? (
                      <div className="flex gap-2 max-w-xs">
                        <div className="relative">
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
                          <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>
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
                      <p className="bg-slate-50/50 border border-transparent rounded-xl px-4 py-2 text-sm font-bold text-slate-700 w-fit">
                        {selected.cedula}
                      </p>
                    )}
                  </div>

                  {/* Tipo de Afiliación + Vinculación empresa para Agentes */}
                  <div className="p-4 bg-slate-50 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo de Afiliación</p>
                      {isEditing ? (
                        <div className="relative">
                          <select
                            className="text-[10px] font-black uppercase px-2 py-1 pr-6 rounded-md bg-white border border-gray-200 outline-none focus:ring-2 focus:ring-emerald-500/10 appearance-none cursor-pointer"
                            value={editForm.tipo_afiliado}
                            onChange={(e) => setEditForm({ ...editForm, tipo_afiliado: e.target.value as any })}
                          >
                            <option value="Natural">Agente Independiente</option>
                            <option value="Corporativo">Corporativo</option>
                            <option value="Agente Corporativo">Agente Corporativo</option>
                          </select>
                          <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>
                      ) : (
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                          selected.tipo_afiliado === 'Corporativo' ? 'bg-emerald-100 text-emerald-700' :
                          (selected.tipo_afiliado === 'Agente' || selected.tipo_afiliado === 'Agente Corporativo') ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {selected.tipo_afiliado === 'Corporativo' ? 'Corporativo' :
                           (selected.tipo_afiliado === 'Agente' || selected.tipo_afiliado === 'Agente Corporativo') ? 'Agente Corporativo' : 'Agente Independiente'}
                        </span>
                      )}
                    </div>

                    {(isEditing ? editForm.tipo_afiliado === 'Agente Corporativo' : (selected.tipo_afiliado === 'Agente' || selected.tipo_afiliado === 'Agente Corporativo')) && (
                      <div className="pt-2 border-t border-gray-200 space-y-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Empresa Vinculada</p>
                        {isEditing ? (
                          <div className="relative">
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
                            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                          </div>
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
                </div>
              </div>

              {/* ── SECCIÓN: REDES SOCIALES ── */}
              <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100 space-y-4">
                <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
                  <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                    <BadgeCheck size={16} />
                  </div>
                  <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">Redes Sociales y Web</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <DataField label="Sitio Web" value={selected.website || 'No configurado'} isEditing={isEditing} fieldName="website" form={editForm} setForm={setEditForm} />
                  <DataField label="Instagram" value={selected.instagram || 'No configurado'} isEditing={isEditing} fieldName="instagram" form={editForm} setForm={setEditForm} />
                  <DataField label="Facebook" value={selected.facebook || 'No configurado'} isEditing={isEditing} fieldName="facebook" form={editForm} setForm={setEditForm} />
                  <DataField label="LinkedIn" value={selected.linkedin || 'No configurado'} isEditing={isEditing} fieldName="linkedin" form={editForm} setForm={setEditForm} />
                  <DataField label="X (Twitter)" value={selected.twitter || 'No configurado'} isEditing={isEditing} fieldName="twitter" form={editForm} setForm={setEditForm} />
                  <DataField label="TikTok" value={selected.tiktok || 'No configurado'} isEditing={isEditing} fieldName="tiktok" form={editForm} setForm={setEditForm} />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100 space-y-6">
              <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
                <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                  <ShieldAlert size={16} />
                </div>
                <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">Control Administrativo</h3>
              </div>
              <div className="space-y-4">
                {/* Estatus */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Estatus de Afiliación</label>
                  {isEditing ? (
                    <div className="relative">
                      <select
                        className="w-full bg-slate-50 border border-gray-100 rounded-xl px-4 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all appearance-none cursor-pointer"
                        value={editForm.estatus || ''}
                        onChange={(e) => setEditForm({ ...editForm, estatus: e.target.value as EstatusAfiliado })}
                      >
                        <option value="1_PREINSCRIPCION">Preinscripción</option>
                        <option value="2_EXPEDIENTE">Expediente</option>
                        <option value="3_ENTREVISTA">Entrevista</option>
                        <option value="4_VERIFICACION">Verificación</option>
                        <option value="5_CIBIR">CIBIR</option>
                        <option value="6_INSCRIPCION">Inscripción</option>
                        <option value="Requiere Acción">Requiere Acción</option>
                        <option value="Afiliado">Afiliado</option>
                        <option value="Moroso">Moroso</option>
                        <option value="Suspendido">Suspendido</option>
                        <option value="Rechazado">Rechazado</option>
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  ) : (
                    <p className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold ${
                      selected.estatus === 'Afiliado' ? 'bg-emerald-100 text-emerald-700' :
                      selected.estatus === 'Moroso' ? 'bg-amber-100 text-amber-700' :
                      selected.estatus === 'Suspendido' || selected.estatus === 'Rechazado' ? 'bg-rose-100 text-rose-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {selected.estatus}
                    </p>
                  )}
                </div>

                {/* RIF Empresa (solo Corporativo) */}
                {(selected.tipo_afiliado === 'Corporativo' || (isEditing && editForm.tipo_afiliado === 'Corporativo')) && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">RIF de la Empresa</label>
                    {isEditing ? (
                      <div className="flex gap-2">
                        <select
                          className="w-20 bg-slate-50 border border-gray-100 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500/10 transition-all appearance-none cursor-pointer"
                          value={editForm.empresa_rif_tipo || 'J'}
                          onChange={(e) => setEditForm({ ...editForm, empresa_rif_tipo: e.target.value })}
                        >
                          {['J','G','P','V','E'].map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <input
                          type="text"
                          className="flex-1 bg-slate-50 border border-gray-100 rounded-xl px-4 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all"
                          value={editForm.empresa_rif_numero || ''}
                          placeholder="12345678-9"
                          onChange={(e) => setEditForm({ ...editForm, empresa_rif_numero: e.target.value })}
                        />
                      </div>
                    ) : (
                      <p className="bg-slate-50/50 border border-transparent rounded-xl px-4 py-2 text-sm font-bold text-slate-700">
                        {selected.empresa_rif_tipo}-{selected.empresa_rif_numero || 'Sin RIF'}
                      </p>
                    )}
                  </div>
                )}

                {/* Notas internas */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1">
                    <StickyNote size={10} /> Notas Internas (Admin)
                  </label>
                  {isEditing ? (
                    <textarea
                      rows={3}
                      className="w-full bg-slate-50 border border-gray-100 rounded-xl px-4 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all resize-none"
                      value={editForm.notas || ''}
                      placeholder="Notas internas visibles solo para administradores..."
                      onChange={(e) => setEditForm({ ...editForm, notas: e.target.value })}
                    />
                  ) : (
                    <p className="bg-slate-50/50 border border-transparent rounded-xl px-4 py-2 text-sm text-slate-600 whitespace-pre-wrap">
                      {selected.notas || <span className="text-slate-300 italic">Sin notas</span>}
                    </p>
                  )}
                </div>

                {/* Pagos y CIBIR */}
                {isEditing && (
                  <div className="flex gap-4 flex-wrap pt-2 border-t border-gray-50">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-emerald-600"
                        checked={!!editForm.inscripcion_pagada}
                        onChange={(e) => setEditForm({ ...editForm, inscripcion_pagada: e.target.checked ? 1 : 0 })}
                      />
                      <span className="text-xs font-bold text-slate-600">Inscripción Pagada</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-emerald-600"
                        checked={!!editForm.cibir_convalidado}
                        onChange={(e) => setEditForm({ ...editForm, cibir_convalidado: e.target.checked ? 1 : 0 })}
                      />
                      <span className="text-xs font-bold text-slate-600">CIBIR Convalidado</span>
                    </label>
                  </div>
                )}
                {!isEditing && (
                  <div className="flex gap-3 flex-wrap">
                    <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${ selected.inscripcion_pagada ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {selected.inscripcion_pagada ? '✓' : '✗'} Inscripción Pagada
                    </span>
                    <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${ selected.cibir_convalidado ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {selected.cibir_convalidado ? '✓' : '✗'} CIBIR Convalidado
                    </span>
                  </div>
                )}
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

            <div className="p-8 overflow-y-auto space-y-6 flex-1">
              {/* SECCIÓN 1: Perfil y Datos Personales */}
              <FormSection
                icon={<UserIcon size={16} />}
                title="Perfil y Datos Personales"
                subtitle="Información del representante legal, agente o miembro independiente"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo de Miembro</label>
                    <div className="relative">
                      <select
                        className="w-full bg-slate-50 border border-gray-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all appearance-none cursor-pointer"
                        value={newTipo}
                        onChange={(e) => handleNewTipoChange(e.target.value as 'Natural' | 'Corporativo' | 'Agente Corporativo')}
                      >
                        <option value="Natural">Agente independiente</option>
                        <option value="Corporativo">Corporativo (empresa)</option>
                        <option value="Agente Corporativo">Agente Corporativo</option>
                      </select>
                      <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  <DataInput label="Nombres" placeholder="Ej: Juan" value={(newForm as any).nombres || ''} onChange={(v: string) => setNewForm({ ...newForm, nombres: v } as any)} isRequired hasError={formErrors.nombres} />
                  <DataInput label="Apellidos" placeholder="Ej: Pérez" value={(newForm as any).apellidos || ''} onChange={(v: string) => setNewForm({ ...newForm, apellidos: v } as any)} isRequired hasError={formErrors.apellidos} />
                  
                  <div className="space-y-1.5">
                    <label className={`text-[10px] font-black uppercase tracking-widest ml-1 transition-colors ${formErrors.cedula ? 'text-red-500' : 'text-slate-400'}`}>
                      {isNewCorporativo ? "Cédula del representante" : "Cédula"} <span className="text-emerald-500">*</span>
                    </label>
                    <div className="flex gap-2">
                      <select 
                        className={`w-20 bg-slate-50 border rounded-2xl px-3 py-3 text-sm font-bold outline-none focus:ring-4 transition-all ${formErrors.cedula ? 'border-red-500 ring-red-500/10' : 'border-gray-100 focus:ring-emerald-500/10'}`}
                        value={newForm.cedula_tipo || 'V'}
                        onChange={(e) => setNewForm({ ...newForm, cedula_tipo: e.target.value })}
                      >
                        {['V', 'E', 'P'].map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                      <input 
                        className={`flex-1 bg-slate-50 border rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 transition-all ${formErrors.cedula ? 'border-red-500 ring-red-500/10' : 'border-gray-100 focus:ring-emerald-500/10'}`}
                        placeholder="12345678"
                        value={newForm.cedula || ''}
                        onChange={(e) => setNewForm({ ...newForm, cedula: e.target.value })}
                      />
                    </div>
                  </div>

                  <DataInput label="Fecha de nacimiento" type="date" value={newForm.fecha_nacimiento || ''} onChange={(v: string) => setNewForm({ ...newForm, fecha_nacimiento: v })} />
                  <DataInput label="Correo electrónico" placeholder="juan@ejemplo.com" value={newForm.email || ''} onChange={(v: string) => setNewForm({ ...newForm, email: v })} isRequired hasError={formErrors.email} />
                  <DataInput label="Teléfono" placeholder="+58 412..." value={newForm.telefono || ''} onChange={(v: string) => setNewForm({ ...newForm, telefono: v })} />
                  <div className="sm:col-span-2">
                    <DataInput label="Dirección de habitación" placeholder="Av. Principal..." value={newForm.direccion || ''} onChange={(v: string) => setNewForm({ ...newForm, direccion: v })} />
                  </div>
                  <div className="space-y-1.5">
                    <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${formErrors.nivel_academico ? 'text-red-500' : 'text-slate-400'}`}>Nivel académico</label>
                    <div className="relative">
                      <select
                        className={`w-full bg-slate-50 border rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 transition-all ${formErrors.nivel_academico ? 'border-red-500 ring-red-500/10' : 'border-gray-100 focus:ring-emerald-500/10'}`}
                        value={newForm.nivel_academico || ''}
                        onChange={(e) => setNewForm({ ...newForm, nivel_academico: e.target.value })}
                      >
                        <option value="">No especificado</option>
                        {ACADEMIC_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                      <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                  <DataInput label="Código de Afiliado (opcional)" placeholder="Dejar en blanco para autogenerar" value={newForm.codigo || ''} onChange={(v: string) => setNewForm({ ...newForm, codigo: v })} />
                </div>
                
                {/* Redes Sociales del Individuo */}
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Redes Sociales y Web (Personal)</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <DataInput label="Sitio Web" placeholder="https://..." value={newForm.website || ''} onChange={(v: string) => setNewForm({ ...newForm, website: v })} />
                    <DataInput label="Instagram" placeholder="https://instagram.com/..." value={newForm.instagram || ''} onChange={(v: string) => setNewForm({ ...newForm, instagram: v })} />
                    <DataInput label="Facebook" placeholder="https://facebook.com/..." value={newForm.facebook || ''} onChange={(v: string) => setNewForm({ ...newForm, facebook: v })} />
                    <DataInput label="LinkedIn" placeholder="https://linkedin.com/in/..." value={newForm.linkedin || ''} onChange={(v: string) => setNewForm({ ...newForm, linkedin: v })} />
                    <DataInput label="X (Twitter)" placeholder="https://x.com/..." value={newForm.twitter || ''} onChange={(v: string) => setNewForm({ ...newForm, twitter: v })} />
                    <DataInput label="TikTok" placeholder="https://tiktok.com/@..." value={newForm.tiktok || ''} onChange={(v: string) => setNewForm({ ...newForm, tiktok: v })} />
                  </div>
                </div>
              </FormSection>

              {/* SECCIÓN 2: Información de la Empresa (Solo Corporativos) */}
              {isNewCorporativo && (
                <FormSection
                  icon={<Building2 size={16} />}
                  title="Datos de la Empresa"
                  subtitle="Información pública y de contacto de la inmobiliaria"
                  variant="emerald"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <DataInput
                        label="Razón social"
                        placeholder="Inmobiliaria XYZ C.A."
                        value={newForm.empresa_razon_social || ''}
                        onChange={(v: string) => setNewForm({ ...newForm, empresa_razon_social: v })}
                        isRequired
                        hasError={formErrors.empresa_razon_social}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo RIF <span className="text-emerald-500">*</span></label>
                      <div className="relative">
                        <select
                          className="w-full bg-white border border-gray-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all appearance-none cursor-pointer"
                          value={newForm.empresa_rif_tipo || 'J'}
                          onChange={(e) => setNewForm({ ...newForm, empresa_rif_tipo: e.target.value })}
                        >
                          {ID_PREFIXES.map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                        <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                    <DataInput
                      label="Número RIF"
                      placeholder="12345678-9"
                      value={newForm.empresa_rif_numero || ''}
                      onChange={(v: string) => setNewForm({ ...newForm, empresa_rif_numero: v })}
                      isRequired
                      hasError={formErrors.empresa_rif_numero}
                    />
                    <DataInput label="Correo corporativo" placeholder="contacto@empresa.com" value={newForm.empresa_email || ''} onChange={(v: string) => setNewForm({ ...newForm, empresa_email: v })} />
                    <DataInput label="Teléfono corporativo" placeholder="+58 412..." value={newForm.empresa_telefono || ''} onChange={(v: string) => setNewForm({ ...newForm, empresa_telefono: v })} />
                    <div className="sm:col-span-2">
                      <DataInput label="Dirección fiscal o de oficina" placeholder="Av. Principal..." value={newForm.empresa_direccion || ''} onChange={(v: string) => setNewForm({ ...newForm, empresa_direccion: v })} />
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-emerald-100/50">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Redes Sociales y Web (Empresa)</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <DataInput label="Sitio web de la empresa" placeholder="https://www.empresa.com" value={newForm.empresa_website || ''} onChange={(v: string) => setNewForm({ ...newForm, empresa_website: v })} />
                      <DataInput label="Instagram Empresa" placeholder="https://instagram.com/..." value={newForm.empresa_instagram || ''} onChange={(v: string) => setNewForm({ ...newForm, empresa_instagram: v })} />
                      <DataInput label="Facebook Empresa" placeholder="https://facebook.com/..." value={newForm.empresa_facebook || ''} onChange={(v: string) => setNewForm({ ...newForm, empresa_facebook: v })} />
                      <DataInput label="LinkedIn Empresa" placeholder="https://linkedin.com/company/..." value={newForm.empresa_linkedin || ''} onChange={(v: string) => setNewForm({ ...newForm, empresa_linkedin: v })} />
                      <DataInput label="X (Twitter) Empresa" placeholder="https://x.com/..." value={newForm.empresa_twitter || ''} onChange={(v: string) => setNewForm({ ...newForm, empresa_twitter: v })} />
                      <DataInput label="TikTok Empresa" placeholder="https://tiktok.com/@..." value={newForm.empresa_tiktok || ''} onChange={(v: string) => setNewForm({ ...newForm, empresa_tiktok: v })} />
                    </div>
                  </div>
                </FormSection>
              )}

              {/* SECCIÓN 2 ALT: Vinculación Corporativa (Solo Agentes Corporativos) */}
              {newTipo === 'Agente Corporativo' && (
                <FormSection
                  icon={<Building2 size={16} />}
                  title="Vinculación Corporativa"
                  subtitle="Empresa a la que representa este agente"
                  variant="emerald"
                >
                  <div className="space-y-1.5">
                    <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${formErrors.id_empresa ? 'text-red-500' : 'text-slate-400'}`}>Seleccionar Empresa <span className="text-emerald-500">*</span></label>
                    <div className="relative">
                      <select
                        className={`w-full bg-white border rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 transition-all ${formErrors.id_empresa ? 'border-red-500 ring-red-500/10' : 'border-emerald-100 focus:ring-emerald-500/10'}`}
                        value={newForm.id_empresa || ''}
                        onChange={(e) => {
                          const corpId = e.target.value ? Number(e.target.value) : null
                          setNewForm({ ...newForm, id_empresa: corpId })
                        }}
                      >
                        <option value="">Buscar o seleccionar una empresa...</option>
                        {companies.map((c) => (
                          <option key={c.id_afiliado} value={c.id_empresa ?? ''}>
                            {c.empresa_razon_social || c.nombre_completo} (RIF: {c.empresa_rif_numero || c.cedula})
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                </FormSection>
              )}
            </div>

            <div className="px-8 pb-8 flex flex-col gap-4 bg-white">
              {createError && (
                <div className="flex items-center gap-3 text-red-100 bg-red-500/20 border border-red-400/40 p-4 rounded-2xl text-xs font-bold justify-center animate-in slide-in-from-top-2 duration-300">
                  <AlertCircle size={16} className="text-red-400 shrink-0" />
                  {createError}
                </div>
              )}

              <div className="flex gap-4">
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
        </div>
      )}

      {/* ── EDITOR DE IMAGEN (logo o foto de perfil) ─────────────────────────── */}
      {imageEditKind && selected && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={closeImageEditor}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-sm mx-4 space-y-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-black text-slate-800 text-base">
                  {imageEditKind === 'logo' ? 'Logo de la Empresa' : 'Foto de Perfil'}
                </p>
                <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                  {imageEditKind === 'logo'
                    ? (selected.empresa_razon_social || formatNombreCard(selected.nombre_completo))
                    : formatNombreCard(selected.nombre_completo)}
                </p>
              </div>
              <button
                type="button"
                onClick={closeImageEditor}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-200 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div
              className={`relative w-full h-36 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${
                imageDragOver ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200 bg-slate-50 hover:border-emerald-300 hover:bg-emerald-50/50'
              }`}
              onClick={() => imageFileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setImageDragOver(true) }}
              onDragLeave={() => setImageDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setImageDragOver(false)
                const file = e.dataTransfer.files?.[0]
                if (file && file.type.startsWith('image/')) handleImageFileChange(file)
              }}
            >
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt="Preview"
                  className={`max-h-full max-w-full p-3 ${imageEditKind === 'foto' ? 'object-cover rounded-xl w-full h-full' : 'object-contain'}`}
                />
              ) : (
                <>
                  <ImageIcon size={28} className="text-slate-300" />
                  <p className="text-xs font-bold text-slate-400 text-center px-4">
                    Arrastra o haz clic para seleccionar
                    <br />
                    <span className="text-slate-300 font-normal text-[10px]">PNG, JPG, WEBP</span>
                  </p>
                </>
              )}
              <input
                ref={imageFileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleImageFileChange(file)
                }}
              />
            </div>

            {imagePreview && (
              <button
                type="button"
                onClick={() => { setImagePreview(null); setImageFile(null) }}
                className="w-full text-[10px] font-bold text-slate-400 hover:text-rose-500 transition-colors flex items-center justify-center gap-1"
              >
                <X size={10} /> Quitar imagen
              </button>
            )}

            {imageError && (
              <p className="text-xs font-bold text-rose-500 text-center">{imageError}</p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={closeImageEditor}
                className="flex-1 bg-slate-100 text-slate-600 text-sm font-bold py-3 rounded-2xl hover:bg-slate-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveImage}
                disabled={imageUploading}
                className="flex-[2] bg-emerald-500 text-white text-sm font-bold py-3 rounded-2xl hover:bg-emerald-600 disabled:opacity-60 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
              >
                {imageUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                {imageUploading ? 'Subiendo...' : imageEditKind === 'logo' ? 'Guardar Logo' : 'Guardar Foto'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ExportAfiliadosModal
        open={showExportModal}
        onClose={() => setShowExportModal(false)}
        authHeaders={authHeaders}
        initialFilters={{
          tipo: filterTipo as ExportTipoFilter,
          search,
          estatus: 'Afiliado',
        }}
      />
    </div>
  )
}

function DataField({ label, value, isEditing, fieldName, form, setForm, type = 'text', options = [], className = '', labelClassName = '' }: any) {
  return (
    <div className="space-y-1">
      <label className={`text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 ${labelClassName}`}>{label}</label>
      {isEditing ? (
        type === 'select' ? (
          <div className="relative">
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
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
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

function FormSection({
  icon,
  title,
  subtitle,
  children,
  variant = 'default',
}: {
  icon: React.ReactNode
  title: string
  subtitle?: string
  children: React.ReactNode
  variant?: 'default' | 'emerald'
}) {
  const isEmerald = variant === 'emerald'
  return (
    <section
      className={`rounded-2xl border p-5 space-y-4 ${
        isEmerald ? 'bg-emerald-50/40 border-emerald-100' : 'bg-slate-50/50 border-gray-100'
      }`}
    >
      <div className="flex items-start gap-3 pb-3 border-b border-gray-100/80">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
            isEmerald ? 'bg-emerald-100 text-emerald-600' : 'bg-white text-slate-400 border border-gray-100'
          }`}
        >
          {icon}
        </div>
        <div>
          <h4 className="font-black text-slate-800 text-sm uppercase tracking-wider">{title}</h4>
          {subtitle && <p className="text-[11px] text-slate-400 font-medium mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

function DataInput({ label, placeholder, value, onChange, type = 'text', isRequired = false, hasError = false }: any) {
  return (
    <div className="space-y-1.5">
      <label className={`text-[10px] font-black uppercase tracking-widest ml-1 transition-colors ${hasError ? 'text-red-500' : 'text-slate-400'}`}>
        {label} {isRequired && <span className="text-emerald-500">*</span>}
      </label>
      <input
        type={type}
        placeholder={placeholder}
        className={`w-full bg-slate-50 border rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 transition-all ${
          hasError 
            ? 'border-red-500 ring-4 ring-red-500/10 focus:ring-red-500/20' 
            : 'border-gray-100 focus:ring-emerald-500/10 focus:border-emerald-500'
        }`}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}
