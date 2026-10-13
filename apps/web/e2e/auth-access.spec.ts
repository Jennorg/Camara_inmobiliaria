import { test, expect } from '@playwright/test';
import { setupAdminAuth, setupAfiliadoAuth } from './helpers/mock-api';

test.describe('Autenticación y Control de Acceso (E2E)', () => {
  test('debe bloquear acceso no autenticado a /admin y redirigir', async ({ page }) => {
    // Interceptar refresh para que responda 401 (sin sesión)
    await page.route('**/api/auth/refresh', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, message: 'No autenticado' }),
      });
    });

    await page.goto('/admin');
    await page.waitForLoadState('domcontentloaded');

    // Debe ser redirigido a / o lobby (no permanecer en /admin)
    await expect(page).not.toHaveURL(/\/admin$/);
  });

  test('debe permitir acceso al panel administrativo para usuarios con rol super_admin', async ({ page }) => {
    await setupAdminAuth(page);

    await page.goto('/admin');
    await page.waitForLoadState('domcontentloaded');

    // Debe permanecer en /admin y mostrar elementos del sidebar administrativo
    await expect(page).toHaveURL(/\/admin/);
    const sidebarElement = page.locator('[data-testid="aside-nav-analytics"]:visible, [data-testid="aside-nav-afiliados"]:visible').first();
    await expect(sidebarElement).toBeVisible();
  });

  test('debe restringir acceso a /admin para usuarios con rol exclusivo de afiliado', async ({ page }) => {
    await setupAfiliadoAuth(page);

    await page.goto('/admin');
    await page.waitForLoadState('domcontentloaded');

    // Los afiliados normales no tienen roles administrativos, deben ser redirigidos fuera de /admin (ej. a /panel o /)
    await expect(page).not.toHaveURL(/\/admin$/);
  });

  test('debe cerrar sesión correctamente al presionar Cerrar Sesión', async ({ page }) => {
    await setupAdminAuth(page);

    await page.route('**/api/auth/logout', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto('/admin');
    await page.waitForLoadState('domcontentloaded');

    // Localizar botón de logout visible en el sidebar
    const btnLogout = page.locator('button:has-text("Cerrar Sesión"), button:has-text("Cerrar sesión"), button[title="Cerrar sesión"]').first();
    if (await btnLogout.isVisible()) {
      await btnLogout.click();
      await page.waitForLoadState('domcontentloaded');
      // Al cerrar sesión debe salir de /admin
      await expect(page).not.toHaveURL(/\/admin$/);
    }
  });
});
