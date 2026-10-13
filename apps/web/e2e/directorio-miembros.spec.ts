import { test, expect } from '@playwright/test';
import { setupPublicMocks } from './helpers/mock-api';

test.describe('Directorio Público de Afiliados y Miembros (E2E)', () => {
  test.beforeEach(async ({ page }) => {
    await setupPublicMocks(page);
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test('debe cargar el directorio de miembros con selector de criterios según estándar GEMINI.md', async ({ page }) => {
    await page.goto('/miembros');
    await page.waitForLoadState('domcontentloaded');

    // Comprobar título del directorio
    await expect(page).toHaveTitle(/Directorio|Miembros|Afiliados|Cámara/i);

    // Selector de criterio a la izquierda del input de búsqueda (GEMINI.md)
    const btnCriterio = page.locator('button:has-text("Nombre"), button:has-text("Cédula / RIF"), button:has-text("Código")').first();
    await expect(btnCriterio).toBeVisible();

    // Input de búsqueda con placeholder contextual
    const inputBusqueda = page.locator('input[placeholder*="Buscar por"]');
    await expect(inputBusqueda).toBeVisible();
    await expect(inputBusqueda).toHaveAttribute('placeholder', /Buscar por nombre/i);

    // Debe mostrar los afiliados retornados por la API
    const body = page.locator('body');
    await expect(body).toContainText('María Rodríguez');
    await expect(body).toContainText('CIEBO-001');
  });

  test('debe cambiar de criterio de búsqueda y actualizar el placeholder correspondientemente', async ({ page }) => {
    await page.goto('/miembros');
    await page.waitForLoadState('domcontentloaded');

    // Abrir dropdown de criterios
    const btnCriterio = page.locator('button:has-text("Nombre")').first();
    await btnCriterio.click();

    // Seleccionar opción "Cédula / RIF"
    const opcionCedula = page.locator('button:has-text("Cédula / RIF")').last();
    await expect(opcionCedula).toBeVisible();
    await opcionCedula.click();

    // El placeholder del input debe cambiar contextualmente según GEMINI.md
    const inputBusqueda = page.locator('input[placeholder*="Buscar por"]');
    await expect(inputBusqueda).toHaveAttribute('placeholder', /cédula o RIF/i);
  });

  test('debe mostrar el botón de limpiar búsqueda (X) al escribir y permitir borrar el término', async ({ page }) => {
    await page.goto('/miembros');
    await page.waitForLoadState('domcontentloaded');

    const inputBusqueda = page.locator('input[placeholder*="Buscar por"]');
    await inputBusqueda.fill('María');

    // Botón de limpiar visible según GEMINI.md
    const btnClear = page.locator('main button:has(svg.lucide-x)').first();
    await expect(btnClear).toBeVisible();

    // Hacer clic en limpiar
    await btnClear.click();
    await expect(inputBusqueda).toHaveValue('');
  });

  test('debe acceder a la vista de perfil individual de un afiliado', async ({ page }) => {
    await page.route('**/api/public/afiliados/1', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id_afiliado: 1,
            codigo: 'CIEBO-001',
            nombre_completo: 'María Inés Rodríguez',
            nombres: 'María Inés',
            apellidos: 'Rodríguez',
            cedula: 'V-15678901',
            tipo_afiliado: 'Natural',
            estatus: 'Solvente',
            email: 'maria.rodriguez@email.com',
            telefono: '+58 414 1234567',
            nivel_profesional: 'Corredor Inmobiliario Certificado',
          },
        }),
      });
    });

    await page.goto('/miembros/1');
    await page.waitForLoadState('domcontentloaded');

    const body = page.locator('body');
    await expect(body).toContainText('María Rodríguez');
    await expect(body).toContainText('CIEBO-001');
  });
});
