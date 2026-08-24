import React from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import Navbar from '@/pages/landing/components/navbar/Navbar';
import Footer from '@/pages/landing/components/Footer';
import { ProfileHero } from './components/profile/ProfileHero';
import { OrganigramView } from './components/profile/OrganigramView';
import { ProfileMainContent } from './components/profile/ProfileMainContent';
import { DataSections } from './components/profile/DataSections';
import { useAfiliadoProfile } from './components/profile/useAfiliadoProfile';

const AfiliadoProfilePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    afiliado,
    loading,
    error,
    isRepMode,
    isCorporativo,
    hasOrganigram,
    leaderNode,
    childrenNodes,
    displayEmblem,
    showEmpresaSection,
    showAfiliadoSection,
    ubicacionTexto,
  } = useAfiliadoProfile();

  React.useEffect(() => {
    // Solo interceptar en vista móvil
    if (window.innerWidth >= 768) return;

    // Insertar estado ficticio en el historial para capturar el botón/gesto de atrás
    window.history.pushState(null, '', window.location.href);

    const handlePopState = () => {
      navigate('/miembros', { replace: true });
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [navigate, id]);

  const darkMode = false;

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#022c22]">
        <Navbar darkMode={darkMode} setDarkMode={() => {}} />
        <div className="flex-grow flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 text-emerald-600 animate-spin" />
            <p className="font-bold text-slate-500 dark:text-emerald-200">Cargando perfil profesional...</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (error || !afiliado) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#022c22]">
        <Navbar darkMode={darkMode} setDarkMode={() => {}} />
        <div className="flex-grow flex items-center justify-center px-6">
          <div className="max-w-md w-full bg-white dark:bg-[#04432f] p-10 rounded-[2.5rem] shadow-xl border border-slate-200 dark:border-emerald-500/20 text-center space-y-6">
            <div className="w-20 h-20 bg-rose-50 dark:bg-rose-500/10 rounded-full flex items-center justify-center mx-auto">
              <Loader2 className="text-rose-500" size={40} />
            </div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-white">Perfil no disponible</h2>
            <p className="text-slate-500 dark:text-emerald-100/70">{error || 'El miembro que buscas no existe o no se encuentra activo.'}</p>
            <button 
              onClick={() => navigate('/miembros')}
              className="inline-flex items-center gap-2 bg-emerald-600 text-white px-8 py-3 rounded-full font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-500/20"
            >
              Volver al Directorio
            </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-500 ${darkMode ? 'dark bg-[#022c22] text-slate-100' : 'bg-slate-50 text-slate-800'}`}>
      <Navbar darkMode={darkMode} setDarkMode={() => {}} />

      <main className="flex-grow pt-6 pb-16 px-4 md:px-8 max-w-7xl mx-auto w-full space-y-12">
        {/* 1. Hero Section (Full Width) */}
        <ProfileHero 
          afiliado={afiliado}
          isRepMode={isRepMode}
          isCorporativo={isCorporativo}
          displayEmblem={displayEmblem}
          companyLogo={afiliado.empresa_logo_url || null}
          ubicacionTexto={ubicacionTexto}
        />

        {/* 2. Organigrama (protagonista cuando existe equipo) */}
        {hasOrganigram && (
          <OrganigramView
            leaderNode={leaderNode}
            childrenNodes={childrenNodes}
            currentAfiliadoId={id!}
          />
        )}

        {/* 3. Perfil académico y descripción */}
        {/* <div className="max-w-5xl mx-auto w-full">
          <ProfileMainContent afiliado={afiliado} />
        </div> */}

        {/* 4. Data Section (Bottom, Full Width, Compact) */}
        <div className="w-full">
          <DataSections 
            afiliado={afiliado}
            isCorporativo={isCorporativo}
            isRepMode={isRepMode}
            ubicacionTexto={ubicacionTexto}
            showEmpresaSection={showEmpresaSection}
            showAfiliadoSection={showAfiliadoSection}
          />
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default AfiliadoProfilePage;
