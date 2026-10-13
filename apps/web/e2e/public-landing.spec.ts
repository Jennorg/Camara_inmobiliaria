import { test, expect } from '@playwright/test';
import { setupPublicMocks } from './helpers/mock-api';

test.describe('Módulos Públicos: Landing, Cursos, Comprobantes y Denuncias (E2E)', () => {
  test.beforeEach(async ({ page }) => {
    await setupPublicMocks(page);
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test('debe cargar la Landing Page con estructura, barra de navegación y pie de página', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Título de la página
    await expect(page).toHaveTitle(/Cámara Inmobiliaria|CIEC|Cámara/i);

    // Navbar visible
    const nav = page.locator('header, nav').first();
    await expect(nav).toBeVisible();

    // Footer visible al pie
    const footer = page.locator('footer').first();
    await expect(footer).toBeVisible();
  });

  test('debe navegar al Catálogo de Cursos y visualizar programas de formación', async ({ page }) => {
    await page.goto('/cursos');
    await page.waitForLoadState('domcontentloaded');

    // Debe mostrar encabezado o título de formación / academia
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible();

    // Verificar que existen tarjetas o referencias a programas (CIV, CIBIR, etc.)
    const content = page.locator('body');
    await expect(content).toContainText(/Formación|Cursos|Academia|CIBIR/i);
  });

  test('debe cargar la página del programa CIBIR con sus módulos informativos', async ({ page }) => {
    await page.goto('/cibir');
    await page.waitForLoadState('domcontentloaded');

    await expect(page).toHaveTitle(/CIBIR|Iniciación|Bienes Raíces|Cámara/i);
    const body = page.locator('body');
    await expect(body).toContainText(/CIBIR/i);
  });

  test('debe cargar el canal institucional de Denuncias Éticas con pestañas de formular y consultar', async ({ page }) => {
    await page.goto('/denuncias');
    await page.waitForLoadState('domcontentloaded');

    // Verificar título o encabezado de denuncias / tribunal ético
    const body = page.locator('body');
    await expect(body).toContainText(/Tribunal|Denuncia|Ética/i);

    // Botones o pestañas para formular y consultar estado
    const tabFormular = page.locator('button:has-text("Formular"), button:has-text("Registrar")').first();
    const tabConsultar = page.locator('button:has-text("Consultar"), button:has-text("Seguimiento")').first();

    await expect(tabFormular).toBeVisible();
    await expect(tabConsultar).toBeVisible();
  });

  test('debe mostrar la vista pública de validación de comprobante digital', async ({ page }) => {
    // Interceptar API de comprobante público
    await page.route('**/api/public/comprobantes/VALID-TEST-123', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            codigo_validacion: 'VALID-TEST-123',
            fecha_emision: '2026-10-12',
            titular_nombre: 'María Inés Rodríguez',
            cedula: 'V-15678901',
            programa_o_curso: 'Curso de Iniciación en Bienes Raíces (CIBIR)',
            programa_codigo: 'CIBIR',
            vigente: true,
          },
        }),
      });
    });

    await page.goto('/comprobante/VALID-TEST-123');
    await page.waitForLoadState('domcontentloaded');

    const body = page.locator('body');
    await expect(body).toContainText('Comprobante de aprobación digital');
    await expect(body).toContainText('María Rodríguez');
  });
});
