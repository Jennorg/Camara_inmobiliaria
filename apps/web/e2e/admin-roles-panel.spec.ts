import { test, expect, Page } from '@playwright/test';
import { setupAdminAuth, setupAdminMocks } from './helpers/mock-api';
import { navPanel } from './helpers/panel-nav';

const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });

const SECCIONES = [{ id: 'afiliados', label: 'Afiliados' }, { id: 'finanzas', label: 'Finanzas' }];
const ROLES = [
  { id: 1, clave: 'asistente', nombre: 'Asistente', es_sistema: 1, usuarios: 2, permisos: {} },
  { id: 2, clave: 'contador', nombre: 'Contador', es_sistema: 0, usuarios: 0, permisos: { finanzas: { ver: true, crear: true, editar: false, eliminar: false } } },
];

async function abrirRoles(page: Page) {
  await setupAdminAuth(page);
  await setupAdminMocks(page);
  // Registradas después: tienen prioridad. Nada sale a una API real.
  await page.route('**/api/roles/secciones', (r) => r.fulfill(json({ success: true, data: SECCIONES })));
  await page.route('**/api/roles', (r) => {
    if (r.request().method() === 'POST') return r.fulfill(json({ success: true, data: { id: 3, clave: 'nuevo', nombre: 'Nuevo' } }, 201));
    return r.fulfill(json({ success: true, data: ROLES }));
  });
  await page.goto('/panel');
  await navPanel(page, 'roles').click();
}

test.describe('Panel de roles y permisos (E2E)', () => {
  test('muestra la matriz, desmarcar Ver limpia el resto y guardar envía el PUT', async ({ page }) => {
    await abrirRoles(page);
    await page.getByRole('button', { name: /Contador/ }).click();

    const ver = page.getByLabel('Ver — Finanzas');
    const crear = page.getByLabel('Crear — Finanzas');
    await expect(ver).toBeChecked();
    await expect(crear).toBeChecked();
    await expect(page.getByLabel('Ver — Afiliados')).not.toBeChecked();
    await expect(page.getByLabel('Crear — Afiliados')).toBeDisabled();

    const guardar = page.getByRole('button', { name: 'Guardar' });
    await expect(guardar).toBeDisabled();

    await ver.uncheck();
    await expect(crear).toBeDisabled();
    await expect(crear).not.toBeChecked();
    await page.getByLabel('Marcar fila — Afiliados').check();
    await expect(page.getByText('Cambios sin guardar')).toBeVisible();

    let body: any;
    await page.route('**/api/roles/2', (r) => { body = r.request().postDataJSON(); expect(r.request().method()).toBe('PUT'); return r.fulfill(json({ success: true })); });
    await guardar.click();
    await expect(page.getByText('Rol guardado')).toBeVisible();
    expect(body.nombre).toBe('Contador');
    expect(body.permisos).toEqual({
      afiliados: { ver: true, crear: true, editar: true, eliminar: true },
      finanzas: { ver: false, crear: false, editar: false, eliminar: false },
    });
  });

  test('los roles del sistema no se pueden eliminar ni renombrar', async ({ page }) => {
    await abrirRoles(page);
    await expect(page.getByLabel('Nombre del rol')).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Eliminar' })).toBeDisabled();
  });

  test('«Nuevo rol» hace POST con la matriz vacía', async ({ page }) => {
    await abrirRoles(page);
    let body: any;
    await page.route('**/api/roles', (r) => {
      if (r.request().method() === 'POST') { body = r.request().postDataJSON(); return r.fulfill(json({ success: true, data: { id: 3 } }, 201)); }
      return r.fulfill(json({ success: true, data: ROLES }));
    });
    await page.getByRole('button', { name: 'Nuevo rol' }).click();
    await page.getByLabel('Nombre del nuevo rol').fill('Tesorero');
    await page.getByRole('button', { name: 'Crear' }).click();
    await expect(page.getByText('Rol creado')).toBeVisible();
    expect(body).toEqual({ nombre: 'Tesorero', permisos: {} });
  });
});
