import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, MapPin, User, 
  Globe, Instagram, Linkedin, 
  Facebook, GraduationCap, Loader2, Twitter, 
  Link2, Briefcase, FileText, Building2, Music2 
} from 'lucide-react';
import { formatNombreCard, getInitials, formatRif } from '@/utils/formatters';
import { AfiliadoData } from '../AfiliadoCard';
import logoCibir from '@/assets/Logo3.png';
import { UseAfiliadoProfileResult } from './useAfiliadoProfile';

interface ProfileHeroProps {
  afiliado: AfiliadoData;
  isRepMode: boolean;
  isCorporativo: boolean;
  displayEmblem: string;
  companyLogo: string | null;
  ubicacionTexto: string;
}

const XIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932 6.064-6.932zm-1.294 19.486h2.039L6.486 3.24H4.298l13.31 17.399z"/>
  </svg>
);

const TikTokIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-1.01-.14-.1-.27-.2-.4-.31v4.99c0 .24-.01.48-.03.71-.11 2.53-1.44 4.81-3.66 6.03-2.12 1.19-4.81 1.25-6.99.14-2.16-1.07-3.66-3.23-3.92-5.63-.33-2.43.74-4.99 2.82-6.28 1.34-.84 2.97-1.18 4.54-.93V11.1c-1-.22-2.11-.08-3 .42-.9.5-1.52 1.45-1.58 2.47-.07 1.16.51 2.33 1.51 2.89 1 .58 2.34.5 3.24-.22.6-.48.92-1.22.92-1.99V0z"/>
  </svg>
);

export const ProfileHero = ({ 
  afiliado, 
  isRepMode, 
  isCorporativo, 
  displayEmblem, 
  companyLogo, 
  ubicacionTexto 
}: ProfileHeroProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-[#0c121f] via-[#101524] to-[#070b12] text-white rounded-[2.5rem] p-8 md:p-12 shadow-2xl border border-white/5 max-w-4xl mx-auto">
      {/* Background ambient glowing lights */}
      <div className="absolute top-0 right-0 -mr-24 -mt-24 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-0 left-0 -ml-24 -mb-24 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px]" />

      <div className="relative flex flex-col items-center">
        {/* Center Company Logo / CIBIR Emblem */}
        <div className="flex justify-center mb-8">
          <div className={`flex items-center justify-center rounded-2xl p-4 ${isCorporativo && companyLogo ? 'bg-white' : ''}`}>
            <img
              src={displayEmblem}
              alt={isCorporativo ? `Logo de ${afiliado.empresa_razon_social || 'empresa'}` : 'CIBIR'}
              className="max-h-36 md:max-h-44 max-w-[280px] object-contain"
            />
          </div>
        </div>

        {/* Company Name & RIF */}
        {(isCorporativo || afiliado.empresa_razon_social) ? (
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-4xl font-black tracking-wide uppercase">
              {afiliado.empresa_razon_social || afiliado.razon_social}
            </h2>
            {(afiliado.empresa_rif_numero || afiliado.cedula) && (
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-2">
                RIF: {formatRif(afiliado.empresa_rif_tipo || 'J', afiliado.empresa_rif_numero || '')}
              </p>
            )}
          </div>
        ) : (
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-black tracking-wide uppercase text-slate-300">
              Cámara Inmobiliaria de Bolívar
            </h2>
            <p className="text-xs text-emerald-400 font-bold uppercase tracking-widest mt-2">
              Afiliado Activo Independiente
            </p>
          </div>
        )}

        {/* Bottom Row: Representative, Social Icons, Location */}
        <div className="w-full flex flex-col md:flex-row items-center justify-between gap-6 mt-4 pt-8 border-t border-white/10">
          {/* Representative / Member Info */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden border-[3px] border-white dark:border-[#070b12] shadow-xl shrink-0 bg-slate-900 flex items-center justify-center">
              {afiliado.foto_url ? (
                <img
                  src={afiliado.foto_url}
                  alt={`Foto de ${formatNombreCard(afiliado.nombres || afiliado.nombre_completo, afiliado.apellidos)}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-white font-black text-2xl uppercase tracking-tighter">
                  {getInitials(afiliado.nombres || afiliado.nombre_completo, afiliado.apellidos)}
                </span>
              )}
            </div>
            <div className="text-center md:text-left">
              <h3 className="text-base md:text-lg font-black tracking-wide uppercase leading-tight">
                {formatNombreCard(afiliado.nombres || afiliado.nombre_completo, afiliado.apellidos)}
              </h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                {isCorporativo ? 'Representante Legal' : afiliado.profesion || 'Agente Independiente'}
              </p>
              
              {/* Location Pin */}
              <div className="flex items-center justify-center md:justify-start gap-1.5 text-xs text-slate-400 mt-2">
                <MapPin size={12} className="text-emerald-500 shrink-0" />
                <span>{ubicacionTexto}</span>
              </div>
            </div>
          </div>

           <div className="flex items-center gap-3">
            {(isCorporativo ? afiliado.empresa_email || afiliado.email : afiliado.email) && (
              <a href={`mailto:${isCorporativo ? afiliado.empresa_email || afiliado.email : afiliado.email}`} className="w-10 h-10 rounded-full bg-white/10 hover:bg-emerald-600 hover:text-white transition-all flex items-center justify-center border border-white/5 text-slate-300" title={isCorporativo ? "Correo de la Empresa" : "Correo"}>
                <Mail size={16} />
              </a>
            )}
            {afiliado.linkedin && (
              <a href={afiliado.linkedin} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/10 hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center border border-white/5 text-slate-300" title="LinkedIn">
                <Linkedin size={16} />
              </a>
            )}
            {afiliado.instagram && (
              <a href={afiliado.instagram} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/10 hover:bg-gradient-to-tr hover:from-purple-600 hover:to-pink-500 hover:text-white transition-all flex items-center justify-center border border-white/5 text-slate-300" title="Instagram">
                <Instagram size={16} />
              </a>
            )}
            {afiliado.facebook && (
              <a href={afiliado.facebook} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/10 hover:bg-[#1877F2] hover:text-white transition-all flex items-center justify-center border border-white/5 text-slate-300" title="Facebook">
                <Facebook size={16} />
              </a>
            )}
            {afiliado.twitter && (
              <a href={afiliado.twitter} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/10 hover:bg-black hover:text-white transition-all flex items-center justify-center border border-white/5 text-slate-300" title="X">
                <XIcon size={16} />
              </a>
            )}
            {afiliado.tiktok && (
              <a href={afiliado.tiktok} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/10 hover:bg-black hover:text-white transition-all flex items-center justify-center border border-white/5 text-slate-300" title="TikTok">
                <TikTokIcon size={16} />
              </a>
            )}
            {(afiliado.website || (isCorporativo && afiliado.empresa_website)) && (
              <a href={isCorporativo ? (afiliado.empresa_website || afiliado.website) : afiliado.website} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/10 hover:bg-emerald-600 hover:text-white transition-all flex items-center justify-center border border-white/5 text-slate-300" title="Sitio Web">
                <Globe size={16} />
              </a>
            )}
            {(isCorporativo ? afiliado.empresa_telefono || afiliado.telefono : afiliado.telefono) && (
              <a href={`https://wa.me/${(isCorporativo ? afiliado.empresa_telefono || afiliado.telefono : afiliado.telefono)!.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/10 hover:bg-[#25D366] hover:text-white transition-all flex items-center justify-center border border-white/5 text-slate-300" title={isCorporativo ? "WhatsApp de la Empresa" : "WhatsApp"}>
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.63-1.023-5.101-2.885-6.967C16.528 3.973 14.077 2.945 11.46 2.945c-5.447 0-9.873 4.37-9.877 9.799-.001 1.778.474 3.51 1.378 5.028l-.972 3.548 3.658-.962zm11.786-6.84c-.273-.137-1.616-.797-1.87-.89-.253-.093-.438-.137-.622.137-.184.273-.713.89-.873 1.072-.16.182-.32.205-.593.068-.273-.137-1.155-.426-2.2-1.357-.813-.725-1.36-1.62-1.52-1.894-.16-.273-.017-.42.12-.557.123-.124.273-.32.41-.48.136-.16.182-.273.273-.455.09-.182.046-.341-.023-.48-.068-.137-.622-1.502-.852-2.053-.224-.544-.45-.468-.621-.477-.16-.008-.344-.01-.529-.01-.184 0-.483.07-.736.342-.253.273-.966.945-.966 2.304 0 1.358.988 2.67 1.103 2.828.115.158 1.944 2.97 4.71 4.164.658.284 1.172.453 1.573.58.66.21 1.26.18 1.734.11.53-.08 1.616-.66 1.843-1.298.227-.638.227-1.185.159-1.298-.068-.113-.253-.182-.527-.32z"/>
                </svg>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
