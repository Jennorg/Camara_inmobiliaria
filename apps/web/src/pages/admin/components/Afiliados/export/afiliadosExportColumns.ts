import { AfiliadoDTO, EstatusAfiliado } from '@/types/afiliados'
import { formatRif } from '@/utils/formatters'

export type ExportColumnId =
  | 'conteo'
  | 'codigo'
  | 'nombre_completo'
  | 'tipo_afiliado'
  | 'cedula'
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

function getIdentificacion(a: AfiliadoDTO): string {
  if (a.tipo_afiliado === 'Corporativo' && a.empresa_rif_numero) {
    return formatRif(a.empresa_rif_tipo, a.empresa_rif_numero)
  }
  return a.cedula || '—'
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
    getValue: (a) => a.nombre_completo || `${a.nombres} ${a.apellidos}`.trim() || '—',
  },
  {
    id: 'tipo_afiliado',
    label: 'Tipo de afiliado',
    defaultSelected: true,
    getValue: (a) => getTipoAfiliadoLabel(a.tipo_afiliado),
  },
  {
    id: 'cedula',
    label: 'Cédula / RIF',
    defaultSelected: true,
    getValue: getIdentificacion,
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
