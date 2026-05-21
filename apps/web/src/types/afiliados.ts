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
  codigo_cibir?: string | null;
  tipo_afiliado: 'Natural' | 'Corporativo' | 'Agente' | 'Agente Corporativo';
  estatus: EstatusAfiliado;
  cibir_convalidado: number;
  inscripcion_pagada: number;
  notas?: string | null;
  redes_sociales?: Record<string, any> | null;
  fecha_registro: string;
  fecha_ultimo_cambio_estatus?: string | null;
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
  codigo_cibir: string | null;
  tipo_afiliado: 'Natural' | 'Corporativo' | 'Agente' | 'Agente Corporativo';
  estatus: EstatusAfiliado;
  cibir_convalidado: number;
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

  // ── empresas (si id_empresa no es null) ──
  empresa_razon_social: string | null;
  empresa_rif_tipo: string | null;
  empresa_rif_numero: string | null;
  empresa_logo_url: string | null;
  empresa_website: string | null;
  empresa_email: string | null;
  empresa_telefono: string | null;

  // ── Campos calculados o DTO específicos ──
  nombre_completo?: string;
  representante_nombre?: string;
  instagram?: string;
  facebook?: string;
  linkedin?: string;
  cedula_personal?: string; // Para compatibilidad con lógica de representantes
  foto_url?: string;
  fecha_inicio_servicio?: string;
  razon_social?: string;
  direccion_publica?: string | null;
  descripcion?: string | null;
  website?: string;
  twitter?: string;
  documentos?: any[]; // Added to support admin panel document list
}

export interface AfiliadoCompleto {
  afiliado: Afiliado;
  persona: Persona;
  empresa?: Empresa | null;
}
