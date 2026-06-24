import React, { useState, useEffect, useCallback } from 'react'
import { api, FormField, Input, BtnPrimary, BtnDanger, BtnSecondary, ListDetail } from '@/pages/admin/components/Cms/CmsShared'
import { Edit, Upload, CheckCircle, Trash2 } from 'lucide-react'
import { sendToPreview } from '@/pages/admin/components/Cms/LandingPreviewPane'
import { formatNombreCard } from '@/utils/formatters'
import { invalidateDirectivaCache } from '@/pages/landing/junta-directiva/JuntaDirectivaPage'
import { useAuth } from '@/context/AuthContext'

interface DirectivaItem {
  id: string | number;
  id_afiliado: number;
  nombre: string;
  cargo: string;
  periodo?: string;
  foto_url?: string;
  orden: number;
  activo: number | boolean;
}

const MESES = [
  { value: '01', label: 'Enero' },
  { value: '02', label: 'Febrero' },
  { value: '03', label: 'Marzo' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Mayo' },
  { value: '06', label: 'Junio' },
  { value: '07', label: 'Julio' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Septiembre' },
  { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' },
  { value: '12', label: 'Diciembre' }
]

const YEARS = Array.from({ length: 21 }, (_, i) => {
  const y = new Date().getFullYear() - 10 + i
  return y.toString()
})

const PRESET_CARGOS = [
  'Presidente',
  'Vicepresidente',
  'Secretario',
  'Tesorero',
  'Director General',
  'Director de Finanzas',
  'Director de Asuntos Legales',
  'Director de Comunicaciones',
  'Director de Formación',
  'Director de Eventos',
  'Director de Responsabilidad Social',
  'Director de Relaciones Interinstitucionales',
  'Vocal'
]

export function parsePeriodo(periodoStr?: string) {
  if (!periodoStr || !periodoStr.includes('/')) {
    return {
      startYear: new Date().getFullYear().toString(),
      startMonth: '01',
      endYear: (new Date().getFullYear() + 2).toString(),
      endMonth: '01',
    }
  }
  const [start, end] = periodoStr.split('/')
  const [sYear, sMonth] = start.split('-')
  const [eYear, eMonth] = end.split('-')
  return {
    startYear: sYear || new Date().getFullYear().toString(),
    startMonth: sMonth || '01',
    endYear: eYear || (new Date().getFullYear() + 2).toString(),
    endMonth: eMonth || '01',
  }
}

export function formatPeriodoDisplay(periodoStr?: string) {
  if (!periodoStr) return 'Sin período'
  if (!periodoStr.includes('/')) return periodoStr
  const [start, end] = periodoStr.split('/')
  const sYear = start.split('-')[0]
  const eYear = end.split('-')[0]
  if (sYear === eYear) return sYear
  return `${sYear} - ${eYear}`
}

export function formatPeriodoCompleto(periodoStr?: string) {
  if (!periodoStr) return 'Sin período'
  if (!periodoStr.includes('/')) return periodoStr
  const [start, end] = periodoStr.split('/')
  
  const formatPart = (part: string) => {
    const [y, m] = part.split('-')
    const monthObj = MESES.find(mo => mo.value === m)
    const monthName = monthObj ? monthObj.label : ''
    return `${monthName} ${y}`.trim()
  }
  
  return `${formatPart(start)} - ${formatPart(end)}`
}

function purgeCache() {
  invalidateDirectivaCache()
  window.dispatchEvent(new CustomEvent('directiva-cache-invalidated'))
}

export const DirectivaPanel = () => {
  const { token } = useAuth()
  const [items, setItems] = useState<DirectivaItem[]>([])
  const [loading, setLoading] = useState(true)
  
  const [affiliates, setAffiliates] = useState<any[]>([])
  const [loadingAffiliates, setLoadingAffiliates] = useState(false)
  
  const [selectedId, setSelectedId] = useState<string | number | null>(null)
  const [form, setForm] = useState({ id_afiliado: '' as string | number, cargo: '', periodo: '', orden: 0, activo: true })
  const [saving, setSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  
  const [searchTerm, setSearchTerm] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)

  // Period filtering states
  const [selectedPeriodFilter, setSelectedPeriodFilter] = useState<string>('all')
  
  // Year/Month states for form
  const [startMonth, setStartMonth] = useState('01')
  const [startYear, setStartYear] = useState(new Date().getFullYear().toString())
  const [endMonth, setEndMonth] = useState('01')
  const [endYear, setEndYear] = useState((new Date().getFullYear() + 2).toString())


  const [showCargoSuggestions, setShowCargoSuggestions] = useState(false)

  // Succession modal states
  const [showSuccessionModal, setShowSuccessionModal] = useState(false)
  const [succStartMonth, setSuccStartMonth] = useState('05')
  const [succStartYear, setSuccStartYear] = useState(new Date().getFullYear().toString())
  const [succEndMonth, setSuccEndMonth] = useState('05')
  const [succEndYear, setSuccEndYear] = useState((new Date().getFullYear() + 2).toString())
  const [cloning, setCloning] = useState(false)

  // Edit period modal states
  const [showEditPeriodModal, setShowEditPeriodModal] = useState(false)
  const [editStartMonth, setEditStartMonth] = useState('01')
  const [editStartYear, setEditStartYear] = useState(new Date().getFullYear().toString())
  const [editEndMonth, setEditEndMonth] = useState('01')
  const [editEndYear, setEditEndYear] = useState((new Date().getFullYear() + 2).toString())
  const [updatingPeriodDates, setUpdatingPeriodDates] = useState(false)

  // Create period modal states
  const [showCreatePeriodModal, setShowCreatePeriodModal] = useState(false)
  const [createStartMonth, setCreateStartMonth] = useState('01')
  const [createStartYear, setCreateStartYear] = useState(new Date().getFullYear().toString())
  const [createEndMonth, setCreateEndMonth] = useState('01')
  const [createEndYear, setCreateEndYear] = useState((new Date().getFullYear() + 2).toString())

  const loadAffiliates = useCallback(async () => {
    if (!token) return
    setLoadingAffiliates(true)
    try {
      const resp = await api.get('/api/afiliados')
      if (resp.success && Array.isArray(resp.data)) {
        setAffiliates(resp.data)
      }
    } catch (e) {
      console.error('Error al cargar afiliados:', e)
    } finally {
      setLoadingAffiliates(false)
    }
  }, [token])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const resp = await api.get('/api/cms/directiva')
      if (resp.success && Array.isArray(resp.data)) {
        const normalized = resp.data.map((item: any) => ({
          ...item,
          id: item.id,
          activo: item.activo === 1 || item.activo === true,
        }))
        setItems(normalized)
      }
    } catch (e) {
      console.error('Error al cargar directiva:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (token) {
      loadAffiliates()
    }
  }, [loadAffiliates, token])

  // Load and auto-select latest period if filter is 'all'
  useEffect(() => {
    if (items.length > 0 && selectedPeriodFilter === 'all') {
      const periods = Array.from(new Set(items.map(item => item.periodo).filter(Boolean))) as string[]
      if (periods.length > 0) {
        periods.sort((a, b) => b.localeCompare(a))
        setSelectedPeriodFilter(periods[0])
      }
    }
  }, [items, selectedPeriodFilter])

  // Form year-month syncing
  useEffect(() => {
    setForm(p => ({
      ...p,
      periodo: `${startYear}-${startMonth}/${endYear}-${endMonth}`
    }))
  }, [startMonth, startYear, endMonth, endYear])



  const handleCreateSuccession = async () => {
    const succPeriodStr = `${succStartYear}-${succStartMonth}/${succEndYear}-${succEndMonth}`
    if (succPeriodStr === selectedPeriodFilter) {
      alert('El período de sucesión debe ser diferente al actual')
      return
    }
    
    const itemsToClone = items.filter(item => item.periodo === selectedPeriodFilter)
    if (itemsToClone.length === 0) {
      alert('No hay miembros en el período seleccionado para suceder')
      return
    }
    
    setCloning(true)
    try {
      let successCount = 0
      for (const item of itemsToClone) {
        const res = await api.post('/api/cms/directiva', {
          id_afiliado: item.id_afiliado,
          cargo: item.cargo,
          periodo: succPeriodStr,
          orden: item.orden,
          activo: true
        })
        if (res.success) {
          successCount++
        }
      }
      
      if (successCount > 0) {
        alert(`Sucesión creada con éxito. Se copiaron ${successCount} cargos para el período ${formatPeriodoDisplay(succPeriodStr)}.`);
        setShowSuccessionModal(false)
        await load()
        setSelectedPeriodFilter(succPeriodStr)
        purgeCache()
        setTimeout(() => sendToPreview({ type: 'refresh_data' }), 500)
      } else {
        alert('Hubo un error al crear la sucesión')
      }
    } catch (e) {
      console.error(e)
      alert('Error de conexión al crear sucesión')
    } finally {
      setCloning(false)
    }
  }

  const openEdit = (item: DirectivaItem) => {
    setSelectedId(item.id)
    setShowCargoSuggestions(false)
    setForm({
      id_afiliado: item.id_afiliado,
      cargo: item.cargo,
      periodo: item.periodo || '',
      orden: item.orden,
      activo: item.activo === 1 || item.activo === true
    })
    
    // Set the search term once to the selected affiliate's representative name
    const selected = affiliates.find(a => a.id_afiliado === Number(item.id_afiliado))
    if (selected) {
      const representativeName = `${selected.nombres || ''} ${selected.apellidos || ''}`.trim() || selected.nombre_completo || '';
      setSearchTerm(representativeName)
    } else {
      setSearchTerm('')
    }
    
    const parsed = parsePeriodo(item.periodo)
    setStartMonth(parsed.startMonth)
    setStartYear(parsed.startYear)
    setEndMonth(parsed.endMonth)
    setEndYear(parsed.endYear)
    
    setIsEditing(true)
  }

  const openNew = () => {
    setSelectedId('new')
    setShowCargoSuggestions(false)
    setSearchTerm('') // Reset search term
    
    let initialPeriod = ''
    if (selectedPeriodFilter && selectedPeriodFilter !== 'all') {
      initialPeriod = selectedPeriodFilter
    } else {
      // Find latest period, or default to current year
      const periodsList = Array.from(new Set(items.map(item => item.periodo).filter(Boolean))) as string[]
      if (periodsList.length > 0) {
        periodsList.sort((a, b) => b.localeCompare(a))
        initialPeriod = periodsList[0]
      } else {
        const y = new Date().getFullYear()
        initialPeriod = `${y}-01/${y+2}-01`
      }
    }

    const parsed = parsePeriodo(initialPeriod)
    setStartMonth(parsed.startMonth)
    setStartYear(parsed.startYear)
    setEndMonth(parsed.endMonth)
    setEndYear(parsed.endYear)

    setForm({
      id_afiliado: '',
      cargo: PRESET_CARGOS[0],
      periodo: initialPeriod,
      orden: 0,
      activo: true
    })
    
    setIsEditing(true)
  }

  const handleStartCreatePeriod = (newPeriodStr: string) => {
    setShowCreatePeriodModal(false)
    setSelectedId('new')
    setShowCargoSuggestions(false)
    setSearchTerm('')
    
    const parsed = parsePeriodo(newPeriodStr)
    setStartMonth(parsed.startMonth)
    setStartYear(parsed.startYear)
    setEndMonth(parsed.endMonth)
    setEndYear(parsed.endYear)

    setForm({
      id_afiliado: '',
      cargo: PRESET_CARGOS[0],
      periodo: newPeriodStr,
      orden: 0,
      activo: true
    })
    
    setIsEditing(true)
  }

  const handleUpdatePeriodDates = async () => {
    const newPeriodStr = `${editStartYear}-${editStartMonth}/${editEndYear}-${editEndMonth}`
    if (newPeriodStr === selectedPeriodFilter) {
      setShowEditPeriodModal(false)
      return
    }
    
    const itemsToUpdate = items.filter(item => item.periodo === selectedPeriodFilter)
    if (itemsToUpdate.length === 0) {
      alert('No hay miembros en el período seleccionado para editar')
      return
    }
    
    setUpdatingPeriodDates(true)
    try {
      let successCount = 0
      for (const item of itemsToUpdate) {
        const res = await api.put(`/api/cms/directiva/${item.id}`, {
          id_afiliado: item.id_afiliado,
          cargo: item.cargo,
          periodo: newPeriodStr,
          orden: item.orden,
          activo: item.activo
        })
        if (res.success) {
          successCount++
        }
      }
      
      if (successCount > 0) {
        alert(`Período actualizado con éxito para ${successCount} cargos.`);
        setShowEditPeriodModal(false)
        await load()
        setSelectedPeriodFilter(newPeriodStr)
        purgeCache()
        setTimeout(() => sendToPreview({ type: 'refresh_data' }), 500)
      } else {
        alert('Hubo un error al actualizar el período')
      }
    } catch (e) {
      console.error(e)
      alert('Error de conexión al actualizar el período')
    } finally {
      setUpdatingPeriodDates(false)
    }
  }

  const save = async () => {
    if (!form.id_afiliado || !form.cargo) {
      alert('Afiliado y cargo son requeridos')
      return
    }

    // Validar duplicados en el mismo período localmente
    const currentPeriod = form.periodo
    const otherMembers = items.filter(item => item.periodo === currentPeriod && String(item.id) !== String(selectedId))

    // 1. Validar afiliado duplicado
    const hasDuplicateAffiliate = otherMembers.some(item => Number(item.id_afiliado) === Number(form.id_afiliado))
    if (hasDuplicateAffiliate) {
      alert('Este afiliado ya forma parte de esta junta directiva')
      return
    }

    // 2. Validar cargo duplicado
    const hasDuplicateCargo = otherMembers.some(item => item.cargo.trim().toLowerCase() === form.cargo.trim().toLowerCase())
    if (hasDuplicateCargo) {
      alert(`El cargo "${form.cargo}" ya está asignado en esta junta directiva`)
      return
    }

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

  const remove = async (id: string | number) => {
    if (!confirm('¿Eliminar de la Junta Directiva?')) return
    try {
      await api.delete(`/api/cms/directiva/${id}`)
      setSelectedId(null)
      load()
      purgeCache()
      setTimeout(() => sendToPreview({ type: 'refresh_data' }), 500)
    } catch (error) {
      console.error(error)
      alert('Error al eliminar miembro')
    }
  }

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(p => ({ 
      ...p, 
      [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.type === 'number' ? Number(e.target.value) : e.target.value 
    }))
  }

  const selectedAffiliate = affiliates.find(a => a.id_afiliado === Number(form.id_afiliado))

  const filteredAffiliates = affiliates.filter(a => {
    const repName = `${a.nombres || ''} ${a.apellidos || ''}`.toLowerCase();
    const companyName = (a.empresa_razon_social || '').toLowerCase();
    const code = String(a.codigo || '').toLowerCase();
    const searchLower = searchTerm.toLowerCase();
    
    return repName.includes(searchLower) || 
           companyName.includes(searchLower) || 
           code.includes(searchLower);
  })

  const getPreviousPeriodCargos = () => {
    const periods = Array.from(new Set(items.map(item => item.periodo).filter(Boolean))) as string[]
    periods.sort((a, b) => b.localeCompare(a))
    
    const currentPeriod = form.periodo
    const currentIndex = periods.indexOf(currentPeriod)
    
    let prevPeriod = ''
    if (currentIndex !== -1 && currentIndex + 1 < periods.length) {
      prevPeriod = periods[currentIndex + 1]
    } else if (periods.length > 0) {
      const candidates = periods.filter(p => p < currentPeriod)
      if (candidates.length > 0) {
        prevPeriod = candidates[0]
      } else {
        prevPeriod = periods[0]
      }
    }
    
    if (!prevPeriod) return PRESET_CARGOS
    
    const prevCargos = Array.from(
      new Set(
        items
          .filter(item => item.periodo === prevPeriod)
          .map(item => item.cargo)
          .filter(Boolean)
      )
    ) as string[]
    
    return prevCargos.length > 0 ? prevCargos : PRESET_CARGOS
  }

  const formBody = () => (
    <div className="flex flex-col gap-6 bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-50 pb-4">
        <div>
          <h3 className="text-base font-black text-slate-800 leading-tight">
            {selectedId === 'new' ? 'Nuevo Miembro de la Directiva' : 'Editar Miembro de la Directiva'}
          </h3>
          <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Junta Directiva</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5">
        <FormField label="Buscar y Seleccionar Afiliado">
          <div className="relative">
            <Input
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setShowDropdown(true)
                if (form.id_afiliado) {
                  setForm(p => ({ ...p, id_afiliado: '' }))
                }
              }}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => {
                setTimeout(() => setShowDropdown(false), 200)
              }}
              placeholder="Buscar por nombre o código de afiliado..."
              className="!text-sm !py-3 bg-slate-50/50 border-slate-200 focus:bg-white transition-all text-slate-800 w-full"
            />
            {showDropdown && (
              <div className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg divide-y divide-slate-50">
                {filteredAffiliates.length > 0 ? (
                  filteredAffiliates.map((a) => {
                    const representativeName = `${a.nombres || ''} ${a.apellidos || ''}`.trim() || a.nombre_completo || '';
                    return (
                      <button
                        key={a.id_afiliado}
                        type="button"
                        onClick={() => {
                          setForm(p => ({ ...p, id_afiliado: a.id_afiliado }))
                          setSearchTerm(representativeName)
                          setShowDropdown(false)
                        }}
                        className="w-full px-4 py-3 text-left text-sm hover:bg-emerald-50 hover:text-emerald-700 transition-colors flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          {a.foto_url ? (
                            <img src={a.foto_url} className="w-6 h-6 rounded-full object-cover" />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center">
                              {(representativeName || 'A').charAt(0)}
                            </div>
                          )}
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-700">{representativeName}</span>
                            {a.tipo_afiliado === 'Corporativo' && a.empresa_razon_social && (
                              <span className="text-[11px] text-slate-500 font-normal">
                                Representante Legal de {a.empresa_razon_social}
                              </span>
                            )}
                            {a.tipo_afiliado === 'Agente Corporativo' && a.empresa_razon_social && (
                              <span className="text-[11px] text-slate-500 font-normal">
                                Agente Corporativo de {a.empresa_razon_social}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                          {a.codigo || 'S/C'}
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <div className="px-4 py-3 text-sm text-slate-400 text-center">
                    No se encontraron afiliados
                  </div>
                )}
              </div>
            )}
          </div>
        </FormField>

        {form.id_afiliado && (
          <div className="bg-emerald-50/30 border border-emerald-100 rounded-2xl p-4 flex items-center gap-3 animate-in fade-in duration-300">
            {selectedAffiliate?.foto_url ? (
              <img
                src={selectedAffiliate.foto_url}
                alt="Afiliado"
                className="w-12 h-12 rounded-full object-cover border border-white ring-2 ring-emerald-100"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 font-black text-lg flex items-center justify-center ring-2 ring-emerald-100">
                {((`${selectedAffiliate?.nombres || ''} ${selectedAffiliate?.apellidos || ''}`.trim() || selectedAffiliate?.nombre_completo || 'A').charAt(0))}
              </div>
            )}
            <div>
              <p className="text-xs uppercase font-black tracking-widest text-emerald-600">Afiliado Seleccionado</p>
              <h4 className="text-sm font-bold text-slate-800">
                {`${selectedAffiliate?.nombres || ''} ${selectedAffiliate?.apellidos || ''}`.trim() || selectedAffiliate?.nombre_completo}
              </h4>
              {selectedAffiliate?.tipo_afiliado === 'Corporativo' && selectedAffiliate?.empresa_razon_social && (
                <p className="text-xs text-emerald-700 font-semibold">
                  Representante Legal de {selectedAffiliate.empresa_razon_social}
                </p>
              )}
              {selectedAffiliate?.tipo_afiliado === 'Agente Corporativo' && selectedAffiliate?.empresa_razon_social && (
                <p className="text-xs text-emerald-700 font-semibold">
                  Agente Corporativo de {selectedAffiliate.empresa_razon_social}
                </p>
              )}
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight mt-0.5">
                Estatus: {selectedAffiliate?.estatus} | Código: {selectedAffiliate?.codigo || 'Sin código'}
              </p>
            </div>
          </div>
        )}

        <FormField label="Cargo / Posición">
          <div className="relative">
            <div className="flex relative">
              <Input
                value={form.cargo}
                onChange={(e) => setForm(p => ({ ...p, cargo: e.target.value }))}
                placeholder="Ej. Presidenta, Directora de Finanzas, Tesorero..."
                className="!text-sm !py-3 bg-slate-50/50 border-slate-200 focus:bg-white transition-all text-slate-800 w-full pr-10"
              />
              <button
                type="button"
                onClick={() => setShowCargoSuggestions(!showCargoSuggestions)}
                className="absolute right-0 top-0 h-full px-3.5 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
                title="Ver sugerencias de la junta anterior"
              >
                <svg
                  className={`w-4 h-4 transition-transform duration-200 ${showCargoSuggestions ? 'rotate-180 text-emerald-600' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            {showCargoSuggestions && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowCargoSuggestions(false)} />
                <div className="absolute z-50 w-full mt-1.5 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl divide-y divide-slate-50 animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="px-3 py-1.5 bg-slate-50 text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center justify-between">
                    <span>Sugerencias (Junta Anterior)</span>
                    <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded text-[8px]">Roles</span>
                  </div>
                  {getPreviousPeriodCargos().map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => {
                        setForm(p => ({ ...p, cargo: sug }))
                        setShowCargoSuggestions(false)
                      }}
                      className="w-full px-4 py-2.5 text-left text-xs hover:bg-emerald-50 hover:text-emerald-700 transition-colors font-semibold text-slate-700"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </FormField>

        <FormField label="Período de Gestión">
          {periods.length === 0 ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase">Inicio</span>
                  <div className="flex gap-1">
                    <select
                      value={startMonth}
                      onChange={(e) => setStartMonth(e.target.value)}
                      className="flex-1 text-xs rounded-xl border border-gray-200 px-2 py-1.5 text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#00D084]/40 transition-all font-medium"
                    >
                      {MESES.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                    <select
                      value={startYear}
                      onChange={(e) => setStartYear(e.target.value)}
                      className="flex-1 text-xs rounded-xl border border-gray-200 px-2 py-1.5 text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#00D084]/40 transition-all font-medium"
                    >
                      {YEARS.map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase">Fin</span>
                  <div className="flex gap-1">
                    <select
                      value={endMonth}
                      onChange={(e) => setEndMonth(e.target.value)}
                      className="flex-1 text-xs rounded-xl border border-gray-200 px-2 py-1.5 text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#00D084]/40 transition-all font-medium"
                    >
                      {MESES.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                    <select
                      value={endYear}
                      onChange={(e) => setEndYear(e.target.value)}
                      className="flex-1 text-xs rounded-xl border border-gray-200 px-2 py-1.5 text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#00D084]/40 transition-all font-medium"
                    >
                      {YEARS.map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="text-[10px] text-emerald-600 font-bold mt-1.5">
                Se mostrará como: {formatPeriodoDisplay(`${startYear}-${startMonth}/${endYear}-${endMonth}`)}
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Período de esta Gestión</span>
                <p className="text-sm font-bold text-slate-700 mt-0.5">
                  {formatPeriodoDisplay(form.periodo)}
                </p>
                <p className="text-[10px] font-semibold text-slate-400 mt-0.5">
                  ({formatPeriodoCompleto(form.periodo)})
                </p>
              </div>
              <span className="text-[10px] bg-slate-200/55 text-slate-500 font-bold px-2 py-1 rounded-md uppercase tracking-wider">
                Definido por Junta
              </span>
            </div>
          )}
        </FormField>

        <FormField label="Orden de Aparición">
          <Input 
            type="number" 
            value={form.orden} 
            onChange={f('orden')} 
            className="!text-xs !py-2.5 bg-slate-50 border-slate-200 text-slate-800" 
          />
        </FormField>

        <div className="flex items-center gap-2.5 py-1">
          <input
            type="checkbox"
            id="activo"
            checked={form.activo}
            onChange={(e) => setForm(p => ({ ...p, activo: e.target.checked }))}
            className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500 cursor-pointer"
          />
          <label htmlFor="activo" className="text-xs font-bold text-slate-600 select-none cursor-pointer">
            Miembro Activo (se mostrará en la web pública)
          </label>
        </div>

        <div className="flex gap-3 pt-4 border-t border-gray-50">
          <BtnPrimary
            onClick={save}
            disabled={saving}
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

  const periods = Array.from(new Set(items.map(item => item.periodo).filter(Boolean))) as string[]
  periods.sort((a, b) => b.localeCompare(a))

  const filteredItems = items.filter(item => {
    if (selectedPeriodFilter === 'all') return true
    return item.periodo === selectedPeriodFilter
  })

  const listHeader = (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gestión / Período</span>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => {
                const y = new Date().getFullYear().toString()
                setCreateStartMonth('01')
                setCreateStartYear(y)
                setCreateEndMonth('01')
                setCreateEndYear((Number(y) + 2).toString())
                setShowCreatePeriodModal(true)
              }}
              className="text-[9px] bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 font-bold px-2 py-0.5 rounded transition-all"
            >
              Crear Gestión
            </button>
            <button
              type="button"
              onClick={() => {
                if (selectedPeriodFilter && selectedPeriodFilter !== 'all') {
                  const parsed = parsePeriodo(selectedPeriodFilter)
                  setEditStartMonth(parsed.startMonth)
                  setEditStartYear(parsed.startYear)
                  setEditEndMonth(parsed.endMonth)
                  setEditEndYear(parsed.endYear)
                  setShowEditPeriodModal(true)
                }
              }}
              disabled={selectedPeriodFilter === 'all'}
              className="text-[9px] bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 font-bold px-2 py-0.5 rounded disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Editar Fechas
            </button>
            <button
              type="button"
              onClick={() => {
                if (selectedPeriodFilter && selectedPeriodFilter !== 'all') {
                  const parsed = parsePeriodo(selectedPeriodFilter)
                  setSuccStartMonth(parsed.endMonth)
                  setSuccStartYear(parsed.endYear)
                  setSuccEndMonth(parsed.endMonth)
                  setSuccEndYear((Number(parsed.endYear) + 2).toString())
                }
                setShowSuccessionModal(true)
              }}
              disabled={selectedPeriodFilter === 'all' || !items.some(i => i.periodo === selectedPeriodFilter)}
              className="text-[9px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded border border-emerald-200/50 hover:bg-emerald-100 hover:text-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Nueva Sucesión
            </button>
          </div>
        </div>
        <select
          value={selectedPeriodFilter}
          onChange={(e) => setSelectedPeriodFilter(e.target.value)}
          className="w-full text-xs rounded-lg border border-slate-200 px-2 py-1.5 text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 font-medium"
        >
          <option value="all">Ver Todas las Gestiones</option>
          {periods.map(p => (
            <option key={p} value={p}>
              {formatPeriodoDisplay(p)} ({formatPeriodoCompleto(p)})
            </option>
          ))}
        </select>
      </div>
    </div>
  )

  return (
    <>
      <ListDetail
        listHeader={listHeader}
        items={filteredItems} 
        loading={loading} 
        selectedId={selectedId} 
        setSelectedId={(id) => { setSelectedId(id); if(id) setIsEditing(true) }}
        isEditing={isEditing} 
        setIsEditing={setIsEditing}
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
                <span className="text-[10px] text-slate-400 truncate uppercase font-bold tracking-tighter">
                  {item.cargo} {item.periodo ? `(${formatPeriodoDisplay(item.periodo)})` : ''}
                </span>
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
                <div>
                  <h3 className="text-sm font-bold text-slate-800">{formatNombreCard(item.nombre)}</h3>
                  <p className="text-xs text-slate-400">{item.cargo}</p>
                  {item.periodo && <p className="text-xs text-slate-400 font-bold uppercase tracking-tight">Período: {formatPeriodoDisplay(item.periodo)} ({formatPeriodoCompleto(item.periodo)})</p>}
                  <p className="text-[10px] mt-1">
                    <span className={`px-2 py-0.5 rounded-full font-bold uppercase tracking-widest text-[9px] ${item.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {item.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <BtnSecondary onClick={() => openEdit(item)}>Editar</BtnSecondary>
                <BtnDanger onClick={() => remove(item.id)}>Eliminar</BtnDanger>
              </div>
            </div>
          </div>
        )}
        renderForm={formBody}
      />

      {showSuccessionModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 flex flex-col gap-5 animate-in zoom-in-95 duration-200">
            <div>
              <h3 className="text-base font-black text-slate-800">Iniciar Nueva Sucesión</h3>
              <p className="text-xs text-slate-400 mt-1">
                Se copiarán todas las posiciones y el orden de la gestión actual <strong>{formatPeriodoDisplay(selectedPeriodFilter)}</strong> a un nuevo período.
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase">Inicio del Nuevo Período</span>
                <div className="flex gap-1">
                  <select
                    value={succStartMonth}
                    onChange={(e) => setSuccStartMonth(e.target.value)}
                    className="flex-1 text-xs rounded-xl border border-slate-200 px-2 py-1.5 text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                  >
                    {MESES.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                  <select
                    value={succStartYear}
                    onChange={(e) => setSuccStartYear(e.target.value)}
                    className="flex-1 text-xs rounded-xl border border-slate-200 px-2 py-1.5 text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                  >
                    {YEARS.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase">Fin del Nuevo Período</span>
                <div className="flex gap-1">
                  <select
                    value={succEndMonth}
                    onChange={(e) => setSuccEndMonth(e.target.value)}
                    className="flex-1 text-xs rounded-xl border border-slate-200 px-2 py-1.5 text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                  >
                    {MESES.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                  <select
                    value={succEndYear}
                    onChange={(e) => setSuccEndYear(e.target.value)}
                    className="flex-1 text-xs rounded-xl border border-slate-200 px-2 py-1.5 text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                  >
                    {YEARS.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 text-[11px] text-slate-600 font-medium">
              <span className="font-bold text-slate-800">Resultado: </span>
              Se creará la gestión <strong className="text-emerald-700">{succStartYear} - {succEndYear}</strong> ({MESES.find(m=>m.value===succStartMonth)?.label} {succStartYear} - {MESES.find(m=>m.value===succEndMonth)?.label} {succEndYear}) con {items.filter(i => i.periodo === selectedPeriodFilter).length} cargos.
            </div>

            <div className="flex gap-3">
              <BtnPrimary
                onClick={handleCreateSuccession}
                disabled={cloning}
                className="flex-1 !rounded-xl !py-2.5"
              >
                {cloning ? 'Creando sucesión...' : 'Confirmar Sucesión'}
              </BtnPrimary>
              <BtnSecondary
                onClick={() => setShowSuccessionModal(false)}
                disabled={cloning}
                className="flex-1 !rounded-xl !py-2.5"
              >
                Cancelar
              </BtnSecondary>
            </div>
          </div>
        </div>
      )}

      {showEditPeriodModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 flex flex-col gap-5 animate-in zoom-in-95 duration-200">
            <div>
              <h3 className="text-base font-black text-slate-800">Editar Fechas del Período</h3>
              <p className="text-xs text-slate-400 mt-1">
                Esto modificará el período de <strong>todos</strong> los miembros pertenecientes a la gestión actual.
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase">Inicio</span>
                <div className="flex gap-1">
                  <select
                    value={editStartMonth}
                    onChange={(e) => setEditStartMonth(e.target.value)}
                    className="flex-1 text-xs rounded-xl border border-slate-200 px-2 py-1.5 text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                  >
                    {MESES.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                  <select
                    value={editStartYear}
                    onChange={(e) => setEditStartYear(e.target.value)}
                    className="flex-1 text-xs rounded-xl border border-slate-200 px-2 py-1.5 text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                  >
                    {YEARS.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase">Fin</span>
                <div className="flex gap-1">
                  <select
                    value={editEndMonth}
                    onChange={(e) => setEditEndMonth(e.target.value)}
                    className="flex-1 text-xs rounded-xl border border-slate-200 px-2 py-1.5 text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                  >
                    {MESES.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                  <select
                    value={editEndYear}
                    onChange={(e) => setEditEndYear(e.target.value)}
                    className="flex-1 text-xs rounded-xl border border-slate-200 px-2 py-1.5 text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                  >
                    {YEARS.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 text-[11px] text-slate-600 font-medium">
              <span className="font-bold text-slate-800">Resultado: </span>
              El período cambiará de <strong>{formatPeriodoDisplay(selectedPeriodFilter)}</strong> a <strong className="text-emerald-700">{editStartYear} - {editEndYear}</strong> ({MESES.find(m=>m.value===editStartMonth)?.label} {editStartYear} - {MESES.find(m=>m.value===editEndMonth)?.label} {editEndYear}).
            </div>

            <div className="flex gap-3">
              <BtnPrimary
                onClick={handleUpdatePeriodDates}
                disabled={updatingPeriodDates}
                className="flex-1 !rounded-xl !py-2.5"
              >
                {updatingPeriodDates ? 'Guardando...' : 'Guardar Cambios'}
              </BtnPrimary>
              <BtnSecondary
                onClick={() => setShowEditPeriodModal(false)}
                disabled={updatingPeriodDates}
                className="flex-1 !rounded-xl !py-2.5"
              >
                Cancelar
              </BtnSecondary>
            </div>
          </div>
        </div>
      )}

      {showCreatePeriodModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 flex flex-col gap-5 animate-in zoom-in-95 duration-200">
            <div>
              <h3 className="text-base font-black text-slate-800">Crear Nueva Gestión</h3>
              <p className="text-xs text-slate-400 mt-1">
                Define las fechas del nuevo período. Al confirmar, se abrirá el formulario para agregar al primer miembro de esta nueva directiva.
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase">Inicio</span>
                <div className="flex gap-1">
                  <select
                    value={createStartMonth}
                    onChange={(e) => setCreateStartMonth(e.target.value)}
                    className="flex-1 text-xs rounded-xl border border-slate-200 px-2 py-1.5 text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                  >
                    {MESES.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                  <select
                    value={createStartYear}
                    onChange={(e) => setCreateStartYear(e.target.value)}
                    className="flex-1 text-xs rounded-xl border border-slate-200 px-2 py-1.5 text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                  >
                    {YEARS.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase">Fin</span>
                <div className="flex gap-1">
                  <select
                    value={createEndMonth}
                    onChange={(e) => setCreateEndMonth(e.target.value)}
                    className="flex-1 text-xs rounded-xl border border-slate-200 px-2 py-1.5 text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                  >
                    {MESES.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                  <select
                    value={createEndYear}
                    onChange={(e) => setCreateEndYear(e.target.value)}
                    className="flex-1 text-xs rounded-xl border border-slate-200 px-2 py-1.5 text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                  >
                    {YEARS.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 text-[11px] text-slate-600 font-medium">
              <span className="font-bold text-slate-800">Resultado: </span>
              Se creará la gestión <strong className="text-emerald-700">{createStartYear} - {createEndYear}</strong> ({MESES.find(m=>m.value===createStartMonth)?.label} {createStartYear} - {MESES.find(m=>m.value===createEndMonth)?.label} {createEndYear}).
            </div>

            <div className="flex gap-3">
              <BtnPrimary
                onClick={() => handleStartCreatePeriod(`${createStartYear}-${createStartMonth}/${createEndYear}-${createEndMonth}`)}
                className="flex-1 !rounded-xl !py-2.5"
              >
                Confirmar y Agregar Miembro
              </BtnPrimary>
              <BtnSecondary
                onClick={() => setShowCreatePeriodModal(false)}
                className="flex-1 !rounded-xl !py-2.5"
              >
                Cancelar
              </BtnSecondary>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
