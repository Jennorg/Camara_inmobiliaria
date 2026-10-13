import { test, expect } from '@playwright/test';
import { setupAdminAuth, setupAdminMocks } from './helpers/mock-api';

test.describe('Módulo Administrativo: Finanzas, Cobros y Cotizaciones de Referencia (E2E)', () => {
  test.beforeEach(async ({ page }) => {
    await setupAdminAuth(page);
    await setupAdminMocks(page);
  });

  test('debe navegar al panel de Finanzas y visualizar el cintillo superior de tasas activas y métricas de balance', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('domcontentloaded');

    const navFinanzas = page.locator('[data-testid="aside-nav-finanzas"]:visible');
    await expect(navFinanzas).toBeVisible();
    await navFinanzas.click();

    // Cintillo de cotizaciones de tasas de referencia arriba
    const tickerTasas = page.getByTestId('ticker-tasas-referencia');
    await expect(tickerTasas).toBeVisible();
    await expect(tickerTasas).toContainText('875.65');
    await expect(tickerTasas).toContainText('1008.45');

    // Balance financiero
    const body = page.locator('body');
    await expect(body).toContainText(/Ingresos|Balance|Libro de Ventas/i);
  });

  test('debe abrir el Modal de Registrar Compra / Gasto y precargar automáticamente la tasa BCV', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('domcontentloaded');

    const navFinanzas = page.locator('[data-testid="aside-nav-finanzas"]:visible');
    await navFinanzas.click();

    // Botón de registrar compra / gasto
    const btnGasto = page.locator('button:has-text("Registrar Compra / Gasto")').first();
    await expect(btnGasto).toBeVisible();
    await btnGasto.click();

    // Modal de compra / gasto abierto
    const modalTitulo = page.locator('text=Registrar Compra / Gasto Operativo').first();
    await expect(modalTitulo).toBeVisible();

    // Verificar que la tasa de cambio BCV está visible y precargada en el modal
    const body = page.locator('body');
    await expect(body).toContainText('875.65');
  });

  test('debe acceder a la pestaña Tasas & Conversor y realizar cálculos en vivo con el spread indicado', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('domcontentloaded');

    const navFinanzas = page.locator('[data-testid="aside-nav-finanzas"]:visible');
    await navFinanzas.click();

    // Pestaña Tasas & Conversor
    const tabTasas = page.getByTestId('tab-tasas-referencias');
    await expect(tabTasas).toBeVisible();
    await tabTasas.click();

    // Contenedor principal de tasas
    const contenedor = page.getByTestId('referencias-tasas-container');
    await expect(contenedor).toBeVisible();

    // Tarjetas de cotizaciones
    await expect(page.getByTestId('card-tasa-bcv')).toBeVisible();
    await expect(page.getByTestId('card-tasa-usdt')).toBeVisible();

    // Conversión de $25 (25 * 875.65 = 21,891.25)
    const btnArancel25 = page.getByTestId('atajo-arancel-25');
    await btnArancel25.click();
    await expect(page.getByTestId('resultado-conversion')).toContainText('21.891,25');
  });
});
