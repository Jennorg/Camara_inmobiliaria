export interface TasaInfoDTO {
  codigo: 'USD_BCV' | 'USDT_BINANCE';
  nombre: string;
  tasa: number;
  moneda_origen: string;
  moneda_destino: string;
  fuente: string;
  fecha_actualizacion: string;
  es_manual: boolean;
  detalles?: {
    precio_min?: number;
    precio_max?: number;
    precio_promedio?: number;
    ordenes_evaluadas?: number;
    fuente_oficial?: string;
  };
}

export interface ReferenciasSnapshotDTO {
  tasas: {
    USD_BCV?: TasaInfoDTO;
    USDT_BINANCE?: TasaInfoDTO;
    [key: string]: TasaInfoDTO | undefined;
  };
  spread_porcentaje: number;
  ultima_actualizacion: string;
  tiempo_restante_cache_ms: number;
  ttl_cache_ms: number;
  desde_cache: boolean;
}

export interface HistorialTasaDTO {
  id: number;
  codigo: string;
  tasa: number;
  fuente: string;
  fecha: string;
  creado_en: string;
}
