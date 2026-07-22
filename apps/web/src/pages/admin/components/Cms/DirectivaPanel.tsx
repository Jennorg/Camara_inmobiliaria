import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { api, FormField, Input, BtnPrimary, BtnDanger, BtnSecondary } from '@/pages/admin/components/Cms/CmsShared'
import { 
  Users, 
  Crown, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  LayoutGrid, 
  List, 
  Calendar, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  X, 
  Sparkles,
  ChevronRight,
  UserCheck
} from 'lucide-react'
import { formatNombreCard } from '@/utils/formatters'
import { invalidateDirectivaCache } from '@/pages/landing/junta-directiva/JuntaDirectivaPage'
import { useAuth } from '@/context/AuthContext'
import { toast } from 'sonner'

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
  'Vocal',
  'Otro'
]

export function getGenericCargoName(cargoText: string): string {
  if (!cargoText) return '';
  
  let key = cargoText.trim().toLowerCase();
  key = key.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  if (key.includes('finanzas')) return 'Director(a) de Finanzas';
  if (key.includes('general')) return 'Director(a) General';
  if (key.includes('legales') || key.includes('legal')) return 'Director(a) de Asuntos Legales';
  if (key.includes('comunicaciones') || key.includes('comunicacion')) return 'Director(a) de Comunicaciones';
  if (key.includes('formacion')) return 'Director(a) de Formación';
  if (key.includes('eventos') || key.includes('evento')) return 'Director(a) de Eventos';
  if (key.includes('responsabilidad_social') || (key.includes('responsabilidad') && key.includes('social'))) return 'Director(a) de Responsabilidad Social';
  if (key.includes('relaciones_interinstitucionales') || (key.includes('relaciones') && key.includes('inter'))) return 'Director(a) de Relaciones Interinstitucionales';
  
  if (key.startsWith('director') || key.startsWith('directora')) {
    let rest = cargoText.trim().substring(8).trim();
    if (rest.toLowerCase().startsWith('a')) rest = rest.substring(1).trim();
    const formattedRest = rest.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    return `Director(a) ${formattedRest}`;
  }
  
  if (key.startsWith('vicepresident')) {
    return 'Vicepresidente / Vicepresidenta';
  }
  if (key.startsWith('president')) {
    return 'Presidente / Presidenta';
  }
  if (key.startsWith('secretari')) {
    return 'Secretario(a)';
  }
  if (key.startsWith('tesorer')) {
    return 'Tesorero(a)';
  }
  if (key.startsWith('vocal')) {
    return 'Vocal';
  }
  
  return cargoText;
}

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

  // View state: 'table' only by default
  const [viewMode, setViewMode] = useState<'table'>('table')
  
  // Member drawer / modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<DirectivaItem | null>(null)
  
  const [form, setForm] = useState({ 
    id_afiliado: '' as string | number, 
    cargo: '', 
    cargo_canonical: '',
    periodo: '', 
    orden: 0, 
    activo: true 
  })
  const [saving, setSaving] = useState(false)
  
  // Search and Filter states
  const [searchMemberQuery, setSearchMemberQuery] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)

  // Period filtering states
  const [selectedPeriodFilter, setSelectedPeriodFilter] = useState<string>('all')
  
  // Year/Month states for form
  const [startMonth, setStartMonth] = useState('01')
  const [startYear, setStartYear] = useState(new Date().getFullYear().toString())
  const [endMonth, setEndMonth] = useState('01')
  const [endYear, setEndYear] = useState((new Date().getFullYear() + 2).toString())

  const [isCustomCargo, setIsCustomCargo] = useState(false)
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

  const [customPeriods, setCustomPeriods] = useState<string[]>([])

  const periods = useMemo(() => {
    const uniquePeriods = Array.from(new Set([
      ...customPeriods,
      ...items.flatMap(item => item.periodo ? [item.periodo] : [])
    ])) as string[]
    return uniquePeriods.sort((a, b) => b.localeCompare(a))
  }, [items, customPeriods])

  // Load and auto-select latest period if filter is 'all'
  useEffect(() => {
    if (items.length > 0 && selectedPeriodFilter === 'all') {
      if (periods.length > 0) {
        setSelectedPeriodFilter(periods[0])
      }
    }
  }, [items, selectedPeriodFilter, periods])



  const filteredItems = useMemo(() => {
    let result = items.filter(item => {
      if (selectedPeriodFilter === 'all') return true
      return item.periodo === selectedPeriodFilter
    })
    
    if (searchMemberQuery.trim()) {
      const q = searchMemberQuery.toLowerCase()
      result = result.filter(item => 
        item.nombre.toLowerCase().includes(q) || 
        item.cargo.toLowerCase().includes(q)
      )
    }

    return result.sort((a, b) => a.orden - b.orden)
  }, [items, selectedPeriodFilter, searchMemberQuery])

  const moveItem = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= filteredItems.length) return;

    const currentItem = filteredItems[index];
    const swapItem = filteredItems[targetIndex];

    const newOrdenCurrent = swapItem.orden;
    const newOrdenSwap = currentItem.orden;

    const updatedItems = items.map(item => {
      if (item.id === currentItem.id) {
        return { ...item, orden: newOrdenCurrent };
      }
      if (item.id === swapItem.id) {
        return { ...item, orden: newOrdenSwap };
      }
      return item;
    });

    setItems(updatedItems);

    try {
      await Promise.all([
        api.put(`/api/cms/directiva/${currentItem.id}`, { orden: newOrdenCurrent }),
        api.put(`/api/cms/directiva/${swapItem.id}`, { orden: newOrdenSwap })
      ]);
      purgeCache();
    } catch (e) {
      console.error('Error al cambiar el orden:', e);
      load();
    }
  };

  const openNewModal = () => {
    // 1. If there are no periods defined in the system at all
    if (periods.length === 0) {
      toast.warning('No existen períodos de gestión definidos. Primero debes registrar un período de gestión antes de agregar miembros.', {
        style: {
          backgroundColor: '#f59e0b',
          color: '#ffffff',
          borderColor: '#d97706'
        }
      })
      const y = new Date().getFullYear().toString()
      setCreateStartMonth('01')
      setCreateStartYear(y)
      setCreateEndMonth('01')
      setCreateEndYear((Number(y) + 2).toString())
      setShowCreatePeriodModal(true)
      return
    }

    // 2. If they are on "Ver Todas", auto-select the latest period to prevent blocking
    let targetPeriod = selectedPeriodFilter
    if (selectedPeriodFilter === 'all' || !selectedPeriodFilter) {
      targetPeriod = periods[0]
      setSelectedPeriodFilter(periods[0])
    }

    setEditingItem(null)
    setSearchTerm('')
    setIsCustomCargo(false)
    
    const parsed = parsePeriodo(targetPeriod)
    setStartMonth(parsed.startMonth)
    setStartYear(parsed.startYear)
    setEndMonth(parsed.endMonth)
    setEndYear(parsed.endYear)

    const maxOrden = items.length > 0 ? Math.max(...items.map(i => i.orden)) : 0
    setForm({
      id_afiliado: '',
      cargo: '',
      cargo_canonical: '',
      periodo: targetPeriod,
      orden: maxOrden + 1,
      activo: true
    })
    setIsModalOpen(true)
  }

  const openEditModal = (item: DirectivaItem) => {
    setEditingItem(item)
    setSearchTerm(item.nombre)
    const isCustom = !PRESET_CARGOS.includes(item.cargo_canonical || item.cargo)
    setIsCustomCargo(isCustom)
    if (item.periodo) {
      const parsed = parsePeriodo(item.periodo)
      setStartMonth(parsed.startMonth)
      setStartYear(parsed.startYear)
      setEndMonth(parsed.endMonth)
      setEndYear(parsed.endYear)
    }
    setForm({
      id_afiliado: item.id_afiliado,
      cargo: item.cargo,
      cargo_canonical: item.cargo_canonical || item.cargo,
      periodo: item.periodo || '',
      orden: item.orden,
      activo: item.activo === true || item.activo === 1
    })
    setIsModalOpen(true)
  }

  const save = async () => {
    if (!form.id_afiliado && !editingItem) return toast.warning('Debes seleccionar un afiliado.')
    if (!form.cargo) return toast.warning('El cargo es requerido.')

    setSaving(true)
    try {
      let resp;
      if (editingItem) {
        resp = await api.put(`/api/cms/directiva/${editingItem.id}`, form)
      } else {
        resp = await api.post('/api/cms/directiva', form)
      }
      if (resp.success) {
        purgeCache()
        load()
        setIsModalOpen(false)
        toast.success(editingItem ? 'Miembro de la junta directiva actualizado con éxito' : 'Miembro de la junta directiva agregado con éxito')
      } else {
        toast.error(resp.message || 'Error al guardar')
      }
    } catch (e: any) {
      toast.error(e.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string | number) => {
    if (!confirm('¿Seguro que deseas eliminar este miembro de la junta directiva?')) return
    try {
      const resp = await api.delete(`/api/cms/directiva/${id}`)
      if (resp.success) {
        purgeCache()
        load()
        if (editingItem?.id === id) {
          setIsModalOpen(false)
        }
        toast.success('Miembro de la junta directiva eliminado con éxito')
      }
    } catch (e: any) {
      toast.error(e.message || 'Error al eliminar')
    }
  }

  const toggleStatus = async (item: DirectivaItem) => {
    const nextStatus = !item.activo
    setItems(items.map(i => i.id === item.id ? { ...i, activo: nextStatus } : i))
    try {
      await api.put(`/api/cms/directiva/${item.id}`, { activo: nextStatus })
      purgeCache()
    } catch (e) {
      load()
    }
  }

  const handleUpdatePeriodDates = async () => {
    if (!selectedPeriodFilter || selectedPeriodFilter === 'all') return
    const currentPeriodItems = items.filter(item => item.periodo === selectedPeriodFilter)
    if (currentPeriodItems.length === 0) return

    const newPeriod = `${editStartYear}-${editStartMonth}/${editEndYear}-${editEndMonth}`
    if (newPeriod === selectedPeriodFilter) {
      setShowEditPeriodModal(false)
      return
    }

    setUpdatingPeriodDates(true)
    try {
      for (const item of currentPeriodItems) {
        await api.put(`/api/cms/directiva/${item.id}`, { periodo: newPeriod })
      }
      purgeCache()
      await load()
      setSelectedPeriodFilter(newPeriod)
      setShowEditPeriodModal(false)
      toast.success('Fechas de gestión actualizadas con éxito')
    } catch (e: any) {
      toast.error(e.message || 'Error al actualizar el período')
    } finally {
      setUpdatingPeriodDates(false)
    }
  }

  const handleStartCreatePeriod = (periodStr: string) => {
    const [newStart, newEnd] = periodStr.split('/')
    
    // 1. Validate start date is before end date
    if (newStart >= newEnd) {
      toast.error('La fecha de inicio de la nueva gestión debe ser anterior a la fecha de fin.')
      return
    }

    // 2. Validate it starts exactly when the current/latest period ends
    if (periods.length > 0) {
      const latestPeriod = periods[0] // Since periods are sorted DESC chronologically
      const [, latestEnd] = latestPeriod.split('/')
      
      if (newStart !== latestEnd) {
        const latestEndDateReadable = formatPeriodoCompleto(latestPeriod).split(' - ')[1]
        toast.error(`La nueva gestión debe iniciar exactamente al terminar la anterior (${latestEndDateReadable} / ${latestEnd}).`)
        return
      }
    }

    setShowCreatePeriodModal(false)
    setCustomPeriods(prev => Array.from(new Set([...prev, periodStr])))
    setSelectedPeriodFilter(periodStr)
    toast.success('Nueva gestión creada con éxito')
  }

  const selectedAffiliate = useMemo(() => {
    return affiliates.find(a => a.id_afiliado === Number(form.id_afiliado))
  }, [affiliates, form.id_afiliado])

  const filteredAffiliates = useMemo(() => {
    return affiliates.filter(a => {
      const repName = `${a.nombres || ''} ${a.apellidos || ''}`.toLowerCase();
      const companyName = (a.empresa_razon_social || '').toLowerCase();
      const code = String(a.codigo || '').toLowerCase();
      const searchLower = searchTerm.toLowerCase();
      
      return repName.includes(searchLower) || 
             companyName.includes(searchLower) || 
             code.includes(searchLower);
    })
  }, [affiliates, searchTerm])

  const getPreviousPeriodCargos = () => {
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
        items.flatMap(item =>
          item.periodo === prevPeriod && item.cargo ? [item.cargo] : []
        )
      )
    ) as string[]
    
    return prevCargos.length > 0 ? prevCargos : PRESET_CARGOS
  }

  return (
    <div className="flex flex-col h-full w-full min-w-0 bg-slate-50/50 p-4 sm:p-8 overflow-y-auto space-y-6">
      
      {/* ── Top Header Control Panel ───────────────────────────────────────── */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col gap-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 shadow-sm shadow-emerald-500/10">
              <Users size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-slate-900 tracking-tight">Junta Directiva</h1>
                <span className="bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border border-emerald-100">
                  {items.filter(item => item.periodo === selectedPeriodFilter).length} Autoridades
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium mt-0.5">Gestión de autoridades, orden jerárquico y períodos de mandato</p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2.5">
            <button
              onClick={openNewModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20"
            >
              <Plus size={16} />
              <span>Nuevo Miembro</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const y = new Date().getFullYear().toString()
                if (periods.length > 0) {
                  const latestPeriod = periods[0]
                  const [, latestEnd] = latestPeriod.split('/')
                  const [endYear, endMonth] = latestEnd.split('-')
                  setCreateStartMonth(endMonth)
                  setCreateStartYear(endYear)
                  setCreateEndMonth(endMonth)
                  setCreateEndYear((Number(endYear) + 2).toString())
                } else {
                  setCreateStartMonth('01')
                  setCreateStartYear(y)
                  setCreateEndMonth('01')
                  setCreateEndYear((Number(y) + 2).toString())
                }
                setShowCreatePeriodModal(true)
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 text-xs font-bold transition-all"
            >
              <Calendar size={15} className="text-slate-500" />
              <span>Nueva Gestión</span>
            </button>
          </div>
        </div>

        {/* Filters & View Switches */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          
          {/* Period Tabs & Dropdown */}
          <div className="flex items-center flex-wrap gap-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1 hidden sm:inline">Período:</span>


            {periods.map((p, idx) => (
              <button
                key={p}
                onClick={() => setSelectedPeriodFilter(p)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  selectedPeriodFilter === p
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>{formatPeriodoDisplay(p)}</span>
                {idx === 0 && (
                  <span className={`text-[9px] font-black px-1.5 py-0.2 rounded ${
                    selectedPeriodFilter === p ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700'
                  }`}>Actual</span>
                )}
              </button>
            ))}
          </div>

          {/* Layout Toggle removed to keep table view by default */}
          <div className="flex items-center gap-3">
          </div>
        </div>

        {/* Period Context Bar (When period is selected) */}
        {selectedPeriodFilter !== 'all' && (
          <div className="bg-slate-50/80 border border-slate-200/60 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                <Calendar size={15} />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Gestión Seleccionada</p>
                <p className="text-xs font-bold text-slate-800">
                  {formatPeriodoDisplay(selectedPeriodFilter)} <span className="text-slate-400 font-normal">({formatPeriodoCompleto(selectedPeriodFilter)})</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const parsed = parsePeriodo(selectedPeriodFilter)
                  setEditStartMonth(parsed.startMonth)
                  setEditStartYear(parsed.startYear)
                  setEditEndMonth(parsed.endMonth)
                  setEditEndYear(parsed.endYear)
                  setShowEditPeriodModal(true)
                }}
                className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-all shadow-xs"
              >
                Editar Fechas
              </button>

            </div>
          </div>
        )}
      </div>

      {/* ── Main Content Area ──────────────────────────────────────────────── */}
      {loading ? (
        <div className="bg-white rounded-3xl p-12 border border-slate-100 text-center flex flex-col items-center justify-center gap-3">
          <RefreshCw className="animate-spin text-emerald-500" size={28} />
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">Cargando junta directiva...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 border border-slate-100 text-center flex flex-col items-center justify-center gap-4">
          <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
            <Users size={32} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">No se encontraron autoridades</h3>
            <p className="text-xs text-slate-400 mt-1">No hay miembros registrados para este período o filtro de búsqueda.</p>
          </div>
          <button
            onClick={openNewModal}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-all shadow-md shadow-emerald-600/20 flex items-center gap-2"
          >
            <Plus size={16} />
            <span>Agregar Primer Miembro</span>
          </button>
        </div>
      ) : (
        /* HIGH DENSITY TABLE VIEW */
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[700px]">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <th className="px-5 py-4 w-16 text-center">ORDEN</th>
                <th className="px-5 py-4">AUTORIDAD / CARGO</th>
                <th className="px-5 py-4">PERÍODO</th>
                <th className="px-5 py-4 text-center">ESTATUS</th>
                <th className="px-5 py-4 text-right">ACCIONES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.map((item, index) => (
                <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-5 py-3.5 text-center font-bold text-slate-400">
                    <div className="flex items-center justify-center gap-1">
                      <span>#{index + 1}</span>
                      <div className="flex flex-col gap-0.5">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => moveItem(index, 'up')}
                          className="text-slate-400 hover:text-slate-900 disabled:opacity-20 transition-all"
                        >
                          <ArrowUp size={11} />
                        </button>
                        <button
                          type="button"
                          disabled={index === filteredItems.length - 1}
                          onClick={() => moveItem(index, 'down')}
                          className="text-slate-400 hover:text-slate-900 disabled:opacity-20 transition-all"
                        >
                          <ArrowDown size={11} />
                        </button>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 overflow-hidden flex items-center justify-center font-bold text-slate-600 shrink-0">
                        {item.foto_url ? (
                          <img src={item.foto_url} alt={item.nombre} loading="lazy" decoding="async" className="w-full h-full object-cover object-top" />
                        ) : (
                          formatNombreCard(item.nombre).charAt(0)
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-sm leading-tight">
                          {formatNombreCard(item.nombre)}
                        </p>
                        <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                          {item.cargo}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-slate-600 font-semibold">
                    {formatPeriodoDisplay(item.periodo)}
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <button
                      onClick={() => toggleStatus(item)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                        item.activo
                          ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      {item.activo ? 'Activo' : 'Inactivo'}
                    </button>
                  </td>
                  <td className="px-5 py-3.5 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEditModal(item)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        title="Editar"
                      >
                        <Edit3 size={15} />
                      </button>
                      <button
                        onClick={() => remove(item.id)}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                        title="Eliminar"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── MODAL: Crear / Editar Miembro ──────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-100 flex flex-col gap-6 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  {editingItem ? 'Editar Autoridad' : 'Nueva Autoridad'}
                </h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">Asignar cargo directivo a un afiliado registrado</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <div className="flex flex-col gap-5">
              
              {/* Affiliate Picker */}
              <FormField label="Afiliado Seleccionado">
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
                    onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                    placeholder="Buscar por nombre o código de afiliado..."
                    className="!text-sm !py-3 bg-slate-50 border-slate-200 focus:bg-white transition-all text-slate-800 w-full rounded-2xl"
                  />
                  {showDropdown && (
                    <div className="absolute z-50 w-full mt-1.5 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-xl divide-y divide-slate-50">
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
                              <div className="flex items-center gap-3">
                                {a.foto_url ? (
                                  <img src={a.foto_url} loading="lazy" decoding="async" className="w-8 h-8 rounded-xl object-cover object-top shrink-0" />
                                ) : (
                                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center shrink-0">
                                    {(representativeName || 'A').charAt(0)}
                                  </div>
                                )}
                                <div className="flex flex-col min-w-0">
                                  <span className="font-semibold text-slate-800 truncate">{representativeName}</span>
                                  {a.empresa_razon_social && (
                                    <span className="text-[11px] text-slate-400 truncate font-normal">
                                      {a.empresa_razon_social}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded-lg shrink-0">
                                {a.codigo || 'S/C'}
                              </span>
                            </button>
                          );
                        })
                      ) : (
                        <div className="px-4 py-3 text-xs text-slate-400 text-center">
                          No se encontraron afiliados
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </FormField>

              {/* Selected Affiliate Preview Badge */}
              {form.id_afiliado && selectedAffiliate && (
                <div className="bg-emerald-50/50 border border-emerald-200/60 rounded-2xl p-4 flex items-center gap-3.5 animate-in fade-in duration-300">
                  {selectedAffiliate.foto_url ? (
                    <img
                      src={selectedAffiliate.foto_url}
                      alt="Afiliado"
                      loading="lazy"
                      decoding="async"
                      className="w-12 h-12 rounded-2xl object-cover object-top border border-white ring-2 ring-emerald-500/20 shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white font-black text-lg flex items-center justify-center shrink-0">
                      {((`${selectedAffiliate.nombres || ''} ${selectedAffiliate.apellidos || ''}`.trim() || selectedAffiliate.nombre_completo || 'A').charAt(0))}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase font-black tracking-widest text-emerald-700">Afiliado Vincular</p>
                    <h4 className="text-sm font-bold text-slate-900 truncate">
                      {`${selectedAffiliate.nombres || ''} ${selectedAffiliate.apellidos || ''}`.trim() || selectedAffiliate.nombre_completo}
                    </h4>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      Código: {selectedAffiliate.codigo || 'Sin código'} · Estatus: {selectedAffiliate.estatus}
                    </p>
                  </div>
                </div>
              )}

              {/* Cargo / Posición Dropdown and Display Title */}
              <FormField label="Cargo / Posición">
                <div className="space-y-3.5">
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Cargo de Referencia (Interno)</span>
                    <select
                      value={PRESET_CARGOS.includes(form.cargo_canonical) ? form.cargo_canonical : (form.cargo_canonical ? 'Otro' : '')}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'Otro') {
                          setForm(p => ({ ...p, cargo_canonical: '', cargo: '' }));
                          setIsCustomCargo(true);
                        } else {
                          setForm(p => ({ ...p, cargo_canonical: val, cargo: val }));
                          setIsCustomCargo(false);
                        }
                      }}
                      className="w-full text-sm mt-1 py-3 px-4 bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-500 rounded-2xl text-slate-800 transition-all focus:outline-none cursor-pointer font-medium"
                    >
                      <option value="" disabled>Selecciona un cargo de referencia...</option>
                      {PRESET_CARGOS.map(opt => (
                        <option key={opt} value={opt}>
                          {opt === 'Otro' ? 'Otro cargo (especificar)...' : opt}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Input for Custom Cargo if selected */}
                  {(isCustomCargo || (form.cargo_canonical && !PRESET_CARGOS.includes(form.cargo_canonical))) && (
                    <div className="animate-in fade-in slide-in-from-top-1 duration-150">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Especificar Cargo de Referencia (Masculino)</span>
                      <Input
                        value={form.cargo_canonical}
                        onChange={(e) => setForm(p => ({ ...p, cargo_canonical: e.target.value, cargo: form.cargo || e.target.value }))}
                        placeholder="Ej. Director de Relaciones Públicas"
                        className="!text-sm !py-3 mt-1 bg-slate-50 border-slate-200 focus:bg-white focus:border-emerald-500 transition-all text-slate-800 w-full rounded-2xl"
                      />
                    </div>
                  )}

                  {/* Input for Display Cargo */}
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Título de Visualización (Personalizable)</span>
                    <Input
                      value={form.cargo}
                      onChange={(e) => setForm(p => ({ ...p, cargo: e.target.value }))}
                      placeholder="Ej. Directora de Finanzas, Presidente de Honor..."
                      className="!text-sm !py-3 mt-1 bg-slate-50 border-slate-200 focus:bg-white focus:border-emerald-500 transition-all text-slate-800 w-full rounded-2xl"
                    />
                    <p className="text-[10px] text-slate-400 mt-1.5 ml-1 leading-relaxed">
                      Este es el nombre exacto que se mostrará en la web pública. Por defecto se llena con el cargo seleccionado, pero puedes adaptarlo (ej. cambiar a femenino).
                    </p>
                  </div>


                </div>
              </FormField>



              {/* Status Toggle */}
              <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200/60 rounded-2xl">
                <div>
                  <p className="text-xs font-bold text-slate-800">Estatus en el Portal Público</p>
                  <p className="text-[10px] text-slate-400 font-medium">Determina si la autoridad aparece visible en el organigrama web</p>
                </div>
                <input
                  type="checkbox"
                  checked={form.activo}
                  onChange={(e) => setForm(p => ({ ...p, activo: e.target.checked }))}
                  className="w-5 h-5 text-emerald-600 border-slate-300 rounded-lg focus:ring-emerald-500 cursor-pointer"
                />
              </div>

            </div>

            {/* Modal Actions */}
            <div className="flex items-center gap-3 border-t border-slate-100 pt-5">
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="flex-1 px-4 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar Autoridad'}
              </button>
              
              {editingItem && (
                <button
                  type="button"
                  onClick={() => remove(editingItem.id)}
                  className="px-4 py-3 rounded-2xl bg-rose-50 text-rose-600 hover:bg-rose-100 active:scale-95 text-xs font-bold transition-all"
                >
                  Eliminar
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-3 rounded-2xl bg-slate-100 text-slate-600 hover:bg-slate-200 active:scale-95 text-xs font-bold transition-all"
              >
                Cancelar
              </button>
            </div>

          </div>
        </div>
      )}



      {/* ── MODAL: Editar Fechas del Período ──────────────────────────────── */}
      {showEditPeriodModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 flex flex-col gap-5 animate-in zoom-in-95 duration-200">
            <div>
              <h3 className="text-base font-black text-slate-900">Editar Fechas del Período</h3>
              <p className="text-xs text-slate-400 mt-1">
                Modifica el período de todos los miembros pertenecientes a la gestión <strong>{formatPeriodoDisplay(selectedPeriodFilter)}</strong>.
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/60">
              <div className="space-y-1">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Inicio</span>
                <div className="flex gap-1">
                  <select
                    value={editStartMonth}
                    onChange={(e) => setEditStartMonth(e.target.value)}
                    className="flex-1 text-xs rounded-xl border border-slate-200 px-2 py-1.5 text-slate-700 bg-white font-semibold"
                  >
                    {MESES.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                  <select
                    value={editStartYear}
                    onChange={(e) => setEditStartYear(e.target.value)}
                    className="flex-1 text-xs rounded-xl border border-slate-200 px-2 py-1.5 text-slate-700 bg-white font-semibold"
                  >
                    {YEARS.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Fin</span>
                <div className="flex gap-1">
                  <select
                    value={editEndMonth}
                    onChange={(e) => setEditEndMonth(e.target.value)}
                    className="flex-1 text-xs rounded-xl border border-slate-200 px-2 py-1.5 text-slate-700 bg-white font-semibold"
                  >
                    {MESES.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                  <select
                    value={editEndYear}
                    onChange={(e) => setEditEndYear(e.target.value)}
                    className="flex-1 text-xs rounded-xl border border-slate-200 px-2 py-1.5 text-slate-700 bg-white font-semibold"
                  >
                    {YEARS.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleUpdatePeriodDates}
                disabled={updatingPeriodDates}
                className="flex-1 px-4 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50"
              >
                {updatingPeriodDates ? 'Guardando...' : 'Guardar Cambios'}
              </button>
              <button
                type="button"
                onClick={() => setShowEditPeriodModal(false)}
                disabled={updatingPeriodDates}
                className="px-4 py-3 rounded-2xl bg-slate-100 text-slate-600 hover:bg-slate-200 text-xs font-bold transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Crear Nueva Gestión ────────────────────────────────────── */}
      {showCreatePeriodModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 flex flex-col gap-5 animate-in zoom-in-95 duration-200">
            <div>
              <h3 className="text-base font-black text-slate-900">Crear Nueva Gestión</h3>
              <p className="text-xs text-slate-400 mt-1">
                Define las fechas del nuevo período de mandato.
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/60">
              <div className="space-y-1">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Inicio</span>
                <div className="flex gap-1">
                  <select
                    disabled={periods.length > 0}
                    value={createStartMonth}
                    onChange={(e) => setCreateStartMonth(e.target.value)}
                    className="flex-1 text-xs rounded-xl border border-slate-200 px-2 py-1.5 text-slate-700 bg-white font-semibold disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                  >
                    {MESES.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                  <select
                    disabled={periods.length > 0}
                    value={createStartYear}
                    onChange={(e) => setCreateStartYear(e.target.value)}
                    className="flex-1 text-xs rounded-xl border border-slate-200 px-2 py-1.5 text-slate-700 bg-white font-semibold disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                  >
                    {YEARS.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Fin</span>
                <div className="flex gap-1">
                  <select
                    value={createEndMonth}
                    onChange={(e) => setCreateEndMonth(e.target.value)}
                    className="flex-1 text-xs rounded-xl border border-slate-200 px-2 py-1.5 text-slate-700 bg-white font-semibold"
                  >
                    {MESES.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                  <select
                    value={createEndYear}
                    onChange={(e) => setCreateEndYear(e.target.value)}
                    className="flex-1 text-xs rounded-xl border border-slate-200 px-2 py-1.5 text-slate-700 bg-white font-semibold"
                  >
                    {YEARS.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => handleStartCreatePeriod(`${createStartYear}-${createStartMonth}/${createEndYear}-${createEndMonth}`)}
                className="flex-1 px-4 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20"
              >
                Confirmar y Crear Gestión
              </button>
              <button
                type="button"
                onClick={() => setShowCreatePeriodModal(false)}
                className="px-4 py-3 rounded-2xl bg-slate-100 text-slate-600 hover:bg-slate-200 text-xs font-bold transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
