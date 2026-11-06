import { Page } from '@playwright/test';

// Sección (ids de la matriz de permisos) → testid del ítem de /panel (DashboardSidebar: `panel-nav-<slug>`).
export const NAV_PANEL: Record<string, string> = {
  afiliados: 'afiliaciones',
  directorio: 'directorio-de-miembros',
  solicitudes_agentes: 'solicitudes-de-agentes',
  solicitudes_cambio: 'solicitudes-de-cambio',
  finanzas: 'control-de-finanzas',
  asambleas: 'gestion-de-asambleas',
  users: 'control-de-acceso',
  preinscripciones: 'preinscripciones',
  formacion: 'gestion-de-formacion',
  estudiantes: 'estudiantes',
  denuncias: 'tribunal-de-etica',
  analytics: 'analisis-y-metricas',
  directiva: 'junta-directiva',
  roles: 'roles-y-permisos',
  admin_users: 'administradores',
  noticias: 'cms-noticias',
  marco_legal: 'cms-marco-legal',
  leyes: 'cms-marco-legal',
  reglamentos: 'cms-marco-legal',
  convenios: 'cms-convenios',
  config: 'cms-configuracion',
};

/** Ítem visible de la navegación de /panel (el sidebar se pinta dos veces: móvil y escritorio). */
export const navPanel = (page: Page, seccion: string) =>
  page.locator(`[data-testid="panel-nav-${NAV_PANEL[seccion] ?? seccion}"]:visible`).first();
