import { AfiliadoDTO, EstatusAfiliado } from '@/types/afiliados'
import { formatCedula, formatRif } from '@/utils/formatters'

export type ExportColumnId =
  | 'conteo'
  | 'codigo'
  | 'nombre_completo'
  | 'nombres'
  | 'apellidos'
  | 'tipo_afiliado'
  | 'cedula'
  | 'rif'
  | 'estatus'
  | 'email'
  | 'telefono'
  | 'empresa'
  | 'profesion'
  | 'nivel_academico'
  | 'fecha_registro'
  | 'activo'
  | 'direccion'

export interface ExportColumnDef {
  id: ExportColumnId
  label: string
  defaultSelected: boolean
  getValue: (a: AfiliadoDTO) => string
}

export function getTipoAfiliadoLabel(tipo: AfiliadoDTO['tipo_afiliado']): string {
  if (tipo === 'Corporativo') return 'Corporativo'
  if (tipo === 'Agente' || tipo === 'Agente Corporativo') return 'Agente Corporativo'
  return 'Agente Independiente'
}

export function formatEstatusLabel(estatus: EstatusAfiliado | string): string {
  const map: Record<string, string> = {
    '1_PREINSCRIPCION': '1. Preinscripción',
    '2_EXPEDIENTE': '2. Expediente',
    '3_ENTREVISTA': '3. Entrevista',
    '4_VERIFICACION': '4. Verificación',
    '5_CIBIR': '5. CIBIR',
    '6_INSCRIPCION': '6. Inscripción',
    Afiliado: 'Afiliado',
    Moroso: 'Moroso',
    Suspendido: 'Suspendido',
    Rechazado: 'Rechazado',
    'Requiere Acción': 'Requiere Acción',
  }
  return map[estatus] ?? estatus.replace(/_/g, ' ')
}

/** Obtiene exclusivamente la cédula de identidad personal formateada (ej: V-12.345.678) */
function getCedulaPersonal(a: AfiliadoDTO): string {
  const raw = a.cedula || a.cedula_personal
  return formatCedula(raw)
}

/** Obtiene el RIF de la empresa en afiliados corporativos */
function getRifEmpresa(a: AfiliadoDTO): string {
  if (a.empresa_rif_numero) {
    return formatRif(a.empresa_rif_tipo || 'J', a.empresa_rif_numero)
  }
  return '—'
}

export const AFILIADOS_EXPORT_COLUMNS: ExportColumnDef[] = [
  {
    id: 'conteo',
    label: '#',
    defaultSelected: true,
    getValue: () => '',
  },
  {
    id: 'codigo',
    label: 'Código de Afiliado',
    defaultSelected: true,
    getValue: (a) => a.codigo || '—',
  },
  {
    id: 'nombre_completo',
    label: 'Nombre completo',
    defaultSelected: true,
    getValue: (a) => {
      if (a.tipo_afiliado === 'Corporativo') {
        return a.empresa_razon_social || a.nombre_completo || `${a.nombres || ''} ${a.apellidos || ''}`.trim() || '—'
      }
      return a.nombre_completo || `${a.nombres || ''} ${a.apellidos || ''}`.trim() || '—'
    },
  },
  {
    id: 'nombres',
    label: 'Nombre',
    defaultSelected: false,
    getValue: (a) => {
      if (a.nombres && a.nombres.trim()) return a.nombres.trim()
      if (a.tipo_afiliado === 'Corporativo' && a.representante_nombre) {
        const parts = a.representante_nombre.trim().split(' ')
        return parts[0] || '—'
      }
      return '—'
    },
  },
  {
    id: 'apellidos',
    label: 'Apellido',
    defaultSelected: false,
    getValue: (a) => {
      if (a.apellidos && a.apellidos.trim()) return a.apellidos.trim()
      if (a.tipo_afiliado === 'Corporativo' && a.representante_nombre) {
        const parts = a.representante_nombre.trim().split(' ')
        return parts.slice(1).join(' ') || '—'
      }
      return '—'
    },
  },
  {
    id: 'tipo_afiliado',
    label: 'Tipo de afiliado',
    defaultSelected: true,
    getValue: (a) => getTipoAfiliadoLabel(a.tipo_afiliado),
  },
  {
    id: 'cedula',
    label: 'C.I.',
    defaultSelected: true,
    getValue: getCedulaPersonal,
  },
  {
    id: 'rif',
    label: 'RIF / Empresa RIF',
    defaultSelected: false,
    getValue: getRifEmpresa,
  },
  {
    id: 'estatus',
    label: 'Estatus',
    defaultSelected: false,
    getValue: (a) => formatEstatusLabel(a.estatus),
  },
  {
    id: 'email',
    label: 'Correo',
    defaultSelected: false,
    getValue: (a) => a.email || a.empresa_email || '—',
  },
  {
    id: 'telefono',
    label: 'Teléfono',
    defaultSelected: false,
    getValue: (a) => a.telefono || a.empresa_telefono || '—',
  },
  {
    id: 'empresa',
    label: 'Empresa',
    defaultSelected: false,
    getValue: (a) => a.empresa_razon_social || '—',
  },
  {
    id: 'profesion',
    label: 'Profesión',
    defaultSelected: false,
    getValue: (a) => a.profesion || '—',
  },
  {
    id: 'nivel_academico',
    label: 'Nivel académico',
    defaultSelected: false,
    getValue: (a) => a.nivel_academico || '—',
  },
  {
    id: 'fecha_registro',
    label: 'Fecha de registro',
    defaultSelected: false,
    getValue: (a) =>
      a.fecha_registro
        ? new Date(a.fecha_registro).toLocaleDateString('es-VE', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })
        : '—',
  },
  {
    id: 'activo',
    label: 'Activo',
    defaultSelected: false,
    getValue: (a) => (a.activo ? 'Sí' : 'No'),
  },
  {
    id: 'direccion',
    label: 'Dirección',
    defaultSelected: false,
    getValue: (a) => a.direccion || '—',
  },
]

export const DEFAULT_SELECTED_COLUMNS: ExportColumnId[] = AFILIADOS_EXPORT_COLUMNS.filter(
  (c) => c.defaultSelected
).map((c) => c.id)
