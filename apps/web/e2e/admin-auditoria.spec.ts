import { test, expect, Page } from '@playwright/test';
import { setupAdminAuth, setupAdminMocks } from './helpers/mock-api';
import { navPanel } from './helpers/panel-nav';

const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });

const REGISTROS = [
  { id: 2, creado_en: '2026-11-08T22:00:00Z', email: 'ana@ciebo.com', nombre_usuario: 'Ana Contreras', rol: 'admin', suplantado_por: null, accion: 'eliminar', modulo: 'cms', entidad: 'noticias', id_entidad: '12', resumen: 'eliminar · noticias #12', antes: JSON.stringify({ titulo: 'Título original', publicado: 1 }), despues: null, ip: null },
  { id: 1, creado_en: '2026-11-08T21:00:00Z', email: 'luis@ciebo.com', nombre_usuario: null, rol: 'admin', suplantado_por: 99, accion: 'editar', modulo: 'afiliados', entidad: 'afiliados', id_entidad: '7', resumen: 'editar · afiliados #7', antes: JSON.stringify({ telefono: '0414-1' }), despues: JSON.stringify({ telefono: '0414-2' }), ip: null },
];
const PAPELERA = [{ tipo: 'noticias', etiqueta: 'Noticias', id: 12, nombre: 'Título original', eliminado_en: '2026-11-08T22:00:00Z', eliminado_por: 'ana@ciebo.com' }];

async function abrir(page: Page) {
  await setupAdminAuth(page);
  await setupAdminMocks(page);
  await page.route('**/api/auditoria/filtros', (r) => r.fulfill(json({ success: true, data: { acciones: ['editar', 'eliminar'], modulos: ['afiliados', 'cms'], usuarios: ['ana@ciebo.com', 'luis@ciebo.com'] } })));
  await page.route('**/api/auditoria?**', (r) => r.fulfill(json({ success: true, data: REGISTROS, total: 2, pagina: 1, porPagina: 50 })));
  await page.route('**/api/auditoria/papelera**', (r) => {
    if (r.request().method() === 'GET') return r.fulfill(json({ success: true, data: PAPELERA, tipos: { noticias: 'Noticias', cursos: 'Cursos y programas' } }));
    return r.fulfill(json({ success: true }));
  });
  await page.goto('/panel');
  await navPanel(page, 'auditoria').click();
}

test.describe('Auditoría y papelera (E2E)', () => {
  test('muestra quién hizo qué y despliega el antes y el después', async ({ page }) => {
    await abrir(page);
    await expect(page.getByRole('heading', { name: 'Auditoría y papelera' })).toBeVisible();
    await expect(page.getByText('Ana Contreras')).toBeVisible();
    await expect(page.getByRole('table').getByText('Eliminó', { exact: true })).toBeVisible();
    await expect(page.getByText('Sesión suplantada por el usuario #99')).toBeVisible();

    await page.getByRole('button', { name: 'Ver antes y después' }).last().click();
    await expect(page.getByText('0414-1')).toBeVisible();
    await expect(page.getByText('0414-2')).toBeVisible();
  });

  test('filtrar por acción vuelve a consultar con ese filtro', async ({ page }) => {
    await abrir(page);
    const consulta = page.waitForRequest((r) => r.url().includes('/api/auditoria?') && r.url().includes('accion=editar'));
    await page.getByLabel('Acción').selectOption('editar');
    await consulta;
  });

  test('papelera: restaurar y eliminar definitivamente exige escribir ELIMINAR', async ({ page }) => {
    await abrir(page);
    await page.getByRole('tab', { name: 'Papelera' }).click();
    await expect(page.getByText('Título original')).toBeVisible();
    await expect(page.getByText('ana@ciebo.com')).toBeVisible();

    const restaurar = page.waitForRequest((r) => r.url().includes('/papelera/noticias/12/restaurar') && r.method() === 'POST');
    await page.getByRole('button', { name: 'Restaurar Título original' }).click();
    await restaurar;

    await page.getByRole('button', { name: 'Eliminar definitivamente Título original' }).click();
    const dialogo = page.getByRole('dialog');
    const eliminar = dialogo.getByRole('button', { name: 'Eliminar', exact: true });
    await expect(eliminar).toBeDisabled();
    await dialogo.getByLabel(/Escribe/).fill('ELIMINAR');
    const borrado = page.waitForRequest((r) => r.url().includes('/papelera/noticias/12?confirmacion=ELIMINAR') && r.method() === 'DELETE');
    await eliminar.click();
    await borrado;
  });

  test('una preinscripción eliminada se puede restaurar; si choca con un re-registro se explica por qué', async ({ page }) => {
    await abrir(page);
    await page.route('**/api/auditoria/papelera**', (r) => {
      if (r.request().method() === 'GET') return r.fulfill(json({ success: true, data: [{ tipo: 'preinscripcion', etiqueta: 'Preinscripciones', id: 5, nombre: 'Preinscripción #40 — María Pérez (AFILIACION)', eliminado_en: '2026-11-08T22:00:00Z', eliminado_por: 'ana@ciebo.com' }], tipos: { preinscripcion: 'Preinscripciones', afiliado: 'Afiliados' } }));
      return r.fulfill(json({ success: false, message: 'No se pudo restaurar: ya existe un registro con los mismos datos (¿la persona se volvió a registrar?). No se modificó nada.' }, 409));
    });
    await page.getByRole('tab', { name: 'Papelera' }).click();
    await expect(page.getByText('Preinscripción #40 — María Pérez (AFILIACION)')).toBeVisible();
    await expect(page.getByLabel('Tipo').locator('option', { hasText: 'Afiliados' })).toHaveCount(1);
    await page.getByRole('button', { name: /^Restaurar Preinscripción #40/ }).click();
    await expect(page.getByText(/se volvió a registrar/)).toBeVisible();
  });

  test('un administrador que no es súper administrador no ve la sección', async ({ page }) => {
    const admin = { id: 2, email: 'admin2@ciebo.com', roles: ['admin'], rol: 'admin', nombre_completo: 'Admin Común', permisos: { afiliados: { ver: true } } };
    await page.setViewportSize({ width: 1280, height: 800 });
    await setupAdminMocks(page);
    for (const path of ['**/api/auth/me', '**/api/auth/refresh']) await page.route(path, (r) => r.fulfill(json({ success: true, token: 'mock_jwt_admin', user: admin })));
    await page.addInitScript((u) => { localStorage.setItem('auth_user', JSON.stringify(u)); localStorage.setItem('ciebo_token', 'mock_jwt_admin'); }, admin);
    await page.goto('/panel');
    await expect(navPanel(page, 'afiliados').or(navPanel(page, 'directorio'))).toBeVisible();
    await expect(page.locator('[data-testid="panel-nav-auditoria-y-papelera"]')).toHaveCount(0);
  });
});
