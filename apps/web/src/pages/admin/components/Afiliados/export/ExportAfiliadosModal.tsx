import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  X,
  FileDown,
  Loader2,
  Filter,
  Columns,
  CheckSquare,
  Square,
  RotateCcw,
  Search,
  Calendar,
  Hash,
  UserCheck,
  Check,
  Container,
  ChevronDown
} from 'lucide-react'
import { toast } from 'sonner'
import { API_URL } from '@/config/env'
import { AfiliadoDTO } from '@/types/afiliados'
import {
  AFILIADOS_EXPORT_COLUMNS,
  DEFAULT_SELECTED_COLUMNS,
  ExportColumnId,
} from './afiliadosExportColumns'
import {
  describeExportFilters,
  ExportActivoFilter,
  ExportEstatusFilter,
  ExportRowFilters,
  ExportTipoFilter,
  filterAfiliadosForExport,
} from './filterAfiliadosForExport'
import { generateAfiliadosPdf } from './generateAfiliadosPdf'

export interface ExportAfiliadosInitialFilters {
  tipo?: ExportTipoFilter
  estatus?: ExportEstatusFilter
  activo?: ExportActivoFilter
  search?: string
}

interface ExportAfiliadosModalProps {
  open: boolean
  onClose: () => void
  authHeaders: Record<string, string>
  initialFilters?: ExportAfiliadosInitialFilters
}

export default function ExportAfiliadosModal({
  open,
  onClose,
  authHeaders,
  initialFilters,
}: ExportAfiliadosModalProps) {
  const [activeTab, setActiveTab] = useState<'filtros' | 'columnas'>('filtros')
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)
  const [filters, setFilters] = useState<ExportRowFilters>({
    tipo: initialFilters?.tipo ?? 'Todos',
    estatus: initialFilters?.estatus ?? 'Todos',
    activo: initialFilters?.activo ?? 'todos',
    search: initialFilters?.search ?? '',
    searchField: 'todos',
    desdeCodigo: '',
    fechaDesde: '',
    fechaHasta: '',
  })
  const [selectedColumns, setSelectedColumns] = useState<ExportColumnId[]>(DEFAULT_SELECTED_COLUMNS)
  const [previewItems, setPreviewItems] = useState<AfiliadoDTO[]>([])
  const [previewLoading, setPreviewLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')

  const [prevOpen, setPrevOpen] = useState(open)
  if (prevOpen !== open) {
    setPrevOpen(open)
    if (open) {
      setFilters({
        tipo: initialFilters?.tipo ?? 'Todos',
        estatus: initialFilters?.estatus ?? 'Todos',
        activo: initialFilters?.activo ?? 'todos',
        search: initialFilters?.search ?? '',
        desdeCodigo: '',
        fechaDesde: '',
        fechaHasta: '',
      })
      setSelectedColumns(DEFAULT_SELECTED_COLUMNS)
      setError('')
      setActiveTab('filtros')
    }
  }

  const fetchItems = useCallback(async (signal?: AbortSignal): Promise<AfiliadoDTO[]> => {
    try {
      const qs = new URLSearchParams()
      if (filters.estatus !== 'Todos') qs.set('estatus', filters.estatus)
      if (filters.tipo !== 'Todos') {
        qs.set('tipo_afiliado', filters.tipo)
      }
      const url = `${API_URL}/api/afiliados${qs.toString() ? `?${qs}` : ''}`
      const res = await fetch(url, { headers: authHeaders, signal })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Error al cargar afiliados')
      }
      return json.data as AfiliadoDTO[]
    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') {
        throw new Error('Tiempo de espera agotado al conectar con el servidor (Timeout).')
      }
      throw err
    }
  }, [authHeaders, filters.estatus, filters.tipo])

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)
    setPreviewLoading(true)

    fetchItems(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setPreviewItems(data)
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted) {
          const msg = (e as Error).message || 'Error al cargar datos'
          setError(msg)
          toast.error(msg)
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setPreviewLoading(false)
      })

    return () => {
      clearTimeout(timeoutId)
      controller.abort()
    }
  }, [open, fetchItems])

  const filteredRows = useMemo(
    () => filterAfiliadosForExport(previewItems, filters),
    [previewItems, filters]
  )

  const toggleColumn = (id: ExportColumnId) => {
    setSelectedColumns((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev
        return prev.filter((c) => c !== id)
      }
      return [...prev, id]
    })
  }

  const toggleSelectAllColumns = () => {
    if (selectedColumns.length === AFILIADOS_EXPORT_COLUMNS.length) {
      setSelectedColumns([])
    } else {
      setSelectedColumns(AFILIADOS_EXPORT_COLUMNS.map((c) => c.id))
    }
  }

  const resetColumns = () => {
    setSelectedColumns(DEFAULT_SELECTED_COLUMNS)
  }

  const resetFilters = () => {
    setFilters({
      tipo: 'Todos',
      estatus: 'Todos',
      activo: 'todos',
      search: '',
      desdeCodigo: '',
      fechaDesde: '',
      fechaHasta: '',
    })
  }

  const handleExport = async () => {
    if (selectedColumns.length === 0 || filteredRows.length === 0) {
      const msg = 'No hay registros o columnas seleccionadas para exportar.'
      setError(msg)
      toast.error(msg)
      return
    }
    setExporting(true)
    setError('')
    try {
      const data = await fetchItems()
      const rows = filterAfiliadosForExport(data, filters)
      if (rows.length === 0) {
        const msg = 'No hay registros que coincidan con los filtros.'
        setError(msg)
        toast.error(msg)
        return
      }
      await generateAfiliadosPdf({
        rows,
        columnIds: selectedColumns,
        filterSummary: describeExportFilters(filters),
      })
      toast.success('Reporte generado exitosamente')
      onClose()
    } catch (e: unknown) {
      const msg = (e as Error).message || 'Error al generar el PDF'
      setError(msg)
      toast.error(msg)
    } finally {
      setExporting(false)
    }
  }

  if (!open) return null

  return (
    <div className="transition-opacity fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 fade-in duration-200">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" onClick={onClose} />

      <div className="relative w-full max-w-2xl flex flex-col bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 overflow-hidden">
        {/* Header Limpio Homogéneo */}
        <div className="bg-white px-6 py-5 border-b border-gray-100 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100/60 shrink-0">
                <FileDown size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-800 tracking-tight">
                  Exportar Reporte PDF
                </h3>
                <p className="text-xs font-semibold text-slate-400">
                  Filtre afiliados y seleccione las columnas del listado.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-slate-50 hover:bg-slate-100 border border-gray-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Selector de Pestañas estilo limpio */}
          <div className="flex items-center gap-1.5 mt-4 bg-slate-100/70 p-1 rounded-xl border border-gray-200/60">
            <button
              type="button"
              onClick={() => setActiveTab('filtros')}
              className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg text-xs font-bold transition-colors ${activeTab === 'filtros'
                  ? 'bg-white text-slate-800 shadow-sm font-black'
                  : 'text-slate-500 hover:text-slate-800'
                }`}
            >
              <Filter size={13} />
              Filtros y Búsqueda
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('columnas')}
              className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg text-xs font-bold transition-colors ${activeTab === 'columnas'
                  ? 'bg-white text-slate-800 shadow-sm font-black'
                  : 'text-slate-500 hover:text-slate-800'
                }`}
            >
              <Columns size={13} />
              Columnas ({selectedColumns.length}/{AFILIADOS_EXPORT_COLUMNS.length})
            </button>
          </div>
        </div>

        {/* Resumen dinámico del conteo de registros */}
        <div className="bg-slate-50/70 border-b border-gray-100 px-6 py-2.5 flex items-center justify-between text-xs font-semibold shrink-0">
          <div className="flex items-center gap-2 text-slate-600">
            <Container size={14} className="text-emerald-600" />
            <span>Registros incluidos:</span>
            <span className="font-black text-slate-800 bg-white border border-gray-200 px-2.5 py-0.5 rounded-lg shadow-2xs">
              {previewLoading ? (
                <span className="flex items-center gap-1 text-slate-400">
                  <Loader2 size={12} className="animate-spin" /> Calculando...
                </span>
              ) : (
                `${filteredRows.length} de ${previewItems.length}`
              )}
            </span>
          </div>
          {activeTab === 'filtros' && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-[10px] font-bold text-slate-400 hover:text-emerald-600 uppercase tracking-wider transition-colors flex items-center gap-1"
            >
              <RotateCcw size={10} /> Restablecer filtros
            </button>
          )}
          {activeTab === 'columnas' && (
            <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider">
              <button
                type="button"
                onClick={toggleSelectAllColumns}
                className="text-emerald-600 hover:text-emerald-700 transition-colors flex items-center gap-1 cursor-pointer"
              >
                {selectedColumns.length === AFILIADOS_EXPORT_COLUMNS.length ? (
                  <>
                    <Square size={12} /> Deseleccionar todas
                  </>
                ) : (
                  <>
                    <CheckSquare size={12} /> Seleccionar todas
                  </>
                )}
              </button>
              <span className="text-slate-200">|</span>
              <button
                type="button"
                onClick={resetColumns}
                className="text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1"
              >
                <RotateCcw size={10} /> Predeterminadas
              </button>
            </div>
          )}
        </div>

        {/* Contenido principal con altura fija para mantener la consistencia al cambiar de pestaña */}
        <div className="h-[420px] max-h-[420px] overflow-y-auto px-6 py-5 space-y-6 custom-scrollbar shrink-0">
          {activeTab === 'filtros' ? (
            <div className="space-y-4">
              {/* Buscador libre con dropdown de criterio igual a la vista principal */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-1.5">
                  <Search size={12} className="text-emerald-600" /> Búsqueda por Texto
                </label>
                <div className="relative flex items-center bg-slate-50 border border-gray-200 rounded-2xl focus-within:ring-2 focus-within:ring-emerald-500/10 focus-within:border-emerald-500 transition-colors h-10">
                  {/* Dropdown de criterio */}
                  <div className="relative shrink-0 border-r border-gray-200 h-full flex items-center px-1">
                    <button
                      type="button"
                      onClick={() => setShowSearchDropdown(!showSearchDropdown)}
                      className="flex items-center gap-1 px-2 h-full text-[10px] font-black uppercase tracking-wider text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                    >
                      <span>
                        {filters.searchField === 'nombre' && 'Nombre'}
                        {filters.searchField === 'id' && 'Cédula / RIF'}
                        {filters.searchField === 'codigo' && 'Código'}
                        {(!filters.searchField || filters.searchField === 'todos') && 'Todos'}
                      </span>
                      <ChevronDown size={11} className={`text-slate-400 transition-transform ${showSearchDropdown ? 'rotate-180' : ''}`} />
                    </button>

                    {showSearchDropdown && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowSearchDropdown(false)} />
                        <div className="transition-opacity transition-transform absolute left-0 top-full mt-1.5 bg-white border border-gray-100 rounded-xl shadow-xl py-1 z-50 min-w-[130px] fade-in slide-in-from-top-1 duration-200">
                          {([
                            { key: 'todos', label: 'Todos' },
                            { key: 'nombre', label: 'Nombre' },
                            { key: 'id', label: 'Cédula / RIF' },
                            { key: 'codigo', label: 'Código' },
                          ] as const).map(option => (
                            <button
                              key={option.key}
                              type="button"
                              onClick={() => {
                                setFilters((f) => ({ ...f, searchField: option.key }))
                                setShowSearchDropdown(false)
                              }}
                              className={`w-full text-left px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer ${(filters.searchField || 'todos') === option.key ? 'bg-emerald-50 text-emerald-600' : 'text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  <div className="relative flex-grow h-full flex items-center">
                    <Search className="absolute left-3 text-slate-400" size={13} />
                    <input
                      type="text"
                      value={filters.search}
                      onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                      placeholder={`Buscar por ${filters.searchField === 'nombre' ? 'nombre o representante...' :
                          filters.searchField === 'id' ? 'cédula o RIF...' :
                            filters.searchField === 'codigo' ? 'código de afiliado...' :
                              'nombre, cédula, RIF, email o código...'
                        }`}
                      className="w-full h-full pl-8 pr-9 bg-transparent text-xs font-semibold placeholder-slate-400 outline-none text-slate-700"
                    />
                    {filters.search && (
                      <button
                        type="button"
                        onClick={() => setFilters((f) => ({ ...f, search: '' }))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center hover:bg-slate-300 transition-colors cursor-pointer"
                      >
                        <X size={10} />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Grid 2 Columnas para Selects principales */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Tipo Afiliado */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-1.5">
                    <UserCheck size={12} className="text-emerald-600" /> Tipo de Afiliado
                  </label>
                  <select
                    value={filters.tipo}
                    onChange={(e) =>
                      setFilters((f) => ({ ...f, tipo: e.target.value as ExportTipoFilter }))
                    }
                    className="w-full rounded-2xl border border-gray-200 px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-50/50 outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-colors cursor-pointer"
                  >
                    <option value="Todos">Todos los tipos</option>
                    <option value="Natural">Agente Independiente</option>
                    <option value="Corporativo">Empresa Corporativa</option>
                    <option value="Agente Corporativo">Agente Corporativo</option>
                  </select>
                </div>

                {/* Estatus */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-1.5">
                    <Filter size={12} className="text-emerald-600" /> Estatus del Proceso
                  </label>
                  <select
                    value={filters.estatus}
                    onChange={(e) =>
                      setFilters((f) => ({
                        ...f,
                        estatus: e.target.value as ExportEstatusFilter,
                      }))
                    }
                    className="w-full rounded-2xl border border-gray-200 px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-50/50 outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-colors cursor-pointer"
                  >
                    <option value="Todos">Todos los estados</option>
                    <optgroup label="Proceso de Afiliación">
                      <option value="1_PREINSCRIPCION">1. Preinscripción</option>
                      <option value="2_EXPEDIENTE">2. Expediente</option>
                      <option value="3_ENTREVISTA">3. Entrevista</option>
                      <option value="4_VERIFICACION">4. Verificación</option>
                      <option value="5_CIBIR">5. CIBIR</option>
                      <option value="6_INSCRIPCION">6. Inscripción</option>
                    </optgroup>
                    <optgroup label="Estados Finales">
                      <option value="Afiliado">Afiliado</option>
                      <option value="Moroso">Moroso</option>
                      <option value="Suspendido">Suspendido</option>
                      <option value="Rechazado">Rechazado</option>
                    </optgroup>
                  </select>
                </div>
              </div>

              {/* Grid 2 Columnas para Filtro Activo y Desde Código */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Activo / Inactivo */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                    Condición Activo / Inactivo
                  </label>
                  <select
                    value={filters.activo}
                    onChange={(e) =>
                      setFilters((f) => ({
                        ...f,
                        activo: e.target.value as ExportActivoFilter,
                      }))
                    }
                    className="w-full rounded-2xl border border-gray-200 px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-50/50 outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-colors cursor-pointer"
                  >
                    <option value="todos">Todos (Activos e Inactivos)</option>
                    <option value="activos">Solo Afiliados Activos</option>
                    <option value="inactivos">Solo Afiliados Inactivos</option>
                  </select>
                </div>

                {/* Desde Código determinado */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-1.5">
                    <Hash size={12} className="text-emerald-600" /> Desde Código Numérico
                  </label>
                  <input
                    type="number"
                    placeholder="Ej: 100 (opcional)"
                    value={filters.desdeCodigo}
                    onChange={(e) => setFilters((f) => ({ ...f, desdeCodigo: e.target.value }))}
                    className="w-full rounded-2xl border border-gray-200 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-50/50 outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              {/* Rango de Fechas de Registro */}
              <div className="space-y-1.5 pt-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-1.5">
                  <Calendar size={12} className="text-emerald-600" /> Rango por Fecha de Registro
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="date"
                    value={filters.fechaDesde}
                    onChange={(e) => setFilters((f) => ({ ...f, fechaDesde: e.target.value }))}
                    className="w-full rounded-2xl border border-gray-200 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-50/50 outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-colors"
                  />
                  <input
                    type="date"
                    value={filters.fechaHasta}
                    onChange={(e) => setFilters((f) => ({ ...f, fechaHasta: e.target.value }))}
                    className="w-full rounded-2xl border border-gray-200 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-50/50 outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                  Seleccione las columnas a incluir en el PDF
                </span>
              </div>

              {/* Contenedor exclusivo con scrollbar sutil para la sección de columnas */}
              <div className="max-h-[350px] overflow-y-auto pr-1 space-y-2.5 custom-scrollbar">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {AFILIADOS_EXPORT_COLUMNS.map((col) => {
                    const isChecked = selectedColumns.includes(col.id)
                    return (
                      <div
                        key={col.id}
                        onClick={() => toggleColumn(col.id)}
                        className={`flex items-center justify-between p-3 rounded-2xl border transition-colors cursor-pointer select-none ${isChecked
                            ? 'border-emerald-500/40 bg-emerald-50/60 shadow-sm'
                            : 'border-gray-100 bg-white hover:bg-slate-50'
                          }`}
                      >
                        <span className={`text-xs font-bold ${isChecked ? 'text-emerald-950 font-black' : 'text-slate-700'}`}>
                          {col.label}
                        </span>
                        <div
                          className={`w-5 h-5 rounded-lg flex items-center justify-center transition-colors ${isChecked ? 'bg-emerald-600 text-white' : 'border border-gray-300 bg-slate-50'
                            }`}
                        >
                          {isChecked && <Check size={12} strokeWidth={3} />}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="transition-opacity text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-2xl p-3 fade-in">
              {error}
            </div>
          )}
        </div>

        {/* Footer estático con acciones */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 bg-slate-50/80 border-t border-gray-100 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-2xl border border-gray-200 text-xs font-bold text-slate-600 hover:bg-white transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleExport}
            disabled={
              exporting ||
              previewLoading ||
              selectedColumns.length === 0 ||
              filteredRows.length === 0
            }
            className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-2xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors transition-opacity cursor-pointer"
          >
            {exporting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Generando PDF...
              </>
            ) : (
              <>
                <FileDown size={16} />
                Descargar Reporte
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
