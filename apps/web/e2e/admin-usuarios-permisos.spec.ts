import { test, expect, Page, Locator } from '@playwright/test';

type Acciones = Partial<Record<'ver' | 'crear' | 'editar' | 'eliminar', boolean>>;
type Permisos = Record<string, Acciones>;

const usuario = (permisos: Permisos) => ({
  id: 52, email: 'gestor@ciebo.com', roles: ['gestor'], rol: 'gestor',
  nombres: 'Gea', apellidos: 'Soto', nombre_completo: 'Gea Soto', permisos,
});

const json = (data: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) });

const USERS = [
  { id: 3, email: 'ana@ciebo.com', nombre_completo: 'Ana Contreras', roles: ['afiliado'], rol: 'afiliado', activo: 1, creado_en: '2026-01-01' },
];

async function sesion(page: Page, permisos: Permisos) {
  await page.setViewportSize({ width: 1280, height: 800 });
  // Ninguna llamada sale del navegador: lo no mockeado responde vacío.
  await page.route((url) => url.pathname.startsWith('/api/'), (route) => route.fulfill(json([])));
  await page.route('**/api/users**', (route) => route.fulfill(json(USERS)));
  for (const path of ['**/api/auth/me', '**/api/auth/refresh']) {
    await page.route(path, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, token: 'mock_jwt_rol', user: usuario(permisos) }) }),
    );
  }
  await page.goto('/admin');
  await page.locator('[data-testid="aside-nav-users"]:visible').first().click();
  await page.getByRole('button', { name: 'Tabla' }).click();
}

const presente = async (l: Locator, si: boolean) => (si ? expect(l.first()).toBeVisible() : expect(l).toHaveCount(0));
const VER: Acciones = { ver: true };
const TODO: Acciones = { ver: true, crear: true, editar: true, eliminar: true };

for (const [nombre, acc, si] of [['solo «ver»', VER, false], ['las cuatro acciones', TODO, true]] as const) {
  test.describe(`Usuarios con ${nombre} (E2E)`, () => {
    test('invitar, contraseña, activar y eliminar', async ({ page }) => {
      await sesion(page, { users: acc });
      const fila = page.getByRole('row').filter({ hasText: 'ana@ciebo.com' });
      await expect(fila).toBeVisible();
      await presente(fila.getByRole('button', { name: /Invitar/ }), si);
      await presente(fila.getByRole('button', { name: /Contraseña/ }), si);
      await presente(fila.getByTitle('Eliminar usuario'), si);
      const estado = fila.getByRole('button', { name: /Activo/ });
      await (si ? expect(estado).toBeEnabled() : expect(estado).toBeDisabled());
      // Suplantar no depende de la matriz: un rol personalizado nunca lo ve
      await expect(fila.getByRole('button', { name: /Ingresar/ })).toHaveCount(0);
    });

    test('eliminar depende de «eliminar», no de «editar»', async ({ page }) => {
      await sesion(page, { users: { ver: true, crear: true, editar: true, eliminar: false } });
      const fila = page.getByRole('row').filter({ hasText: 'ana@ciebo.com' });
      await expect(fila.getByRole('button', { name: /Invitar/ })).toBeVisible();
      await expect(fila.getByTitle('Eliminar usuario')).toHaveCount(0);
    });
  });
}
