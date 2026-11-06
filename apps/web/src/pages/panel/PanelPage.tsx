import React, { useState, useEffect, useCallback } from 'react';
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
import WidgetNotificaciones from '@/pages/landing/afiliado/components/WidgetNotificaciones';
import WidgetAcademico from '@/pages/landing/afiliado/components/WidgetAcademico';
import WidgetMisCursos from '@/pages/landing/afiliado/components/WidgetMisCursos';
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
import RolesPanel from '@/pages/admin/components/Roles/RolesPanel';
import SuperAdminUsersPanel from '@/pages/admin/components/Users/SuperAdminUsersPanel';
import EstudiantesRegularesPanel from '@/pages/admin/components/Estudiantes/EstudiantesRegularesPanel';
import { DirectivaPanel } from '@/pages/admin/components/Cms/DirectivaPanel';
import AnalyticsPanel from '@/pages/admin/components/Analytics/AnalyticsPanel';
import FormacionPanel from '@/pages/admin/components/Formacion/FormacionPanel';
import MiembrosPanel from '@/pages/admin/components/Afiliados/MiembrosPanel';
import PreinscripcionesPrincipalesPanel from '@/pages/admin/components/Formacion/PreinscripcionesPrincipalesPanel';
import FinancePanel from '@/pages/admin/components/Finance/FinancePanel';
import AsambleasPanel from '@/pages/admin/components/Gestion/AsambleasPanel';
import DenunciasPanel from '@/pages/admin/components/Denuncias/DenunciasPanel';

import CmsDashboard from '@/pages/admin/components/dashboard/CmsDashboard';
import CmsArticlesPanel, { type CmsTab } from '@/pages/admin/components/Cms/CmsArticlesPanel';
import SettingsPanel from './components/SettingsPanel';
import ImpersonationBanner from '@/components/ImpersonationBanner';
import { useSearchParams } from 'react-router-dom';
import { BatchDownloadProvider } from '@/context/BatchDownloadContext';
import SEO from '@/components/SEO';

import { useAuth } from '@/context/AuthContext';
import EstadoCuentaAfiliado from '@/components/EstadoCuentaAfiliado';
import BannerMora from '@/components/BannerMora';
import { API_URL } from '@/config/env';
import { apiFetch } from '@/lib/apiClient';
import { formatNombreCard } from '@/utils/formatters';

// ─── Nav Items por sección ────────────────────────────────────────────────────

const NAV_AFILIADO = [
  { icon: FolderSearch, label: 'Mi Expediente' },
  { icon: CreditCard, label: 'Estado de Cuenta' },
  { icon: GraduationCap, label: 'Catálogo Académico' },
  { icon: Award, label: 'Mis Certificados' },
  // { icon: Gavel, label: 'Sistema de Denuncias' },
];

// Ítems de staff: cada uno se muestra solo si el usuario puede `ver` su sección (ids en apps/api/src/config/secciones.ts).
type NavStaff = { id?: string; icon: React.ElementType; label: string; seccion: string };

const NAV_ADMIN_CORE: NavStaff[] = [
  { icon: Users, label: 'Directorio de Miembros', seccion: 'afiliados' },
  { icon: CheckCircle, label: 'Afiliaciones', seccion: 'afiliaciones' },
  { icon: DollarSign, label: 'Control de Finanzas', seccion: 'finanzas' },
  { icon: FileText, label: 'Gestión de Asambleas', seccion: 'asambleas' },
  { icon: ShieldCheck, label: 'Control de Acceso', seccion: 'users' },
  { icon: ClipboardList, label: 'Preinscripciones', seccion: 'preinscripciones' },
  { icon: BookOpen, label: 'Gestión de Formación', seccion: 'formacion' },
  { icon: GraduationCap, label: 'Estudiantes', seccion: 'estudiantes' },
  { icon: UserPlus, label: 'Solicitudes de Agentes', seccion: 'afiliados' },
  { icon: UserCheck, label: 'Solicitudes de Cambio', seccion: 'solicitudes_cambio' },
  { icon: Gavel, label: 'Tribunal de Ética', seccion: 'denuncias' },
  { icon: BarChart, label: 'Análisis y Métricas', seccion: 'analytics' },
];

const NAV_CMS: NavStaff[] = [
  { id: 'CMS · Noticias', icon: Newspaper, label: 'Noticias', seccion: 'noticias' },
  { id: 'CMS · Marco Legal', icon: FileText, label: 'Marco Legal', seccion: 'marco_legal' },
  { id: 'CMS · Convenios', icon: Handshake, label: 'Convenios', seccion: 'config' },
  { id: 'CMS · Configuración', icon: Settings, label: 'Configuración', seccion: 'config' },
];

const NAV_SUPER_ADMIN: NavStaff[] = [
  { icon: UserCog, label: 'Junta Directiva', seccion: 'directiva' },
  { icon: ShieldCheck, label: 'Roles y permisos', seccion: 'roles' },
  { icon: UserCog, label: 'Administradores', seccion: 'admin_users' },
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
  const { user, token, logout, isAdmin, isEstudiante, isAfiliado, tienePanelAdmin, puede } = useAuth();
  const [searchParams] = useSearchParams();
  // Todos los afiliados, personas con id_afiliado o tipo_afiliado ven los ítems de afiliado
  const isConsideredAfiliado = (user?.roles && Array.isArray(user.roles) && user.roles.includes('afiliado')) || !!user?.id_afiliado || !!user?.tipo_afiliado;
  // Ítems de staff visibles según la matriz de permisos
  const verStaff = (items: NavStaff[]) => (tienePanelAdmin ? items.filter(i => puede(i.seccion, 'ver')) : []);
  const staffCore = verStaff([...NAV_ADMIN_CORE, ...NAV_SUPER_ADMIN]);
  const staffCms = verStaff(NAV_CMS);
  const primerStaff = [...staffCore, ...staffCms][0];
  // Solo staff (sin afiliado ni estudiante): aterriza en su primer ítem de staff
  const soloStaff = !!primerStaff && !isConsideredAfiliado && !isEstudiante;
  const [activeTab, setActiveTab] = useState(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'formacion') return 'Catálogo Académico';
    if (tabParam === 'finanzas') return 'Control de Finanzas';
    if (tabParam === 'denuncias') return 'Tribunal de Ética';
    if (soloStaff) return primerStaff.id || primerStaff.label;
    return isAdmin && puede('afiliados', 'ver') ? 'Directorio de Miembros' : 'Mi Expediente';
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  const [loadingAfiliado, setLoadingAfiliado] = useState(true);
  const [afiliado, setAfiliado] = useState<AfiliadoDTO | null>(null);

  const [solicitudesCambioCount, setSolicitudesCambioCount] = useState(0);
  const [preinscripcionesCount, setPreinscripcionesCount] = useState(0);
  // Cambia tras reportar un pago para recargar la línea de tiempo de solvencia
  const [versionSolvencia, setVersionSolvencia] = useState(0);
  const [agentesCorpTab, setAgentesCorpTab] = useState<'agentes' | 'pendientes' | 'links' | 'vincular' | 'solicitudes'>('agentes');

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    if (!token || !tienePanelAdmin) return;
    let active = true;

    // 1. Solicitudes de Cambio pendientes
    if (puede('solicitudes_cambio', 'ver')) apiFetch(`${API_URL}/api/afiliados/admin/solicitudes-cambio`, {
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
    if (puede('preinscripciones', 'ver')) apiFetch(`${API_URL}/api/academia/preinscripciones?estatus=Preinscrito`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(d => {
        if (!active) return;
        if (d.success && Array.isArray(d.data)) {
          const pendingProgramas = d.data.filter((r: any) =>
            r.estatus === 'Preinscrito' && r.num_documentos && r.num_documentos > 0 && !r.id_curso
          )
          setPreinscripcionesCount(pendingProgramas.length)
        }
      })
      .catch(() => {});

    return () => { active = false; };
  }, [token, tienePanelAdmin, puede]);

  const [agentesCorp, setAgentesCorp] = useState<any[]>([]);
  const [loadingAgentes, setLoadingAgentes] = useState(false);

  const fetchAfiliado = useCallback(() => {
    if (!user?.id_afiliado || !token) {
      setAfiliado(null);
      setAgentesCorp([]);
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
          } else {
            setAgentesCorp([]);
          }
        } else {
          setAfiliado(null);
          setAgentesCorp([]);
        }
      })
      .catch(() => {
        setAfiliado(null);
        setAgentesCorp([]);
      })
      .finally(() => setLoadingAfiliado(false));
  }, [user?.id_afiliado, token]);

  const fetchAgentes = (idEmpresa: number) => {
    setLoadingAgentes(true);
    apiFetch(`${API_URL}/api/afiliados/${idEmpresa}/afiliados-corp`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(d => { if (d.success) setAgentesCorp(d.data); })
      .catch(() => { })
      .finally(() => setLoadingAgentes(false));
  };

  useEffect(() => { fetchAfiliado(); }, [user?.id, user?.id_afiliado, token, fetchAfiliado]);

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

  const displayName = (() => {
    if (afiliado?.tipo_afiliado === 'Corporativo' && afiliado?.razon_social) {
      return afiliado.razon_social;
    }
    const nombres = afiliado?.nombres || user?.nombres;
    const apellidos = afiliado?.apellidos || user?.apellidos;
    if (nombres || apellidos) {
      const formatted = formatNombreCard(nombres, apellidos);
      if (formatted) return formatted;
    }
    if (user?.nombre_completo) {
      const formatted = formatNombreCard(user.nombre_completo);
      if (formatted) return formatted;
    }
    return user?.email?.split('@')[0] ?? 'Usuario';
  })();
  const displayCode = user?.codigo ?? (isAdmin ? 'Administrador' : '—');
  /** Afiliado oficial: se resuelve con el registro real traído de la API, no con el token. */
  const isAfiliadoActivo = afiliado?.estatus === 'Afiliado';

  // Construir nav items: afiliado/estudiante según roles, staff según la matriz de permisos
  const buildNavItems = () => {
    let baseItems: any[] = [];

    // Base de navegación pública o afiliada
    if (isConsideredAfiliado) {
      // Acceso completo para Naturales y Corporativos
      // La solvencia es por afiliación: sin afiliado propio no la tiene
      baseItems = NAV_AFILIADO.filter(i => i.label !== 'Estado de Cuenta' || !!(user?.id_afiliado || afiliado?.id_afiliado));
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

    // Configuración de la cuenta: para todos
    baseItems.push({ icon: Settings, label: 'Configuración' });

    const conConteo = (i: NavStaff) => {
      const count = i.label === 'Preinscripciones' ? preinscripcionesCount : i.label === 'Solicitudes de Cambio' ? solicitudesCambioCount : 0;
      return count > 0 ? { ...i, count, hasPendingDot: true } : i;
    };

    // Cada separador solo aparece si hay algún ítem visible debajo
    return [
      ...baseItems,
      ...(staffCore.length ? [NAV_DIVIDER_ADMIN, ...staffCore.map(conConteo)] : []),
      ...(staffCms.length ? [NAV_DIVIDER_CMS, ...staffCms] : []),
    ];
  };

  const navItems = buildNavItems();
  
  useEffect(() => {
    if (navItems.length > 0) {
      const validLabels = navItems.filter((i: any) => !i.isDivider).map((i: any) => i.id || i.label);
      if (!validLabels.includes(activeTab)) {
        setActiveTab(soloStaff ? (primerStaff.id || primerStaff.label) : validLabels[0] || 'Mi Expediente');
      }
    }
  }, [user?.id, user?.rol]);


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
          
          {isConsideredAfiliado && (
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
                        onClick={() => {
                          setAgentesCorpTab(solicitudesPendientesCount > 0 ? 'pendientes' : 'agentes');
                          setActiveTab('Mis Agentes');
                        }}
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
    if (activeTab === 'Estado de Cuenta') {
      const idAfiliado = user?.id_afiliado || afiliado?.id_afiliado;
      return (
        <div className="h-full overflow-y-auto custom-scrollbar-light">
          {idAfiliado ? (
            <EstadoCuentaAfiliado idAfiliado={idAfiliado} onReportado={() => setVersionSolvencia(v => v + 1)} />
          ) : null}
        </div>
      );
    }
    if (activeTab === 'Mi Expediente') return <div className="col-span-1 lg:col-span-3"><WidgetExpediente /></div>;
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
      return <div className="col-span-1 lg:col-span-3 h-full"><WidgetGestionAfiliadosCorp defaultTab={agentesCorpTab} /></div>;
    }
    if (activeTab === 'Configuración') return <SettingsPanel />;

    // 2. Sección Administrativa: solo ítems de staff visibles en la navegación (también si llega por ?tab=)
    if (![...staffCore, ...staffCms].some(i => (i.id || i.label) === activeTab)) return null;

    if (activeTab === 'Solicitudes de Agentes') {
      return <div className="col-span-1 lg:col-span-3 h-full"><AdminMisAgentesPanel /></div>;
    }
    if (activeTab === 'Solicitudes de Cambio') {
      return <div className="col-span-1 lg:col-span-3 h-full bg-white border border-gray-100 rounded-3xl shadow-xs overflow-hidden"><AfiliadosPanel defaultViewMode="solicitudes" hideViewModeTabs /></div>;
    }
    if (activeTab === 'Afiliaciones') return <div className="col-span-1 lg:col-span-3 h-full bg-white border border-gray-100 rounded-3xl shadow-xs overflow-hidden"><AfiliadosPanel /></div>;
    if (activeTab === 'Estudiantes') return <div className="col-span-1 lg:col-span-3 h-full bg-white border border-gray-100 rounded-3xl shadow-xs overflow-hidden"><EstudiantesRegularesPanel /></div>;
    if (activeTab === 'Administradores') return <div className="col-span-1 lg:col-span-3 h-full bg-white border border-gray-100 rounded-3xl shadow-xs overflow-hidden"><SuperAdminUsersPanel /></div>;

    if (activeTab === 'Directorio de Miembros') return <div className="col-span-1 lg:col-span-3 h-full bg-white border border-gray-100 rounded-3xl shadow-xs overflow-hidden"><MiembrosPanel /></div>;
    if (activeTab === 'Roles y permisos') return <div className="col-span-1 lg:col-span-3 h-full bg-white border border-gray-100 rounded-3xl shadow-xs overflow-hidden"><RolesPanel /></div>;
    if (activeTab === 'Control de Acceso') return <div className="col-span-1 lg:col-span-3 h-full bg-white border border-gray-100 rounded-3xl shadow-xs overflow-hidden"><UsersPanel /></div>;
    if (activeTab === 'Preinscripciones') return <div className="col-span-1 lg:col-span-3 h-full bg-white border border-gray-100 rounded-3xl shadow-xs overflow-hidden"><PreinscripcionesPrincipalesPanel /></div>;
    if (activeTab === 'Junta Directiva') return <div className="col-span-1 lg:col-span-3 h-full bg-white border border-gray-100 rounded-3xl shadow-xs p-6 overflow-hidden"><DirectivaPanel /></div>;
    if (activeTab === 'Gestión de Asambleas') return <div className="col-span-1 lg:col-span-3 h-full bg-white border border-gray-100 rounded-3xl shadow-xs overflow-hidden"><AsambleasPanel /></div>;
    if (activeTab === 'Finanzas' || activeTab === 'Control de Finanzas') return <div className="col-span-1 lg:col-span-3 h-full"><FinancePanel /></div>;
    if (activeTab === 'Tribunal de Ética' || activeTab === 'Denuncias' || activeTab === 'Sistema de Denuncias') return <div className="col-span-1 lg:col-span-3 h-full"><DenunciasPanel /></div>;
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

  const isFullPanel = (activeTab.startsWith('CMS ·') || ['Leyes y Decretos', 'Reglamentos y Estatutos', 'Normas y Procedimientos', 'Actas de Asamblea', 'Directorio de Miembros', 'Control de Acceso', 'Roles y permisos', 'Administradores', 'Afiliaciones', 'Estudiantes', 'Preinscripciones', 'Junta Directiva', 'Análisis y Métricas', 'Gestión de Formación', 'Mis Agentes', 'Solicitudes de Agentes', 'Solicitudes de Cambio', 'Finanzas', 'Control de Finanzas', 'Gestión de Asambleas', 'Tribunal de Ética', 'Denuncias', 'Sistema de Denuncias', 'Configuración', 'Estado de Cuenta'].includes(activeTab)) || (activeTab === 'Resumen / Inicio' && isAdmin);

  return (
    <BatchDownloadProvider>
      <SEO index={false} title="Panel de Gestión" />
      <div 
        className="h-screen w-full flex flex-col font-sans overflow-hidden" 
        style={{ backgroundColor: 'var(--color-bg-page)', color: 'var(--color-text-base)' }}
      >
        <ImpersonationBanner />
        <div className="flex-1 min-h-0 flex overflow-hidden w-full">
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

            <div className={`flex-1 min-h-0 ${isFullPanel && activeTab !== 'Configuración' ? 'h-full overflow-hidden' : 'overflow-y-auto custom-scrollbar-light'} ${!isFullPanel ? 'p-4 sm:p-6 lg:p-8' : ''}`}>
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
                    {/* Filtramos y normalizamos los roles para la vista, priorizando afiliado sobre estudiante */}
                    {(() => {
                      const rawRoles = [...(user?.roles || [])];
                      if ((user?.id_afiliado || user?.tipo_afiliado || afiliado?.id_afiliado) && !rawRoles.includes('afiliado')) {
                        rawRoles.push('afiliado');
                      }
                      const uniqueRoles = Array.from(new Set(rawRoles.map(r => r === 'super_admin' ? 'admin' : r)));
                      if (uniqueRoles.includes('afiliado') && uniqueRoles.includes('estudiante')) {
                        return uniqueRoles.filter(r => r !== 'estudiante');
                      }
                      return uniqueRoles;
                    })().map(role => (
                      <span
                        key={role}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full shadow-sm text-[10px] font-black uppercase tracking-widest border ${
                          role === 'admin'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-[var(--color-border-accent)] bg-[var(--color-accent-muted)] text-[var(--color-accent-hover)]'
                          }`}
                      >
                        <CheckCircle size={11} />
                        {role === 'admin' ? 'Administrador'
                            : role === 'estudiante' ? 'Estudiante'
                            : isAfiliadoActivo
                              ? `${afiliado?.tipo_afiliado || user?.tipo_afiliado || 'Afiliado'} Activo`
                              : afiliado ? `Estatus: ${afiliado.estatus}` : 'Afiliado'}
                      </span>
                    ))}
                  </div>
                </div>

                {isAfiliadoActivo && afiliado?.id_afiliado && activeTab !== 'Estado de Cuenta' && (
                  <BannerMora key={versionSolvencia} idAfiliado={afiliado.id_afiliado} onIrAPagar={() => setActiveTab('Estado de Cuenta')} />
                )}

                {/* Content grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-8">
                  {renderContent()}
                </div>
              </div>
          )}
        </div>
      </main>
    </div>
  </div>
  </BatchDownloadProvider>
  );
};

export default PanelPage;
