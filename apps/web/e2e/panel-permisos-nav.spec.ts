import { test, expect, Page } from '@playwright/test';
import { MOCK_ADMIN_USER, MOCK_AFILIADO_USER, setupAdminAuth, setupAdminMocks } from './helpers/mock-api';
import { NAV_PANEL } from './helpers/panel-nav';

// Usuario de staff con un rol personalizado (sin afiliado): /panel decide solo por `permisos`.
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

const nav = (page: Page, slug: string) => page.locator(`[data-testid="panel-nav-${slug}"]:visible`);
const STAFF = [...new Set(Object.values(NAV_PANEL))];
const AFILIADO = ['mi-expediente', 'estado-de-cuenta', 'catalogo-academico', 'mis-certificados'];
const staffVisibles = async (page: Page) => {
  const vis: string[] = [];
  for (const slug of STAFF) if ((await nav(page, slug).count()) > 0) vis.push(slug);
  return vis.sort();
};

test.describe('Navegación de /panel según la matriz de permisos (E2E)', () => {
  test('un rol personalizado solo ve sus secciones y no los ítems de afiliado', async ({ page }) => {
    await sesionCon(page, usuarioConRol({ afiliados: { ver: true }, marco_legal: { ver: true } }));

    await page.goto('/panel');
    await expect(page).toHaveURL(/\/panel/);
    await expect(nav(page, 'directorio-de-miembros')).toBeVisible();
    await expect(nav(page, 'cms-marco-legal')).toBeVisible();

    // `afiliados` abre el Directorio y las Solicitudes de Agentes (Afiliaciones es su propia sección); nada más del staff
    expect(await staffVisibles(page)).toEqual(
      ['cms-marco-legal', 'directorio-de-miembros', 'solicitudes-de-agentes'].sort(),
    );
    for (const slug of AFILIADO) await expect(nav(page, slug)).toHaveCount(0);
    // Aterriza en su primer ítem de staff
    await expect(nav(page, 'directorio-de-miembros').first()).toHaveAttribute('style', /--color-accent/);
  });

  test('`afiliaciones` abre solo el ítem Afiliaciones', async ({ page }) => {
    await sesionCon(page, usuarioConRol({ afiliaciones: { ver: true } }));

    await page.goto('/panel');
    await expect(nav(page, 'afiliaciones')).toBeVisible();
    expect(await staffVisibles(page)).toEqual(['afiliaciones']);
  });

  test('afiliado con rol de staff ve ambos grupos', async ({ page }) => {
    await sesionCon(page, { ...MOCK_AFILIADO_USER, roles: ['afiliado', 'lector'], rol: 'afiliado', permisos: { afiliados: { ver: true } } });

    await page.goto('/panel');
    await expect(nav(page, 'mi-expediente')).toBeVisible();
    await expect(nav(page, 'directorio-de-miembros')).toBeVisible();
    await expect(nav(page, 'control-de-finanzas')).toHaveCount(0);
    await expect(page.getByText('Administración', { exact: true }).locator('visible=true')).toHaveCount(1);
    await expect(page.getByText('Editor Web', { exact: true }).locator('visible=true')).toHaveCount(0);
  });

  test('super_admin ve «Roles y permisos», «Estudiantes» y «Administradores»', async ({ page }) => {
    await bloquearApi(page);
    await setupAdminMocks(page);
    await setupAdminAuth(page); // MOCK_ADMIN_USER sin `permisos`: super_admin pasa igual

    await page.goto('/panel');
    for (const slug of ['roles-y-permisos', 'estudiantes', 'administradores', 'analisis-y-metricas', 'cms-configuracion']) {
      await expect(nav(page, slug)).toBeVisible();
    }
  });

  test('sin `ver` en ninguna sección no hay grupo de staff', async ({ page }) => {
    await sesionCon(page, { ...MOCK_AFILIADO_USER, permisos: { finanzas: { ver: false, crear: true } } });

    await page.goto('/panel');
    await expect(nav(page, 'mi-expediente')).toBeVisible();
    expect(await staffVisibles(page)).toEqual([]);
    await expect(page.getByText('Administración', { exact: true }).locator('visible=true')).toHaveCount(0);
  });

  test('un usuario sin roles ni permisos no rompe el panel', async ({ page }) => {
    await sesionCon(page, usuarioConRol({}));

    await page.goto('/panel');
    await expect(nav(page, 'configuracion')).toBeVisible();
    expect(await staffVisibles(page)).toEqual([]);
  });

  // Fallback legacy: respuesta sin `permisos` (API vieja). Quitar cuando la API con permisos esté en todos lados.
  test('admin sin `permisos` en la respuesta conserva el sidebar de admin', async ({ page }) => {
    await sesionCon(page, { ...MOCK_ADMIN_USER, id: 2, roles: ['admin'], rol: 'admin' });

    await page.goto('/panel');
    await expect(nav(page, 'analisis-y-metricas')).toBeVisible();
    await expect(nav(page, 'directorio-de-miembros')).toBeVisible();
    await expect(nav(page, 'estudiantes')).toBeVisible();
    await expect(nav(page, 'roles-y-permisos')).toHaveCount(0);
    await expect(nav(page, 'administradores')).toHaveCount(0);
  });

  test('la ruta antigua /admin lleva a /panel', async ({ page }) => {
    await sesionCon(page, usuarioConRol({ afiliados: { ver: true } }));

    await page.goto('/admin');
    await expect(page).toHaveURL(/\/panel/);
    await expect(nav(page, 'directorio-de-miembros')).toBeVisible();
  });
});
