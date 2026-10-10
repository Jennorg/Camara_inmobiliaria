import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test('debe cargar la página de inicio correctamente', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Cámara Inmobiliaria|CIEC|Cámara/i);
  });
});
