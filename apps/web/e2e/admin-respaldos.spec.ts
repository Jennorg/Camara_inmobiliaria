import { test, expect, Page } from '@playwright/test';
import { setupAdminAuth, setupAdminMocks } from './helpers/mock-api';
import { navPanel } from './helpers/panel-nav';

const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });

const RESPALDOS = [
  { id: 3, tipo: 'previo_restauracion', creado_en: '2026-11-08T22:00:00Z', creado_por: 'sa@ciebo.com', tablas: 48, filas: 7330, bytes: 245000 },
  { id: 2, tipo: 'automatico', creado_en: '2026-11-08T11:00:00Z', creado_por: null, tablas: 48, filas: 7300, bytes: 244000 },
  { id: 1, tipo: 'manual', creado_en: '2026-11-07T15:30:00Z', creado_por: 'sa@ciebo.com', tablas: 48, filas: 7000, bytes: 240000 },
];
const ESTADO = { success: true, data: { almacenamiento: true, conservar: { automatico: 7, manual: 20, previo_restauracion: 10 }, respaldos: RESPALDOS } };
// contenido de relleno: aquí solo importa que el navegador lo guarde como archivo
const PREVIO_B64 = Buffer.from('respaldo-previo').toString('base64');

async function abrirRespaldos(page: Page) {
  await setupAdminAuth(page);
  await setupAdminMocks(page);
  await page.route('**/api/respaldos', (r) => r.fulfill(json(ESTADO)));
  await page.goto('/panel');
  await navPanel(page, 'respaldos').click();
}

test.describe('Panel de respaldos (E2E)', () => {
  test('lista el historial y "Generar respaldo ahora" descarga el archivo', async ({ page }) => {
    await abrirRespaldos(page);
    await expect(page.getByRole('heading', { name: 'Respaldos' })).toBeVisible();
    await expect(page.getByText('Automático', { exact: true })).toBeVisible();
    await expect(page.getByText('Previo a restauración')).toBeVisible();
    await expect(page.getByText('7.330')).toBeVisible();

    await page.route('**/api/respaldos/generar', (r) =>
      r.fulfill({ status: 200, headers: { 'content-type': 'application/zip', 'content-disposition': 'attachment; filename="ciebo-respaldo-20261108-1800.zip"', 'access-control-expose-headers': 'Content-Disposition' }, body: 'datos' }));
    const descarga = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Generar respaldo ahora' }).click();
    expect((await descarga).suggestedFilename()).toBe('ciebo-respaldo-20261108-1800.zip');
  });

  test('restaurar exige escribir RESTAURAR, envía la confirmación y entrega el respaldo previo', async ({ page }) => {
    await abrirRespaldos(page);
    let cuerpo: unknown = null;
    await page.route('**/api/respaldos/1/restaurar', (r) => { cuerpo = r.request().postDataJSON(); return r.fulfill(json({ success: true, data: { tablas: 48, filas: 7000, omitidas: [], restaurado_de: '2026-11-07T15:30:00Z', respaldo_previo: { id: 4, nombre: 'ciebo-respaldo-previo.zip', contenido: PREVIO_B64 } } })); });

    await page.getByRole('row', { name: /Manual/ }).getByRole('button', { name: 'Restaurar este respaldo' }).click();
    const dialogo = page.getByRole('dialog');
    await expect(dialogo.getByText('Esto reemplaza TODOS los datos actuales.')).toBeVisible();
    const confirmar = dialogo.getByRole('button', { name: 'Restaurar', exact: true });
    await expect(confirmar).toBeDisabled();
    await dialogo.getByLabel(/Escribe/).fill('restaurar'); // en minúsculas no vale
    await expect(confirmar).toBeDisabled();
    await dialogo.getByLabel(/Escribe/).fill('RESTAURAR');
    await expect(confirmar).toBeEnabled();

    const descarga = page.waitForEvent('download');
    await confirmar.click();
    expect((await descarga).suggestedFilename()).toBe('ciebo-respaldo-previo.zip');
    await expect(page.getByRole('dialog')).toBeHidden();
    expect(cuerpo).toEqual({ confirmacion: 'RESTAURAR' });
  });

  test('un archivo que no es un respaldo se rechaza antes de pedir confirmación', async ({ page }) => {
    await abrirRespaldos(page);
    await page.route('**/api/respaldos/validar', (r) => r.fulfill(json({ success: false, message: 'El archivo no es un respaldo válido.' }, 400)));
    await page.locator('input[type="file"][accept*="zip"]').setInputFiles({ name: 'cualquiera.zip', mimeType: 'application/zip', buffer: Buffer.from('no') });
    await expect(page.getByText('El archivo no es un respaldo válido.')).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('un administrador que no es súper administrador no ve la sección', async ({ page }) => {
    const admin = { id: 2, email: 'admin2@ciebo.com', roles: ['admin'], rol: 'admin', nombre_completo: 'Admin Común', permisos: { afiliados: { ver: true } } };
    await page.setViewportSize({ width: 1280, height: 800 });
    await setupAdminMocks(page);
    for (const path of ['**/api/auth/me', '**/api/auth/refresh']) await page.route(path, (r) => r.fulfill(json({ success: true, token: 'mock_jwt_admin', user: admin })));
    await page.addInitScript((u) => { localStorage.setItem('auth_user', JSON.stringify(u)); localStorage.setItem('ciebo_token', 'mock_jwt_admin'); }, admin);
    await page.goto('/panel');
    await expect(navPanel(page, 'afiliados').or(navPanel(page, 'directorio'))).toBeVisible();
    await expect(page.locator('[data-testid="panel-nav-respaldos"]')).toHaveCount(0);
  });
});
