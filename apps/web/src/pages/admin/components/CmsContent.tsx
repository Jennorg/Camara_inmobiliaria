import React from 'react'
import CmsDashboard from '@/pages/admin/components/dashboard/CmsDashboard'
import CmsArticlesPanel from '@/pages/admin/components/Cms/CmsArticlesPanel'
import FormacionPanel from '@/pages/admin/components/Formacion/FormacionPanel'
import PreinscripcionesPrincipalesPanel from '@/pages/admin/components/Formacion/PreinscripcionesPrincipalesPanel'
import AnalyticsPanel from '@/pages/admin/components/Analytics/AnalyticsPanel'
import UsersPanel from '@/pages/admin/components/Users/UsersPanel'
import AfiliadosPanel from '@/pages/admin/components/Afiliados/AfiliadosPanel'
import EstudiantesRegularesPanel from '@/pages/admin/components/Estudiantes/EstudiantesRegularesPanel'
import FinancePanel from '@/pages/admin/components/Finance/FinancePanel'
import DenunciasPanel from '@/pages/admin/components/Denuncias/DenunciasPanel'

// ─── Placeholder panels ───────────────────────────────────────────────────────
const Placeholder = ({ title, icon }: { title: string; icon: React.ReactNode }) => (
  <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-400 py-32">
    <span className="w-14 h-14 flex items-center justify-center rounded-2xl bg-slate-100">
      {icon}
    </span>
    <p className="text-base font-semibold">{title}</p>
    <p className="text-sm text-slate-300">This section is coming soon</p>
  </div>
)

const icons = {
  articles: (
    <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
  categories: (
    <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  ),
  media: (
    <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  analytics: (
    <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
}

import SuperAdminUsersPanel from '@/pages/admin/components/Users/SuperAdminUsersPanel'

// ─── Map of nav id → rendered panel ──────────────────────────────────────────
const PANELS: Record<string, React.ReactNode> = {
  dashboard: <CmsDashboard />,
  articles: <Placeholder title='Articles' icon={icons.articles} />,
  noticias: <CmsArticlesPanel externalTab="noticias" />,
  cursos: <CmsArticlesPanel externalTab="cursos" />,
  normativas: <CmsArticlesPanel externalTab="normativas" />,
  leyes: <CmsArticlesPanel externalTab="leyes" />,
  reglamentos: <CmsArticlesPanel externalTab="reglamentos" />,
  normas: <CmsArticlesPanel externalTab="normas" />,
  actas: <CmsArticlesPanel externalTab="actas" />,
  directiva: <CmsArticlesPanel externalTab="directiva" />,
  hitos: <CmsArticlesPanel externalTab="hitos" />,
  paginas: <CmsArticlesPanel externalTab="paginas" />,
  config: <CmsArticlesPanel externalTab="config" />,
  // Main CMS generic redirect
  cms: <CmsArticlesPanel externalTab="config" />, 
  formacion: <FormacionPanel />,
  preinscripciones: <PreinscripcionesPrincipalesPanel />,
  solicitudes_cambio: <AfiliadosPanel defaultViewMode="solicitudes" hideViewModeTabs />,
  media: <Placeholder title='Media Library' icon={icons.media} />,
  afiliados: <AfiliadosPanel />,
  estudiantes: <EstudiantesRegularesPanel />,
  users: <UsersPanel />,
  admin_users: <SuperAdminUsersPanel />,
  analytics: <AnalyticsPanel />,
  finanzas: <FinancePanel />,
  denuncias: <DenunciasPanel />,
  settings: <Placeholder title='Settings' icon={icons.settings} />,
}

interface CmsContentProps {
  activeId: string
}

const CmsContent = ({ activeId }: CmsContentProps) => {
  const panel = PANELS[activeId] ?? PANELS['dashboard']
  return <div className="absolute inset-0 flex flex-col min-h-0 overflow-hidden">{panel}</div>
}

export default CmsContent
