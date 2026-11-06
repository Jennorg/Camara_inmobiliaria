import { test, expect, Page } from '@playwright/test';
import { setupAdminAuth, setupAdminMocks } from './helpers/mock-api';

const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });

const ROLES = [
  { id: 9, clave: 'admin', nombre: 'Administrador', es_sistema: 1, usuarios: 1, permisos: {} },
  { id: 1, clave: 'asistente', nombre: 'Asistente', es_sistema: 1, usuarios: 1, permisos: {} },
  { id: 2, clave: 'contador', nombre: 'Contador', es_sistema: 0, usuarios: 1, permisos: {} },
];
const USERS = [
  { id: 1, email: 'admin@ciebo.com', nombre_completo: 'Administrador Principal', roles: ['super_admin'], rol: 'super_admin', activo: 1, creado_en: '2026-01-01' },
  { id: 2, email: 'asis@ciebo.com', nombre_completo: 'Asistente Uno', roles: ['afiliado', 'asistente'], rol: 'asistente', activo: 1, creado_en: '2026-01-01' },
  { id: 3, email: 'ana@ciebo.com', nombre_completo: 'Ana Contreras', roles: ['contador'], rol: 'personal', activo: 1, creado_en: '2026-01-01' },
  { id: 4, email: 'viejo@ciebo.com', nombre_completo: 'Rol Borrado', roles: ['tesorero_viejo'], rol: 'afiliado', activo: 1, creado_en: '2026-01-01' },
];

async function abrirUsuarios(page: Page, rolesFallan = false) {
  await setupAdminAuth(page);
  await setupAdminMocks(page);
  // Registradas después: tienen prioridad. Nada sale a una API real.
  await page.route('**/api/users**', (r) => r.fulfill(json({ success: true, data: USERS })));
  await page.route('**/api/roles', (r) => r.fulfill(rolesFallan
    ? json({ success: false, message: 'Error al listar los roles' }, 500)
    : json({ success: true, data: ROLES })));
  await page.goto('/admin');
  await page.locator('[data-testid="aside-nav-users"]:visible').first().click();
  await page.getByRole('button', { name: 'Tabla' }).click();
}

const fila = (page: Page, email: string) => page.getByRole('row').filter({ hasText: email });

test.describe('Usuarios: asignar roles y alta de staff (E2E)', () => {
  test('el selector de rol ofrece los roles creados y los asigna con PUT', async ({ page }) => {
    await abrirUsuarios(page);
    const selector = fila(page, 'ana@ciebo.com').getByRole('combobox');
    await expect(selector).toHaveCount(1);
    await expect(selector).toHaveValue('contador'); // su rol creado, no «Afiliado»
    // opciones: Afiliado, roles creados (sin el antiguo «Personal Admin»), Admin y Super Admin
    await expect(selector.locator('option')).toHaveText(['Afiliado', 'Asistente', 'Contador', 'Admin', 'Super Admin']);
    let body: any;
    await page.route('**/api/roles/usuarios/3', (r) => {
      expect(r.request().method()).toBe('PUT');
      body = r.request().postDataJSON();
      return r.fulfill(json({ success: true, data: { id: 3, roles: ['asistente'] } }));
    });
    await selector.selectOption('asistente');
    await expect.poll(() => body).toEqual({ roles: ['asistente'] });
    // con un solo rol creado, el selector ya lo muestra (sin chip repetido)
    await expect(fila(page, 'ana@ciebo.com').locator('span', { hasText: /^Contador$/ })).toHaveCount(0);
    // un rol que ya no existe en el catálogo se ve como «Personal», no «Afiliado»
    await expect(fila(page, 'viejo@ciebo.com').getByText('Personal', { exact: true })).toBeVisible();
    await expect(fila(page, 'admin@ciebo.com').getByRole('button', { name: 'Roles' })).toBeDisabled();
  });

  test('marcar un rol y guardar envía el PUT con la lista', async ({ page }) => {
    await abrirUsuarios(page);
    const abrir = fila(page, 'asis@ciebo.com').getByRole('button', { name: 'Roles' });

    // Escape cierra y devuelve el foco al botón
    await abrir.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(abrir).toBeFocused();

    await abrir.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByLabel('Asistente')).toBeChecked();
    await expect(dialog.getByLabel('Administrador')).toHaveCount(0);
    await expect(dialog.getByText(/Se conservan automáticamente: Afiliado/)).toBeVisible();

    let body: any;
    await page.route('**/api/roles/usuarios/2', (r) => {
      expect(r.request().method()).toBe('PUT');
      body = r.request().postDataJSON();
      return r.fulfill(json({ success: true, data: { roles: ['afiliado', 'asistente', 'contador'] } }));
    });
    await dialog.getByLabel('Contador').check();
    await dialog.getByRole('button', { name: 'Guardar roles' }).click();
    await expect(page.getByText('Roles de asis@ciebo.com actualizados')).toBeVisible();
    expect(body).toEqual({ roles: ['asistente', 'contador'] });
  });

  test('sin catálogo de roles no se puede asignar ni crear staff; Reintentar lo recupera', async ({ page }) => {
    let puts = 0;
    await page.route('**/api/roles/usuarios/**', (r) => { puts++; return r.fulfill(json({ success: true })); });
    await abrirUsuarios(page, true);
    await expect(page.locator('#roles-catalogo-estado')).toContainText('No se pudieron cargar los roles');
    const roles = fila(page, 'asis@ciebo.com').getByRole('button', { name: 'Roles' });
    await expect(roles).toBeDisabled();
    await expect(roles).toHaveAccessibleDescription('No se pudieron cargar los roles');
    await expect(page.getByRole('button', { name: 'Nuevo usuario de staff' })).toBeDisabled();
    await roles.click({ force: true });
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(puts).toBe(0);

    await page.route('**/api/roles', (r) => r.fulfill(json({ success: true, data: ROLES })));
    await page.getByRole('button', { name: 'Reintentar' }).click();
    await expect(roles).toBeEnabled();
    await expect(page.locator('#roles-catalogo-estado')).toHaveCount(0);
  });

  test('un rol fuera del catálogo se avisa y no se guarda una lista vacía', async ({ page }) => {
    await abrirUsuarios(page);
    await expect(fila(page, 'admin@ciebo.com').getByRole('button', { name: 'Roles' })).toHaveAccessibleDescription('No puedes cambiar tus propios roles');
    await fila(page, 'viejo@ciebo.com').getByRole('button', { name: 'Roles' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText(/se quitarán al guardar: tesorero_viejo/)).toBeVisible();
    const guardar = dialog.getByRole('button', { name: 'Guardar roles' });
    await expect(guardar).toBeDisabled();
    await dialog.getByLabel('Contador').check();
    await expect(guardar).toBeEnabled();
  });

  test('muestra el error del servidor al asignar', async ({ page }) => {
    await abrirUsuarios(page);
    await page.route('**/api/roles/usuarios/3', (r) => r.fulfill(json({ success: false, message: 'Roles no válidos: x' }, 400)));
    await fila(page, 'ana@ciebo.com').getByRole('button', { name: 'Roles' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Guardar roles' }).click();
    await expect(page.getByText('Roles no válidos: x')).toBeVisible();
  });

  test('«Nuevo usuario de staff» valida, hace POST y avisa si falló la invitación', async ({ page }) => {
    await abrirUsuarios(page);
    let body: any;
    await page.route('**/api/roles/staff', (r) => {
      body = r.request().postDataJSON();
      return r.fulfill(json({ success: true, data: { id: 4, ...body, invitacion_enviada: false } }, 201));
    });
    await page.getByRole('button', { name: 'Nuevo usuario de staff' }).click();
    const dialog = page.getByRole('dialog');
    const crear = dialog.getByRole('button', { name: 'Crear usuario' });

    await crear.click();
    await expect(dialog.getByText('Escribe el nombre.')).toBeVisible();
    await dialog.getByLabel('Nombre').fill('Luis Pérez');
    await dialog.getByLabel('Correo').fill('luis@');
    await crear.click();
    await expect(dialog.getByText('Escribe un correo válido.')).toBeVisible();
    await dialog.getByLabel('Correo').fill('luis@ciebo.com');
    await crear.click();
    await expect(dialog.getByText('Marca al menos un rol.')).toBeVisible();
    expect(body).toBeUndefined();

    await dialog.getByLabel('Contador').check();
    await crear.click();
    await expect(dialog.getByRole('alert')).toContainText('fue creado, pero falló el envío del correo de invitación');
    expect(body).toEqual({ nombre: 'Luis Pérez', email: 'luis@ciebo.com', roles: ['contador'] });
  });

  test('«Nuevo usuario de staff» muestra el 409 del servidor', async ({ page }) => {
    await abrirUsuarios(page);
    await page.route('**/api/roles/staff', (r) => r.fulfill(json({ success: false, message: 'Ya existe un usuario con ese email' }, 409)));
    await page.getByRole('button', { name: 'Nuevo usuario de staff' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Nombre').fill('Ana');
    await dialog.getByLabel('Correo').fill('ana@ciebo.com');
    await dialog.getByLabel('Asistente').check();
    await dialog.getByRole('button', { name: 'Crear usuario' }).click();
    await expect(dialog.getByText('Ya existe un usuario con ese email')).toBeVisible();
  });
});
