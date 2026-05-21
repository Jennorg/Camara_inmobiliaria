import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { X, FileDown, Loader2 } from 'lucide-react'
import { API_URL } from '@/config/env'
import { AfiliadoDTO, EstatusAfiliado } from '@/types/afiliados'
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
  const [filters, setFilters] = useState<ExportRowFilters>({
    tipo: initialFilters?.tipo ?? 'Todos',
    estatus: initialFilters?.estatus ?? 'Todos',
    activo: initialFilters?.activo ?? 'todos',
    search: initialFilters?.search ?? '',
  })
  const [selectedColumns, setSelectedColumns] = useState<ExportColumnId[]>(DEFAULT_SELECTED_COLUMNS)
  const [previewItems, setPreviewItems] = useState<AfiliadoDTO[]>([])
  const [previewLoading, setPreviewLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setFilters({
      tipo: initialFilters?.tipo ?? 'Todos',
      estatus: initialFilters?.estatus ?? 'Todos',
      activo: initialFilters?.activo ?? 'todos',
      search: initialFilters?.search ?? '',
    })
    setSelectedColumns(DEFAULT_SELECTED_COLUMNS)
    setError('')
  }, [open, initialFilters])

  const fetchItems = useCallback(async (): Promise<AfiliadoDTO[]> => {
    const qs = new URLSearchParams()
    if (filters.estatus !== 'Todos') qs.set('estatus', filters.estatus)
    if (filters.tipo !== 'Todos' && filters.tipo !== 'Agente') {
      qs.set('tipo_afiliado', filters.tipo)
    }
    const url = `${API_URL}/api/afiliados${qs.toString() ? `?${qs}` : ''}`
    const res = await fetch(url, { headers: authHeaders })
    const json = await res.json()
    if (!res.ok || !json.success) {
      throw new Error(json.message || 'Error al cargar afiliados')
    }
    return json.data as AfiliadoDTO[]
  }, [authHeaders, filters.estatus, filters.tipo])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setPreviewLoading(true)
    fetchItems()
      .then((data) => {
        if (!cancelled) setPreviewItems(data)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError((e as Error).message || 'Error al cargar datos')
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false)
      })
    return () => {
      cancelled = true
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

  const handleExport = async () => {
    if (selectedColumns.length === 0 || filteredRows.length === 0) return
    setExporting(true)
    setError('')
    try {
      const data = await fetchItems()
      const rows = filterAfiliadosForExport(data, filters)
      if (rows.length === 0) {
        setError('No hay registros que coincidan con los filtros.')
        return
      }
      await generateAfiliadosPdf({
        rows,
        columnIds: selectedColumns,
        filterSummary: describeExportFilters(filters),
      })
      onClose()
    } catch (e: unknown) {
      setError((e as Error).message || 'Error al generar el PDF')
    } finally {
      setExporting(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col bg-white rounded-2xl shadow-2xl border border-gray-100">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="text-sm font-black text-slate-800">Exportar reporte PDF</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Filtre afiliados y elija las columnas del listado.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <section className="space-y-3">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              Filtros de registros
            </h4>

            <div className="grid grid-cols-1 gap-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Tipo de afiliado
              </label>
              <select
                value={filters.tipo}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, tipo: e.target.value as ExportTipoFilter }))
                }
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50"
              >
                <option value="Todos">Todos</option>
                <option value="Natural">Independientes</option>
                <option value="Corporativo">Corporativos</option>
                <option value="Agente">Agentes corporativos</option>
              </select>
            </div>

            <div className="grid grid-cols-1 gap-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Estatus
              </label>
              <select
                value={filters.estatus}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    estatus: e.target.value as ExportEstatusFilter,
                  }))
                }
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50"
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
                  <option value="Afiliado">Afiliado (CIBIR)</option>
                  <option value="Moroso">Moroso</option>
                  <option value="Suspendido">Suspendido</option>
                  <option value="Rechazado">Rechazado</option>
                </optgroup>
              </select>
            </div>

            <div className="grid grid-cols-1 gap-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Activo
              </label>
              <select
                value={filters.activo}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    activo: e.target.value as ExportActivoFilter,
                  }))
                }
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50"
              >
                <option value="todos">Todos</option>
                <option value="activos">Solo activos</option>
                <option value="inactivos">Solo inactivos</option>
              </select>
            </div>

            <div className="grid grid-cols-1 gap-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Búsqueda
              </label>
              <input
                type="text"
                placeholder="Nombre, cédula, RIF, email o código..."
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs text-slate-700 bg-slate-50 outline-none focus:border-emerald-500"
              />
            </div>

            <p className="text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-xl px-3 py-2">
              {previewLoading
                ? 'Calculando registros...'
                : `${filteredRows.length} registro${filteredRows.length === 1 ? '' : 's'} incluido${filteredRows.length === 1 ? '' : 's'}`}
            </p>
          </section>

          <section className="space-y-3">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              Columnas del PDF
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {AFILIADOS_EXPORT_COLUMNS.map((col) => (
                <label
                  key={col.id}
                  className="flex items-center gap-2 p-2 rounded-lg border border-gray-100 hover:bg-slate-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedColumns.includes(col.id)}
                    onChange={() => toggleColumn(col.id)}
                    className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-[11px] font-medium text-slate-700">{col.label}</span>
                </label>
              ))}
            </div>
          </section>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>
          )}
        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-gray-100 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
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
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {exporting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Generando...
              </>
            ) : (
              <>
                <FileDown size={14} />
                Descargar PDF
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
