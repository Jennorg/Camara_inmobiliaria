import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';
import { tasasService, CACHE_TTL_MS } from '../src/services/tasas.service.js';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env.js';

describe('Sistema de Tasas de Referencia y Conversión (Backend)', { timeout: 25000 }, () => {
  // Generar token JWT con rol super_admin para pruebas autenticadas
  const adminToken = jwt.sign(
    { id: 1, email: 'admin@ciebo.com', roles: ['super_admin'] },
    env.JWT_SECRET || 'secret',
    { expiresIn: '1h' }
  );

  it('debe tener configurado exactamente el intervalo de 35 minutos de caché', () => {
    expect(CACHE_TTL_MS).toBe(35 * 60 * 1000);
    expect(CACHE_TTL_MS).toBe(2100000);
  });

  it('GET /api/public/tasas-referencia - debe retornar las tasas activas con estructura correcta', async () => {
    const res = await request(app).get('/api/public/tasas-referencia');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('tasas');
    expect(res.body.data).toHaveProperty('spread_porcentaje');
    expect(res.body.data).toHaveProperty('ttl_cache_ms', 35 * 60 * 1000);

    const { tasas } = res.body.data;
    expect(tasas).toHaveProperty('USD_BCV');
    expect(tasas).toHaveProperty('USDT_BINANCE');

    expect(tasas.USD_BCV.tasa).toBeGreaterThan(0);
    expect(tasas.USD_BCV.moneda_origen).toBe('USD');
    expect(tasas.USD_BCV.moneda_destino).toBe('VES');

    expect(tasas.USDT_BINANCE.tasa).toBeGreaterThan(0);
    expect(tasas.USDT_BINANCE.moneda_origen).toBe('USDT');
    expect(tasas.USDT_BINANCE.moneda_destino).toBe('VES');
  });

  it('debe reutilizar la caché en memoria dentro del intervalo de 35 minutos', async () => {
    // Primera consulta
    const res1 = await request(app)
      .get('/api/finanzas/referencias')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res1.status).toBe(200);

    // Segunda consulta inmediata: debe venir de caché
    const res2 = await request(app)
      .get('/api/finanzas/referencias')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res2.status).toBe(200);
    expect(res2.body.data.desde_cache).toBe(true);
    expect(res2.body.data.tiempo_restante_cache_ms).toBeGreaterThan(0);
    expect(res2.body.data.tiempo_restante_cache_ms).toBeLessThanOrEqual(35 * 60 * 1000);
  });

  it('POST /api/finanzas/referencias/sync - debe forzar sincronización y refrescar timestamp', async () => {
    const res = await request(app)
      .post('/api/finanzas/referencias/sync')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.desde_cache).toBe(false);
    expect(res.body.data.tasas.USD_BCV.tasa).toBeGreaterThan(0);
  });

  it('PUT /api/finanzas/referencias/:codigo - debe permitir ajuste manual y reflejarse', async () => {
    const tasaTest = 999.50;
    const resPut = await request(app)
      .put('/api/finanzas/referencias/USD_BCV')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ tasa: tasaTest });

    expect(resPut.status).toBe(200);
    expect(resPut.body.success).toBe(true);
    expect(resPut.body.data.tasa).toBe(tasaTest);
    expect(resPut.body.data.es_manual).toBe(true);

    // Verificar que la consulta posterior retorna la tasa manual
    const resGet = await request(app)
      .get('/api/finanzas/referencias')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(resGet.body.data.tasas.USD_BCV.tasa).toBe(tasaTest);
    expect(resGet.body.data.tasas.USD_BCV.es_manual).toBe(true);

    // Restaurar a modo automático
    await request(app)
      .delete('/api/finanzas/referencias/USD_BCV/manual')
      .set('Authorization', `Bearer ${adminToken}`);
  });

  it('GET /api/finanzas/referencias/historial - debe retornar registros cronológicos', async () => {
    const res = await request(app)
      .get('/api/finanzas/referencias/historial')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0]).toHaveProperty('codigo');
    expect(res.body.data[0]).toHaveProperty('tasa');
  });

  it('tasasService.convertir - debe calcular con precisión matemática directa e inversa', () => {
    const tasaBcv = 800;
    const tasaUsdt = 1000;

    // USD a VES: 30 * 800 = 24000
    expect(tasasService.convertir(30, 'USD', 'VES', tasaBcv, tasaUsdt)).toBe(24000);

    // VES a USD: 24000 / 800 = 30
    expect(tasasService.convertir(24000, 'VES', 'USD', tasaBcv, tasaUsdt)).toBe(30);

    // USDT a VES: 30 * 1000 = 30000
    expect(tasasService.convertir(30, 'USDT', 'VES', tasaBcv, tasaUsdt)).toBe(30000);

    // VES a USDT: 30000 / 1000 = 30
    expect(tasasService.convertir(30000, 'VES', 'USDT', tasaBcv, tasaUsdt)).toBe(30);

    // USD a USDT: (100 * 800) / 1000 = 80 USDT
    expect(tasasService.convertir(100, 'USD', 'USDT', tasaBcv, tasaUsdt)).toBe(80);

    // Monto cero
    expect(tasasService.convertir(0, 'USD', 'VES', tasaBcv, tasaUsdt)).toBe(0);
  });

  describe('Resiliencia ante fallos de conexión o DNS a la base de datos Turso', () => {
    it('debe tolerar fallo de resolución DNS de Turso (EAI_AGAIN) sin devolver HTTP 500 y retornando tasas funcionales', async () => {
      const { db } = await import('../src/lib/db.js');
      const spyExecute = vi.spyOn(db, 'execute').mockImplementation(async () => {
        const error = new TypeError('fetch failed');
        (error as any).cause = {
          code: 'EAI_AGAIN',
          hostname: 'back-ciebo-jennorg.aws-us-east-1.turso.io'
        };
        throw error;
      });

      try {
        // 1. Endpoint público debe responder 200 con éxito y estructura íntegra
        const resPublic = await request(app).get('/api/public/tasas-referencia');
        expect(resPublic.status).toBe(200);
        expect(resPublic.body.success).toBe(true);
        expect(resPublic.body.data.tasas.USD_BCV.tasa).toBeGreaterThan(0);
        expect(resPublic.body.data.tasas.USDT_BINANCE.tasa).toBeGreaterThan(0);

        // 2. Endpoint administrativo de referencias debe responder 200
        const resAdmin = await request(app)
          .get('/api/finanzas/referencias')
          .set('Authorization', `Bearer ${adminToken}`);
        expect(resAdmin.status).toBe(200);
        expect(resAdmin.body.success).toBe(true);
        expect(resAdmin.body.data.tasas.USD_BCV.tasa).toBeGreaterThan(0);

        // 3. Endpoint de historial no debe lanzar excepción no controlada, retornando array seguro
        const resHistorial = await request(app)
          .get('/api/finanzas/referencias/historial')
          .set('Authorization', `Bearer ${adminToken}`);
        expect(resHistorial.status).toBe(200);
        expect(resHistorial.body.success).toBe(true);
        expect(Array.isArray(resHistorial.body.data)).toBe(true);
      } finally {
        spyExecute.mockRestore();
      }
    });

    it('debe tolerar cierre abrupto de socket de Turso (UND_ERR_SOCKET) en sincronización y consultas', async () => {
      const { db } = await import('../src/lib/db.js');
      const spyExecute = vi.spyOn(db, 'execute').mockImplementation(async () => {
        const error = new TypeError('fetch failed');
        (error as any).cause = {
          code: 'UND_ERR_SOCKET',
          message: 'other side closed'
        };
        throw error;
      });

      try {
        // getTasas a nivel de servicio no debe lanzar excepción
        const snapshot = await tasasService.getTasas(false);
        expect(snapshot).toBeDefined();
        expect(snapshot.tasas.USD_BCV.tasa).toBeGreaterThan(0);
        expect(snapshot.tasas.USDT_BINANCE.tasa).toBeGreaterThan(0);

        // getHistorial a nivel de servicio no debe reventar y debe retornar array vacío de salvaguarda
        const historial = await tasasService.getHistorial('USD_BCV');
        expect(Array.isArray(historial)).toBe(true);
      } finally {
        spyExecute.mockRestore();
      }
    });
  });
});
