import { test, expect, Page, Locator } from '@playwright/test';
import { navPanel } from './helpers/panel-nav';

type Acciones = Partial<Record<'ver' | 'crear' | 'editar' | 'eliminar', boolean>>;

const usuario = (finanzas: Acciones) => ({
  id: 51,
  email: 'contador@ciebo.com',
  roles: ['contador'],
  rol: 'contador',
  nombres: 'Ana',
  apellidos: 'Contreras',
  nombre_completo: 'Ana Contreras',
  permisos: { finanzas },
});

const json = (data: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) });

// Mocks propios de Finanzas (los de setupAdminMocks no traen la forma que usa FinancePanel).
async function sesion(page: Page, finanzas: Acciones) {
  await page.setViewportSize({ width: 1280, height: 800 });
  // Ninguna llamada sale del navegador: lo no mockeado responde vacío.
  await page.route((url) => url.pathname.startsWith('/api/'), (route) => route.fulfill(json([])));
  await page.route('**/api/finanzas/resumen**', (route) => route.fulfill(json(null)));
  await page.route('**/api/finanzas/referencias**', (route) =>
    route.fulfill(json({ tasas: {
      USD_BCV: { codigo: 'USD_BCV', tasa: 875.65, fuente: 'BCV', es_manual: true },
      USDT_BINANCE: { codigo: 'USDT_BINANCE', tasa: 1008.45, fuente: 'Binance', es_manual: false },
    } })),
  );
  await page.route('**/api/finanzas/libro-ventas**', (route) =>
    route.fulfill(json({
      items: [{ id: 1, id_pago: 7, fecha: '2026-10-12', documento: 'R-0007', cliente: 'María Rodríguez', rif_cedula: 'V-1', concepto: 'Mensualidad', metodo_pago: 'zelle', monto_usd: 25, tipo_origen: 'pago' }],
      totales: { cantidadRegistros: 1, totalVentasUSD: 25 }, paginacion: null,
    })),
  );
  await page.route('**/api/finanzas/libro-compras**', (route) =>
    route.fulfill(json({
      items: [{ id_movimiento: 3, fecha: '2026-10-10', nro_factura_documento: 'F-100', proveedor: 'Hosting', rif_cedula: 'J-1', concepto: 'Servidor', categoria: 'servicios_publicos', monto_usd_equivalente: 120, estatus: 'pagado', comprobante_url: null }],
      totales: { cantidadRegistros: 1, totalComprasUSD: 120 }, paginacion: null,
    })),
  );
  await page.route('**/api/finanzas/cuentas-por-cobrar**', (route) =>
    route.fulfill(json({
      filas: [{ tipo: 'mensualidad', id_afiliado: 10, id_inscripcion: null, codigo: '001', nombre: 'Luis Pérez', identificacion: 'V-2', email: 'l@x', detalle: '2 meses', monto_usd: 20, dias: 45, tramo: '31-60' }],
      tramos: [{ tramo: '31-60', cantidad: 1, monto_usd: 20 }], total_usd: 20,
    })),
  );
  await page.route('**/api/pagos/admin/solvencia?**', (route) =>
    route.fulfill(json({
      inicio: '2026-01', mes_actual: '2026-11', anio: 2026, monto_mensual: 10,
      cobranza: { diaVencimiento: 5, diasAvisoPrevio: 3, frecuenciaMoraDias: 7, mesesGracia: 3 },
      afiliados: [{ id_afiliado: 10, codigo: '001', nombre: 'Luis Pérez', nombres: 'Luis', apellidos: 'Pérez', razon_social: null, cedula: 'V-2', rif: null, email: 'l@x', solvente: false, meses_deuda: 2, deuda_usd: 20, bloqueado: false, celdas: ['pagado', 'deuda', null, null, null, null, null, null, null, null, null, null] }],
    })),
  );
  await page.route('**/api/pagos/admin/cuentas', (route) =>
    route.fulfill(json([{ id_cuenta: 1, tipo: 'transferencia', banco: 'Banesco', beneficiario: 'CIEBO', identificacion: 'J-1', numero_cuenta: '0134', telefono: null, email: null, instrucciones: null, activo: 1 }])),
  );
  await page.route('**/api/pagos/modalidad', (route) => route.fulfill(json({ electronicos: true })));
  await page.route('**/api/pagos/aranceles', (route) =>
    route.fulfill(json([{ codigo: 'MENSUALIDAD', nombre: 'Mensualidad', descripcion: null, monto_usd: 10, categoria: 'mensualidad', activo: 1 }])),
  );
  for (const path of ['**/api/auth/me', '**/api/auth/refresh']) {
    await page.route(path, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, token: 'mock_jwt_rol', user: usuario(finanzas) }) }),
    );
  }
  await page.goto('/panel');
  await navPanel(page, 'finanzas').click();
  await expect(page.getByRole('heading', { name: 'Centro de Control Financiero' })).toBeVisible();
}

const tab = (page: Page, nombre: string | RegExp) => page.getByRole('button', { name: nombre }).first().click();
const presente = async (l: Locator, si: boolean) => (si ? expect(l.first()).toBeVisible() : expect(l).toHaveCount(0));

const SOLO_VER: Acciones = { ver: true };
const TODO: Acciones = { ver: true, crear: true, editar: true, eliminar: true };

for (const [nombre, permisos, si] of [['solo «ver»', SOLO_VER, false], ['las cuatro acciones', TODO, true]] as const) {
  test.describe(`Finanzas con ${nombre} (E2E)`, () => {
    test('controles del panel, libros, solvencia, cuentas por cobrar y tasas', async ({ page }) => {
      await sesion(page, permisos);
      const btn = (n: string | RegExp) => page.getByRole('button', { name: n });

      // Cabecera: los modales de consulta siempre se abren
      await expect(btn('Cuentas Receptoras')).toBeVisible();
      await expect(btn('Aranceles')).toBeVisible();
      await presente(btn('Registrar cobro'), si);
      await presente(btn('Registrar compra / gasto'), si);

      await tab(page, /Libro de Ventas/);
      await expect(page.getByText('R-0007')).toBeVisible();
      await expect(page.getByTitle('Ver Recibo Digital Oficial')).toBeVisible();
      await presente(btn('Anular pago R-0007'), si);

      await tab(page, /Libro de Compras/);
      await expect(page.getByText('F-100')).toBeVisible();
      await presente(btn('Nuevo gasto'), si);
      await presente(btn('Anular gasto F-100'), si);

      await tab(page, 'Solvencia');
      await expect(page.getByText('Luis Pérez')).toBeVisible();
      await presente(btn('Recordar a morosos'), si);
      await presente(btn('Registrar pago de Luis Pérez'), si);
      await presente(btn(/Corregir$/), si);
      await presente(page.getByRole('button', { name: 'Guardar', exact: true }), si);
      await page.getByText(/Calendario de cobranza/).click(); // abre el <details>
      await presente(page.getByRole('button', { name: 'Guardar calendario' }), si);

      await tab(page, 'Cuentas por cobrar');
      await expect(page.getByText('2 meses')).toBeVisible();
      await presente(btn('Enviar recordatorio a Luis Pérez'), si);

      await page.getByTestId('tab-tasas-referencias').click();
      await expect(page.getByTestId('card-tasa-bcv')).toBeVisible();
      await presente(page.getByTestId('btn-sincronizar-tasas'), si);
      await presente(page.getByTitle('Ajustar manualmente'), si);
      await presente(page.getByTitle('Restablecer a automático'), si);
    });

    test('modal de cuentas bancarias y modalidad', async ({ page }) => {
      await sesion(page, permisos);
      await page.getByRole('button', { name: 'Cuentas Receptoras' }).click();
      await expect(page.getByText('Banesco').first()).toBeVisible();
      const sw = page.getByRole('switch');
      await (si ? expect(sw).toBeEnabled() : expect(sw).toBeDisabled());
      await presente(page.getByRole('button', { name: 'Registrar Cuenta' }), si);
      await presente(page.getByTitle('Editar'), si);
      await presente(page.getByRole('button', { name: 'Eliminar la cuenta Banesco' }), si);
    });

    test('modal de aranceles', async ({ page }) => {
      await sesion(page, permisos);
      await page.getByRole('button', { name: 'Aranceles' }).click();
      await expect(page.getByText('Mensualidad', { exact: true })).toBeVisible();
      await presente(page.getByRole('button', { name: 'Modificar precio de MENSUALIDAD' }), si);
    });
  });
}

test('Finanzas: crear sin eliminar muestra alta de cuenta pero no el borrado', async ({ page }) => {
  await sesion(page, { ver: true, crear: true });
  await expect(page.getByRole('button', { name: 'Registrar cobro' })).toBeVisible();
  await page.getByRole('button', { name: 'Cuentas Receptoras' }).click();
  await expect(page.getByRole('button', { name: 'Registrar Cuenta' })).toBeVisible();
  await expect(page.getByTitle('Editar')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Eliminar la cuenta Banesco' })).toHaveCount(0);
});
