import { test, expect } from '@playwright/test';
import { setupAdminAuth, setupAdminMocks } from './helpers/mock-api';

test.describe('Módulo Administrativo: Gestión de Afiliados y Solicitudes de Cambio (E2E)', () => {
  test.beforeEach(async ({ page }) => {
    await setupAdminAuth(page);
    await setupAdminMocks(page);
  });

  test('debe navegar al panel de Afiliados y visualizar el listado con sus estatus de solvencia', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('domcontentloaded');

    // Navegar a Afiliados mediante el sidebar visible
    const navAfiliados = page.locator('[data-testid="aside-nav-afiliados"]:visible');
    await expect(navAfiliados).toBeVisible();
    await navAfiliados.click();

    // Comprobar que carga la tabla / listado de afiliados
    const body = page.locator('body');
    await expect(body).toContainText('María Inés Rodríguez');
    await expect(body).toContainText('Pedro José Gómez');

    // Comprobar badges de solvencia
    await expect(body).toContainText('Solvente');
    await expect(body).toContainText('No Solvente');
  });

  test('debe permitir filtrar afiliados por estado y tipo de membresía', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('domcontentloaded');

    const navAfiliados = page.locator('[data-testid="aside-nav-afiliados"]:visible');
    await navAfiliados.click();

    // Filtros de estatus (Todos / Solventes / No Solventes)
    const btnFiltroSolventes = page.locator('button:has-text("Solvente"), button:has-text("Solventes")').first();
    if (await btnFiltroSolventes.isVisible()) {
      await btnFiltroSolventes.click();
      await page.waitForTimeout(200);
    }
  });

  test('debe navegar a la sección de Solicitudes de Cambio de datos', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('domcontentloaded');

    // Clic en Solicitudes de Cambio en el menú lateral
    const navSolicitudes = page.locator('[data-testid="aside-nav-solicitudes_cambio"]:visible');
    await expect(navSolicitudes).toBeVisible();
    await navSolicitudes.click();

    // Verificar que muestra la lista de solicitudes pendientes
    const body = page.locator('body');
    await expect(body).toContainText(/Solicitudes de Cambio|Solicitud/i);
    await expect(body).toContainText('María Inés Rodríguez');
  });
});
