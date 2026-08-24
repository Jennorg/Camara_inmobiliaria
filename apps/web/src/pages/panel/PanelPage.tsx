import React, { useState, useEffect } from 'react';
// Force Vite HMR reload
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
  UserCheck,
  ClipboardList,
  RefreshCw,
  Hammer,
  DollarSign,
} from 'lucide-react';
import DashboardSidebar from '@/pages/landing/afiliado/components/DashboardSidebar';
import DashboardHeader from '@/pages/landing/afiliado/components/DashboardHeader';
import WidgetFinanciero from '@/pages/landing/afiliado/components/WidgetFinanciero';
import WidgetNotificaciones from '@/pages/landing/afiliado/components/WidgetNotificaciones';
import WidgetAcademico from '@/pages/landing/afiliado/components/WidgetAcademico';
import WidgetMisCursos from '@/pages/landing/afiliado/components/WidgetMisCursos';
import WidgetFormalizarInscripcion from '@/pages/landing/afiliado/components/WidgetFormalizarInscripcion';
import WidgetMisCertificados from '@/pages/landing/afiliado/components/WidgetMisCertificados';
import WidgetExpediente from '@/pages/landing/afiliado/components/WidgetExpediente';
import WidgetSolicitudAfiliacion from '@/pages/landing/afiliado/components/WidgetSolicitudAfiliacion';
import WidgetGestionAfiliadosCorp from '@/pages/landing/afiliado/components/WidgetGestionAfiliadosCorp';
import AdminMisAgentesPanel from '@/pages/admin/components/Afiliados/AdminMisAgentesPanel';
import AfiliadosPanel from '@/pages/admin/components/Afiliados/AfiliadosPanel';
import WidgetCarnetAfiliado from '@/pages/landing/afiliado/components/WidgetCarnetAfiliado';
import { AfiliadoDTO } from '@/types/afiliados';

// Componentes Administrativos
import UsersPanel from '@/pages/admin/components/Users/UsersPanel';
import { DirectivaPanel } from '@/pages/admin/components/Cms/DirectivaPanel';
import AnalyticsPanel from '@/pages/admin/components/Analytics/AnalyticsPanel';
import FormacionPanel from '@/pages/admin/components/Formacion/FormacionPanel';
import MiembrosPanel from '@/pages/admin/components/Afiliados/MiembrosPanel';
import PreinscripcionesPrincipalesPanel from '@/pages/admin/components/Formacion/PreinscripcionesPrincipalesPanel';
import FinancePanel from '@/pages/admin/components/Finance/FinancePanel';

import CmsDashboard from '@/pages/admin/components/dashboard/CmsDashboard';
import CmsArticlesPanel, { type CmsTab } from '@/pages/admin/components/Cms/CmsArticlesPanel';
import SettingsPanel from './components/SettingsPanel';
import { useSearchParams } from 'react-router-dom';

import { useAuth } from '@/context/AuthContext';
import { API_URL } from '@/config/env';
import { apiFetch } from '@/lib/apiClient';
import { formatNombreCard } from '@/utils/formatters';

// ─── Nav Items por sección ────────────────────────────────────────────────────

const NAV_AFILIADO = [
  { icon: FolderSearch, label: 'Mi Expediente' },
  // { icon: CreditCard, label: 'Estado de Cuenta y Solvencias' },
  { icon: GraduationCap, label: 'Catálogo Académico' },
  { icon: Award, label: 'Mis Certificados' },
  // { icon: Gavel, label: 'Sistema de Denuncias' },
];

const NAV_ADMIN_CORE = [
  { icon: Users, label: 'Directorio de Miembros' },
  { icon: ShieldCheck, label: 'Control de Acceso' },
  { icon: ClipboardList, label: 'Preinscripciones' },
  { icon: BookOpen, label: 'Gestión de Formación' },
  { icon: UserPlus, label: 'Solicitudes de Agentes' },
  { icon: UserCheck, label: 'Solicitudes de Cambio' },
  { icon: BarChart, label: 'Análisis y Métricas' },
];

const NAV_CMS = [
  { id: 'CMS · Noticias', icon: Newspaper, label: 'Noticias' },
  { id: 'CMS · Marco Legal', icon: FileText, label: 'Marco Legal' },
  { id: 'CMS · Convenios', icon: Handshake, label: 'Convenios' },
  { id: 'CMS · Configuración', icon: Settings, label: 'Configuración' },
];

const NAV_SUPER_ADMIN = [
  { icon: UserCog, label: 'Junta Directiva' },
];

const NAV_DIVIDER_ADMIN = { icon: ShieldCheck, label: '— Administración —', isDivider: true };
const NAV_DIVIDER_CMS = { icon: Settings, label: '— Editor Web —', isDivider: true };

const Section = ({ label }: { label: string }) => (
  <div className="col-span-1 lg:col-span-3 text-center py-20 flex flex-col items-center justify-center gap-4">
    <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center text-slate-400">
      <Hammer size={32} />
    </div>
    <div className="space-y-1">
      <p className="opacity-50 font-black uppercase tracking-widest text-xs text-slate-500">
        Sección en Construcción
      </p>
      <h3 className="text-xl font-bold text-slate-400">{label}</h3>
    </div>
  </div>
);



// ─── Panel unificado principal ────────────────────────────────────────────────

const PanelPage = () => {
  const { user, token, logout, isAdmin, isSuperAdmin, isAsistente, isEstudiante, isAfiliado } = useAuth();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => {
    if (searchParams.get('tab') === 'formacion') return 'Catálogo Académico';
    return (isAdmin || isAsistente) ? 'Directorio de Miembros' : 'Mi Expediente';
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  const [loadingAfiliado, setLoadingAfiliado] = useState(true);
  const [afiliado, setAfiliado] = useState<AfiliadoDTO | null>(null);

  const [solicitudesCambioCount, setSolicitudesCambioCount] = useState(0);
  const [preinscripcionesCount, setPreinscripcionesCount] = useState(0);

  useEffect(() => {
    if (!token || (!isAdmin && !isAsistente)) return;
    let active = true;

    // 1. Solicitudes de Cambio pendientes
    apiFetch(`${API_URL}/api/afiliados/admin/solicitudes-cambio`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(d => {
        if (!active) return;
        if (d.success && Array.isArray(d.data)) {
          const pending = d.data.filter((s: any) =>
            ['Pendiente_Admin', 'Pendiente_Empresa'].includes(s.estatus)
          );
          setSolicitudesCambioCount(pending.length > 0 ? pending.length : d.data.length);
        }
      })
      .catch(() => {});

    // 2. Preinscripciones pendientes
    apiFetch(`${API_URL}/api/academia/preinscripciones?estatus=Preinscrito`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(d => {
        if (!active) return;
        if (d.success && Array.isArray(d.data)) {
          setPreinscripcionesCount(d.data.length);
        }
      })
      .catch(() => {});

    return () => { active = false; };
  }, [token, isAdmin, isAsistente]);

  const [agentesCorp, setAgentesCorp] = useState<any[]>([]);
  const [loadingAgentes, setLoadingAgentes] = useState(false);

  const fetchAfiliado = () => {
    if (!user?.id_afiliado || !token) {
      setLoadingAfiliado(false);
      return;
    }
    setLoadingAfiliado(true);
    apiFetch(`${API_URL}/api/afiliados/${user.id_afiliado}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(d => { 
        if (d.success) {
          setAfiliado(d.data);
          if (d.data.tipo_afiliado === 'Corporativo' && d.data.id_empresa) {
            fetchAgentes(d.data.id_empresa);
          }
        }
      })
      .catch(() => { })
      .finally(() => setLoadingAfiliado(false));
  };

  const fetchAgentes = (idEmpresa: number) => {
    setLoadingAgentes(true);
    apiFetch(`${API_URL}/api/afiliados/${idEmpresa}/afiliados-corp`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(d => { if (d.success) setAgentesCorp(d.data); })
      .catch(() => { })
      .finally(() => setLoadingAgentes(false));
  };

  useEffect(() => { fetchAfiliado(); }, [user?.id_afiliado, token]);

  const solicitudesPendientesCount = Array.isArray(agentesCorp) ? agentesCorp.filter(a => a && a.fase === 'Solicitud').length : 0;

  const carnetFotoUrl = (() => {
    if (!afiliado) return null;
    let redes = afiliado.redes_sociales;
    if (typeof redes === 'string') {
      try { redes = JSON.parse(redes); } catch { redes = {}; }
    }
    const useJunta = !!redes?.prefer_junta_photo;
    if (useJunta) {
      return (
        redes?.foto_junta_carnet_url ||
        afiliado.foto_junta_url ||
        redes?.foto_carnet_url ||
        afiliado.foto_url
      );
    }
    return (
      redes?.foto_carnet_url ||
      afiliado.foto_url ||
      redes?.foto_junta_carnet_url ||
      afiliado.foto_junta_url ||
      (afiliado.tipo_afiliado === 'Corporativo' ? afiliado.empresa_logo_url : null)
    );
  })();

  const displayName = (afiliado?.tipo_afiliado === 'Corporativo' && afiliado?.razon_social) 
    ? afiliado.razon_social 
    : (user?.nombre_completo || (user?.email?.split('@')[0] ?? 'Usuario'));
  const displayCode = user?.codigo ?? (isAdmin ? 'Administrador' : '—');
  const isActivo = user?.estatus === 'CIBIR' || user?.estatus === 'Afiliado';
  const isPaid = user?.id_afiliado ? (afiliado?.inscripcion_pagada === 1) : false; // Necesita fetch o estar en user
  const isLimited = isActivo && (afiliado ? afiliado.inscripcion_pagada === 0 : false);

  // Construir nav items dinámicamente según roles
  const buildNavItems = () => {
    let baseItems: any[] = [];
    
    // Todos los afiliados, personas con id_afiliado, o tipo_afiliado y admins son considerados afiliados para la vista
    const isConsideredAfiliado = (user?.roles && Array.isArray(user.roles) && user.roles.includes('afiliado')) || !!user?.id_afiliado || !!user?.tipo_afiliado || isAdmin;

    // Base de navegación pública o afiliada
    if (isConsideredAfiliado) {
      // Si es afiliado pero tiene restricción por falta de pago inicial
      if (isLimited) {
        baseItems = [
          { icon: LayoutDashboard, label: 'Resumen / Inicio' }, 
          { icon: FolderSearch, label: 'Mi Expediente' }
        ];
      } else {
        // Acceso completo para Naturales y Corporativos (y admins)
        baseItems = [...NAV_AFILIADO];
      }
    } else if (isEstudiante && (!user?.roles || user.roles.length <= 1)) {
      // Exclusivo estudiante
      baseItems = [
        { icon: LayoutDashboard, label: 'Resumen / Inicio' },
        { icon: GraduationCap, label: 'Catálogo Académico' },
        { icon: Award, label: 'Mis Certificados' },
        { icon: UserPlus, label: 'Solicitud de Afiliación' },
      ];
    }
    
    // Si es corporativo, agregar pestaña de gestión (SIEMPRE VISIBLE)
    const isCorp = user?.tipo_afiliado === 'Corporativo' || afiliado?.tipo_afiliado === 'Corporativo';
    if (isCorp) {
      baseItems.push({ 
        icon: Users, 
        label: 'Mis Agentes',
        count: solicitudesPendientesCount > 0 ? solicitudesPendientesCount : undefined,
        hasPendingDot: solicitudesPendientesCount > 0
      });
    }

    // Si es asistente/secretario (sin rol admin), mostrar Directorio de Miembros, Control de Acceso y Gestión de Formación
    if (isAsistente && !isAdmin) {
      return [
        { icon: Users, label: 'Directorio de Miembros' },
        { icon: ShieldCheck, label: 'Control de Acceso' },
        { icon: BookOpen, label: 'Gestión de Formación' },
      ];
    }

    // Item de Configuración para afiliados normales y admins (omitir para asistente puro)
    if (!isAsistente || isAdmin) {
      baseItems.push({ icon: Settings, label: 'Configuración' });
    }

    if (isAdmin) {
      const navAdminCoreWithCounts = [
        { icon: Users, label: 'Directorio de Miembros' },
        { icon: ShieldCheck, label: 'Control de Acceso' },
        { 
          icon: ClipboardList, 
          label: 'Preinscripciones', 
          count: preinscripcionesCount > 0 ? preinscripcionesCount : undefined,
          hasPendingDot: preinscripcionesCount > 0
        },
        { icon: BookOpen, label: 'Gestión de Formación' },
        { icon: UserPlus, label: 'Solicitudes de Agentes' },
        { 
          icon: UserCheck, 
          label: 'Solicitudes de Cambio', 
          count: solicitudesCambioCount > 0 ? solicitudesCambioCount : undefined,
          hasPendingDot: solicitudesCambioCount > 0
        },
        { icon: BarChart, label: 'Análisis y Métricas' },
      ];

      let adminItems = [
        NAV_DIVIDER_ADMIN as any,
        ...navAdminCoreWithCounts,
      ];
      if (isSuperAdmin) {
        adminItems = [...adminItems, ...NAV_SUPER_ADMIN];
      }
      if (isAdmin) {
        adminItems = [
          ...adminItems,
          NAV_DIVIDER_CMS as any,
          ...NAV_CMS
        ];
      }
      return [...baseItems, ...adminItems];
    }
    return baseItems;
  };

  const navItems = buildNavItems();
  
  useEffect(() => {
    if (navItems.length > 0) {
      const validLabels = navItems.filter((i: any) => !i.isDivider).map((i: any) => i.label);
      if (!validLabels.includes(activeTab)) {
        setActiveTab(validLabels[0] || 'Mi Expediente');
      }
    }
  }, [user?.id, user?.rol]);

  const isConsideredAfiliadoContent = (user?.roles && Array.isArray(user.roles) && user.roles.includes('afiliado')) || !!user?.id_afiliado || !!user?.tipo_afiliado || isAdmin;

  // ── Renderizado del contenido activo ────────────────────────────────────────

  const renderContent = () => {
    // 1. Sección de Afiliado
    if (activeTab === 'Resumen / Inicio') {
      return (
        <>
          {isAdmin && (
            <div className="col-span-1 lg:col-span-3 relative z-10 mb-4 sm:mb-6">
              <CmsDashboard />
            </div>
          )}
          
          {isLimited && isConsideredAfiliadoContent ? (
            <div className="col-span-1 lg:col-span-3">
              <WidgetFormalizarInscripcion onSuccess={fetchAfiliado} />
            </div>
          ) : (
            isConsideredAfiliadoContent && (
              <>
                {user?.tipo_afiliado === 'Corporativo' && (
                  <div className="lg:col-span-3">
                    <div className={`rounded-[2.5rem] p-8 text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl transition-colors duration-700 ${
                      solicitudesPendientesCount > 0 
                        ? 'bg-emerald-600 shadow-emerald-600/20 animate-in fade-in slide-in-from-top-4' 
                        : 'bg-[#022c22] shadow-[#022c22]/20'
                    }`}>
                      <div className="flex items-center gap-5 text-center md:text-left">
                        <div className={`w-16 h-16 rounded-3xl flex items-center justify-center shrink-0 ${
                          solicitudesPendientesCount > 0 ? 'bg-white/20 backdrop-blur-md' : 'bg-emerald-950/50'
                        }`}>
                          <UserPlus size={32} className={solicitudesPendientesCount > 0 ? 'text-white' : 'text-emerald-500/60'} />
                        </div>
                        <div>
                          <h3 className="text-xl font-black uppercase tracking-tight">Gestión de Agentes</h3>
                          <p className={`${solicitudesPendientesCount > 0 ? 'text-emerald-100' : 'text-slate-400'} font-medium text-sm`}>
                            {solicitudesPendientesCount > 0 
                              ? `Tienes ${solicitudesPendientesCount} ${solicitudesPendientesCount === 1 ? 'agente esperando' : 'agentes esperando'} tu confirmación.`
                              : 'No tienes solicitudes pendientes por el momento.'
                            }
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          type="button"
                          onClick={fetchAfiliado}
                          disabled={loadingAfiliado || loadingAgentes}
                          className="w-14 h-14 rounded-2xl bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors transition-transform active:scale-95 border border-white/10"
                          title="Actualizar datos"
                        >
                          <RefreshCw size={20} className={(loadingAfiliado || loadingAgentes) ? 'animate-spin' : ''} />
                        </button>
                        <button 
                          type="button"
                          onClick={() => setActiveTab('Mis Agentes')}
                          className={`px-8 h-14 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg hover:-translate-y-1 transition-colors transition-transform active:scale-95 whitespace-nowrap ${
                            solicitudesPendientesCount > 0 
                              ? 'bg-white text-emerald-700' 
                              : 'bg-emerald-800 text-emerald-100 hover:bg-emerald-700'
                          }`}
                        >
                          {solicitudesPendientesCount > 0 ? 'Gestionar Solicitudes' : 'Ver Mi Equipo'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                <div className="lg:col-span-1">
                  <WidgetCarnetAfiliado
                    afiliado={afiliado}
                    loading={loadingAfiliado}
                    onUpdateAfiliado={(updatedFields) => {
                      if (afiliado) {
                        setAfiliado({
                          ...afiliado,
                          ...updatedFields,
                        });
                      }
                    }}
                  />
                </div>
                <div className="lg:col-span-2 space-y-6 lg:space-y-8">
                  <WidgetMisCursos />
                  <WidgetAcademico />
                </div>
              </>
            )
          )}

          {/* Si es solo estudiante (y no admin ni afiliado) */}
          {isEstudiante && !isAfiliado && !isAdmin && (
            <>
              <div className="lg:col-span-3"><WidgetSolicitudAfiliacion /></div>
              <div className="lg:col-span-3"><WidgetMisCursos /></div>
              <div className="lg:col-span-3"><WidgetAcademico /></div>
            </>
          )}
        </>
      );
    }
    if (activeTab === 'Mi Expediente') return <div className="col-span-1 lg:col-span-3"><WidgetExpediente /></div>;
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
    if (activeTab === 'Mis Agentes') {
      return <div className="col-span-1 lg:col-span-3 h-full"><WidgetGestionAfiliadosCorp /></div>;
    }
    if (activeTab === 'Solicitudes de Agentes') {
      return <div className="col-span-1 lg:col-span-3 h-full"><AdminMisAgentesPanel /></div>;
    }
    if (activeTab === 'Solicitudes de Cambio') {
      return <div className="col-span-1 lg:col-span-3 h-full bg-white border border-gray-100 rounded-3xl shadow-xs overflow-hidden"><AfiliadosPanel defaultViewMode="solicitudes" hideViewModeTabs /></div>;
    }
    if (activeTab === 'Configuración') return <SettingsPanel />;

    // 2. Sección Administrativa
    if (!isAdmin && !isAsistente) return null;

    if (activeTab === 'Directorio de Miembros') return <div className="col-span-1 lg:col-span-3 h-full bg-white border border-gray-100 rounded-3xl shadow-xs overflow-hidden"><MiembrosPanel /></div>;
    if (activeTab === 'Control de Acceso') return <div className="col-span-1 lg:col-span-3 h-full bg-white border border-gray-100 rounded-3xl shadow-xs overflow-hidden"><UsersPanel /></div>;
    if (activeTab === 'Preinscripciones') return <div className="col-span-1 lg:col-span-3 h-full bg-white border border-gray-100 rounded-3xl shadow-xs overflow-hidden"><PreinscripcionesPrincipalesPanel /></div>;
    if (activeTab === 'Junta Directiva') return <div className="col-span-1 lg:col-span-3 h-full bg-white border border-gray-100 rounded-3xl shadow-xs p-6 overflow-hidden"><DirectivaPanel /></div>;
    if (activeTab === 'Finanzas') return <div className="col-span-1 lg:col-span-3 h-full"><FinancePanel /></div>;
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

  const isFullPanel = (activeTab.startsWith('CMS ·') || ['Leyes y Decretos', 'Reglamentos y Estatutos', 'Normas y Procedimientos', 'Actas de Asamblea', 'Directorio de Miembros', 'Control de Acceso', 'Preinscripciones', 'Junta Directiva', 'Análisis y Métricas', 'Gestión de Formación', 'Mis Agentes', 'Solicitudes de Agentes', 'Solicitudes de Cambio', 'Finanzas', 'Configuración'].includes(activeTab)) || (activeTab === 'Resumen / Inicio' && isAdmin);

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
          userFotoUrl={carnetFotoUrl || (user as any)?.foto_url}
          afiliado={afiliado}
          onUpdateAfiliado={(updatedFields) => {
            if (afiliado) {
              setAfiliado({
                ...afiliado,
                ...updatedFields,
              });
            }
          }}
        />

        <div className={`flex-1 min-h-0 ${isFullPanel ? 'h-full' : 'overflow-y-auto p-4 sm:p-6 lg:p-8'}`}>
          {isFullPanel ? (
            <div className="h-full overflow-y-auto">
              {renderContent()}
            </div>
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
                    {/* Filtramos y normalizamos los roles para la vista, priorizando afiliado sobre estudiante */}
                    {(() => {
                      const uniqueRoles = Array.from(new Set(user?.roles?.map(r => r === 'super_admin' ? 'admin' : r)));
                      if (uniqueRoles.includes('afiliado') && uniqueRoles.includes('estudiante')) {
                        return uniqueRoles.filter(r => r !== 'estudiante');
                      }
                      return uniqueRoles;
                    })().map(role => (
                      <span
                        key={role}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full shadow-sm text-[10px] font-black uppercase tracking-widest border ${
                          role === 'admin' ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
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
