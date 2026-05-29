import { AfiliadoDTO, EstatusAfiliado } from '@/types/afiliados'

export type ExportTipoFilter = 'Todos' | 'Natural' | 'Corporativo' | 'Agente Corporativo'
export type ExportActivoFilter = 'todos' | 'activos' | 'inactivos'
export type ExportEstatusFilter = 'Todos' | EstatusAfiliado

export interface ExportRowFilters {
  tipo: ExportTipoFilter
  estatus: ExportEstatusFilter
  activo: ExportActivoFilter
  search: string
  desdeCodigo: string
  fechaDesde: string
  fechaHasta: string
}

export function matchesTipoFilter(
  item: AfiliadoDTO,
  tipo: ExportTipoFilter
): boolean {
  if (tipo === 'Todos') return true
  if (tipo === 'Agente Corporativo') {
    return item.tipo_afiliado === 'Agente' || item.tipo_afiliado === 'Agente Corporativo'
  }
  return item.tipo_afiliado === tipo
}

export function filterAfiliadosForExport(
  items: AfiliadoDTO[],
  filters: ExportRowFilters
): AfiliadoDTO[] {
  const s = filters.search.trim().toLowerCase()
  const desdeCodigo = parseInt(filters.desdeCodigo)

  return items.filter((item) => {
    if (!matchesTipoFilter(item, filters.tipo)) return false
    if (filters.estatus !== 'Todos' && item.estatus !== filters.estatus) return false
    if (filters.activo === 'activos' && !item.activo) return false
    if (filters.activo === 'inactivos' && item.activo) return false

    // Filtro por Código CIBIR desde
    if (!isNaN(desdeCodigo) && item.codigo_cibir) {
      const codigoItem = parseInt(item.codigo_cibir)
      if (!isNaN(codigoItem) && codigoItem < desdeCodigo) return false
    }

    // Filtro por Rango de Fechas (fecha_registro)
    if (filters.fechaDesde || filters.fechaHasta) {
      const fechaItem = item.fecha_registro ? new Date(item.fecha_registro) : null
      if (fechaItem) {
        if (filters.fechaDesde) {
          const d = new Date(filters.fechaDesde)
          d.setHours(0, 0, 0, 0)
          if (fechaItem < d) return false
        }
        if (filters.fechaHasta) {
          const h = new Date(filters.fechaHasta)
          h.setHours(23, 59, 59, 999)
          if (fechaItem > h) return false
        }
      } else if (filters.fechaDesde || filters.fechaHasta) {
        // Si tiene filtro de fecha pero el item no tiene fecha, lo excluimos
        return false
      }
    }

    if (s) {
      const nombre = (item.nombre_completo || '').toLowerCase()
      const cedula = (item.cedula || '').toLowerCase()
      const rif = (item.empresa_rif_numero || '').toLowerCase()
      const email = (item.email || '').toLowerCase()
      const codigo = (item.codigo_cibir || '').toLowerCase()
      const match =
        nombre.includes(s) ||
        cedula.includes(s) ||
        rif.includes(s) ||
        email.includes(s) ||
        codigo.includes(s)
      if (!match) return false
    }

    return true
  })
}

export function describeExportFilters(filters: ExportRowFilters): string[] {
  const lines: string[] = []

  lines.push(
    `Tipo: ${
      filters.tipo === 'Todos'
        ? 'Todos'
        : filters.tipo === 'Natural'
          ? 'Independientes'
          : filters.tipo === 'Corporativo'
            ? 'Corporativos'
            : 'Agentes corporativos'
    }`
  )

  lines.push(
    `Estatus: ${filters.estatus === 'Todos' ? 'Todos' : filters.estatus.replace(/_/g, ' ')}`
  )

  lines.push(
    `Activo: ${
      filters.activo === 'todos'
        ? 'Todos'
        : filters.activo === 'activos'
          ? 'Solo activos'
          : 'Solo inactivos'
    }`
  )

  if (filters.desdeCodigo) {
    lines.push(`Desde código: ${filters.desdeCodigo}`)
  }

  if (filters.fechaDesde && filters.fechaHasta) {
    lines.push(`Periodo: ${filters.fechaDesde} al ${filters.fechaHasta}`)
  } else if (filters.fechaDesde) {
    lines.push(`Desde fecha: ${filters.fechaDesde}`)
  } else if (filters.fechaHasta) {
    lines.push(`Hasta fecha: ${filters.fechaHasta}`)
  }

  if (filters.search.trim()) {
    lines.push(`Búsqueda: "${filters.search.trim()}"`)
  }

  return lines
}
