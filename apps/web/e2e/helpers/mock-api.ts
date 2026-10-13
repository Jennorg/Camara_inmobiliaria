import { Page } from '@playwright/test';

export const MOCK_ADMIN_USER = {
  id: 1,
  email: 'admin@ciebo.com',
  roles: ['super_admin'],
  rol: 'super_admin',
  nombres: 'Administrador',
  apellidos: 'Principal',
  nombre_completo: 'Administrador Principal',
  cedula: 'V-12345678',
  telefono: '+58 412 1234567',
  tipo_afiliado: 'Corporativo',
};

export const MOCK_AFILIADO_USER = {
  id: 10,
  id_afiliado: 10,
  email: 'afiliado@ciebo.com',
  roles: ['afiliado'],
  rol: 'afiliado',
  nombres: 'Carlos',
  apellidos: 'Mendoza',
  nombre_completo: 'Carlos Mendoza',
  codigo: 'CIEBO-1042',
  cedula: 'V-18765432',
  telefono: '+58 414 7654321',
  tipo_afiliado: 'Natural',
  estatus: 'Solvente',
  inscripcion_pagada: 1,
};

export async function setupAdminAuth(page: Page) {
  await page.setViewportSize({ width: 1280, height: 800 });

  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, user: MOCK_ADMIN_USER }),
    });
  });

  await page.route('**/api/auth/refresh', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, token: 'mock_jwt_super_admin', user: MOCK_ADMIN_USER }),
    });
  });

  await page.addInitScript((adminUser) => {
    localStorage.setItem('auth_user', JSON.stringify(adminUser));
    localStorage.setItem('ciebo_token', 'mock_jwt_super_admin');
  }, MOCK_ADMIN_USER);
}

export async function setupAfiliadoAuth(page: Page) {
  await page.setViewportSize({ width: 1280, height: 800 });

  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, user: MOCK_AFILIADO_USER }),
    });
  });

  await page.route('**/api/auth/refresh', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, token: 'mock_jwt_afiliado', user: MOCK_AFILIADO_USER }),
    });
  });

  await page.route('**/api/afiliados/10', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          ...MOCK_AFILIADO_USER,
          fecha_inscripcion: '2025-01-15',
          carnet_url: null,
          solvente: true,
          inscripcion_pagada: 1,
        },
      }),
    });
  });

  await page.addInitScript((afiliadoUser) => {
    localStorage.setItem('auth_user', JSON.stringify(afiliadoUser));
    localStorage.setItem('ciebo_token', 'mock_jwt_afiliado');
  }, MOCK_AFILIADO_USER);
}

export async function setupPublicMocks(page: Page) {
  // Tasas de cambio públicas
  await page.route('**/api/public/tasas-referencia**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          tasas: {
            USD_BCV: { codigo: 'USD_BCV', tasa: 875.65, moneda_origen: 'USD', moneda_destino: 'VES', fuente: 'BCV Oficial' },
            USDT_BINANCE: { codigo: 'USDT_BINANCE', tasa: 1008.45, moneda_origen: 'USDT', moneda_destino: 'VES', fuente: 'Binance P2P' },
          },
          spread_porcentaje: 15.17,
          ttl_cache_ms: 2100000,
        },
      }),
    });
  });

  // Directorio público de afiliados
  await page.route('**/api/public/afiliados/buscar**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [
          {
            id_afiliado: 1,
            codigo: 'CIEBO-001',
            nombre_completo: 'María Inés Rodríguez',
            cedula: 'V-15678901',
            tipo_afiliado: 'Natural',
            estatus: 'Solvente',
            email: 'maria.rodriguez@email.com',
            telefono: '+58 414 1234567',
            foto_url: null,
            nivel_profesional: 'Corredor Inmobiliario Certificado',
          },
          {
            id_afiliado: 2,
            codigo: 'CIEBO-002',
            nombre_completo: 'Inversiones Bolívar Real Estate C.A.',
            empresa_razon_social: 'Inversiones Bolívar Real Estate C.A.',
            empresa_rif_numero: 'J-30495867-1',
            cedula: 'J-30495867-1',
            tipo_afiliado: 'Corporativo',
            estatus: 'Solvente',
            email: 'contacto@bolivarrealestate.com',
            telefono: '+58 286 9234567',
            foto_url: null,
            nivel_profesional: 'Empresa Inmobiliaria',
          },
        ],
        counts: { total: 2, natural: 1, corporativo: 1, agente: 0 },
        hasMore: false,
      }),
    });
  });

  // Cursos públicos
  await page.route('**/api/public/cursos**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [
          { id: 1, nombre: 'CIV - Curso de Inducción Virtual', slug: 'civ', estatus: 'Activo' },
          { id: 2, nombre: 'CIBIR - Curso de Iniciación en Bienes Raíces', slug: 'cibir', estatus: 'Activo' },
          { id: 3, nombre: 'PREANI - Programa de Especialización', slug: 'preani', estatus: 'Activo' },
        ],
      }),
    });
  });
}

export async function setupAdminMocks(page: Page) {
  // Tasas módulo finanzas
  await page.route('**/api/finanzas/referencias**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          tasas: {
            USD_BCV: { codigo: 'USD_BCV', nombre: 'Dólar Oficial (BCV)', tasa: 875.65, moneda_origen: 'USD', moneda_destino: 'VES', fuente: 'BCV Oficial', es_manual: false },
            USDT_BINANCE: { codigo: 'USDT_BINANCE', nombre: 'Cripto USDT (Binance P2P)', tasa: 1008.45, moneda_origen: 'USDT', moneda_destino: 'VES', fuente: 'Binance P2P', es_manual: false },
          },
          spread_porcentaje: 15.17,
          ultima_actualizacion: '2026-10-12T12:00:00Z',
          tiempo_restante_cache_ms: 2100000,
          ttl_cache_ms: 2100000,
          desde_cache: true,
        },
      }),
    });
  });

  // Resumen financiero
  await page.route('**/api/finanzas/resumen**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          kpis: {
            totalIngresosUSD: 12500.0,
            conteoIngresos: 42,
            totalEgresosUSD: 3200.0,
            conteoEgresos: 8,
            balanceUSD: 9300.0,
          },
          cuentas: [
            { id: 1, banco: 'Banesco', tipo: 'Corriente', saldo_ves: 5400000.0 },
            { id: 2, banco: 'Mercantil', tipo: 'Corriente', saldo_ves: 5545625.0 },
          ],
          distribucionPorMetodo: [],
          ultimosMovimientos: [],
        },
      }),
    });
  });

  // Libro de ventas / cobros
  await page.route('**/api/finanzas/libro-ventas**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          items: [
            {
              id: 1,
              fecha: '2026-10-12',
              concepto: 'Arancel Cuota Mensual Afiliación',
              afiliado_nombre: 'María Inés Rodríguez',
              codigo_afiliado: 'CIEBO-001',
              monto_usd: 25.0,
              monto_ves: 21891.25,
              metodo_pago: 'Transferencia',
              referencia: 'REF-789012',
              estatus: 'Aprobado',
            },
          ],
          totales: {
            cantidadRegistros: 1,
            montoTotalUSD: 25.0,
            montoTotalVES: 21891.25,
          },
        },
      }),
    });
  });

  // Libro de compras / gastos
  await page.route('**/api/finanzas/libro-compras**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          items: [
            {
              id: 1,
              fecha: '2026-10-10',
              concepto: 'Mantenimiento del Servidor y Plataforma Web',
              proveedor: 'Hosting Cloud Services',
              monto_usd: 120.0,
              monto_ves: 105078.0,
              estatus: 'Pagado',
            },
          ],
          totales: {
            cantidadRegistros: 1,
            montoTotalUSD: 120.0,
            montoTotalVES: 105078.0,
          },
        },
      }),
    });
  });

  // Afiliados lista admin
  await page.route('**/api/afiliados?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [
          {
            id_afiliado: 1,
            codigo: 'CIEBO-001',
            nombre_completo: 'María Inés Rodríguez',
            cedula: 'V-15678901',
            tipo_afiliado: 'Natural',
            estatus: 'Solvente',
            email: 'maria.rodriguez@email.com',
            telefono: '+58 414 1234567',
            nivel_profesional: 'Corredor Inmobiliario Certificado',
          },
          {
            id_afiliado: 2,
            codigo: 'CIEBO-002',
            nombre_completo: 'Pedro José Gómez',
            cedula: 'V-12987654',
            tipo_afiliado: 'Natural',
            estatus: 'No Solvente',
            email: 'pedro.gomez@email.com',
            telefono: '+58 416 9876543',
            nivel_profesional: 'Asesor Inmobiliario',
          },
        ],
        total: 2,
      }),
    });
  });

  // Solicitudes de cambio
  await page.route('**/api/afiliados/admin/solicitudes-cambio**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [
          {
            id_solicitud: 1,
            id_afiliado: 1,
            afiliado_nombre: 'María Inés Rodríguez',
            afiliado_email: 'maria.rodriguez@email.com',
            tipo_actual: 'Natural',
            tipo_solicitado: 'Corporativo',
            estatus: 'Pendiente',
            creado_en: '2026-10-11T14:30:00Z',
          },
        ],
      }),
    });
  });

  // Formación: cursos admin
  await page.route('**/api/academia/cursos**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [
          { id_curso: 1, titulo: 'CIBIR Edición XIX', modalidad: 'Híbrida', cupos: 35, estatus: 'Abierto' },
          { id_curso: 2, titulo: 'Taller de Valoración Inmobiliaria', modalidad: 'Online', cupos: 20, estatus: 'Abierto' },
        ],
      }),
    });
  });

  // Preinscripciones academia
  await page.route('**/api/academia/preinscripciones**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [
          {
            id_inscripcion: 1,
            id_estudiante: 101,
            programa_codigo: 'CIBIR',
            estudiante_nombre: 'Alejandro Vargas',
            estudiante_cedula: 'V-20112233',
            estudiante_email: 'alejandro.vargas@email.com',
            estatus: 'Preinscrito',
            num_documentos: 2,
            creado_en: '2026-10-12T10:00:00Z',
          },
        ],
      }),
    });
  });

  // Profesores
  await page.route('**/api/academia/profesores**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [{ id: 1, nombre_completo: 'Prof. Juan Pérez', especialidad: 'Derecho Inmobiliario' }],
      }),
    });
  });

  // Estudiantes regulares
  await page.route('**/api/academia/estudiantes**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [
          {
            id_estudiante: 101,
            nombre_completo: 'Alejandro Vargas',
            cedula: 'V-20112233',
            email: 'alejandro.vargas@email.com',
            telefono: '+58 424 5551234',
            estatus: 'Activo',
          },
        ],
        total: 1,
      }),
    });
  });

  // Denuncias admin
  await page.route('**/api/denuncias/admin**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          denuncias: [
            {
              id_denuncia: 1,
              codigo: 'DEN-2026-001',
              denunciante_nombre: 'Anónimo / Reserva',
              tipo_falta: 'falta_etica',
              estatus: 'recibida',
              prioridad: 'media',
              fecha_creacion: '2026-10-10T16:00:00Z',
              creado_en: '2026-10-10T16:00:00Z',
            },
          ],
          kpis: {
            total: 1,
            recibidas: 1,
            en_revision: 0,
            en_descargos: 0,
            en_mediacion: 0,
            resueltas: 0,
            desestimadas: 0,
          },
        },
      }),
    });
  });

  // Usuarios del sistema
  await page.route('**/api/users**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [
          { id: 1, email: 'admin@ciebo.com', nombre_completo: 'Administrador Principal', roles: ['super_admin'], rol: 'super_admin', activo: true },
          { id: 2, email: 'secretaria@ciebo.com', nombre_completo: 'Secretaría Administrativa', roles: ['asistente'], rol: 'asistente', activo: true },
        ],
      }),
    });
  });

  // Empresas
  await page.route('**/api/public/empresas**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [{ id_empresa: 1, razon_social: 'Inversiones Bolívar Real Estate C.A.', rif: 'J-30495867-1' }],
      }),
    });
  });

  // Directiva CMS
  await page.route('**/api/cms/directiva**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [{ id: 1, nombre: 'Lic. Francisco Martínez', cargo: 'Presidente' }],
      }),
    });
  });
}
