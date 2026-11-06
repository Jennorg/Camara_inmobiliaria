import { test, expect, Page, Locator } from '@playwright/test';
import { navPanel } from './helpers/panel-nav';

type Acciones = Partial<Record<'ver' | 'crear' | 'editar' | 'eliminar', boolean>>;
type Permisos = Record<string, Acciones>;

const usuario = (permisos: Permisos) => ({
  id: 52, email: 'gestor@ciebo.com', roles: ['gestor'], rol: 'gestor',
  nombres: 'Gea', apellidos: 'Soto', nombre_completo: 'Gea Soto', permisos,
});

const json = (data: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) });

const NOTICIA = { id_noticia: 1, titulo: 'Noticia de prueba', resumen: 'Resumen', contenido: 'Cuerpo', categoria: 'Noticias', publicado: 1, orden: 1, fecha: '2026-03-01T00:00:00Z' };
const NORMATIVAS = [
  { id_normativa: 1, titulo: 'LEY UNO', url_archivo: 'https://x.test/a.pdf', categoria: 'Leyes y Decretos', orden: 1, activo: 1 },
  { id_normativa: 2, titulo: 'REGLAMENTO UNO', url_archivo: 'https://x.test/b.pdf', categoria: 'Reglamentos y Estatutos', orden: 1, activo: 1 },
];
const MIEMBRO = { id: 1, nombre: 'Rosa Díaz', cargo: 'Presidente', periodo: '2026-01/2028-12', activo: 1, orden: 1, foto_url: null };

async function sesion(page: Page, permisos: Permisos, seccion: string, esperar: string | RegExp) {
  await page.setViewportSize({ width: 1280, height: 800 });
  // Ninguna llamada sale del navegador: lo no mockeado responde vacío.
  await page.route((url) => url.pathname.startsWith('/api/'), (route) => route.fulfill(json([])));
  await page.route('**/api/cms/noticias', (route) => route.fulfill(json([NOTICIA])));
  await page.route('**/api/cms/normativas**', (route) => route.fulfill(json(NORMATIVAS)));
  await page.route('**/api/cms/directiva', (route) => route.fulfill(json([MIEMBRO])));
  for (const path of ['**/api/auth/me', '**/api/auth/refresh']) {
    await page.route(path, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, token: 'mock_jwt_rol', user: usuario(permisos) }) }),
    );
  }
  await page.goto('/panel');
  await navPanel(page, seccion).click();
  await expect(page.getByText(esperar).locator('visible=true').first()).toBeVisible();
}

const presente = async (l: Locator, si: boolean) => (si ? expect(l.first()).toBeVisible() : expect(l).toHaveCount(0));
const VER: Acciones = { ver: true };
const TODO: Acciones = { ver: true, crear: true, editar: true, eliminar: true };

for (const [nombre, acc, si] of [['solo «ver»', VER, false], ['las cuatro acciones', TODO, true]] as const) {
  test.describe(`CMS con ${nombre} (E2E)`, () => {
    test('noticias: nueva, editar, eliminar y reordenar', async ({ page }) => {
      await sesion(page, { noticias: acc }, 'noticias', 'Noticia de prueba');
      await presente(page.getByRole('button', { name: /Nueva Noticia/ }), si);
      await presente(page.getByTitle('Editar noticia'), si);
      await presente(page.getByTitle('Eliminar noticia'), si);
      await presente(page.getByTitle('Arrastrar para reordenar'), si);
    });

    test('leyes: nuevo, editar, eliminar y selección', async ({ page }) => {
      await sesion(page, { marco_legal: acc }, 'leyes', 'LEY UNO');
      await presente(page.getByRole('button', { name: /Nuevo Documento/ }), si);
      await presente(page.getByTitle('Editar documento'), si);
      await presente(page.getByTitle('Eliminar documento'), si);
      await presente(page.getByLabel('Seleccionar LEY UNO'), si);
    });

    test('directiva: nuevo miembro, editar, eliminar y estatus', async ({ page }) => {
      await sesion(page, { directiva: acc }, 'directiva', 'Rosa Díaz');
      await presente(page.getByRole('button', { name: /Nuevo Miembro/ }), si);
      const tabla = page.locator('table'); // la vista móvil (tarjetas) queda oculta en escritorio
      await presente(tabla.getByTitle('Editar', { exact: true }), si);
      await presente(tabla.getByTitle('Eliminar', { exact: true }), si);
      await presente(tabla.getByTitle('Arrastrar para reordenar'), si);
      const estado = tabla.getByRole('button', { name: 'Activo' }).first();
      await (si ? expect(estado).toBeEnabled() : expect(estado).toBeDisabled());
    });

    test('configuración: guardar y campos', async ({ page }) => {
      await sesion(page, { config: acc }, 'config', 'Canales de Contacto')
      await presente(page.getByRole('button', { name: /Sin Cambios|Guardar/ }), si);
      const campo = page.locator('input[type="url"]').first();
      await (si ? expect(campo).toBeEditable() : expect(campo).not.toBeEditable());
    });
  });
}

test('un solo permiso de Marco Legal cubre todas sus categorías (reglamentos)', async ({ page }) => {
  await sesion(page, { marco_legal: TODO }, 'reglamentos', 'REGLAMENTO UNO');
  await expect(page.getByRole('button', { name: /Nuevo Documento/ })).toBeVisible();
  await expect(page.getByTitle('Editar documento').first()).toBeVisible();
  await expect(page.getByTitle('Eliminar documento').first()).toBeVisible();
});

test('eliminar depende de «eliminar», no de «editar» (noticias)', async ({ page }) => {
  await sesion(page, { noticias: { ver: true, crear: true, editar: true, eliminar: false } }, 'noticias', 'Noticia de prueba');
  await expect(page.getByTitle('Editar noticia').first()).toBeVisible();
  await expect(page.getByTitle('Eliminar noticia')).toHaveCount(0);
});
