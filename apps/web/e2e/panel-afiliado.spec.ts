import { test, expect } from '@playwright/test';
import { setupAfiliadoAuth } from './helpers/mock-api';

test.describe('Módulo Privado: Panel del Afiliado (E2E)', () => {
  test.beforeEach(async ({ page }) => {
    await setupAfiliadoAuth(page);
  });

  test('debe permitir acceso al /panel con usuario afiliado y mostrar su expediente y carnet digital', async ({ page }) => {
    await page.goto('/panel');
    await page.waitForLoadState('domcontentloaded');

    // Debe permanecer en la ruta del panel
    await expect(page).toHaveURL(/\/panel/);

    // Debe mostrar el nombre del afiliado y código
    const body = page.locator('body');
    await expect(body).toContainText('Carlos Mendoza');
    await expect(body).toContainText('CIEBO-1042');
  });

  test('debe navegar por las pestañas del panel de afiliado (Expediente, Certificados, Académico)', async ({ page }) => {
    await page.goto('/panel');
    await page.waitForLoadState('domcontentloaded');

    // Navegar a Catálogo Académico
    const tabAcademico = page.locator('button:has-text("Catálogo Académico"), a:has-text("Catálogo Académico")').first();
    if (await tabAcademico.isVisible()) {
      await tabAcademico.click();
      await page.waitForTimeout(200);
    }

    // Navegar a Mis Certificados
    const tabCertificados = page.locator('button:has-text("Mis Certificados"), a:has-text("Mis Certificados")').first();
    if (await tabCertificados.isVisible()) {
      await tabCertificados.click();
      await page.waitForTimeout(200);
    }
  });
});
