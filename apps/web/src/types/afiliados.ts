export type EstatusAfiliado = 
  | '1_PREINSCRIPCION'
  | '2_EXPEDIENTE'
  | '3_ENTREVISTA'
  | '4_VERIFICACION'
  | '5_CIBIR'
  | '6_INSCRIPCION'
  | 'Requiere Acción'
  | 'Afiliado'
  | 'Moroso'
  | 'Suspendido'
  | 'Rechazado';

export interface Persona {
  id: number;
  nombres: string;
  apellidos: string;
  cedula: string;
  email: string;
  telefono?: string | null;
  fecha_nacimiento?: string | null;
  direccion?: string | null;
  nivel_academico?: string | null;
  profesion?: string | null;
  anos_servicio?: number | null;
  ano_inicio_servicio?: number | null;
  creado_en?: string;
  actualizado_en?: string | null;
  eliminado_en?: string | null;
}

export interface Empresa {
  id_empresa: number;
  id_user?: number | null;
  razon_social: string;
  rif_tipo: string;
  rif_numero: string;
  email: string;
  telefono?: string | null;
  direccion?: string | null;
  website?: string | null;
  logo_url?: string | null;
  banner_url?: string | null;
  estatus: string;
  id_representante_legal?: number | null;
  fecha_registro?: string;
  actualizado_en?: string | null;
  eliminado_en?: string | null;
}

export interface Afiliado {
  id_afiliado: number;
  id_persona: number;
  id_empresa?: number | null;
  id_user?: number | null;
  codigo?: string | null;
  tipo_afiliado: 'Natural' | 'Corporativo' | 'Agente' | 'Agente Corporativo';
  estatus: EstatusAfiliado;
  cibir_convalidado: number;
  inscripcion_pagada: number;
  notas?: string | null;
  redes_sociales?: Record<string, any> | null;
  fecha_registro: string;
  fecha_ultimo_cambio_estatus?: string | null;
  fecha_afiliacion?: string | null;
  anos_servicio?: number | null;
  ano_inicio_servicio?: number | null;
  activo: number;
  actualizado_en?: string | null;
  eliminado_en?: string | null;
}

/**
 * Data Transfer Object (DTO) for UI components.
 * Flat structure that maps exactly to the database columns (Persona + Afiliado + Empresa).
 */
export interface AfiliadoDTO {
  // ── afiliados ──
  id_afiliado: number;
  id_persona: number;
  id_empresa: number | null;
  id_user: number | null;
  codigo: string | null;
  tipo_afiliado: 'Natural' | 'Corporativo' | 'Agente' | 'Agente Corporativo';
  estatus: EstatusAfiliado;
  cibir_convalidado: number;
  cibir_acreditado?: number;
  inscripcion_pagada: number;
  notas: string | null;
  redes_sociales: Record<string, any> | null;
  fecha_registro: string;
  fecha_ultimo_cambio_estatus: string | null;
  activo: number;

  // ── personas (datos planos) ──
  nombres: string;
  apellidos: string;
  cedula: string;
  email: string;
  telefono: string | null;
  fecha_nacimiento: string | null;
  direccion: string | null;
  nivel_academico: string | null;
  profesion: string | null;
  anos_servicio: number | null;
  ano_inicio_servicio: number | null;

  // ── empresas (si id_empresa no es null) ──
  empresa_razon_social: string | null;
  empresa_rif_tipo: string | null;
  empresa_rif_numero: string | null;
  empresa_logo_url: string | null;
  empresa_website: string | null;
  empresa_email: string | null;
  empresa_telefono: string | null;
  empresa_codigo?: string | null;

  // ── Campos calculados o DTO específicos ──
  nombre_completo?: string;
  representante_nombre?: string;
  instagram?: string;
  facebook?: string;
  linkedin?: string;
  cedula_personal?: string; // Para compatibilidad con lógica de representantes
  foto_url?: string | null;
  foto_junta_url?: string | null;
  fecha_inicio_servicio?: string;
  fecha_afiliacion?: string | null;
  razon_social?: string;
  direccion_publica?: string | null;
  descripcion?: string | null;
  website?: string;
  twitter?: string;
  tiktok?: string;
  documentos?: any[]; // Added to support admin panel document list
  cedula_tipo?: string;
  empresa_direccion?: string | null;
  empresa_instagram?: string | null;
  empresa_facebook?: string | null;
  empresa_linkedin?: string | null;
  empresa_twitter?: string | null;
  empresa_tiktok?: string | null;
}

export interface AfiliadoCompleto {
  afiliado: Afiliado;
  persona: Persona;
  empresa?: Empresa | null;
}
