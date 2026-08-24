import React, { useState, useEffect, useCallback, useMemo, useReducer } from 'react'
import { api, FormField, Input, BtnPrimary, BtnDanger, BtnSecondary, uploadFileSupabase } from '@/pages/admin/components/Cms/CmsShared'
import { 
  Users, 
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
  UserCheck,
  GripVertical,
  Upload
} from 'lucide-react'
import { formatNombreCard } from '@/utils/formatters'
import { invalidateDirectivaCache } from '@/pages/landing/junta-directiva/JuntaDirectivaPage'
import { useAuth } from '@/context/AuthContext'
import { toast } from 'sonner'
import Cropper from 'react-easy-crop'
import getCroppedImg from '@/utils/cropImage'

interface DirectivaItem {
  id: string | number;
  id_afiliado: number;
  nombre: string;
  cargo: string;
  cargo_canonical?: string;
  periodo?: string;
  foto_url?: string;
  foto_url_miembro?: string;
  foto_junta_url?: string;
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
  'Director de Atención al Agremiado',
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
  if (key.includes('atencion') || key.includes('agremiado')) return 'Director(a) de Atención al Agremiado';
  
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

interface PeriodState {
  showSuccessionModal: boolean
  succStartMonth: string
  succStartYear: string
  succEndMonth: string
  succEndYear: string
  cloning: boolean

  showEditPeriodModal: boolean
  editStartMonth: string
  editStartYear: string
  editEndMonth: string
  editEndYear: string
  updatingPeriodDates: boolean

  showCreatePeriodModal: boolean
  createStartMonth: string
  createStartYear: string
  createEndMonth: string
  createEndYear: string
}

type PeriodAction =
  | { type: 'SET_FIELD'; field: keyof PeriodState; value: any }

function periodReducer(state: PeriodState, action: PeriodAction): PeriodState {
  if (action.type === 'SET_FIELD') {
    return { ...state, [action.field]: action.value }
  }
  return state
}

interface PanelState {
  items: DirectivaItem[]
  loading: boolean
  affiliates: any[]
  loadingAffiliates: boolean
  viewMode: 'table'
  selectedPeriodFilter: string
  searchMemberQuery: string
  customPeriods: string[]
  draggedIndex: number | null
  dragOverIndex: number | null
  dropPosition: 'top' | 'bottom' | null
  movedRowId: string | number | null
  movedDirection: 'up' | 'down' | null
  swappingState: { upId: string | number; downId: string | number } | null
}

type PanelAction =
  | { type: 'SET_FIELD'; field: keyof PanelState; value: any }

function panelReducer(state: PanelState, action: PanelAction): PanelState {
  if (action.type === 'SET_FIELD') {
    const val = typeof action.value === 'function' ? action.value(state[action.field]) : action.value
    return { ...state, [action.field]: val }
  }
  return state
}

interface MemberFormState {
  isModalOpen: boolean
  editingItem: DirectivaItem | null
  form: {
    id_afiliado: string | number
    cargo: string
    cargo_canonical: string
    periodo: string
    orden: number
    activo: boolean
    foto_junta_url: string
  }
  saving: boolean
  uploadingPhoto: boolean
  uploadPhotoError: string | null
  cropModal: {
    show: boolean
    file: File | null
    preview: string | null
    crop: { x: number; y: number }
    zoom: number
    croppedAreaPixels: any
    aspectChoice: number
  }
  searchTerm: string
  showDropdown: boolean
  startMonth: string
  startYear: string
  endMonth: string
  endYear: string
  isCustomCargo: boolean
  showCargoSuggestions: boolean
}

type MemberFormAction =
  | { type: 'SET_FIELD'; field: keyof MemberFormState; value: any }
  | { type: 'OPEN_NEW_MODAL'; targetPeriod: string; parsed: { startMonth: string; startYear: string; endMonth: string; endYear: string }; maxOrden: number }
  | { type: 'OPEN_EDIT_MODAL'; item: DirectivaItem; parsed: { startMonth: string; startYear: string; endMonth: string; endYear: string }; isCustom: boolean }

function memberFormReducer(state: MemberFormState, action: MemberFormAction): MemberFormState {
  switch (action.type) {
    case 'SET_FIELD': {
      const val = typeof action.value === 'function' ? action.value(state[action.field]) : action.value
      return { ...state, [action.field]: val }
    }
    case 'OPEN_NEW_MODAL':
      return {
        ...state,
        editingItem: null,
        searchTerm: '',
        isCustomCargo: false,
        startMonth: action.parsed.startMonth,
        startYear: action.parsed.startYear,
        endMonth: action.parsed.endMonth,
        endYear: action.parsed.endYear,
        form: {
          id_afiliado: '',
          cargo: '',
          cargo_canonical: '',
          periodo: action.targetPeriod,
          orden: action.maxOrden + 1,
          activo: true,
          foto_junta_url: ''
        },
        isModalOpen: true
      }
    case 'OPEN_EDIT_MODAL':
      return {
        ...state,
        editingItem: action.item,
        searchTerm: action.item.nombre,
        isCustomCargo: action.isCustom,
        startMonth: action.parsed.startMonth,
        startYear: action.parsed.startYear,
        endMonth: action.parsed.endMonth,
        endYear: action.parsed.endYear,
        form: {
          id_afiliado: action.item.id_afiliado,
          cargo: action.item.cargo,
          cargo_canonical: action.item.cargo_canonical || action.item.cargo,
          periodo: action.item.periodo || '',
          orden: action.item.orden,
          activo: action.item.activo === true || (action.item.activo as any) === 1,
          foto_junta_url: action.item.foto_junta_url || ''
        },
        isModalOpen: true
      }
    default:
      return state
  }
}

function purgeCache() {
  invalidateDirectivaCache()
  window.dispatchEvent(new CustomEvent('directiva-cache-invalidated'))
}

export const DirectivaPanel = () => {
  const { token } = useAuth()

  const [panelState, dispatchPanel] = useReducer(panelReducer, null, () => ({
    items: [],
    loading: true,
    affiliates: [],
    loadingAffiliates: false,
    viewMode: 'table' as const,
    selectedPeriodFilter: 'all',
    searchMemberQuery: '',
    customPeriods: [],
    draggedIndex: null,
    dragOverIndex: null,
    dropPosition: null,
    movedRowId: null,
    movedDirection: null,
    swappingState: null,
  }))

  const {
    items, loading, affiliates, loadingAffiliates, viewMode, selectedPeriodFilter,
    searchMemberQuery, customPeriods, draggedIndex, dragOverIndex, dropPosition,
    movedRowId, movedDirection, swappingState
  } = panelState

  const setItems = (v: DirectivaItem[] | ((prev: DirectivaItem[]) => DirectivaItem[])) => dispatchPanel({ type: 'SET_FIELD', field: 'items', value: v })
  const setLoading = (v: boolean | ((prev: boolean) => boolean)) => dispatchPanel({ type: 'SET_FIELD', field: 'loading', value: v })
  const setAffiliates = (v: any[] | ((prev: any[]) => any[])) => dispatchPanel({ type: 'SET_FIELD', field: 'affiliates', value: v })
  const setLoadingAffiliates = (v: boolean | ((prev: boolean) => boolean)) => dispatchPanel({ type: 'SET_FIELD', field: 'loadingAffiliates', value: v })
  const setViewMode = (v: 'table' | ((prev: 'table') => 'table')) => dispatchPanel({ type: 'SET_FIELD', field: 'viewMode', value: v })
  const setSelectedPeriodFilter = (v: string | ((prev: string) => string)) => dispatchPanel({ type: 'SET_FIELD', field: 'selectedPeriodFilter', value: v })
  const setSearchMemberQuery = (v: string | ((prev: string) => string)) => dispatchPanel({ type: 'SET_FIELD', field: 'searchMemberQuery', value: v })
  const setCustomPeriods = (v: string[] | ((prev: string[]) => string[])) => dispatchPanel({ type: 'SET_FIELD', field: 'customPeriods', value: v })
  const setDraggedIndex = (v: number | null | ((prev: number | null) => number | null)) => dispatchPanel({ type: 'SET_FIELD', field: 'draggedIndex', value: v })
  const setDragOverIndex = (v: number | null | ((prev: number | null) => number | null)) => dispatchPanel({ type: 'SET_FIELD', field: 'dragOverIndex', value: v })
  const setDropPosition = (v: 'top' | 'bottom' | null | ((prev: 'top' | 'bottom' | null) => 'top' | 'bottom' | null)) => dispatchPanel({ type: 'SET_FIELD', field: 'dropPosition', value: v })
  const setMovedRowId = (v: string | number | null | ((prev: string | number | null) => string | number | null)) => dispatchPanel({ type: 'SET_FIELD', field: 'movedRowId', value: v })
  const setMovedDirection = (v: 'up' | 'down' | null | ((prev: 'up' | 'down' | null) => 'up' | 'down' | null)) => dispatchPanel({ type: 'SET_FIELD', field: 'movedDirection', value: v })
  const setSwappingState = (v: any) => dispatchPanel({ type: 'SET_FIELD', field: 'swappingState', value: v })

  const [memberFormState, dispatchMemberForm] = useReducer(memberFormReducer, null, () => ({
    isModalOpen: false,
    editingItem: null,
    form: {
      id_afiliado: '' as string | number,
      cargo: '',
      cargo_canonical: '',
      periodo: '',
      orden: 0,
      activo: true,
      foto_junta_url: ''
    },
    saving: false,
    uploadingPhoto: false,
    uploadPhotoError: null,
    cropModal: {
      show: false,
      file: null as File | null,
      preview: null as string | null,
      crop: { x: 0, y: 0 },
      zoom: 1,
      croppedAreaPixels: null as any,
      aspectChoice: 4 / 5,
    },
    searchTerm: '',
    showDropdown: false,
    startMonth: '01',
    startYear: new Date().getFullYear().toString(),
    endMonth: '01',
    endYear: (new Date().getFullYear() + 2).toString(),
    isCustomCargo: false,
    showCargoSuggestions: false,
  }))

  const {
    isModalOpen, editingItem, form, saving, uploadingPhoto, uploadPhotoError,
    cropModal, searchTerm, showDropdown, startMonth, startYear, endMonth, endYear,
    isCustomCargo, showCargoSuggestions
  } = memberFormState

  type FormType = typeof memberFormState.form
  const setIsModalOpen = (v: boolean | ((prev: boolean) => boolean)) => dispatchMemberForm({ type: 'SET_FIELD', field: 'isModalOpen', value: v })
  const setEditingItem = (v: DirectivaItem | null | ((prev: DirectivaItem | null) => DirectivaItem | null)) => dispatchMemberForm({ type: 'SET_FIELD', field: 'editingItem', value: v })
  const setForm = (v: FormType | ((prev: FormType) => FormType)) => dispatchMemberForm({ type: 'SET_FIELD', field: 'form', value: v })
  const setSaving = (v: boolean | ((prev: boolean) => boolean)) => dispatchMemberForm({ type: 'SET_FIELD', field: 'saving', value: v })
  const setUploadingPhoto = (v: boolean | ((prev: boolean) => boolean)) => dispatchMemberForm({ type: 'SET_FIELD', field: 'uploadingPhoto', value: v })
  const setUploadPhotoError = (v: string | null | ((prev: string | null) => string | null)) => dispatchMemberForm({ type: 'SET_FIELD', field: 'uploadPhotoError', value: v })
  const setCropModal = (v: any) => dispatchMemberForm({ type: 'SET_FIELD', field: 'cropModal', value: v })
  const setSearchTerm = (v: string | ((prev: string) => string)) => dispatchMemberForm({ type: 'SET_FIELD', field: 'searchTerm', value: v })
  const setShowDropdown = (v: boolean | ((prev: boolean) => boolean)) => dispatchMemberForm({ type: 'SET_FIELD', field: 'showDropdown', value: v })
  const setStartMonth = (v: string | ((prev: string) => string)) => dispatchMemberForm({ type: 'SET_FIELD', field: 'startMonth', value: v })
  const setStartYear = (v: string | ((prev: string) => string)) => dispatchMemberForm({ type: 'SET_FIELD', field: 'startYear', value: v })
  const setEndMonth = (v: string | ((prev: string) => string)) => dispatchMemberForm({ type: 'SET_FIELD', field: 'endMonth', value: v })
  const setEndYear = (v: string | ((prev: string) => string)) => dispatchMemberForm({ type: 'SET_FIELD', field: 'endYear', value: v })
  const setIsCustomCargo = (v: boolean | ((prev: boolean) => boolean)) => dispatchMemberForm({ type: 'SET_FIELD', field: 'isCustomCargo', value: v })
  const setShowCargoSuggestions = (v: boolean | ((prev: boolean) => boolean)) => dispatchMemberForm({ type: 'SET_FIELD', field: 'showCargoSuggestions', value: v })

  const showCropModal = cropModal.show
  const cropFile = cropModal.file
  const cropPreview = cropModal.preview
  const crop = cropModal.crop
  const zoom = cropModal.zoom
  const croppedAreaPixels = cropModal.croppedAreaPixels
  const cropAspectChoice = cropModal.aspectChoice

  const setShowCropModal = (show: boolean) => setCropModal((c: any) => ({ ...c, show }))
  const setCropFile = (file: File | null) => setCropModal((c: any) => ({ ...c, file }))
  const setCropPreview = (preview: string | null) => setCropModal((c: any) => ({ ...c, preview }))
  const setCrop = (cropVal: any) => setCropModal((c: any) => ({ ...c, crop: typeof cropVal === 'function' ? cropVal(c.crop) : cropVal }))
  const setZoom = (zoomVal: any) => setCropModal((c: any) => ({ ...c, zoom: typeof zoomVal === 'function' ? zoomVal(c.zoom) : zoomVal }))
  const setCroppedAreaPixels = (pixels: any) => setCropModal((c: any) => ({ ...c, croppedAreaPixels: pixels }))
  const setCropAspectChoice = (aspectChoice: number) => setCropModal((c: any) => ({ ...c, aspectChoice }))

  const handleSelectFile = (file: File) => {
    setCropFile(file)
    const reader = new FileReader()
    reader.onload = () => {
      setCropPreview(reader.result as string)
      setCrop({ x: 0, y: -10 })
      setZoom(1.1)
      setCropAspectChoice(4 / 5)
      setShowCropModal(true)
    }
    reader.readAsDataURL(file)
  }

  const handleConfirmCrop = async () => {
    if (!cropPreview || !croppedAreaPixels || !cropFile) return
    setUploadPhotoError(null)
    setUploadingPhoto(true)
    setShowCropModal(false)
    try {
      const croppedImageBlob = await getCroppedImg(
        cropPreview,
        croppedAreaPixels,
        0,
        { horizontal: false, vertical: false },
        cropFile.type
      )
      if (croppedImageBlob) {
        const webpName = cropFile.name.replace(/\.[^/.]+$/, '') + '.webp'
        const croppedFile = new File([croppedImageBlob], webpName, { type: 'image/webp' })
        const publicUrl = await uploadFileSupabase(croppedFile, 'directiva', true)
        setForm((p: any) => ({ ...p, foto_junta_url: publicUrl }))
        toast.success('Foto de junta directiva recortada y subida con éxito.')
      }
    } catch (e: any) {
      setUploadPhotoError(e.message || 'Error al recortar/subir la imagen')
      toast.error('No se pudo recortar o subir la foto.')
    } finally {
      setUploadingPhoto(false)
      setCropPreview(null)
      setCropFile(null)
    }
  }

  // Period modals state managed via useReducer with lazy initialization
  const [periodState, dispatchPeriod] = useReducer(periodReducer, null, () => ({
    showSuccessionModal: false,
    succStartMonth: '05',
    succStartYear: new Date().getFullYear().toString(),
    succEndMonth: '05',
    succEndYear: (new Date().getFullYear() + 2).toString(),
    cloning: false,
    showEditPeriodModal: false,
    editStartMonth: '01',
    editStartYear: new Date().getFullYear().toString(),
    editEndMonth: '01',
    editEndYear: (new Date().getFullYear() + 2).toString(),
    updatingPeriodDates: false,
    showCreatePeriodModal: false,
    createStartMonth: '01',
    createStartYear: new Date().getFullYear().toString(),
    createEndMonth: '01',
    createEndYear: (new Date().getFullYear() + 2).toString(),
  }))

  const {
    showSuccessionModal, succStartMonth, succStartYear, succEndMonth, succEndYear, cloning,
    showEditPeriodModal, editStartMonth, editStartYear, editEndMonth, editEndYear, updatingPeriodDates,
    showCreatePeriodModal, createStartMonth, createStartYear, createEndMonth, createEndYear,
  } = periodState

  const setShowSuccessionModal = (v: boolean) => dispatchPeriod({ type: 'SET_FIELD', field: 'showSuccessionModal', value: v })
  const setSuccStartMonth = (v: string) => dispatchPeriod({ type: 'SET_FIELD', field: 'succStartMonth', value: v })
  const setSuccStartYear = (v: string) => dispatchPeriod({ type: 'SET_FIELD', field: 'succStartYear', value: v })
  const setSuccEndMonth = (v: string) => dispatchPeriod({ type: 'SET_FIELD', field: 'succEndMonth', value: v })
  const setSuccEndYear = (v: string) => dispatchPeriod({ type: 'SET_FIELD', field: 'succEndYear', value: v })
  const setCloning = (v: boolean) => dispatchPeriod({ type: 'SET_FIELD', field: 'cloning', value: v })

  const setShowEditPeriodModal = (v: boolean) => dispatchPeriod({ type: 'SET_FIELD', field: 'showEditPeriodModal', value: v })
  const setEditStartMonth = (v: string) => dispatchPeriod({ type: 'SET_FIELD', field: 'editStartMonth', value: v })
  const setEditStartYear = (v: string) => dispatchPeriod({ type: 'SET_FIELD', field: 'editStartYear', value: v })
  const setEditEndMonth = (v: string) => dispatchPeriod({ type: 'SET_FIELD', field: 'editEndMonth', value: v })
  const setEditEndYear = (v: string) => dispatchPeriod({ type: 'SET_FIELD', field: 'editEndYear', value: v })
  const setUpdatingPeriodDates = (v: boolean) => dispatchPeriod({ type: 'SET_FIELD', field: 'updatingPeriodDates', value: v })

  const setShowCreatePeriodModal = (v: boolean) => dispatchPeriod({ type: 'SET_FIELD', field: 'showCreatePeriodModal', value: v })
  const setCreateStartMonth = (v: string) => dispatchPeriod({ type: 'SET_FIELD', field: 'createStartMonth', value: v })
  const setCreateStartYear = (v: string) => dispatchPeriod({ type: 'SET_FIELD', field: 'createStartYear', value: v })
  const setCreateEndMonth = (v: string) => dispatchPeriod({ type: 'SET_FIELD', field: 'createEndMonth', value: v })
  const setCreateEndYear = (v: string) => dispatchPeriod({ type: 'SET_FIELD', field: 'createEndYear', value: v })

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

  const periods = useMemo(() => {
    const uniquePeriods = Array.from(new Set([
      ...customPeriods,
      ...items.flatMap(item => item.periodo ? [item.periodo] : [])
    ])) as string[]
    return uniquePeriods.sort((a, b) => b.localeCompare(a))
  }, [items, customPeriods])

  const activePeriodFilter = useMemo(() => {
    if (selectedPeriodFilter === 'all' && periods.length > 0) {
      return periods[0]
    }
    return selectedPeriodFilter
  }, [selectedPeriodFilter, periods])

  const filteredItems = useMemo(() => {
    let result = items.filter(item => {
      if (activePeriodFilter === 'all') return true
      return item.periodo === activePeriodFilter
    })
    
    if (searchMemberQuery.trim()) {
      const q = searchMemberQuery.toLowerCase()
      result = result.filter(item => 
        item.nombre.toLowerCase().includes(q) || 
        item.cargo.toLowerCase().includes(q)
      )
    }

    return result.sort((a, b) => a.orden - b.orden)
  }, [items, activePeriodFilter, searchMemberQuery])

  const createDragGhost = (e: React.DragEvent, item: DirectivaItem, rank: number) => {
    const ghost = document.createElement('div');
    ghost.className = 'fixed -top-[9999px] -left-[9999px] z-50 bg-white text-slate-900 px-5 py-3.5 rounded-2xl shadow-2xl border-2 border-emerald-500/80 flex items-center gap-4 font-sans pointer-events-none min-w-[380px] scale-105';
    
    const initial = (item.nombre || 'M').charAt(0).toUpperCase();
    const avatarHtml = item.foto_url 
      ? `<img src="${item.foto_url}" class="w-10 h-10 rounded-xl object-cover shadow-xs" />`
      : `<div class="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-sm border border-slate-200">${initial}</div>`;

    ghost.innerHTML = `
      <div class="flex items-center gap-2 shrink-0">
        <span class="text-xs font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-md">#${rank}</span>
      </div>
      ${avatarHtml}
      <div class="flex-1 min-w-0">
        <div class="font-bold text-sm text-slate-900 truncate">${item.nombre}</div>
        <div class="text-[10px] text-emerald-700 font-bold uppercase tracking-wider truncate">${item.cargo}</div>
      </div>
      <div class="text-[10px] bg-emerald-600 text-white font-bold px-2.5 py-1 rounded-lg uppercase tracking-wider shadow-xs">
        Moviendo
      </div>
    `;
    
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 50, 30);
    
    setTimeout(() => {
      if (document.body.contains(ghost)) {
        document.body.removeChild(ghost);
      }
    }, 0);
  };

  const getRowDisplacement = (index: number) => {
    if (draggedIndex === null || dragOverIndex === null || draggedIndex === index) return '';
    const targetIndex = calculateTargetIndex(draggedIndex, dragOverIndex, dropPosition);

    if (draggedIndex < targetIndex && index > draggedIndex && index <= targetIndex) {
      return '-translate-y-2.5 transition-transform duration-200 ease-out';
    }
    if (draggedIndex > targetIndex && index >= targetIndex && index < draggedIndex) {
      return 'translate-y-2.5 transition-transform duration-200 ease-out';
    }
    return '';
  };

  const getSwapAnimationClass = (itemId: string | number) => {
    if (!swappingState) return '';
    if (swappingState.upId === itemId) {
      return '-translate-y-full scale-[1.02] shadow-xl z-30 bg-emerald-50/95 border-l-4 border-l-emerald-600 ring-1 ring-emerald-500/30 transition-colors duration-350 ease-[cubic-bezier(0.16,1,0.3,1)]';
    }
    if (swappingState.downId === itemId) {
      return 'translate-y-full scale-[0.98] opacity-75 shadow-xs z-10 bg-slate-100/90 transition-colors duration-350 ease-[cubic-bezier(0.16,1,0.3,1)]';
    }
    return '';
  };

  const calculateTargetIndex = (fromIdx: number, overIdx: number, pos: 'top' | 'bottom' | null) => {
    if (!pos) return overIdx;
    let target = pos === 'top' ? overIdx : overIdx + 1;
    if (fromIdx < target) {
      target -= 1;
    }
    return Math.max(0, Math.min(target, filteredItems.length - 1));
  };

  const moveItem = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= filteredItems.length) return;

    const currentItem = filteredItems[index];
    const swapItem = filteredItems[targetIndex];

    const upId = direction === 'up' ? currentItem.id : swapItem.id;
    const downId = direction === 'up' ? swapItem.id : currentItem.id;

    setSwappingState({ upId, downId });

    await new Promise(resolve => setTimeout(resolve, 330));

    setSwappingState(null);
    setMovedDirection(direction);
    setMovedRowId(currentItem.id);
    setTimeout(() => {
      setMovedRowId(null);
      setMovedDirection(null);
    }, 800);

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

  const handleReorder = async (fromIndex: number, toIndex: number, position: 'top' | 'bottom' | null = null) => {
    const finalTarget = position ? calculateTargetIndex(fromIndex, toIndex, position) : toIndex;
    if (fromIndex === finalTarget || fromIndex < 0 || finalTarget < 0 || fromIndex >= filteredItems.length || finalTarget >= filteredItems.length) return;

    const reordered = [...filteredItems];
    const [movedItem] = reordered.splice(fromIndex, 1);
    reordered.splice(finalTarget, 0, movedItem);

    const direction = fromIndex > finalTarget ? 'up' : 'down';
    setMovedDirection(direction);
    setMovedRowId(movedItem.id);
    setTimeout(() => {
      setMovedRowId(null);
      setMovedDirection(null);
    }, 800);

    // Assign sequential order starting from 1
    const updatedList = reordered.map((item, idx) => ({ ...item, orden: idx + 1 }));

    // Optimistic UI update
    setItems(prev => prev.map(item => {
      const found = updatedList.find(u => u.id === item.id);
      return found ? found : item;
    }));

    try {
      await Promise.all(
        updatedList.map(item => api.put(`/api/cms/directiva/${item.id}`, { orden: item.orden }))
      );
      purgeCache();
    } catch (e) {
      console.error('Error al reordenar elementos:', e);
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

    const parsed = parsePeriodo(targetPeriod)
    const maxOrden = items.length > 0 ? Math.max(...items.map(i => i.orden)) : 0
    dispatchMemberForm({
      type: 'OPEN_NEW_MODAL',
      targetPeriod,
      parsed,
      maxOrden
    })
  }

  const openEditModal = (item: DirectivaItem) => {
    const isCustom = !PRESET_CARGOS.includes(item.cargo_canonical || item.cargo)
    const parsed = item.periodo ? parsePeriodo(item.periodo) : {
      startMonth: '01',
      startYear: new Date().getFullYear().toString(),
      endMonth: '01',
      endYear: (new Date().getFullYear() + 2).toString()
    }
    dispatchMemberForm({
      type: 'OPEN_EDIT_MODAL',
      item,
      parsed,
      isCustom
    })
  }

  const save = async () => {
    if (!form.id_afiliado && !editingItem) return toast.warning('Debes seleccionar un afiliado.')
    if (!form.cargo) return toast.warning('El cargo es requerido.')

    setSaving(true)
    try {
      const payload = { ...form, activo: true }
      let resp;
      if (editingItem) {
        resp = await api.put(`/api/cms/directiva/${editingItem.id}`, payload)
      } else {
        resp = await api.post('/api/cms/directiva', payload)
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
      await Promise.all(
        currentPeriodItems.map(item =>
          api.put(`/api/cms/directiva/${item.id}`, { periodo: newPeriod })
        )
      )
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
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold transition-colors transition-transform shadow-md shadow-emerald-600/20"
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
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 text-xs font-bold transition-colors transition-transform"
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
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
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
                className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors shadow-xs"
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
            className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors shadow-md shadow-emerald-600/20 flex items-center gap-2"
          >
            <Plus size={16} />
            <span>Agregar Primer Miembro</span>
          </button>
        </div>
      ) : (
        <>
          {/* MOBILE CARDS VIEW */}
          <div className="block md:hidden space-y-3">
            {filteredItems.map((item, index) => {
              const rank = index + 1;
              return (
                <div key={item.id} className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm space-y-3 relative overflow-hidden">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-slate-100 overflow-hidden flex items-center justify-center font-bold text-slate-600 shrink-0 border border-slate-200/50">
                        {item.foto_url ? (
                          <img src={item.foto_url} alt={item.nombre} loading="lazy" decoding="async" className="w-full h-full object-cover object-top" />
                        ) : (
                          formatNombreCard(item.nombre).charAt(0)
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-extrabold text-slate-900 text-sm leading-tight truncate">
                          {formatNombreCard(item.nombre)}
                        </p>
                        <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wider block truncate mt-0.5">
                          {item.cargo}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-xs font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg">
                        #{rank}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 text-xs gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 font-medium text-[11px]">{formatPeriodoDisplay(item.periodo)}</span>
                      <button
                        type="button"
                        onClick={() => toggleStatus(item)}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                          item.activo ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {item.activo ? 'Activo' : 'Inactivo'}
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => moveItem(index, 'up')}
                        className="p-1.5 text-slate-500 hover:text-slate-900 disabled:opacity-20 transition border border-slate-200 rounded-lg"
                        title="Mover arriba"
                      >
                        <ArrowUp size={13} />
                      </button>
                      <button
                        type="button"
                        disabled={index === filteredItems.length - 1}
                        onClick={() => moveItem(index, 'down')}
                        className="p-1.5 text-slate-500 hover:text-slate-900 disabled:opacity-20 transition border border-slate-200 rounded-lg"
                        title="Mover abajo"
                      >
                        <ArrowDown size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(item)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 border border-blue-100 rounded-lg transition"
                        title="Editar"
                      >
                        <Edit3 size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(item.id)}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 border border-rose-100 rounded-lg transition"
                        title="Eliminar"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* HIGH DENSITY TABLE VIEW FOR DESKTOP */}
          <div className="hidden md:block bg-white rounded-3xl border border-slate-100 shadow-sm overflow-auto max-h-[calc(100vh-280px)] custom-scrollbar">
            <table className="w-full text-left text-xs min-w-[700px] border-separate border-spacing-0">
              <thead className="sticky top-0 z-10 bg-slate-50 shadow-xs">
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <th className="px-5 py-4 w-20 text-center bg-slate-50 border-b border-slate-200">ORDEN</th>
                  <th className="px-5 py-4 bg-slate-50 border-b border-slate-200">AUTORIDAD / CARGO</th>
                  <th className="px-5 py-4 bg-slate-50 border-b border-slate-200">PERÍODO</th>
                  <th className="px-5 py-4 text-center bg-slate-50 border-b border-slate-200">ESTATUS</th>
                  <th className="px-5 py-4 text-right bg-slate-50 border-b border-slate-200">ACCIONES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((item, index) => {
                  const rank = index + 1;
                  const isBeingDragged = draggedIndex === index;
                  const isHoverTarget = dragOverIndex === index && draggedIndex !== index;

                  return (
                    <tr
                      key={item.id}
                      draggable
                      onDragStart={(e) => {
                        setDraggedIndex(index);
                        createDragGhost(e, item, rank);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        const rect = e.currentTarget.getBoundingClientRect();
                        const offsetY = e.clientY - rect.top;
                        const pos = offsetY < rect.height / 2 ? 'top' : 'bottom';
                        
                        if (dragOverIndex !== index || dropPosition !== pos) {
                          setDragOverIndex(index);
                          setDropPosition(pos);
                        }
                      }}
                      onDragLeave={() => {
                        if (dragOverIndex === index) {
                          setDragOverIndex(null);
                          setDropPosition(null);
                        }
                      }}
                      onDragEnd={() => {
                        setDraggedIndex(null);
                        setDragOverIndex(null);
                        setDropPosition(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (draggedIndex !== null && draggedIndex !== index) {
                          handleReorder(draggedIndex, index, dropPosition);
                        }
                        setDraggedIndex(null);
                        setDragOverIndex(null);
                        setDropPosition(null);
                      }}
                      className={`transition-colors duration-300 ease-in-out group ${getSwapAnimationClass(item.id)} ${getRowDisplacement(index)} ${
                        movedRowId === item.id
                          ? 'bg-emerald-50/90 border-l-4 border-l-emerald-600 transition-colors duration-500'
                          : isBeingDragged
                          ? 'opacity-30 bg-slate-100/70 border-dashed border-2 border-slate-300'
                          : isHoverTarget
                          ? `${dropPosition === 'top' ? 'border-t-2 border-t-emerald-600' : 'border-b-2 border-b-emerald-600'} bg-emerald-50/40`
                          : 'hover:bg-slate-50/70'
                      }`}
                    >
                      <td className="px-5 py-3.5 text-center font-bold text-slate-400">
                        <div className="flex items-center justify-center gap-1.5">
                          <div 
                            className="p-1 rounded-lg text-slate-300 group-hover:text-slate-500 hover:bg-slate-100 cursor-grab active:cursor-grabbing transition-colors shrink-0" 
                            title="Arrastrar para reordenar"
                          >
                            <GripVertical size={14} />
                          </div>

                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-md border min-w-[34px] text-center flex items-center justify-center gap-1 transition-colors ${
                            movedRowId === item.id 
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold scale-105 shadow-xs' 
                              : 'text-slate-500 bg-slate-100 border-slate-200/60'
                          }`}>
                            {movedRowId === item.id && movedDirection === 'up' && (
                              <ArrowUp size={11} className="text-emerald-600 animate-bounce shrink-0" />
                            )}
                            {movedRowId === item.id && movedDirection === 'down' && (
                              <ArrowDown size={11} className="text-emerald-600 animate-bounce shrink-0" />
                            )}
                            <span>#{rank}</span>
                          </span>

                          <div className="flex flex-col gap-0.5 ml-0.5">
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() => moveItem(index, 'up')}
                              className="p-0.5 text-slate-400 hover:text-slate-800 disabled:opacity-20 transition-colors rounded-md"
                              title="Mover arriba"
                            >
                              <ArrowUp size={11} />
                            </button>
                            <button
                              type="button"
                              disabled={index === filteredItems.length - 1}
                              onClick={() => moveItem(index, 'down')}
                              className="p-0.5 text-slate-400 hover:text-slate-800 disabled:opacity-20 transition-colors rounded-md"
                              title="Mover abajo"
                            >
                              <ArrowDown size={11} />
                            </button>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-slate-100 overflow-hidden flex items-center justify-center font-bold text-slate-600 shrink-0 border border-slate-200/50">
                            {item.foto_url ? (
                              <img src={item.foto_url} alt={item.nombre} loading="lazy" decoding="async" className="w-full h-full object-cover object-top" />
                            ) : (
                              formatNombreCard(item.nombre).charAt(0)
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 text-sm leading-tight flex items-center gap-1.5">
                              {formatNombreCard(item.nombre)}
                              {item.foto_junta_url && (
                                <span 
                                  className="inline-block text-[8px] bg-amber-50 text-amber-700 border border-amber-200/60 font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider shrink-0" 
                                  title="Tiene una foto específica asignada para la landing de Junta Directiva"
                                >
                                  Foto Junta
                                </span>
                              )}
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
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${
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
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            onClick={() => remove(item.id)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── MODAL: Crear / Editar Miembro ──────────────────────────────────── */}
      {isModalOpen && (
        <div className="transition-opacity fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 fade-in duration-200">
          <div className="transition-transform bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-100 flex flex-col gap-6 zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            
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
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
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
                    className="!text-sm !py-3 bg-slate-50 border-slate-200 focus:bg-white transition-colors text-slate-800 w-full rounded-2xl"
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
                                  <img src={a.foto_url} alt={representativeName || 'Foto Afiliado'} loading="lazy" decoding="async" className="w-8 h-8 rounded-xl object-cover object-top shrink-0" />
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
                <div className="transition-opacity bg-emerald-50/50 border border-emerald-200/60 rounded-2xl p-4 flex items-center gap-3.5 fade-in duration-300">
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

              {/* Foto de Junta Directiva (Landing) */}
              <FormField label="Foto Específica para Junta Directiva (Landing)">
                <div className="space-y-3.5">
                  <p className="text-[10px] text-slate-400 leading-relaxed ml-1">
                    Por defecto se usará la foto de perfil del afiliado. Sube una foto aquí si deseas que muestre una imagen distinta (ej. una foto formal corporativa) en la sección de Junta Directiva de la landing page.
                  </p>
                  
                  <div className="flex items-center gap-4">
                    {/* Visualización de la foto actual para Junta Directiva */}
                    <div className="w-20 h-20 rounded-2xl border border-slate-200 overflow-hidden bg-slate-50 flex items-center justify-center shrink-0 relative shadow-sm">
                      {form.foto_junta_url ? (
                        <>
                          <img 
                            src={form.foto_junta_url} 
                            alt="Foto Junta" 
                            className="w-full h-full object-cover object-top" 
                          />
                          <button
                            type="button"
                            onClick={() => setForm(p => ({ ...p, foto_junta_url: '' }))}
                            className="absolute top-1 right-1 p-1 rounded-full bg-rose-500 text-white hover:bg-rose-600 transition-colors shadow-sm"
                            title="Remover foto específica"
                          >
                            <X size={10} />
                          </button>
                        </>
                      ) : selectedAffiliate?.foto_url ? (
                        <div className="w-full h-full relative">
                          <img 
                            src={selectedAffiliate.foto_url} 
                            alt="Foto Perfil (Default)" 
                            className="w-full h-full object-cover object-top opacity-50" 
                          />
                          <div className="absolute inset-0 bg-slate-900/30 flex items-center justify-center">
                            <span className="text-[9px] text-white font-bold bg-slate-900/60 px-1.5 py-0.5 rounded-md">Perfil</span>
                          </div>
                        </div>
                      ) : (
                        <Users className="text-slate-300" size={24} />
                      )}
                    </div>

                    {/* Botón de carga */}
                    <div className="flex-1 min-w-0">
                      <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 rounded-xl font-bold text-xs cursor-pointer transition-colors transition-transform border border-slate-200">
                        <Upload size={14} />
                        {uploadingPhoto ? 'Subiendo...' : 'Subir Foto Específica'}
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          disabled={uploadingPhoto}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleSelectFile(file);
                          }}
                        />
                      </label>
                      {uploadPhotoError && (
                        <p className="text-[10px] text-rose-600 font-bold mt-1">× {uploadPhotoError}</p>
                      )}
                    </div>
                  </div>
                </div>
              </FormField>

              {/* Cargo / Posición Dropdown and Display Title */}
              <FormField label="Cargo / Posición">
                <div className="space-y-3.5">
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Cargo de Referencia (Interno)</span>
                    <select
                      value={isCustomCargo ? 'Otro' : (PRESET_CARGOS.includes(form.cargo_canonical) ? form.cargo_canonical : (form.cargo_canonical ? 'Otro' : ''))}
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
                      className="w-full text-sm mt-1 py-3 px-4 bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-500 rounded-2xl text-slate-800 transition-colors focus:outline-none cursor-pointer font-medium"
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
                    <div className="transition-opacity transition-transform fade-in slide-in-from-top-1 duration-150">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Especificar Cargo de Referencia (Masculino)</span>
                      <Input
                        value={form.cargo_canonical}
                        onChange={(e) => {
                          const val = e.target.value;
                          setForm(p => {
                            const syncCargo = !p.cargo || p.cargo === p.cargo_canonical;
                            return {
                              ...p,
                              cargo_canonical: val,
                              cargo: syncCargo ? val : p.cargo
                            };
                          });
                        }}
                        placeholder="Ej. Director de Relaciones Públicas"
                        className="!text-sm !py-3 mt-1 bg-slate-50 border-slate-200 focus:bg-white focus:border-emerald-500 transition-colors text-slate-800 w-full rounded-2xl"
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
                      className="!text-sm !py-3 mt-1 bg-slate-50 border-slate-200 focus:bg-white focus:border-emerald-500 transition-colors text-slate-800 w-full rounded-2xl"
                    />
                    <p className="text-[10px] text-slate-400 mt-1.5 ml-1 leading-relaxed">
                      Este es el nombre exacto que se mostrará en la web pública. Por defecto se llena con el cargo seleccionado, pero puedes adaptarlo (ej. cambiar a femenino).
                    </p>
                  </div>


                </div>
              </FormField>

            </div>

            {/* Modal Actions */}
            <div className="flex items-center gap-3 border-t border-slate-100 pt-5">
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="flex-1 px-4 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold transition-colors transition-transform shadow-md shadow-emerald-600/20 disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar Autoridad'}
              </button>
              
              {editingItem && (
                <button
                  type="button"
                  onClick={() => remove(editingItem.id)}
                  className="px-4 py-3 rounded-2xl bg-rose-50 text-rose-600 hover:bg-rose-100 active:scale-95 text-xs font-bold transition-colors transition-transform"
                >
                  Eliminar
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-3 rounded-2xl bg-slate-100 text-slate-600 hover:bg-slate-200 active:scale-95 text-xs font-bold transition-colors transition-transform"
              >
                Cancelar
              </button>
            </div>

          </div>
        </div>
      )}



      {/* ── MODAL: Editar Fechas del Período ──────────────────────────────── */}
      {showEditPeriodModal && (
        <div className="transition-opacity fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 fade-in duration-200">
          <div className="transition-transform bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 flex flex-col gap-5 zoom-in-95 duration-200">
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
                className="flex-1 px-4 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors transition-opacity shadow-md shadow-emerald-600/20 disabled:opacity-50"
              >
                {updatingPeriodDates ? 'Guardando...' : 'Guardar Cambios'}
              </button>
              <button
                type="button"
                onClick={() => setShowEditPeriodModal(false)}
                disabled={updatingPeriodDates}
                className="px-4 py-3 rounded-2xl bg-slate-100 text-slate-600 hover:bg-slate-200 text-xs font-bold transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Crear Nueva Gestión ────────────────────────────────────── */}
      {showCreatePeriodModal && (
        <div className="transition-opacity fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 fade-in duration-200">
          <div className="transition-transform bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 flex flex-col gap-5 zoom-in-95 duration-200">
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
                className="flex-1 px-4 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-md shadow-emerald-600/20"
              >
                Confirmar y Crear Gestión
              </button>
              <button
                type="button"
                onClick={() => setShowCreatePeriodModal(false)}
                className="px-4 py-3 rounded-2xl bg-slate-100 text-slate-600 hover:bg-slate-200 text-xs font-bold transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Recorte de Foto de Junta Directiva */}
      {showCropModal && cropPreview && (
        <div className="transition-opacity fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs fade-in duration-200">
          <div className="transition-transform bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 relative flex flex-col gap-6 zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-slate-800 text-base">Ajustar Encuadre</h3>
                <p className="text-[10px] text-slate-400 font-medium">Recorta la foto para la junta directiva</p>
              </div>
              <button
                type="button"
                onClick={() => { setShowCropModal(false); setCropPreview(null); setCropFile(null); }}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-200 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Contenedor del Cropper */}
            <div className="relative w-full h-72 rounded-2xl overflow-hidden border border-slate-100 bg-slate-50">
              <Cropper
                image={cropPreview}
                crop={crop}
                zoom={zoom}
                minZoom={1}
                maxZoom={4}
                restrictPosition={true}
                aspect={cropAspectChoice}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, pixels) => setCroppedAreaPixels(pixels)}
                cropShape="rect"
                showGrid={true}
                onMediaLoaded={() => {
                  setZoom(1.1)
                  setCrop({ x: 0, y: -10 })
                }}
              />
            </div>

            {/* Selectores de Encuadre */}
            <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-slate-100/80 rounded-xl">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Encuadre:</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCropAspectChoice(1)}
                  className={`px-2 py-0.75 text-[10px] font-bold rounded-lg transition-colors ${cropAspectChoice === 1 ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Cuadrado (1:1)
                </button>
                <button
                  type="button"
                  onClick={() => setCropAspectChoice(4 / 5)}
                  className={`px-2 py-0.75 text-[10px] font-bold rounded-lg transition-colors ${cropAspectChoice === 4 / 5 ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Perfil (4:5)
                </button>
                <button
                  type="button"
                  onClick={() => setCropAspectChoice(16 / 9)}
                  className={`px-2 py-0.75 text-[10px] font-bold rounded-lg transition-colors ${cropAspectChoice === 16 / 9 ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Horizontal (16:9)
                </button>
              </div>
            </div>

            {/* Control de Zoom deslizante */}
            <div className="space-y-1.5 px-1">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Zoom</span>
                <span className="text-[10px] font-bold text-slate-600">{Math.round(zoom * 100)}%</span>
              </div>
              <input
                type="range"
                min={1}
                max={4}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-emerald-600"
              />
            </div>

            {/* Acciones del Modal */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleConfirmCrop}
                className="flex-1 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold transition-colors transition-transform shadow-md shadow-emerald-600/20"
              >
                Confirmar Recorte
              </button>
              <button
                type="button"
                onClick={() => { setShowCropModal(false); setCropPreview(null); setCropFile(null); }}
                className="px-4 py-3 rounded-2xl bg-slate-100 text-slate-600 hover:bg-slate-200 active:scale-95 text-xs font-bold transition-colors transition-transform"
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
