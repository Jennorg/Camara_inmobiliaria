import { test, expect, Page, Locator } from '@playwright/test';
import { navPanel } from './helpers/panel-nav';

type Acciones = Partial<Record<'ver' | 'crear' | 'editar' | 'eliminar', boolean>>;
type Permisos = Record<string, Acciones>;

const usuario = (permisos: Permisos) => ({
  id: 52, email: 'gestor@ciebo.com', roles: ['gestor'], rol: 'gestor',
  nombres: 'Gea', apellidos: 'Soto', nombre_completo: 'Gea Soto', permisos,
});

const json = (data: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) });

const RESUMEN = {
  id_denuncia: 1, codigo: 'DEN-2026-001', titulo: 'Retención de llaves', nombre_denunciante: 'Ana Rojas', cedula_rif_denunciante: 'V-1',
  nombre_denunciado: 'Luis Pérez', codigo_afiliado_denunciado: 'A-1', tipo_falta: 'falta_etica', estatus: 'en_revision', prioridad: 'media',
  fecha_presentacion: '2026-10-10T16:00:00Z',
};
const DETALLE = { ...RESUMEN, descripcion: 'Hechos', notas_internas: '', historial: [], documentos: [] };

async function sesion(page: Page, permisos: Permisos) {
  await page.setViewportSize({ width: 1280, height: 800 });
  // Ninguna llamada sale del navegador: lo no mockeado responde vacío.
  await page.route((url) => url.pathname.startsWith('/api/'), (route) => route.fulfill(json([])));
  await page.route('**/api/denuncias/admin?**', (route) => route.fulfill(json({ denuncias: [RESUMEN], kpis: { total: 1 } })));
  await page.route('**/api/denuncias/admin/1', (route) => route.fulfill(json(DETALLE)));
  for (const path of ['**/api/auth/me', '**/api/auth/refresh']) {
    await page.route(path, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, token: 'mock_jwt_rol', user: usuario(permisos) }) }),
    );
  }
  await page.goto('/panel');
  await navPanel(page, 'denuncias').click();
  await page.getByText('DEN-2026-001').first().click();
  await expect(page.getByText('Retención de llaves').first()).toBeVisible();
}

const presente = async (l: Locator, si: boolean) => (si ? expect(l.first()).toBeVisible() : expect(l).toHaveCount(0));
const VER: Acciones = { ver: true };
const TODO: Acciones = { ver: true, crear: true, editar: true, eliminar: true };

for (const [nombre, acc, si] of [['solo «ver»', VER, false], ['las cuatro acciones', TODO, true]] as const) {
  test.describe(`Denuncias con ${nombre} (E2E)`, () => {
    test('acciones del caso, prioridad y notas', async ({ page }) => {
      await sesion(page, { denuncias: acc });
      await presente(page.getByRole('button', { name: /Convocar mediación/ }), si);
      await presente(page.getByRole('button', { name: /Emitir resolución/ }), si);
      await presente(page.getByRole('button', { name: /Pedirle su defensa/ }), si);
      await presente(page.getByRole('button', { name: /Archivar/ }), si);
      await presente(page.getByRole('button', { name: /Guardar/ }), si);
      const prioridad = page.locator('section[aria-labelledby="prio-caso"] select');
      await (si ? expect(prioridad).toBeEnabled() : expect(prioridad).toBeDisabled());
      const notas = page.getByLabel('Notas internas');
      await (si ? expect(notas).toBeEditable() : expect(notas).not.toBeEditable());
      if (!si) await expect(page.getByText(/Sin permiso para editar/).first()).toBeVisible();
    });
  });
}
