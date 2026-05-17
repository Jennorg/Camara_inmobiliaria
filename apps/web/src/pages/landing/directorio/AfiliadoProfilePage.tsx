import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { 
  ArrowLeft, Mail, Phone, MapPin, User, 
  Globe, Instagram, Linkedin, 
  Facebook, GraduationCap, Loader2, Twitter, 
  Link2, Briefcase, FileText
} from 'lucide-react';
import { API_URL } from '@/config/env';
import Navbar from '@/pages/landing/components/navbar/Navbar';
import Footer from '@/pages/landing/components/Footer';
import { formatNombreCard, getInitials, formatRif } from '@/utils/formatters';
import { AfiliadoCard, AfiliadoData } from './components/AfiliadoCard';

interface AfiliadoProfile extends AfiliadoData {
  afiliados_asociados?: AfiliadoData[];
}

const AfiliadoProfilePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [afiliado, setAfiliado] = useState<AfiliadoProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch(`${API_URL}/api/public/afiliados/${id}`);
        const json = await res.json();
        if (json.success) {
          setAfiliado(json.data);
        } else {
          setError(json.message || 'No se pudo cargar el perfil');
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
        setError('Error de conexión con el servidor');
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchProfile();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#022c22]">
        <Navbar darkMode={darkMode} setDarkMode={setDarkMode} />
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
        <Navbar darkMode={darkMode} setDarkMode={setDarkMode} />
        <div className="flex-grow flex items-center justify-center px-6">
          <div className="max-w-md w-full bg-white dark:bg-[#04432f] p-10 rounded-[2.5rem] shadow-xl border border-slate-200 dark:border-emerald-500/20 text-center space-y-6">
            <div className="w-20 h-20 bg-rose-50 dark:bg-rose-500/10 rounded-full flex items-center justify-center mx-auto">
              <FileText className="text-rose-500" size={40} />
            </div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-white">Perfil no disponible</h2>
            <p className="text-slate-500 dark:text-emerald-100/70">{error || 'El miembro que buscas no existe o no se encuentra activo.'}</p>
            <button 
              onClick={() => navigate('/miembros')}
              className="inline-flex items-center gap-2 bg-emerald-600 text-white px-8 py-3 rounded-full font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20"
            >
              <ArrowLeft size={18} />
              Volver al Directorio
            </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const isRepMode = new URLSearchParams(location.search).get('mode') === 'rep';
  const isCorporativo = afiliado.tipo_afiliado === 'Corporativo' && !isRepMode;
  const yearsOfService = afiliado.fecha_inicio_servicio 
    ? new Date().getFullYear() - new Date(afiliado.fecha_inicio_servicio).getFullYear()
    : 0;

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-500 ${darkMode ? 'dark bg-[#022c22] text-slate-100' : 'bg-slate-50 text-slate-800'}`}>
      <Navbar darkMode={darkMode} setDarkMode={setDarkMode} />

      <main className="flex-grow pt-20">
        {/* Back Button Overlay */}
        <div className="absolute top-24 left-6 z-20">
          <Link 
            to="/miembros"
            className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md text-white rounded-xl border border-white/10 hover:bg-white/20 transition-all group"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            <span className="text-xs font-black uppercase tracking-widest">Directorio</span>
          </Link>
        </div>

        {/* HERO BANNER SECTION */}
        <div className="relative w-full h-[400px] md:h-[450px] overflow-hidden bg-[#022c22]">
          {/* Background Pattern/Image */}
          <div className="absolute inset-0 opacity-20">
             <div className="absolute inset-0 bg-gradient-to-b from-emerald-900/50 to-[#022c22]" />
             <img 
               src="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=2070" 
               alt="Background" 
               className="w-full h-full object-cover"
             />
          </div>

          <div className="relative max-w-7xl mx-auto h-full px-6 flex flex-col justify-end pb-12 md:pb-20">
            <div className="flex flex-col md:flex-row items-center md:items-end gap-8 md:gap-12">
              {/* Profile Image */}
              <div className="relative shrink-0">
                <div className="w-40 h-40 md:w-56 md:h-56 rounded-[2rem] overflow-hidden border-[6px] border-white/10 dark:border-white/5 shadow-2xl bg-slate-900 flex items-center justify-center">
                   {!isRepMode && ((isCorporativo && afiliado.empresa_logo_url) || afiliado.foto_url) ? (
                     <img 
                       src={(isCorporativo && afiliado.empresa_logo_url) ? afiliado.empresa_logo_url : afiliado.foto_url} 
                       alt={afiliado.nombre_completo}
                       className="w-full h-full object-cover"
                     />
                   ) : (
                     <span className="text-white font-black text-6xl uppercase tracking-tighter">
                       {getInitials(afiliado.nombres || afiliado.nombre_completo, afiliado.apellidos)}
                     </span>
                   )}
                </div>
              </div>

              {/* Name and Badges */}
              <div className="flex-1 text-center md:text-left space-y-4">
                <div className="space-y-1">
                  <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight leading-tight">
                    {isCorporativo 
                      ? (afiliado.empresa_razon_social || afiliado.razon_social || formatNombreCard(afiliado.nombre_completo)) 
                      : formatNombreCard(afiliado.nombres || afiliado.nombre_completo, afiliado.apellidos)}
                  </h1>
                </div>

                <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                  <span className="px-4 py-1.5 bg-white/10 backdrop-blur-md text-emerald-300 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/5">
                    {isCorporativo ? 'Miembro Corporativo' : isRepMode ? 'Representante Legal' : 'Agente Independiente'}
                  </span>
                  {afiliado.empresa_razon_social && !isCorporativo && (
                    <Link 
                      to={isRepMode ? `/miembros/${afiliado.id_afiliado}` : `/miembros/${afiliado.id_empresa}`} 
                      className="px-4 py-1.5 bg-emerald-500/20 backdrop-blur-md text-emerald-100 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-500/20 hover:bg-emerald-500/30 transition-all"
                    >
                      {isRepMode ? 'Representante de:' : 'Parte de:'} {afiliado.empresa_razon_social}
                    </Link>
                  )}
                  <span className="px-4 py-1.5 bg-white/10 backdrop-blur-md text-slate-300 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/5">
                    Código: {afiliado.codigo_cibir || '---'}
                  </span>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* CONTENT GRID */}
        <div className="max-w-7xl mx-auto px-6 py-12 md:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-12">
            
            {/* LEFT COLUMN: Contact & Stats */}
            <div className="lg:col-span-4 space-y-8">
              
              {/* Contact Card */}
              <section className="bg-white dark:bg-[#04432f] rounded-[2.5rem] p-8 shadow-xl border border-slate-200 dark:border-emerald-500/10">
                <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest mb-8 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <Mail size={16} className="text-emerald-500" />
                  </div>
                  Contacto Directo
                </h3>
                
                <div className="space-y-8">
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-[#022c22] flex items-center justify-center text-emerald-500 shrink-0 shadow-sm">
                      <FileText size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{isCorporativo ? 'RIF' : 'Documento de Identidad'}</p>
                      <p className="text-sm font-bold text-slate-700 dark:text-emerald-50">
                        {isCorporativo && afiliado.empresa_rif_numero ? formatRif(afiliado.empresa_rif_tipo, afiliado.empresa_rif_numero) : afiliado.cedula}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-[#022c22] flex items-center justify-center text-emerald-500 shrink-0 shadow-sm">
                      <Mail size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                        {isCorporativo ? 'Correo Corporativo' : 'Correo Electrónico'}
                      </p>
                      <p className="text-sm font-bold text-slate-700 dark:text-emerald-50 truncate max-w-[200px] md:max-w-none">
                        {isCorporativo ? (afiliado.empresa_email || afiliado.email) : afiliado.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-[#022c22] flex items-center justify-center text-emerald-500 shrink-0 shadow-sm">
                      <Phone size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                        {isCorporativo ? 'Teléfono Corporativo' : 'Teléfono'}
                      </p>
                      <p className="text-sm font-bold text-slate-700 dark:text-emerald-50">
                        {isCorporativo ? (afiliado.empresa_telefono || afiliado.telefono || 'No disponible') : (afiliado.telefono || 'No disponible')}
                      </p>
                    </div>
                  </div>

                  {isCorporativo && (afiliado.email || afiliado.telefono) && (
                    <>
                      <hr className="border-slate-100 dark:border-emerald-500/10" />
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Representante Legal</p>
                        <div className="flex items-center gap-5">
                          <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-[#022c22] flex items-center justify-center text-blue-500 shrink-0 shadow-sm">
                            <User size={20} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-700 dark:text-emerald-50">
                              {formatNombreCard(afiliado.nombres || afiliado.nombre_completo, afiliado.apellidos)}
                            </p>
                            <div className="text-[10px] text-slate-500 mt-0.5 space-x-2">
                              {afiliado.email && <span>{afiliado.email}</span>}
                              {afiliado.telefono && <span>• {afiliado.telefono}</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                      <hr className="border-slate-100 dark:border-emerald-500/10" />
                    </>
                  )}

                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-[#022c22] flex items-center justify-center text-emerald-500 shrink-0 shadow-sm">
                      <MapPin size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Ubicación</p>
                      <p className="text-sm font-bold text-slate-700 dark:text-emerald-50">
                        {isCorporativo || afiliado.mostrar_direccion_publica 
                          ? (afiliado.direccion_publica || afiliado.direccion || 'Cámara Inmobiliaria Bolívar')
                          : 'Información Reservada'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Social Networks & Website */}
                {(afiliado.website || (afiliado.redes_sociales && Object.values(afiliado.redes_sociales).some(v => !!v))) && (
                  <div className="mt-10 pt-8 border-t border-slate-100 dark:border-emerald-500/10">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Presencia Digital</p>
                    <div className="flex flex-wrap gap-3">
                      {afiliado.website && (
                        <a href={afiliado.website} target="_blank" rel="noopener noreferrer" className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all shadow-sm" title="Sitio Web">
                          <Globe size={20} />
                        </a>
                      )}
                      {afiliado.redes_sociales && Object.entries(afiliado.redes_sociales as Record<string, string | undefined>).map(([network, url]) => {
                        if (!url) return null;
                        const net = network.toLowerCase();
                        let Icon = Link2;
                        let linkUrl = url;
                        if (net === 'instagram') {
                          Icon = Instagram;
                          if (!url.startsWith('http')) linkUrl = `https://instagram.com/${url.replace('@','')}`;
                        } else if (net === 'linkedin') {
                          Icon = Linkedin;
                        } else if (net === 'facebook') {
                          Icon = Facebook;
                        } else if (net === 'twitter' || net === 'x') {
                          Icon = Twitter;
                        }
                        return (
                          <a key={network} href={linkUrl} target="_blank" rel="noopener noreferrer" className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-[#022c22] flex items-center justify-center text-slate-400 hover:bg-emerald-500 hover:text-white transition-all shadow-sm border border-slate-100 dark:border-white/5" title={network}>
                            <Icon size={20} />
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>

            </div>

            {/* RIGHT COLUMN: Professional Info */}
            <div className="lg:col-span-8 space-y-12">
              <section className="bg-white dark:bg-[#04432f] rounded-[2.5rem] p-8 md:p-12 shadow-xl border border-slate-200 dark:border-emerald-500/10">
                <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest mb-10 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <GraduationCap size={16} className="text-emerald-500" />
                  </div>
                  Perfil Académico y Profesional
                </h3>

                <div className="mb-12 space-y-4">
                  <div className="relative p-6 rounded-[2rem] bg-slate-50 dark:bg-[#022c22] flex items-center gap-5 overflow-hidden group">
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-blue-500" />
                    <div className="w-12 h-12 rounded-2xl bg-white dark:bg-blue-500/10 flex items-center justify-center text-blue-500 shadow-sm shrink-0">
                      <GraduationCap size={24} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Nivel Académico</p>
                      <p className="text-lg font-black text-slate-800 dark:text-white leading-none">
                        {afiliado.nivel_academico || 'No especificado'}
                      </p>
                    </div>
                  </div>

                  {afiliado.profesion && (
                    <div className="relative p-6 rounded-[2rem] bg-slate-50 dark:bg-[#022c22] flex items-center gap-5 overflow-hidden group">
                      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-emerald-500" />
                      <div className="w-12 h-12 rounded-2xl bg-white dark:bg-emerald-500/10 flex items-center justify-center text-emerald-500 shadow-sm shrink-0">
                        <Briefcase size={24} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Profesión / Especialidad</p>
                        <p className="text-lg font-black text-slate-800 dark:text-white leading-none">
                          {afiliado.profesion}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Descripción Profesional</p>
                  <div className="relative p-8 rounded-[2rem] bg-slate-50 dark:bg-[#022c22] overflow-hidden">
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-emerald-600/30" />
                    <p className="text-sm md:text-base text-slate-600 dark:text-emerald-100/70 leading-relaxed font-medium italic">
                      {afiliado.notas || 'Este miembro aún no ha redactado su descripción profesional. Próximamente compartirá más detalles sobre su trayectoria y especialidad.'}
                    </p>
                  </div>
                </div>
              </section>

              {/* Bio Section */}
              {afiliado.descripcion && (
                <section className="bg-white dark:bg-[#04432f] rounded-[2.5rem] p-8 md:p-12 shadow-xl border border-slate-200 dark:border-emerald-500/10">
                  <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest mb-8 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                      <User size={16} className="text-emerald-500" />
                    </div>
                    Sobre el Miembro
                  </h3>
                  <p className="text-slate-600 dark:text-emerald-100/80 leading-relaxed font-medium whitespace-pre-wrap">
                    {afiliado.descripcion}
                  </p>
                </section>
              )}

              {/* Miembros Asociados (Solo Corporativo) */}
              {isCorporativo && afiliado.afiliados_asociados && afiliado.afiliados_asociados.length > 0 && (
                <section className="bg-white dark:bg-[#04432f] rounded-[2.5rem] p-8 md:p-12 shadow-xl border border-slate-200 dark:border-emerald-500/10">
                  <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest mb-8 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                      <User size={16} className="text-emerald-500" />
                    </div>
                    Equipo de Trabajo ({afiliado.afiliados_asociados.length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {afiliado.afiliados_asociados.map((assoc: AfiliadoData) => (
                      <AfiliadoCard 
                        key={assoc.id_afiliado} 
                        afiliado={assoc} 
                        forceRepMode={assoc.id_afiliado === afiliado.id_afiliado}
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default AfiliadoProfilePage;
