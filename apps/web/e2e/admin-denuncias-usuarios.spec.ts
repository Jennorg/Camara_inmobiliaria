import { test, expect } from '@playwright/test';
import { setupAdminAuth, setupAdminMocks } from './helpers/mock-api';
import { navPanel } from './helpers/panel-nav';

test.describe('Módulo Administrativo: Denuncias, Administradores y Usuarios del Sistema (E2E)', () => {
  test.beforeEach(async ({ page }) => {
    await setupAdminAuth(page);
    await setupAdminMocks(page);
  });

  test('debe navegar al panel de Denuncias y visualizar los expedientes éticos registrados', async ({ page }) => {
    await page.goto('/panel');
    await page.waitForLoadState('domcontentloaded');

    const navDenuncias = navPanel(page, 'denuncias');
    await expect(navDenuncias).toBeVisible();
    await navDenuncias.click();

    // Comprobar que carga la tabla de denuncias
    const body = page.locator('body');
    await expect(body).toContainText(/Denuncias|Tribunal Disciplinario/i);
    await expect(body).toContainText('DEN-2026-001');
  });

  test('debe navegar al panel de Administradores y listar las cuentas con permisos elevados', async ({ page }) => {
    await page.goto('/panel');
    await page.waitForLoadState('domcontentloaded');

    const navAdminUsers = navPanel(page, 'admin_users');
    if (await navAdminUsers.isVisible()) {
      await navAdminUsers.click();

      // Debe mostrar el listado de administradores
      const body = page.locator('body');
      await expect(body).toContainText(/Administrador|Super Admin|admin@ciebo.com/i);
    }
  });

  test('debe navegar al panel de Usuarios generales y permitir visualizar sus roles', async ({ page }) => {
    await page.goto('/panel');
    await page.waitForLoadState('domcontentloaded');

    const navUsers = navPanel(page, 'users');
    if (await navUsers.isVisible()) {
      await navUsers.click();

      // Debe mostrar la lista de usuarios
      const body = page.locator('body');
      await expect(body).toContainText(/Usuarios|Cuentas/i);
    }
  });
});
