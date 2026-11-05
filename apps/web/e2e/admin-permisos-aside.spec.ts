import { test, expect, Page } from '@playwright/test';
import { MOCK_ADMIN_USER, setupAdminAuth, setupAdminMocks } from './helpers/mock-api';

// Usuario de staff con un rol personalizado (sin afiliado): la web decide solo por `permisos`.
const usuarioConRol = (permisos: Record<string, Partial<Record<'ver' | 'crear' | 'editar' | 'eliminar', boolean>>>) => ({
  id: 50,
  email: 'contador@ciebo.com',
  roles: ['contador'],
  rol: 'contador',
  nombres: 'Ana',
  apellidos: 'Contreras',
  nombre_completo: 'Ana Contreras',
  permisos,
});

// Ninguna llamada a la API sale del navegador: todo lo no mockeado responde vacío.
async function bloquearApi(page: Page) {
  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) }),
  );
}

async function sesionCon(page: Page, user: ReturnType<typeof usuarioConRol>) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await bloquearApi(page);
  await setupAdminMocks(page);
  // Registradas después: Playwright prueba primero las rutas más recientes.
  for (const path of ['**/api/auth/me', '**/api/auth/refresh']) {
    await page.route(path, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, token: 'mock_jwt_rol', user }) }),
    );
  }
}

const item = (page: Page, id: string) => page.locator(`[data-testid="aside-nav-${id}"]:visible`).first();
const items = (page: Page, id: string) => page.locator(`[data-testid="aside-nav-${id}"]`);

test.describe('Permisos por sección en el panel admin (E2E)', () => {
  // Aterriza en «afiliados» (los mocks de finanzas no traen la forma completa del resumen).
  test('un rol personalizado solo ve sus secciones en el aside', async ({ page }) => {
    await sesionCon(page, usuarioConRol({ afiliados: { ver: true }, leyes: { ver: true }, normas: { ver: false, editar: true } }));

    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin/);

    await expect(item(page, 'afiliados')).toBeVisible();
    await expect(item(page, 'normativas')).toBeVisible(); // grupo visible porque un hijo tiene `ver`
    await expect(item(page, 'leyes')).toBeVisible();

    for (const id of ['normas', 'reglamentos', 'actas', 'finanzas', 'users', 'analytics', 'admin_users', 'roles', 'settings']) {
      await expect(items(page, id)).toHaveCount(0);
    }
  });

  test('un rol personalizado que entra a /panel termina en /admin', async ({ page }) => {
    await sesionCon(page, usuarioConRol({ afiliados: { ver: true } }));

    await page.goto('/panel');
    await expect(page).toHaveURL(/\/admin/);
  });

  test('super_admin ve «Roles y permisos» y «Administradores»', async ({ page }) => {
    await bloquearApi(page);
    await setupAdminMocks(page);
    await setupAdminAuth(page); // MOCK_ADMIN_USER sin `permisos`: super_admin pasa igual

    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin/);
    expect(MOCK_ADMIN_USER.roles).toContain('super_admin');
    await expect(item(page, 'roles')).toBeVisible();
    await expect(item(page, 'admin_users')).toBeVisible();
    await expect(item(page, 'analytics')).toBeVisible();
    await expect(item(page, 'settings')).toBeVisible();
  });

  test('un usuario sin `ver` en ninguna sección es redirigido fuera de /admin', async ({ page }) => {
    await sesionCon(page, usuarioConRol({ finanzas: { ver: false, crear: true } }));

    await page.goto('/admin');
    await expect(page).toHaveURL(/\/panel/);
  });
});
