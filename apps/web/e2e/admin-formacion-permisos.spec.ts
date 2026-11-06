import { test, expect, Page, Locator } from '@playwright/test';
import { navPanel } from './helpers/panel-nav';

type Acciones = Partial<Record<'ver' | 'crear' | 'editar' | 'eliminar', boolean>>;
type Permisos = Record<string, Acciones>;

const usuario = (permisos: Permisos) => ({
  id: 52, email: 'gestor@ciebo.com', roles: ['gestor'], rol: 'gestor',
  nombres: 'Gea', apellidos: 'Soto', nombre_completo: 'Gea Soto', permisos,
});

const json = (data: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) });

const CURSO = {
  id_curso: 1, id_instructor: 1, nombre: 'Curso Demo', titulo: 'Curso Demo', descripcion: null, imagen_url: null, programa_codigo: null,
  nivel_academico: null, cupos_totales: 20, cupos_disponibles: 18, fecha_inicio: '2026-06-01', fecha_fin: '2026-07-01', estatus: 'Abierto',
  requiere_aprobacion: 1, creado_en: '2026-01-01', actualizado_en: null, num_estudiantes: 2,
};
const fila = (id: number, nombre: string, estatus: string) => ({
  id_inscripcion: id, id_curso: 1, id_estudiante: id, estudiante_nombre: nombre, estudiante_nombres: nombre.split(' ')[0], estudiante_apellidos: nombre.split(' ')[1], estudiante_email: `${nombre.split(' ')[0].toLowerCase()}@x.test`,
  estudiante_cedula: `V-${id}`, estatus, completado: 0, creado_en: '2026-02-01',
});
const INSCRITOS = [fila(11, 'Pedro Nuevo', 'Preinscrito'), fila(12, 'Lucia Inscrita', 'Inscrito')];

async function sesion(page: Page, permisos: Permisos, seccion: string) {
  await page.setViewportSize({ width: 1280, height: 800 });
  // Ninguna llamada sale del navegador: lo no mockeado responde vacío.
  await page.route((url) => url.pathname.startsWith('/api/'), (route) => route.fulfill(json([])));
  await page.route('**/api/academia/cursos', (route) => route.fulfill(json([CURSO])));
  await page.route('**/api/academia/preinscripciones**', (route) => route.fulfill(json(INSCRITOS)));
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
  test.describe(`Formación con ${nombre} (E2E)`, () => {
    test('cursos: nuevo, editar, abrir/cerrar y eliminar', async ({ page }) => {
      await sesion(page, { formacion: acc }, 'formacion');
      await expect(page.getByText('Curso Demo').first()).toBeVisible();
      await presente(page.getByRole('button', { name: /Nuevo Curso/ }), si);
      await presente(page.getByTitle('Editar curso'), si);
      await presente(page.getByTitle('Cerrar inscripciones'), si);
      await presente(page.getByTitle('Eliminar curso'), si);
    });
  });
}

test('eliminar depende de «eliminar», no de «editar» (cursos)', async ({ page }) => {
  await sesion(page, { formacion: { ver: true, crear: true, editar: true, eliminar: false } }, 'formacion');
  await expect(page.getByTitle('Editar curso').first()).toBeVisible();
  await expect(page.getByTitle('Eliminar curso')).toHaveCount(0);
});
