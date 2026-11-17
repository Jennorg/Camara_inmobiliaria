import { test, expect } from '@playwright/test';
import { setupAdminAuth, setupAdminMocks } from './helpers/mock-api';
import { navPanel } from './helpers/panel-nav';

// La inscripción quedó 'Inscrito' pero el afiliado sigue en Expediente: los botones los decide la etapa.
test('las acciones de una afiliación salen según la etapa del afiliado, no el estatus de la inscripción', async ({ page }) => {
  await setupAdminAuth(page);
  await setupAdminMocks(page);
  await page.route('**/api/academia/preinscripciones**', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ success: true, data: [{
      id_inscripcion: 1001, id_estudiante: 431, id_afiliado: 377, programa_codigo: 'AFILIACION',
      estudiante_nombre: 'Aspirante Desfasada', estudiante_nombres: 'Aspirante', estudiante_apellidos: 'Desfasada',
      estudiante_email: 'aspirante@test.com', estudiante_telefono: '+584140000000', estudiante_cedula: 'V-1', afiliado_tipo: 'Natural',
      estatus: 'Inscrito', afiliado_estatus: '2_EXPEDIENTE', num_documentos: 2, creado_en: '2026-11-13T16:20:23Z',
    }] }),
  }));

  await page.route('**/api/academia/estudiantes/*/documentos', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }),
  }));
  await page.goto('/panel');
  await navPanel(page, 'preinscripciones').click();
  await page.getByRole('button', { name: /Desfasada/ }).first().click();

  await expect(page.getByRole('button', { name: /Remitir a CIBIR/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Agendar Cita/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Aprobar CIBIR y Afiliar/i })).toHaveCount(0);
});
