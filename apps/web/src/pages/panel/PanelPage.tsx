import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  FolderSearch,
  CreditCard,
  GraduationCap,
  Award,
  Gavel,
  HelpCircle,
  CheckCircle,
  Settings,
  Users,
  Newspaper,
  Handshake,
  ShieldCheck,
  BarChart,
  BookOpen,
  Image as ImageIcon,
  UserCog,
  FileText,
  UserPlus,
} from 'lucide-react';
import DashboardSidebar from '@/pages/landing/afiliado/components/DashboardSidebar';
import DashboardHeader from '@/pages/landing/afiliado/components/DashboardHeader';
import WidgetFinanciero from '@/pages/landing/afiliado/components/WidgetFinanciero';
import WidgetNotificaciones from '@/pages/landing/afiliado/components/WidgetNotificaciones';
import WidgetAcademico from '@/pages/landing/afiliado/components/WidgetAcademico';
import WidgetMisCursos from '@/pages/landing/afiliado/components/WidgetMisCursos';
import WidgetFormalizarInscripcion from '@/pages/landing/afiliado/components/WidgetFormalizarInscripcion';
import WidgetMisCertificados from '@/pages/landing/afiliado/components/WidgetMisCertificados';
import WidgetSolicitudAfiliacion from '@/pages/landing/afiliado/components/WidgetSolicitudAfiliacion';
import WidgetGestionAfiliadosCorp from '@/pages/landing/afiliado/components/WidgetGestionAfiliadosCorp';

// Componentes Administrativos
import UsersPanel from '@/pages/admin/components/Users/UsersPanel';
import SuperAdminUsersPanel from '@/pages/admin/components/Users/SuperAdminUsersPanel';
import AnalyticsPanel from '@/pages/admin/components/Analytics/AnalyticsPanel';
import FormacionPanel from '@/pages/admin/components/Formacion/FormacionPanel';
import MiembrosPanel from '@/pages/admin/components/Afiliados/MiembrosPanel';

import CmsDashboard from '@/pages/admin/components/dashboard/CmsDashboard';
import CmsArticlesPanel, { type CmsTab } from '@/pages/admin/components/Cms/CmsArticlesPanel';
import SettingsPanel from './components/SettingsPanel';
import { useSearchParams } from 'react-router-dom';

import { useAuth } from '@/context/AuthContext';
import { API_URL } from '@/config/env';
import { formatNombreCard } from '@/utils/formatters';

// ─── Nav Items por sección ────────────────────────────────────────────────────

const NAV_AFILIADO = [
  { icon: LayoutDashboard, label: 'Resumen / Inicio' },
  { icon: FolderSearch, label: 'Mi Expediente' },
  { icon: CreditCard, label: 'Estado de Cuenta y Solvencias' },
  { icon: GraduationCap, label: 'Catálogo Académico' },
  { icon: Award, label: 'Mis Certificados' },
  { icon: Gavel, label: 'Sistema de Denuncias' },
];

const NAV_ADMIN_CORE = [
  { icon: Users, label: 'Directorio de Miembros' },
  { icon: ShieldCheck, label: 'Control de Acceso' },
  { icon: BookOpen, label: 'Gestión de Formación' },
  { icon: BarChart, label: 'Análisis y Métricas' },
];

const NAV_CMS = [
  { icon: Newspaper, label: 'CMS · Noticias' },
  { icon: FileText, label: 'CMS · Marco Legal' },
  { icon: Handshake, label: 'CMS · Convenios' },
  { icon: Users, label: 'CMS · Directiva' },
  { icon: Settings, label: 'CMS · Configuración' },
];

const NAV_SUPER_ADMIN = [
  { icon: UserCog, label: 'Administradores' },
];

const NAV_DIVIDER_ADMIN = { icon: ShieldCheck, label: '— Administración —', isDivider: true };
const NAV_DIVIDER_CMS = { icon: Settings, label: '— Editor Web —', isDivider: true };

// ─── Sección vacía (placeholder) ─────────────────────────────────────────────

const Section = ({ label }: { label: string }) => (
  <div className="col-span-1 lg:col-span-3 text-center py-16 opacity-50 font-bold uppercase tracking-widest text-sm">
    🚧 En construcción: {label}
  </div>
);



// ─── Panel unificado principal ────────────────────────────────────────────────

const PanelPage = () => {
  const { user, token, logout, isAdmin, isSuperAdmin, isEstudiante, isAfiliado } = useAuth();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') === 'formacion' ? 'Catálogo Académico' : 'Resumen / Inicio');
  const [mobileOpen, setMobileOpen] = useState(false);

  const [loadingAfiliado, setLoadingAfiliado] = useState(true);
  const [afiliado, setAfiliado] = useState<{
    nombre_completo: string;
    nombres: string | null;
    apellidos: string | null;
    codigo_cibir: string | null;
    estatus: string;
    inscripcion_pagada: number;
    tipo_afiliado?: string;
    razon_social?: string;
  } | null>(null);

  const fetchAfiliado = () => {
    if (!user?.id_afiliado || !token) {
      setLoadingAfiliado(false);
      return;
    }
    setLoadingAfiliado(true);
    fetch(`${API_URL}/api/afiliados/${user.id_afiliado}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { if (d.success) setAfiliado(d.data) })
      .catch(() => { })
      .finally(() => setLoadingAfiliado(false));
  };

  useEffect(() => { fetchAfiliado(); }, [user?.id_afiliado, token]);

  const displayName = afiliado ? formatNombreCard(afiliado.nombres || afiliado.nombre_completo, afiliado.apellidos) : (user?.email?.split('@')[0] ?? 'Usuario');
  const displayCode = afiliado?.codigo_cibir ?? (isAdmin ? 'Administrador' : '—');
  const isActivo = afiliado?.estatus === 'CIBIR';
  const isPaid = afiliado?.inscripcion_pagada === 1;
  const isLimited = isActivo && !isPaid;

  // Construir nav items dinámicamente según roles
  const buildNavItems = () => {
    let baseItems: any[] = [];
    
    // Base de navegación pública o afiliada
    if (user?.roles.includes('afiliado')) {
      baseItems = isLimited
        ? [{ icon: LayoutDashboard, label: 'Resumen / Inicio' }, { icon: FolderSearch, label: 'Mi Expediente' }]
        : [...NAV_AFILIADO];
    } else if (isEstudiante && user?.roles.length === 1) {
      // Exclusivo estudiante
      baseItems = [
        { icon: LayoutDashboard, label: 'Resumen / Inicio' },
        { icon: GraduationCap, label: 'Catálogo Académico' },
        { icon: Award, label: 'Mis Certificados' },
        { icon: UserPlus, label: 'Solicitud de Afiliación' },
      ];
    }
    
    // Si es corporativo, agregar pestaña de gestión
    if (afiliado?.tipo_afiliado === 'Corporativo') {
      baseItems.push({ icon: Users, label: 'Mis Agentes' });
    }

    // Item de Configuración para todos
    baseItems.push({ icon: Settings, label: 'Configuración' });

    if (isAdmin) {
      let adminItems = [
        NAV_DIVIDER_ADMIN as any,
        ...NAV_ADMIN_CORE,
      ];
      if (isSuperAdmin) {
        adminItems = [...adminItems, ...NAV_SUPER_ADMIN];
      }
      adminItems = [
        ...adminItems,
        NAV_DIVIDER_CMS as any,
        ...NAV_CMS
      ];
      return [...baseItems, ...adminItems];
    }
    return baseItems;
  };

  const navItems = buildNavItems();

  // ── Renderizado del contenido activo ────────────────────────────────────────

  const renderContent = () => {
    // 1. Sección de Afiliado
    if (activeTab === 'Resumen / Inicio') {
      if (isAdmin) return <div className="col-span-1 lg:col-span-3 relative z-10"><CmsDashboard /></div>;
      if (isLimited && user?.roles.includes('afiliado')) return <div className="col-span-1 lg:col-span-3"><WidgetFormalizarInscripcion onSuccess={fetchAfiliado} /></div>;
      
      // Si es solo estudiante
      if (isEstudiante && !isAfiliado) {
        return (
          <>
            <div className="lg:col-span-3"><WidgetSolicitudAfiliacion /></div>
            <div className="lg:col-span-3"><WidgetMisCursos /></div>
            <div className="lg:col-span-3"><WidgetAcademico /></div>
          </>
        )
      }

      // Afiliado standard
      return (
        <>
          <div className="lg:col-span-2"><WidgetFinanciero loading={loadingAfiliado} /></div>
          <div className="lg:col-span-1"><WidgetNotificaciones loading={loadingAfiliado} /></div>
          <div className="lg:col-span-3"><WidgetMisCursos /></div>
          <div className="lg:col-span-3"><WidgetAcademico /></div>
        </>
      );
    }
    if (activeTab === 'Mi Expediente') return <Section label="Mi Expediente" />;
    if (activeTab === 'Estado de Cuenta y Solvencias') return <Section label="Estado de Cuenta" />;
    if (activeTab === 'Catálogo Académico') return <div className="col-span-1 lg:col-span-3"><WidgetAcademico limit={0} /></div>;
    if (activeTab === 'Mis Certificados') {
      return (
        <div className="col-span-1 lg:col-span-3">
          <WidgetMisCertificados />
        </div>
      );
    }
    if (activeTab === 'Sistema de Denuncias') return <Section label="Sistema de Denuncias" />;
    if (activeTab === 'Solicitud de Afiliación') return <div className="col-span-1 lg:col-span-3"><WidgetSolicitudAfiliacion /></div>;
    if (activeTab === 'Mis Agentes') return <div className="col-span-1 lg:col-span-3"><WidgetGestionAfiliadosCorp /></div>;
    if (activeTab === 'Configuración') return <SettingsPanel />;

    // 2. Sección Administrativa
    if (!isAdmin) return null;

    if (activeTab === 'Directorio de Miembros') return <div className="col-span-1 lg:col-span-3 h-full bg-white border border-gray-100 rounded-3xl shadow-xs overflow-hidden"><MiembrosPanel /></div>;
    if (activeTab === 'Control de Acceso') return <div className="col-span-1 lg:col-span-3 h-full bg-white border border-gray-100 rounded-3xl shadow-xs overflow-hidden"><UsersPanel /></div>;
    if (activeTab === 'Administradores') return <div className="col-span-1 lg:col-span-3 h-full bg-white border border-gray-100 rounded-3xl shadow-xs p-6 overflow-hidden"><SuperAdminUsersPanel /></div>;
    if (activeTab === 'Análisis y Métricas') return <div className="col-span-1 lg:col-span-3 h-full"><AnalyticsPanel /></div>;
    if (activeTab === 'Gestión de Formación') return <div className="col-span-1 lg:col-span-3 h-full bg-white border border-gray-100 rounded-3xl shadow-xs overflow-hidden"><FormacionPanel /></div>;

    // 3. Sección CMS (Incrustada)
    if (activeTab.startsWith('CMS ·') || ['Leyes y Decretos', 'Reglamentos y Estatutos', 'Normas y Procedimientos', 'Actas de Asamblea'].includes(activeTab)) {
      const tabMap: Record<string, CmsTab> = {
        'CMS · Noticias': 'noticias',
        'CMS · Marco Legal': 'normativas',
        'Leyes y Decretos': 'leyes',
        'Reglamentos y Estatutos': 'reglamentos',
        'Normas y Procedimientos': 'normas',
        'Actas de Asamblea': 'actas',
        'CMS · Convenios': 'convenios',
        'CMS · Directiva': 'directiva',
        'CMS · Configuración': 'config',
      };
      const externalTab = tabMap[activeTab] ?? 'config';
      return (
        <div className="h-full bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-xs">
          <CmsArticlesPanel externalTab={externalTab} />
        </div>
      );
    }
    return null;
  };

  const isFullPanel = (activeTab.startsWith('CMS ·') || ['Leyes y Decretos', 'Reglamentos y Estatutos', 'Normas y Procedimientos', 'Actas de Asamblea', 'Directorio de Miembros', 'Control de Acceso', 'Administradores', 'Análisis y Métricas', 'Gestión de Formación', 'Mis Agentes', 'Configuración'].includes(activeTab)) || (activeTab === 'Resumen / Inicio' && isAdmin);

  return (
    <div className="h-screen flex font-sans overflow-hidden" style={{ backgroundColor: 'var(--color-bg-page)', color: 'var(--color-text-base)' }}>
      <DashboardSidebar
        navItems={navItems}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        onLogout={logout}
      />

      <main className="flex-grow flex flex-col min-w-0 h-full overflow-hidden">
        <DashboardHeader
          onMenuOpen={() => setMobileOpen(true)}
          userName={displayName}
          userCode={displayCode}
        />

        <div className={`flex-1 min-h-0 ${isFullPanel ? 'h-full overflow-hidden' : 'overflow-y-auto p-4 sm:p-6 lg:p-8'}`}>
          {isFullPanel ? (
             renderContent()
          ) : (
              <div className="max-w-7xl mx-auto w-full space-y-6 lg:space-y-8">
                {/* Welcome */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-black tracking-tight" style={{ color: 'var(--color-primary)' }}>
                      ¡Bienvenido, {displayName}!
                    </h1>
                    <p className="mt-1 font-medium text-sm" style={{ color: 'var(--color-text-muted)' }}>
                      {isAdmin
                        ? 'Panel unificado · Afiliado y Administración.'
                        : 'Revisa el estado de tu membresía y tus actualizaciones recientes.'}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {/* Filtramos y normalizamos los roles para la vista */}
                    {Array.from(new Set(user?.roles?.map(r => r === 'super_admin' ? 'admin' : r))).map(role => (
                      <span
                        key={role}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full shadow-sm text-[10px] font-black uppercase tracking-widest border ${
                          role === 'admin' ? 'border-blue-200 bg-blue-50 text-blue-700'
                            : isLimited
                              ? 'border-amber-200 bg-amber-50 text-amber-700'
                              : 'border-[var(--color-border-accent)] bg-[var(--color-accent-muted)] text-[var(--color-accent-hover)]'
                          }`}
                      >
                        <CheckCircle size={11} />
                        {role === 'admin' ? 'Administrador'
                            : role === 'estudiante' ? 'Estudiante'
                            : isLimited ? 'CIBIR Restringido'
                              : isActivo ? 'CIBIR Activo'
                                : afiliado ? `Estatus: ${afiliado.estatus}` : 'Afiliado'}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Content grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-8">
                  {renderContent()}
                </div>
              </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default PanelPage;
