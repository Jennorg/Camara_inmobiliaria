import { test, expect } from '@playwright/test';

test.describe('Módulo Financiero - Referencias y Conversor Automático', () => {
  test.beforeEach(async ({ page }) => {
    // Interceptar llamadas a la API de referencias para tener respuestas consistentes y deterministas
    await page.route('**/api/finanzas/referencias**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            tasas: {
              USD_BCV: {
                codigo: 'USD_BCV',
                nombre: 'Dólar Oficial (BCV)',
                tasa: 875.65,
                moneda_origen: 'USD',
                moneda_destino: 'VES',
                fuente: 'BCV Oficial (DolarApi)',
                fecha_actualizacion: '2026-10-12T12:00:00Z',
                es_manual: false
              },
              USDT_BINANCE: {
                codigo: 'USDT_BINANCE',
                nombre: 'Cripto USDT (Binance P2P)',
                tasa: 1008.45,
                moneda_origen: 'USDT',
                moneda_destino: 'VES',
                fuente: 'Binance P2P (Mercado En Vivo)',
                fecha_actualizacion: '2026-10-12T12:00:00Z',
                es_manual: false
              }
            },
            spread_porcentaje: 15.17,
            ultima_actualizacion: '2026-10-12T12:00:00Z',
            tiempo_restante_cache_ms: 2100000,
            ttl_cache_ms: 2100000,
            desde_cache: true
          }
        })
      });
    });

    await page.route('**/api/public/tasas-referencia**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            tasas: {
              USD_BCV: { codigo: 'USD_BCV', tasa: 875.65, moneda_origen: 'USD', moneda_destino: 'VES' },
              USDT_BINANCE: { codigo: 'USDT_BINANCE', tasa: 1008.45, moneda_origen: 'USDT', moneda_destino: 'VES' }
            },
            spread_porcentaje: 15.17,
            ttl_cache_ms: 2100000
          }
        })
      });
    });

    await page.route('**/api/finanzas/referencias/historial**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            { id: 1, codigo: 'USD_BCV', tasa: 875.65, fuente: 'BCV Oficial', fecha: '2026-10-12', creado_en: '2026-10-12T12:00:00Z' },
            { id: 2, codigo: 'USDT_BINANCE', tasa: 1008.45, fuente: 'Binance P2P', fecha: '2026-10-12', creado_en: '2026-10-12T12:00:00Z' }
          ]
        })
      });
    });

    // Mock autenticación /api/auth/me y /api/auth/refresh
    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          user: {
            id: 1,
            email: 'admin@ciebo.com',
            roles: ['super_admin'],
            rol: 'super_admin',
            nombres: 'Administrador',
            apellidos: 'Principal',
            nombre_completo: 'Administrador Principal'
          }
        })
      });
    });

    await page.route('**/api/auth/refresh', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          token: 'mock_jwt_token_super_admin',
          user: {
            id: 1,
            email: 'admin@ciebo.com',
            roles: ['super_admin'],
            rol: 'super_admin',
            nombres: 'Administrador',
            apellidos: 'Principal',
            nombre_completo: 'Administrador Principal'
          }
        })
      });
    });

    // Inyectar usuario administrativo autenticado en localStorage
    await page.addInitScript(() => {
      const adminUser = {
        id: 1,
        email: 'admin@ciebo.com',
        roles: ['super_admin'],
        rol: 'super_admin',
        nombres: 'Administrador',
        apellidos: 'Principal',
        nombre_completo: 'Administrador Principal'
      };
      localStorage.setItem('auth_user', JSON.stringify(adminUser));
      localStorage.setItem('ciebo_token', 'mock_admin_token');
    });

    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test('debe navegar al módulo de Finanzas y visualizar la pestaña Tasas & Conversor con cotizaciones', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('domcontentloaded');

    // Buscar y hacer clic en la sección de Finanzas en el sidebar
    const btnFinanzas = page.locator('[data-testid="aside-nav-finanzas"]:visible');
    await expect(btnFinanzas).toBeVisible();
    await btnFinanzas.click();

    // Comprobar que aparece el botón de tab "Tasas & Conversor"
    const tabTasas = page.getByTestId('tab-tasas-referencias');
    await expect(tabTasas).toBeVisible();
    await tabTasas.click();

    // Verificar contenedor principal
    const contenedor = page.getByTestId('referencias-tasas-container');
    await expect(contenedor).toBeVisible();

    // Validar tarjetas de cotización
    const cardBcv = page.getByTestId('card-tasa-bcv');
    await expect(cardBcv).toBeVisible();
    await expect(page.getByTestId('valor-tasa-bcv')).toContainText('875,65');

    const cardUsdt = page.getByTestId('card-tasa-usdt');
    await expect(cardUsdt).toBeVisible();
    await expect(page.getByTestId('valor-tasa-usdt')).toContainText('1.008,45');
  });

  test('debe realizar conversiones interactivas de Dólares a Bolívares y USDT a Bolívares', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('domcontentloaded');

    const btnFinanzas = page.locator('[data-testid="aside-nav-finanzas"]:visible');
    await expect(btnFinanzas).toBeVisible();
    await btnFinanzas.click();

    await page.getByTestId('tab-tasas-referencias').click();

    // 1. Probar conversión de $30 USD a Bolívares (30 * 875.65 = 26,269.50)
    const inputMonto = page.getByTestId('input-monto-origen');
    await inputMonto.fill('30');

    const resultado = page.getByTestId('resultado-conversion');
    await expect(resultado).toContainText('26.269,50');

    // 2. Probar conversión de 50 USDT a Bolívares (50 * 1008.45 = 50,422.50)
    const selectOrigen = page.getByTestId('select-moneda-origen');
    await selectOrigen.selectOption('USDT');
    await inputMonto.fill('50');
    await expect(resultado).toContainText('50.422,50');

    // 3. Probar botón de inversión (Swap)
    const btnSwap = page.getByTestId('btn-swap-monedas');
    await btnSwap.click();
    await expect(page.getByTestId('select-moneda-origen')).toHaveValue('VES');
    await expect(page.getByTestId('select-moneda-destino')).toHaveValue('USDT');
  });

  test('debe aplicar atajos de aranceles rápidos ($5, $25, $30)', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('domcontentloaded');

    const btnFinanzas = page.locator('[data-testid="aside-nav-finanzas"]:visible');
    await expect(btnFinanzas).toBeVisible();
    await btnFinanzas.click();

    await page.getByTestId('tab-tasas-referencias').click();

    // Clic en arancel $5
    await page.getByTestId('atajo-arancel-5').click();
    await expect(page.getByTestId('input-monto-origen')).toHaveValue('5');
    // 5 * 875.65 = 4,378.25
    await expect(page.getByTestId('resultado-conversion')).toContainText('4.378,25');

    // Clic en arancel $25
    await page.getByTestId('atajo-arancel-25').click();
    await expect(page.getByTestId('input-monto-origen')).toHaveValue('25');
    // 25 * 875.65 = 21,891.25
    await expect(page.getByTestId('resultado-conversion')).toContainText('21.891,25');

    // Clic en arancel $30
    await page.getByTestId('atajo-arancel-30').click();
    await expect(page.getByTestId('input-monto-origen')).toHaveValue('30');
    // 30 * 875.65 = 26,269.50
    await expect(page.getByTestId('resultado-conversion')).toContainText('26.269,50');
  });
});
