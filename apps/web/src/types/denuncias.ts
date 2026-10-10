export type TipoDenunciante = 'afiliado' | 'no_afiliado'

export type TipoFalta =
  | 'incumplimiento_contrato'
  | 'comisiones_indebidas'
  | 'publicidad_enganosa'
  | 'falta_etica'
  | 'retencion_documentos'
  | 'fraude_estafa'
  | 'otro'

export type EstatusDenuncia =
  | 'recibida'
  | 'en_revision'
  | 'en_descargos'
  | 'en_mediacion'
  | 'resuelta'
  | 'desestimada'
  | 'archivada'

export type TipoResolucion =
  | 'conciliacion_acuerdo'
  | 'amonestacion_privada'
  | 'amonestacion_publica'
  | 'suspension_temporal'
  | 'expulsion_definitiva'
  | 'desestimacion_sin_lugar'
  | 'otro'

export type PrioridadDenuncia = 'baja' | 'media' | 'alta' | 'urgente'

export interface DocumentoDenunciaDTO {
  id_documento_denuncia: number
  id_denuncia: number
  tipo_origen: 'denunciante' | 'denunciado' | 'camara_resolucion'
  nombre_archivo: string
  url: string
  creado_en: string
}

export interface HistorialDenunciaDTO {
  id_historial: number
  id_denuncia: number
  estatus_anterior: string | null
  estatus_nuevo: string
  accion: string
  comentario: string | null
  es_visible_partes: number
  usuario_id?: number | null
  usuario_email?: string | null
  usuario_rol?: string | null
  fecha: string
}

export interface DenunciaDTO {
  id_denuncia: number
  codigo: string
  pin_seguimiento: string
  tipo_denunciante: TipoDenunciante
  id_afiliado_denunciante?: number | null
  id_user_denunciante?: number | null
  nombre_denunciante: string
  cedula_rif_denunciante: string
  email_denunciante: string
  telefono_denunciante: string
  direccion_denunciante?: string | null
  id_afiliado_denunciado: number
  nombre_denunciado: string
  codigo_afiliado_denunciado?: string | null
  denunciado_tipo_persona?: 'Natural' | 'Juridica'
  denunciado_estatus_afiliado?: string
  denunciado_email_persona?: string | null
  denunciado_telefono_persona?: string | null
  denunciado_email_empresa?: string | null
  denunciado_telefono_empresa?: string | null
  denunciado_rif_empresa?: string | null
  tipo_falta: TipoFalta
  titulo: string
  descripcion_hechos: string
  inmueble_referencia?: string | null
  monto_involucrado: number
  moneda_monto: 'USD' | 'VES'
  prioridad: PrioridadDenuncia
  estatus: EstatusDenuncia
  fecha_presentacion: string
  fecha_admisibilidad?: string | null
  fecha_audiencia_mediacion?: string | null
  lugar_modalidad_audiencia?: string | null
  descargo_afiliado?: string | null
  fecha_descargo?: string | null
  tipo_resolucion?: TipoResolucion | null
  dictamen_resolucion?: string | null
  acta_resolucion_url?: string | null
  resuelto_por?: number | null
  resuelto_por_email?: string | null
  fecha_resolucion?: string | null
  notas_internas?: string | null
  total_archivos?: number
  documentos?: DocumentoDenunciaDTO[]
  historial?: HistorialDenunciaDTO[]
}

export interface DenunciasKpisDTO {
  total: number
  recibidas: number
  enRevision: number
  enMediacion: number
  resueltas: number
  desestimadas: number
}
