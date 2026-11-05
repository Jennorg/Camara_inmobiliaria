import { test, expect, Page, Locator } from '@playwright/test';

type Acciones = Partial<Record<'ver' | 'crear' | 'editar' | 'eliminar', boolean>>;
type Permisos = Record<string, Acciones>;

const usuario = (permisos: Permisos) => ({
  id: 52, email: 'gestor@ciebo.com', roles: ['gestor'], rol: 'gestor',
  nombres: 'Gea', apellidos: 'Soto', nombre_completo: 'Gea Soto', permisos,
});

const json = (data: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) });

const ASAMBLEA = {
  id_asamblea: 7, tipo: 'Ordinaria', numero_acta: '12', titulo: 'Asamblea anual 2026', fecha: '2026-03-10', hora: null, lugar: 'Sede',
  convocatoria: null, orden_del_dia: null, resumen: null, acuerdos: null, url_acta: null, quorum_pct: 50, total_miembros: 10,
  publicada: 0, asistentes: 1, quorum_requeridos: 5, quorum_alcanzado: false,
};
const DETALLE = { ...ASAMBLEA, asistencia: [{ id_afiliado: 3, codigo: 'A-3', nombre: 'Rosa Díaz', documento: 'V-3', condicion: 'Presente', representante: null }] };

async function sesion(page: Page, permisos: Permisos) {
  await page.setViewportSize({ width: 1280, height: 800 });
  // Ninguna llamada sale del navegador: lo no mockeado responde vacío.
  await page.route((url) => url.pathname.startsWith('/api/'), (route) => route.fulfill(json([])));
  await page.route('**/api/asambleas?**', (route) => route.fulfill(json([ASAMBLEA])));
  await page.route('**/api/asambleas/7', (route) => route.fulfill(json(DETALLE)));
  for (const path of ['**/api/auth/me', '**/api/auth/refresh']) {
    await page.route(path, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, token: 'mock_jwt_rol', user: usuario(permisos) }) }),
    );
  }
  await page.goto('/admin');
  await page.locator('[data-testid="aside-nav-asambleas"]:visible').first().click();
  await expect(page.getByText('Asamblea anual 2026')).toBeVisible();
}

const presente = async (l: Locator, si: boolean) => (si ? expect(l.first()).toBeVisible() : expect(l).toHaveCount(0));
const VER: Acciones = { ver: true };
const TODO: Acciones = { ver: true, crear: true, editar: true, eliminar: true };

for (const [nombre, acc, si] of [['solo «ver»', VER, false], ['las cuatro acciones', TODO, true]] as const) {
  test.describe(`Asambleas con ${nombre} (E2E)`, () => {
    test('listado: nueva asamblea', async ({ page }) => {
      await sesion(page, { asambleas: acc });
      await presente(page.getByRole('button', { name: /Nueva asamblea/ }), si);
    });

    test('ficha: guardar, eliminar y asistencia', async ({ page }) => {
      await sesion(page, { asambleas: acc });
      await page.getByRole('button', { name: /Asamblea anual 2026/ }).click();
      await expect(page.getByRole('heading', { name: 'Asistencia y quórum' })).toBeVisible();
      await presente(page.getByRole('button', { name: 'Guardar cambios' }), si);
      await presente(page.getByRole('button', { name: /^Eliminar/ }), si);
      await presente(page.getByLabel('Agregar asistente'), si);
      await presente(page.getByRole('button', { name: /Quitar a Rosa Díaz/ }), si);
      const titulo = page.getByLabel('Título');
      await (si ? expect(titulo).toBeEditable() : expect(titulo).not.toBeEditable());
      const condicion = page.getByLabel('Condición de Rosa Díaz');
      await (si ? expect(condicion).toBeEnabled() : expect(condicion).toBeDisabled());
    });
  });
}

test('eliminar depende de «eliminar», no de «editar»', async ({ page }) => {
  await sesion(page, { asambleas: { ver: true, crear: true, editar: true, eliminar: false } });
  await page.getByRole('button', { name: /Asamblea anual 2026/ }).click();
  await expect(page.getByRole('button', { name: 'Guardar cambios' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Eliminar/ })).toHaveCount(0);
});
