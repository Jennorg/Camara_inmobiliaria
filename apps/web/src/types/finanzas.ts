export type TxType = 'ingreso' | 'egreso'
export type TxStatus = 'completado' | 'pendiente' | 'anulado'

export type TxCategory =
  | 'afiliacion'
  | 'curso'
  | 'convenio'
  | 'servicio'
  | 'alquiler'
  | 'servicios_publicos'
  | 'nomina'
  | 'honorarios'
  | 'papeleria'
  | 'mantenimiento'
  | 'impuestos'
  | 'donacion'
  | 'gasto_operativo'
  | 'gasto_admin'
  | 'otro'

export interface MovimientoFinancieroDTO {
  id_movimiento: number
  tipo: TxType
  categoria: TxCategory
  fecha: string
  concepto: string
  proveedor_cliente: string
  rif_cedula?: string | null
  nro_factura_documento?: string | null
  nro_control_fiscal?: string | null
  base_imponible: number
  monto_exento: number
  alicuota_iva: number
  monto_iva: number
  monto_total: number
  monto_usd_equivalente: number
  moneda: 'USD' | 'VES'
  tasa_bcv?: number | null
  metodo_pago: string
  referencia_pago?: string | null
  banco_origen?: string | null
  comprobante_url?: string | null
  estatus: TxStatus
  id_pago?: number | null
  id_afiliado?: number | null
  id_curso?: number | null
  motivo_anulacion?: string | null
  notas?: string | null
  creado_en?: string
}

export interface LibroVentaItemDTO {
  id: string
  id_pago: number | null
  tipo_origen: 'pago_recibo' | 'movimiento_manual'
  fecha: string
  documento: string
  nro_control?: string | null
  cliente: string
  rif_cedula: string
  concepto: string
  categoria: string
  metodo_pago: string
  moneda: string
  monto_original: number
  monto_usd: number
  tasa_bcv: number
  base_imponible: number
  monto_exento: number
  alicuota_iva: number
  monto_iva: number
  referencia?: string | null
}

export interface LibroCompraItemDTO {
  id_movimiento: number
  fecha: string
  nro_factura_documento: string
  nro_control_fiscal?: string | null
  proveedor: string
  rif_cedula: string
  concepto: string
  categoria: string
  base_imponible: number
  monto_exento: number
  alicuota_iva: number
  monto_iva: number
  monto_total: number
  monto_usd_equivalente: number
  moneda: string
  tasa_bcv: number
  metodo_pago: string
  referencia_pago?: string | null
  comprobante_url?: string | null
  estatus: string
  notas?: string | null
  creado_en: string
}

export interface ResumenFinancieroDTO {
  periodo: {
    anio: number
    mes: number | null
    fechaInicio: string | null
    fechaFin: string | null
  }
  kpis: {
    totalIngresosUSD: number
    totalEgresosUSD: number
    flujoNetoUSD: number
    ivaDebitoFiscal: number
    ivaCreditoFiscal: number
    totalBaseCompras: number
    totalExentoCompras: number
    conteoIngresos: number
    conteoEgresos: number
  }
  historicoMensual: {
    mesNumero: number
    mes: string
    ingresos: number
    egresos: number
    neto: number
  }[]
  gastosPorCategoria: {
    categoria: string
    total: number
    cantidad: number
  }[]
}

export interface FiltrosFinanzasDTO {
  anio: number
  mes?: number | null
  fechaInicio?: string
  fechaFin?: string
  search?: string
  categoria?: string
}
