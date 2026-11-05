import { test, expect, Page } from '@playwright/test';
import { MOCK_ADMIN_USER, MOCK_AFILIADO_USER, setupAdminAuth, setupAdminMocks } from './helpers/mock-api';

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

async function sesionCon(page: Page, user: Record<string, unknown>) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await bloquearApi(page);
  await setupAdminMocks(page);
  // Registradas después: Playwright prueba primero las rutas más recientes.
  for (const path of ['**/api/auth/me', '**/api/auth/refresh']) {
    await page.route(path, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, token: 'mock_jwt_rol', user }) }),
    );
  }
  await page.route('**/api/afiliados/10', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { ...MOCK_AFILIADO_USER, solvente: true } }) }),
  );
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

  test('afiliado con rol de staff: /panel ofrece «Intranet administrativa» y lleva a /admin', async ({ page }) => {
    await sesionCon(page, { ...MOCK_AFILIADO_USER, roles: ['afiliado', 'lector'], rol: 'afiliado', permisos: { afiliados: { ver: true } } });

    await page.goto('/panel');
    const enlace = page.getByTestId('panel-ir-intranet');
    await expect(enlace).toBeVisible();
    await enlace.click();
    await expect(page).toHaveURL(/\/admin/);
    await expect(item(page, 'afiliados')).toBeVisible();
    await expect(items(page, 'finanzas')).toHaveCount(0);
  });

  test('el afiliado sin rol de staff no ve el enlace a la intranet', async ({ page }) => {
    await sesionCon(page, { ...MOCK_AFILIADO_USER, permisos: {} });

    await page.goto('/panel');
    await expect(page).toHaveURL(/\/panel/);
    await expect(page.getByTestId('panel-ir-intranet')).toHaveCount(0);
  });

  // Fallback legacy: respuesta sin `permisos` (API vieja). Quitar cuando la API con permisos esté en todos lados.
  test('admin sin `permisos` en la respuesta conserva el aside de admin', async ({ page }) => {
    await sesionCon(page, { ...MOCK_ADMIN_USER, id: 2, roles: ['admin'], rol: 'admin' });

    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin/);
    await expect(item(page, 'analytics')).toBeVisible();
    await expect(item(page, 'afiliados')).toBeVisible();
    await expect(items(page, 'roles')).toHaveCount(0);
    await expect(items(page, 'admin_users')).toHaveCount(0);
  });

  test('asistente sin `permisos` en la respuesta ve el aside viejo de asistente', async ({ page }) => {
    await sesionCon(page, { ...MOCK_ADMIN_USER, id: 3, roles: ['asistente'], rol: 'asistente' });

    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin/);
    for (const id of ['afiliados', 'users', 'finanzas', 'asambleas']) await expect(item(page, id)).toBeVisible();
    for (const id of ['denuncias', 'analytics', 'roles']) await expect(items(page, id)).toHaveCount(0);
  });

  test('un usuario sin `ver` en ninguna sección es redirigido fuera de /admin', async ({ page }) => {
    await sesionCon(page, usuarioConRol({ finanzas: { ver: false, crear: true } }));

    await page.goto('/admin');
    await expect(page).toHaveURL(/\/panel/);
  });
});
