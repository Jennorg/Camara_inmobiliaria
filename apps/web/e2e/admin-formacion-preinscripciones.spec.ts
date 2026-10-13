import { test, expect } from '@playwright/test';
import { setupAdminAuth, setupAdminMocks } from './helpers/mock-api';

test.describe('Módulo Administrativo: Formación, Cursos y Preinscripciones (E2E)', () => {
  test.beforeEach(async ({ page }) => {
    await setupAdminAuth(page);
    await setupAdminMocks(page);
  });

  test('debe navegar al panel de Formación y alternar entre Cursos y Ediciones CIBIR', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('domcontentloaded');

    const navFormacion = page.locator('[data-testid="aside-nav-formacion"]:visible');
    await expect(navFormacion).toBeVisible();
    await navFormacion.click();

    // Pestañas internas
    const tabCursos = page.locator('button:has-text("Cursos y Talleres")');
    const tabCibir = page.locator('button:has-text("Ediciones CIBIR")');

    await expect(tabCursos).toBeVisible();
    await expect(tabCibir).toBeVisible();

    // Hacer clic en Ediciones CIBIR
    await tabCibir.click();
    await expect(tabCibir).toHaveClass(/text-emerald-700|bg-emerald-50/);
  });

  test('debe navegar a la sección de Preinscripciones y listar los aspirantes', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('domcontentloaded');

    const navPreins = page.locator('[data-testid="aside-nav-preinscripciones"]:visible');
    await expect(navPreins).toBeVisible();
    await navPreins.click();

    // Comprobar que carga el panel de preinscripciones y muestra aspirante
    const body = page.locator('body');
    await expect(body).toContainText(/Preinscripciones|Aspirantes|CIBIR/i);
    await expect(body).toContainText('Alejandro Vargas');
  });

  test('debe navegar al panel de Estudiantes Regulares', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('domcontentloaded');

    const navEstudiantes = page.locator('[data-testid="aside-nav-estudiantes"]:visible');
    await expect(navEstudiantes).toBeVisible();
    await navEstudiantes.click();

    // Comprobar que carga el listado de estudiantes regulares
    const body = page.locator('body');
    await expect(body).toContainText(/Estudiantes|Inscripciones/i);
    await expect(body).toContainText('Alejandro Vargas');
  });
});
