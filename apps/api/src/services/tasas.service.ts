import { db } from '../lib/db.js';

export interface TasaInfo {
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

export interface ReferenciasSnapshot {
  tasas: Record<string, TasaInfo>;
  spread_porcentaje: number;
  ultima_actualizacion: string;
  tiempo_restante_cache_ms: number;
  ttl_cache_ms: number;
  desde_cache: boolean;
}

// ── REGLA CRÍTICA: 35 MINUTOS EXACTOS ENTRE CONSULTAS EXTERNAS ──
export const CACHE_TTL_MS = 35 * 60 * 1000; // 35 minutos (2.100.000 ms)

let memoryCache: {
  timestamp: number;
  data: Record<string, TasaInfo>;
} | null = null;

/**
 * Obtiene el precio del dólar oficial reportado por el BCV vía API
 */
async function fetchTasaBCV(): Promise<{ tasa: number; fecha: string; fuente: string }> {
  try {
    const res = await fetch('https://ve.dolarapi.com/v1/dolares/oficial', {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json() as any;
    const promedio = parseFloat(data?.promedio);
    if (!promedio || isNaN(promedio) || promedio <= 0) {
      throw new Error('Tasa BCV inválida recibida');
    }
    return {
      tasa: promedio,
      fecha: data?.fechaActualizacion || new Date().toISOString(),
      fuente: 'BCV Oficial (DolarApi)'
    };
  } catch (err: any) {
    console.warn('[tasas.service] Error consultando BCV en vivo:', err.message);
    throw err;
  }
}

/**
 * Obtiene el precio representativo P2P de USDT en Bolívares en Binance
 */
async function fetchTasaBinanceUSDT(): Promise<{
  tasa: number;
  fecha: string;
  fuente: string;
  detalles: { precio_min: number; precio_max: number; precio_promedio: number; ordenes_evaluadas: number };
}> {
  try {
    const res = await fetch('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      },
      body: JSON.stringify({
        asset: 'USDT',
        fiat: 'VES',
        merchantCheck: false,
        page: 1,
        rows: 10,
        payTypes: [],
        tradeType: 'BUY'
      }),
      signal: AbortSignal.timeout(8000)
    });

    if (!res.ok) throw new Error(`Binance HTTP error ${res.status}`);
    const json = await res.json() as any;
    const advList = Array.isArray(json?.data) ? json.data : [];
    const prices = advList
      .map((item: any) => parseFloat(item.adv?.price))
      .filter((p: number) => !isNaN(p) && p > 0);

    if (prices.length === 0) {
      throw new Error('No se obtuvieron órdenes P2P de USDT/VES');
    }

    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const sum = prices.reduce((acc: number, val: number) => acc + val, 0);
    const avg = Number((sum / prices.length).toFixed(4));

    return {
      tasa: avg,
      fecha: new Date().toISOString(),
      fuente: 'Binance P2P (Mercado En Vivo)',
      detalles: {
        precio_min: min,
        precio_max: max,
        precio_promedio: avg,
        ordenes_evaluadas: prices.length
      }
    };
  } catch (err: any) {
    console.warn('[tasas.service] Error consultando Binance P2P en vivo:', err.message);
    // Intento de fallback a paralelo si Binance falla
    try {
      const resParalelo = await fetch('https://ve.dolarapi.com/v1/dolares/paralelo', {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000)
      });
      if (resParalelo.ok) {
        const parJson = await resParalelo.json() as any;
        const prom = parseFloat(parJson?.promedio);
        if (prom > 0) {
          return {
            tasa: prom,
            fecha: parJson?.fechaActualizacion || new Date().toISOString(),
            fuente: 'Mercado Paralelo (Fallback Cripto)',
            detalles: { precio_min: prom, precio_max: prom, precio_promedio: prom, ordenes_evaluadas: 1 }
          };
        }
      }
    } catch {
      // Ignorar fallback secundario
    }
    throw err;
  }
}

export const tasasService = {
  /**
   * Obtiene las tasas actuales garantizando que no se consulte externamente
   * con mayor frecuencia que la ventana de 35 minutos.
   */
  async getTasas(forceRefresh = false): Promise<ReferenciasSnapshot> {
    const now = Date.now();

    // 1. Verificar si la caché en memoria es válida (< 35 minutos)
    if (!forceRefresh && memoryCache && (now - memoryCache.timestamp) < CACHE_TTL_MS) {
      const timeRemaining = CACHE_TTL_MS - (now - memoryCache.timestamp);
      return this.construirSnapshot(memoryCache.data, timeRemaining, true);
    }

    // 2. Si no es forzado, revisar la última actualización en base de datos
    if (!forceRefresh) {
      try {
        const dbRows = await db.execute(`SELECT * FROM tasas_cambio_referencia`);
        if (dbRows.rows.length >= 2) {
          const fechas = dbRows.rows.map(r => new Date(String(r.actualizado_en || '')).getTime()).filter(t => !isNaN(t));
          const maxFecha = fechas.length > 0 ? Math.max(...fechas) : 0;
          const diff = now - maxFecha;

          if (diff < CACHE_TTL_MS) {
            const map = this.rowsToMap(dbRows.rows);
            memoryCache = { timestamp: maxFecha, data: map };
            return this.construirSnapshot(map, CACHE_TTL_MS - diff, true);
          }
        }
      } catch (err: any) {
        console.warn('[tasas.service] Conexión DB temporalmente inestable al leer tasas, usando respaldo:', err?.message || err);
        if (memoryCache) {
          return this.construirSnapshot(memoryCache.data, CACHE_TTL_MS, true);
        }
      }
    }

    // 3. Si han pasado los 35 minutos o forceRefresh = true, consultar en vivo
    return await this.sincronizarEnVivo();
  },

  /**
   * Ejecuta la sincronización en vivo contra los servicios externos y actualiza la BD
   */
  async sincronizarEnVivo(): Promise<ReferenciasSnapshot> {
    const nowIso = new Date().toISOString();
    const now = Date.now();

    // Cargar lo que hay actualmente en base de datos para no perder tasas manuales si la API falla
    let currentMap: Record<string, TasaInfo> = memoryCache?.data || {};
    try {
      const existingRows = await db.execute(`SELECT * FROM tasas_cambio_referencia`);
      currentMap = this.rowsToMap(existingRows.rows);
    } catch (e: any) {
      console.warn('[tasas.service] DB no disponible para leer tasas previas, usando memoria/defecto:', e.message);
    }

    let bcvResult: { tasa: number; fecha: string; fuente: string } | null = null;
    let binanceResult: {
      tasa: number;
      fecha: string;
      fuente: string;
      detalles: { precio_min: number; precio_max: number; precio_promedio: number; ordenes_evaluadas: number };
    } | null = null;

    // Consultar BCV
    try {
      bcvResult = await fetchTasaBCV();
    } catch (e: any) {
      console.warn('[tasas.service] Usando tasa BCV persistida previa:', e.message);
    }

    // Consultar Binance USDT
    try {
      binanceResult = await fetchTasaBinanceUSDT();
    } catch (e: any) {
      console.warn('[tasas.service] Usando tasa Binance USDT persistida previa:', e.message);
    }

    // Procesar USD BCV
    const bcvTasa = bcvResult?.tasa || currentMap['USD_BCV']?.tasa || 875.65;
    const bcvFuente = bcvResult?.fuente || currentMap['USD_BCV']?.fuente || 'BCV Oficial';
    const bcvFecha = bcvResult?.fecha || currentMap['USD_BCV']?.fecha_actualizacion || nowIso;
    const bcvManual = currentMap['USD_BCV']?.es_manual ? 1 : 0;

    try {
      await db.execute({
        sql: `INSERT INTO tasas_cambio_referencia (
                codigo, nombre, tasa, moneda_origen, moneda_destino, fuente,
                fecha_actualizacion, es_manual, detalles_json, actualizado_en
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(codigo) DO UPDATE SET
                tasa = CASE WHEN excluded.es_manual = 1 THEN tasas_cambio_referencia.tasa ELSE excluded.tasa END,
                fuente = CASE WHEN excluded.es_manual = 1 THEN tasas_cambio_referencia.fuente ELSE excluded.fuente END,
                fecha_actualizacion = excluded.fecha_actualizacion,
                actualizado_en = excluded.actualizado_en`,
        args: [
          'USD_BCV',
          'Dólar Oficial (BCV)',
          bcvTasa,
          'USD',
          'VES',
          bcvFuente,
          bcvFecha,
          bcvManual,
          JSON.stringify({ fuente_oficial: 'Banco Central de Venezuela' }),
          nowIso
        ]
      });

      // Guardar en histórico
      await db.execute({
        sql: `INSERT INTO historial_tasas_cambio (codigo, tasa, fuente, fecha) VALUES (?, ?, ?, ?)`,
        args: ['USD_BCV', bcvTasa, bcvFuente, bcvFecha.slice(0, 10)]
      });
    } catch (dbErr: any) {
      console.warn('[tasas.service] DB no disponible al guardar tasa BCV:', dbErr.message);
    }

    // Procesar USDT Binance
    const usdtTasa = binanceResult?.tasa || currentMap['USDT_BINANCE']?.tasa || 1008.45;
    const usdtFuente = binanceResult?.fuente || currentMap['USDT_BINANCE']?.fuente || 'Binance P2P';
    const usdtFecha = binanceResult?.fecha || currentMap['USDT_BINANCE']?.fecha_actualizacion || nowIso;
    const usdtDetalles = binanceResult?.detalles || currentMap['USDT_BINANCE']?.detalles || {};
    const usdtManual = currentMap['USDT_BINANCE']?.es_manual ? 1 : 0;

    try {
      await db.execute({
        sql: `INSERT INTO tasas_cambio_referencia (
                codigo, nombre, tasa, moneda_origen, moneda_destino, fuente,
                fecha_actualizacion, es_manual, detalles_json, actualizado_en
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(codigo) DO UPDATE SET
                tasa = CASE WHEN excluded.es_manual = 1 THEN tasas_cambio_referencia.tasa ELSE excluded.tasa END,
                fuente = CASE WHEN excluded.es_manual = 1 THEN tasas_cambio_referencia.fuente ELSE excluded.fuente END,
                fecha_actualizacion = excluded.fecha_actualizacion,
                detalles_json = excluded.detalles_json,
                actualizado_en = excluded.actualizado_en`,
        args: [
          'USDT_BINANCE',
          'Cripto USDT (Binance P2P)',
          usdtTasa,
          'USDT',
          'VES',
          usdtFuente,
          usdtFecha,
          usdtManual,
          JSON.stringify(usdtDetalles),
          nowIso
        ]
      });

      // Guardar en histórico
      await db.execute({
        sql: `INSERT INTO historial_tasas_cambio (codigo, tasa, fuente, fecha) VALUES (?, ?, ?, ?)`,
        args: ['USDT_BINANCE', usdtTasa, usdtFuente, usdtFecha.slice(0, 10)]
      });
    } catch (dbErr: any) {
      console.warn('[tasas.service] DB no disponible al guardar tasa USDT:', dbErr.message);
    }

    // Leer registros frescos o construir desde los datos en memoria
    let freshMap: Record<string, TasaInfo>;
    try {
      const freshRows = await db.execute(`SELECT * FROM tasas_cambio_referencia`);
      freshMap = this.rowsToMap(freshRows.rows);
    } catch {
      freshMap = {
        USD_BCV: {
          codigo: 'USD_BCV',
          nombre: 'Dólar Oficial (BCV)',
          tasa: bcvTasa,
          moneda_origen: 'USD',
          moneda_destino: 'VES',
          fuente: bcvFuente,
          fecha_actualizacion: bcvFecha,
          es_manual: bcvManual === 1,
          detalles: { fuente_oficial: 'Banco Central de Venezuela' }
        },
        USDT_BINANCE: {
          codigo: 'USDT_BINANCE',
          nombre: 'Cripto USDT (Binance P2P)',
          tasa: usdtTasa,
          moneda_origen: 'USDT',
          moneda_destino: 'VES',
          fuente: usdtFuente,
          fecha_actualizacion: usdtFecha,
          es_manual: usdtManual === 1,
          detalles: usdtDetalles
        }
      };
    }

    memoryCache = {
      timestamp: now,
      data: freshMap
    };

    return this.construirSnapshot(freshMap, CACHE_TTL_MS, false);
  },

  /**
   * Permite fijar o sobreescribir una tasa manualmente
   */
  async setTasaManual(codigo: 'USD_BCV' | 'USDT_BINANCE', nuevaTasa: number): Promise<TasaInfo> {
    if (!nuevaTasa || isNaN(nuevaTasa) || nuevaTasa <= 0) {
      throw new Error('La tasa debe ser un número positivo mayor a 0');
    }

    const nowIso = new Date().toISOString();
    const nombre = codigo === 'USD_BCV' ? 'Dólar Oficial (BCV)' : 'Cripto USDT (Binance P2P)';
    const monedaOrigen = codigo === 'USD_BCV' ? 'USD' : 'USDT';

    await db.execute({
      sql: `INSERT INTO tasas_cambio_referencia (
              codigo, nombre, tasa, moneda_origen, moneda_destino, fuente,
              fecha_actualizacion, es_manual, detalles_json, actualizado_en
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
            ON CONFLICT(codigo) DO UPDATE SET
              tasa = excluded.tasa,
              fuente = 'Ajuste Manual Administrativo',
              es_manual = 1,
              fecha_actualizacion = excluded.fecha_actualizacion,
              actualizado_en = excluded.actualizado_en`,
      args: [
        codigo,
        nombre,
        nuevaTasa,
        monedaOrigen,
        'VES',
        'Ajuste Manual Administrativo',
        nowIso,
        JSON.stringify({ motivo: 'Ajuste manual administrativo' }),
        nowIso
      ]
    });

    // Registrar en histórico
    await db.execute({
      sql: `INSERT INTO historial_tasas_cambio (codigo, tasa, fuente, fecha) VALUES (?, ?, ?, ?)`,
      args: [codigo, nuevaTasa, 'Ajuste Manual Administrativo', nowIso.slice(0, 10)]
    });

    // Invalidar caché en memoria para forzar recarga de los nuevos valores
    memoryCache = null;

    const res = await db.execute({
      sql: `SELECT * FROM tasas_cambio_referencia WHERE codigo = ?`,
      args: [codigo]
    });

    return this.rowToTasaInfo(res.rows[0]);
  },

  /**
   * Restablece una tasa a modo automático (elimina la bandera es_manual)
   */
  async resetTasaAuto(codigo: 'USD_BCV' | 'USDT_BINANCE'): Promise<void> {
    await db.execute({
      sql: `UPDATE tasas_cambio_referencia SET es_manual = 0 WHERE codigo = ?`,
      args: [codigo]
    });
    memoryCache = null;
    await this.sincronizarEnVivo();
  },

  /**
   * Obtiene el histórico de cotizaciones registradas
   */
  async getHistorial(codigo?: string, limite = 50) {
    try {
      let sql = `SELECT * FROM historial_tasas_cambio`;
      const args: any[] = [];

      if (codigo) {
        sql += ` WHERE codigo = ?`;
        args.push(codigo);
      }

      // Más reciente primero por fecha de la cotización; `id` desempata las del mismo día
      sql += ` ORDER BY fecha DESC, id DESC LIMIT ?`;
      args.push(limite);

      const res = await db.execute({ sql, args });
      return res.rows.map(r => ({
        id: Number(r.id),
        codigo: String(r.codigo),
        tasa: Number(r.tasa),
        fuente: String(r.fuente),
        fecha: String(r.fecha),
        creado_en: String(r.creado_en)
      }));
    } catch (err: any) {
      console.warn('[tasas.service] Conexión DB temporalmente inestable al obtener historial:', err?.message || err);
      return [];
    }
  },

  /**
   * Realiza conversiones matemáticas de moneda
   */
  convertir(monto: number, desde: 'USD' | 'USDT' | 'VES', hacia: 'USD' | 'USDT' | 'VES', tasaBcv: number, tasaUsdt: number) {
    if (monto <= 0) return 0;
    if (desde === hacia) return monto;

    // USD a VES
    if (desde === 'USD' && hacia === 'VES') {
      return Number((monto * tasaBcv).toFixed(2));
    }
    // VES a USD
    if (desde === 'VES' && hacia === 'USD') {
      return Number((monto / tasaBcv).toFixed(2));
    }
    // USDT a VES
    if (desde === 'USDT' && hacia === 'VES') {
      return Number((monto * tasaUsdt).toFixed(2));
    }
    // VES a USDT
    if (desde === 'VES' && hacia === 'USDT') {
      return Number((monto / tasaUsdt).toFixed(2));
    }
    // USD a USDT
    if (desde === 'USD' && hacia === 'USDT') {
      const ves = monto * tasaBcv;
      return Number((ves / tasaUsdt).toFixed(4));
    }
    // USDT a USD
    if (desde === 'USDT' && hacia === 'USD') {
      const ves = monto * tasaUsdt;
      return Number((ves / tasaBcv).toFixed(4));
    }

    return monto;
  },

  /**
   * Mapeo de filas SQLite a objeto de respuesta
   */
  rowsToMap(rows: any[]): Record<string, TasaInfo> {
    const map: Record<string, TasaInfo> = {};
    for (const r of rows) {
      const info = this.rowToTasaInfo(r);
      map[info.codigo] = info;
    }
    return map;
  },

  rowToTasaInfo(r: any): TasaInfo {
    let detalles: any = {};
    try {
      if (r.detalles_json) detalles = JSON.parse(r.detalles_json);
    } catch {
      //
    }

    return {
      codigo: r.codigo as 'USD_BCV' | 'USDT_BINANCE',
      nombre: String(r.nombre),
      tasa: Number(r.tasa),
      moneda_origen: String(r.moneda_origen),
      moneda_destino: String(r.moneda_destino),
      fuente: String(r.fuente),
      fecha_actualizacion: String(r.fecha_actualizacion),
      es_manual: Boolean(r.es_manual),
      detalles
    };
  },

  construirSnapshot(
    tasasMap: Record<string, TasaInfo>,
    tiempoRestanteMs: number,
    desdeCache: boolean
  ): ReferenciasSnapshot {
    const tasaBcv = tasasMap['USD_BCV']?.tasa || 1;
    const tasaUsdt = tasasMap['USDT_BINANCE']?.tasa || 1;
    const spread = tasaBcv > 0 ? Number((((tasaUsdt - tasaBcv) / tasaBcv) * 100).toFixed(2)) : 0;

    const fechas = Object.values(tasasMap).map(t => t.fecha_actualizacion);
    const ultima = fechas.length > 0 ? fechas[0] : new Date().toISOString();

    return {
      tasas: tasasMap,
      spread_porcentaje: spread,
      ultima_actualizacion: ultima,
      tiempo_restante_cache_ms: Math.max(0, tiempoRestanteMs),
      ttl_cache_ms: CACHE_TTL_MS,
      desde_cache: desdeCache
    };
  }
};
