import { test, expect, Page, Locator } from '@playwright/test';
import { navPanel } from './helpers/panel-nav';

type Acciones = Partial<Record<'ver' | 'crear' | 'editar' | 'eliminar', boolean>>;
type Permisos = Record<string, Acciones>;

const usuario = (permisos: Permisos) => ({
  id: 52, email: 'gestor@ciebo.com', roles: ['gestor'], rol: 'gestor',
  nombres: 'Gea', apellidos: 'Soto', nombre_completo: 'Gea Soto', permisos,
});

const json = (data: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) });

const AFILIADO = {
  id_afiliado: 10, nombre_completo: 'Luis Pérez', nombres: 'Luis', apellidos: 'Pérez', email: 'l@x.com',
  tipo_afiliado: 'Natural', estatus: '1_PREINSCRIPCION', codigo: null, fecha_registro: '2026-10-01', cibir_acreditado: 0,
};
const SOLICITUD = {
  id_solicitud: 5, tipo_actual: 'Natural', tipo_solicitado: 'Natural', afiliado_nombre: 'Luis Pérez',
  afiliado_email: 'l@x.com', afiliado_telefono: null, creado_en: '2026-10-02T10:00:00Z',
};

async function sesion(page: Page, permisos: Permisos, seccion: 'afiliados' | 'solicitudes_cambio') {
  await page.setViewportSize({ width: 1280, height: 800 });
  // Ninguna llamada sale del navegador: lo no mockeado responde vacío.
  await page.route((url) => url.pathname.startsWith('/api/'), (route) => route.fulfill(json([])));
  await page.route('**/api/afiliados?**', (route) => route.fulfill(json([AFILIADO])));
  await page.route('**/api/afiliados/10', (route) => route.fulfill(json(AFILIADO)));
  await page.route('**/api/afiliados/admin/solicitudes-cambio', (route) => route.fulfill(json([SOLICITUD])));
  await page.route('**/api/pagos/afiliado/10', (route) =>
    route.fulfill(json([{ id_pago: 1, estatus: 'Pendiente', numero_recibo: 'R-0001', metodo_pago: 'zelle', referencia: '123', monto: 30, moneda: 'USD' }])),
  );
  for (const path of ['**/api/auth/me', '**/api/auth/refresh']) {
    await page.route(path, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, token: 'mock_jwt_rol', user: usuario(permisos) }) }),
    );
  }
  await page.goto('/panel');
  await navPanel(page, seccion).click();
}

const presente = async (l: Locator, si: boolean) => (si ? expect(l.first()).toBeVisible() : expect(l).toHaveCount(0));
const VER: Acciones = { ver: true };
const TODO: Acciones = { ver: true, crear: true, editar: true, eliminar: true };

for (const [nombre, acc, si] of [['solo «ver»', VER, false], ['las cuatro acciones', TODO, true]] as const) {
  test.describe(`Afiliados con ${nombre} (E2E)`, () => {
    test('detalle: aprobar/rechazar, proceso y pagos', async ({ page }) => {
      await sesion(page, { afiliados: acc, finanzas: acc }, 'afiliados');
      await page.getByRole('button', { name: /Luis Pérez/ }).click();
      await expect(page.getByText('Gestión del Proceso')).toBeVisible();
      await presente(page.getByRole('button', { name: /Aprobar Directo/ }), si);
      await presente(page.getByRole('button', { name: /Rechazar/ }), si);
      const estado = page.locator('select').filter({ has: page.locator('option[value="6_INSCRIPCION"]') }).last();
      await (si ? expect(estado).toBeEnabled() : expect(estado).toBeDisabled());
      await presente(page.getByRole('button', { name: /Revisar y Validar Pago/ }), si);
      await presente(page.getByRole('button', { name: /Cobro en Taquilla/ }), si);
      // Campos del perfil: editables solo con «editar»; sin permiso, solo lectura con motivo visible
      for (const campo of ['Nombres', 'Apellidos', 'Teléfono']) {
        const input = page.locator('div', { has: page.getByText(campo, { exact: true }) }).locator('input').last();
        await (si ? expect(input).toBeEditable() : expect(input).not.toBeEditable());
      }
      if (!si) await expect(page.getByTitle('Sin permiso para editar').first()).toBeVisible();
    });

    test('los pagos dependen de finanzas, no de afiliados', async ({ page }) => {
      await sesion(page, { afiliados: TODO, finanzas: VER }, 'afiliados');
      await page.getByRole('button', { name: /Luis Pérez/ }).click();
      await expect(page.getByRole('button', { name: /Aprobar Directo/ })).toBeVisible();
      await expect(page.getByRole('button', { name: /Revisar y Validar Pago/ })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /Cobro en Taquilla/ })).toHaveCount(0);
    });

    test('solicitudes de cambio: resolver', async ({ page }) => {
      await sesion(page, { solicitudes_cambio: acc }, 'solicitudes_cambio');
      await page.getByText(/Solicitud #5/).click();
      await expect(page.getByText('Solicitud de: Luis Pérez')).toBeVisible();
      await presente(page.getByRole('button', { name: 'Aprobar Cambio' }), si);
      await presente(page.getByRole('button', { name: 'Rechazar' }), si);
    });
  });
}
