import { test, expect } from '@playwright/test';
import { setupAfiliadoAuth } from './helpers/mock-api';

// Al día hasta noviembre, aunque la Cámara tenga configurado el pronto pago del año siguiente
test('el afiliado adelanta el próximo año a cuota normal: el pronto pago es solo de la administración', async ({ page }) => {
  await setupAfiliadoAuth(page);
  const anio = new Date().getFullYear();
  const meses = Array.from({ length: 11 }, (_, i) => ({ periodo: `${anio}-${String(i + 1).padStart(2, '0')}`, estado: 'pagado', pago: null }));
  meses.push({ periodo: `${anio}-12`, estado: 'por_pagar', pago: null });
  await page.route('**/api/pagos/solvencia/afiliado/10', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ success: true, data: {
      monto_mensual: 10, solvente: true, meses_deuda: 0, deuda_usd: 0, meses,
      oferta_anual: { anio: anio + 1, monto: 100, fecha_limite: `${anio}-12-24` },
    } }),
  }));

  await page.goto('/panel');
  await page.getByRole('button', { name: 'Estado de Cuenta' }).first().click();

  // El pronto pago del año solo lo registra la administración: aquí no se ofrece y adelantar va a cuota normal
  await expect(page.getByRole('button', { name: /Pagar hasta diciembre|Todo \d{4}/ })).toHaveCount(0);
  await page.getByRole('button', { name: /Ponerme al día/ }).click();
  await expect(page.getByText('Estimado: $10.00')).toBeVisible();
  await page.getByRole('button', { name: new RegExp(`diciembre de ${anio + 1}`, 'i') }).click();
  await expect(page.getByText('Estimado: $130.00')).toBeVisible();
});
