export type MetodoPago =
  | 'efectivo_usd'
  | 'efectivo_bs'
  | 'pago_movil'
  | 'transferencia_bs'
  | 'zelle'
  | 'pos_debito'
  | 'binance_usdt'
  | 'otro';

export type TipoConceptoPago =
  | 'formalizacion_afiliacion'
  | 'curso_cibir'
  | 'mensualidad'
  | 'curso'
  | 'programa'
  | 'otro';

export type EstatusPago = 'Pendiente' | 'Verificado' | 'Rechazado' | 'Anulado';

export interface PagoDTO {
  id_pago: number;
  numero_recibo: string;
  id_afiliado: number | null;
  id_estudiante?: number | null;
  id_inscripcion_curso?: number | null;
  id_edicion_cibir?: number | null;
  tipo_concepto: TipoConceptoPago;
  descripcion_concepto: string;
  metodo_pago: MetodoPago;
  moneda: 'USD' | 'VES';
  monto: number;
  monto_usd_equivalente: number;
  tasa_bcv?: number | null;
  banco_origen?: string | null;
  banco_destino?: string | null;
  referencia?: string | null;
  titular_origen?: string | null;
  telefono_origen?: string | null;
  comprobante_url?: string | null;
  estatus: EstatusPago;
  origen_registro: 'afiliado' | 'admin';
  registrado_por?: number | null;
  verificado_por?: number | null;
  fecha_pago: string;
  fecha_verificacion?: string | null;
  motivo_rechazo?: string | null;
  notas?: string | null;
  creado_en: string;
  actualizado_en?: string | null;
  // Joins
  pagador_nombre?: string;
  pagador_identificacion?: string;
  pagador_email?: string;
  pagador_telefono?: string;
  afiliado_codigo?: string;
  tipo_afiliado?: string;
  afiliado_estatus?: string;
  admin_verificador_email?: string;
}

export type TipoCuenta = 'pago_movil' | 'transferencia' | 'transferencia_usd' | 'zelle' | 'binance' | 'efectivo' | 'otro';

export const ETIQUETA_TIPO_CUENTA: Record<TipoCuenta, string> = {
  pago_movil: 'Pago móvil (Bs.)',
  transferencia: 'Transferencia (Bs.)',
  transferencia_usd: 'Transferencia (USD)',
  zelle: 'Zelle (USD)',
  binance: 'Binance (USDT)',
  efectivo: 'Efectivo',
  otro: 'Otro',
};

export interface CuentaBancariaDTO {
  id_cuenta: number;
  tipo: TipoCuenta;
  banco: string;
  beneficiario: string;
  identificacion: string;
  numero_cuenta?: string | null;
  telefono?: string | null;
  email?: string | null;
  instrucciones?: string | null;
  activo: number;
  orden: number;
}

export interface ArancelDTO {
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  monto_usd: number;
  categoria: 'afiliacion' | 'mensualidad' | 'formacion' | 'servicio';
  activo: number;
}
