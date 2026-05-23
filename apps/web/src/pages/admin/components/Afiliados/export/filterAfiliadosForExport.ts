import { AfiliadoDTO, EstatusAfiliado } from '@/types/afiliados'

export type ExportTipoFilter = 'Todos' | 'Natural' | 'Corporativo' | 'Agente Corporativo'
export type ExportActivoFilter = 'todos' | 'activos' | 'inactivos'
export type ExportEstatusFilter = 'Todos' | EstatusAfiliado

export interface ExportRowFilters {
  tipo: ExportTipoFilter
  estatus: ExportEstatusFilter
  activo: ExportActivoFilter
  search: string
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

  return items.filter((item) => {
    if (!matchesTipoFilter(item, filters.tipo)) return false
    if (filters.estatus !== 'Todos' && item.estatus !== filters.estatus) return false
    if (filters.activo === 'activos' && !item.activo) return false
    if (filters.activo === 'inactivos' && item.activo) return false

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

  if (filters.search.trim()) {
    lines.push(`Búsqueda: "${filters.search.trim()}"`)
  }

  return lines
}
